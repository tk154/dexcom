'use strict';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { DexcomClient } from './dexcomClient.js';

const DexcomIndicator = GObject.registerClass(
class DexcomIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Dexcom Indicator');
        this._settings = settings;
        // Path henüz tanımlı değil, constructor'da almamız gerek
        this.path = null;

        // Create container box
        this.box = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });

        // Create label
        this.buttonText = new St.Label({
            text: '---',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'dexcom-label'
        });

        // Add the box to the button
        this.add_child(this.box);
        this.box.add_child(this.buttonText);

        // Initialize DexcomClient with credentials
        this._dexcomClient = new DexcomClient(
            this._settings.get_string('username'),
            this._settings.get_string('password'),
            this._settings.get_string('region'),
            this._settings.get_string('unit')
        );

        // Add menu items
        this._buildMenu();
        // Listen changes
        this._connectSignals();
        // Start monitoring
        this._startMonitoring();
    }
    
    setPath(path) {
        this.path = path;
        // Now that we have the path, initialize the icon
        this._initIcon();
        this._updateIconVisibility();
    }

    _loadIcon() {
        if (!this.path) {
            throw new Error('Extension path not set');
        }

        const iconPath = `${this.path}/icons/dexcom-icon.svg`;
        const file = Gio.File.new_for_path(iconPath);
        
        if (file.query_exists(null)) {
            if (this.icon) {
                this.icon.gicon = Gio.icon_new_for_string(iconPath);
            } else {
                this.icon = new St.Icon({
                    style_class: 'dexcom-icon',
                    gicon: Gio.icon_new_for_string(iconPath),
                    icon_size: 16
                });
            }
        } else {
            throw new Error(`Icon file not found: ${iconPath}`);
        }
    }    

    _initIcon() {
        try {
            this._loadIcon();
        } catch (error) {
            console.error('Error initializing icon:', error);
            // Fallback icon
            this.icon = new St.Icon({
                icon_name: 'utilities-system-monitor-symbolic',
                style_class: 'system-status-icon',
                icon_size: 16
            });
        }
    }

    _connectSignals() {        
        // Function to update display when settings change
        const updateDisplaySettings = () => {
            if (this._currentReading) {
                this._updateDisplay(this._currentReading);
            }
        };
    
        // Listen for display setting changes
        this._settings.connect('changed::show-icon', updateDisplaySettings);
        this._settings.connect('changed::show-trend-arrows', updateDisplaySettings);
        this._settings.connect('changed::show-delta', updateDisplaySettings);
        this._settings.connect('changed::show-elapsed-time', updateDisplaySettings);
        
        // Listen for credential and unit changes
        this._settings.connect('changed::username', () => {
            this._updateCredentials();
            this._updateReading();
        });
        this._settings.connect('changed::password', () => {
            this._updateCredentials();
            this._updateReading();
        });
        this._settings.connect('changed::region', () => {
            this._updateCredentials();
            this._updateReading();
        });
        this._settings.connect('changed::unit', () => {
            this._updateUnit();
            this._updateReading();
        });
    }

    // _updateCredentials() {
    // this._dexcomClient = new DexcomClient(
    //     this._settings.get_string('username'),
    //     this._settings.get_string('password'),
    //     this._settings.get_string('region'),
    //     this._settings.get_string('unit')
    // );
    // this._updateReading();
    // }
    // Update credentials and reinitialize client
    _updateCredentials() {
        this._dexcomClient = new DexcomClient(
            this._settings.get_string('username'),
            this._settings.get_string('password'),
            this._settings.get_string('region'),
            this._settings.get_string('unit')
        );
    }
    // Add menu toggle items with immediate update
    _addToggleMenuItem(label, settingKey) {
        const toggleItem = new PopupMenu.PopupSwitchMenuItem(
            label, 
            this._settings.get_boolean(settingKey)
        );
        toggleItem.connect('toggled', (item) => {
            this._settings.set_boolean(settingKey, item.state);
            // Force an immediate reading update
            this._updateReading();
        });
        this.menu.addMenuItem(toggleItem);
    }

    _updateUnit() {
        // DexcomClient'ı yeni birimle güncelleyin
        this._dexcomClient = new DexcomClient(
            this._settings.get_string('username'),
            this._settings.get_string('password'),
            this._settings.get_string('region'),
            this._settings.get_string('unit')
        );
    
        // Mevcut okumayı yeni birimle güncelleyin
        if (this._currentReading) {
            const value = this._settings.get_string('unit') === 'mmol/L' 
                ? (this._currentReading.value / 18.0).toFixed(1) 
                : this._currentReading.value;
            
            const delta = this._settings.get_string('unit') === 'mmol/L'
                ? (this._currentReading.delta / 18.0).toFixed(1)
                : this._currentReading.delta;
    
            const updatedReading = {
                ...this._currentReading,
                value: value,
                delta: delta,
                unit: this._settings.get_string('unit')
            };
    
            this._updateDisplay(updatedReading);
            this._updateMenuInfo(updatedReading);
        }
    
        // Yeni okuma alın
        this._updateReading();
    }
    
    // Start monitoring glucose updates
    _startMonitoring() {
        // Initial reading
        this._updateReading();
        
        // Set up interval for periodic updates
        this._timeout = setInterval(() => {
            this._updateReading();
        }, this._settings.get_int('update-interval') * 1000);
    }

    // Update the reading from Dexcom
    async _updateReading() {
        try {
            const reading = await this._dexcomClient.getLatestGlucose();
            if (!reading) {
                this.buttonText.text = 'No Data';
                this.buttonText.style_class = 'dexcom-label';
                this.glucoseInfo.label.text = 'No glucose data available';
                return;
            }
            
            // Update both panel display and menu info
            this._updateDisplay(reading);
            this._updateMenuInfo(reading);
            
        } catch (error) {
            console.error('Error fetching Dexcom reading:', error);
            
            // Set appropriate error messages
            let errorMessage = 'No Data';
            let detailedMessage = 'No glucose data available';
            
            if (error.message?.includes('unauthorized') || error.message?.includes('credentials')) {
                errorMessage = 'Auth Error';
                detailedMessage = 'Please check your Dexcom Share credentials';
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = 'Network Error';
                detailedMessage = 'Please check your internet connection';
            }
            
            // Update display with error messages
            this.buttonText.text = errorMessage;
            this.buttonText.style_class = 'dexcom-label dexcom-error';
            this.glucoseInfo.label.text = detailedMessage;
        }
    }



_getColorForValue(value) {
    const urgentHigh = this._settings.get_int('urgent-high-threshold');
    const high = this._settings.get_int('high-threshold');
    const low = this._settings.get_int('low-threshold');
    const urgentLow = this._settings.get_int('urgent-low-threshold');

    // Get colors from settings
    const urgentHighColor = this._settings.get_string('urgent-high-color');
    const highColor = this._settings.get_string('high-color');
    const normalColor = this._settings.get_string('normal-color');
    const lowColor = this._settings.get_string('low-color');
    const urgentLowColor = this._settings.get_string('urgent-low-color');

    let styleClass = 'dexcom-label ';
    let color = '';
    
    if (value >= urgentHigh) {
        styleClass += 'dexcom-urgent-high';
        color = urgentHighColor;
    } else if (value >= high) {
        styleClass += 'dexcom-high';
        color = highColor;
    } else if (value > low) {
        styleClass += 'dexcom-normal';
        color = normalColor;
    } else if (value > urgentLow) {
        styleClass += 'dexcom-low';
        color = lowColor;
    } else {
        styleClass += 'dexcom-urgent-low';
        color = urgentLowColor;
    }
    
    // Doğrudan stil olarak rengi uygula
    this.buttonText.style = `color: ${color};`;
    return styleClass;
}

    _updateIconVisibility() {
        // Clear existing children
        this.box.remove_all_children();

        const showIcon = this._settings.get_boolean('show-icon');
        const iconPosition = this._settings.get_string('icon-position');

        // Add elements in the correct order
        if (showIcon && iconPosition === 'left') {
            this.box.add_child(this.icon);
        }

        this.box.add_child(this.buttonText);

        if (showIcon && iconPosition === 'right') {
            this.box.add_child(this.icon);
        }
    }

    // Update the display with glucose reading
    _updateDisplay(reading) {
        // Clear the box and set base style
        this.box.remove_all_children();
        this.box.style_class = 'dexcom-box';

        // Add icon if enabled
        if (this._settings.get_boolean('show-icon')) {
            this.box.add_child(this.icon);
        }

        // Handle case when no reading is available
        if (!reading) {
            const label = new St.Label({
                text: 'No Data',
                style_class: 'dexcom-value'
            });
            this.box.add_child(label);
            return;
        }

        // Store current reading for future reference
        this._currentReading = reading;

        // Create container for glucose value
        const valueContainer = new St.Bin({
            style_class: `dexcom-value-container ${this._getBackgroundClass(reading.value)}`,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        // Add glucose value
        const valueLabel = new St.Label({
            text: `${reading.value}`,
            style_class: 'dexcom-value',
            y_align: Clutter.ActorAlign.CENTER
        });
        
        valueContainer.set_child(valueLabel);
        this.box.add_child(valueContainer);

        // Add trend arrow if enabled
        if (this._settings.get_boolean('show-trend-arrows')) {
            const trendLabel = new St.Label({
                text: this._getTrendArrow(reading.trend),
                style_class: 'dexcom-trend'
            });
            this.box.add_child(trendLabel);
        }

        // Add delta if enabled
        if (this._settings.get_boolean('show-delta')) {
            const deltaLabel = new St.Label({
                text: `${reading.delta > 0 ? '+' : ''}${reading.delta}`,
                style_class: 'dexcom-delta'
            });
            this.box.add_child(deltaLabel);
        }

        // Add elapsed time if enabled
        if (this._settings.get_boolean('show-elapsed-time')) {
            const elapsed = Math.floor((Date.now() - reading.timestamp) / 60000);
            const timeLabel = new St.Label({
                text: `${elapsed}m`,
                style_class: 'dexcom-time'
            });
            this.box.add_child(timeLabel);
        }
    }

    
    _buildMenu() {
        // Glucose info section
        this.glucoseInfo = new PopupMenu.PopupMenuItem('Loading...', {
            reactive: false,
            style_class: 'dexcom-menu-item'
        });
        this.menu.addMenuItem(this.glucoseInfo);
    
        // Add separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    
        // Display options
        const displayOptionsLabel = new PopupMenu.PopupMenuItem('Display Options:', {
            reactive: false,
            style_class: 'dexcom-menu-header'
        });
        this.menu.addMenuItem(displayOptionsLabel);
    
        this._addToggleMenuItem('Show Delta', 'show-delta');
        this._addToggleMenuItem('Show Trend Arrows', 'show-trend-arrows');
        this._addToggleMenuItem('Show Elapsed Time', 'show-elapsed-time');
        this._addToggleMenuItem('Show Icon', 'show-icon');
    
        // Add separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    
        // Add settings button
        const settingsButton = new PopupMenu.PopupMenuItem('Open Settings', {
            style_class: 'dexcom-settings-button'
        });
        settingsButton.connect('activate', () => {
            if (this.extension) {
                this.extension.openPreferences();
            }
        });
        this.menu.addMenuItem(settingsButton);
    }
    
    _getBackgroundClass(value) {
        const urgentHigh = this._settings.get_int('urgent-high-threshold');
        const high = this._settings.get_int('high-threshold');
        const low = this._settings.get_int('low-threshold');
        const urgentLow = this._settings.get_int('urgent-low-threshold');
        
        if (value >= urgentHigh) return 'bg-urgent-high';
        if (value >= high) return 'bg-high';
        if (value > low) return 'bg-normal';
        if (value > urgentLow) return 'bg-low';
        return 'bg-urgent-low';
    }
    
    _updateMenuInfo(reading) {
        if (!reading) {
            this.glucoseInfo.label.text = 'No data available';
            return;
        }

        const unit = this._settings.get_string('unit');
        const timestamp = new Date(reading.timestamp).toLocaleTimeString();
        
        let info = `Last Reading: ${reading.value} ${unit}\n`;
        info += `Time: ${timestamp}\n`;
        info += `Trend: ${reading.trend}\n`;
        info += `Delta: ${reading.delta > 0 ? '+' : ''}${reading.delta} ${unit}`;

        this.glucoseInfo.label.text = info;
    }

    _getTrendArrow(trend) {
        const arrows = {
            NONE: '→',
            DOUBLE_UP: '⇈',
            SINGLE_UP: '↑',
            FORTY_FIVE_UP: '↗',
            FLAT: '→',
            FORTY_FIVE_DOWN: '↘',
            SINGLE_DOWN: '↓',
            DOUBLE_DOWN: '⇊',
            NOT_COMPUTABLE: '-',
            RATE_OUT_OF_RANGE: '?'
        };
        return arrows[trend] || arrows.NONE;
    }

    destroy() {
        if (this._timeout) {
            clearInterval(this._timeout);
        }
        super.destroy();
    }
});
export default class DexcomExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new DexcomIndicator(this._settings);
        // Set path before initializing icon
        this._indicator.setPath(this.path);
        this._indicator.extension = this;
        Main.panel.addToStatusArea('dexcom-indicator', this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

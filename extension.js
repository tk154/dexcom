'use strict';

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { DexcomClient } from './dexcomClient.js';

const DexcomIndicator = GObject.registerClass(
class DexcomIndicator extends PanelMenu.Button {
    _init(settings, extension) {
        super._init(0.0, 'Dexcom Indicator');
        this._settings = settings;
        this._extension = extension;
        this._timeoutSource = null;
        this._destroyed = false;
        
        // Create box layout
        this.box = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });

        // Add icon
        try {
            const iconPath = GLib.build_filenamev([extension.path, 'icons', 'icon.svg']);
            this.icon = new St.Icon({
                gicon: Gio.Icon.new_for_string(iconPath),
                style_class: 'system-status-icon dexcom-icon',
                icon_size: 20
            });
        } catch (error) {
            log(`[Dexcom] Failed to load icon: ${error}. Using fallback.`);
            this.icon = new St.Icon({
                icon_name: 'utilities-system-monitor-symbolic',
                style_class: 'system-status-icon',
                icon_size: 20
            });
        }

        // Add label
        this.label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 5px;'
        });

        this.box.add_child(this.icon);
        this.box.add_child(this.label);
        this.add_child(this.box);

        this._buildMenu();
        this._initClient();
    }

    _buildMenu() {
        // Status section
        this._statusSection = new PopupMenu.PopupMenuSection();
        this._statusItem = new PopupMenu.PopupMenuItem('Initializing...');
        this._statusSection.addMenuItem(this._statusItem);
        this.menu.addMenuItem(this._statusSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button
        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);
    }

    async _initClient() {
        if (this._destroyed) return;

        const username = this._settings.get_string('username');
        const password = this._settings.get_string('password');
        const region = this._settings.get_string('region');
        const unit = this._settings.get_string('unit');

        if (!username || !password) {
            this._updateUI('⚠️ Set credentials', 'red', 'Missing credentials');
            return;
        }

        try {
            this._client = new DexcomClient(username, password, region, unit);
            await this._client.authenticate();
            this._startPolling();
        } catch (error) {
            this._handleError(error);
        }
    }

    _startPolling() {
        if (this._destroyed) return;

        // Clear existing timeout
        this._removeTimeout();

        // Initial update
        this._updateGlucose();

        // Set up periodic updates
        const interval = this._settings.get_int('update-interval');
        this._timeoutSource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                if (!this._destroyed) {
                    this._updateGlucose();
                    return GLib.SOURCE_CONTINUE;
                }
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _removeTimeout() {
        if (this._timeoutSource) {
            GLib.source_remove(this._timeoutSource);
            this._timeoutSource = null;
        }
    }

    async _updateGlucose() {
        if (this._destroyed) return false;

        try {
            const reading = await this._client.getLatestGlucose();
            const displayText = `${reading.value} ${reading.unit} ${reading.trendArrow}`;
            
            // Determine color based on thresholds
            const value = parseFloat(reading.value);
            const lowThreshold = this._settings.get_int('low-threshold');
            const highThreshold = this._settings.get_int('high-threshold');
            
            let color;
            if (reading.unit === 'mmol/L') {
                if (value < lowThreshold/18.0) color = 'red';
                else if (value > highThreshold/18.0) color = 'yellow';
                else color = '#00ff00';
            } else {
                if (value < lowThreshold) color = 'red';
                else if (value > highThreshold) color = 'yellow';
                else color = '#00ff00';
            }

            this._updateUI(displayText, color, `Last update: ${reading.timestamp.toLocaleTimeString()}`);
            return true;
        } catch (error) {
            this._handleError(error);
            return true;
        }
    }

    _updateUI(labelText, color, statusText) {
        if (this._destroyed) return;
        
        try {
            if (this.label) {
                this.label.text = labelText;
                this.label.style = `margin-left: 5px; color: ${color};`;
            }
            
            if (this._statusItem) {
                this._statusItem.label.text = statusText;
            }
        } catch (error) {
            log(`[Dexcom] UI update error: ${error}`);
        }
    }

    _handleError(error) {
        const errorMessage = error.message || 'Unknown error';
        log(`[Dexcom] Error: ${errorMessage}`);
        this._updateUI('⚠️ Error', 'red', `Error: ${errorMessage}`);
    }

    destroy() {
        this._destroyed = true;
        this._removeTimeout();
        
        if (this._client) {
            this._client = null;
        }
        
        super.destroy();
    }
});

export default class DexcomExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new DexcomIndicator(this._settings, this);
        Main.panel.addToStatusArea('dexcom-indicator', this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}
// extension.js
'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { DexcomClient } from './jsdexcom.js';

const DexcomIndicator = GObject.registerClass(
    class DexcomIndicator extends PanelMenu.Button {
        _init(settings, extension) {
            super._init(0.0, 'Dexcom Glucose Monitor');

            this._settings = settings;
            this._extension = extension;
            this._lastUpdateTime = null;
            this._lastError = null;
            this._retryCount = 0;
            this._maxRetries = 3;

            this._buildInterface();
            this._buildMenu();
            this._setupDexcomClient();
            this._startMonitoring();

            // Debug mode
            this._debugMode = false;
            this._logBuffer = [];
        }

        _log(message, isError = false) {
            const timestamp = new Date().toISOString();
            const logMessage = `${timestamp}: ${message}`;
            
            // Keep last 50 messages
            this._logBuffer = [logMessage, ...this._logBuffer.slice(0, 49)];
            
            if (this._debugMode || isError) {
                if (isError) {
                    console.error(`[Dexcom Extension] ${logMessage}`);
                } else {
                    console.log(`[Dexcom Extension] ${logMessage}`);
                }
            }

            // Update debug menu if it exists
            this._updateDebugMenu();
        }

        _buildInterface() {
            // Container for icon and label
            this.boxLayout = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
            
            // Add icon
            this.icon = new St.Icon({
                gicon: Gio.Icon.new_for_string(`${this._extension.path}/icons/icon.svg`),
                style_class: 'system-status-icon'
            });
            
            // Add label
            this.label = new St.Label({
                text: 'Starting...',
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'dexcom-label'
            });

            this.boxLayout.add_child(this.icon);
            this.boxLayout.add_child(this.label);
            this.add_child(this.boxLayout);
        }

        _buildMenu() {
            // Status section
            this._statusSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._statusSection);

            // Last update time
            this._lastUpdateItem = new PopupMenu.PopupMenuItem('Last Update: Never');
            this._statusSection.addMenuItem(this._lastUpdateItem);

            // Server status
            this._serverStatusItem = new PopupMenu.PopupMenuItem('Server: Checking...');
            this._statusSection.addMenuItem(this._serverStatusItem);

            // Separator
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Debug toggle
            let debugToggle = new PopupMenu.PopupSwitchMenuItem('Debug Mode', this._debugMode);
            debugToggle.connect('toggled', (item) => {
                this._debugMode = item.state;
                this._log(`Debug mode ${this._debugMode ? 'enabled' : 'disabled'}`);
            });
            this.menu.addMenuItem(debugToggle);

            // Debug log section (initially hidden)
            this._debugSection = new PopupMenu.PopupMenuSection();
            this._debugLogItem = new PopupMenu.PopupMenuItem('Debug Log: Empty');
            this._debugSection.addMenuItem(this._debugLogItem);
            this.menu.addMenuItem(this._debugSection);

            // Manual refresh button
            let refreshButton = new PopupMenu.PopupMenuItem('Force Refresh');
            refreshButton.connect('activate', () => {
                this._log('Manual refresh requested');
                this._updateGlucose();
            });
            this.menu.addMenuItem(refreshButton);

            // Settings button
            let settingsButton = new PopupMenu.PopupMenuItem('Open Settings');
            settingsButton.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(settingsButton);
        }

        _updateDebugMenu() {
            if (!this._debugLogItem) return;

            if (this._debugMode && this._logBuffer.length > 0) {
                this._debugLogItem.label.set_text(this._logBuffer[0]); // Show latest log
                this._debugSection.actor.show();
            } else {
                this._debugSection.actor.hide();
            }
        }

        _setupDexcomClient() {
            const username = this._settings.get_string('username');
            const password = this._settings.get_string('password');
            const region = this._settings.get_string('region');
            const unit = this._settings.get_string('unit');

            if (!username || !password) {
                this._log('Missing credentials - please check settings', true);
                this.label.set_text('⚠️ Check Settings');
                return;
            }

            this._log(`Setting up client - Region: ${region}, Unit: ${unit}`);
            this._client = new DexcomClient(username, password, region, unit);
        }

        async _updateGlucose() {
            if (!this._client) {
                this._setupDexcomClient();
                if (!this._client) return false;
            }

            try {
                this._log('Fetching glucose data...');
                const data = await this._client.getLatestGlucose();
                
                // Reset retry count on success
                this._retryCount = 0;
                this._lastError = null;
                
                // Update display
                const arrow = this._client.getTrendArrow(data.trend);
                this.label.set_text(`${data.value} ${data.unit} ${arrow}`);
                
                // Update color based on glucose range
                let color;
                const value = parseFloat(data.value);
                const lowThreshold = this._settings.get_int('low-threshold');
                const highThreshold = this._settings.get_int('high-threshold');
                
                if (this._client._unit === 'mmol/L') {
                    if (value < lowThreshold/18.0) color = 'red';
                    else if (value > highThreshold/18.0) color = 'yellow';
                    else color = 'green';
                } else {
                    if (value < lowThreshold) color = 'red';
                    else if (value > highThreshold) color = 'yellow';
                    else color = 'green';
                }
                
                this.label.set_style(`color: ${color};`);
                
                // Update menu items
                this._lastUpdateTime = new Date();
                this._lastUpdateItem.label.set_text(
                    `Last Update: ${this._lastUpdateTime.toLocaleTimeString()}`
                );
                this._serverStatusItem.label.set_text('Server: Connected');
                
                this._log(`Updated glucose: ${data.value} ${data.unit} ${arrow}`);
                return true;
                
            } catch (error) {
                this._lastError = error;
                this._log(`Error updating glucose: ${error.message}`, true);
                
                if (this._retryCount < this._maxRetries) {
                    this._retryCount++;
                    this._log(`Retry attempt ${this._retryCount} of ${this._maxRetries}`);
                    this.label.set_text(`Retry ${this._retryCount}...`);
                    
                    // Wait 10 seconds before retry
                    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                        this._updateGlucose();
                        return GLib.SOURCE_REMOVE;
                    });
                } else {
                    this.label.set_text('⚠️ Error');
                    this.label.set_style('color: red;');
                    this._serverStatusItem.label.set_text(`Server: Error - ${error.message}`);
                }
                return false;
            }
        }

        _startMonitoring() {
            // Update immediately
            this._updateGlucose();

            // Update based on interval from settings
            const interval = this._settings.get_int('update-interval');
            this._log(`Setting update interval to ${interval} seconds`);
            
            this._timeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                interval,
                () => this._updateGlucose()
            );
        }

        destroy() {
            if (this._timeout) {
                GLib.source_remove(this._timeout);
                this._timeout = null;
            }
            super.destroy();
        }
    }
);

export default class DexcomExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new DexcomIndicator(this._settings, this);
        Main.panel.addToStatusArea('dexcom-indicator', this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
// extension.js
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
        this._timeouts = [];
        this._destroyed = false;
        
        // Create container
        this.box = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });

        // Use system icon
        this.icon = new St.Icon({
            icon_name: 'utilities-system-monitor-symbolic',
            style_class: 'system-status-icon',
            icon_size: 16
        });

        // Add label with spacing
        this.label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 5px;'
        });

        this.box.add_child(this.icon);
        this.box.add_child(this.label);
        this.add_child(this.box);

        this._buildMenu();

        // Start initialization after a short delay
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._initClient();
            return GLib.SOURCE_REMOVE;
        });
    }

    _buildMenu() {
        // Last reading info
        this._statusItem = new PopupMenu.PopupMenuItem('Initializing...');
        this.menu.addMenuItem(this._statusItem);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Reconnect button
        const reconnectItem = new PopupMenu.PopupMenuItem('Reconnect');
        reconnectItem.connect('activate', () => {
            this._reconnect();
        });
        this.menu.addMenuItem(reconnectItem);

        // Settings button
        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);

        // Add settings changed handler
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._onSettingsChanged();
        });
    }

    _onSettingsChanged() {
        this._reconnect();
    }

    async _initClient() {
        if (this._destroyed) return;

        const username = this._settings.get_string('username');
        const password = this._settings.get_string('password');
        const region = this._settings.get_string('region');
        const unit = this._settings.get_string('unit');

        if (!username || !password) {
            this._updateUI('⚠️ Check Settings', 'red', 'Missing credentials');
            return;
        }

        try {
            this._client = new DexcomClient(
                username,
                password,
                region === 'US' ? 'us' : 'ous',
                unit
            );

            this._updateUI('Connecting...', 'inherit', 'Authenticating...');
            
            const sessionId = await this._client.authenticate();
            if (!sessionId) throw new Error('Authentication failed');
            
            this._startPolling();
        } catch (error) {
            this._handleError(error);
            this._scheduleReconnect();
        }
    }

    _startPolling() {
        if (this._destroyed) return;

        // Clear existing timeouts
        this._clearTimeouts();

        // Initial update
        this._updateGlucose();

        // Schedule updates
        const interval = this._settings.get_int('update-interval');
        const timeoutId = GLib.timeout_add_seconds(
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
        this._timeouts.push(timeoutId);
    }

    async _updateGlucose() {
        if (this._destroyed) return false;

        try {
            const reading = await this._client.getLatestGlucose();
            
            if (!reading || !reading.value) {
                this._updateUI('No data', 'inherit', 'No readings available');
                return true;
            }

            // Update display
            const displayText = `${reading.value} ${reading.unit} ${reading.trendArrow}`;
            const timestamp = reading.timestamp.toLocaleTimeString();
            
            // Get thresholds
            const lowThreshold = this._settings.get_int('low-threshold');
            const highThreshold = this._settings.get_int('high-threshold');
            
            // Determine color
            let color;
            const value = parseFloat(reading.value);
            if (reading.unit === 'mmol/L') {
                if (value < lowThreshold/18.0) color = 'red';
                else if (value > highThreshold/18.0) color = 'yellow';
                else color = '#00ff00';
            } else {
                if (value < lowThreshold) color = 'red';
                else if (value > highThreshold) color = 'yellow';
                else color = '#00ff00';
            }

            this._updateUI(displayText, color, `Last update: ${timestamp}`);
            return true;

        } catch (error) {
            this._handleError(error);
            return true;
        }
    }

    _updateUI(labelText, color, statusText) {
        if (this._destroyed) return;
        
        try {
            // Update main label safely
            if (this.label && this.label.text !== undefined) {
                this.label.text = labelText;
                this.label.style = `margin-left: 5px; color: ${color};`;
            }
            
            // Update status safely
            if (this._statusItem && this._statusItem.label) {
                this._statusItem.label.text = statusText;
            }
        } catch (error) {
            log(`[Dexcom] UI update error: ${error}`);
        }
    }

    _handleError(error) {
        const errorMessage = error.message || 'Unknown error';
        log(`[Dexcom] Error: ${errorMessage}`);

        if (errorMessage.includes('SessionIdNotFound') || 
            errorMessage.includes('Invalid session') ||
            errorMessage.includes('password failed')) {
            this._updateUI('⚠️ Auth Error', 'red', 'Authentication failed');
            this._scheduleReconnect();
        } else {
            this._updateUI('⚠️ Error', 'red', `Error: ${errorMessage}`);
            this._scheduleReconnect();
        }
    }

    _scheduleReconnect() {
        if (this._destroyed) return;

        const timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            30,
            () => {
                if (!this._destroyed) {
                    this._reconnect();
                }
                return GLib.SOURCE_REMOVE;
            }
        );
        this._timeouts.push(timeoutId);
    }

    async _reconnect() {
        if (this._destroyed) return;
        
        this._clearTimeouts();
        this._client = null;
        this._updateUI('Reconnecting...', 'inherit', 'Reconnecting to Dexcom...');
        await this._initClient();
    }

    _clearTimeouts() {
        this._timeouts.forEach(id => {
            if (id) GLib.source_remove(id);
        });
        this._timeouts = [];
    }

    destroy() {
        this._destroyed = true;
        
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        this._clearTimeouts();
        this._client = null;
        
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
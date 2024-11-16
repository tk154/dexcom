// extension.js
'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { DexcomClient } from './jsdexcom.js';

const DexcomIndicator = GObject.registerClass(
    class DexcomIndicator extends PanelMenu.Button {
        _init(settings) {
            super._init(0.0, 'Dexcom Glucose Monitor');

            this._settings = settings;
            this._buildInterface();
            this._setupDexcomClient();
            this._startMonitoring();
        }

        _buildInterface() {
            // Container for icon and label
            this.boxLayout = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
            
            // Add icon
            this.icon = new St.Icon({
                gicon: Gio.Icon.new_for_string(`${Extension.path}/icons/icon.svg`),
                style_class: 'system-status-icon'
            });
            
            // Add label
            this.label = new St.Label({
                text: '---',
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'dexcom-label'
            });

            this.boxLayout.add_child(this.icon);
            this.boxLayout.add_child(this.label);
            this.add_child(this.boxLayout);
        }

        _setupDexcomClient() {
            const username = this._settings.get_string('username');
            const password = this._settings.get_string('password');
            const region = this._settings.get_string('region');
            const unit = this._settings.get_string('unit');

            this._client = new DexcomClient(username, password, region, unit);
        }

        async _updateGlucose() {
            try {
                const data = await this._client.getLatestGlucose();
                const arrow = this._client.getTrendArrow(data.trend);
                
                // Update label with glucose value and trend arrow
                this.label.set_text(`${data.value} ${data.unit} ${arrow}`);

                // Update color based on glucose range
                let color;
                const value = parseFloat(data.value);
                if (this._client._unit === 'mmol/L') {
                    if (value < 4.0) color = 'red';
                    else if (value > 10.0) color = 'yellow';
                    else color = 'green';
                } else {
                    if (value < 70) color = 'red';
                    else if (value > 180) color = 'yellow';
                    else color = 'green';
                }
                
                this.label.set_style(`color: ${color};`);
                
                return true;
            } catch (error) {
                console.error('Error updating glucose:', error);
                this.label.set_text('Error');
                this.label.set_style('color: red;');
                return true;
            }
        }

        _startMonitoring() {
            // Update immediately
            this._updateGlucose();

            // Update every 5 minutes
            this._timeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                300,
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
        this._indicator = new DexcomIndicator(this._settings);
        Main.panel.addToStatusArea('dexcom-indicator', this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
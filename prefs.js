// prefs.js
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DexcomPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create pages
        const page = new Adw.PreferencesPage();
        window.add(page);

        // Account settings
        const accountGroup = new Adw.PreferencesGroup({
            title: 'Dexcom Account Settings',
            description: 'Enter your Dexcom Share credentials'
        });
        page.add(accountGroup);

        // Username
        const usernameRow = new Adw.ActionRow({
            title: 'Username',
            subtitle: 'Your Dexcom Share username'
        });
        const usernameEntry = new Gtk.Entry({
            text: settings.get_string('username'),
            valign: Gtk.Align.CENTER,
            hexpand: true
        });
        usernameEntry.connect('changed', (entry) => {
            settings.set_string('username', entry.get_text());
        });
        usernameRow.add_suffix(usernameEntry);
        accountGroup.add(usernameRow);

        // Password
        const passwordRow = new Adw.ActionRow({
            title: 'Password',
            subtitle: 'Your Dexcom Share password'
        });
        const passwordEntry = new Gtk.Entry({
            text: settings.get_string('password'),
            valign: Gtk.Align.CENTER,
            visibility: false,
            input_purpose: Gtk.InputPurpose.PASSWORD,
            hexpand: true
        });
        passwordEntry.connect('changed', (entry) => {
            settings.set_string('password', entry.get_text());
        });
        passwordRow.add_suffix(passwordEntry);
        accountGroup.add(passwordRow);

        // Display settings
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display Settings',
            description: 'Customize how glucose values are displayed'
        });
        page.add(displayGroup);

        // Region selection
        const regionRow = new Adw.ActionRow({
            title: 'Region',
            subtitle: 'Select your Dexcom Share region'
        });
        const regionDropdown = new Gtk.DropDown({
            model: new Gtk.StringList({ strings: ['Non-US', 'US'] }), // Note the order change
            valign: Gtk.Align.CENTER,
            selected: settings.get_string('region') === 'Non-US' ? 0 : 1
        });
        regionDropdown.connect('notify::selected', (dropdown) => {
            settings.set_string('region', dropdown.selected === 0 ? 'Non-US' : 'US');
        });
        regionRow.add_suffix(regionDropdown);
        displayGroup.add(regionRow);

        // Unit selection
        const unitRow = new Adw.ActionRow({
            title: 'Unit',
            subtitle: 'Select your preferred glucose unit'
        });
        const unitDropdown = new Gtk.DropDown({
            model: new Gtk.StringList({ strings: ['mg/dL', 'mmol/L'] }),
            valign: Gtk.Align.CENTER,
            selected: settings.get_string('unit') === 'mg/dL' ? 0 : 1
        });
        unitDropdown.connect('notify::selected', (dropdown) => {
            settings.set_string('unit', dropdown.selected === 0 ? 'mg/dL' : 'mmol/L');
        });
        unitRow.add_suffix(unitDropdown);
        displayGroup.add(unitRow);

        // Thresholds group
        const thresholdsGroup = new Adw.PreferencesGroup({
            title: 'Glucose Thresholds',
            description: 'Set glucose level thresholds for color indicators'
        });
        page.add(thresholdsGroup);

        // Low threshold
        const lowThresholdRow = new Adw.ActionRow({
            title: 'Low Glucose Threshold',
            subtitle: 'Values below this will be shown in red (mg/dL)'
        });
        const lowThresholdSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 40,
                upper: 100,
                step_increment: 1,
                value: settings.get_int('low-threshold')
            }),
            valign: Gtk.Align.CENTER
        });
        lowThresholdSpinButton.connect('value-changed', (button) => {
            settings.set_int('low-threshold', button.get_value());
        });
        lowThresholdRow.add_suffix(lowThresholdSpinButton);
        thresholdsGroup.add(lowThresholdRow);

        // High threshold
        const highThresholdRow = new Adw.ActionRow({
            title: 'High Glucose Threshold',
            subtitle: 'Values above this will be shown in yellow (mg/dL)'
        });
        const highThresholdSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 120,
                upper: 300,
                step_increment: 1,
                value: settings.get_int('high-threshold')
            }),
            valign: Gtk.Align.CENTER
        });
        highThresholdSpinButton.connect('value-changed', (button) => {
            settings.set_int('high-threshold', button.get_value());
        });
        highThresholdRow.add_suffix(highThresholdSpinButton);
        thresholdsGroup.add(highThresholdRow);

        // Update interval
        const updateIntervalRow = new Adw.ActionRow({
            title: 'Update Interval',
            subtitle: 'How often to update the glucose value (in seconds)'
        });
        const updateIntervalSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 180,  // minimum 3 minutes
                upper: 900,  // maximum 15 minutes
                step_increment: 60,
                value: settings.get_int('update-interval')
            }),
            valign: Gtk.Align.CENTER
        });
        updateIntervalSpinButton.connect('value-changed', (button) => {
            settings.set_int('update-interval', button.get_value());
        });
        updateIntervalRow.add_suffix(updateIntervalSpinButton);
        displayGroup.add(updateIntervalRow);
    }
}
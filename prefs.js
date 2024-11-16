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
            title: 'Dexcom Account Settings'
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
            hexpand: true
        });
        passwordEntry.connect('changed', (entry) => {
            settings.set_string('password', entry.get_text());
        });
        passwordRow.add_suffix(passwordEntry);
        accountGroup.add(passwordRow);

        // Display settings
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display Settings'
        });
        page.add(displayGroup);

        // Region selection
        const regionRow = new Adw.ActionRow({
            title: 'Region',
            subtitle: 'Select your Dexcom Share region'
        });
        const regionDropdown = new Gtk.DropDown({
            model: new Gtk.StringList({ strings: ['US', 'Non-US'] }),
            valign: Gtk.Align.CENTER,
            selected: settings.get_string('region') === 'US' ? 0 : 1
        });
        regionDropdown.connect('notify::selected', (dropdown) => {
            settings.set_string('region', dropdown.selected === 0 ? 'US' : 'Non-US');
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
    }
}
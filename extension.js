//const Main = imports.ui.main;
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//const GLib = imports.gi.GLib;
import GLib from 'gi://GLib';
import * as DexcomAPI from './fetch.js';
//const St = imports.gi.St;
import St from 'gi://St';
//const Clutter = imports.gi.Clutter;
import Clutter from 'gi://Clutter';
const USERNAME = 'YourUserName';
const PASSWORD = 'YourPassword';
let panelButton, glucoseLabel, timeout, settings;

async function _updateGlucose() {
    let glucoseData = await DexcomAPI.getGlucoseData(USERNAME, PASSWORD);

    if (glucoseData) {
        let glucoseValue = glucoseData.Value;
   
        if (glucoseValue >= 210) {
            glucoseLabel.set_style("color: yellow;");
        } else if (glucoseValue < 90) {
            glucoseLabel.set_style("color: red;");
        } else {
            glucoseLabel.set_style("color: green;");
        }

        glucoseLabel.set_text(`${glucoseValue} mg/dL`);
    } else {
        glucoseLabel.set_text("No Data");
    }
}

function init() {
    const Gio = imports.gi.Gio;
    const ExtensionUtils = imports.misc.extensionUtils;
    settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.dexcom');
}

function enable() {
    
    panelButton = new St.Bin({
        style_class: 'panel-button',
        reactive: true,
        can_focus: true,
        x_fill: true,
        y_fill: false,
        track_hover: true
    });

    let panelBox = new St.BoxLayout({ style_class: 'panel-box' });
    glucoseLabel = new St.Label({
        text: 'Loading...',
        y_align: Clutter.ActorAlign.CENTER
    });
    
    panelBox.add_child(glucoseLabel);
    panelButton.set_child(panelBox);

    Main.panel._rightBox.insert_child_at_index(panelButton, 0);

    // İlk güncelleme ve her 3 dakikada bir güncelleme
    _updateGlucose();
    timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 180, () => {
        _updateGlucose();
        return true;
    });
}

function disable() {
    // Uzantı devre dışı bırakıldığında bileşeni kaldırıyoruz
    Main.panel._rightBox.remove_child(panelButton);

    if (timeout) {
        GLib.source_remove(timeout);
        timeout = null;
    }
}
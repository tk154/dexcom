const Main = imports.ui.main;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Me = imports.misc.extensionUtils.getCurrentExtension();  // Me is the extension's current context


imports.searchPath.push(Me.path);


const Fetch = imports.fetch;

let panelButton, glucoseLabel, timeout;
let settings;
const USERNAME = 'YourUserName';
const PASSWORD = 'YourPassword';

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

    _updateGlucose();
    timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 180, () => {
        _updateGlucose();
        return true;
    });
}

function disable() {
    Main.panel._rightBox.remove_child(panelButton);

    if (timeout) {
        GLib.source_remove(timeout);
        timeout = null;
    }
}

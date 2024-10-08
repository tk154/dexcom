const { Gtk, Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

function init() {}

function buildPrefsWidget() {
    let settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.dexcom');

    let widget = new Gtk.Grid({
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
        column_spacing: 12,
        row_spacing: 12,
    });

    let usernameLabel = new Gtk.Label({ label: "Dexcom Username", hexpand: true, halign: Gtk.Align.START });
    let usernameEntry = new Gtk.Entry({ text: settings.get_string('username') });
    widget.attach(usernameLabel, 0, 0, 1, 1);
    widget.attach(usernameEntry, 1, 0, 1, 1);

    usernameEntry.connect('changed', () => {
        settings.set_string('username', usernameEntry.get_text());
    });

    let passwordLabel = new Gtk.Label({ label: "Dexcom Password", hexpand: true, halign: Gtk.Align.START });
    let passwordEntry = new Gtk.Entry({ text: settings.get_string('password'), visibility: false });
    widget.attach(passwordLabel, 0, 1, 1, 1);
    widget.attach(passwordEntry, 1, 1, 1, 1);

    passwordEntry.connect('changed', () => {
        settings.set_string('password', passwordEntry.get_text());
    });

    return widget;
}
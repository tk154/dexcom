import Gio from 'gi://Gio';
//const Gio = imports.gi.Gio;
//const Gtk = imports.gi.Gtk;
import Gtk from 'gi://Gtk';

function init() {}

function buildPrefsWidget() {
    let widget = new Gtk.Grid({ column_spacing: 12, row_spacing: 12, margin: 18 });

    let settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.dexcom' });

    // Username input
    let usernameLabel = new Gtk.Label({ label: "Dexcom Username", halign: Gtk.Align.START });
    let usernameEntry = new Gtk.Entry({ text: settings.get_string('username') });
    usernameEntry.connect('changed', (entry) => {
        settings.set_string('username', entry.get_text());
    });

    // Password input
    let passwordLabel = new Gtk.Label({ label: "Dexcom Password", halign: Gtk.Align.START });
    let passwordEntry = new Gtk.Entry({ text: settings.get_string('password') });
    passwordEntry.set_visibility(false);  // Hide the password
    passwordEntry.connect('changed', (entry) => {
        settings.set_string('password', entry.get_text());
    });

    widget.attach(usernameLabel, 0, 0, 1, 1);
    widget.attach(usernameEntry, 1, 0, 1, 1);
    widget.attach(passwordLabel, 0, 1, 1, 1);
    widget.attach(passwordEntry, 1, 1, 1, 1);

    return widget;
}

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

function init() {}

function buildPrefsWidget() {
    let settings = new Gio.Settings({ schema: 'org.gnome.shell.extensions.dexcom' });
    
    let widget = new Gtk.Grid({ column_spacing: 12, row_spacing: 12, margin: 18 });

    // Add widgets for setting username, password, etc.
    // Example:
    let usernameLabel = new Gtk.Label({ label: "Dexcom Username", halign: Gtk.Align.START });
    let usernameEntry = new Gtk.Entry({ text: settings.get_string('username') });
    usernameEntry.connect('changed', (entry) => {
        settings.set_string('username', entry.get_text());
    });

    widget.attach(usernameLabel, 0, 0, 1, 1);
    widget.attach(usernameEntry, 1, 0, 1, 1);

    return widget;
}

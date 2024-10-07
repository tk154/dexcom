import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';  // Log dosyasına yazmak için gerekli

export default class DexcomExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Dexcom Monitor', false);
        this._label = new St.Label({ text: 'Dexcom Monitor', y_align: Clutter.ActorAlign.CENTER });
        this._indicator.add_child(this._label);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._updateGlucose();

        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 180, () => {
            this._updateGlucose();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    async _updateGlucose() {
        log("Updating glucose data...");
        let glucoseData = await this._fetchGlucoseData('YourDexcomUsername', 'YourDexcomPassword');

        if (glucoseData) {
            let glucoseValue = glucoseData.Value;
            log(`Glucose value: ${glucoseValue}`);
            if (glucoseValue >= 210) {
                this._label.set_style("color: yellow;");
            } else if (glucoseValue < 90) {
                this._label.set_style("color: red;");
            } else {
                this._label.set_style("color: green;");
            }
            this._label.set_text(`${glucoseValue} mg/dL`);
        } else {
            log("No glucose data available.");
            this._label.set_text("No Data");
        }
    }

    async _fetchGlucoseData(username, password) {
        const dexcomLoginUrl = 'https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccount';
        const dexcomGlucoseUrl = 'https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=SESSION_ID&minutes=1440&maxCount=1';

        try {
            log(`Attempting to fetch glucose data for ${username}`);
            
            let loginResponse = await fetch(dexcomLoginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountName: username,
                    password: password,
                    applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'  // Dexcom Share Application ID
                })
            });

            if (!loginResponse.ok) {
                logError(`Login failed with status ${loginResponse.status}`);
                return null;
            }
            
            let sessionId = await loginResponse.text();
            log(`Session ID retrieved: ${sessionId}`);

            let glucoseResponse = await fetch(dexcomGlucoseUrl.replace('SESSION_ID', sessionId), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!glucoseResponse.ok) {
                logError(`Glucose data fetch failed with status ${glucoseResponse.status}`);
                return null;
            }

            let glucoseData = await glucoseResponse.json();
            log(`Glucose data received: ${JSON.stringify(glucoseData)}`);

            this._logToFile(JSON.stringify(glucoseData, null, 2));  // Veriyi log dosyasına yaz

            return glucoseData[0];  // Return the latest glucose value
        } catch (error) {
            logError(`Error fetching glucose data: ${error}`);
            return null;
        }
    }

    // Log verilerini dosyaya yazma fonksiyonu
    _logToFile(data) {
        let file = Gio.File.new_for_path("/tmp/dexcom_data.log");
        file.replace_contents(data + '\n', null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }
}

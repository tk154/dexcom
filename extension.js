import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';  // GNOME Shell için HTTP istekleri

export default class DexcomExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Dexcom Monitor', false);
        this._label = new St.Label({ text: 'Dexcom Monitor', y_align: Clutter.ActorAlign.CENTER });
        this._indicator.add_child(this._label);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._updateGlucose();

        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 180, () => {
            this._updateGlucose().catch(e => logError(`Error in updateGlucose: ${e}`));
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
        try {
            log("Updating glucose data...");
            let glucoseData = await this._fetchGlucoseData('your_dexcom_username', 'your_dexcom_password', true);  

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
        } catch (error) {
            logError(`Error fetching or processing glucose data: ${error}`);
        }
    }

    _fetchGlucoseData(username, password, ous = false) {
        return new Promise((resolve, reject) => {
            const dexcomLoginUrl = ous
                ? 'https://shareous1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccount'
                : 'https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccount';
                
            const dexcomGlucoseUrl = ous
                ? 'https://shareous1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=SESSION_ID&minutes=1440&maxCount=1'
                : 'https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=SESSION_ID&minutes=1440&maxCount=1';

            const session = new Soup.Session();
            let loginMessage = Soup.Message.new('POST', dexcomLoginUrl);
            
            let requestBody = JSON.stringify({
                "accountName": username,
                "password": password,
                "applicationId": "d89443d2-327c-4a6f-89e5-496bbb0317db"
            });

            loginMessage.set_request_body_from_bytes('application/json', new GLib.Bytes(requestBody));

            // send_and_read_async kullanımıyla giriş isteği
            session.send_and_read_async(loginMessage, null, (session, result) => {
                try {
                    let responseBytes = session.send_and_read_finish(result);
                    let responseText = responseBytes.get_data();
                    let response = JSON.parse(responseText);
                    
                    if (!response || response.status_code !== 200) {
                        logError(`Login failed with status ${response?.status_code}`);
                        reject(new Error(`Login failed with status ${response?.status_code || "undefined"}`));
                        return;
                    }

                    let sessionId = response.trim();
                    log(`Session ID retrieved: ${sessionId}`);

                    let glucoseMessage = Soup.Message.new('GET', dexcomGlucoseUrl.replace('SESSION_ID', sessionId));

                    session.send_and_read_async(glucoseMessage, null, (session, result) => {
                        try {
                            let glucoseResponseBytes = session.send_and_read_finish(result);
                            let glucoseResponseText = glucoseResponseBytes.get_data();
                            let glucoseData = JSON.parse(glucoseResponseText);

                            log(`Glucose data received: ${glucoseResponseText}`);
                            resolve(glucoseData[0]);
                        } catch (e) {
                            reject(e);
                        }
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    // Log verilerini dosyaya yazma fonksiyonu
    _logToFile(data) {
        let file = Gio.File.new_for_path("/tmp/dexcom_data.log");
        file.replace_contents(data + '\n', null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }
}

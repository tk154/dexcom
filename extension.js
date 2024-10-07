import St from 'gi://St';
import { PanelMenu, Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

//const USERNAME = 'YourUserName';
//const PASSWORD = 'YourPassword';

export default class DexcomExtension extends Extension {
    enable() {
        // Durum göstergesini PanelMenu.Button ile oluşturuyoruz
        this._indicator = new PanelMenu.Button(0.0, 'Dexcom Monitor', false);

        // Label ekliyoruz
        let label = new St.Label({ text: 'Dexcom Monitor', y_align: Clutter.ActorAlign.CENTER });
        this._indicator.add_child(label);

        // Durum göstergesini panelin sağ tarafına ekliyoruz
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // İlk veri güncellemesini başlatıyoruz
        this._updateGlucose();
        // Her 3 dakikada bir veriyi yeniliyoruz
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
        let glucoseData = await this._fetchGlucoseData('YourDexcomUsername', 'YourDexcomPassword');
        
        if (glucoseData) {
            let glucoseValue = glucoseData.Value;

            // Glucose değeri için renk belirleme
            if (glucoseValue >= 210) {
                this._indicator.get_child_at_index(0).set_style("color: yellow;");
            } else if (glucoseValue < 90) {
                this._indicator.get_child_at_index(0).set_style("color: red;");
            } else {
                this._indicator.get_child_at_index(0).set_style("color: green;");
            }

            this._indicator.get_child_at_index(0).set_text(`${glucoseValue} mg/dL`);
        } else {
            this._indicator.get_child_at_index(0).set_text("No Data");
        }
    }

    async _fetchGlucoseData(username, password) {
        const dexcomLoginUrl = 'https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccount';
        const dexcomGlucoseUrl = 'https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=SESSION_ID&minutes=1440&maxCount=1';

        try {
            let loginResponse = await fetch(dexcomLoginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountName: username,
                    password: password,
                    applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'  // Dexcom Share Application ID
                })
            });

            let sessionId = await loginResponse.text();  // Giriş başarılıysa session ID alınıyor

            let glucoseResponse = await fetch(dexcomGlucoseUrl.replace('SESSION_ID', sessionId), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            let glucoseData = await glucoseResponse.json();  // JSON formatında verileri alıyoruz
            return glucoseData[0];  // En son glukoz verisini döndürüyoruz
        } catch (error) {
            logError(error);
            return null;
        }
    }
}

// jsdexcom.js
'use strict';

export class DexcomClient {
    constructor(username, password, region = 'US', unit = 'mg/dL') {
        this._username = username;
        this._password = password;
        this._region = region;
        this._unit = unit;
        this._sessionId = null;
        this._baseUrl = this._getBaseUrl();
    }

    _getBaseUrl() {
        return this._region === 'US' 
            ? 'https://share2.dexcom.com/ShareWebServices/Services'
            : 'https://shareous1.dexcom.com/ShareWebServices/Services';
    }

    _convertUnit(value) {
        if (this._unit === 'mmol/L') {
            return (value / 18.0).toFixed(1);
        }
        return value;
    }

    async authenticate() {
        const loginUrl = `${this._baseUrl}/General/LoginPublisherAccountByName`;
        const payload = {
            accountName: this._username,
            password: this._password,
            applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'
        };

        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Dexcom Share/3.0.2.11'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status}`);
            }

            this._sessionId = await response.text();
            return this._sessionId;
        } catch (error) {
            console.error('Dexcom authentication error:', error);
            throw error;
        }
    }

    async getLatestGlucose() {
        if (!this._sessionId) {
            await this.authenticate();
        }

        const glucoseUrl = `${this._baseUrl}/Publisher/ReadPublisherLatestGlucoseValues`;
        const url = `${glucoseUrl}?sessionId=${this._sessionId}&minutes=1440&maxCount=1`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Dexcom Share/3.0.2.11'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Session expired, try to re-authenticate
                    await this.authenticate();
                    return await this.getLatestGlucose();
                }
                throw new Error(`Failed to fetch glucose data: ${response.status}`);
            }

            const data = await response.json();
            if (!data || data.length === 0) {
                throw new Error('No glucose data available');
            }

            const reading = data[0];
            return {
                value: this._convertUnit(reading.Value),
                trend: reading.Trend,
                unit: this._unit,
                timestamp: new Date(reading.WT),
                raw: reading
            };
        } catch (error) {
            console.error('Error fetching glucose data:', error);
            throw error;
        }
    }

    getTrendArrow(trend) {
        const arrows = {
            0: '→',   // None
            1: '↑↑',  // DoubleUp
            2: '↑',   // SingleUp
            3: '↗',   // FortyFiveUp
            4: '→',   // Flat
            5: '↘',   // FortyFiveDown
            6: '↓',   // SingleDown
            7: '↓↓',  // DoubleDown
            8: '?',   // NotComputable
            9: '⚠️'    // RateOutOfRange
        };
        return arrows[trend] || '?';
    }
}
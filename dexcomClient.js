'use strict';

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Gio from 'gi://Gio';

export class DexcomClient {
    constructor(username, password, region = 'ous', unit = 'mg/dL') {
        this._username = username;
        this._password = password;
        
       
        region = region.toLowerCase().trim();
        
       
        const regionMap = {
            'us': 'us',
            'usa': 'us',
            'united states': 'us',
            'non-us': 'ous',
            'non_us': 'ous',
            'ous': 'ous',
            'outside us': 'ous'
        };
        
        this._region = regionMap[region] || 'ous';
        
       
        this._baseUrls = {
            'us': 'https://share2.dexcom.com',
            'ous': 'https://shareous1.dexcom.com'
        };
        
        this._baseUrl = this._baseUrls[this._region];
        this._unit = unit;
        this._applicationId = 'd89443d2-327c-4a6f-89e5-496bbb0317db';
        this._agent = 'Dexcom Share/3.0.2.11';
        this._sessionId = null;
        this._accountId = null;
        
       
        this._session = new Soup.Session();
        this._session.timeout = 30;
        
       
        console.log('DexcomClient initialized:', {
            region: this._region,
            baseUrl: this._baseUrl,
            unit: this._unit
        });
    }

   
    _encodeURIComponent(str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, c => 
            '%' + c.charCodeAt(0).toString(16).toUpperCase()
        );
    }

   
    _buildQueryString(params) {
        return Object.keys(params)
            .map(key => `${this._encodeURIComponent(key)}=${this._encodeURIComponent(params[key])}`)
            .join('&');
    }

   
    async _makeRequest(url, method = 'GET', data = null, params = null) {
        try {
            if (params) {
                const queryString = Object.entries(params)
                    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                    .join('&');
                url = `${url}?${queryString}`;
            }

            const message = new Soup.Message({
                method,
                uri: GLib.Uri.parse(url, GLib.UriFlags.NONE)
            });

           
            const headers = message.get_request_headers();
            headers.append('Content-Type', 'application/json; charset=utf-8');
            headers.append('Accept', 'application/json');
            headers.append('User-Agent', this._agent);

           
            if (data && method !== 'GET') {
                const jsonStr = JSON.stringify(data);
                const bytes = new TextEncoder().encode(jsonStr);
                message.set_request_body_from_bytes('application/json', new GLib.Bytes(bytes));
                console.log(`Request body: ${jsonStr}`);
            } else {
                console.log('GET request - no body required');
            }

            const response = await this._session.send_and_read_async(message, 
                GLib.PRIORITY_DEFAULT, null);
            
            const status = message.get_status();
            const responseText = new TextDecoder().decode(response.get_data());
            
            if (status === 200) {
                try {
                    return JSON.parse(responseText);
                } catch {
                    return responseText.replace(/^"|"$/g, '');
                }
            }

           
            throw new Error(`Request failed with status ${status}: ${responseText}`);

        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

   
    _logDebugInfo(stage, data) {
        const timestamp = new Date().toISOString();
        console.log(`[DEBUG ${timestamp}] ${stage}:`, JSON.stringify(data, null, 2));
    }
    

async authenticate() {
    try {
       
        if (!this._username || !this._password) {
            throw new Error('Username and password are required');
        }

        console.log('Starting authentication for region:', this._region);
        console.log('Using base URL:', this._baseUrl);

       
        const authUrl = `${this._baseUrl}/ShareWebServices/Services/General/AuthenticatePublisherAccount`;
        const authPayload = {
            accountName: this._username,
            password: this._password,
            applicationId: this._applicationId
        };

        console.log('Attempting initial authentication...');
        this._accountId = await this._makeRequest(authUrl, 'POST', authPayload);

       
        if (!this._accountId || typeof this._accountId !== 'string') {
            throw new Error('Invalid account ID received');
        }

        console.log('Account ID received:', this._accountId);

       
        const loginUrl = `${this._baseUrl}/ShareWebServices/Services/General/LoginPublisherAccountById`;
        const loginPayload = {
            accountId: this._accountId,
            password: this._password,
            applicationId: this._applicationId
        };

        this._sessionId = await this._makeRequest(loginUrl, 'POST', loginPayload);

       
        if (!this._sessionId || this._sessionId === '00000000-0000-0000-0000-000000000000') {
            throw new Error('Invalid session ID received');
        }

        console.log('Authentication successful, session ID received');
        return this._sessionId;

    } catch (error) {
        console.error('Authentication error:', error.message);
        if (error.message.includes('500')) {
            console.error('Server error details:', error);
        }
       
        this._sessionId = null;
        this._accountId = null;
        throw error;
    }
}


    async getLatestGlucose() {
        try {
            if (!this._sessionId) {
                console.log('[DEBUG] No session ID, authenticating...');
                await this.authenticate();
            }
    
            const url = `${this._baseUrl}/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues`;
            const params = {
                sessionId: this._sessionId,
                minutes: 1440,
                maxCount: 1
            };
    
            console.log('[DEBUG] Fetching glucose readings from:', url);
            console.log('[DEBUG] Using params:', JSON.stringify(params));
            
            const readings = await this._makeRequest(url, 'GET', null, params);
            console.log('[DEBUG] Raw API response:', JSON.stringify(readings));
            
            if (!Array.isArray(readings) || readings.length === 0) {
                console.log('[DEBUG] No readings available in response');
                throw new Error('No readings available');
            }
    
            console.log('[DEBUG] Processing reading:', JSON.stringify(readings[0]));
            const reading = this._formatReading(readings[0]);
            return reading;
    
        } catch (error) {
            console.log('[DEBUG] Error in getLatestGlucose:', error.message);
            
            if (error.message.includes('SessionIdNotFound')) {
                console.log('[DEBUG] Session expired, re-authenticating...');
                this._sessionId = null;
                return this.getLatestGlucose();
            }
            throw error;
        }
    }
    
    _formatReading(reading) {
       
        const currentTimestamp = parseInt(reading.WT.match(/\d+/)[0]);
        
       
        let value = reading.Value;
        if (this._unit === 'mmol/L') {
            value = (reading.Value / 18.0).toFixed(1);
        }
    
       
        let delta = 0;
        const trend = this._normalizeTrend(reading.Trend);
    
       
        if (this._previousReading) {
            const prevTimestamp = parseInt(this._previousReading.WT.match(/\d+/)[0]);
            const timeDiff = currentTimestamp - prevTimestamp;
    
           
            if (timeDiff <= 900000) {
                const prevValue = this._previousReading.Value;
                delta = reading.Value - prevValue;
    
               
                if (this._unit === 'mmol/L') {
                    delta = (delta / 18.0);
                }
            }
        }
    
       
        if (delta === 0 && this._previousDelta) {
           
            if (Math.abs(this._previousDelta) <= 2.0) {
                delta = this._previousDelta;
                console.log('[DEBUG] Preserving previous delta:', delta);
            }
        }
    
       
        if (delta === 0) {
            const trendDeltas = {
                'DOUBLE_UP': this._unit === 'mmol/L' ? 0.17 : 3.0,
                'SINGLE_UP': this._unit === 'mmol/L' ? 0.11 : 2.0,
                'FORTY_FIVE_UP': this._unit === 'mmol/L' ? 0.06 : 1.0,
                'FLAT': 0.0,
                'FORTY_FIVE_DOWN': this._unit === 'mmol/L' ? -0.06 : -1.0,
                'SINGLE_DOWN': this._unit === 'mmol/L' ? -0.11 : -2.0,
                'DOUBLE_DOWN': this._unit === 'mmol/L' ? -0.17 : -3.0
            };
    
            delta = trendDeltas[trend] || 0;
        }
    
       
        const finalTrend = this._normalizeTrend(reading.Trend, delta);
    
       
        this._previousReading = {...reading};
       
        this._previousDelta = delta;
    
       
        const formattedReading = {
            value: value,
            unit: this._unit,
            trend: finalTrend,
            timestamp: new Date(currentTimestamp),
            delta: Number(delta).toFixed(1)
        };
    
        console.log('[DEBUG] Formatted reading:', formattedReading);
        return formattedReading;
    }
   
    _normalizeTrend(trend, delta = null) {
        console.log('[DEBUG] _normalizeTrend input:', trend, 'delta:', delta);
        
       
        const normalizedInput = String(trend || '')
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/-/g, '');
    
        console.log('[DEBUG] Normalized trend input:', normalizedInput);
    
       
        const trendMap = {
            'NONE': 'FLAT', 
            'DOUBLEUP': 'DOUBLE_UP',
            'SINGLEUP': 'SINGLE_UP',
            'FORTYFIVEUP': 'FORTY_FIVE_UP',
            'FLAT': 'FLAT',
            'FORTYFIVEDOWN': 'FORTY_FIVE_DOWN',
            'SINGLEDOWN': 'SINGLE_DOWN',
            'DOUBLEDOWN': 'DOUBLE_DOWN',
            'NOTCOMPUTABLE': 'NOT_COMPUTABLE',
            'RATEOUTOFRANGE': 'RATE_OUT_OF_RANGE'
        };
    
       
        let mappedTrend = trendMap[normalizedInput] || 'FLAT';
        console.log('[DEBUG] Initial mapped trend:', mappedTrend);
    
       
        if (delta !== null) {
            const originalTrend = mappedTrend;
            
            if (delta < -3.0 && (mappedTrend === 'FLAT' || mappedTrend === 'FORTY_FIVE_UP' || mappedTrend === 'SINGLE_UP')) {
                mappedTrend = 'SINGLE_DOWN';
                console.log('[DEBUG] Trend corrected: Large negative delta -> SINGLE_DOWN');
            } else if (delta < -1.0 && mappedTrend === 'FLAT') {
                mappedTrend = 'FORTY_FIVE_DOWN';
                console.log('[DEBUG] Trend corrected: Small negative delta -> FORTY_FIVE_DOWN');
            } else if (delta > 1.0 && delta < 3.0 && mappedTrend === 'FLAT') {
                mappedTrend = 'FORTY_FIVE_UP';
                console.log('[DEBUG] Trend corrected: Small positive delta -> FORTY_FIVE_UP');
            } else if (delta > 3.0 && (mappedTrend === 'FLAT' || mappedTrend === 'FORTY_FIVE_DOWN' || mappedTrend === 'SINGLE_DOWN')) {
                mappedTrend = 'SINGLE_UP';
                console.log('[DEBUG] Trend corrected: Large positive delta -> SINGLE_UP');
            }
            
            if (originalTrend !== mappedTrend) {
                console.log('[DEBUG] Trend correction applied:', originalTrend, '->', mappedTrend);
            } else {
                console.log('[DEBUG] No trend correction needed');
            }
        }
    
        console.log('[DEBUG] Final normalized trend:', mappedTrend);
        return mappedTrend;
    }
}
'use strict';

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Gio from 'gi://Gio';

export class DexcomClient {
    constructor(username, password, region = 'ous', unit = 'mg/dL') {
        this._username = username;
        this._password = password;
        this._region = region.toLowerCase();
        
        // Update base URLs and handling
        this._baseUrls = {
            'us': 'https://share2.dexcom.com',
            'non-us': 'https://shareous1.dexcom.com',
            'non_us': 'https://shareous1.dexcom.com',
            'ous': 'https://shareous1.dexcom.com'
        };
        
        // Set base URL based on region
        this._baseUrl = this._baseUrls[this._region] || this._baseUrls['ous'];
        
        this._applicationId = 'd89443d2-327c-4a6f-89e5-496bbb0317db';
        this._agent = 'Dexcom Share/3.0.2.11';
        this._sessionId = null;
        this._accountId = null;
        this._unit = unit;
        
        // Configure session
        this._session = new Soup.Session();
        this._session.timeout = 30;
        
        // Debug info
        console.log('DexcomClient initialized:', {
            region: this._region,
            baseUrl: this._baseUrl,
            unit: this._unit
        });
    }

    // Helper function to encode URI components safely
    _encodeURIComponent(str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, c => 
            '%' + c.charCodeAt(0).toString(16).toUpperCase()
        );
    }

    // Helper function to build query string
    _buildQueryString(params) {
        return Object.keys(params)
            .map(key => `${this._encodeURIComponent(key)}=${this._encodeURIComponent(params[key])}`)
            .join('&');
    }

    // Update _makeRequest method
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

            // Set headers
            const headers = message.get_request_headers();
            headers.append('Content-Type', 'application/json; charset=utf-8');
            headers.append('Accept', 'application/json');
            headers.append('User-Agent', this._agent);

            // Add request body if provided and method is not GET
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

            // Handle error responses
            throw new Error(`Request failed with status ${status}: ${responseText}`);

        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }


    
    async authenticate() {
        try {
            // Validate credentials
            if (!this._username || !this._password) {
                throw new Error('Username and password are required');
            }

            // Step 1: Authentication
            const authUrl = `${this._baseUrl}/ShareWebServices/Services/General/AuthenticatePublisherAccount`;
            const authPayload = {
                accountName: this._username,
                password: this._password,
                applicationId: this._applicationId
            };

            console.log('Attempting authentication...');
            this._accountId = await this._makeRequest(authUrl, 'POST', authPayload);

            // Validate accountId
            if (!this._accountId || typeof this._accountId !== 'string') {
                throw new Error('Invalid account ID received');
            }

            // Step 2: Login
            const loginUrl = `${this._baseUrl}/ShareWebServices/Services/General/LoginPublisherAccountById`;
            const loginPayload = {
                accountId: this._accountId,
                password: this._password,
                applicationId: this._applicationId
            };

            this._sessionId = await this._makeRequest(loginUrl, 'POST', loginPayload);

            // Validate sessionId
            if (!this._sessionId || this._sessionId === '00000000-0000-0000-0000-000000000000') {
                throw new Error('Invalid session ID received');
            }

            console.log('Authentication successful');
            return this._sessionId;

        } catch (error) {
            console.error('Authentication error:', error);
            this._sessionId = null;
            this._accountId = null;
            throw error;
        }
    }


    async getLatestGlucose() {
        try {
            if (!this._sessionId) {
                await this.authenticate();
            }
    
            const url = `${this._baseUrl}/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues`;
            const params = {
                sessionId: this._sessionId,
                minutes: 1440,
                maxCount: 1
            };
    
            console.log('Fetching latest glucose reading...');
            const readings = await this._makeRequest(url, 'GET', null, params); // Changed to GET method
            
            if (!Array.isArray(readings) || readings.length === 0) {
                console.log('No readings available');
                throw new Error('No readings available');
            }
    
            const reading = this._formatReading(readings[0]);
            console.log('Latest reading:', reading);
            return reading;
    
        } catch (error) {
            if (error.message.includes('SessionIdNotFound')) {
                console.log('Session expired, re-authenticating...');
                this._sessionId = null;
                return this.getLatestGlucose();
            }
            throw error;
        }
    }

    _formatReading(reading) {
        // Parse timestamps properly
        const currentTimestamp = parseInt(reading.WT.match(/\d+/)[0]);
        
        // Calculate base value
        let value = reading.Value;
        if (this._unit === 'mmol/L') {
            value = (reading.Value / 18.0).toFixed(1);
        }
    
        // Initialize delta
        let delta = 0;
        const trend = this._normalizeTrend(reading.Trend);
    
        // Calculate delta if previous reading exists
        if (this._previousReading) {
            const prevTimestamp = parseInt(this._previousReading.WT.match(/\d+/)[0]);
            const timeDiff = currentTimestamp - prevTimestamp;
    
            // Only calculate delta if readings are within 15 minutes
            if (timeDiff <= 900000) { // 15 minutes in milliseconds
                const prevValue = this._previousReading.Value;
                delta = reading.Value - prevValue;
    
                // Convert to mmol/L if needed
                if (this._unit === 'mmol/L') {
                    delta = (delta / 18.0);
                }
            }
        }
    
        // If no delta calculated from readings, estimate from trend
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
    
        // Store current reading for next delta calculation
        this._previousReading = {...reading};
    
        // Create formatted reading object
        const formattedReading = {
            value: value,
            unit: this._unit,
            trend: trend,
            timestamp: new Date(currentTimestamp),
            delta: Number(delta).toFixed(1)
        };
    
        console.log('Formatted reading:', formattedReading);
        return formattedReading;
    }

    // Helper function to normalize trend values
    _normalizeTrend(trend) {
    // Normalize input trend value
    const normalizedInput = String(trend || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/-/g, '');

    // Define trend mappings
    const trendMap = {
        'NONE': 'FLAT',  // Map NONE to FLAT for better UX
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

    // Return mapped trend or default to FLAT if unknown
    return trendMap[normalizedInput] || 'FLAT';
    }
}
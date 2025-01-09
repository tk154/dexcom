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
        // Helper function to normalize trend values
        const normalizeTrend = (trend) => {
            const trendMap = {
                'NONE': 'NONE',
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
            
            const normalizedTrend = String(trend).toUpperCase()
                .replace(/\s+/g, '')
                .replace(/-/g, '');
                
            return trendMap[normalizedTrend] || trend;
        };

        // Calculate value based on unit
        let value = reading.Value;
        if (this._unit === 'mmol/L') {
            value = (reading.Value / 18.0).toFixed(1);
        }

        // Calculate delta
        let delta = 0;
        if (this._previousReading) {
            const prevValue = this._unit === 'mmol/L' ? 
                (this._previousReading.Value / 18.0) : 
                this._previousReading.Value;
            delta = value - prevValue;
        }

        // Store current reading for next delta calculation
        this._previousReading = {...reading};

        return {
            value: value,
            unit: this._unit,
            trend: normalizeTrend(reading.Trend),
            timestamp: new Date(parseInt(reading.WT.match(/\d+/)[0])),
            delta: delta.toFixed(1)
        };
    }
}
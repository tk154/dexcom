var DexcomAPI = {
    async getGlucoseData(username, password) {
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

            let sessionId = await loginResponse.text();  // Get session ID

            let glucoseResponse = await fetch(dexcomGlucoseUrl.replace('SESSION_ID', sessionId), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            let glucoseData = await glucoseResponse.json();  // Get glucose data
            return glucoseData[0];  // Return the latest glucose value
        } catch (error) {
            logError(error);  // Log any error
            return null;
        }
    }
};

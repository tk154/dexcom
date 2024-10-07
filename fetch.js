var DexcomAPI = {
    async getGlucoseData(username, password) {
        const dexcomLoginUrl = 'https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccount';
        const dexcomGlucoseUrl = 'https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=SESSION_ID&minutes=1440&maxCount=1';

        try {
            // Dexcom Share API'ye giriş yapıyoruz
            let loginResponse = await fetch(dexcomLoginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountName: username,
                    password: password,
                    applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db'  // Dexcom Share Application ID
                })
            });

            let sessionId = await loginResponse.text();  // Giriş başarılı ise session ID alınır

            // Session ID ile glukoz verilerini alıyoruz
            let glucoseResponse = await fetch(dexcomGlucoseUrl.replace('SESSION_ID', sessionId), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            let glucoseData = await glucoseResponse.json();  // Glukoz verileri JSON formatında döner
            return glucoseData[0];  // En son glukoz değerini döndürür
        } catch (error) {
            logError(error);  // Hata varsa konsola yazılır
            return null;
        }
    }
};
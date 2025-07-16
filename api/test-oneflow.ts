// api/test-oneflow.ts - SÄKER, MINIMAL VERSION FÖR FELSÖKNING
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Huvudfunktionen som Vercel kör
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Sätt CORS-headers för att tillåta anrop från webbläsare
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Hantera OPTIONS-request (nödvändigt för CORS)
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        console.log('🧪 Startar test av Oneflow API-anslutning...');

        // Hämta miljövariabler INUTI funktionen
        const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN;
        const ONEFLOW_API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1';

        // Validera att API-token finns
        if (!ONEFLOW_API_TOKEN) {
            console.error('❌ FEL: Miljövariabeln ONEFLOW_API_TOKEN är inte satt.');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error: ONEFLOW_API_TOKEN is missing.'
            });
        }
        
        console.log(`...anropar Oneflow API på ${ONEFLOW_API_URL}...`);
        
        // Gör API-anropet till Oneflow
        const response = await fetch(`${ONEFLOW_API_URL}/contracts?limit=1`, {
            headers: {
                'x-oneflow-api-token': ONEFLOW_API_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log(`...svar mottaget från Oneflow med status: ${response.status}`);

        // Kontrollera om anropet misslyckades
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Oneflow API Error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Anrop till Oneflow lyckades!');
        
        // Skicka ett framgångsrikt svar
        return res.status(200).json({
            success: true,
            message: 'Anslutningen till Oneflow API fungerar!',
            data: {
                contracts_found_in_test: data.data?.length || 0,
                total_contracts_in_account: data.meta?.total || 0
            }
        });

    } catch (error) {
        // Om något går fel, fånga felet här
        console.error('❌ Oneflow-testet misslyckades:', error);
        
        // Skicka ett felmeddelande tillbaka
        return res.status(500).json({
            success: false,
            error: 'Oneflow API test failed',
            details: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
}
// api/test-oneflow.ts - AVANCERAD VERSION FÖR ATT MAPPA KONTOT
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- HJÄLPAR-FUNKTION FÖR API-ANROP ---
// Vi skapar en central funktion för att göra koden renare
async function oneflowFetch(endpoint: string, token: string) {
    const API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1';
    
    console.log(`...anropar Oneflow endpoint: ${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'x-oneflow-api-token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Fel från Oneflow API: ${response.status} - ${errorText}`);
        throw new Error(`Oneflow API Error: ${response.status}`);
    }
    
    console.log(`✅ Svar mottaget från ${endpoint}`);
    return response.json();
}

// --- HUVUDFUNKTION (HANDLER) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Sätt CORS-headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN;
        if (!ONEFLOW_API_TOKEN) {
            throw new Error('Miljövariabeln ONEFLOW_API_TOKEN är inte satt.');
        }

        // Hämta query-parametrar från URL:en
        const { listTemplates, templateId, contractId } = req.query;

        // Välj vad vi ska göra baserat på URL:en
        if (listTemplates) {
            // --- LÄGE 1: Lista alla avtalsmallar ---
            console.log('🧪 Diagnosläge: Listar alla avtalsmallar...');
            const data = await oneflowFetch('/templates', ONEFLOW_API_TOKEN);
            
            // Plocka ut bara den viktigaste informationen
            const templates = data.data.map((t: any) => ({
                id: t.id,
                name: t.name,
                type: t.type?.name || 'Okänd typ'
            }));

            return res.status(200).json({
                success: true,
                message: `Hittade ${templates.length} avtalsmallar.`,
                templates: templates
            });

        } else if (templateId) {
            // --- LÄGE 2: Visa detaljer för en specifik mall ---
            console.log(`🧪 Diagnosläge: Visar detaljer för mall-ID ${templateId}...`);
            const data = await oneflowFetch(`/templates/${templateId}`, ONEFLOW_API_TOKEN);
            
            // Plocka ut datafälten från mallen
            const dataFields = data.data_fields?.map((df: any) => ({
                id: df.id,
                key: df.key, // Detta är namnet du använder i koden
                type: df.type,
                default_value: df.default_value
            })) || [];

            return res.status(200).json({
                success: true,
                message: `Detaljer för mallen "${data.name}".`,
                template: { id: data.id, name: data.name },
                required_data_fields: dataFields
            });

        } else if (contractId) {
            // --- LÄGE 3: Visa detaljer för ett specifikt kontrakt ---
             console.log(`🧪 Diagnosläge: Visar detaljer för kontrakt-ID ${contractId}...`);
            const data = await oneflowFetch(`/contracts/${contractId}`, ONEFLOW_API_TOKEN);

            const dataFields = data.data_fields?.map((df: any) => ({
                key: df.key,
                value: df.value // Här ser vi det ifyllda värdet
            })) || [];

            return res.status(200).json({
                success: true,
                message: `Detaljer för kontraktet "${data.name}".`,
                contract: { id: data.id, name: data.name, state: data.state },
                filled_in_data_fields: dataFields
            });

        } else {
            // --- GRUNDLÄGE: Standard anslutningstest ---
            console.log('🧪 Diagnosläge: Grundläggande anslutningstest...');
            const data = await oneflowFetch('/contracts?limit=1', ONEFLOW_API_TOKEN);
            return res.status(200).json({
                success: true,
                message: 'Grundläggande anslutning till Oneflow API fungerar!',
                data: {
                    total_contracts_in_account: data.meta?.total || 0
                }
            });
        }

    } catch (error) {
        console.error('❌ Ett fel inträffade i test-scriptet:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Okänt fel'
        });
    }
}
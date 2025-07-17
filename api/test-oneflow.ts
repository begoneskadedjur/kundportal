// api/test-oneflow.ts - KOMPLETT DIAGNOSTIKVERKTYG
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Centraliserad hjälpfunktion för att göra API-anrop ---
async function oneflowFetch(endpoint: string, token: string) {
    const API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1';
    
    console.log(`...anropar Oneflow endpoint: ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'x-oneflow-api-token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Fel från Oneflow API (${response.status}): ${errorText}`);
        throw new Error(`Oneflow API Error: ${response.status}`);
    }
    
    console.log(`✅ Svar mottaget från ${endpoint}`);
    return response.json();
}

// --- Huvudfunktion (Handler) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Sätt CORS-headers för att tillåta anrop från webbläsare
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-oneflow-api-token');

    // Hantera pre-flight OPTIONS-request
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN;
        if (!ONEFLOW_API_TOKEN) {
            throw new Error('Miljövariabeln ONEFLOW_API_TOKEN är inte satt.');
        }

        // Hämta query-parametrar från URL:en för att bestämma läge
        const { getWorkspaces, contractId, templateId } = req.query;

        if (getWorkspaces) {
            // --- LÄGE 1: Hämta alla arbetsytor ---
            console.log('🧪 Diagnosläge: Hämtar arbetsytor...');
            const data = await oneflowFetch('/workspaces', ONEFLOW_API_TOKEN);
            const workspaces = data.data.map((ws: any) => ({
                name: ws.name,
                id: ws.id
            }));
            return res.status(200).json({
                success: true,
                message: `Hittade ${workspaces.length} arbetsytor. Använd relevant ID som ONEFLOW_WORKSPACE_ID.`,
                workspaces: workspaces
            });

        } else if (contractId) {
            // --- LÄGE 2: Analysera ett specifikt kontrakt (mest pålitliga metoden) ---
            console.log(`🧪 Diagnosläge: Analyserar kontrakt-ID ${contractId}...`);
            const data = await oneflowFetch(`/contracts/${contractId}`, ONEFLOW_API_TOKEN);
            const analysis = {
                contract_info: { id: data.id, name: data.name, state: data.state },
                participants: data.participants?.map((p: any) => ({ name: p.name, email: p.email, company_name: p.company_name })) || [],
                data_fields_with_keys: data.data_fields?.filter((df: any) => df.custom_id).map((df: any) => ({ key_for_api: df.custom_id, value: df.value })) || [],
                data_fields_without_keys: data.data_fields?.filter((df: any) => !df.custom_id).map((df: any) => ({ value: df.value })) || []
            };
            return res.status(200).json({ success: true, message: `Komplett analys av kontrakt ${contractId}.`, analysis });

        } else if (templateId) {
            // --- LÄGE 3: Analysera en specifik mall ---
            console.log(`🧪 Diagnosläge: Analyserar mall-ID ${templateId}...`);
            const data = await oneflowFetch(`/templates/${templateId}`, ONEFLOW_API_TOKEN);
            const dataFields = data.data_fields?.map((df: any) => ({ key: df.key, type: df.type })) || [];
            return res.status(200).json({ success: true, message: `Detaljer för mallen "${data.name}".`, template: { id: data.id, name: data.name }, api_reported_data_fields: dataFields });
        
        } else {
            // --- Standardläge om inga parametrar anges ---
            return res.status(400).json({ 
                success: false, 
                error: "Inget kommando angivet. Använd en query-parameter.",
                available_commands: [
                    "?getWorkspaces=true",
                    "?contractId=<ett_kontrakts_id>",
                    "?templateId=<ett_mall_id>"
                ]
            });
        }

    } catch (error) {
        console.error('❌ Ett fel inträffade i diagnostik-scriptet:', error);
        return res.status(500).json({
            success: false,
            error: "Ett internt fel inträffade.",
            details: error instanceof Error ? error.message : 'Okänt fel'
        });
    }
}
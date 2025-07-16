// api/test-oneflow.ts - AVANCERAD VERSION FÖR ATT MAPPA KONTOT
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- HJÄLPAR-FUNKTION FÖR API-ANROP ---
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { return res.status(204).end(); }

    try {
        const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN;
        if (!ONEFLOW_API_TOKEN) { throw new Error('Miljövariabeln ONEFLOW_API_TOKEN är inte satt.'); }

        const { templateId, contractId } = req.query;

        if (contractId) {
            // --- LÄGE 1: VIKTIGAST! Undersök ett existerande kontrakt ---
            console.log(`🧪 Diagnosläge: Visar detaljer för kontrakt-ID ${contractId}...`);
            const data = await oneflowFetch(`/contracts/${contractId}`, ONEFLOW_API_TOKEN);

            // Plocka ut ALLA typer av data för att få en komplett bild
            const result = {
                contract_info: {
                    id: data.id,
                    name: data.name,
                    state: data.state,
                },
                participants: data.participants?.map((p: any) => ({
                    name: p.name,
                    email: p.email,
                    company_name: p.company_name, // Detta fyller i "Företag"-fältet
                    organization_number: p.organization_number, // Detta fyller i "Org nr"-fältet
                    is_signer: p.is_signer
                })) || [],
                // Detta är de "Fria Datafälten" vi letar efter!
                data_fields: data.data_fields?.map((df: any) => ({
                    key: df.key, // Detta är det VIKTIGA namnet att använda i koden
                    value: df.value
                })) || []
            };

            return res.status(200).json({
                success: true,
                message: `Komplett analys av kontraktet "${data.name}". Använd denna data för att bygga ditt API-anrop.`,
                analysis: result
            });

        } else if (templateId) {
            // --- LÄGE 2: Undersök en mall (som vi ser kan vara vilseledande) ---
            console.log(`🧪 Diagnosläge: Visar detaljer för mall-ID ${templateId}...`);
            const data = await oneflowFetch(`/templates/${templateId}`, ONEFLOW_API_TOKEN);
            
            const dataFields = data.data_fields?.map((df: any) => ({
                key: df.key, type: df.type,
            })) || [];

            return res.status(200).json({
                success: true,
                message: `Detaljer för mallen "${data.name}".`,
                template: { id: data.id, name: data.name },
                api_reported_data_fields: dataFields
            });
        } else {
            return res.status(400).json({ success: false, error: "Ange antingen ?contractId=... eller ?templateId=... i URL:en." });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Okänt fel'
        });
    }
}
// api/test-oneflow.ts - FÖRBÄTTRAD DIAGNOSTIK MED TEMPLATE FIELD DETECTION
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
            // --- LÄGE 3: FÖRBÄTTRAD MALL-ANALYS MED TEST-SKAPANDE ---
            console.log(`🧪 Diagnosläge: Analyserar mall-ID ${templateId}...`);
            
            // Först, hämta basic template info
            const templateData = await oneflowFetch(`/templates/${templateId}`, ONEFLOW_API_TOKEN);
            const basicDataFields = templateData.data_fields?.map((df: any) => ({ key: df.key, type: df.type })) || [];
            
            // Sedan, försök skapa ett test-kontrakt för att se vilka fält som faktiskt behövs
            console.log('🔍 Skapar test-kontrakt för att identifiera obligatoriska data fields...');
            
            try {
                // Komplett payload med båda parter (baserat på miljövariabler)
                const testPayload = {
                    workspace_id: parseInt(process.env.ONEFLOW_WORKSPACE_ID || '485612'),
                    template_id: parseInt(templateId as string),
                    parties: [
                        {
                            type: 'company', 
                            name: 'Test Företag AB',
                            identification_number: '556123-4567',
                            participants: [
                                {
                                    name: 'Christian Karlsson',
                                    email: 'christian.karlsson@hotmail.se', // ✅ Din privata testmail
                                    _permissions: { 'contract:update': true },
                                    signatory: true,
                                    delivery_channel: 'email'
                                }
                            ]
                        }
                    ]
                    // Skicka inga data_fields för att se vad som saknas
                };
                
                const createResponse = await fetch('https://api.oneflow.com/v1/contracts/create', {
                    method: 'POST',
                    headers: {
                        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
                        'x-oneflow-user-email': process.env.ONEFLOW_USER_EMAIL!,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(testPayload)
                });
                
                if (!createResponse.ok) {
                    const errorData = await createResponse.json();
                    console.log('🎯 Fel från create contract (förväntat för field-analys):', errorData);
                    
                    // Leta efter information om saknade fält i felet
                    let detectedFields: string[] = [];
                    let fieldErrors: any = {};
                    
                    if (errorData.parameter_problems) {
                        Object.entries(errorData.parameter_problems).forEach(([key, value]) => {
                            if (key.includes('custom_id') && Array.isArray(value)) {
                                // Extrahera field namn från fel-meddelanden
                                (value as string[]).forEach(msg => {
                                    const match = msg.match(/Key (\w+) does not exist/);
                                    if (match) {
                                        detectedFields.push(match[1]);
                                    }
                                });
                            }
                            fieldErrors[key] = value;
                        });
                    }
                    
                    return res.status(200).json({
                        success: true,
                        message: `Analys av mall "${templateData.name}" genomförd.`,
                        template: { 
                            id: templateData.id, 
                            name: templateData.name,
                            state: templateData.state 
                        },
                        api_reported_data_fields: basicDataFields,
                        field_detection: {
                            method: 'test_contract_creation',
                            detected_field_names: detectedFields,
                            create_contract_error: errorData,
                            field_errors: fieldErrors
                        },
                        recommendation: detectedFields.length > 0 
                            ? `Mallen verkar inte ha några obligatoriska data fields, eller så är fältnamnen annorlunda än förväntat.`
                            : 'Testa att skapa kontrakt utan data_fields, eller kontrollera mallens inställningar i Oneflow-appen.'
                    });
                } else {
                    // Om det lyckades, ta bort test-kontraktet
                    const contractData = await createResponse.json();
                    console.log('✅ Test-kontrakt skapat framgångsrikt:', contractData.id);
                    
                    // Ta bort test-kontraktet
                    try {
                        await fetch(`https://api.oneflow.com/v1/contracts/${contractData.id}`, {
                            method: 'DELETE',
                            headers: {
                                'x-oneflow-api-token': ONEFLOW_API_TOKEN,
                                'x-oneflow-user-email': process.env.ONEFLOW_USER_EMAIL!
                            }
                        });
                        console.log('🗑️ Test-kontrakt borttaget');
                    } catch (deleteError) {
                        console.log('⚠️ Kunde inte ta bort test-kontrakt:', deleteError);
                    }
                    
                    return res.status(200).json({
                        success: true,
                        message: `Mall "${templateData.name}" fungerar utan data fields!`,
                        template: { 
                            id: templateData.id, 
                            name: templateData.name,
                            state: templateData.state 
                        },
                        api_reported_data_fields: basicDataFields,
                        test_contract_result: {
                            created_successfully: true,
                            contract_id: contractData.id,
                            deleted: true
                        },
                        recommendation: 'Mallen fungerar perfekt utan data_fields! Du kan skapa kontrakt direkt utan att skicka några custom fields.'
                    });
                }
                
            } catch (createError) {
                console.error('Fel vid test-skapande:', createError);
                return res.status(200).json({
                    success: true,
                    message: `Basic analys av mall "${templateData.name}".`,
                    template: { 
                        id: templateData.id, 
                        name: templateData.name,
                        state: templateData.state 
                    },
                    api_reported_data_fields: basicDataFields,
                    create_test_error: createError instanceof Error ? createError.message : 'Okänt fel',
                    recommendation: 'Kontrollera mallens inställningar i Oneflow-appen för att se vilka data fields som är konfigurerade.'
                });
            }
        
        } else {
            // --- Standardläge om inga parametrar anges ---
            return res.status(400).json({ 
                success: false, 
                error: "Inget kommando angivet. Använd en query-parameter.",
                available_commands: [
                    "?getWorkspaces=true - Lista alla arbetsytor",
                    "?contractId=<id> - Analysera befintligt kontrakt",
                    "?templateId=<id> - Analysera mall och testa field-krav"
                ],
                example_usage: [
                    "/api/test-oneflow?templateId=8486368",
                    "/api/test-oneflow?getWorkspaces=true"
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
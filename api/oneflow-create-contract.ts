// api/oneflow-create-contract.ts - KORRIGERAD VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1'
// Din e-post som är användare i Oneflow. Krävs i header för vissa anrop.
const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL! 

interface CreateContractRequest {
  templateId: string
  contractData: { [key: string]: string }
  recipient: {
    name: string
    email: string
    company_name?: string
    organization_number?: string
  }
  sendForSigning: boolean
}

// Denna funktion är nu korrekt deklarerad som `async`
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS-headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { templateId, contractData, recipient, sendForSigning }: CreateContractRequest = req.body

    // Validera inkommande data
    if (!templateId || !contractData || !recipient?.email) {
      return res.status(400).json({ error: 'Bad Request: templateId, contractData, and recipient email are required.' })
    }
    if (!ONEFLOW_USER_EMAIL) {
      return res.status(500).json({ error: 'Server Configuration Error: ONEFLOW_USER_EMAIL is not set.'})
    }

    console.log(`🔨 Skapar kontrakt från mall: ${templateId}`)
    
    // 1. Förbered och skapa kontraktet
    const contract = await createContract(templateId, contractData, recipient)
    console.log(`✅ Kontrakt skapat som utkast med ID: ${contract.id}`)

    let finalState = contract.state;

    // 2. Publicera kontraktet om det ska skickas för signering
    if (sendForSigning) {
      console.log(`📤 Publicerar kontrakt ${contract.id} för signering...`)
      const publishedContract = await publishContract(contract.id)
      finalState = publishedContract.state; // Uppdatera status till 'pending'
      console.log(`✅ Kontrakt publicerat.`)
    }

    // 3. Skicka tillbaka ett framgångsrikt svar
    return res.status(200).json({
      success: true,
      contract: {
        id: contract.id,
        name: contract.name,
        state: finalState,
        url: `https://app.oneflow.com/contracts/${contract.id}` // Direktlänk till kontraktet
      }
    })

  } catch (error) {
    console.error('❌ Ett fel inträffade vid skapande av kontrakt:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create contract',
      details: error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }
}

// --- HJÄLPFUNKTIONER ---

// Denna funktion skapar kontraktet
async function createContract(
  templateId: string, 
  contractData: { [key: string]: string },
  recipient: CreateContractRequest['recipient']
) {
    // Filtrera bort tomma värden och skapa data_fields-arrayen
    // KORRIGERING: Använder "custom_id" som nyckel enligt dokumentationen
    const dataFields = Object.entries(contractData)
        .filter(([, value]) => value && value.trim() !== '')
        .map(([key, value]) => ({
            custom_id: key, // Använd nyckeln från frontend direkt som "custom_id"
            value: value.trim()
        }));

    const contractPayload = {
        template_id: parseInt(templateId),
        name: `Skadedjursavtal - ${contractData['foretag'] || 'Ny Kund'}`,
        parties: [
            {
                name: recipient.company_name || contractData['foretag'],
                country_code: "SE", // Rekommenderas att inkludera
                participants: [{
                    name: recipient.name,
                    email: recipient.email,
                    delivery_channel: 'email',
                    signatory: true // Personen som ska signera
                }]
            }
        ],
        data_fields: dataFields
    };

    console.log('📋 Skickar följande payload till Oneflow:', JSON.stringify(contractPayload, null, 2));
    
    // KORRIGERING: Rätt endpoint är /contracts
    const response = await fetch(`${ONEFLOW_API_URL}/contracts`, {
        method: 'POST',
        headers: {
            'x-oneflow-api-token': ONEFLOW_API_TOKEN,
            'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(contractPayload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Oneflow API-fel vid createContract:', response.status, errorText);
        throw new Error(`Oneflow API error (${response.status}): ${errorText}`);
    }

    return await response.json();
}

// Denna funktion publicerar kontraktet
async function publishContract(contractId: number) {
  const response = await fetch(`${ONEFLOW_API_URL}/contracts/${contractId}/publish`, {
    method: 'POST',
    headers: {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subject: 'Ditt avtal från Begone Skadedjur & Sanering AB',
      message: 'Vänligen granska och signera det bifogade avtalet.'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Oneflow API-fel vid publishContract:', response.status, errorText);
    throw new Error(`Failed to publish contract (${response.status}): ${errorText}`);
  }

  return await response.json();
}
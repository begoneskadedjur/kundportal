// api/oneflow-create-contract.ts - SLUTGILTIG KORRIGERAD VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { return res.status(200).end() }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }) }

  try {
    const { templateId, contractData, recipient, sendForSigning }: CreateContractRequest = req.body

    if (!templateId || !contractData || !recipient?.email || !ONEFLOW_USER_EMAIL) {
      return res.status(400).json({ error: 'Bad Request: Incomplete data or missing server configuration.' })
    }

    console.log(`🔨 Skapar kontrakt från mall: ${templateId}`)
    const contract = await createContract(templateId, contractData, recipient)
    console.log(`✅ Kontrakt skapat som utkast med ID: ${contract.id}`)

    let finalState = contract.state;

    if (sendForSigning) {
      console.log(`📤 Publicerar kontrakt ${contract.id} för signering...`)
      const publishedContract = await publishContract(contract.id)
      finalState = publishedContract.state;
      console.log(`✅ Kontrakt publicerat.`)
    }

    return res.status(200).json({
      success: true,
      contract: {
        id: contract.id,
        name: contract.name,
        state: finalState,
        url: `https://app.oneflow.com/contracts/${contract.id}`
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

async function createContract(
  templateId: string, 
  contractData: { [key: string]: string },
  recipient: CreateContractRequest['recipient']
) {
    const dataFields = Object.entries(contractData)
        .filter(([, value]) => value && value.trim() !== '')
        .map(([key, value]) => ({
            custom_id: key,
            value: value.trim()
        }));

    const contractPayload = {
        template_id: parseInt(templateId),
        name: `Skadedjursavtal - ${contractData['foretag'] || 'Ny Kund'}`,
        parties: [
            {
                name: recipient.company_name || contractData['foretag'],
                country_code: "SE",
                participants: [{
                    name: recipient.name,
                    email: recipient.email,
                    delivery_channel: 'email',
                    signatory: true
                }]
            }
        ],
        data_fields: dataFields
    };

    console.log('📋 Skickar följande payload:', JSON.stringify(contractPayload, null, 2));
    
    // ==================================================================
    // HÄR ÄR DEN AVGÖRANDE KORRIGERINGEN
    // Vi går tillbaka till den ursprungliga endpointen /contracts
    // ==================================================================
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
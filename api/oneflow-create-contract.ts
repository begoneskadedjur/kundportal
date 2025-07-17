// api/oneflow-create-contract.ts - Skapa riktigt kontrakt i Oneflow
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1'

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
  // CORS
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

    console.log('🔨 Creating contract from template:', templateId)
    console.log('📨 Recipient:', recipient.email)

    // 1. Skapa kontrakt från mall
    const contract = await createContractFromTemplate(templateId, contractData, recipient)
    console.log('✅ Contract created with ID:', contract.id)

    // 2. Om vi ska skicka för signering
    if (sendForSigning) {
      await publishContract(contract.id)
      console.log('📤 Contract sent for signing')
    }

    return res.status(200).json({
      success: true,
      contract: {
        id: contract.id,
        name: contract.name,
        state: contract.state,
        url: `https://app.oneflow.com/contracts/${contract.id}`
      },
      message: sendForSigning 
        ? `Kontrakt skapat och skickat till ${recipient.email}` 
        : 'Kontrakt skapat som utkast'
    })

  } catch (error) {
    console.error('❌ Error creating contract:', error)
    return res.status(500).json({
      error: 'Failed to create contract',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function createContractFromTemplate(
  templateId: string, 
  contractData: { [key: string]: string },
  recipient: any
) {
  // Mappa dina field keys till faktiska Oneflow field IDs
  const ONEFLOW_FIELD_IDS = {
    'foretag': '15a28bab-5d17-4f3a-b021-fb9e4b5d6840',
    'org-nr': '978226a1-6a53-4162-87b8-61e74ff10b61',
    'kontaktperson': '0da9f741-02d1-4372-84ca-02f4a76c1dbb',
    'e-post-kontaktperson': '8d8dac3a-18ab-4019-9ada-8c843e696ba2',
    'telefonnummer-kontaktperson': 'cc29ae86-0a6c-4703-a45f-21a065e05a16',
    'utforande-adress': '80ec7903-f636-43b0-bf7e-09c9888eb6b6',
    'faktura-adress-pdf': '101d137e-236c-43c9-bf11-d14749ac8f4b',
    'avtalslngd': 'cdaa9624-2b43-410a-a5e5-aec724d65bb0',
    'begynnelsedag': 'f612ef4c-299f-4ce0-b5b3-d99fb30aea0e',
    'avtalsobjekt': '288c2e67-c6a0-44e6-9fa8-d9742627f82e',
    'anstlld': 'b0a5c543-f554-41b2-8401-e0dd272cffed',
    'e-post-anstlld': 'c6941ca5-86d0-48f1-b903-7042e9e5a36e'
  }

  // Förbered data fields enligt Oneflow dokumentation - array av objekt med id/value
  const dataFields = Object.entries(contractData)
    .filter(([key, value]) => value && value.trim() && ONEFLOW_FIELD_IDS[key as keyof typeof ONEFLOW_FIELD_IDS])
    .map(([key, value]) => ({
      id: ONEFLOW_FIELD_IDS[key as keyof typeof ONEFLOW_FIELD_IDS],
      value: value.trim()
    }))

  // Skapa kontrakt-payload enligt Oneflow API dokumentation
  const contractPayload = {
    workspace_id: 485612,
    template_id: parseInt(templateId),
    name: `${contractData['foretag'] || 'Nytt företag'} - Skadedjursavtal`,
    
    // Lägg till parties (företag som ska signera)
    parties: [
      {
        type: 'company',
        name: recipient.company_name || contractData['foretag'],
        organization_number: recipient.organization_number || contractData['org-nr'],
        participants: [
          {
            delivery_channel: 'email',
            email: recipient.email,
            name: recipient.name,
            is_signer: true,
            sign_order: 1
          }
        ]
      }
    ],
    
    // Data fields som array av objekt med id/value
    data_fields: dataFields
  }

  console.log('📋 Contract payload:', JSON.stringify(contractPayload, null, 2))

  const response = await fetch(`${ONEFLOW_API_URL}/contracts/create`, {
    method: 'POST',
    headers: {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': 'christian.karlsson@begone.se',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(contractPayload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Oneflow API error:', response.status, errorText)
    throw new Error(`Oneflow API error: ${response.status} ${errorText}`)
  }

  return await response.json()
} dokumentation
  const response = await fetch(`${ONEFLOW_API_URL}/contracts/create`, {
    method: 'POST',
    headers: {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': 'christian.karlsson@begone.se', // Din email i Oneflow
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(contractPayload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Oneflow API error:', response.status, errorText)
    throw new Error(`Oneflow API error: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function publishContract(contractId: number) {
  const response = await fetch(`${ONEFLOW_API_URL}/contracts/${contractId}/publish`, {
    method: 'POST',
    headers: {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': 'christian.karlsson@begone.se', // Din email
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subject: 'Ditt skadedjursavtal från BeGone',
      message: 'Ditt skadedjursavtal är klart för signering. Vänligen granska och signera avtalet.'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Failed to publish contract:', response.status, errorText)
    throw new Error(`Failed to publish contract: ${response.status} ${errorText}`)
  }

  return await response.json()
}
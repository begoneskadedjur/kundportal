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
  // Förbered data fields för Oneflow
  const dataFields = Object.entries(contractData)
    .filter(([_, value]) => value && value.trim()) // Bara fält med värden
    .map(([key, value]) => ({
      key,
      value: value.trim()
    }))

  // Skapa kontrakt-payload
  const contractPayload = {
    template_id: parseInt(templateId),
    name: `${contractData['foretag'] || 'Nytt företag'} - Skadedjursavtal`,
    
    // Lägg till mottagare som ska signera
    participants: [
      {
        delivery_channel: 'email',
        email: recipient.email,
        name: recipient.name,
        company_name: recipient.company_name || contractData['foretag'],
        organization_number: recipient.organization_number || contractData['org-nr'],
        is_signer: true,
        sign_order: 1
      }
    ],
    
    // Fyll i datafält
    data_fields: dataFields
  }

  console.log('📋 Contract payload:', JSON.stringify(contractPayload, null, 2))

  // Skapa kontraktet
  const response = await fetch(`${ONEFLOW_API_URL}/contracts`, {
    method: 'POST',
    headers: {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
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
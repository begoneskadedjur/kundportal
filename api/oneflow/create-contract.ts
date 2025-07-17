// api/oneflow/create-contract.ts - Förbättrad Oneflow Contract Creation API
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

interface ContractRecipient {
  name: string
  email: string
  company_name?: string
  organization_number?: string
}

interface ContractRequestBody {
  templateId: string
  contractData: Record<string, string>
  recipient: ContractRecipient
  sendForSigning: boolean
  partyType: 'company' | 'individual'
}

interface OneflowEnvironment {
  token: string
  userEmail: string
  workspaceId: string
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// Validera miljövariabler
const validateEnvironment = (): OneflowEnvironment => {
  const token = process.env.ONEFLOW_API_TOKEN
  const userEmail = process.env.ONEFLOW_USER_EMAIL
  const workspaceId = process.env.ONEFLOW_WORKSPACE_ID

  if (!token || !userEmail || !workspaceId) {
    const missing = []
    if (!token) missing.push('ONEFLOW_API_TOKEN')
    if (!userEmail) missing.push('ONEFLOW_USER_EMAIL')
    if (!workspaceId) missing.push('ONEFLOW_WORKSPACE_ID')
    
    throw new Error(`Saknade miljövariabler: ${missing.join(', ')}`)
  }

  return { token, userEmail, workspaceId }
}

// Validera request data
const validateRequestData = (body: ContractRequestBody) => {
  const { templateId, recipient, contractData } = body

  if (!templateId) {
    throw new Error('Mall-ID är obligatoriskt')
  }

  if (!recipient?.email) {
    throw new Error('Mottagarens e-post är obligatorisk')
  }

  if (!recipient?.name) {
    throw new Error('Mottagarens namn är obligatoriskt')
  }

  // Validera email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipient.email)) {
    throw new Error('Ogiltig e-postadress')
  }

  console.log('✅ Request data validerad framgångsrikt')
}

// Bygg Oneflow payload
const buildOneflowPayload = (
  body: ContractRequestBody,
  workspaceId: string
) => {
  const { templateId, contractData, recipient, partyType, sendForSigning } = body

  // Mappa datafält
  const data_fields = Object.entries(contractData).map(
    ([custom_id, value]) => ({ custom_id, value })
  )

  // Skapa motpart (counterparty)
  const counterParty: any = { type: partyType }
  
  if (partyType === 'company') {
    counterParty.name = recipient.company_name || recipient.name
    if (recipient.organization_number) {
      counterParty.identification_number = recipient.organization_number
    }
  } else {
    counterParty.name = recipient.name
  }

  // Lägg till deltagare (participants)
  counterParty.participants = [
    {
      name: recipient.name,
      email: recipient.email,
      _permissions: {
        'contract:update': sendForSigning  // true om ska signera, false för viewer
      },
      signatory: sendForSigning,           // true om ska signera
      delivery_channel: 'email'
    },
  ]

  const payload = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties: [counterParty], // Oneflow lägger automatiskt till owner
  }

  console.log('📦 Oneflow payload byggd:', {
    workspace_id: payload.workspace_id,
    template_id: payload.template_id,
    data_fields_count: payload.data_fields.length,
    party_type: partyType,
    send_for_signing: sendForSigning
  })

  return payload
}

// Skapa kontrakt i Oneflow
const createOneflowContract = async (
  payload: any,
  env: OneflowEnvironment
) => {
  console.log('🚀 Skickar create request till Oneflow...')

  const createResponse = await fetch(
    'https://api.oneflow.com/v1/contracts/create',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-oneflow-api-token': env.token,
        'x-oneflow-user-email': env.userEmail,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  const createdContract = await createResponse.json()
  
  if (!createResponse.ok) {
    console.error('❌ Oneflow create fel:', JSON.stringify(createdContract, null, 2))
    throw new Error(
      createdContract.detail || 
      createdContract.message || 
      `Oneflow API fel: ${createResponse.status}`
    )
  }

  console.log('✅ Kontrakt skapat framgångsrikt:', createdContract.id)
  return createdContract
}

// Publicera kontrakt för signering
const publishContract = async (
  contractId: string,
  recipient: ContractRecipient,
  env: OneflowEnvironment
) => {
  console.log('📧 Publicerar kontrakt för signering...')
  
  const publishPayload = {
    subject: `Avtal från BeGone Skadedjur & Sanering AB`,
    message: `Hej ${recipient.name}!\n\nBifogat finner du vårt avtal för signering.\n\nVänliga hälsningar,\nBeGone Skadedjur & Sanering AB`
  }

  const publishResponse = await fetch(
    `https://api.oneflow.com/v1/contracts/${contractId}/publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-oneflow-api-token': env.token,
        'x-oneflow-user-email': env.userEmail,
        Accept: 'application/json',
      },
      body: JSON.stringify(publishPayload),
    }
  )

  if (!publishResponse.ok) {
    const publishError = await publishResponse.json()
    console.error('⚠️ Kontrakt skapat men kunde inte publiceras:', JSON.stringify(publishError, null, 2))
    
    // Kasta inte fel här - kontraktet är skapat även om publiceringen misslyckades
    return {
      warning: 'Kontrakt skapat men kunde inte skickas för signering automatiskt',
      publishError: publishError
    }
  }

  console.log('✅ Kontrakt publicerat och skickat för signering')
  return null
}

// Huvudfunktion
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res)

  // Hantera OPTIONS request för CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera endast POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Endast POST-anrop tillåtna' 
    })
  }

  try {
    console.log('🎯 Ny Oneflow contract creation request mottagen')

    // 1. Validera miljövariabler
    const env = validateEnvironment()

    // 2. Validera request data
    const body = req.body as ContractRequestBody
    validateRequestData(body)

    // 3. Bygg Oneflow payload
    const payload = buildOneflowPayload(body, env.workspaceId)

    // 4. Skapa kontrakt
    const createdContract = await createOneflowContract(payload, env)

    // 5. Publicera för signering (om requested)
    let publishResult = null
    if (body.sendForSigning) {
      publishResult = await publishContract(createdContract.id, body.recipient, env)
    }

    // 6. Returnera framgångsrikt resultat
    const responseData: any = { 
      success: true,
      contract: createdContract 
    }

    if (publishResult?.warning) {
      responseData.warning = publishResult.warning
      responseData.publishError = publishResult.publishError
    }

    console.log('🎉 Oneflow contract creation lyckades!')
    return res.status(200).json(responseData)
    
  } catch (error: any) {
    console.error('❌ Fel i Oneflow contract creation:', error)
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internt serverfel vid skapande av kontrakt',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
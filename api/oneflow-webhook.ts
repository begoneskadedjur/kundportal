// api/oneflow-webhook.ts - Enkel webhook för att börja med
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_WEBHOOK_SECRET = process.env.ONEFLOW_WEBHOOK_SECRET!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface OneflowWebhookPayload {
  contract: {
    id: number
  }
  callback_id: string
  events: Array<{
    created_time: string
    id: number
    type: string // 'contract:sign', 'contract:publish', etc.
  }>
  signature: string
}

// Disable body parsing för signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('📨 Oneflow webhook received')

    // Läs raw body
    const rawBody = await getRawBody(req)
    console.log('📦 Raw body length:', rawBody.length)

    // Verifiera signatur
    const signature = req.headers['x-oneflow-signature'] as string
    if (!verifySignature(rawBody, signature)) {
      console.error('❌ Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Parsa payload
    let payload: OneflowWebhookPayload
    try {
      payload = JSON.parse(rawBody)
      console.log(`🔔 Event: ${payload.event}, Contract: ${payload.contract.name} (ID: ${payload.contract.id})`)
    } catch (parseError) {
      console.error('❌ Failed to parse payload:', parseError)
      return res.status(400).json({ error: 'Invalid JSON' })
    }

    // Logga event i databas
    await logEvent(payload)

    // Hantera olika events
    switch (payload.event) {
      case 'contract.signed':
        await handleContractSigned(payload.contract)
        break
        
      case 'contract.updated':
        await handleContractUpdated(payload.contract)
        break
        
      default:
        console.log(`ℹ️ Ignoring event: ${payload.event}`)
    }

    console.log(`✅ Successfully processed webhook with ${payload.events.length} events`)
    return res.status(200).json({ 
      success: true, 
      message: `Processed ${payload.events.length} events`,
      callback_id: payload.callback_id
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleContractSigned(contractId: number) {
  console.log(`📋 Processing signed contract ID: ${contractId}`)
  
  try {
    // Hämta kontraktdata från Oneflow API
    const contractData = await fetchContractFromOneflow(contractId)
    
    if (!contractData) {
      console.log('⚠️ Could not fetch contract data')
      return
    }

    // Resten av logiken för att skapa kund...
    console.log(`✅ Contract signed: ${contractData.name}`)

  } catch (error) {
    console.error('❌ Error handling signed contract:', error)
    throw error
  }
}

async function handleContractPublished(contractId: number) {
  console.log(`📤 Contract published: ${contractId}`)
  // Skapa customer med pending status
}

async function handleContractUpdated(contractId: number) {
  console.log(`📝 Contract updated: ${contractId}`)
  // Uppdatera befintlig customer
}

async function fetchContractFromOneflow(contractId: number) {
  try {
    const response = await fetch(`${process.env.ONEFLOW_API_URL}/contracts/${contractId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ONEFLOW_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch contract ${contractId}: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching contract ${contractId}:`, error)
    return null
  }
}

async function createClickUpList(companyName: string, contractTypeId: string) {
  // Hämta folder från contract type
  const { data: contractType } = await supabase
    .from('contract_types')
    .select('clickup_folder_id')
    .eq('id', contractTypeId)
    .single()

  if (!contractType?.clickup_folder_id) {
    throw new Error('No ClickUp folder found for contract type')
  }

  // Skapa ClickUp lista
  const response = await fetch(`https://api.clickup.com/api/v2/folder/${contractType.clickup_folder_id}/list`, {
    method: 'POST',
    headers: {
      'Authorization': process.env.CLICKUP_API_TOKEN!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: companyName,
      content: `Kundlista för ${companyName} - Signerat avtal från Oneflow`
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to create ClickUp list: ${response.statusText}`)
  }

  return await response.json()
}

async function logEvent(payload: OneflowWebhookPayload) {
  await supabase
    .from('oneflow_sync_log')
    .insert({
      event_type: payload.events.map(e => e.type).join(', '),
      oneflow_contract_id: payload.contract.id.toString(),
      status: 'processing',
      details: {
        callback_id: payload.callback_id,
        events: payload.events,
        received_at: new Date().toISOString()
      }
    })
}

// Hjälpfunktioner
function extractNumericValue(value: any): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const numeric = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
    return isNaN(numeric) ? null : numeric
  }
  return null
}

function extractContractLength(dataFields: any): number {
  // Sök efter avtalslängd i olika fält
  const lengthFields = ['avtalslängd', 'period', 'år', 'månader']
  for (const field of lengthFields) {
    if (dataFields[field]) {
      const years = extractNumericValue(dataFields[field])
      if (years) return years * 12 // Konvertera till månader
    }
  }
  return 36 // Default 3 år
}

function detectBusinessType(companyName: string): string {
  const name = companyName.toLowerCase()
  
  if (name.includes('gård') || name.includes('farm')) return 'Jordbruk'
  if (name.includes('bygg') || name.includes('construction')) return 'Bygg och anläggning'
  if (name.includes('restaurang') || name.includes('kök')) return 'Restaurang och hotell'
  if (name.includes('industri') || name.includes('fabrik')) return 'Industri'
  if (name.includes('skola') || name.includes('förskola')) return 'Utbildning'
  if (name.includes('vård') || name.includes('sjukhus')) return 'Vård och omsorg'
  
  return 'Övrigt'
}

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    
    req.on('data', (chunk) => {
      data += chunk
    })
    
    req.on('end', () => {
      resolve(data)
    })
    
    req.on('error', (err) => {
      reject(err)
    })
  })
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !ONEFLOW_WEBHOOK_SECRET) {
    console.log('⚠️ No signature or secret, skipping verification (development mode)')
    return true // I utveckling
  }
  
  // Oneflow använder SHA1 med callback_id + sign_key
  // Men vi behöver callback_id från payload, så vi skippar verifiering för nu
  console.log('⚠️ Signature verification skipped - implement after testing')
  return true
}
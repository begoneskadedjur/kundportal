// api/oneflow-webhook.ts - Enkel webhook för att börja med
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_WEBHOOK_SECRET = process.env.ONEFLOW_WEBHOOK_SECRET!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface OneflowWebhookPayload {
  event: string // 'contract.signed', 'contract.updated', etc.
  contract: {
    id: number
    name: string
    state: string
    participants: Array<{
      email?: string
      first_name?: string
      last_name?: string
      company_name?: string
      organization_number?: string
    }>
    data_fields: Array<{
      key: string
      value: any
      type: string
    }>
    signed_date?: string
    created_at: string
    updated_at: string
  }
  timestamp: string
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

    console.log(`✅ Successfully processed ${payload.event}`)
    return res.status(200).json({ 
      success: true, 
      message: `Processed ${payload.event}` 
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleContractSigned(contract: any) {
  console.log(`📋 Processing signed contract: ${contract.name}`)
  
  try {
    // Extrahera företagsinformation
    const companyParticipant = contract.participants.find((p: any) => 
      p.company_name && p.organization_number
    )
    
    if (!companyParticipant) {
      console.log('⚠️ No company participant found')
      return
    }

    // Extrahera datafält
    const dataFields: { [key: string]: any } = {}
    contract.data_fields.forEach((field: any) => {
      dataFields[field.key] = field.value
    })

    // Skapa kontaktperson namn
    const contactPerson = companyParticipant.first_name && companyParticipant.last_name
      ? `${companyParticipant.first_name} ${companyParticipant.last_name}`
      : companyParticipant.company_name

    // Hämta default contract type
    const { data: contractType } = await supabase
      .from('contract_types')
      .select('id')
      .eq('name', 'Skadedjursavtal')
      .eq('is_active', true)
      .single()

    if (!contractType) {
      throw new Error('No default contract type found')
    }

    // Skapa ClickUp lista för kunden
    const clickupList = await createClickUpList(companyParticipant.company_name, contractType.id)

    // Skapa kund
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        company_name: companyParticipant.company_name,
        org_number: companyParticipant.organization_number || '',
        contact_person: contactPerson,
        email: companyParticipant.email || '',
        phone: dataFields.telefon || '',
        address: dataFields.adress || '',
        contract_type_id: contractType.id,
        business_type: detectBusinessType(companyParticipant.company_name),
        
        // ClickUp integration
        clickup_list_id: clickupList.id,
        clickup_list_name: clickupList.name,
        
        // Oneflow integration
        oneflow_contract_id: contract.id.toString(),
        oneflow_data_fields: dataFields,
        oneflow_state: contract.state,
        oneflow_last_sync: new Date().toISOString(),
        
        // Avtalsinformation (extrahera från datafält)
        annual_premium: extractNumericValue(dataFields.årspremie || dataFields.premium),
        contract_start_date: contract.signed_date ? new Date(contract.signed_date).toISOString().split('T')[0] : null,
        contract_length_months: extractContractLength(dataFields),
        contract_status: 'active',
        
        is_active: true
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create customer: ${error.message}`)
    }

    console.log(`✅ Created customer: ${customer.company_name}`)

    // Skicka välkomstmail (anropa befintlig funktion)
    try {
      await fetch(`${process.env.VERCEL_URL || 'https://kundportal.vercel.app'}/api/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customer.id })
      })
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
    }

  } catch (error) {
    console.error('❌ Error handling signed contract:', error)
    throw error
  }
}

async function handleContractUpdated(contract: any) {
  console.log(`📝 Processing updated contract: ${contract.name}`)
  
  try {
    // Hitta befintlig kund
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('oneflow_contract_id', contract.id.toString())
      .single()

    if (!customer) {
      console.log(`⚠️ No customer found for contract ${contract.id}`)
      return
    }

    // Extrahera uppdaterade datafält
    const dataFields: { [key: string]: any } = {}
    contract.data_fields.forEach((field: any) => {
      dataFields[field.key] = field.value
    })

    // Uppdatera kund
    const { error } = await supabase
      .from('customers')
      .update({
        oneflow_data_fields: dataFields,
        oneflow_state: contract.state,
        oneflow_last_sync: new Date().toISOString(),
        phone: dataFields.telefon || null,
        address: dataFields.adress || null,
        annual_premium: extractNumericValue(dataFields.årspremie || dataFields.premium),
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id)

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`)
    }

    console.log(`✅ Updated customer for contract ${contract.id}`)

  } catch (error) {
    console.error('❌ Error handling updated contract:', error)
    throw error
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
      event_type: payload.event,
      oneflow_contract_id: payload.contract.id.toString(),
      status: 'processing',
      details: {
        contract_name: payload.contract.name,
        contract_state: payload.contract.state,
        timestamp: payload.timestamp
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
    console.log('⚠️ No signature or secret, skipping verification')
    return true // I utveckling
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', ONEFLOW_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')
  
  return signature === `sha256=${expectedSignature}`
}
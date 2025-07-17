// api/oneflow/webhook.ts - Förbättrad Oneflow Webhook Handler
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_SIGN_KEY = process.env.ONEFLOW_WEBHOOK_SECRET!

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Interface för Oneflow webhook payload
interface OneflowWebhookPayload {
  contract: {
    id: number
    name?: string
    state?: string
  }
  callback_id: string
  events: Array<{
    created_time: string
    id: number
    type: string
    contract?: {
      id: number
      state?: string
    }
  }>
  signature: string
}

// Interface för webhook log entry
interface WebhookLogEntry {
  event_type: string
  oneflow_contract_id: string
  status: 'received' | 'verified' | 'processed' | 'error'
  details: any
  error_message?: string
}

// Inaktivera Vercels body parser för att hantera raw body
export const config = {
  api: {
    bodyParser: false,
  },
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-oneflow-signature')
}

// Läs raw body från request
const getRawBody = async (req: VercelRequest): Promise<string> => {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', (err) => reject(err))
  })
}

// Verifiera Oneflow signatur
const verifySignature = (payload: OneflowWebhookPayload): boolean => {
  if (!ONEFLOW_SIGN_KEY) {
    console.warn('⚠️ VARNING: ONEFLOW_WEBHOOK_SECRET saknas - signaturverifiering hoppas över')
    return true // Tillåt för testning utan nyckel
  }

  const expectedSignature = crypto
    .createHash('sha1')
    .update(payload.callback_id + ONEFLOW_SIGN_KEY)
    .digest('hex')

  const isValid = expectedSignature === payload.signature
  
  if (isValid) {
    console.log('✅ Signatur verifierad framgångsrikt')
  } else {
    console.error('❌ Ogiltig signatur:', {
      expected: expectedSignature,
      received: payload.signature,
      callback_id: payload.callback_id
    })
  }

  return isValid
}

// Logga webhook till databas
const logWebhookToDatabase = async (logEntry: WebhookLogEntry) => {
  try {
    const { error } = await supabase
      .from('oneflow_sync_log')
      .insert(logEntry)

    if (error) {
      console.error('❌ Fel vid loggning till databas:', error.message)
      throw error
    }

    console.log('💾 Webhook loggad till databas framgångsrikt')
  } catch (error) {
    console.error('❌ Databasfel vid webhook-loggning:', error)
    throw error
  }
}

// Processera specifika webhook events
const processWebhookEvents = async (payload: OneflowWebhookPayload) => {
  const contractId = payload.contract.id.toString()
  const eventTypes = payload.events.map(e => e.type)
  
  console.log(`🔄 Processar ${payload.events.length} events för kontrakt ${contractId}:`, eventTypes)

  // Här kan du lägga till specifik logik för olika event types
  for (const event of payload.events) {
    switch (event.type) {
      case 'contract.published':
        console.log('📧 Kontrakt publicerat för signering')
        break
        
      case 'contract.signed':
        console.log('✍️ Kontrakt signerat')
        break
        
      case 'contract.completed':
        console.log('✅ Kontrakt färdigställt')
        break
        
      case 'contract.rejected':
        console.log('❌ Kontrakt avvisat')
        break
        
      case 'contract.expired':
        console.log('⏰ Kontrakt har gått ut')
        break
        
      default:
        console.log(`🔔 Okänd event-typ: ${event.type}`)
    }
  }

  // TODO: Här kan du lägga till business logic, som:
  // - Uppdatera customer status i databasen
  // - Skicka notifikationer
  // - Trigga andra processer
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
    console.error('❌ Icke-POST request mottaget:', req.method)
    return res.status(405).json({ 
      success: false,
      error: 'Endast POST-anrop tillåtna' 
    })
  }

  let payload: OneflowWebhookPayload
  let contractId: string = 'unknown'

  try {
    console.log('📨 Oneflow webhook mottaget')

    // 1. Läs raw body
    const rawBody = await getRawBody(req)
    if (!rawBody) {
      throw new Error('Tom request body')
    }

    // 2. Parsa JSON payload
    try {
      payload = JSON.parse(rawBody)
      contractId = payload.contract.id.toString()
      console.log(`📦 Payload parsad för kontrakt ${contractId}, callback_id: ${payload.callback_id}`)
    } catch (parseError) {
      throw new Error('Ogiltig JSON i request body')
    }

    // 3. Verifiera signatur
    if (!verifySignature(payload)) {
      await logWebhookToDatabase({
        event_type: 'signature_verification_failed',
        oneflow_contract_id: contractId,
        status: 'error',
        details: { payload, error: 'Invalid signature' },
        error_message: 'Signaturverifiering misslyckades'
      })
      
      return res.status(401).json({ 
        success: false,
        error: 'Ogiltig signatur' 
      })
    }

    // 4. Logga inkommande webhook
    await logWebhookToDatabase({
      event_type: payload.events.map(e => e.type).join(', '),
      oneflow_contract_id: contractId,
      status: 'verified',
      details: payload
    })

    // 5. Processera events
    await processWebhookEvents(payload)

    // 6. Logga framgångsrik processering
    await logWebhookToDatabase({
      event_type: 'webhook_processed',
      oneflow_contract_id: contractId,
      status: 'processed',
      details: {
        events_processed: payload.events.length,
        callback_id: payload.callback_id
      }
    })

    console.log('✅ Webhook processad framgångsrikt')
    
    return res.status(200).json({
      success: true,
      message: 'Webhook processad framgångsrikt',
      contract_id: contractId,
      events_processed: payload.events.length
    })

  } catch (error: any) {
    console.error('❌ Webhook processing fel:', error)

    // Logga fel till databas
    try {
      await logWebhookToDatabase({
        event_type: 'webhook_error',
        oneflow_contract_id: contractId,
        status: 'error',
        details: { error: error.message, stack: error.stack },
        error_message: error.message
      })
    } catch (logError) {
      console.error('❌ Kunde inte logga fel till databas:', logError)
    }

    // Returnera fel-response
    if (error.message === 'Tom request body') {
      return res.status(400).json({ 
        success: false,
        error: 'Tom request body' 
      })
    }
    
    if (error.message === 'Ogiltig JSON i request body') {
      return res.status(400).json({ 
        success: false,
        error: 'Ogiltig JSON i request body' 
      })
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Internt serverfel vid webhook-processering',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
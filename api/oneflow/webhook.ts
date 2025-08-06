// api/oneflow/webhook.ts - Förbättrad Oneflow Webhook Handler med Contracts Integration
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fetch from 'node-fetch'
const { ALLOWED_TEMPLATE_IDS, getContractTypeFromTemplate } = require('../constants/oneflowTemplates')

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_SIGN_KEY = process.env.ONEFLOW_WEBHOOK_SECRET!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL!

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

// Interface för OneFlow kontrakt från API
interface OneflowContractDetails {
  id: number
  name: string
  state: string
  template: {
    id: number
    name: string
  }
  data_fields: Array<{
    custom_id: string
    value: string
  }>
  parties: Array<{
    type: 'company' | 'individual'
    name?: string
    identification_number?: string
    participants: Array<{
      name: string
      email: string
      signatory: boolean
    }>
  }>
  product_groups?: Array<{
    products: Array<{
      name: string
      description: string
      price_1: { amount: { amount: string } }
      quantity: { amount: number }
    }>
  }>
  created_time: string
  updated_time: string
}

// Interface för contract insert data
interface ContractInsertData {
  oneflow_contract_id: string
  source_type: 'manual'
  source_id: null
  type: 'contract' | 'offer'
  status: 'pending' | 'signed' | 'declined' | 'active' | 'ended' | 'overdue'
  template_id: string
  begone_employee_name?: string
  begone_employee_email?: string
  contract_length?: string
  start_date?: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  contact_address?: string
  company_name?: string
  organization_number?: string
  agreement_text?: string
  total_value?: number
  selected_products?: any
  customer_id?: string
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

// Hämta kontrakt-detaljer från OneFlow API
const fetchOneflowContractDetails = async (contractId: string): Promise<OneflowContractDetails | null> => {
  try {
    console.log('🔍 Hämtar kontrakt-detaljer från OneFlow API:', contractId)

    const response = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ OneFlow API-fel:', response.status, response.statusText)
      return null
    }

    const contractDetails = await response.json() as OneflowContractDetails
    console.log('✅ Kontrakt-detaljer hämtade:', contractDetails.name)
    
    return contractDetails

  } catch (error) {
    console.error('💥 Fel vid hämtning av kontrakt-detaljer:', error)
    return null
  }
}

// Kontrollera om kontrakt ska processas (inte draft eller oanvänd mall)
const shouldProcessContract = (details: OneflowContractDetails): boolean => {
  // Hoppa över draft-kontrakt
  if (details.state === 'draft') {
    console.log(`🚫 Hoppar över draft-kontrakt: ${details.id}`)
    return false
  }
  
  // Hoppa över kontrakt som inte använder våra mallar
  const templateId = details.template.id.toString()
  if (!ALLOWED_TEMPLATE_IDS.has(templateId)) {
    console.log(`🚫 Hoppar över kontrakt med oanvänd mall ${templateId}: ${details.id}`)
    return false
  }
  
  return true
}

// Extrahera data från OneFlow kontrakt och konvertera till vårt format
const parseContractDetailsToInsertData = (details: OneflowContractDetails): ContractInsertData => {
  // Mappa OneFlow state till våra statusar (draft är borttaget)
  const statusMapping: { [key: string]: ContractInsertData['status'] } = {
    'pending': 'pending', 
    'signed': 'signed',
    'declined': 'declined',
    'published': 'pending',
    'completed': 'active',
    'cancelled': 'declined',
    'expired': 'overdue'
  }

  // Bestäm typ baserat på template ID (mer tillförlitligt än namn)
  const contractType = getContractTypeFromTemplate(details.template.id.toString())
  const contractName = details.name || ''
  const templateName = details.template?.name || ''
  const isOffer = contractType === 'offer' || 
                  contractName.toLowerCase().includes('offert') || 
                  templateName.toLowerCase().includes('offert')
  
  // Extrahera data fields
  const dataFields = Object.fromEntries(
    details.data_fields.map(field => [field.custom_id, field.value])
  )

  // Hämta kontaktinformation från första party
  const firstParty = details.parties?.[0]
  const firstParticipant = firstParty?.participants?.[0]

  // Beräkna totalt värde från produkter
  let totalValue = 0
  if (details.product_groups) {
    for (const group of details.product_groups) {
      for (const product of group.products) {
        const price = parseFloat(product.price_1?.amount?.amount || '0')
        const quantity = product.quantity?.amount || 1
        totalValue += price * quantity
      }
    }
  }

  // Bygg agreement text från data fields
  const agreementParts = [
    dataFields['stycke-1'],
    dataFields['stycke-2'],
    dataFields['arbetsbeskrivning']
  ].filter(Boolean)

  return {
    oneflow_contract_id: details.id.toString(),
    source_type: 'manual',
    source_id: null,
    type: isOffer ? 'offer' : 'contract',
    status: statusMapping[details.state] || 'pending',
    template_id: details.template.id.toString(),
    
    // BeGone-information
    begone_employee_name: dataFields['anstalld'] || dataFields['vr-kontaktperson'],
    begone_employee_email: dataFields['e-post-anstlld'] || dataFields['vr-kontakt-mail'],
    contract_length: dataFields['avtalslngd'],
    start_date: dataFields['begynnelsedag'] || dataFields['utfrande-datum'],
    
    // Kontakt-information
    contact_person: dataFields['Kontaktperson'] || dataFields['kontaktperson'] || firstParticipant?.name,
    contact_email: dataFields['e-post-kontaktperson'] || dataFields['kontaktperson-e-post'] || firstParticipant?.email,
    contact_phone: dataFields['telefonnummer-kontaktperson'] || dataFields['tel-nr'],
    contact_address: dataFields['utforande-adress'] || dataFields['utfrande-adress'],
    company_name: dataFields['foretag'] || dataFields['kund'] || firstParty?.name,
    organization_number: dataFields['org-nr'] || dataFields['per--org-nr'] || firstParty?.identification_number,
    
    // Avtal/Offert-detaljer  
    agreement_text: agreementParts.join('\n\n'),
    total_value: totalValue > 0 ? totalValue : null,
    selected_products: details.product_groups || null,
    
    // Kundkoppling sätts senare vid signering
    customer_id: null
  }
}

// Spara eller uppdatera kontrakt i databasen
const saveOrUpdateContract = async (contractData: ContractInsertData): Promise<void> => {
  try {
    console.log('💾 Sparar/uppdaterar kontrakt i databas:', contractData.oneflow_contract_id)

    // Kontrollera om kontraktet redan finns
    const { data: existingContract, error: checkError } = await supabase
      .from('contracts')
      .select('id, status')
      .eq('oneflow_contract_id', contractData.oneflow_contract_id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existingContract) {
      // Uppdatera befintligt kontrakt
      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          ...contractData,
          updated_at: new Date().toISOString()
        })
        .eq('oneflow_contract_id', contractData.oneflow_contract_id)

      if (updateError) {
        throw updateError
      }

      console.log('✅ Kontrakt uppdaterat:', existingContract.id)
    } else {
      // Skapa nytt kontrakt
      const { error: insertError } = await supabase
        .from('contracts')
        .insert([contractData])

      if (insertError) {
        throw insertError
      }

      console.log('✅ Nytt kontrakt skapat för OneFlow ID:', contractData.oneflow_contract_id)
    }

  } catch (error) {
    console.error('💥 Fel vid sparande av kontrakt:', error)
    throw error
  }
}

// Automatisk kundregistrering vid signerat avtal
const createCustomerFromSignedContract = async (contractId: string): Promise<void> => {
  try {
    console.log('👤 Kontrollerar om kund ska skapas från signerat kontrakt:', contractId)

    // Hämta kontraktet från vår databas
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('oneflow_contract_id', contractId)
      .single()

    if (contractError || !contract) {
      console.log('⚠️ Inget kontrakt hittades i vår databas för:', contractId)
      return
    }

    // Endast för avtal (inte offerter) och endast om det inte redan har en customer_id
    if (contract.type !== 'contract' || contract.customer_id) {
      console.log('ℹ️ Hoppar över kundregistrering:', {
        type: contract.type,
        hasCustomer: !!contract.customer_id
      })
      return
    }

    if (!contract.contact_email || !contract.contact_person) {
      console.log('⚠️ Otillräcklig kontaktinformation för att skapa kund')
      return
    }

    // Kontrollera om kund redan finns
    let existingCustomerId = null
    
    if (contract.organization_number) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('org_number', contract.organization_number)
        .single()
      existingCustomerId = data?.id
    }

    if (!existingCustomerId) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('email', contract.contact_email)
        .single()
      existingCustomerId = data?.id
    }

    if (existingCustomerId) {
      // Länka kontraktet till befintlig kund
      await supabase
        .from('contracts')
        .update({ customer_id: existingCustomerId })
        .eq('id', contract.id)
      
      console.log('✅ Kontrakt länkat till befintlig kund:', existingCustomerId)
      return
    }

    // Skapa ny kund
    const customerData = {
      company_name: contract.company_name || contract.contact_person,
      org_number: contract.organization_number || '',
      contact_person: contract.contact_person,
      email: contract.contact_email,
      phone: contract.contact_phone || '',
      address: contract.contact_address || '',
      contract_type_id: '', // Behöver mappas
      clickup_list_id: '',
      clickup_list_name: 'Avtalskunder från OneFlow',
      is_active: true,
      contract_start_date: contract.start_date,
      contract_length_months: contract.contract_length ? parseInt(contract.contract_length) : null,
      total_contract_value: contract.total_value,
      contract_description: contract.agreement_text?.substring(0, 500),
      assigned_account_manager: contract.begone_employee_name,
      contract_status: 'active' as const,
      business_type: 'Avtalskund'
    }

    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert([customerData])
      .select('id')
      .single()

    if (customerError) {
      throw customerError
    }

    // Länka kontraktet till den nya kunden
    await supabase
      .from('contracts')
      .update({ customer_id: newCustomer.id })
      .eq('id', contract.id)

    console.log('✅ Ny kund skapad och kontrakt länkat:', newCustomer.id)

  } catch (error) {
    console.error('💥 Fel vid kundregistrering:', error)
    // Inte kritiskt - låt webhook fortsätta även om kundregistrering misslyckas
  }
}

// Processera specifika webhook events
const processWebhookEvents = async (payload: OneflowWebhookPayload) => {
  const contractId = payload.contract.id.toString()
  const eventTypes = payload.events.map(e => e.type)
  
  console.log(`🔄 Processar ${payload.events.length} events för kontrakt ${contractId}:`, eventTypes)

  // Hämta kontrakt-detaljer från OneFlow API (en gång för alla events)
  const contractDetails = await fetchOneflowContractDetails(contractId)
  
  // Kontrollera om vi ska processa detta kontrakt
  if (contractDetails && !shouldProcessContract(contractDetails)) {
    console.log('ℹ️ Kontrakt hoppas över - webhook-processering avbruten')
    return
  }
  
  // Processera varje event
  for (const event of payload.events) {
    console.log(`📋 Processar event: ${event.type}`)
    
    try {
      switch (event.type) {
        // Kontrakt-lifecycle events
        case 'contract:publish':
          console.log('📧 Kontrakt publicerat - sparar kontrakt-data')
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            contractData.status = 'pending'
            await saveOrUpdateContract(contractData)
          }
          break

        case 'contract:sign':
          console.log('✍️ Kontrakt signerat - uppdaterar status och skapar kund')
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            contractData.status = 'signed'
            await saveOrUpdateContract(contractData)
            
            // Automatisk kundregistrering för signerade avtal
            await createCustomerFromSignedContract(contractId)
          }
          break

        case 'contract:decline':
          console.log('❌ Kontrakt avvisat - uppdaterar status')
          await supabase
            .from('contracts')
            .update({ 
              status: 'declined',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:lifecycle_state:start':
          console.log('🚀 Kontrakt aktiverat')
          await supabase
            .from('contracts')
            .update({ 
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:lifecycle_state:end':
        case 'contract:lifecycle_state:terminate':
        case 'contract:lifecycle_state:cancel':
          console.log('🔚 Kontrakt avslutat/uppsagt')
          await supabase
            .from('contracts')
            .update({ 
              status: 'ended',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:signing_period_expire':
          console.log('⏰ Signeringsperiod gått ut')
          await supabase
            .from('contracts')
            .update({ 
              status: 'overdue',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:signing_period_revive':
          console.log('🔄 Signeringsperiod återaktiverad')
          await supabase
            .from('contracts')
            .update({ 
              status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:content_update':
          console.log('📝 Kontrakt-innehåll uppdaterat - uppdaterar data')
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData)
          }
          break

        case 'contract:delete':
          console.log('🗑️ Kontrakt borttaget')
          await supabase
            .from('contracts')
            .update({ 
              status: 'declined',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:lifecycle_state:new_period':
          console.log('🔄 Ny avtalsperiod')
          // Inga specifika åtgärder behövs
          break

        // Participant events
        case 'participant:create':
          console.log('👤 Deltagare tillagd')
          break

        case 'participant:sign':
          console.log('✍️ Deltagare signerat')
          // Status uppdateras redan av contract:sign
          break

        case 'participant:decline':
          console.log('❌ Deltagare avvisat')
          break

        case 'participant:first_visit':
          console.log('👁️ Första besök av deltagare')
          break

        // Data field & content events  
        case 'data_field:update':
          console.log('📊 Datafält uppdaterat - synkar data')
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData)
          }
          break

        // Product events
        case 'product:create':
        case 'product:update':
        case 'product:delete':
          console.log(`🛍️ Produkt ${event.type.split(':')[1]} - uppdaterar produktdata`)
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData)
          }
          break

        // Comment events
        case 'comment:create':
          console.log('💬 Kommentar tillagd')
          break

        // Party events
        case 'party:create':
        case 'party:update':
        case 'party:delete':
          console.log(`🏢 Part ${event.type.split(':')[1]} - uppdaterar partdata`)
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData)
          }
          break

        // Participant delivery/delegation events
        case 'participant:delivery_failure':
          console.log('📧 Leveransfel för deltagare')
          break

        case 'participant:delegate':
          console.log('👥 Deltagare delegerad')
          break

        case 'participant:update':
          console.log('👤 Deltagare uppdaterad')
          break

        case 'participant:delete':
          console.log('🗑️ Deltagare borttagen')
          break

        case 'participant:publish':
          console.log('📢 Deltagare publicerad')
          break

        case 'participant:signature_reset':
        case 'contract:signature_reset':
          console.log('🔄 Signatur återställd')
          await supabase
            .from('contracts')
            .update({ 
              status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        // Fallback för okända events
        default:
          console.log(`🔔 Okänd eller ej implementerad event-typ: ${event.type}`)
          // Spara ändå kontraktdata om vi har den
          if (contractDetails && event.type.startsWith('contract:')) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData)
          }
      }

    } catch (eventError) {
      console.error(`❌ Fel vid processering av event ${event.type}:`, eventError)
      // Fortsätt med nästa event även om ett event misslyckas
    }
  }

  console.log('✅ Alla events processade')
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
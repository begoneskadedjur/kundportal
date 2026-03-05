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
const ONEFLOW_USER_EMAIL = 'info@begone.se' // Centraliserad avsändare

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
  template?: {
    id: number
    name: string
  }
  // Alternativa platser där OneFlow kan spara template ID
  _private_ownerside?: {
    template_id?: number
    custom_id?: string
    [key: string]: any
  }
  template_id?: number // Direkt på root-objektet
  data_fields: Array<{
    custom_id?: string
    value: string
    _private_ownerside?: {
      custom_id?: string
      [key: string]: any
    }
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
  billing_email?: string
  billing_address?: string
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

// Logga webhook till databas (utan att stoppa processingen vid fel)
const logWebhookToDatabase = async (logEntry: WebhookLogEntry) => {
  try {
    // Säkerställ att vi har alla required fields
    const safeLogEntry = {
      event_type: logEntry.event_type || 'unknown',
      oneflow_contract_id: logEntry.oneflow_contract_id || 'unknown',
      status: logEntry.status || 'error',
      details: logEntry.details || {},
      error_message: logEntry.error_message || null,
      created_at: new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('oneflow_sync_log')
      .insert(safeLogEntry)

    if (error) {
      console.error('❌ Fel vid loggning till databas:', error.message)
      console.error('❌ Log entry som försöktes sparas:', safeLogEntry)
      console.warn('⚠️ Webhook-loggning misslyckades men fortsätter processering...')
      return // Fortsätt utan att kasta fel
    }

    console.log('💾 Webhook loggad till databas framgångsrikt')
  } catch (error) {
    console.error('❌ Databasfel vid webhook-loggning:', error)
    console.warn('⚠️ Webhook-loggning misslyckades men fortsätter processering...')
    // Kasta INTE error här - låt webhook-processingen fortsätta
  }
}

// Hämta kontrakt-detaljer från OneFlow API (med retry för timing-problem)
const fetchOneflowContractDetails = async (contractId: string, retryCount = 0, skipRetryForMissingTemplate = false): Promise<OneflowContractDetails | null> => {
  try {
    console.log(`🔍 Hämtar kontrakt-detaljer från OneFlow API: ${contractId} (försök ${retryCount + 1}/5)`)

    const response = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': 'info@begone.se',
        'Accept': 'application/json'
      }
    })

    console.log(`📡 OneFlow API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OneFlow API-fel:', response.status, response.statusText)
      console.error('❌ Error response:', errorText)
      return null
    }

    const contractDetails = await response.json() as OneflowContractDetails
    
    // Försök hitta template ID från olika platser där OneFlow kan spara den
    let templateId: number | null = null
    let templateName: string = 'Unknown'
    
    if (contractDetails?.template?.id) {
      templateId = contractDetails.template.id
      templateName = contractDetails.template.name || 'Unknown'
      console.log(`✅ Template ID hittad i standard plats: ${templateId}`)
    } else if (contractDetails?._private_ownerside?.template_id) {
      templateId = contractDetails._private_ownerside.template_id
      templateName = 'API Created Template'
      console.log(`✅ Template ID hittad i _private_ownerside: ${templateId}`)
    } else if (contractDetails?.template_id) {
      templateId = contractDetails.template_id
      templateName = 'Direct Template'
      console.log(`✅ Template ID hittad direkt på root: ${templateId}`)
    }
    
    console.log('📦 Raw contract details response:')
    console.log(`- ID: ${contractDetails?.id}`)
    console.log(`- Name: ${contractDetails?.name || 'N/A'}`)
    console.log(`- State: ${contractDetails?.state}`)
    console.log(`- Template ID (standard): ${contractDetails?.template?.id || 'SAKNAS'}`)
    console.log(`- Template ID (_private_ownerside): ${contractDetails?._private_ownerside?.template_id || 'SAKNAS'}`)
    console.log(`- Template ID (root): ${contractDetails?.template_id || 'SAKNAS'}`)
    console.log(`- ✅ SLUTLIG Template ID: ${templateId || 'SAKNAS'}`)
    console.log(`- Template name: ${templateName}`)

    if (!contractDetails) {
      console.error('❌ Kontrakt-detaljer är null eller undefined')
      return null
    }
    
    // Om vi hittade template ID, sätt den i standard-platsen för enklare hantering senare
    if (templateId && !contractDetails.template) {
      contractDetails.template = {
        id: templateId,
        name: templateName
      }
      console.log(`📝 Template info satt i standard plats för vidare processering`)
    }

    // Om template info FORTFARANDE saknas och vi inte ska skippa retry
    if (!templateId && !skipRetryForMissingTemplate && retryCount < 4) {
      const waitTime = (retryCount + 1) * 10000 // 10s, 20s, 30s, 40s
      console.log(`⏰ Template info saknas helt, väntar ${waitTime/1000} sekunder och försöker igen...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return await fetchOneflowContractDetails(contractId, retryCount + 1, skipRetryForMissingTemplate)
    }
    
    console.log('✅ Kontrakt-detaljer hämtade:', contractDetails.name || `ID ${contractDetails.id}`)
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
  
  // Hoppa över kontrakt utan template (anställningsavtal etc)
  const templateId = details.template?.id
  if (!templateId) {
    console.log(`🚫 Hoppar över kontrakt utan template: ${details.id}`)
    console.log(`ℹ️ Detta är normalt för contract:publish events`)
    console.log(`ℹ️ Kontraktet processas när contract:content_update kommer`)
    return false
  }
  
  // Hoppa över kontrakt som inte använder våra mallar
  if (!ALLOWED_TEMPLATE_IDS.has(templateId.toString())) {
    console.log(`🚫 Hoppar över kontrakt med oanvänd mall ${templateId}: ${details.id}`)
    console.log(`📌 Mall namn: ${details.template?.name || 'Okänd'}`)
    return false
  }
  
  console.log(`✅ Kontrakt godkänt för processering: ${details.id} (mall: ${templateId})`)
  return true
}

// Template field mapping - definierar ordningen på fält för varje mall
const TEMPLATE_FIELD_ORDER: { [templateId: string]: string[] } = {
  // Skadedjursavtal (8486368)
  '8486368': [
    'begynnelsedag',           // Index 0 - Startdatum
    'kontaktperson',           // Index 1 - Kontaktperson
    'foretag',                 // Index 2 - Företag
    'org-nr',                  // Index 3 - Org nummer
    'e-post-kontaktperson',    // Index 4 - E-post kontaktperson  
    'utforande-adress',        // Index 5 - Utförande adress
    'e-post-anstlld',          // Index 6 - E-post anställd
    'anstalld',                // Index 7 - Anställd
    'vr-kontakt-mail',         // Index 8 - Vår kontakt mail
    'tel-nr',                  // Index 9 - Telefonnummer
    'stycke-1',                // Index 10 - Stycke 1
    'avtalslngd',              // Index 11 - Avtalslängd
    'datum',                   // Index 12 - Datum
    'arbetsbeskrivning',       // Index 13 - Arbetsbeskrivning
    'stycke-2',                // Index 14 - Stycke 2
    'ovrig-info'               // Index 15 - Övrig info
  ],
  // Lägg till fler mallar här när vi vet deras fältordning
  '9324573': [], // Avtal Betesstationer - behöver mappas
  '8465556': [], // Avtal Betongstationer - behöver mappas
  '8462854': [], // Avtal Mekaniska fällor - behöver mappas
  '8732196': []  // Avtal Indikationsfällor - behöver mappas
}

// Extrahera data från OneFlow kontrakt och konvertera till vårt format
const parseContractDetailsToInsertData = (details: OneflowContractDetails): ContractInsertData => {
  // Mappa OneFlow state till våra statusar (draft är borttaget)
  const statusMapping: { [key: string]: ContractInsertData['status'] } = {
    'pending': 'pending',
    'signed': 'signed',
    'declined': 'declined',
    'overdue': 'overdue',
    'published': 'pending',
    'completed': 'active',
    'cancelled': 'declined',
    'canceled': 'declined',
    'expired': 'overdue'
  }

  // Bestäm typ baserat på template ID (mer tillförlitligt än namn)
  const contractType = details.template?.id ? getContractTypeFromTemplate(details.template.id.toString()) : null
  const contractName = details.name || ''
  const templateName = details.template?.name || ''
  const isOffer = contractType === 'offer' || 
                  contractName.toLowerCase().includes('offert') || 
                  templateName.toLowerCase().includes('offert')
  
  // Extrahera data fields - hantera både custom_id och index-baserad mappning
  let dataFields: { [key: string]: string } = {}
  
  // Kontrollera om vi har custom_ids
  const hasCustomIds = details.data_fields.some(field => 
    field.custom_id || field._private_ownerside?.custom_id
  )
  
  if (hasCustomIds) {
    // Använd custom_id om tillgänglig
    dataFields = Object.fromEntries(
      details.data_fields.map(field => {
        const customId = field.custom_id || field._private_ownerside?.custom_id || 'undefined'
        return [customId, field.value]
      }).filter(([customId]) => customId !== 'undefined')
    )
  } else {
    // Använd index-baserad mappning för API-skapade kontrakt
    const templateId = details.template?.id?.toString()
    const fieldOrder = TEMPLATE_FIELD_ORDER[templateId || '']
    
    if (fieldOrder && fieldOrder.length > 0) {
      console.log(`📝 Använder index-baserad mappning för mall ${templateId}`)
      details.data_fields.forEach((field, index) => {
        if (index < fieldOrder.length) {
          const fieldName = fieldOrder[index]
          dataFields[fieldName] = field.value || ''
          console.log(`  Mappat index ${index} → ${fieldName}: ${field.value || '(tomt)'}`)
        }
      })
    } else {
      console.log(`⚠️ Ingen fältordning definierad för mall ${templateId}`)
      // Fallback: använd index som nyckel
      details.data_fields.forEach((field, index) => {
        dataFields[`field_${index}`] = field.value || ''
      })
    }
  }
  
  // Debug: Logga alla tillgängliga data fields
  console.log('📋 Tillgängliga data fields från OneFlow:')
  Object.entries(dataFields).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value || '(tomt)'}`)
  })
  
  // Specifikt leta efter faktura-email med key eller extern nyckel
  const billingEmailKey = '101d137e-236c-43c9-bf11-d14749ac8f4b'
  const billingEmailExternKey = 'faktura-adress-pdf'
  
  // Hitta faktura-email från data fields
  let billingEmail: string | null = null
  let billingAddress: string | null = null
  
  // Först kolla med den exakta key
  if (dataFields[billingEmailKey]) {
    billingEmail = dataFields[billingEmailKey]
    console.log(`✅ Hittade faktura-email med key: ${billingEmail}`)
  }
  // Sedan kolla med extern nyckel
  else if (dataFields[billingEmailExternKey]) {
    billingEmail = dataFields[billingEmailExternKey]
    console.log(`✅ Hittade faktura-email med extern nyckel: ${billingEmail}`)
  }
  // Kolla också om det finns ett separat faktura-adress fält
  else if (dataFields['faktura-email'] || dataFields['billing-email']) {
    billingEmail = dataFields['faktura-email'] || dataFields['billing-email']
    console.log(`✅ Hittade faktura-email med alternativt namn: ${billingEmail}`)
  }
  
  // Leta efter faktura-adress
  if (dataFields['faktura-adress'] || dataFields['billing-address']) {
    billingAddress = dataFields['faktura-adress'] || dataFields['billing-address']
    console.log(`✅ Hittade faktura-adress: ${billingAddress}`)
  }
  
  console.log('📋 Parties från OneFlow:')
  details.parties?.forEach((party, index) => {
    console.log(`  Party ${index}: ${party.name} (${party.country})`)
    party.participants?.forEach(participant => {
      console.log(`    - ${participant.name} (${participant.email})`)
    })
  })
  
  // Helper-funktion för att hitta datafält med olika varianter av namn
  const findField = (...fieldNames: string[]): string | undefined => {
    for (const fieldName of fieldNames) {
      // Testa olika varianter av fältnamnet
      const variations = [
        fieldName,
        fieldName.toLowerCase(),
        fieldName.replace(/-/g, ''),
        fieldName.replace(/-/g, '_'),
        fieldName.replace(/_/g, '-')
      ]
      
      for (const variant of variations) {
        if (dataFields[variant] !== undefined) {
          console.log(`✅ Hittade fält: ${variant} = ${dataFields[variant]}`)
          return dataFields[variant]
        }
      }
    }
    console.log(`⚠️ Kunde inte hitta fält: ${fieldNames.join(', ')}`)
    return undefined
  }

  // Hämta kontaktinformation — prioritera motparten (inte BeGone)
  const firstParty = details.parties?.[0]
  const firstParticipant = firstParty?.participants?.[0]
  const counterParty = details.parties?.find((p: any) =>
    p.type !== 'owner' && !p.name?.toLowerCase().includes('begone')
  )
  const counterParticipant = counterParty?.participants?.[0]

  // Beräkna totalt värde från produkter
  let totalValue = 0
  console.log('💰 Beräknar produktvärde:')
  if (details.product_groups) {
    for (const group of details.product_groups) {
      console.log(`  Produktgrupp: ${group.name || 'Namnlös'}`)
      for (const product of group.products) {
        const price = parseFloat(product.price_1?.amount?.amount || '0')
        const quantity = product.quantity?.amount || 1
        const productTotal = price * quantity
        console.log(`    - ${product.name}: ${price} kr x ${quantity} = ${productTotal} kr`)
        totalValue += productTotal
      }
    }
  }
  console.log(`  💰 Totalt värde: ${totalValue} kr`)

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
    template_id: details.template?.id?.toString() || 'no_template',
    
    // BeGone-information
    begone_employee_name: findField('anstalld', 'anställd', 'vr-kontaktperson', 'vår-kontaktperson') || null,
    begone_employee_email: findField('e-post-anstlld', 'e-post-anstalld', 'e-post-anställd', 'vr-kontakt-mail', 'vår-kontakt-mail') || null,
    contract_length: findField('avtalslngd', 'avtalslängd', 'avtals-längd', 'contract-length') || null,
    start_date: findField('begynnelsedag', 'startdatum', 'start-date', 'utfrande-datum', 'utförande-datum') || null,
    
    // Kontakt-information (använd party/participant som fallback)
    contact_person: findField('Kontaktperson', 'kontaktperson', 'kontakt-person', 'contact-person') || counterParticipant?.name || firstParticipant?.name || null,
    contact_email: findField('e-post-kontaktperson', 'kontaktperson-e-post', 'contact-email', 'e-post') || counterParticipant?.email || firstParticipant?.email || null,
    contact_phone: findField('telefonnummer-kontaktperson', 'tel-nr', 'telefon', 'phone', 'telefonnummer') || counterParticipant?.phone_number || firstParticipant?.phone_number || null,
    contact_address: findField('utforande-adress', 'utförande-adress', 'adress', 'address', 'leveransadress') || null,
    company_name: findField('foretag', 'företag', 'kund', 'company', 'bolag') || counterParty?.name || counterParticipant?.name || null,
    organization_number: findField('org-nr', 'orgnr', 'per-org-nr', 'organisationsnummer') || counterParty?.identification_number || firstParty?.identification_number || null,
    
    // Avtal/Offert-detaljer  
    agreement_text: agreementParts.join('\n\n'),
    total_value: totalValue > 0 ? totalValue : null,
    selected_products: details.product_groups || null,
    
    // Fakturering
    billing_email: billingEmail || null,
    billing_address: billingAddress || null,
    
    // Kundkoppling sätts senare vid signering
    customer_id: null
  }
}

// Spara eller uppdatera kontrakt i databasen
const saveOrUpdateContract = async (contractData: ContractInsertData, options?: { preserveStatus?: boolean }): Promise<void> => {
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
      // Uppdatera befintligt kontrakt - bevara fält som sätts via create-contract API
      const { price_list_id, created_by_email, created_by_name, created_by_role, source_id, source_type, ...webhookData } = contractData as any

      // Skydda livscykel-status från att nedgraderas av content-events
      const LIFECYCLE_STATUSES = ['overdue', 'signed', 'declined', 'ended', 'active', 'trashed']
      if (options?.preserveStatus && LIFECYCLE_STATUSES.includes(existingContract.status)) {
        console.log(`🔒 Bevarar status '${existingContract.status}' — ignorerar inkommande '${webhookData.status}'`)
        delete webhookData.status
      }

      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          ...webhookData,
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

// === HJÄLPFUNKTIONER FÖR CUSTOMER CREATION ===

// Parsa kontraktslängd från text till månader
const parseContractLength = (lengthText: string | null): number => {
  if (!lengthText) return 12 // Default 1 år
  
  // Hantera enbart siffror (antar år om inget annat anges)
  if (/^\d+$/.test(lengthText.trim())) {
    const years = parseInt(lengthText.trim())
    console.log(`📅 Parsade kontraktslängd: ${years} år → ${years * 12} månader`)
    return years * 12
  }
  
  // Hantera text med "år"
  const yearMatch = lengthText.match(/(\d+)\s*år/i)
  if (yearMatch) {
    const years = parseInt(yearMatch[1])
    console.log(`📅 Parsade kontraktslängd: ${years} år → ${years * 12} månader`)
    return years * 12
  }
  
  // Hantera text med "månad"
  const monthMatch = lengthText.match(/(\d+)\s*månad/i)
  if (monthMatch) {
    const months = parseInt(monthMatch[1])
    console.log(`📅 Parsade kontraktslängd: ${months} månader`)
    return months
  }
  
  console.log(`⚠️ Kunde inte parsa kontraktslängd '${lengthText}', använder default 12 månader`)
  return 12 // Fallback
}

// Beräkna slutdatum för kontrakt
const calculateEndDate = (startDate: string | null, lengthText: string | null): string | null => {
  if (!startDate) return null
  
  const start = new Date(startDate)
  const months = parseContractLength(lengthText)
  start.setMonth(start.getMonth() + months)
  return start.toISOString().split('T')[0]
}

// Beräkna finansiella värden
const calculateFinancialValues = (oneflowTotalValue: number | null, lengthText: string | null) => {
  if (!oneflowTotalValue) return { annual_value: null, monthly_value: null }
  
  // OneFlow skickar redan årsvärdet (inte totalt kontraktsvärde)
  // Så vi behöver inte dividera med antal år
  const annualValue = oneflowTotalValue
  const monthlyValue = annualValue / 12
  
  console.log(`💰 Finansiella värden: Årsvärde=${annualValue}, Månadsvärde=${monthlyValue}`)
  
  return {
    annual_value: annualValue,
    monthly_value: monthlyValue
  }
}

// Generera produktsammanfattning från OneFlow produkter (hanterar nested product_groups)
const generateProductSummary = (productGroups: any[] | null): string | null => {
  if (!productGroups || !Array.isArray(productGroups)) return null
  
  const summaries: string[] = []
  
  // Iterera genom alla product_groups
  for (const group of productGroups) {
    // Kontrollera om det är en product_group med products array
    if (group.products && Array.isArray(group.products)) {
      for (const product of group.products) {
        const quantity = product.quantity?.amount || 1
        const name = product.name || 'Okänd produkt'
        summaries.push(`${quantity}st ${name}`)
      }
    } 
    // Fallback om strukturen är annorlunda (direkt produkt)
    else if (group.name) {
      const quantity = group.quantity?.amount || 1
      summaries.push(`${quantity}st ${group.name}`)
    }
  }
  
  return summaries.length > 0 ? summaries.join(', ') : null
}

// Extrahera service-detaljer från produkter
const extractServiceDetails = (productGroups: any[] | null): string | null => {
  if (!productGroups || !Array.isArray(productGroups)) return null
  
  const serviceDetails: string[] = []
  
  for (const group of productGroups) {
    if (group.products && Array.isArray(group.products)) {
      for (const product of group.products) {
        if (product.description) {
          serviceDetails.push(product.description)
        }
      }
    }
  }
  
  return serviceDetails.length > 0 ? serviceDetails.join('. ') : null
}

// Detektera service-frekvens från agreement_text och produkter
const detectServiceFrequency = (agreementText: string | null, productGroups: any[] | null): string | null => {
  const textToAnalyze = agreementText?.toLowerCase() || ''
  
  // Kontrollera vanliga frekvenser i texten
  if (textToAnalyze.includes('månadsvis') || textToAnalyze.includes('månatlig') || 
      textToAnalyze.includes('varje månad') || textToAnalyze.includes('per månad')) {
    return 'monthly'
  }
  
  if (textToAnalyze.includes('kvartalsvis') || textToAnalyze.includes('kvartal') || 
      textToAnalyze.includes('var tredje månad')) {
    return 'quarterly'
  }
  
  if (textToAnalyze.includes('halvårsvis') || textToAnalyze.includes('halvår') || 
      textToAnalyze.includes('var sjätte månad')) {
    return 'biannual'
  }
  
  if (textToAnalyze.includes('årsvis') || textToAnalyze.includes('årlig') || 
      textToAnalyze.includes('en gång per år')) {
    return 'annual'
  }
  
  if (textToAnalyze.includes('veckovis') || textToAnalyze.includes('varje vecka')) {
    return 'weekly'
  }
  
  if (textToAnalyze.includes('varannan vecka')) {
    return 'biweekly'
  }
  
  if (textToAnalyze.includes('vid behov') || textToAnalyze.includes('efter behov')) {
    return 'on_demand'
  }
  
  // Om inget hittas, anta månadsvis som standard för skadedjursavtal
  if (textToAnalyze.includes('regelbunden') || textToAnalyze.includes('kontinuerlig')) {
    return 'monthly'
  }
  
  return null
}

// Detektera företagstyp baserat på företagsnamn och produkter
const detectBusinessType = (companyName: string | null, products: any[] | null): string | null => {
  const companyNameLower = companyName?.toLowerCase() || ''
  
  // Detektera från företagsnamn
  if (companyNameLower.includes('bostadsrättsförening') || companyNameLower.includes('hsb')) {
    return 'housing_association'
  }
  if (companyNameLower.includes('restaurang') || companyNameLower.includes('kök')) {
    return 'restaurant'
  }
  if (companyNameLower.includes('hotell') || companyNameLower.includes('logi')) {
    return 'hotel'
  }
  if (companyNameLower.includes('skola') || companyNameLower.includes('förskola')) {
    return 'education'
  }
  
  // Detektera från produkter
  if (products && Array.isArray(products)) {
    const productNames = products.map(p => p.name?.toLowerCase() || '').join(' ')
    
    if (productNames.includes('restaurang') || productNames.includes('kök')) {
      return 'restaurant'
    }
    if (productNames.includes('hotell') || productNames.includes('logi')) {
      return 'hotel'
    }
  }
  
  return 'general'
}

// Mappa bransch från business_type
const mapToIndustryCategory = (businessType: string | null): string | null => {
  const mapping: { [key: string]: string } = {
    'housing_association': 'residential',
    'restaurant': 'commercial',
    'hotel': 'commercial',
    'education': 'public',
    'general': 'commercial'
  }
  
  return businessType ? mapping[businessType] || 'commercial' : null
}

// Beräkna kundstorlek baserat på kontraktsvärde
const calculateCustomerSize = (totalValue: number | null): 'small' | 'medium' | 'large' | null => {
  if (!totalValue) return null
  
  if (totalValue < 25000) return 'small'
  if (totalValue < 100000) return 'medium'
  return 'large'
}

// Kontrakttyp-mappning baserat på template ID
const getContractTypeName = (templateId: string | null): string | null => {
  const mapping: { [key: string]: string } = {
    '8486368': 'Skadedjursavtal',
    '8462854': 'Mekaniska fällor',
    '9324573': 'Betesstationer',
    '8465556': 'Betongstationer',
    '8732196': 'Indikationsfällor'
  }
  
  return templateId ? mapping[templateId] || 'Okänt avtal' : null
}

// === HUVUDFUNKTION FÖR CUSTOMER CREATION ===

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

    // KRITISK KONTROLL: Endast signerade avtal blir kunder
    if (contract.type !== 'contract' || contract.status !== 'signed') {
      console.log('ℹ️ Hoppar över kundregistrering:', {
        type: contract.type,
        status: contract.status,
        reason: 'Endast signerade avtal blir kunder'
      })
      return
    }

    // Kontrollera om kontrakt redan har en kund kopplad
    if (contract.customer_id) {
      console.log('ℹ️ Kontrakt har redan en kund kopplad:', contract.customer_id)
      return
    }

    // Validera att vi har minimum required data
    if (!contract.contact_email || !contract.company_name) {
      console.log('⚠️ Otillräcklig information för att skapa kund:', {
        hasEmail: !!contract.contact_email,
        hasCompanyName: !!contract.company_name
      })
      return
    }

    // Kontrollera om kund redan finns (baserat på OneFlow contract ID eller org nummer)
    let existingCustomerId = null
    
    // Kolla först efter oneflow_contract_id
    const { data: existingByOneflow } = await supabase
      .from('customers')
      .select('id')
      .eq('oneflow_contract_id', contractId)
      .single()
    
    if (existingByOneflow) {
      existingCustomerId = existingByOneflow.id
      console.log('✅ Kund finns redan med OneFlow contract ID:', existingCustomerId)
    }
    
    // Om inte hittat och vi har org nummer, kolla org nummer
    if (!existingCustomerId && contract.organization_number) {
      const { data: existingByOrg } = await supabase
        .from('customers')
        .select('id')
        .eq('organization_number', contract.organization_number)
        .single()
      
      if (existingByOrg) {
        existingCustomerId = existingByOrg.id
        console.log('✅ Kund finns redan med org nummer:', existingCustomerId)
      }
    }
    
    // Om inte hittat, kolla email
    if (!existingCustomerId) {
      const { data: existingByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('contact_email', contract.contact_email)
        .single()
      
      if (existingByEmail) {
        existingCustomerId = existingByEmail.id
        console.log('✅ Kund finns redan med email:', existingCustomerId)
      }
    }

    if (existingCustomerId) {
      // Länka kontraktet till befintlig kund
      await supabase
        .from('contracts')
        .update({ customer_id: existingCustomerId })
        .eq('id', contract.id)

      console.log('✅ Kontrakt länkat till befintlig kund:', existingCustomerId)

      // Tilldela kundnummer om kunden saknar ett och kontraktet har customer_group_id
      if (contract.customer_group_id) {
        try {
          const { data: existingCust } = await supabase
            .from('customers')
            .select('customer_number')
            .eq('id', existingCustomerId)
            .single()

          if (existingCust && !existingCust.customer_number) {
            const { data: customerNumber, error: allocError } = await supabase
              .rpc('allocate_customer_number', { p_group_id: contract.customer_group_id })

            if (!allocError && customerNumber) {
              await supabase
                .from('customers')
                .update({
                  customer_group_id: contract.customer_group_id,
                  customer_number: customerNumber
                })
                .eq('id', existingCustomerId)
              console.log(`✅ Kundnummer ${customerNumber} tilldelat befintlig kund ${existingCustomerId}`)
            }
          }
        } catch (numError) {
          console.error('⚠️ Kunde inte tilldela kundnummer till befintlig kund:', numError)
        }
      }

      return
    }

    // === SKAPA NY KUND MED KOMPLETT DATA ===
    
    console.log('📋 Skapar ny avtalskund från kontrakt:', {
      oneflow_id: contractId,
      company: contract.company_name,
      template: contract.template_id,
      value: contract.total_value
    })

    // Beräkna alla värden
    // OBS: contract.total_value från OneFlow är årsvärdet, inte totalt kontraktsvärde
    const annualValue = contract.total_value ? parseFloat(contract.total_value.toString()) : null
    const monthlyValue = annualValue ? annualValue / 12 : null
    const contractYears = parseContractLength(contract.contract_length) / 12
    const totalContractValue = annualValue && contractYears ? annualValue * contractYears : null
    
    console.log(`💰 Korrigerade finansiella beräkningar:`)
    console.log(`  - Årsvärde från OneFlow: ${annualValue} kr`)
    console.log(`  - Antal år: ${contractYears}`)
    console.log(`  - Totalt kontraktsvärde: ${totalContractValue} kr (${annualValue} × ${contractYears})`)
    console.log(`  - Månadsvärde: ${monthlyValue} kr`)
    
    const businessType = detectBusinessType(contract.company_name, contract.selected_products)
    const productSummary = generateProductSummary(contract.selected_products)
    const serviceDetails = extractServiceDetails(contract.selected_products)
    const serviceFrequency = detectServiceFrequency(contract.agreement_text, contract.selected_products)
    const contractEndDate = calculateEndDate(contract.start_date, contract.contract_length)
    
    const customerData = {
      // Basic Customer Information
      company_name: contract.company_name!,
      organization_number: contract.organization_number,
      contact_person: contract.contact_person,
      contact_email: contract.contact_email!,
      contact_phone: contract.contact_phone,
      contact_address: contract.contact_address,
      
      // Billing Information - kopierat från contract
      billing_email: contract.billing_email || contract.contact_email, // Fallback till contact_email om billing_email saknas
      billing_address: contract.billing_address || contract.contact_address, // Fallback till contact_address
      
      // OneFlow Contract Linking
      oneflow_contract_id: contractId,
      created_from_contract_id: contract.id,
      
      // Contract Details
      contract_template_id: contract.template_id,
      contract_type: getContractTypeName(contract.template_id),
      contract_status: 'signed' as const,
      contract_length: contract.contract_length,
      contract_start_date: contract.start_date,
      contract_end_date: contractEndDate,
      
      // Financial Information
      total_contract_value: totalContractValue,
      annual_value: annualValue,
      monthly_value: monthlyValue,
      currency: 'SEK',
      
      // Agreement Content
      agreement_text: contract.agreement_text,
      products: contract.selected_products,
      product_summary: productSummary,
      service_details: serviceDetails,
      
      // Account Management
      assigned_account_manager: contract.begone_employee_name,
      account_manager_email: contract.begone_employee_email,
      // Använd begone_employee som fallback för sales_person om created_by saknas
      sales_person: contract.created_by_name || contract.begone_employee_name,
      sales_person_email: contract.created_by_email || contract.begone_employee_email,
      
      // Business Intelligence
      business_type: businessType,
      industry_category: mapToIndustryCategory(businessType),
      customer_size: calculateCustomerSize(totalContractValue),
      service_frequency: serviceFrequency,
      
      // Prislista från wizard
      price_list_id: contract.price_list_id || null,

      // Metadata
      source_type: 'oneflow' as const,
      is_active: true
    }

    console.log('💾 Sparar ny kund med data:', {
      company_name: customerData.company_name,
      business_type: customerData.business_type,
      total_value: customerData.total_contract_value,
      annual_value: customerData.annual_value,
      monthly_value: customerData.monthly_value,
      contract_type: customerData.contract_type,
      customer_size: customerData.customer_size
    })

    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert([customerData])
      .select('id')
      .single()

    if (customerError) {
      console.error('❌ Fel vid skapande av kund:', customerError)
      throw customerError
    }

    // Länka kontraktet till den nya kunden
    const { error: linkError } = await supabase
      .from('contracts')
      .update({ customer_id: newCustomer.id })
      .eq('id', contract.id)

    if (linkError) {
      console.error('❌ Fel vid länkning av kontrakt till kund:', linkError)
      throw linkError
    }

    console.log('✅ Ny avtalskund skapad och länkad:', {
      customer_id: newCustomer.id,
      contract_id: contract.id,
      company: customerData.company_name,
      value: customerData.total_contract_value
    })

    // Tilldela kundnummer från kundgrupp om det finns
    if (contract.customer_group_id) {
      try {
        const { data: customerNumber, error: allocError } = await supabase
          .rpc('allocate_customer_number', { p_group_id: contract.customer_group_id })

        if (!allocError && customerNumber) {
          await supabase
            .from('customers')
            .update({
              customer_group_id: contract.customer_group_id,
              customer_number: customerNumber
            })
            .eq('id', newCustomer.id)
          console.log(`✅ Kundnummer ${customerNumber} tilldelat ny kund ${newCustomer.id}`)
        } else if (allocError) {
          console.error('⚠️ Kunde inte tilldela kundnummer:', allocError.message)
        }
      } catch (numError) {
        console.error('⚠️ Fel vid kundnummerallokering:', numError)
      }
    }

  } catch (error) {
    console.error('💥 Fel vid kundregistrering för kontrakt', contractId, ':', error)
    // Inte kritiskt - låt webhook fortsätta även om kundregistrering misslyckas
  }
}

// Logga Oneflow-händelse som systemevent i ärendets kommunikationspanel
const logOfferEventToCase = async (
  contractId: string,
  eventMessage: string
): Promise<void> => {
  try {
    // Hämta kontraktet från DB via oneflow_contract_id
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, source_id, source_type, type, begone_employee_email')
      .eq('oneflow_contract_id', contractId)
      .single()

    if (contractError || !contract) {
      console.log('ℹ️ Ingen kontrakt hittad för systemevent-loggning:', contractId)
      return
    }

    // Bara logga om offerten skapades från ett ärende
    if (!contract.source_id) {
      console.log('ℹ️ Offert saknar source_id — inget ärende att logga till')
      return
    }

    // Bestäm case_type — source_type är 'legacy_case' för cases-tabellen
    // Prova cases-tabellen först
    let caseType: string = 'contract'
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', contract.source_id)
      .maybeSingle()

    if (!caseRow) {
      // Prova private_cases
      const { data: privateRow } = await supabase
        .from('private_cases')
        .select('id')
        .eq('id', contract.source_id)
        .maybeSingle()
      if (privateRow) {
        caseType = 'private'
      } else {
        // Prova business_cases
        const { data: businessRow } = await supabase
          .from('business_cases')
          .select('id')
          .eq('id', contract.source_id)
          .maybeSingle()
        if (businessRow) {
          caseType = 'business'
        } else {
          console.log('⚠️ Kunde inte hitta ärende för source_id:', contract.source_id)
          return
        }
      }
    }

    // Slå upp author_id från teknikerns profil
    let authorId: string | null = null
    if (contract.begone_employee_email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', contract.begone_employee_email)
        .single()
      if (profile) authorId = profile.user_id
    }
    // Fallback till admin om teknikerprofil inte hittas
    if (!authorId) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single()
      if (adminProfile) authorId = adminProfile.user_id
    }
    if (!authorId) {
      console.error('❌ Ingen author_id hittad för systemkommentar')
      return
    }

    // Skapa systemevent i case_comments
    const { error: commentError } = await supabase
      .from('case_comments')
      .insert({
        case_id: contract.source_id,
        case_type: caseType,
        author_id: authorId,
        content: eventMessage,
        is_system_comment: true,
        system_event_type: 'status_change',
        author_name: 'Oneflow',
        author_role: 'admin',
      })

    if (commentError) {
      console.error('❌ Kunde inte logga systemevent till case_comments:', commentError)
    } else {
      console.log('✅ Oneflow-händelse loggad till kommunikationspanelen:', eventMessage)
    }
  } catch (error) {
    console.error('❌ Fel vid logOfferEventToCase:', error)
    // Inte kritiskt — låt webhook fortsätta
  }
}

// Logga Oneflow-händelse till event_log (system-wide audit för aktivitetsflöde)
const logOfferEventToEventLog = async (
  contractId: string,
  eventType: 'offer_sent' | 'offer_signed' | 'offer_declined' | 'offer_expired' | 'offer_deleted',
  description: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const { data: contract } = await supabase
      .from('contracts')
      .select('id, company_name, contact_person, begone_employee_name, begone_employee_email, source_id')
      .eq('oneflow_contract_id', contractId)
      .single()

    if (!contract) return

    // Slå upp teknikerns user_id (UUID) för performed_by_id
    let performedById: string | null = null
    if (contract.begone_employee_email) {
      const { data: techProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', contract.begone_employee_email)
        .single()
      if (techProfile) performedById = techProfile.user_id
    }

    await supabase.from('event_log').insert({
      event_type: eventType,
      description,
      case_id: contract.id,
      case_type: 'contract',
      case_title: contract.company_name || contract.contact_person || 'Okänd',
      metadata: {
        ...metadata,
        oneflow_contract_id: contractId,
        source_id: contract.source_id,
        technician_email: contract.begone_employee_email,
        technician_name: contract.begone_employee_name,
      },
      performed_by_id: performedById,
      performed_by_name: contract.begone_employee_name || 'Oneflow',
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('logOfferEventToEventLog error:', err)
  }
}

// Uppdatera ärendestatus baserat på source_id-koppling
// Provar cases → private_cases → business_cases (samma mönster som logOfferEventToCase)
const updateCaseStatusViaSourceId = async (
  contractId: string,
  newStatus: string,
  extraFields?: Record<string, any>
): Promise<void> => {
  try {
    const { data: contract } = await supabase
      .from('contracts')
      .select('source_id, source_type')
      .eq('oneflow_contract_id', contractId)
      .single()

    if (!contract?.source_id) return

    const updateData: Record<string, any> = { status: newStatus, ...extraFields }

    // Prova cases först (legacy)
    const { data: caseRow } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', contract.source_id)
      .select('id')
      .maybeSingle()

    if (caseRow) {
      console.log(`✅ Ärendestatus uppdaterad till '${newStatus}' i cases`)
      return
    }

    // Prova private_cases
    const { data: privateRow } = await supabase
      .from('private_cases')
      .update(updateData)
      .eq('id', contract.source_id)
      .select('id')
      .maybeSingle()

    if (privateRow) {
      console.log(`✅ Ärendestatus uppdaterad till '${newStatus}' i private_cases`)
      return
    }

    // Prova business_cases
    const { data: businessRow } = await supabase
      .from('business_cases')
      .update(updateData)
      .eq('id', contract.source_id)
      .select('id')
      .maybeSingle()

    if (businessRow) {
      console.log(`✅ Ärendestatus uppdaterad till '${newStatus}' i business_cases`)
      return
    }

    console.log(`⚠️ Kunde inte hitta ärende med source_id: ${contract.source_id}`)
  } catch (error) {
    console.error('❌ Fel vid updateCaseStatusViaSourceId:', error)
  }
}

// Invalidera offer_statistics cache (tvingar nästa GET att hämta nytt)
const invalidateOfferStatsCache = async () => {
  try {
    const { error } = await supabase
      .from('offer_statistics')
      .update({ last_synced_at: '1970-01-01T00:00:00Z' })
      .eq('period', 'all_time')

    if (error) {
      console.warn('⚠️ Kunde inte invalidera offer_statistics cache:', error.message)
    } else {
      console.log('🔄 offer_statistics cache invaliderad')
    }
  } catch (err) {
    console.warn('⚠️ Fel vid cache-invalidering:', err)
  }
}

// Processera specifika webhook events
const processWebhookEvents = async (payload: OneflowWebhookPayload) => {
  const contractId = payload.contract.id.toString()
  const eventTypes = payload.events.map(e => e.type)
  
  console.log(`🔄 Processar ${payload.events.length} events för kontrakt ${contractId}:`, eventTypes)

  // Bestäm om vi ska hämta kontrakt-detaljer baserat på event-typ
  let contractDetails: OneflowContractDetails | null = null
  const needsFullData = eventTypes.some(type => 
    ['contract:publish', 'contract:content_update', 'contract:sign', 'data_field:update', 
     'product:create', 'product:update', 'product:delete',
     'party:create', 'party:update', 'party:delete'].includes(type)
  )
  
  // För vissa events behöver vi inte template-info (endast create)
  const skipRetryForTemplate = eventTypes.some(type => 
    ['contract:create'].includes(type)
  )
  
  if (needsFullData) {
    console.log('📊 Events kräver full data - hämtar kontrakt-detaljer')
    console.log(`📋 Event types som triggar datahämtning: ${eventTypes.filter(t => needsFullData).join(', ')}`)
    contractDetails = await fetchOneflowContractDetails(contractId, 0, skipRetryForTemplate)
    
    // Kontrollera om vi ska processa detta kontrakt
    if (contractDetails && !shouldProcessContract(contractDetails)) {
      console.log('ℹ️ Kontrakt använder inte godkänd mall - webhook-processering avbruten')
      console.log(`📌 Mall ID: ${contractDetails.template?.id}, Godkända: ${Array.from(ALLOWED_TEMPLATE_IDS).join(', ')}`)
      return
    }
  } else {
    console.log('ℹ️ Events kräver inte full data - skippar API-anrop')
    console.log(`📋 Event types som INTE kräver data: ${eventTypes.join(', ')}`)
  }
  
  // Processera varje event
  for (const event of payload.events) {
    console.log(`📋 Processar event: ${event.type}`)
    
    try {
      switch (event.type) {
        // Kontrakt-lifecycle events
        case 'contract:create':
          console.log('📄 Nytt kontrakt skapat')
          console.log('ℹ️ Skippar processering - väntar på contract:content_update för full data')
          // Vi processar INTE contract:create då template info ofta saknas
          break
          
        case 'contract:publish':
          console.log('📧 Kontrakt publicerat (draft → pending)')
          console.log('📝 Processar och sparar kontrakt med status pending')
          
          // Nu när workplace ID är fixat bör all data vara tillgänglig
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            contractData.status = 'pending' // Kontrakt är skickat men inte signerat
            await saveOrUpdateContract(contractData)
            console.log('✅ Kontrakt sparat med status pending - syns nu i contracts-overview')

            // Invalidera offer-statistik cache vid ny offert
            if (contractData.type === 'offer') {
              await invalidateOfferStatsCache()
            }

            // NYTT: Identifiera och koppla kund för offerten
            if (contractData.type === 'offer' && contractData.company_name) {
              let customerId = null
              
              console.log('🔍 Söker efter befintlig kund för:', {
                company: contractData.company_name,
                email: contractData.contact_email,
                org: contractData.organization_number
              })
              
              // Sök efter befintlig kund
              // 1. Baserat på organisationsnummer
              if (contractData.organization_number) {
                const { data: customerByOrg } = await supabase
                  .from('customers')
                  .select('id')
                  .eq('organization_number', contractData.organization_number)
                  .single()
                
                if (customerByOrg) {
                  customerId = customerByOrg.id
                  console.log('✅ Kund hittad via org.nr:', customerId)
                }
              }
              
              // 2. Om inte hittat, sök på email
              if (!customerId && contractData.contact_email) {
                const { data: customerByEmail } = await supabase
                  .from('customers')
                  .select('id')
                  .eq('contact_email', contractData.contact_email)
                  .single()
                
                if (customerByEmail) {
                  customerId = customerByEmail.id
                  console.log('✅ Kund hittad via email:', customerId)
                }
              }
              
              // 3. Om inte hittat, sök på företagsnamn
              if (!customerId && contractData.company_name) {
                const { data: customerByName } = await supabase
                  .from('customers')
                  .select('id')
                  .eq('company_name', contractData.company_name)
                  .single()
                
                if (customerByName) {
                  customerId = customerByName.id
                  console.log('✅ Kund hittad via företagsnamn:', customerId)
                }
              }
              
              // Uppdatera kontraktet med customer_id
              if (customerId) {
                const { error: customerLinkError } = await supabase
                  .from('contracts')
                  .update({ 
                    customer_id: customerId,
                    updated_at: new Date().toISOString()
                  })
                  .eq('oneflow_contract_id', contractId)
                
                if (customerLinkError) {
                  console.error('⚠️ Kunde inte koppla kund:', customerLinkError)
                } else {
                  console.log('✅ Offert kopplat till kund:', customerId)
                }
              } else {
                console.log('⚠️ Ingen befintlig kund hittades för:', contractData.company_name)
                // För offerter: Vi skapar INTE ny kund här
                // Kund skapas endast när avtal signeras
              }
            }
            
            // Koppla offert till ärende via source_id (satt vid skapande i create-contract API)
            const { data: contractForLink } = await supabase
              .from('contracts')
              .select('source_id')
              .eq('oneflow_contract_id', contractId)
              .single()

            if (contractForLink?.source_id) {
              console.log(`🔗 Kopplar offert/kontrakt till ärende via source_id: ${contractForLink.source_id}`)
              const { error: caseUpdateError } = await supabase
                .from('cases')
                .update({
                  oneflow_contract_id: contractId,
                  quote_status: contractData.type === 'offer' ? 'sent' : 'pending',
                  quote_sent_at: new Date().toISOString(),
                  quote_generated_at: contractDetails.created_time || new Date().toISOString()
                })
                .eq('id', contractForLink.source_id)

              if (caseUpdateError) {
                console.error('❌ Kunde inte koppla offert till ärende:', caseUpdateError)
              } else {
                console.log('✅ Offert/kontrakt kopplat till ärende via source_id')
              }
            } else {
              // Fallback: Försök hitta case_id i Oneflow data fields (legacy)
              const caseIdField = contractDetails.data_fields?.find(field =>
                field.custom_id === 'case_id' ||
                field._private_ownerside?.custom_id === 'case_id'
              )
              if (caseIdField?.value) {
                console.log(`🔗 Kopplar offert till ärende via Oneflow data field: ${caseIdField.value}`)
                await supabase
                  .from('cases')
                  .update({
                    oneflow_contract_id: contractId,
                    quote_status: contractData.type === 'offer' ? 'sent' : 'pending',
                    quote_sent_at: new Date().toISOString(),
                  })
                  .eq('id', caseIdField.value)
              }
            }

            // Logga systemevent till ärendets kommunikationspanel
            const recipientName = contractDetails.parties?.[1]?.participants?.[0]?.name
              || contractData.contact_person || contractData.company_name || 'mottagare'
            await logOfferEventToCase(contractId, `📄 Offert skickad till ${recipientName}`)
            await logOfferEventToEventLog(contractId, 'offer_sent', `Offert skickad till ${recipientName}`)
          } else {
            console.log('⚠️ Kontraktdetaljer saknas för publish event')
          }
          break

        case 'contract:sign':
          console.log('✍️ Kontrakt signerat - uppdaterar status och skapar kund')
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            contractData.status = 'signed'
            await saveOrUpdateContract(contractData)

            // Uppdatera offerstatus i cases om koppling finns
            const { error: caseUpdateError } = await supabase
              .from('cases')
              .update({
                quote_status: 'signed',
                quote_signed_at: new Date().toISOString()
              })
              .eq('oneflow_contract_id', contractId)

            if (!caseUpdateError) {
              console.log('✅ Offerstatus uppdaterad till signerad i ärende')
            }

            // Uppdatera contracts-tabellen också (för offerter som blir signerade)
            const { error: contractUpdateError } = await supabase
              .from('contracts')
              .update({
                status: 'signed',
                updated_at: new Date().toISOString()
              })
              .eq('oneflow_contract_id', contractId)
              .eq('type', 'offer') // Endast för offerter

            if (!contractUpdateError) {
              console.log('✅ Offertstatus uppdaterad till signerad i contracts')
            }

            // Invalidera offer-statistik cache vid signering
            await invalidateOfferStatsCache()

            // Automatisk kundregistrering för signerade avtal
            await createCustomerFromSignedContract(contractId)

            // Uppdatera ärendets huvudstatus till bokningsbar (för offerter)
            if (contractData.type === 'offer') {
              await updateCaseStatusViaSourceId(contractId, 'Offert signerad - boka in')
            }

            // Logga systemevent till kommunikationspanelen
            const signerName = contractDetails.parties?.[1]?.participants?.find(p => p.signatory)?.name
              || contractData.contact_person || contractData.company_name || 'mottagare'
            await logOfferEventToCase(contractId, `✅ Offert signerad av ${signerName}`)
            await logOfferEventToEventLog(contractId, 'offer_signed', `Offert signerad av ${signerName}`)
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

          // Uppdatera offerstatus i cases om koppling finns
          await supabase
            .from('cases')
            .update({
              quote_status: 'rejected',
              quote_rejected_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)

          // Invalidera offer-statistik cache vid avvisning
          await invalidateOfferStatsCache()

          // Logga systemevent
          await logOfferEventToCase(contractId, '❌ Offert nekad av mottagaren')
          await logOfferEventToEventLog(contractId, 'offer_declined', 'Offert nekad av mottagaren')
          break

        case 'contract:lifecycle_state:start':
          console.log('🚀 Kontrakt aktiverat - uppdaterar kontrakt och kund status')
          await supabase
            .from('contracts')
            .update({ 
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          
          // Uppdatera även kund status till active
          await supabase
            .from('customers')
            .update({
              contract_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:lifecycle_state:end':
        case 'contract:lifecycle_state:terminate':
        case 'contract:lifecycle_state:cancel':
          console.log('🔚 Kontrakt avslutat/uppsagt - uppdaterar kontrakt och kund status')
          await supabase
            .from('contracts')
            .update({ 
              status: 'ended',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          
          // Uppdatera även kund status till terminated
          await supabase
            .from('customers')
            .update({
              contract_status: 'terminated',
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)
          break

        case 'contract:signing_period_expire':
          console.log('⏰ Signeringsperiod gått ut - uppdaterar status')
          await supabase
            .from('contracts')
            .update({
              status: 'overdue',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)

          // Uppdatera även kund status till expired
          await supabase
            .from('customers')
            .update({
              contract_status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('oneflow_contract_id', contractId)

          // Invalidera offer-statistik cache vid utgånget
          await invalidateOfferStatsCache()

          // Logga systemevent
          await logOfferEventToCase(contractId, '⏰ Offertens giltighetstid har gått ut')
          await logOfferEventToEventLog(contractId, 'offer_expired', 'Offertens giltighetstid har gått ut')
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
          console.log('📝 Kontrakt-innehåll uppdaterat - NU processar vi full data!')
          // Detta är den primära event för att skapa/uppdatera kontrakt
          // Här har OneFlow garanterat all data tillgänglig
          if (!contractDetails) {
            console.log('🔄 Hämtar kontrakt-detaljer för content_update event...')
            // Hämta detaljer igen specifikt för detta event med full retry
            contractDetails = await fetchOneflowContractDetails(contractId, 0, false)
          }
          
          if (contractDetails) {
            console.log('✅ Processar kontrakt med fullständig data')
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData, { preserveStatus: true })
          } else {
            console.error('❌ Kunde inte hämta kontrakt-detaljer för content_update')
          }
          break

        case 'contract:delete':
          console.log('🗑️ Kontrakt borttaget/papperskorgen')
          await supabase
            .from('contracts')
            .update({
              status: 'trashed',
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
            await saveOrUpdateContract(contractData, { preserveStatus: true })
          }
          break

        // Product events
        case 'product:create':
        case 'product:update':
        case 'product:delete':
          console.log(`🛍️ Produkt ${event.type.split(':')[1]} - uppdaterar produktdata`)
          if (contractDetails) {
            const contractData = parseContractDetailsToInsertData(contractDetails)
            await saveOrUpdateContract(contractData, { preserveStatus: true })
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
            await saveOrUpdateContract(contractData, { preserveStatus: true })
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
            await saveOrUpdateContract(contractData, { preserveStatus: true })
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

    // 4. Logga inkommande webhook (men stoppa inte vid fel)
    try {
      await logWebhookToDatabase({
        event_type: payload.events.map(e => e.type).join(', '),
        oneflow_contract_id: contractId,
        status: 'verified',
        details: payload
      })
    } catch (logError) {
      console.warn('⚠️ Kunde inte logga webhook till databas, men fortsätter processering')
    }

    // 5. Processera events - DETTA ÄR DET VIKTIGA!
    await processWebhookEvents(payload)

    // 6. Logga framgångsrik processering (men stoppa inte vid fel)
    try {
      await logWebhookToDatabase({
        event_type: 'webhook_processed',
        oneflow_contract_id: contractId,
        status: 'processed',
        details: {
          events_processed: payload.events.length,
          callback_id: payload.callback_id
        }
      })
    } catch (logError) {
      console.warn('⚠️ Kunde inte logga framgång till databas, men processering lyckades')
    }

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
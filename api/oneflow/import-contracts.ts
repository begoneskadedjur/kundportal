// api/oneflow/import-contracts.ts - Importera befintliga OneFlow-kontrakt till Supabase
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
const { ALLOWED_TEMPLATE_IDS, getContractTypeFromTemplate } = require('../constants/oneflowTemplates')

// Exakta fältmappningar baserat på OneFlow export-fält från OneflowContractCreator
const CONTRACT_FIELD_MAPPING = {
  // BeGone information
  'anstalld': 'begone_employee_name',
  'e-post-anstlld': 'begone_employee_email',
  'avtalslngd': 'contract_length',
  'begynnelsedag': 'start_date',
  
  // Kontaktinformation
  'Kontaktperson': 'contact_person',
  'e-post-kontaktperson': 'contact_email',
  'telefonnummer-kontaktperson': 'contact_phone',
  'utforande-adress': 'contact_address',
  
  // Företagsinformation
  'foretag': 'company_name',
  'org-nr': 'organization_number',
  
  // Avtalstext (kombineras till agreement_text)
  'avtalsobjekt': 'agreement_text_main', // Huvudavtalstext 
  'stycke-1': 'agreement_text_part1',
  'stycke-2': 'agreement_text_part2', 
  'stycke-3': 'agreement_text_part3',
  'stycke-4': 'agreement_text_part4',
  
  // Automatiskt genererade fält
  'dokument-skapat': 'document_created_date',
  'faktura-adress-pdf': 'invoice_email'
}

const OFFER_FIELD_MAPPING = {
  // BeGone information (mappade från contract → offer)
  'vr-kontaktperson': 'begone_employee_name',
  'vr-kontakt-mail': 'begone_employee_email',
  
  // Kontaktinformation (mappade)
  'kontaktperson': 'contact_person',
  'kontaktperson-e-post': 'contact_email',
  'tel-nr': 'contact_phone',
  'utfrande-adress': 'contact_address',
  
  // Företagsinformation (mappade)
  'kund': 'company_name',
  'per--org-nr': 'organization_number',
  
  // Datum och avtalstext
  'utfrande-datum': 'start_date',
  'arbetsbeskrivning': 'agreement_text',
  
  // Offertspecifika fält
  'offert-skapad': 'document_created_date',
  'epost-faktura': 'invoice_email',
  'faktura-referens': 'invoice_reference',
  'mrkning-av-faktura': 'invoice_marking'
}

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
// OneFlow-variabler läses direkt i handler-funktionen för att undvika top-level scope problem

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Beräkna totalt avtalsvärde med avtalslängd-multiplikation
const calculateContractTotalValue = (baseValue: number, contractLength: string | undefined): number | null => {
  if (!baseValue || baseValue <= 0) return null
  
  // Parsa avtalslängd från text (ex: "1 år", "2 år", "3 år")
  if (!contractLength) {
    console.log(`💰 Inget avtalslängd angivet - använder baspris: ${baseValue} kr`)
    return baseValue
  }
  
  // Extrahera antal år från avtalslängd (ex: "3 år" -> 3)
  const yearMatch = contractLength.toLowerCase().match(/(\d+)\s*(år|year)/i)
  if (yearMatch) {
    const years = parseInt(yearMatch[1])
    const totalValue = baseValue * years
    console.log(`💰 Avtalsvärde: ${baseValue} kr × ${years} år = ${totalValue} kr`)
    return totalValue
  }
  
  // Om vi inte kan parsa avtalslängden, använd baspris
  console.log(`⚠️ Kunde inte parsa avtalslängd "${contractLength}" - använder baspris: ${baseValue} kr`)
  return baseValue
}

// Smart fältmappning baserad på dokumenttyp
const mapDataFieldsFromOneFlow = (dataFields: Record<string, string>, templateId: string) => {
  const contractType = getContractTypeFromTemplate(templateId)
  const fieldMapping = contractType === 'offer' ? OFFER_FIELD_MAPPING : CONTRACT_FIELD_MAPPING
  
  const mappedData: Record<string, string> = {}
  const foundFields: string[] = []
  const unmappedFields: string[] = []
  
  // Mappa alla OneFlow-fält till våra databasfält
  Object.entries(dataFields).forEach(([oneflowField, value]) => {
    const dbField = fieldMapping[oneflowField as keyof typeof fieldMapping]
    if (dbField && value && value.trim()) {
      mappedData[dbField] = value.trim()
      foundFields.push(oneflowField)
    } else if (value && value.trim()) {
      unmappedFields.push(oneflowField)
    }
  })
  
  // Specialhantering för avtalstext
  if (contractType === 'contract') {
    // Kombinera alla avtalstext-delar till en fullständig agreement_text
    const mainText = mappedData['agreement_text_main'] || ''
    const part1 = mappedData['agreement_text_part1'] || ''
    const part2 = mappedData['agreement_text_part2'] || ''
    const part3 = mappedData['agreement_text_part3'] || ''
    const part4 = mappedData['agreement_text_part4'] || ''
    
    const allParts = [mainText, part1, part2, part3, part4].filter(Boolean)
    if (allParts.length > 0) {
      mappedData['agreement_text'] = allParts.join('\n\n')
      // Ta bort temporära fält
      delete mappedData['agreement_text_main']
      delete mappedData['agreement_text_part1']
      delete mappedData['agreement_text_part2']
      delete mappedData['agreement_text_part3']
      delete mappedData['agreement_text_part4']
    }
  }
  
  return {
    mappedData,
    foundFields,
    unmappedFields,
    contractType
  }
}

// Interface för OneFlow kontrakt från list API (baserat på verklig API-struktur)
interface OneFlowContractListItem {
  id: number
  name?: string
  state: string
  template?: {
    id: number
    name: string
  }
  created_time?: string
  updated_time: string
  // Verklig OneFlow API-struktur från användarens logs
  _private?: {
    name: string
    folder?: {
      name: string
    }
    updated_time?: string
  }
  _private_ownerside?: {
    template_id?: number
    template?: {
      name: string
    }
    created_time?: string
  }
}

// Interface för OneFlow kontrakt basic info (inkluderar data_fields från basic endpoint)
interface OneflowContractDetails {
  id: number
  name: string
  state: string
  template: {
    id: number
    name: string
  } | null
  template_id?: number // Fallback om template saknas
  _private_ownerside?: {
    template_id?: number
    template_type_id?: number
    created_time?: string
  }
  created_time: string
  updated_time: string
  data_fields?: OneflowDataField[] // Data fields från basic endpoint
}

// Interface för OneFlow data fields (från basic endpoint har annan struktur)
interface OneflowDataField {
  id: number
  name: string
  value: string
  description?: string
  placeholder?: string
  custom_id?: string // Kan finnas direkt (från separata endpoint)
  _private_ownerside?: {
    custom_id: string // Finns här från basic endpoint
    created_time: string
    updated_time: string
  }
}

// Interface för OneFlow parties
interface OneflowParty {
  id: number
  type: 'company' | 'individual'
  name: string
  identification_number?: string
  my_party: boolean
  participants: Array<{
    id: number
    name: string
    email: string
    signatory: boolean
  }>
}

// Interface för OneFlow products
interface OneflowProduct {
  id: number
  name: string
  description?: string
  unit_price: {
    amount: string
    currency: string
  }
  quantity: number
  total_amount: {
    amount: string
    currency: string
  }
  price_1?: {
    amount?: {
      amount?: string
    }
  }
  price_2?: {
    amount?: {
      amount?: string
    }
  }
}

// Komplett kontraktsdata från alla endpoints
interface CompleteContractData {
  basic: OneflowContractDetails
  data_fields: OneflowDataField[]
  parties: OneflowParty[]
  products: OneflowProduct[]
}

// Smart datumparser för OneFlow-datum som kan innehålla text
const parseContractDate = (dateValue: string | undefined): string | null => {
  if (!dateValue || dateValue.trim() === '') return null
  
  // Ignorera vanliga textfraser
  const textPhrases = [
    'enligt överenskommelse',
    'snarast möjligt', 
    'efter överenskommelse',
    'vid leverans',
    'omgående',
    'överenskommelse',
    'snarast',
    'direkt'
  ]
  
  const lowerValue = dateValue.toLowerCase().trim()
  if (textPhrases.some(phrase => lowerValue.includes(phrase))) {
    console.log(`📅 Ignorerar textdatum: "${dateValue}"`)
    return null
  }
  
  // Försök parsa olika datumformat
  try {
    // YYYY-MM-DD format (ISO)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
      const date = new Date(dateValue.trim())
      if (!isNaN(date.getTime())) {
        console.log(`📅 Parsade ISO-datum: "${dateValue}" → ${dateValue.trim()}`)
        return dateValue.trim()
      }
    }
    
    // DD/MM/YYYY eller D/M/YYYY format
    const ddmmMatch = dateValue.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmMatch) {
      const [, day, month, year] = ddmmMatch
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const date = new Date(isoDate)
      if (!isNaN(date.getTime())) {
        console.log(`📅 Parsade DD/MM/YYYY: "${dateValue}" → ${isoDate}`)
        return isoDate
      }
    }
    
    // DD-MM-YYYY format
    const ddmmDashMatch = dateValue.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (ddmmDashMatch) {
      const [, day, month, year] = ddmmDashMatch
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const date = new Date(isoDate)
      if (!isNaN(date.getTime())) {
        console.log(`📅 Parsade DD-MM-YYYY: "${dateValue}" → ${isoDate}`)
        return isoDate
      }
    }
    
    // Försök Date.parse som sista utväg
    const date = new Date(dateValue.trim())
    if (!isNaN(date.getTime())) {
      const isoDate = date.toISOString().split('T')[0]
      console.log(`📅 Parsade generiskt datum: "${dateValue}" → ${isoDate}`)
      return isoDate
    }
  } catch (error) {
    console.warn(`⚠️ Fel vid parsning av datum: "${dateValue}"`, error)
  }
  
  console.warn(`⚠️ Ogiltigt datumformat ignorerat: "${dateValue}"`)
  return null
}

// Interface för contract insert data (samma som webhook)
interface ContractInsertData {
  oneflow_contract_id: string
  source_type: 'manual'
  source_id: null
  type: 'contract' | 'offer'
  status: 'draft' | 'pending' | 'signed' | 'declined' | 'active' | 'ended' | 'overdue'
  template_id: string
  begone_employee_name?: string
  begone_employee_email?: string
  contract_length?: string
  start_date?: string | null
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  contact_address?: string
  company_name?: string
  organization_number?: string
  agreement_text?: string
  total_value?: number | null
  selected_products?: any
  customer_id: null
}

// Interface för import request
interface ImportRequest {
  action: 'list' | 'import'
  contractIds?: string[] // För selektiv import
  page?: number
  limit?: number
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Hämta lista över kontrakt från OneFlow
const fetchOneFlowContracts = async (page: number = 1, limit: number = 50): Promise<{
  contracts: OneFlowContractListItem[]
  totalCount: number
  hasMore: boolean
}> => {
  try {
    const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
    const ONEFLOW_USER_EMAIL = 'info@begone.se' // Centraliserad avsändare
    
    console.log(`🔍 Hämtar OneFlow-kontrakt, sida ${page}, limit ${limit}`)
    console.log(`🔐 Använder OneFlow email: info@begone.se`)
    console.log(`🔑 API token finns: ${!!ONEFLOW_API_TOKEN} (längd: ${ONEFLOW_API_TOKEN?.length || 0})`)

    // Hämta alla kontrakt - OneFlow API stöder inte template_id filtrering
    const offset = (page - 1) * limit
    const apiUrl = `https://api.oneflow.com/v1/contracts?limit=${limit}&offset=${offset}`
    
    console.log(`🔍 OneFlow API URL: ${apiUrl}`)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': 'info@begone.se',
        'Accept': 'application/json'
      }
    })

    console.log(`📡 OneFlow API response status: ${response.status} ${response.statusText}`)
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('❌ OneFlow List API-fel:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        headers: Object.fromEntries(response.headers.entries())
      })
      throw new Error(`OneFlow API error: ${response.status} - ${errorBody || response.statusText}`)
    }

    const data = await response.json() as OneFlowContractListItem[] | {
      data: OneFlowContractListItem[]
      count: number
      _links?: { next?: { href: string } }
    }

    // OneFlow API kan returnera antingen array eller objekt med data
    let contracts: OneFlowContractListItem[]
    let totalCount: number
    let hasMore = false
    
    console.log(`📄 OneFlow response type: ${Array.isArray(data) ? 'array' : 'object'}`)
    console.log(`📄 Första objektet:`, JSON.stringify(Array.isArray(data) ? data[0] : data, null, 2))
    
    if (Array.isArray(data)) {
      // Direkt array av kontrakt (oväntat format)
      console.warn('⚠️ OneFlow returnerade direkt array, förväntar objekt med data-property')
      contracts = data
      totalCount = data.length
      hasMore = false
    } else {
      // Förväntat OneFlow API format med data-property
      contracts = data.data || []
      totalCount = data.count || contracts.length
      hasMore = !!data._links?.next
      
      console.log(`📋 OneFlow data struktur: count=${totalCount}, data.length=${contracts.length}, hasMore=${hasMore}`)
    }
    
    // Validera och filtrera kontrakt baserat på våra kriterier
    const originalCount = Array.isArray(data) ? data.length : (data.data?.length || 0)
    let draftFiltered = 0
    let templateFiltered = 0
    
    contracts = contracts.filter((contract, index) => {
      if (!contract || typeof contract !== 'object') {
        console.warn(`⚠️ Kontrakt ${index} är inte ett objekt:`, contract)
        return false
      }
      if (!contract.id) {
        console.warn(`⚠️ Kontrakt ${index} saknar ID:`, contract)
        return false
      }
      
      // Filtrera bort kontrakt med status "draft"
      if (contract.state === 'draft') {
        console.log(`🚫 Hoppar över kontrakt ${contract.id} med draft status`)
        draftFiltered++
        return false
      }
      
      // Filtrera på våra godkända template IDs
      const templateId = contract?._private_ownerside?.template_id || contract?.template?.id
      if (templateId && !ALLOWED_TEMPLATE_IDS.has(templateId.toString())) {
        console.log(`🚫 Hoppar över kontrakt ${contract.id} med otillåten template ID: ${templateId}`)
        templateFiltered++
        return false
      }
      
      return true
    })
    
    const filteredCount = contracts.length
    
    if (originalCount !== filteredCount) {
      console.log(`📊 Filtrerade kontrakt: ${originalCount} → ${filteredCount}`)
      console.log(`   - ${draftFiltered} draft-kontrakt exkluderade`)
      console.log(`   - ${templateFiltered} kontrakt med otillåtna template-mallar exkluderade`)
    }
    
    // Pagination hanteras av OneFlow API, template-filtrering i kod
    console.log(`✅ Hämtade ${contracts.length} relevanta kontrakt från OneFlow (bara era godkända mallar)`)
    
    return {
      contracts,
      totalCount: contracts.length, // Använd det filtrerade antalet som totalCount
      hasMore
    }

  } catch (error: any) {
    console.error('💥 Fel vid hämtning av OneFlow-kontrakt:', {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      cause: error.cause
    })
    throw error
  }
}

// Hämta komplett information om ett kontrakt från OneFlow (3 API-anrop)
const fetchOneFlowContractDetails = async (contractId: string): Promise<CompleteContractData | null> => {
  try {
    const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
    const ONEFLOW_USER_EMAIL = 'info@begone.se' // Centraliserad avsändare
    
    console.log(`📋 Hämtar komplett data för kontrakt ${contractId}`)

    const headers = {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
      'Accept': 'application/json'
    }

    // 1. Hämta basic contract info
    console.log(`🔍 Hämtar basic info för ${contractId}`)
    const basicResponse = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, {
      method: 'GET',
      headers
    })

    if (!basicResponse.ok) {
      const errorBody = await basicResponse.text()
      console.error(`❌ OneFlow Basic API-fel för ${contractId}:`, {
        status: basicResponse.status,
        statusText: basicResponse.statusText,
        body: errorBody
      })
      return null
    }

    const basic = await basicResponse.json() as OneflowContractDetails

    // 2. Extrahera data fields från basic response (istället för separata anrop)
    console.log(`📊 Extraherar data fields från basic response för ${contractId}`)
    let data_fields: OneflowDataField[] = []
    
    // Basic endpoint innehåller redan data_fields enligt OneFlow dokumentation
    if (basic && basic.data_fields) {
      data_fields = Array.isArray(basic.data_fields) ? basic.data_fields : []
      console.log(`✅ Hittade ${data_fields.length} data fields i basic response`)
    } else {
      console.warn(`⚠️ Inga data fields hittades i basic response för ${contractId}`)
      console.log(`🔍 Basic response struktur:`, Object.keys(basic))
      console.log(`🔍 Basic response sample:`, JSON.stringify(basic, null, 2).substring(0, 500) + '...')
    }

    // 3. Hämta parties
    console.log(`👥 Hämtar parties för ${contractId}`)
    const partiesResponse = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}/parties`, {
      method: 'GET',
      headers
    })

    let parties: OneflowParty[] = []
    if (partiesResponse.ok) {
      const partiesData = await partiesResponse.json()
      parties = Array.isArray(partiesData) ? partiesData : partiesData.data || []
    } else {
      console.warn(`⚠️ Kunde inte hämta parties för ${contractId}`)
    }

    // 4. Hämta products
    console.log(`🛍️ Hämtar products för ${contractId}`)
    const productsResponse = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}/products`, {
      method: 'GET',
      headers
    })

    let products: OneflowProduct[] = []
    if (productsResponse.ok) {
      const productsData = await productsResponse.json()
      products = Array.isArray(productsData) ? productsData : productsData.data || []
    } else {
      console.warn(`⚠️ Kunde inte hämta products för ${contractId}`)
    }

    console.log(`✅ Komplett kontrakts-data hämtad för ${contractId}:`)
    console.log(`   - Template: ${basic.template?.name || 'Ingen'} (ID: ${basic.template?.id || 'N/A'})`)
    console.log(`   - Data fields: ${data_fields.length} fält`)
    console.log(`   - Parties: ${parties.length} parter`)
    console.log(`   - Products: ${products.length} produkter`)
    
    return {
      basic,
      data_fields,
      parties,
      products
    }

  } catch (error: any) {
    console.error(`💥 Fel vid hämtning av kontrakt-detaljer för ${contractId}:`, {
      message: error.message,
      name: error.name,
      contractId
    })
    return null
  }
}

// Parsa OneFlow kontrakt till vårt databasformat (komplett omarbetning med exakt fältmappning)
const parseContractDetailsToInsertData = (contractData: CompleteContractData): ContractInsertData => {
  const { basic, data_fields, parties, products } = contractData
  
  // Mappa OneFlow state till våra statusar
  const statusMapping: { [key: string]: ContractInsertData['status'] } = {
    'pending': 'pending', 
    'signed': 'signed',
    'declined': 'declined',
    'published': 'pending',
    'completed': 'active',
    'cancelled': 'declined',
    'expired': 'overdue'
  }

  // Bestäm typ baserat på template ID (OneFlow sparar template_id i _private_ownerside)
  let templateId = 'no_template'
  
  // Försök olika platser där OneFlow kan spara template_id
  if (basic.template?.id) {
    templateId = basic.template.id.toString()
  } else if (basic._private_ownerside?.template_id) {
    templateId = basic._private_ownerside.template_id.toString()
  } else if (basic.template_id) {
    templateId = basic.template_id.toString()
  }
  
  const contractType = templateId !== 'no_template' ? getContractTypeFromTemplate(templateId) : null
  const isOffer = contractType === 'offer'
  
  console.log(`🔍 Template ID sökning för ${basic.id}:`)
  console.log(`   📄 basic.template?.id: ${basic.template?.id || 'null'}`)
  console.log(`   📄 basic._private_ownerside?.template_id: ${basic._private_ownerside?.template_id || 'null'}`)
  console.log(`   📄 basic.template_id: ${basic.template_id || 'null'}`)
  console.log(`   🎯 Använd template_id: ${templateId}`)
  console.log(`   🏷️  Detekterad typ: ${contractType || 'null'} → ${isOffer ? 'offer' : 'contract'}`)
  
  // Konvertera data fields array till objekt (fixa custom_id location)
  const dataFields = Object.fromEntries(
    data_fields.map(field => {
      // Custom_id finns i _private_ownerside från basic endpoint
      const customId = field._private_ownerside?.custom_id || field.custom_id
      return [customId, field.value || '']
    }).filter(([customId]) => customId) // Filtrera bort undefined custom_ids
  )

  // 🆕 DEBUG BASIC CONTRACT DATA FÖRST
  console.log(`🔍 OneFlow Basic Contract Data för ${basic.id}:`)
  console.log(`   📋 Namn: ${basic.name || 'Inget namn'}`)
  console.log(`   🏷️  State: ${basic.state}`)
  console.log(`   📄 Template objekt:`, basic.template)
  console.log(`   🔢 Data fields antal: ${data_fields.length}`)
  console.log(`   👥 Parties antal: ${parties.length}`)
  console.log(`   🛍️ Products antal: ${products.length}`)
  
  // 🆕 DETALJERAD DATA FIELDS DEBUGGING
  console.log(`   📊 Raw data_fields array:`, JSON.stringify(data_fields.slice(0, 3), null, 2)) // Visa första 3 
  console.log(`   📊 Alla OneFlow data fields custom_ids:`, data_fields.map(f => f._private_ownerside?.custom_id || f.custom_id))
  console.log(`   📊 Data fields objekt:`, dataFields)
  console.log(`   📊 Data fields keys antal:`, Object.keys(dataFields).length)

  // 🆕 FÖRBÄTTRAD TYP-DETEKTERING MED FALLBACKS
  let finalContractType = contractType
  let finalIsOffer = isOffer
  
  // Om template_id är "no_template", försök andra metoder
  if (templateId === 'no_template') {
    console.log(`⚠️ Template ID saknas - använder alternativa detekterings-metoder`)
    
    // Metod 1: Kontrollera kontraktnamn
    const contractName = basic.name?.toLowerCase() || ''
    if (contractName.includes('offert')) {
      finalContractType = 'offer'
      finalIsOffer = true
      console.log(`   ✅ Detekterade 'offer' från kontraktnamn: "${basic.name}"`)
    }
    
    // Metod 2: Kontrollera data fields för offert-specifika fält
    if (dataFields['vr-kontaktperson'] || dataFields['kontaktperson-e-post'] || dataFields['arbetsbeskrivning']) {
      finalContractType = 'offer'
      finalIsOffer = true
      console.log(`   ✅ Detekterade 'offer' från offert-specifika data fields`)
    }
  }

  // 🆕 ANVÄND MAPPNING MED KORREKT TYP
  const { mappedData, foundFields, unmappedFields } = mapDataFieldsFromOneFlow(
    dataFields, 
    finalContractType === 'offer' ? '8919037' : '8486368' // Använd representativ template ID för mappning
  )

  // 🆕 FÖRBÄTTRAD DEBUG-OUTPUT
  console.log(`📊 OneFlow data fields mapping för kontrakt ${basic.id}:`)
  console.log(`   🎯 Template: ${basic.template?.name || 'Okänd'} (${templateId})`)
  console.log(`   📋 Detekterad typ: ${finalContractType || 'contract'} (original: ${contractType})`)
  console.log(`   ✅ Mappade fält (${foundFields.length}): ${foundFields.join(', ')}`)
  console.log(`   ❓ Ej mappade fält (${unmappedFields.length}): ${unmappedFields.join(', ')}`)
  console.log(`   💾 Resultat:`, Object.keys(mappedData).join(', '))

  // Hitta BeGone-part (vårt företag)
  const begonePart = parties.find(p => p.my_party === true)
  const begoneEmployee = begonePart?.participants?.[0]

  // Hitta kund-part
  const customerPart = parties.find(p => p.my_party === false)
  const customerContact = customerPart?.participants?.[0]

  // Beräkna totalt värde - prioritera kontraktets totalsumma före produktsummering
  let totalValue = 0
  
  // 🆕 FÖRSTA: Försök hämta totalsumma från basic contract data
  if ((basic as any).total?.amount) {
    totalValue = parseFloat((basic as any).total.amount)
    console.log(`💰 Hittade kontraktets totalsumma: ${totalValue} kr (från basic.total.amount)`)
  }
  else if ((basic as any).total_amount?.amount) {
    totalValue = parseFloat((basic as any).total_amount.amount)
    console.log(`💰 Hittade kontraktets totalsumma: ${totalValue} kr (från basic.total_amount.amount)`)
  }
  else if ((basic as any).amount) {
    totalValue = parseFloat((basic as any).amount)
    console.log(`💰 Hittade kontraktets totalsumma: ${totalValue} kr (från basic.amount)`)
  }
  // 🆕 FALLBACK: Summera produkter om ingen totalsumma finns
  else if (products && products.length > 0) {
    console.log(`💰 Ingen totalsumma hittad - beräknar från ${products.length} produkter:`)
    for (const product of products) {
      // OneFlow produkter har olika prisstrukturer - försök flera fält
      let productValue = 0
      
      // Försök price_2.amount.amount först (totalpris)
      if (product.price_2?.amount?.amount) {
        productValue = parseFloat(product.price_2.amount.amount)
        console.log(`   💸 ${product.name}: ${productValue} kr (från price_2.amount.amount - totalpris)`)
      }
      // Fallback till price_1.amount.amount (per enhet)
      else if (product.price_1?.amount?.amount) {
        productValue = parseFloat(product.price_1.amount.amount)
        console.log(`   💸 ${product.name}: ${productValue} kr (från price_1.amount.amount - per enhet)`)
      }
      // Fallback till total_amount.amount
      else if (product.total_amount?.amount) {
        productValue = parseFloat(product.total_amount.amount)
        console.log(`   💸 ${product.name}: ${productValue} kr (från total_amount.amount)`)
      }
      else {
        console.log(`   ⚠️ ${product.name}: Kunde inte hitta pris i produktdata`)
        console.log(`      Produktstruktur:`, Object.keys(product))
      }
      
      totalValue += productValue
    }
    console.log(`   🎯 Totalt värde: ${totalValue} kr`)
  } else {
    console.log(`💰 Inga produkter att beräkna värde från`)
  }

  // 🆕 BYGG FINAL DATA MED EXAKT MAPPNING + PARTIES FALLBACK
  return {
    oneflow_contract_id: basic.id.toString(),
    source_type: 'manual',
    source_id: null,
    type: finalIsOffer ? 'offer' : 'contract',
    status: statusMapping[basic.state] || 'pending',
    template_id: templateId,
    
    // BeGone-information (exakt mappning med parties fallback)
    begone_employee_name: mappedData['begone_employee_name'] || begoneEmployee?.name || 'BeGone Medarbetare',
    begone_employee_email: mappedData['begone_employee_email'] || begoneEmployee?.email || undefined,
    contract_length: mappedData['contract_length'] || undefined,
    start_date: parseContractDate(mappedData['start_date']),
    
    // Kontakt-information (exakt mappning med parties fallback)
    contact_person: mappedData['contact_person'] || customerContact?.name || undefined,
    contact_email: mappedData['contact_email'] || customerContact?.email || undefined,
    contact_phone: mappedData['contact_phone'] || undefined,
    contact_address: mappedData['contact_address'] || undefined,
    company_name: mappedData['company_name'] || customerPart?.name || undefined,
    organization_number: mappedData['organization_number'] || customerPart?.identification_number || undefined,
    
    // Avtal/Offert-innehåll (exakt mappning med avtalslängd-multiplikation)
    agreement_text: mappedData['agreement_text'] || undefined,
    total_value: calculateContractTotalValue(totalValue, mappedData['contract_length']),
    selected_products: products.length > 0 ? products : null,
    
    // Kundkoppling sätts senare vid signering
    customer_id: null
  }
}

// Spara kontrakt till databas (samma logik som webhook)
const saveContractToDatabase = async (contractData: ContractInsertData): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`💾 Sparar kontrakt ${contractData.oneflow_contract_id} till databas`)

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
      console.log(`ℹ️  Kontrakt ${contractData.oneflow_contract_id} finns redan, uppdaterar...`)
      
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
      
      console.log(`✅ Kontrakt ${contractData.oneflow_contract_id} uppdaterat`)
      return { success: true }
    } else {
      // Skapa nytt kontrakt
      const { error: insertError } = await supabase
        .from('contracts')
        .insert([contractData])

      if (insertError) {
        throw insertError
      }
      
      console.log(`✅ Kontrakt ${contractData.oneflow_contract_id} importerat`)
      return { success: true }
    }

  } catch (error: any) {
    console.error(`❌ Fel vid sparande av kontrakt ${contractData.oneflow_contract_id}:`, error)
    return { success: false, error: error.message }
  }
}

// Kontrollera vilka kontrakt som redan finns i databas
const getExistingContractIds = async (): Promise<Set<string>> => {
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('oneflow_contract_id')

    if (error) {
      throw error
    }

    return new Set(data.map(contract => contract.oneflow_contract_id))
  } catch (error) {
    console.error('❌ Fel vid hämtning av befintliga kontrakt:', error)
    return new Set()
  }
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

  // Läs och validera miljövariabler
  const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN
  const ONEFLOW_USER_EMAIL = 'info@begone.se' // Centraliserad avsändare
  
  if (!ONEFLOW_API_TOKEN) {
    console.error('❌ ONEFLOW_API_TOKEN saknas')
    return res.status(500).json({
      success: false,
      error: 'OneFlow API-token är inte konfigurerad'
    })
  }

  // ONEFLOW_USER_EMAIL behöver inte kollas då vi använder info@begone.se

  console.log('✓ Miljövariabler validerade:', {
    hasToken: !!ONEFLOW_API_TOKEN,
    tokenLength: ONEFLOW_API_TOKEN.length,
    userEmail: 'info@begone.se'
  })

  // Acceptera både GET (för list) och POST (för import)
  if (req.method !== 'GET' && req.method !== 'POST') {
    console.error('❌ Ogiltigt HTTP-method:', req.method)
    return res.status(405).json({ 
      success: false,
      error: 'Endast GET och POST tillåtna' 
    })
  }

  try {
    // Parsa request data
    const requestData: ImportRequest = req.method === 'GET' 
      ? { 
          action: 'list',
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 50
        }
      : req.body

    const { action, contractIds, page = 1, limit = 50 } = requestData

    if (action === 'list') {
      console.log('📋 Listar OneFlow-kontrakt för import...')
      
      // Hämta kontrakt från OneFlow
      const { contracts, totalCount, hasMore } = await fetchOneFlowContracts(page, limit)
      
      // Hämta befintliga kontrakt från databas
      const existingIds = await getExistingContractIds()
      
      console.log(`🔍 Befintliga kontrakt i databas: ${existingIds.size} st`)
      console.log(`📋 Befintliga IDs: ${Array.from(existingIds).join(', ')}`)
      
      // Filtrera bort redan importerade kontrakt INNAN mappning
      const notImportedContracts = contracts.filter(contract => {
        const contractId = contract?.id?.toString() || 'unknown'
        const isAlreadyImported = existingIds.has(contractId)
        
        if (isAlreadyImported) {
          console.log(`🚫 Hoppar över redan importerat kontrakt: ${contractId} (${contract?._private?.name || 'Namnlöst'})`)
        }
        
        return !isAlreadyImported
      })
      
      console.log(`✅ Kontrakt att visa för import: ${notImportedContracts.length}/${contracts.length}`)
      
      // Märk vilka som redan är importerade (alla återstående är ej importerade)
      const contractsWithImportStatus = notImportedContracts.map(contract => {
        // Säker parsing av OneFlow kontraktsdata baserat på verklig API-struktur
        const contractId = contract?.id?.toString() || 'unknown'
        
        // Namn finns i _private.name enligt OneFlow API-strukturen
        const contractName = contract?._private?.name || contract?.name || 'Namnlöst kontrakt'
        const contractState = contract?.state || 'unknown'
        
        // Template-information från _private_ownerside.template_id
        const templateId = contract?._private_ownerside?.template_id || contract?.template?.id
        let templateName = 'Okänd mall'
        if (templateId) {
          // Försök att få mallnamn från template-objektet om det finns
          templateName = contract?._private_ownerside?.template?.name || 
                        contract?.template?.name || 
                        `Mall ${templateId}`
        }
        
        // Datum från _private_ownerside eller fallback
        const createdTime = contract?._private_ownerside?.created_time || 
                           contract?.created_time || 
                           contract?.updated_time || ''
        const updatedTime = contract?.updated_time || contract?._private?.updated_time || ''
        
        // Hämta foldernamn för bättre klassificering
        const folderName = contract?._private?.folder?.name
        
        // Förbättrad typbestämning baserat på folder och namn
        // NOTERA: För komplett typbestämning behövs Detail API med data_fields
        const isOffer = (contractName.toLowerCase().includes('offert')) || 
                       (folderName?.toLowerCase().includes('offert')) ||
                       (templateName.toLowerCase().includes('offert'))
        
        console.log(`📋 List API kontrakt ${contractId}:`, {
          name: contractName,
          template: templateName,
          template_id: templateId,
          state: contractState,
          folder: folderName,
          preliminär_type: isOffer ? 'offer' : 'contract'
        })
        
        return {
          id: contractId,
          name: contractName,
          state: contractState,
          template_name: templateName,
          template_id: templateId, // Lägg till template_id för bättre spårning
          created_time: createdTime,
          updated_time: updatedTime,
          is_imported: false, // Alla kontrakt i denna lista är INTE importerade
          type: isOffer ? 'offer' : 'contract',
          // Extra metadata för debugging
          folder_name: folderName || 'Ingen mapp'
        }
      })

      return res.status(200).json({
        success: true,
        data: {
          contracts: contractsWithImportStatus,
          pagination: {
            current_page: page,
            per_page: limit,
            total_count: totalCount,
            has_more: hasMore
          },
          summary: {
            total_contracts: contractsWithImportStatus.length,
            already_imported: 0, // Vi filtrerade bort alla importerade
            available_for_import: contractsWithImportStatus.length,
            original_total: contracts.length,
            filtered_out: contracts.length - contractsWithImportStatus.length
          }
        }
      })
    }

    if (action === 'import') {
      if (!contractIds || contractIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Inga kontrakt-IDs angivna för import'
        })
      }

      console.log(`📥 Importerar ${contractIds.length} kontrakt...`)
      
      const results = []
      
      for (const contractId of contractIds) {
        try {
          console.log(`🔍 Hämtar detaljerad information för kontrakt ${contractId}`)
          
          // Hämta komplett kontrakt-data från OneFlow (4 API-anrop)
          const completeData = await fetchOneFlowContractDetails(contractId)
          
          if (!completeData) {
            console.error(`❌ Kunde inte hämta komplett data för kontrakt ${contractId}`)
            results.push({
              contract_id: contractId,
              success: false,
              error: 'Kunde inte hämta komplett kontrakt-data från OneFlow API'
            })
            continue
          }
          
          // Konvertera till vårt databasformat med korrekt mappning
          const contractData = parseContractDetailsToInsertData(completeData)
          
          console.log(`📋 Kontrakt ${contractId} importerat och sparat:`)
          console.log(`   📄 Template ID: ${contractData.template_id}`)
          console.log(`   🏷️  Typ: ${contractData.type}`) 
          console.log(`   📊 Status: ${contractData.status}`)
          console.log(`   👤 BeGone anställd: ${contractData.begone_employee_name}`)
          console.log(`   📧 BeGone email: ${contractData.begone_employee_email || 'Ej angiven'}`)
          console.log(`   🤝 Kontaktperson: ${contractData.contact_person}`)
          console.log(`   🏢 Företag: ${contractData.company_name}`)
          console.log(`   💰 Totalt värde: ${contractData.total_value ? `${contractData.total_value} kr` : 'Ej angivet'}`)
          console.log(`   📝 Avtalstext: ${contractData.agreement_text ? `${contractData.agreement_text.substring(0, 100)}...` : 'Ej angiven'}`)
          
          // Spara till databas
          const saveResult = await saveContractToDatabase(contractData)
          
          results.push({
            contract_id: contractId,
            contract_name: completeData.basic.name,
            success: saveResult.success,
            error: saveResult.error,
            type: contractData.type,
            status: contractData.status
          })
          
        } catch (error: any) {
          console.error(`❌ Fel vid import av kontrakt ${contractId}:`, error)
          results.push({
            contract_id: contractId,
            success: false,
            error: error.message
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount
      const contractCount = results.filter(r => r.success && r.type === 'contract').length
      const offerCount = results.filter(r => r.success && r.type === 'offer').length

      console.log(`✅ OneFlow import slutförd:`)
      console.log(`   🎯 Totalt: ${results.length} kontrakt processerade`)
      console.log(`   ✅ Framgångsrika: ${successCount}`)
      console.log(`     - 📋 Avtal: ${contractCount}`)
      console.log(`     - 💰 Offerter: ${offerCount}`)
      console.log(`   ❌ Misslyckade: ${failCount}`)
      if (failCount > 0) {
        const failures = results.filter(r => !r.success)
        failures.forEach(f => {
          console.log(`     ❌ ${f.contract_id}: ${f.error}`)
        })
      }

      return res.status(200).json({
        success: true,
        data: {
          results,
          summary: {
            total_processed: results.length,
            successful: successCount,
            failed: failCount
          }
        }
      })
    }

    return res.status(400).json({
      success: false,
      error: 'Ogiltigt action. Använd "list" eller "import"'
    })

  } catch (error: any) {
    console.error('❌ Import contracts API fel:', {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      requestMethod: req.method,
      requestBody: req.method === 'POST' ? req.body : req.query
    })

    // Mer specifika felmeddelanden baserat på feltyp
    let userFriendlyError = 'Internt serverfel vid import av kontrakt'
    
    if (error.message?.includes('OneFlow API error')) {
      userFriendlyError = 'Kunde inte ansluta till OneFlow API. Kontrollera API-inställningar.'
    } else if (error.message?.includes('fetch')) {
      userFriendlyError = 'Nätverksfel vid kommunikation med OneFlow.'
    } else if (error.message?.includes('401')) {
      userFriendlyError = 'Otillräckliga behörigheter för OneFlow API.'
    } else if (error.message?.includes('403')) {
      userFriendlyError = 'Nekad åtkomst till OneFlow API.'
    } else if (error.message?.includes('404')) {
      userFriendlyError = 'OneFlow API-endpoint hittades inte.'
    } else if (error.message?.includes('429')) {
      userFriendlyError = 'För många förfrågningar till OneFlow API. Försök igen senare.'
    }

    return res.status(500).json({ 
      success: false,
      error: userFriendlyError,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      technical_details: process.env.NODE_ENV === 'development' ? {
        error_name: error.name,
        error_message: error.message
      } : undefined
    })
  }
}
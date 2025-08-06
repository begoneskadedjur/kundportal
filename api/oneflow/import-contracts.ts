// api/oneflow/import-contracts.ts - Importera befintliga OneFlow-kontrakt till Supabase
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
const { ALLOWED_TEMPLATE_IDS } = require('../constants/oneflowTemplates')

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
// OneFlow-variabler läses direkt i handler-funktionen för att undvika top-level scope problem

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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

// Interface för komplett OneFlow kontrakt från get API  
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
    const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL!
    
    console.log(`🔍 Hämtar OneFlow-kontrakt, sida ${page}, limit ${limit}`)
    console.log(`🔐 Använder OneFlow email: ${ONEFLOW_USER_EMAIL}`)
    console.log(`🔑 API token finns: ${!!ONEFLOW_API_TOKEN} (längd: ${ONEFLOW_API_TOKEN?.length || 0})`)

    // OneFlow API använder inte pagination-parametrar i contracts endpoint
    const response = await fetch(`https://api.oneflow.com/v1/contracts`, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
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
    
    // Validera att kontrakten har rätt struktur och filtrera bort draft-status och icke-använda mallar
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
      
      // Filtrera bort kontrakt som inte använder våra mallar
      const templateId = contract?._private_ownerside?.template_id || contract?.template?.id
      if (!templateId) {
        console.log(`🚫 Hoppar över kontrakt ${contract.id} utan template_id`)
        templateFiltered++
        return false
      }
      if (!ALLOWED_TEMPLATE_IDS.has(templateId.toString())) {
        console.log(`🚫 Hoppar över kontrakt ${contract.id} med oanvänd mall: ${templateId}`)
        templateFiltered++
        return false
      }
      
      return true
    })
    
    const filteredCount = contracts.length
    
    if (originalCount !== filteredCount) {
      console.log(`📊 Filtrerade kontrakt: ${originalCount} → ${filteredCount}`)
      console.log(`   - ${draftFiltered} draft-kontrakt exkluderade`)
      console.log(`   - ${templateFiltered} kontrakt med oanvända mallar exkluderade`)
      console.log(`   - ${originalCount - draftFiltered - templateFiltered - filteredCount} övriga exkluderade`)
    }
    
    // Client-side pagination baserat på page/limit parametrar
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedContracts = contracts.slice(startIndex, endIndex)
    hasMore = endIndex < contracts.length || hasMore

    console.log(`✅ Hämtade ${contracts.length} relevanta kontrakt från OneFlow (exkluderat draft och oanvända mallar)`)
    
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

// Hämta detaljerad information om ett kontrakt från OneFlow
const fetchOneFlowContractDetails = async (contractId: string): Promise<OneflowContractDetails | null> => {
  try {
    const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
    const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL!
    
    console.log(`📋 Hämtar detaljer för kontrakt ${contractId}`)

    const response = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`❌ OneFlow Contract API-fel för ${contractId}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      })
      return null
    }

    const details = await response.json() as OneflowContractDetails
    console.log(`✅ Kontrakt-detaljer hämtade för ${contractId}`)
    
    return details

  } catch (error: any) {
    console.error(`💥 Fel vid hämtning av kontrakt-detaljer för ${contractId}:`, {
      message: error.message,
      name: error.name,
      contractId
    })
    return null
  }
}

// Parsa OneFlow kontrakt till vårt databasformat (samma logik som webhook)
const parseContractDetailsToInsertData = (details: OneflowContractDetails): ContractInsertData => {
  // Mappa OneFlow state till våra statusar
  const statusMapping: { [key: string]: ContractInsertData['status'] } = {
    'draft': 'draft',
    'pending': 'pending', 
    'signed': 'signed',
    'declined': 'declined',
    'published': 'pending',
    'completed': 'active',
    'cancelled': 'declined',
    'expired': 'overdue'
  }

  // Bestäm typ baserat på template eller namn (säker null-hantering)
  const contractName = details.name || ''
  const templateName = details.template?.name || ''
  const isOffer = contractName.toLowerCase().includes('offert') || 
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
    template_id: details.template?.id?.toString() || 'unknown',
    
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
  const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL
  
  if (!ONEFLOW_API_TOKEN) {
    console.error('❌ ONEFLOW_API_TOKEN saknas')
    return res.status(500).json({
      success: false,
      error: 'OneFlow API-token är inte konfigurerad'
    })
  }

  if (!ONEFLOW_USER_EMAIL) {
    console.error('❌ ONEFLOW_USER_EMAIL saknas')
    return res.status(500).json({
      success: false,
      error: 'OneFlow användar-email är inte konfigurerad'
    })
  }

  console.log('✓ Miljövariabler validerade:', {
    hasToken: !!ONEFLOW_API_TOKEN,
    tokenLength: ONEFLOW_API_TOKEN.length,
    userEmail: ONEFLOW_USER_EMAIL
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
      
      // Märk vilka som redan är importerade (förenklad för List API)
      const contractsWithImportStatus = contracts.map(contract => {
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
          is_imported: existingIds.has(contractId),
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
            total_contracts: contracts.length,
            already_imported: contractsWithImportStatus.filter(c => c.is_imported).length,
            available_for_import: contractsWithImportStatus.filter(c => !c.is_imported).length
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
          
          // Hämta kontrakt-detaljer från OneFlow Detail API
          const details = await fetchOneFlowContractDetails(contractId)
          
          if (!details) {
            console.error(`❌ Kunde inte hämta detaljer för kontrakt ${contractId}`)
            results.push({
              contract_id: contractId,
              success: false,
              error: 'Kunde inte hämta kontrakt-detaljer från OneFlow Detail API'
            })
            continue
          }
          
          console.log(`✅ Kontrakt-detaljer hämtade för ${contractId}:`)
          console.log(`   - Template: ${details.template?.name} (ID: ${details.template?.id})`)
          console.log(`   - Status: ${details.state}`)
          console.log(`   - Data fields: ${details.data_fields?.length || 0} fält`)
          
          // Konvertera till vårt databasformat med samma logik som webhook
          const contractData = parseContractDetailsToInsertData(details)
          
          console.log(`📋 Kontrakt ${contractId} parsed:`)
          console.log(`   - Template ID: ${contractData.template_id}`)
          console.log(`   - Type: ${contractData.type}`)
          console.log(`   - Status: ${contractData.status}`)
          console.log(`   - BeGone employee: ${contractData.begone_employee_name}`)
          console.log(`   - Contact person: ${contractData.contact_person}`)
          console.log(`   - Company: ${contractData.company_name}`)
          
          // Spara till databas
          const saveResult = await saveContractToDatabase(contractData)
          
          results.push({
            contract_id: contractId,
            contract_name: details.name,
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

      console.log(`✅ Import slutförd: ${successCount} framgångsrika, ${failCount} misslyckade`)

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
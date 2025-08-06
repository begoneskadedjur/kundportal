// api/oneflow/import-contracts.ts - Importera befintliga OneFlow-kontrakt till Supabase
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL!

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Interface för OneFlow kontrakt från list API
interface OneFlowContractListItem {
  id: number
  name: string
  state: string
  template: {
    id: number
    name: string
  }
  created_time: string
  updated_time: string
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
    console.log(`🔍 Hämtar OneFlow-kontrakt, sida ${page}, limit ${limit}`)

    const response = await fetch(`https://api.oneflow.com/v1/contracts?page=${page}&per_page=${limit}&order=desc`, {
      method: 'GET',
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ OneFlow List API-fel:', response.status, response.statusText)
      throw new Error(`OneFlow API error: ${response.status}`)
    }

    const data = await response.json() as {
      data: OneFlowContractListItem[]
      count: number
      _links?: { next?: { href: string } }
    }

    console.log(`✅ Hämtade ${data.data.length} kontrakt från OneFlow`)
    
    return {
      contracts: data.data,
      totalCount: data.count,
      hasMore: !!data._links?.next
    }

  } catch (error) {
    console.error('💥 Fel vid hämtning av OneFlow-kontrakt:', error)
    throw error
  }
}

// Hämta detaljerad information om ett kontrakt från OneFlow
const fetchOneFlowContractDetails = async (contractId: string): Promise<OneflowContractDetails | null> => {
  try {
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
      console.error(`❌ OneFlow Contract API-fel för ${contractId}:`, response.status)
      return null
    }

    const details = await response.json() as OneflowContractDetails
    console.log(`✅ Kontrakt-detaljer hämtade för ${contractId}`)
    
    return details

  } catch (error) {
    console.error(`💥 Fel vid hämtning av kontrakt-detaljer för ${contractId}:`, error)
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

  // Bestäm typ baserat på template eller namn
  const isOffer = details.name.toLowerCase().includes('offert') || 
                  details.template.name.toLowerCase().includes('offert')
  
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
      
      // Märk vilka som redan är importerade
      const contractsWithImportStatus = contracts.map(contract => ({
        id: contract.id.toString(),
        name: contract.name,
        state: contract.state,
        template_name: contract.template.name,
        created_time: contract.created_time,
        updated_time: contract.updated_time,
        is_imported: existingIds.has(contract.id.toString()),
        type: contract.name.toLowerCase().includes('offert') || 
              contract.template.name.toLowerCase().includes('offert') 
              ? 'offer' : 'contract'
      }))

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
          // Hämta kontrakt-detaljer från OneFlow
          const details = await fetchOneFlowContractDetails(contractId)
          
          if (!details) {
            results.push({
              contract_id: contractId,
              success: false,
              error: 'Kunde inte hämta kontrakt-detaljer från OneFlow'
            })
            continue
          }
          
          // Konvertera till vårt databasformat
          const contractData = parseContractDetailsToInsertData(details)
          
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
    console.error('❌ Import contracts API fel:', error)

    return res.status(500).json({ 
      success: false,
      error: 'Internt serverfel vid import av kontrakt',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
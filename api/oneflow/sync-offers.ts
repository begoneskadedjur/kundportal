// api/oneflow/sync-offers.ts — Synka alla Oneflow-offerter till contracts-tabellen
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Offer template IDs (samma som i offer-stats.ts)
const OFFER_TEMPLATE_IDS = new Set(['8598798', '8919037', '8919012', '8919059'])

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = 'info@begone.se'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Offert-specifik fältmappning (från import-contracts.ts OFFER_FIELD_MAPPING)
const OFFER_FIELD_MAPPING: Record<string, string> = {
  'vr-kontaktperson': 'begone_employee_name',
  'vr-kontakt-mail': 'begone_employee_email',
  'kontaktperson': 'contact_person',
  'kontaktperson-e-post': 'contact_email',
  'tel-nr': 'contact_phone',
  'utfrande-adress': 'contact_address',
  'kund': 'company_name',
  'per--org-nr': 'organization_number',
  'utfrande-datum': 'start_date',
  'arbetsbeskrivning': 'agreement_text',
  'offert-skapad': 'document_created_date',
  'epost-faktura': 'invoice_email',
  'faktura-referens': 'invoice_reference',
  'mrkning-av-faktura': 'invoice_marking',
}

// Status-mappning: Oneflow state → vår status
// Oneflow API states: draft, pending, overdue, signed, declined, canceled
const STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  signed: 'signed',
  declined: 'declined',
  overdue: 'overdue',
  canceled: 'declined',
  // Legacy/fallback:
  published: 'pending',
  completed: 'signed',
  cancelled: 'declined',
  expired: 'overdue',
}

interface OneFlowContract {
  id: number
  name?: string
  state: string
  template?: { id: number; name?: string }
  _private_ownerside?: { template_id?: number }
  created_time?: string
  updated_time?: string
}

interface OneFlowContractDetail {
  id: number
  name?: string
  state: string
  template?: { id: number; name?: string }
  _private_ownerside?: { template_id?: number }
  template_id?: number
  data_fields?: Array<{
    value: string
    custom_id?: string
    _private_ownerside?: { custom_id?: string }
  }>
  parties?: Array<{
    type: string
    name?: string
    identification_number?: string
    my_party?: boolean
    participants?: Array<{ name: string; email: string }>
  }>
  product_groups?: Array<{
    products?: Array<{
      name: string
      description?: string
      price_1?: { amount?: { amount?: string } }
      price_2?: { amount?: { amount?: string } }
      quantity?: { amount?: number }
      total_amount?: { amount?: string }
    }>
  }>
  created_time?: string
  updated_time?: string
}

/** Hämta alla offer-IDn från Oneflow API (bara lista, inte detaljer) */
async function listAllOfferIds(): Promise<OneFlowContract[]> {
  const offers: OneFlowContract[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const response = await fetch(
      `https://api.oneflow.com/v1/contracts?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'x-oneflow-api-token': ONEFLOW_API_TOKEN,
          'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error(`Oneflow API error: ${response.status}`)
      break
    }

    const data = await response.json() as any
    const contracts: OneFlowContract[] = Array.isArray(data) ? data : data.data || []

    for (const c of contracts) {
      if (c.state === 'draft') continue

      const templateId =
        c._private_ownerside?.template_id?.toString() ||
        c.template?.id?.toString()

      if (templateId && OFFER_TEMPLATE_IDS.has(templateId)) {
        offers.push(c)
      }
    }

    const hasMore = !Array.isArray(data) && !!data._links?.next
    offset += limit
    if (!hasMore || offset > 10000) break
  }

  return offers
}

/** Hämta detaljer för en specifik offert */
async function fetchOfferDetails(contractId: number): Promise<OneFlowContractDetail | null> {
  try {
    const headers = {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
      'Accept': 'application/json',
    }

    // Hämta basic info (inkluderar data_fields)
    const basicRes = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, { headers })
    if (!basicRes.ok) return null
    const detail = await basicRes.json() as OneFlowContractDetail

    // Hämta parties separat
    const partiesRes = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}/parties`, { headers })
    if (partiesRes.ok) {
      const partiesData = await partiesRes.json() as any
      detail.parties = Array.isArray(partiesData) ? partiesData : partiesData.data || []
    }

    return detail
  } catch (err) {
    console.error(`Fel vid hämtning av detaljer för ${contractId}:`, err)
    return null
  }
}

/** Validera om en sträng är ett giltigt datum (inte fritext som "Enligt överenskommelse") */
function parseDate(value: string | undefined | null): string | null {
  if (!value) return null
  // Matcha ISO-datum (2025-01-15) eller vanligt datumformat
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return value
  }
  // Matcha svenskt format (15/1-2025, 15/01/2025, etc)
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(value)) {
    return null // Osäkert format, hoppa över
  }
  // Allt annat (fritext) → null
  return null
}

/** Mappa Oneflow-detalj till contracts-tabellens format.
 *  listState = state från list-API:n (pålitligare: inkluderar expired/cancelled)
 *  detail.state kan skilja sig — t.ex. visa "pending" istället för "expired" */
function mapOfferToInsertData(detail: OneFlowContractDetail, listState?: string): Record<string, any> {
  // Extrahera template ID
  const templateId =
    detail.template?.id?.toString() ||
    detail._private_ownerside?.template_id?.toString() ||
    detail.template_id?.toString() ||
    'no_template'

  // Mappa data fields
  const dataFields: Record<string, string> = {}
  for (const field of detail.data_fields || []) {
    const customId = field._private_ownerside?.custom_id || field.custom_id
    if (customId && field.value) {
      dataFields[customId] = field.value
    }
  }

  const mappedData: Record<string, string> = {}
  for (const [ofKey, dbKey] of Object.entries(OFFER_FIELD_MAPPING)) {
    if (dataFields[ofKey]) {
      mappedData[dbKey] = dataFields[ofKey]
    }
  }

  // Fallback från parties
  const customerParty = detail.parties?.find(p => !p.my_party)
  const begoneParty = detail.parties?.find(p => p.my_party)
  const customerContact = customerParty?.participants?.[0]
  const begoneEmployee = begoneParty?.participants?.[0]

  // Beräkna totalt värde från produkter
  let totalValue = 0
  if (detail.product_groups) {
    for (const group of detail.product_groups) {
      for (const product of group.products || []) {
        const price =
          parseFloat(product.price_2?.amount?.amount || '0') ||
          parseFloat(product.price_1?.amount?.amount || '0') ||
          parseFloat(product.total_amount?.amount || '0')
        totalValue += price
      }
    }
  }

  return {
    oneflow_contract_id: detail.id.toString(),
    source_type: 'manual',
    source_id: null,
    type: 'offer',
    status: STATUS_MAP[listState || detail.state] || 'pending',
    template_id: templateId,
    begone_employee_name: mappedData.begone_employee_name || begoneEmployee?.name || null,
    begone_employee_email: mappedData.begone_employee_email || begoneEmployee?.email || null,
    contact_person: mappedData.contact_person || customerContact?.name || null,
    contact_email: mappedData.contact_email || customerContact?.email || null,
    contact_phone: mappedData.contact_phone || null,
    contact_address: mappedData.contact_address || null,
    company_name: mappedData.company_name || customerParty?.name || null,
    organization_number: mappedData.organization_number || customerParty?.identification_number || null,
    agreement_text: mappedData.agreement_text || null,
    total_value: totalValue > 0 ? totalValue : null,
    selected_products: detail.product_groups || null,
    start_date: parseDate(mappedData.start_date),
    customer_id: null,
  }
}

// Vercel maxDuration (sekunder) — Hobby: max 60s, Pro: max 300s
export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST' })

  if (!ONEFLOW_API_TOKEN) {
    return res.status(500).json({ error: 'ONEFLOW_API_TOKEN saknas' })
  }

  // Batch-stöd: skicka { batchSize: 50, batchOffset: 0 } för att bearbeta i omgångar
  const body = typeof req.body === 'object' && req.body ? req.body : {}
  const batchSize = Number(body.batchSize) || 15   // max antal att bearbeta per anrop
  const batchOffset = Number(body.batchOffset) || 0  // hoppa över N offerter som behöver synk

  try {
    console.log(`🔄 Startar sync (batch: offset=${batchOffset}, size=${batchSize})...`)

    // 1. Lista alla offerter från Oneflow
    const offers = await listAllOfferIds()
    console.log(`📋 Hittade ${offers.length} offerter i Oneflow`)

    // 2. Hämta befintliga oneflow_contract_ids i DB
    const { data: existing } = await supabase
      .from('contracts')
      .select('oneflow_contract_id, status')
      .eq('type', 'offer')

    const existingMap = new Map<string, string>()
    for (const e of existing || []) {
      existingMap.set(e.oneflow_contract_id, e.status)
    }

    // 3. Filtrera ut offerter som behöver synkas (ny eller ändrad status)
    const needsSync = offers.filter(offer => {
      const ofId = offer.id.toString()
      const newStatus = STATUS_MAP[offer.state] || 'pending'
      const existingStatus = existingMap.get(ofId)
      return existingStatus !== newStatus
    })

    const totalNeedsSync = needsSync.length
    const skipped = offers.length - totalNeedsSync

    // Välj batch
    const batch = needsSync.slice(batchOffset, batchOffset + batchSize)

    let imported = 0
    let updated = 0
    let errors = 0

    // 4. Synka varje offert i batchen
    for (const offer of batch) {
      const ofId = offer.id.toString()
      const existingStatus = existingMap.get(ofId)

      // Hämta detaljer
      const detail = await fetchOfferDetails(offer.id)
      if (!detail) {
        console.warn(`⚠️ Kunde inte hämta detaljer för ${ofId}`)
        errors++
        continue
      }

      const insertData = mapOfferToInsertData(detail, offer.state)

      // Upsert
      const { error } = await supabase
        .from('contracts')
        .upsert(insertData, { onConflict: 'oneflow_contract_id' })

      if (error) {
        console.error(`❌ Fel vid sparande av ${ofId}:`, error.message)
        errors++
      } else if (existingStatus) {
        updated++
      } else {
        imported++
      }

      // Rate limiting: 50ms mellan API-anrop
      await new Promise(r => setTimeout(r, 50))
    }

    const nextOffset = batchOffset + batchSize
    const hasMore = nextOffset < totalNeedsSync

    const summary = {
      total_in_oneflow: offers.length,
      needs_sync: totalNeedsSync,
      batch_processed: batch.length,
      imported,
      updated,
      skipped,
      errors,
      existing_before: existingMap.size,
      has_more: hasMore,
      next_offset: hasMore ? nextOffset : null,
    }

    console.log('✅ Batch klar:', summary)

    return res.status(200).json({
      success: true,
      ...summary,
    })
  } catch (error: any) {
    console.error('💥 Sync-fel:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internt serverfel',
    })
  }
}

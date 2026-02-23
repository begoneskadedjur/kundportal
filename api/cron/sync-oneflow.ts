// api/cron/sync-oneflow.ts
// Nattlig synkronisering av Oneflow-kontrakt med vår databas
// Hanterar: saknade kontrakt, borttagna/papperskorg, statusdrift
// Körs automatiskt varje natt kl 03:00 via Vercel Cron

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = 'info@begone.se'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Alla godkända mall-IDn (från api/constants/oneflowTemplates.js)
const ALL_TEMPLATE_IDS = new Set([
  '8598798', '8919037', '8919012', '8919059',  // offerter
  '8486368', '9324573', '8465556', '8462854', '8732196'  // avtal
])

const OFFER_TEMPLATE_IDS = new Set([
  '8598798', '8919037', '8919012', '8919059'
])

// Offert-fältmappning (från sync-offers.ts)
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
}

// Avtal-fältmappning (från import-contracts.ts)
const CONTRACT_FIELD_MAPPING: Record<string, string> = {
  'anstalld': 'begone_employee_name',
  'e-post-anstlld': 'begone_employee_email',
  'avtalslngd': 'contract_length',
  'begynnelsedag': 'start_date',
  'Kontaktperson': 'contact_person',
  'kontaktperson': 'contact_person',
  'e-post-kontaktperson': 'contact_email',
  'telefonnummer-kontaktperson': 'contact_phone',
  'utforande-adress': 'contact_address',
  'foretag': 'company_name',
  'org-nr': 'organization_number',
}

const STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  signed: 'signed',
  declined: 'declined',
  overdue: 'overdue',
  canceled: 'declined',
  cancelled: 'declined',
  published: 'pending',
  completed: 'signed',
  expired: 'overdue',
}

// Status-prioritet: aldrig nedgradera från högre till lägre
const STATUS_PRIORITY: Record<string, number> = {
  pending: 1,
  overdue: 2,
  signed: 3,
  active: 3,
  declined: 3,
  ended: 3,
}

interface OneFlowContract {
  id: number
  name?: string
  state: string
  template?: { id: number; name?: string }
  _private_ownerside?: { template_id?: number }
  created_time?: string
  updated_time?: string
  published_time?: string
  state_updated_time?: string
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
      price_1?: { amount?: { amount?: string } }
      price_2?: { amount?: { amount?: string } }
      quantity?: { amount?: number }
      total_amount?: { amount?: string }
    }>
  }>
  created_time?: string
  updated_time?: string
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Validera datum (kopierat från sync-offers.ts) */
function parseDate(value: string | undefined | null): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return value
  }
  return null
}

/** Lista alla kontrakt från Oneflow med godkända mallar */
async function listAllContractIds(): Promise<OneFlowContract[]> {
  const contracts: OneFlowContract[] = []
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
      console.error(`[sync-oneflow] Oneflow API error: ${response.status}`)
      break
    }

    const data = await response.json() as any
    const page: OneFlowContract[] = Array.isArray(data) ? data : data.data || []

    for (const c of page) {
      if (c.state === 'draft') continue

      const templateId =
        c._private_ownerside?.template_id?.toString() ||
        c.template?.id?.toString()

      if (templateId && ALL_TEMPLATE_IDS.has(templateId)) {
        contracts.push(c)
      }
    }

    const hasMore = !Array.isArray(data) && !!data._links?.next
    offset += limit
    if (!hasMore || offset > 10000) break
  }

  return contracts
}

/** Hämta detaljer + parties för ett kontrakt */
async function fetchContractDetails(contractId: number): Promise<OneFlowContractDetail | null> {
  try {
    const headers = {
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
      'Accept': 'application/json',
    }

    const basicRes = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, { headers })
    if (!basicRes.ok) return null
    const detail = await basicRes.json() as OneFlowContractDetail

    const partiesRes = await fetch(`https://api.oneflow.com/v1/contracts/${contractId}/parties`, { headers })
    if (partiesRes.ok) {
      const partiesData = await partiesRes.json() as any
      detail.parties = Array.isArray(partiesData) ? partiesData : partiesData.data || []
    }

    return detail
  } catch (err) {
    console.error(`[sync-oneflow] Kunde inte hämta detaljer för ${contractId}:`, err)
    return null
  }
}

/** Mappa Oneflow-kontrakt till DB-format */
function mapToInsertData(detail: OneFlowContractDetail, listItem: OneFlowContract): Record<string, any> {
  const templateId =
    detail.template?.id?.toString() ||
    detail._private_ownerside?.template_id?.toString() ||
    (detail as any).template_id?.toString()

  const isOffer = templateId ? OFFER_TEMPLATE_IDS.has(templateId) : false

  // Extrahera data fields
  const dataFields: Record<string, string> = {}
  for (const field of detail.data_fields || []) {
    const key = field._private_ownerside?.custom_id || field.custom_id
    if (key && field.value) dataFields[key] = field.value
  }

  // Mappa fält
  const fieldMapping = isOffer ? OFFER_FIELD_MAPPING : CONTRACT_FIELD_MAPPING
  const mapped: Record<string, string> = {}
  for (const [ofKey, dbKey] of Object.entries(fieldMapping)) {
    if (dataFields[ofKey]) mapped[dbKey] = dataFields[ofKey]
  }

  // Party-fallbacks
  const customerParty = detail.parties?.find((p: any) => !p.my_party)
  const begoneParty = detail.parties?.find((p: any) => p.my_party)
  const customerContact = customerParty?.participants?.[0]
  const begoneEmployee = begoneParty?.participants?.[0]

  // Beräkna totalt värde
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
    type: isOffer ? 'offer' : 'contract',
    status: STATUS_MAP[listItem.state] || STATUS_MAP[detail.state] || 'pending',
    template_id: templateId || 'no_template',
    begone_employee_name: mapped.begone_employee_name || begoneEmployee?.name || null,
    begone_employee_email: mapped.begone_employee_email || begoneEmployee?.email || null,
    contact_person: mapped.contact_person || customerContact?.name || null,
    contact_email: mapped.contact_email || customerContact?.email || null,
    contact_phone: mapped.contact_phone || null,
    contact_address: mapped.contact_address || null,
    company_name: mapped.company_name || customerParty?.name || null,
    organization_number: mapped.organization_number || customerParty?.identification_number || null,
    agreement_text: mapped.agreement_text || null,
    total_value: totalValue > 0 ? totalValue : null,
    selected_products: detail.product_groups || null,
    start_date: parseDate(mapped.start_date),
    customer_id: null,
    created_at: listItem.published_time || detail.created_time || listItem.created_time || null,
    updated_at: listItem.state_updated_time || detail.updated_time || listItem.updated_time || null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: acceptera Vercel cron header eller manuell POST
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!ONEFLOW_API_TOKEN) {
    return res.status(500).json({ error: 'ONEFLOW_API_TOKEN saknas' })
  }

  const stats = { trashed: 0, imported: 0, driftFixed: 0, errors: 0 }

  try {
    console.log('[sync-oneflow] Startar nattlig synkronisering...')

    // 1. Lista alla kontrakt med godkända mallar från Oneflow
    const oneflowContracts = await listAllContractIds()
    console.log(`[sync-oneflow] ${oneflowContracts.length} kontrakt i Oneflow`)

    // Säkerhetsspärr: om Oneflow returnerar 0 kontrakt → troligt API-fel
    if (oneflowContracts.length === 0) {
      console.error('[sync-oneflow] 0 kontrakt från Oneflow — troligt API-fel, avbryter')
      return res.status(200).json({
        success: false,
        error: 'Inga kontrakt från Oneflow API — avbryter för att undvika falska positiver',
      })
    }

    const oneflowIdSet = new Set(oneflowContracts.map(c => c.id.toString()))

    // 2. Hämta alla kontrakt från DB
    const { data: dbContracts } = await supabase
      .from('contracts')
      .select('oneflow_contract_id, status')

    const dbMap = new Map<string, { oneflow_contract_id: string; status: string }>()
    for (const c of dbContracts || []) {
      if (c.oneflow_contract_id) {
        dbMap.set(c.oneflow_contract_id, c)
      }
    }

    // 3. Hitta borttagna/papperskorgs-kontrakt (i DB men inte i Oneflow)
    const TERMINAL_STATUSES = new Set(['declined', 'ended', 'trashed'])
    const trashedIds: string[] = []
    for (const [id, record] of dbMap) {
      if (!oneflowIdSet.has(id) && !TERMINAL_STATUSES.has(record.status)) {
        trashedIds.push(id)
      }
    }

    // 4. Hitta saknade kontrakt (i Oneflow men inte i DB)
    const missingContracts = oneflowContracts.filter(c => !dbMap.has(c.id.toString()))

    // 5. Hitta statusdrift (båda har, men status skiljer sig)
    const driftedContracts = oneflowContracts.filter(c => {
      const dbRecord = dbMap.get(c.id.toString())
      if (!dbRecord || TERMINAL_STATUSES.has(dbRecord.status)) return false
      const expectedStatus = STATUS_MAP[c.state] || 'pending'
      return dbRecord.status !== expectedStatus
    })

    console.log(`[sync-oneflow] Borttagna: ${trashedIds.length}, Saknade: ${missingContracts.length}, Statusdrift: ${driftedContracts.length}`)

    // === Markera borttagna som declined ===
    for (const id of trashedIds) {
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'trashed', updated_at: new Date().toISOString() })
        .eq('oneflow_contract_id', id)

      if (error) {
        console.error(`[sync-oneflow] Fel vid markering av ${id}:`, error.message)
        stats.errors++
      } else {
        stats.trashed++
        console.log(`[sync-oneflow] Markerade ${id} som trashed (borttagen i Oneflow)`)
      }
      await delay(30)
    }

    // === Importera saknade kontrakt ===
    for (const c of missingContracts) {
      try {
        const detail = await fetchContractDetails(c.id)
        if (!detail) {
          stats.errors++
          continue
        }

        const insertData = mapToInsertData(detail, c)

        const { error } = await supabase
          .from('contracts')
          .upsert(insertData, { onConflict: 'oneflow_contract_id' })

        if (error) {
          console.error(`[sync-oneflow] Fel vid import av ${c.id}:`, error.message)
          stats.errors++
        } else {
          stats.imported++
          console.log(`[sync-oneflow] Importerade ${c.id} (${c.name || 'namnlös'})`)
        }
        await delay(50)
      } catch (err: any) {
        console.error(`[sync-oneflow] Undantag vid import av ${c.id}:`, err.message)
        stats.errors++
      }
    }

    // === Korrigera statusdrift (med prioritetsskydd) ===
    for (const c of driftedContracts) {
      const dbRecord = dbMap.get(c.id.toString())!
      const newStatus = STATUS_MAP[c.state] || 'pending'

      const incomingPriority = STATUS_PRIORITY[newStatus] ?? 1
      const existingPriority = STATUS_PRIORITY[dbRecord.status] ?? 1

      // Aldrig nedgradera från en terminal/högre status
      if (incomingPriority < existingPriority) {
        console.log(`[sync-oneflow] Hoppar över nedgradering för ${c.id}: ${dbRecord.status} → ${newStatus}`)
        continue
      }

      const { error } = await supabase
        .from('contracts')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('oneflow_contract_id', c.id.toString())

      if (error) {
        console.error(`[sync-oneflow] Fel vid statusuppdatering av ${c.id}:`, error.message)
        stats.errors++
      } else {
        stats.driftFixed++
        console.log(`[sync-oneflow] Statusdrift fixad ${c.id}: ${dbRecord.status} → ${newStatus}`)
      }
      await delay(30)
    }

    const summary = {
      success: true,
      oneflow_total: oneflowContracts.length,
      db_total: dbMap.size,
      ...stats,
    }

    console.log('[sync-oneflow] Klar:', JSON.stringify(summary))
    return res.status(200).json(summary)

  } catch (error: any) {
    console.error('[sync-oneflow] Oväntat fel:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internt serverfel',
      ...stats,
    })
  }
}

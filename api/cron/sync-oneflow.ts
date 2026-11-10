// api/cron/sync-oneflow.ts
// Nattlig synkronisering av Oneflow-kontrakt med vår databas
// Hanterar: saknade kontrakt (import), statusdrift FÖRE signering och
// signeringsdeadline. Körs automatiskt varje natt kl 03:00 UTC via Vercel Cron.
//
// Oneflow används bara fram till signering. Efter signering styr portalen
// statusen: synken ändrar aldrig status på ett signerat eller aktivt avtal,
// inte heller när dokumentet saknas, raderats eller avböjts i Oneflow. Sådana
// avvikelser loggas i cron_runs.summary (signedDeviations, signedMissing).
// Regler i src/shared/contractStatusGuard.ts. Beslut Christian 2026-11-03.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { fetchTemplatesStrict, getKnownTemplateIds, getOfferTemplateIds } from '../_lib/oneflowTemplates'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { arAvdragsrad } from '../../src/shared/oneflowProductValue'
import {
  ONEFLOW_STATE_TO_STATUS,
  PRE_SIGNING_STATUSES,
  isSignedContractRow,
  oneflowNextPageUrl,
  signedContractDeviation,
  syncStatusDecision,
} from '../../src/shared/contractStatusGuard'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = 'info@begone.se'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Godkända mallar läses dynamiskt från oneflow_templates via fetchTemplatesStrict()
// i handlern - STRIKT, utan fallback. En föråldrad/tom lista skulle trasha avtal
// på mallar som lagts till efteråt, så vid läsfel avbryts hela syncen i stället.

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

// Oneflows state → portalens status (import av nya dokument och drift före signering)
const STATUS_MAP = ONEFLOW_STATE_TO_STATUS

// Högst så här många sidor (100 per sida) ur Oneflows lista
const MAX_PAGES = 200
// PostgREST klipper tyst vid 1 000 rader: contracts läses i sidor
const DB_PAGE = 1000
// Så många id:n per lista i cron_runs.summary (antalen räknas alltid fullt)
const SUMMARY_LIST_MAX = 100

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

// Extrahera signeringsdeadline ur ett Oneflow-kontraktsobjekt (list- eller detaljform).
// Samma kandidatlista som i api/oneflow/webhook.ts — håll dem i synk.
function extractSigningDeadline(obj: any): string | null {
  const raw =
    obj?.signing_period_expiry_date ||
    obj?._private?.signing_period_expiration?.expire_date ||
    obj?._private_ownerside?.signing_period_expiration?.expire_date ||
    obj?.signing_period_expiration?.expire_date ||
    null
  if (!raw) return null
  const dateStr = String(raw).substring(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null
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

/**
 * Lista alla dokument i Oneflow utom utkast, alla mallar. Följer
 * `_links.next.href` tills den är null (objektet finns alltid). Vid felsvar
 * kastas ett fel så att körningen avbryts som 'failed' utan en enda skrivning:
 * en avkortad lista används aldrig.
 */
async function listAllOneflowContracts(): Promise<OneFlowContract[]> {
  const contracts: OneFlowContract[] = []
  let url: string | null = 'https://api.oneflow.com/v1/contracts?limit=100&offset=0'
  let pages = 0

  while (url) {
    pages++
    if (pages > MAX_PAGES) {
      throw new Error(`Oneflows lista tog inte slut efter ${MAX_PAGES} sidor, avbryter utan ändringar`)
    }
    const response = await fetch(url, {
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
        'Accept': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`Oneflow svarade ${response.status} på sida ${pages}, avbryter utan ändringar`)
    }

    const data = await response.json() as any
    const page: OneFlowContract[] = Array.isArray(data) ? data : data.data || []
    for (const c of page) {
      if (c.state !== 'draft') contracts.push(c)
    }
    url = Array.isArray(data) ? null : oneflowNextPageUrl(data)
  }

  return contracts
}

function templateIdOf(c: OneFlowContract): string | undefined {
  return c._private_ownerside?.template_id?.toString() || c.template?.id?.toString()
}

interface DbContractRow {
  oneflow_contract_id: string
  type: string | null
  status: string
  signing_deadline: string | null
  terminated_at: string | null
}

/** Alla contracts-rader med Oneflow-id, i sidor om 1 000. Kastar vid läsfel. */
async function readAllDbContracts(): Promise<DbContractRow[]> {
  const rows: DbContractRow[] = []
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabase
      .from('contracts')
      .select('id, oneflow_contract_id, type, status, signing_deadline, terminated_at')
      .not('oneflow_contract_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + DB_PAGE - 1)
    if (error) throw new Error(`Kunde inte läsa contracts: ${error.message}`)
    const page = (data ?? []) as DbContractRow[]
    rows.push(...page)
    if (page.length < DB_PAGE) break
  }
  return rows
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

  const isOffer = templateId ? getOfferTemplateIds().has(templateId) : false

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
        // ROT/RUT-offertens avdragsrad räknas aldrig in i värdet (3.127.3)
        if (arAvdragsrad(product)) continue
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
    signing_deadline: extractSigningDeadline(detail) ?? extractSigningDeadline(listItem),
    customer_id: null,
    created_at: listItem.published_time || detail.created_time || listItem.created_time || null,
    updated_at: listItem.state_updated_time || detail.updated_time || listItem.updated_time || null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: Vercel cron-header eller manuellt anrop med samma Bearer-token (fail-closed)
  if (!requireCronSecret(req, res)) return

  if (!ONEFLOW_API_TOKEN) {
    return res.status(500).json({ error: 'ONEFLOW_API_TOKEN saknas' })
  }

  const result = await withCronLog('sync-oneflow', async () => {
    // Avvikelser räknas och loggas men åtgärdas aldrig (se punkt 3 nedan)
    const stats = {
      missingInOneflow: 0,
      signedMissing: 0,
      imported: 0,
      driftFixed: 0,
      errors: 0,
    }

    // Mallistan läses färskt från oneflow_templates. fetchTemplatesStrict
    // kastar vid fel/tom tabell => hela körningen loggas som 'failed' i
    // cron_runs och ingenting skrivs.
    await fetchTemplatesStrict()
    console.log(`[sync-oneflow] ${getKnownTemplateIds().size} godkända mallar lästa från DB`)

    console.log('[sync-oneflow] Startar nattlig synkronisering...')

    // 1. Alla dokument i Oneflow (utom utkast). Kastar vid API-fel: inget skrivs.
    const allOneflow = await listAllOneflowContracts()
    // Import och drift gäller bara godkända mallar, som förut
    const oneflowContracts = allOneflow.filter(c => {
      const t = templateIdOf(c)
      return !!t && getKnownTemplateIds().has(t)
    })
    console.log(`[sync-oneflow] ${allOneflow.length} dokument i Oneflow, ${oneflowContracts.length} på godkända mallar`)

    // Säkerhetsspärr: om Oneflow returnerar 0 kontrakt → troligt API-fel
    if (oneflowContracts.length === 0) {
      console.error('[sync-oneflow] 0 kontrakt från Oneflow — troligt API-fel, avbryter')
      return {
        status: 'failed' as const,
        summary: { ...stats },
        errorMessage: 'Inga kontrakt från Oneflow API — avbryter för att undvika falska positiver',
      }
    }

    const allOneflowById = new Map(allOneflow.map(c => [c.id.toString(), c]))

    // 2. Alla kontrakt i DB, i sidor (1 000-taket). Kastar vid läsfel: inget skrivs,
    //    annars skulle en avklippt läsning få importen att skriva över befintliga rader.
    const dbContracts = await readAllDbContracts()
    const dbMap = new Map<string, DbContractRow>()
    for (const c of dbContracts) {
      if (c.oneflow_contract_id) dbMap.set(c.oneflow_contract_id, c)
    }

    // 3. Avtal som finns i DB men inte i Oneflow, och signerade avtal som
    //    Oneflow visar som något annat än signerat.
    //
    // Dessa RÖRS INTE. Ett avtal avslutas bara i portalen: det sägs upp,
    // avslutas av expire-contracts när uppsägningstiden löpt ut, eller ersätts
    // av ett nytt avtal i avtalskartan. Vad som händer med dokumentet i
    // Oneflow ändrar ingenting. (Den gamla trashningen här avslutade bland
    // annat Kiab, Vånga Vinteknik och RBFG 2026-08-21 03:01.)
    const TERMINAL_STATUSES = new Set(['declined', 'ended', 'trashed'])
    const missingInOneflow: string[] = []
    const signedMissing: string[] = []
    const signedDeviations: Array<{ id: string; portal: string; oneflow: string }> = []
    for (const [id, record] of dbMap) {
      const doc = allOneflowById.get(id)
      if (!doc) {
        if (!TERMINAL_STATUSES.has(record.status)) missingInOneflow.push(id)
        if (isSignedContractRow(record)) signedMissing.push(id)
        continue
      }
      const avvikelse = signedContractDeviation(record, doc.state)
      if (avvikelse) signedDeviations.push({ id, portal: record.status, oneflow: avvikelse })
    }

    // 4. Hitta saknade kontrakt (i Oneflow men inte i DB)
    const missingContracts = oneflowContracts.filter(c => !dbMap.has(c.id.toString()))

    // 5. Statusdrift: bara rader FÖRE signering (draft/pending/overdue) och bara
    //    uppåt. Signerade, aktiva, uppsagda och avslutade rader rörs aldrig, så
    //    'active' i portalen mot 'signed' i Oneflow ger ingen skrivning.
    const drifted: Array<{ c: OneFlowContract; from: string; to: string }> = []
    for (const c of oneflowContracts) {
      const dbRecord = dbMap.get(c.id.toString())
      if (!dbRecord) continue
      const decision = syncStatusDecision(dbRecord, c.state)
      if (decision.change) drifted.push({ c, from: dbRecord.status, to: decision.to })
    }

    console.log(`[sync-oneflow] Saknas i Oneflow: ${missingInOneflow.length} (rörs ej, varav ${signedMissing.length} signerade), Avvikande signerade: ${signedDeviations.length} (rörs ej), Saknade i DB: ${missingContracts.length}, Statusdrift före signering: ${drifted.length}`)

    // === Avvikelser: LOGGAS, ändras aldrig ===
    stats.missingInOneflow = missingInOneflow.length
    stats.signedMissing = signedMissing.length
    if (missingInOneflow.length > 0) {
      console.log(
        `[sync-oneflow] Följande finns i portalen men inte i Oneflow (oförändrade): ${missingInOneflow.join(', ')}`
      )
    }
    for (const d of signedDeviations) {
      console.log(`[sync-oneflow] Avvikelse (oförändrad): ${d.id} är ${d.portal} i portalen men ${d.oneflow} i Oneflow`)
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

        // Bara nya rader: ignoreDuplicates gör att en rad som ändå finns (t.ex.
        // skapad av webhooken under körningen) aldrig skrivs över, inte heller
        // dess status.
        const { error } = await supabase
          .from('contracts')
          .upsert(insertData, { onConflict: 'oneflow_contract_id', ignoreDuplicates: true })

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

    // === Statusdrift före signering ===
    // Villkoret på status upprepas i uppdateringen: hinner raden signeras
    // (webhooken) under körningen rörs den inte.
    for (const { c, from, to } of drifted) {
      const { data: updated, error } = await supabase
        .from('contracts')
        .update({ status: to, updated_at: new Date().toISOString() })
        .eq('oneflow_contract_id', c.id.toString())
        .in('status', [...PRE_SIGNING_STATUSES])
        .is('terminated_at', null)
        .setHeader('x-status-source', 'sync-oneflow')
        .select('id')

      if (error) {
        console.error(`[sync-oneflow] Fel vid statusuppdatering av ${c.id}:`, error.message)
        stats.errors++
      } else if ((updated ?? []).length > 0) {
        stats.driftFixed++
        console.log(`[sync-oneflow] Statusdrift fixad ${c.id}: ${from} → ${to}`)
      }
      await delay(30)
    }

    // === Uppdatera signeringsdeadline för pågående dokument ===
    // Deadline kan förlängas i Oneflow utanför portalen — håll den i synk.
    // Bara pending/overdue behöver färsk deadline; detaljhämtning per kontrakt
    // (listan innehåller sällan expiration-fältet).
    const deadlineCandidates = oneflowContracts.filter(c => {
      const dbRecord = dbMap.get(c.id.toString())
      return dbRecord && (dbRecord.status === 'pending' || dbRecord.status === 'overdue')
    })
    for (const c of deadlineCandidates) {
      try {
        const dbRecord = dbMap.get(c.id.toString())!
        let deadline = extractSigningDeadline(c)
        if (!deadline) {
          const detail = await fetchContractDetails(c.id)
          deadline = extractSigningDeadline(detail)
          await delay(50)
        }
        if (deadline && deadline !== dbRecord.signing_deadline) {
          const { error } = await supabase
            .from('contracts')
            .update({ signing_deadline: deadline })
            .eq('oneflow_contract_id', c.id.toString())
            .in('status', ['pending', 'overdue'])
          if (error) {
            console.error(`[sync-oneflow] Fel vid deadline-uppdatering av ${c.id}:`, error.message)
            stats.errors++
          } else {
            console.log(`[sync-oneflow] Deadline uppdaterad för ${c.id}: ${dbRecord.signing_deadline || 'null'} → ${deadline}`)
          }
        }
      } catch (err: any) {
        console.error(`[sync-oneflow] Undantag vid deadline-synk av ${c.id}:`, err.message)
        stats.errors++
      }
    }

    const summary = {
      oneflow_total: oneflowContracts.length,
      oneflow_all_templates: allOneflow.length,
      db_total: dbMap.size,
      ...stats,
      signedDeviations: signedDeviations.length,
      // Oneflow-id:n för uppföljning (signerade avtal rörs aldrig av synken)
      signedDeviationList: signedDeviations.slice(0, SUMMARY_LIST_MAX),
      signedMissingList: signedMissing.slice(0, SUMMARY_LIST_MAX),
    }

    console.log('[sync-oneflow] Klar:', JSON.stringify(summary))
    return {
      status: stats.errors > 0 ? ('partial' as const) : ('success' as const),
      summary,
    }
  })

  if (result.status === 'failed') {
    console.error('[sync-oneflow] Körningen misslyckades:', result.errorMessage)
    return res.status(500).json({ success: false, error: result.errorMessage, ...result.summary as object })
  }
  return res.status(200).json({ success: true, ...(result.summary as object) })
}

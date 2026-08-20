// src/utils/contractRenewalPrefill.ts
//
// Bygger förifyllnaden till avtalswizzarden när ett avslutat avtal ska förnyas.
// Wizarden har redan en prefill-kanal (sessionStorage + ?prefill=contract) som
// ärendemodalerna använder — den här modulen producerar samma form, fast ur ett
// befintligt avtal i stället för ur ett ärende.
//
// Det gamla avtalet rörs ALDRIG. En förnyelse är en ny period, inte samma avtal
// återupplivat: fakturahistorik och premietrappa hör till den period de gällde.

import { supabase } from '../lib/supabase'
import { OneflowTemplateService } from '../services/oneflowTemplateService'

export interface RenewalPrefill {
  documentType: 'contract'
  selectedTemplate: string
  /** 'exact' = avtalets egen mall, 'derived' = gissad ur avtalstypen, 'none' = måste väljas för hand */
  templateSource: 'exact' | 'derived' | 'none'
  partyType: 'company' | 'individual'
  Kontaktperson: string
  'e-post-kontaktperson': string
  'telefonnummer-kontaktperson': string
  'utforande-adress': string
  foretag: string
  'org-nr': string
  anstalld: string
  'e-post-anstlld': string
  avtalslngd: string
  begynnelsedag: string
  noticePeriodMonths: string
  billingFrequency: string
  selectedPriceListId: string | null
  customer_group_id: string | null
  agreementText: string
  draftItems: unknown[]
  draftPriceAssignments: Record<string, string>
  renewalOfContractId: string
  targetStep: number
  /** Bara för meddelandet i wizarden */
  renewalOfLabel: string
}

/** Normaliserar mallnamn för jämförelse: gemener, inga extratecken. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9]+/gi, ' ')
    .trim()
}

/**
 * Väljer Oneflow-mall för det nya avtalet.
 *
 * FÄLLA: contracts.template_id är NOT NULL men bär platshållarna 'imported'
 * respektive 'local' för avtal som inte kommer från Oneflow — och det gäller
 * SAMTLIGA avtal som idag är uppsagda eller avslutade. Skickas platshållaren
 * vidare blir det Number('imported') = NaN och Oneflow svarar 400.
 *
 * Därför tre steg: exakt numeriskt id → namnmatchning mot avtalstypen (som i
 * praktiken redan heter samma sak som mallen) → låt användaren välja.
 */
async function resolveTemplate(
  templateId: string | null,
  contractType: string | null,
  label: string | null
): Promise<{ id: string; source: 'exact' | 'derived' | 'none' }> {
  let templates: { id: string; name: string }[] = []
  try {
    const rows = await OneflowTemplateService.getActiveByType('contract')
    templates = rows.map((t) => ({ id: String(t.id), name: t.name }))
  } catch {
    templates = []
  }

  // 1. Avtalets egen mall, om den är ett riktigt Oneflow-id
  if (templateId && /^\d+$/.test(templateId)) {
    if (templates.length === 0 || templates.some((t) => t.id === templateId)) {
      return { id: templateId, source: 'exact' }
    }
  }

  // 2. Namnmatchning: avtalstypen heter i praktiken samma som mallen
  //    ("Avtal mekaniska fällor" → "Avtal Mekaniska fällor")
  const candidates = [contractType, label].filter((v): v is string => !!v && v.trim().length > 0)
  for (const candidate of candidates) {
    const needle = normalizeName(candidate)
    if (!needle) continue
    const exact = templates.find((t) => normalizeName(t.name) === needle)
    if (exact) return { id: exact.id, source: 'derived' }
    // Prefixmatchning fångar "Skadedjursavtal Betongstation" mot
    // "Skadedjursavtal betongstation Företag" och liknande varianter
    const prefix = templates.find(
      (t) => normalizeName(t.name).startsWith(needle) || needle.startsWith(normalizeName(t.name))
    )
    if (prefix) return { id: prefix.id, source: 'derived' }
  }

  // 3. Ingen träff — wizarden stannar på mallsteget
  return { id: '', source: 'none' }
}

/** Dagen efter ett datum, som ÅÅÅÅ-MM-DD. */
function dayAfter(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayIso(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/** "1 år" / "12 månader" → antal år som sträng. Wizarden vill ha år. */
function parseContractLength(raw: string | null): string {
  if (!raw) return '1'
  const yearMatch = raw.match(/(\d+)\s*år/i)
  if (yearMatch) return yearMatch[1]
  const monthMatch = raw.match(/(\d+)\s*(mån|månad)/i)
  if (monthMatch) {
    const months = Number(monthMatch[1])
    if (months >= 12) return String(Math.round(months / 12))
    // Kortare än ett år går inte att uttrycka i wizardens årsfält —
    // förnyelsen får då ett år som förval och justeras för hand.
    return '1'
  }
  const bare = raw.match(/^\s*(\d+)\s*$/)
  return bare ? bare[1] : '1'
}

interface ContractRow {
  id: string
  customer_id: string | null
  template_id: string | null
  contract_type: string | null
  label: string | null
  company_name: string | null
  organization_number: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  address_label: string | null
  agreement_text: string | null
  contract_length: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  effective_end_date: string | null
  notice_period_months: number | null
  billing_frequency: string | null
  price_list_id: string | null
  customer_group_id: string | null
  begone_employee_name: string | null
  begone_employee_email: string | null
}

interface BillingItemRow {
  id: string
  item_type: string | null
  mapped_service_id: string | null
  [key: string]: unknown
}

/**
 * Läser ett avtal och returnerar wizardens förifyllnad.
 *
 * Fält som inte går att härleda lämnas tomma med flit — kundgrupp saknas t.ex.
 * på alla importerade avtal och måste väljas för hand. Att gissa där skulle ge
 * ett nytt avtal med fel uppgifter.
 */
export async function buildRenewalPrefill(contractId: string): Promise<RenewalPrefill> {
  const { data: contractData, error } = await supabase
    .from('contracts')
    .select(
      `id, customer_id, template_id, contract_type, label, company_name, organization_number,
       contact_person, contact_email, contact_phone, contact_address, address_label,
       agreement_text, contract_length, contract_start_date, contract_end_date,
       effective_end_date, notice_period_months, billing_frequency, price_list_id,
       customer_group_id, begone_employee_name, begone_employee_email`
    )
    .eq('id', contractId)
    .maybeSingle()

  if (error) throw new Error(`Kunde inte läsa avtalet: ${error.message}`)
  if (!contractData) throw new Error('Avtalet hittades inte')
  const c = contractData as unknown as ContractRow

  // Kunden fyller luckor som saknas på avtalsraden (vanligt på lokala avtal)
  const { data: customerData } = c.customer_id
    ? await supabase
        .from('customers')
        .select('contact_phone, contact_address, price_list_id, customer_group_id, organization_number')
        .eq('id', c.customer_id)
        .maybeSingle()
    : { data: null }
  const cust = (customerData ?? {}) as {
    contact_phone?: string | null
    contact_address?: string | null
    price_list_id?: string | null
    customer_group_id?: string | null
    organization_number?: string | null
  }

  // Avtalsinnehållet: tjänster + interna artiklar med sina kopplingar.
  // case_type='contract' och case_id=avtalets id — avtalets innehåll ÄR
  // case_billing_items, ingen separat tabell.
  const { data: itemsData } = await supabase
    .from('case_billing_items')
    .select('*')
    .eq('case_id', contractId)
    .eq('case_type', 'contract')
  const items = (itemsData ?? []) as unknown as BillingItemRow[]

  // Artikel → tjänst-kopplingen rekonstrueras ur mapped_service_id, som pekar
  // på TJÄNSTERADENS id (inte services.id).
  const draftPriceAssignments: Record<string, string> = {}
  for (const item of items) {
    if (item.item_type === 'article' && item.mapped_service_id) {
      draftPriceAssignments[item.id] = item.mapped_service_id
    }
  }

  const template = await resolveTemplate(c.template_id, c.contract_type, c.label)

  // Nytt avtal börjar dagen efter det gamla upphörde
  const lastDay = c.effective_end_date ?? c.contract_end_date
  const start = lastDay ? dayAfter(lastDay) : todayIso()

  const orgnr = c.organization_number ?? cust.organization_number ?? ''

  return {
    documentType: 'contract',
    selectedTemplate: template.id,
    templateSource: template.source,
    // Avtalskunder är i praktiken alltid företag, och steg 3 låter användaren
    // byta. Att gissa privatperson ur org.nr-formatet går inte — personnummer
    // och organisationsnummer ser likadana ut.
    partyType: 'company',
    Kontaktperson: c.contact_person ?? '',
    'e-post-kontaktperson': c.contact_email ?? '',
    'telefonnummer-kontaktperson': c.contact_phone ?? cust.contact_phone ?? '',
    'utforande-adress': c.contact_address ?? c.address_label ?? cust.contact_address ?? '',
    foretag: c.company_name ?? '',
    'org-nr': orgnr,
    // Säljaren saknas på lokala avtal — wizarden fyller i inloggad användare
    // när fältet är tomt, vilket är ett bättre förval ändå.
    anstalld: c.begone_employee_name ?? '',
    'e-post-anstlld': c.begone_employee_email ?? '',
    avtalslngd: parseContractLength(c.contract_length),
    begynnelsedag: start,
    noticePeriodMonths: String(c.notice_period_months ?? 3),
    billingFrequency: c.billing_frequency ?? 'annual',
    selectedPriceListId: c.price_list_id ?? cust.price_list_id ?? null,
    customer_group_id: c.customer_group_id ?? cust.customer_group_id ?? null,
    agreementText: c.agreement_text ?? '',
    draftItems: items,
    draftPriceAssignments,
    renewalOfContractId: contractId,
    renewalOfLabel: c.label ?? c.contract_type ?? 'tidigare avtal',
    // Saknas riktig mall måste den väljas först (steg 2). Annars går vi till
    // kundgruppen (steg 4), som ändå aldrig är ifylld på gamla avtal.
    targetStep: template.source === 'none' ? 2 : 4,
  }
}

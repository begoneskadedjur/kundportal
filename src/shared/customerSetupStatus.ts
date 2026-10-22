// src/shared/customerSetupStatus.ts
// Uppläggningens status per kund i Befintliga kunder: fem ikoner i den ordning
// en kund läggs upp (avtal, Fortnox, fakturaväg, schema, kundportal). Varje
// ikon får ett läge, en orsak med kundens egna uppgifter, en åtgärd och ett
// klickmål. Ren logik utan databas; hooken useCustomerSetupStatus hämtar datan.
//
// Reglerna (godkänd skiss 2026-10-22, Christian):
// - Avtal: samma källa som avtalskartans markör (RPC contract_map_status_summary).
//   Klart = inga steg kvar, påbörjat = avtal finns men steg kvar, saknas = inget
//   avtal. Steget Schema räknas inte här: det har en egen ikon.
// - Fortnox: kundnummer + fortnox_verified_at. Enhet som faktureras via
//   huvudkontorets kort gäller inte (samma regel som resolveDeliveryOwner).
// - Fakturaväg: invoice_delivery_method satt. Kontaktpersonens e-post som
//   reserv är påbörjat. Enhet via huvudkontoret gäller inte.
// - Schema: aktivt återkommande schema med tekniker som räcker till
//   avtalsårets slut (scheduleHorizon). Avrop utan schema gäller inte.
// - Kundportalen: minst en inbjuden eller aktiv. Privatkunder gäller inte.
// - Uppsagda kunder får ingen status.
// - Multisite: sämsta läget bland huvudkontoret och de aktiva enheterna, och
//   orsaken räknar enheterna.

import { resolveDeliveryOwner, INVOICE_DELIVERY_LABEL, INVOICE_DELIVERY_SOURCE_LABEL, isInvoiceDeliveryMethod } from './invoiceDelivery'
import type { InvoiceDeliverySource } from './invoiceDelivery'
import { isPersonnummer, orgDigits } from './fortnoxCustomerNumbers'
import { scheduleHorizon, type HorizonContract } from './scheduleHorizon'
import { addDaysIso } from './contractPlanner'

/** Schemat räknas som täckande om det når fram till högst så många dagar före avtalsårets slut. */
export const SCHEDULE_MARGIN_DAYS = 31

export type SetupKey = 'avtal' | 'fortnox' | 'vag' | 'schema' | 'portal'
export type SetupState = 'done' | 'partial' | 'missing' | 'na'

export const SETUP_KEYS: SetupKey[] = ['avtal', 'fortnox', 'vag', 'schema', 'portal']

export const SETUP_LABEL: Record<SetupKey, string> = {
  avtal: 'Avtal',
  fortnox: 'Fortnox',
  vag: 'Fakturaväg',
  schema: 'Schema',
  portal: 'Kundportalen',
}

export const SETUP_STATE_LABEL: Record<SetupState, string> = {
  done: 'Klart',
  partial: 'Påbörjat',
  missing: 'Saknas',
  na: 'Gäller inte kunden',
}

// --- Indata --------------------------------------------------------------------

/** De kundfält statusen läser (customers-raden). */
export interface SetupCustomerRow {
  id: string
  company_name?: string | null
  site_name?: string | null
  customer_number: number | null
  fortnox_verified_at?: string | null
  organization_number?: string | null
  parent_customer_id?: string | null
  is_active?: boolean | null
  business_type?: string | null
  contract_type?: string | null
  invoice_delivery_method?: string | null
  invoice_delivery_source?: string | null
  invoice_delivery_confirmed_by_name?: string | null
  billing_email?: string | null
  billing_address?: string | null
  contact_email?: string | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  terminated_at?: string | null
  effective_end_date?: string | null
  notice_period_months?: number | null
  contract_length?: string | null
}

/** Avtalsfälten schemats horisont behöver (avtalet schemat hör till). */
export interface SetupHorizonContract {
  contract_start_date?: string | null
  start_date?: string | null
  contract_end_date?: string | null
  terminated_at?: string | null
  effective_end_date?: string | null
  notice_period_months?: number | null
  contract_length?: string | null
  renewal_mode?: string | null
}

export interface SetupSchedule {
  id: string
  customer_id: string
  technician_id: string | null
  technician_name?: string | null
  frequency: string | null
  generated_until: string | null
  contract?: SetupHorizonContract | null
}

export interface SetupMapStatus {
  root_customer_id: string
  status: 'none' | 'incomplete' | 'complete'
  missing: string[]
}

export interface SetupPortal {
  /** Någon har loggat in */
  active: boolean
  /** Inbjudan skickad eller konto finns */
  invited: boolean
}

export interface SetupInput {
  kind: 'single' | 'multisite'
  /** Kundraden (single) eller huvudkontoret (multisite) */
  root: SetupCustomerRow
  /** Multisite: enheterna utan huvudkontoret. Single: tom. */
  units: SetupCustomerRow[]
  terminated: boolean
  /** Avtalskartans status. null = inte hämtad än */
  map: SetupMapStatus | null
  /** Aktiva återkommande scheman i hela familjen */
  schedules: SetupSchedule[]
  /** Avtalstyp per levande avtal och kundrad, för avrop */
  contractTypes: Array<{ customer_id: string; contract_type: string | null }>
  /** Kundrader där alla avtalsrader i omfattningen är "vid behov" (on_demand) */
  onDemandCustomerIds?: Set<string>
  portal: SetupPortal
  /** ÅÅÅÅ-MM-DD, för test */
  today?: string
}

// --- Utdata ------------------------------------------------------------------------

export type SetupTarget =
  | { page: 'record'; customerId: string; tab: 'avtalskarta' | 'fakturering' | 'enheter' | 'atkomst' }
  | { page: 'edit'; customerId: string }
  | { page: 'schema'; customerId: string; query: string }

export interface SetupItem {
  key: SetupKey
  label: string
  state: SetupState
  stateLabel: string
  /** Orsaken med kundens uppgifter, en eller två meningar */
  reason: string
  /** Kort text för kundpanelen på telefon */
  short: string
  /** "Tryck för att ...", null när ikonen inte gäller kunden */
  action: string | null
  /** Nästa åtgärd i klartext ("Verifiera i Fortnox"), null när klart */
  nextLabel: string | null
  /** Knapptext i kundpanelen ("Verifiera"), null när klart */
  buttonLabel: string | null
  target: SetupTarget | null
}

export interface SetupSummary {
  terminated: boolean
  items: SetupItem[]
  /** Antal ikoner som är påbörjade eller saknas */
  remaining: number
  next: SetupItem | null
  complete: boolean
}

// --- Hjälpare ------------------------------------------------------------------------

const RANK: Record<SetupState, number> = { na: 0, done: 1, partial: 2, missing: 3 }

function worst(states: SetupState[]): SetupState {
  return states.reduce<SetupState>((w, s) => (RANK[s] > RANK[w] ? s : w), 'na')
}

function isActiveRow(r: SetupCustomerRow): boolean {
  return r.is_active !== false
}

const FREQ: Record<string, string> = {
  weekly: 'Besök varje vecka',
  bi_weekly: 'Besök varannan vecka',
  monthly: 'Månadsvisa besök',
  twice_monthly: 'Besök två gånger i månaden',
  quarterly: 'Kvartalsvisa besök',
  semi_annual: 'Halvårsvisa besök',
  annual: 'Årliga besök',
  custom: 'Besök med eget intervall',
}

function freqText(f: string | null | undefined): string {
  return (f && FREQ[f]) || 'Återkommande besök'
}

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function enheter(n: number): string {
  return n === 1 ? 'enhet' : 'enheter'
}

/** Den del av familjen som behöver statusen: huvudkontoret plus aktiva enheter. */
function familyRows(input: SetupInput): Array<{ row: SetupCustomerRow; parent: SetupCustomerRow | null }> {
  if (input.kind !== 'multisite') return [{ row: input.root, parent: null }]
  return [
    { row: input.root, parent: null },
    ...input.units.filter(isActiveRow).filter((u) => u.id !== input.root.id).map((u) => ({ row: u, parent: input.root })),
  ]
}

/** Raden vars Fortnox-kort fakturan går på, eller null när enheten faktureras via huvudkontoret. */
function billingOwner(row: SetupCustomerRow, parent: SetupCustomerRow | null): SetupCustomerRow | null {
  if (!parent) return row
  const toDelivery = (r: SetupCustomerRow) => ({
    ...r,
    customer_number: r.customer_number,
    organization_number: r.organization_number ?? null,
    parent_customer_id: r.parent_customer_id ?? null,
    invoice_delivery_method: r.invoice_delivery_method ?? null,
    billing_email: r.billing_email ?? null,
    billing_address: r.billing_address ?? null,
  })
  const owner = resolveDeliveryOwner(toDelivery(row), toDelivery(parent))
  return owner.id === parent.id ? null : row
}

// --- Avtal ---------------------------------------------------------------------------

function avtalItem(input: SetupInput): SetupItem {
  const base = { key: 'avtal' as const, label: SETUP_LABEL.avtal }
  const rootId = input.map?.root_customer_id ?? input.root.id
  const target: SetupTarget = { page: 'record', customerId: rootId, tab: 'avtalskarta' }
  const map = input.map
  if (!map || map.status === 'none') {
    return {
      ...base, state: 'missing', stateLabel: SETUP_STATE_LABEL.missing,
      reason: 'Inget avtal är upplagt i avtalsvyn.',
      short: 'Inget avtal upplagt',
      action: 'Tryck för att lägga upp avtalet', nextLabel: 'Lägg upp avtalet', buttonLabel: 'Lägg upp', target,
    }
  }
  // Schemat har en egen ikon och räknas inte två gånger
  const steps = map.missing.filter((m) => m !== 'Schema')
  if (map.status === 'complete' || steps.length === 0) {
    return {
      ...base, state: 'done', stateLabel: SETUP_STATE_LABEL.done,
      reason: 'Premie, period, faktureringsintervall och fakturaplan är klara.',
      short: 'Premie, period och fakturaplan klara',
      action: 'Tryck för att öppna avtalet', nextLabel: null, buttonLabel: null, target,
    }
  }
  return {
    ...base, state: 'partial', stateLabel: SETUP_STATE_LABEL.partial,
    reason: `Avtalet är upplagt men ${steps.length === 1 ? 'ett steg återstår' : `${steps.length} steg återstår`} i avtalsvyn: ${steps.join(', ')}.`,
    short: `Kvar: ${steps.join(', ')}`,
    action: 'Tryck för att öppna avtalet', nextLabel: 'Gör klart avtalet', buttonLabel: 'Gör klart', target,
  }
}

// --- Fortnox -------------------------------------------------------------------------

interface FortnoxRowState { state: SetupState; number: number | null; row: SetupCustomerRow }

function fortnoxRow(row: SetupCustomerRow, parent: SetupCustomerRow | null, family: SetupCustomerRow[]): FortnoxRowState {
  const owner = billingOwner(row, parent)
  if (!owner) return { state: 'na', number: null, row }
  let number = row.customer_number
  let verified = !!row.fortnox_verified_at
  if (number == null) {
    // Eget bolag vars nummer bärs av en annan rad med samma org.nr i familjen
    const digits = orgDigits(row.organization_number)
    const holder = digits
      ? family.find((r) => r.id !== row.id && r.customer_number != null && orgDigits(r.organization_number) === digits)
      : undefined
    if (holder) {
      number = holder.customer_number
      verified = !!holder.fortnox_verified_at
    }
  }
  if (number == null) return { state: 'missing', number: null, row }
  return { state: verified ? 'done' : 'partial', number, row }
}

function fortnoxItem(input: SetupInput): SetupItem {
  const base = { key: 'fortnox' as const, label: SETUP_LABEL.fortnox }
  const rows = familyRows(input)
  const family = rows.map((r) => r.row)
  const states = rows.map(({ row, parent }) => fortnoxRow(row, parent, family))
  const root = states[0]
  const state = worst(states.map((s) => s.state))
  const stateLabel = SETUP_STATE_LABEL[state]
  const editRoot: SetupTarget = { page: 'edit', customerId: input.root.id }

  const rootSentence = root.state === 'missing'
    ? 'Kunden har inget kundnummer i Fortnox. Det ges vid första Fortnox-utkastet.'
    : root.state === 'partial'
      ? `Kundnummer ${root.number} finns men är inte verifierat mot Fortnox (namn och org.nr).`
      : `Kundnummer ${root.number} är verifierat mot Fortnox (namn och org.nr).`
  const rootShort = root.state === 'missing'
    ? 'Inget kundnummer'
    : root.state === 'partial' ? `Kundnummer ${root.number} finns, ej verifierat` : `Kundnummer ${root.number} verifierat`

  if (input.kind !== 'multisite') {
    return {
      ...base, state, stateLabel, reason: rootSentence, short: rootShort,
      action: state === 'missing' ? 'Tryck för att lägga in kundnumret' : state === 'partial' ? 'Tryck för att verifiera' : 'Tryck för att se kundnumret',
      nextLabel: state === 'missing' ? 'Lägg in kundnummer' : state === 'partial' ? 'Verifiera i Fortnox' : null,
      buttonLabel: state === 'missing' ? 'Lägg in' : state === 'partial' ? 'Verifiera' : null,
      target: editRoot,
    }
  }

  const units = states.slice(1)
  const unitMissing = units.filter((u) => u.state === 'missing').length
  const unitPartial = units.filter((u) => u.state === 'partial').length
  const total = units.length
  const parts: string[] = []
  if (root.state !== 'done') parts.push(`Huvudkontoret: ${rootSentence.charAt(0).toLowerCase()}${rootSentence.slice(1)}`)
  if (unitMissing > 0) parts.push(`${unitMissing} av ${total} ${enheter(total)} har inget eget kundnummer och faktureras inte via huvudkontoret.`)
  if (unitPartial > 0) parts.push(`${unitPartial} av ${total} ${enheter(total)} har kundnummer som inte är verifierat mot Fortnox.`)
  if (parts.length === 0) {
    const own = units.filter((u) => u.state === 'done').length
    parts.push(own > 0
      ? `Huvudkontoret och ${own} ${enheter(own)} med eget bolag är verifierade mot Fortnox. Övriga faktureras via huvudkontoret.`
      : `Kundnummer ${root.number} är verifierat mot Fortnox. Alla enheter faktureras via huvudkontoret.`)
  }
  const unitsWorse = RANK[worst(units.map((u) => u.state))] > RANK[root.state]
  const target: SetupTarget = unitsWorse ? { page: 'record', customerId: input.root.id, tab: 'enheter' } : editRoot
  return {
    ...base, state, stateLabel, reason: parts.join(' '),
    short: unitMissing > 0 ? `${unitMissing} av ${total} ${enheter(total)} saknar kundnummer` : unitPartial > 0 ? `${unitPartial} av ${total} ${enheter(total)} ej verifierade` : rootShort,
    action: unitsWorse ? 'Tryck för att se enheterna' : state === 'missing' ? 'Tryck för att lägga in kundnumret' : state === 'partial' ? 'Tryck för att verifiera' : 'Tryck för att se kundnumret',
    nextLabel: state === 'missing' ? 'Lägg in kundnummer' : state === 'partial' ? 'Verifiera i Fortnox' : null,
    buttonLabel: state === 'missing' || state === 'partial' ? (unitsWorse ? 'Se enheter' : state === 'missing' ? 'Lägg in' : 'Verifiera') : null,
    target,
  }
}

// --- Fakturaväg -----------------------------------------------------------------------

function vagRowState(row: SetupCustomerRow, parent: SetupCustomerRow | null): SetupState {
  if (!billingOwner(row, parent)) return 'na'
  if (!isInvoiceDeliveryMethod(row.invoice_delivery_method)) return 'missing'
  if ((row.invoice_delivery_confirmed_by_name ?? '').startsWith('Kontaktpersonens e-post')) return 'partial'
  return 'done'
}

function vagRowText(row: SetupCustomerRow, state: SetupState): { reason: string; short: string } {
  const method = isInvoiceDeliveryMethod(row.invoice_delivery_method) ? row.invoice_delivery_method : null
  if (state === 'missing' || !method) return { reason: 'Ingen fakturaväg är satt.', short: 'Ingen fakturaväg' }
  const dest = method === 'email' ? row.billing_email : method === 'print' ? row.billing_address : null
  const label = INVOICE_DELIVERY_LABEL[method]
  if (state === 'partial') {
    return {
      reason: `Fakturan går till kontaktpersonens e-post${dest ? ` ${dest}` : ''} eftersom avtalet saknade en användbar fakturauppgift.`,
      short: `Kontaktpersonens e-post${dest ? ` ${dest}` : ''}`,
    }
  }
  const src = row.invoice_delivery_source as InvoiceDeliverySource | null | undefined
  const from = src && INVOICE_DELIVERY_SOURCE_LABEL[src] ? `, satt ur ${INVOICE_DELIVERY_SOURCE_LABEL[src]}` : ''
  const how = method === 'email' ? 'med e-post' : method === 'print' ? 'som brev' : 'som e-faktura'
  return {
    reason: `Fakturan går ${how}${dest ? ` till ${dest}` : ''}${from}.`,
    short: `${label}${dest ? ` till ${dest}` : ''}`,
  }
}

function vagItem(input: SetupInput): SetupItem {
  const base = { key: 'vag' as const, label: SETUP_LABEL.vag }
  const rows = familyRows(input)
  const states = rows.map(({ row, parent }) => ({ row, state: vagRowState(row, parent) }))
  const root = states[0]
  const state = worst(states.map((s) => s.state))
  const rootText = vagRowText(root.row, root.state)
  const firstBad = states.find((s) => s.state === state && (state === 'missing' || state === 'partial'))
  const target: SetupTarget = { page: 'record', customerId: (firstBad ?? root).row.id, tab: 'fakturering' }
  const common = {
    ...base, state, stateLabel: SETUP_STATE_LABEL[state],
    action: 'Tryck för att se fakturavägen',
    nextLabel: state === 'missing' ? 'Sätt fakturaväg' : state === 'partial' ? 'Kontrollera fakturaväg' : null,
    buttonLabel: state === 'missing' ? 'Sätt väg' : state === 'partial' ? 'Kontrollera' : null,
    target,
  }
  if (input.kind !== 'multisite') return { ...common, reason: rootText.reason, short: rootText.short }

  const units = states.slice(1)
  const total = units.length
  const uMissing = units.filter((u) => u.state === 'missing').length
  const uPartial = units.filter((u) => u.state === 'partial').length
  const parts: string[] = []
  if (root.state !== 'done') parts.push(`Huvudkontoret: ${rootText.reason.charAt(0).toLowerCase()}${rootText.reason.slice(1)}`)
  else parts.push(rootText.reason)
  if (uMissing > 0) parts.push(`${uMissing} av ${total} ${enheter(total)} med eget kundkort saknar fakturaväg.`)
  if (uPartial > 0) parts.push(`${uPartial} av ${total} ${enheter(total)} får fakturan till kontaktpersonens e-post som reserv.`)
  return {
    ...common,
    reason: parts.join(' '),
    short: uMissing > 0 ? `${uMissing} av ${total} ${enheter(total)} saknar fakturaväg` : uPartial > 0 ? `${uPartial} av ${total} ${enheter(total)} med reserv` : rootText.short,
  }
}

// --- Schema ------------------------------------------------------------------------------

function isAvropType(t: string | null | undefined): boolean {
  return !!t && /^avropsavtal/i.test(t.trim())
}

/** Horisonten för ett schema: avtalet schemat hör till, annars kundraden med arv från huvudkontoret. */
export function horizonForSchedule(
  schedule: SetupSchedule,
  row: SetupCustomerRow | null,
  parent: SetupCustomerRow | null
): HorizonContract | null {
  const c = schedule.contract
  if (c && (c.contract_start_date || c.start_date || c.contract_end_date)) {
    return {
      contract_start_date: c.contract_start_date ?? c.start_date ?? null,
      contract_end_date: c.contract_end_date ?? null,
      terminated_at: c.terminated_at ?? null,
      effective_end_date: c.effective_end_date ?? null,
      notice_period_months: c.notice_period_months ?? null,
      contract_length: c.contract_length ?? null,
      renewal_mode: c.renewal_mode ?? null,
    }
  }
  if (!row) return null
  const pick = <K extends keyof SetupCustomerRow>(k: K) => (row[k] ?? parent?.[k] ?? null)
  const h: HorizonContract = {
    contract_start_date: pick('contract_start_date') as string | null,
    contract_end_date: pick('contract_end_date') as string | null,
    terminated_at: pick('terminated_at') as string | null,
    effective_end_date: pick('effective_end_date') as string | null,
    notice_period_months: pick('notice_period_months') as number | null,
    contract_length: pick('contract_length') as string | null,
  }
  if (!h.contract_start_date && !h.contract_end_date) return null
  return h
}

interface ScheduleRowState {
  state: SetupState
  reason: string
  short: string
  noTech: boolean
  endsEarly: boolean
}

function scheduleRow(
  row: SetupCustomerRow,
  parent: SetupCustomerRow | null,
  schedules: SetupSchedule[],
  today: string
): ScheduleRowState | null {
  const own = schedules.filter((s) => s.customer_id === row.id)
  if (own.length === 0) return null
  const noTech = own.filter((s) => !s.technician_id)
  let early: { until: string; end: string } | null = null
  for (const s of own) {
    const hc = horizonForSchedule(s, row, parent)
    if (!hc) continue
    const h = scheduleHorizon(hc, today)
    // Hela avtalsåret: planEnd tar med nästa år när sista uppsägningsdag passerat
    const end = h.planEnd ?? h.currentEnd
    if (!end || h.terminated) continue
    // En månads marginal: generated_until kan vara sista utlagda besöket
    // snarare än horisonten, och periodskiftet ligger ofta dagen efter.
    if (!s.generated_until || s.generated_until < addDaysIso(end, -SCHEDULE_MARGIN_DAYS)) {
      early = { until: s.generated_until ?? '', end }
      break
    }
  }
  const s0 = own[0]
  if (noTech.length > 0) {
    return {
      state: 'partial', noTech: true, endsEarly: !!early,
      reason: 'Schemat saknar tekniker.' + (early ? ` Det tar dessutom slut ${early.until || 'utan utlagda besök'}, före avtalsårets slut ${early.end}.` : ''),
      short: 'Schema utan tekniker',
    }
  }
  if (early) {
    return {
      state: 'partial', noTech: false, endsEarly: true,
      reason: early.until
        ? `Schemat tar slut ${early.until}, före avtalsårets slut ${early.end}.`
        : `Schemat har inga besök utlagda för avtalsåret som slutar ${early.end}.`,
      short: early.until ? `Tar slut ${early.until}` : 'Inga besök utlagda',
    }
  }
  const tech = s0.technician_name ? ` med ${s0.technician_name}` : ' med tekniker'
  const until = s0.generated_until ? ` till ${s0.generated_until}` : ''
  return {
    state: 'done', noTech: false, endsEarly: false,
    reason: `${freqText(s0.frequency)}${tech}${until}, hela avtalsåret.`,
    short: `${freqText(s0.frequency)}${s0.technician_name ? `, ${s0.technician_name}` : ''}`,
  }
}

function schemaItem(input: SetupInput, today: string): SetupItem {
  const base = { key: 'schema' as const, label: SETUP_LABEL.schema }
  const target: SetupTarget = { page: 'schema', customerId: input.root.id, query: input.root.company_name?.trim() || '' }
  const rows = familyRows(input)
  const familyIds = new Set(rows.map((r) => r.row.id))
  const types = input.contractTypes.filter((t) => familyIds.has(t.customer_id))
  const avropOnly = types.length > 0
    ? types.every((t) => isAvropType(t.contract_type))
    : isAvropType(input.root.contract_type)
  const onDemand = input.onDemandCustomerIds ?? new Set<string>()

  const evaluated = rows.map(({ row, parent }) => ({ row, s: scheduleRow(row, parent, input.schedules, today) }))
  const withSchedule = evaluated.filter((e) => e.s)

  const mk = (state: SetupState, reason: string, short: string, noTech = false): SetupItem => ({
    ...base, state, stateLabel: SETUP_STATE_LABEL[state], reason, short,
    action: state === 'na' ? null : 'Tryck för att öppna schemat',
    nextLabel: state === 'missing' ? 'Lägg upp schema' : state === 'partial' ? (noTech ? 'Sätt tekniker på schemat' : 'Förläng schemat') : null,
    buttonLabel: state === 'missing' ? 'Lägg upp' : state === 'partial' ? (noTech ? 'Sätt tekniker' : 'Förläng') : null,
    target: state === 'na' ? null : target,
  })

  if (withSchedule.length === 0) {
    const allOnDemand = rows.every(({ row }) => onDemand.has(row.id))
    if (avropOnly || allOnDemand) return mk('na', 'Avrop utan schema: besök bokas vid behov.', 'Avrop utan schema')
    return mk('missing', 'Inga återkommande besök är inplanerade.', 'Inga besök inplanerade')
  }

  if (input.kind !== 'multisite') {
    const s = withSchedule[0].s!
    return mk(s.state, s.reason, s.short, s.noTech)
  }

  // Multisite: enheter utan schema räknas bara när avtalskartan säger att
  // avtalets omfattning kräver schema (samma regel som steget Schema i RPC:n)
  const scheduleRequired = (input.map?.missing ?? []).includes('Schema')
  const units = evaluated.slice(1)
  const total = units.length
  const unitsWithout = scheduleRequired
    ? units.filter((u) => !u.s && !onDemand.has(u.row.id)).length
    : 0
  const noTech = withSchedule.filter((e) => e.s!.noTech).length
  const early = withSchedule.filter((e) => !e.s!.noTech && e.s!.endsEarly).length
  const states: SetupState[] = withSchedule.map((e) => e.s!.state)
  if (unitsWithout > 0) states.push('missing')
  const state = worst(states)
  const parts: string[] = []
  if (unitsWithout > 0) parts.push(`${unitsWithout} av ${total} ${enheter(total)} saknar återkommande besök.`)
  if (noTech > 0) parts.push(`${noTech} ${noTech === 1 ? 'schema saknar' : 'scheman saknar'} tekniker.`)
  if (early > 0) parts.push(`${early} ${early === 1 ? 'schema tar' : 'scheman tar'} slut före avtalsårets slut.`)
  if (parts.length === 0) parts.push(`${withSchedule.length} ${withSchedule.length === 1 ? 'schema' : 'scheman'} med tekniker för hela avtalsåret.`)
  const short = unitsWithout > 0
    ? `${unitsWithout} av ${total} ${enheter(total)} utan schema`
    : noTech > 0 ? `${noTech} utan tekniker` : early > 0 ? `${early} tar slut för tidigt` : `${withSchedule.length} scheman klara`
  return mk(state, parts.join(' '), short, noTech > 0 && unitsWithout === 0)
}

// --- Kundportalen ---------------------------------------------------------------------------

export function isPrivateCustomer(row: Pick<SetupCustomerRow, 'organization_number' | 'business_type'>): boolean {
  return row.business_type === 'private' || isPersonnummer(row.organization_number)
}

function portalItem(input: SetupInput): SetupItem {
  const base = { key: 'portal' as const, label: SETUP_LABEL.portal }
  const target: SetupTarget = { page: 'record', customerId: input.root.id, tab: 'atkomst' }
  if (input.kind !== 'multisite' && isPrivateCustomer(input.root)) {
    return {
      ...base, state: 'na', stateLabel: SETUP_STATE_LABEL.na,
      reason: 'Privatkunder bjuds inte in till kundportalen.', short: 'Privatkund',
      action: null, nextLabel: null, buttonLabel: null, target: null,
    }
  }
  if (input.portal.active || input.portal.invited) {
    return {
      ...base, state: 'done', stateLabel: SETUP_STATE_LABEL.done,
      reason: input.portal.active ? 'Kunden har konto i kundportalen och har loggat in.' : 'Inbjudan till kundportalen är skickad.',
      short: input.portal.active ? 'Konto, har loggat in' : 'Inbjudan skickad',
      action: 'Tryck för att se kontona', nextLabel: null, buttonLabel: null, target,
    }
  }
  return {
    ...base, state: 'missing', stateLabel: SETUP_STATE_LABEL.missing,
    reason: 'Ingen kontakt är inbjuden till kundportalen.', short: 'Ingen kontakt inbjuden',
    action: 'Tryck för att bjuda in', nextLabel: 'Bjud in kontakt', buttonLabel: 'Bjud in', target,
  }
}

// --- Sammanfattning --------------------------------------------------------------------------

export function computeSetupStatus(input: SetupInput): SetupSummary {
  if (input.terminated) {
    return { terminated: true, items: [], remaining: 0, next: null, complete: false }
  }
  const today = input.today ?? todayIso()
  const items = [avtalItem(input), fortnoxItem(input), vagItem(input), schemaItem(input, today), portalItem(input)]
  const open = items.filter((i) => i.state === 'missing' || i.state === 'partial')
  return { terminated: false, items, remaining: open.length, next: open[0] ?? null, complete: open.length === 0 }
}

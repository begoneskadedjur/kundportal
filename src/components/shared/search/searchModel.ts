// src/components/shared/search/searchModel.ts
// Söklådans modell: tolkning av frågan, rollens sidor och åtgärder, och
// omvandling av RPC-svaret (public.global_search) till rader med snabbval.

import type { NavigateFunction } from 'react-router-dom'
import type { SearchIconName, SearchTone } from './SearchIcons'
import {
  topLevelItems as adminTop,
  navGroups as adminGroups,
  breadcrumbMap as adminCrumbs,
} from '../../admin/layout/adminNavConfig'
import {
  topLevelItems as koordTop,
  navGroups as koordGroups,
  breadcrumbMap as koordCrumbs,
} from '../../coordinator/layout/coordinatorNavConfig'
import {
  topLevelItems as techTop,
  navGroups as techGroups,
  breadcrumbMap as techCrumbs,
} from '../../technician/layout/technicianNavConfig'
import type { NavGroup, NavItem } from '../../admin/layout/adminNavConfig'
import { isPrivateIdNumber, openOneflowCreator, type PrefillCustomer } from '../../../utils/oneflowPrefill'

export type SearchPortal = 'admin' | 'koordinator' | 'technician'
export type QueryKind = 'case' | 'number' | 'orgnr' | 'phone' | 'email' | 'postal' | 'text'

export type GroupKey =
  | 'recent'
  | 'exact'
  | 'cases'
  | 'customers'
  | 'documents'
  | 'archive'
  | 'leads'
  | 'technicians'
  | 'invoices'
  | 'pages'
  | 'actions'

export const GROUP_LABELS: Record<GroupKey, string> = {
  recent: 'Senast öppnade',
  exact: 'Exakt träff',
  cases: 'Ärenden',
  customers: 'Kunder',
  documents: 'Dokument',
  archive: 'Arkiv (ClickUp)',
  leads: 'Leads (webb)',
  technicians: 'Tekniker',
  invoices: 'Fakturor',
  pages: 'Sidor',
  actions: 'Åtgärder',
}

const GROUP_ORDER: GroupKey[] = [
  'exact', 'cases', 'customers', 'documents', 'archive', 'leads', 'technicians', 'invoices', 'pages', 'actions',
]

export const MAX_PER_GROUP = 5

export type DotTone = 'ok' | 'info' | 'warn' | 'bad' | 'faint'

export interface SearchChoice {
  label: string
  href?: string
  run?: (navigate: NavigateFunction) => void
}

export interface SearchItem {
  key: string
  group: GroupKey
  icon: SearchIconName
  tone: SearchTone
  title: string
  number?: string | null
  status?: { tone: DotTone; text: string } | null
  meta?: string
  typeLabel: string
  archived?: boolean
  /** Första valet är radens huvudval (Enter) */
  choices: SearchChoice[]
  /** Sparas i Senast öppnade när huvudvalet är en länk */
  recentable?: boolean
}

export interface SearchGroup {
  key: GroupKey
  label: string
  items: SearchItem[]
}

// ---------------------------------------------------------------------------
// Portal och sökvägar
// ---------------------------------------------------------------------------

export const PORTAL_PREFIX: Record<SearchPortal, '/admin' | '/koordinator' | '/technician'> = {
  admin: '/admin',
  koordinator: '/koordinator',
  technician: '/technician',
}

type CaseType = 'private' | 'business' | 'contract'

function caseHref(portal: SearchPortal, id: string, caseType: CaseType) {
  const base = portal === 'technician' ? '/technician/cases' : '/koordinator/arenden'
  return `${base}?openCase=${encodeURIComponent(id)}&caseType=${caseType}`
}

function customerHref(portal: SearchPortal, id: string, tab?: 'utrustning') {
  if (portal === 'technician') return `/technician/equipment/customer/${encodeURIComponent(id)}`
  return `${PORTAL_PREFIX[portal]}/befintliga-kunder/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`
}

function documentHref(portal: SearchPortal, id: string) {
  if (portal === 'admin') return `/admin/dokumentsignering?highlight=${encodeURIComponent(id)}`
  return `${PORTAL_PREFIX[portal]}/dokumentsignering?id=${encodeURIComponent(id)}`
}

// ---------------------------------------------------------------------------
// Tolkning av frågan
// ---------------------------------------------------------------------------

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export interface ParsedQuery {
  /** Det som skickas till databasen (utan verb och utan ordet arkiv) */
  term: string
  kind: QueryKind | null
  includeArchived: boolean
  /** Sökningen började med ett verb: åtgärderna visas först */
  verb: string | null
  raw: string
}

// Längsta först så att "nytt ärende" vinner över "nytt"
const VERBS = [
  'boka in', 'boka', 'ny offert', 'nytt avtal', 'nytt arende', 'ny', 'nytt',
  'skapa offert', 'skapa avtal', 'skapa', 'rapportera', 'hitta ledig tid', 'hitta',
]

export function classifyQuery(term: string): QueryKind | null {
  const q = term.trim().toLowerCase().replace(/\s+/g, ' ')
  if (q.length < 2) return null
  const digits = q.replace(/\D/g, '')
  if (/^be-?\s?\d{1,8}$/.test(q)) return 'case'
  if (q.includes('@')) return 'email'
  if (/^\d{6}-\d{4}$/.test(q) || /^[1-9]\d{9}$/.test(q) || /^(19|20)\d{6}-?\d{4}$/.test(q)) return 'orgnr'
  if (/^\d{3} \d{2}$/.test(q)) return 'postal'
  if (/^(\+46|0)[\d\s-]{6,}$/.test(q) && digits.length >= 8 && digits.length <= 13) return 'phone'
  if (/^\d{1,8}$/.test(q)) return 'number'
  return 'text'
}

export const KIND_LABELS: Record<QueryKind, string> = {
  case: 'ärendenummer',
  number: 'nummer (ärende, kundnummer eller faktura)',
  orgnr: 'org.nr eller personnummer',
  phone: 'telefonnummer',
  email: 'e-post',
  postal: 'postnummer',
  text: 'fritext',
}

export function parseQuery(raw: string): ParsedQuery {
  let words = raw.trim().split(/\s+/).filter(Boolean)
  const includeArchived = words.some(w => normalize(w) === 'arkiv')
  words = words.filter(w => normalize(w) !== 'arkiv')

  let verb: string | null = null
  const joined = normalize(words.join(' '))
  for (const v of VERBS) {
    if (joined === v || joined.startsWith(v + ' ')) {
      verb = v
      words = words.slice(v.split(' ').length)
      break
    }
  }

  // "boka in hos mathias", "ny offert till solgläntan": småord efter verbet tas bort
  if (verb && words.length > 0 && ['hos', 'till', 'for', 'för', 'at', 'åt', 'pa', 'på'].includes(normalize(words[0]))) {
    words = words.slice(1)
  }

  const term = words.join(' ')
  return { term, kind: classifyQuery(term), includeArchived, verb, raw }
}

// ---------------------------------------------------------------------------
// Formatering (svenska format)
// ---------------------------------------------------------------------------

const TZ = 'Europe/Stockholm'

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return ''
  // Rena datum (ÅÅÅÅ-MM-DD) tolkas aldrig som UTC-midnatt
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('sv-SE', { timeZone: TZ })
  if (!withTime) return date
  const time = d.toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  return time === '00:00' ? date : `${date} ${time}`
}

const kr = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
export function formatKr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return ''
  return `${kr.format(Number(value))} kr`
}

function caseStatusTone(status: string | null | undefined): DotTone {
  const s = normalize(status || '')
  if (!s) return 'faint'
  if (/avbrut|stangt|slask|raderad/.test(s)) return 'faint'
  if (/avslutat|slutfort|klar|genomfor|fakturerad|betald/.test(s)) return 'ok'
  if (/bokad|bokat|pagaende|planerad|aterbesok/.test(s)) return 'info'
  if (/reklamation|forsenad/.test(s)) return 'bad'
  return 'warn'
}

const DOC_STATUS: Record<string, { text: string; tone: DotTone }> = {
  pending: { text: 'Väntar på signering', tone: 'warn' },
  signed: { text: 'Signerad', tone: 'ok' },
  active: { text: 'Aktivt', tone: 'ok' },
  overdue: { text: 'Förfallen', tone: 'bad' },
  declined: { text: 'Avböjd', tone: 'faint' },
  ended: { text: 'Avslutat', tone: 'faint' },
}

const INVOICE_STATUS: Record<string, { text: string; tone: DotTone }> = {
  draft: { text: 'Utkast', tone: 'faint' },
  pending_approval: { text: 'Väntar på godkännande', tone: 'warn' },
  ready: { text: 'Klar att skicka', tone: 'info' },
  sent: { text: 'Skickad', tone: 'info' },
  paid: { text: 'Betald', tone: 'ok' },
  overdue: { text: 'Förfallen', tone: 'bad' },
  cancelled: { text: 'Makulerad', tone: 'faint' },
}

const LEAD_STATUS: Record<string, { text: string; tone: DotTone }> = {
  ny: { text: 'Ny', tone: 'info' },
  kontaktad: { text: 'Kontaktad', tone: 'warn' },
  befintlig_kund: { text: 'Befintlig kund', tone: 'ok' },
  offert: { text: 'Offert skickad', tone: 'warn' },
  bokad: { text: 'Bokad', tone: 'ok' },
  skrap: { text: 'Skrap', tone: 'faint' },
}

function prettyStatus(code: string | null | undefined): string {
  if (!code) return ''
  const s = code.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function joinMeta(parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(' · ')
}

// ---------------------------------------------------------------------------
// RPC-svar
// ---------------------------------------------------------------------------

export interface RpcCase {
  kind: 'case'
  id: string
  case_type: CaseType
  number: string | null
  title: string | null
  status: string | null
  date: string | null
  pest: string | null
  address: string | null
  technicians: string | null
  customer_name: string | null
  customer_id: string | null
  scheduled: boolean
  archived: boolean
  exact: boolean
}

export interface RpcCustomer extends PrefillCustomer {
  kind: 'customer'
  id: string
  title: string
  site_name: string | null
  customer_number: number | null
  contract_type: string | null
  is_active: boolean | null
  is_multisite: boolean | null
  site_type: string | null
  exact: boolean
}

export interface RpcDocument {
  kind: 'document'
  id: string
  doc_type: 'offer' | 'contract' | string | null
  title: string
  company_name: string | null
  number: string | null
  status: string | null
  contract_type: string | null
  total_value: number | null
  annual_value: number | null
  end_date: string | null
  date: string | null
  customer_id: string | null
  archived: boolean
}

export interface RpcLead {
  kind: 'lead'
  id: string
  title: string
  name: string | null
  company_name: string | null
  number: string | null
  status: string | null
  pest: string | null
  city: string | null
  date: string | null
}

export interface RpcTechnician {
  kind: 'technician'
  id: string
  title: string
  role: string | null
  email: string | null
  phone: string | null
  is_active: boolean | null
}

export interface RpcInvoice {
  kind: 'invoice'
  id: string
  number: string | null
  fortnox_number: string | null
  title: string
  status: string | null
  total_amount: number | null
  date: string | null
  paid_at: string | null
  due_date: string | null
  exact: boolean
}

export interface GlobalSearchResponse {
  scope: SearchPortal | null
  kind: QueryKind | null
  cases: RpcCase[]
  customers: RpcCustomer[]
  documents: RpcDocument[]
  leads: RpcLead[]
  technicians: RpcTechnician[]
  invoices: RpcInvoice[]
}

// ---------------------------------------------------------------------------
// Rader
// ---------------------------------------------------------------------------

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function caseItem(c: RpcCase, portal: SearchPortal): SearchItem {
  const number = c.number || null
  const rawTitle = (c.title || '').trim()
  const titleIsNumber = !rawTitle || (number && normalize(rawTitle) === normalize(number))
  const title = titleIsNumber ? (c.customer_name || c.pest || c.address || 'Ärende') : rawTitle
  const isContract = c.case_type === 'contract'
  const open: SearchChoice = { label: 'Öppna', href: caseHref(portal, c.id, c.case_type) }
  const choices: SearchChoice[] = [open]

  if (portal !== 'technician' && !c.archived) {
    choices.push(
      c.scheduled
        ? { label: 'Flytta', href: `/koordinator/schema?openCase=${encodeURIComponent(c.id)}` }
        : { label: 'Boka in', href: `/koordinator/schema?scheduleCase=${encodeURIComponent(c.id)}` },
    )
  }
  if (isContract && c.customer_id) {
    choices.push(
      portal === 'technician'
        ? { label: 'Stationsvy', href: customerHref(portal, c.customer_id) }
        : { label: 'Kundkort', href: customerHref(portal, c.customer_id) },
    )
  }

  return {
    key: `case:${c.case_type}:${c.id}`,
    group: c.archived ? 'archive' : c.exact ? 'exact' : 'cases',
    icon: c.archived ? 'arkiv' : isContract ? 'arende-avtal' : 'arende',
    tone: c.archived ? 'arkiv' : 'arende',
    title,
    number,
    status: c.status ? { tone: caseStatusTone(c.status), text: c.archived ? `${c.status} i ClickUp` : c.status } : null,
    meta: joinMeta([
      formatDate(c.date, c.scheduled),
      titleIsNumber ? c.pest : c.customer_name !== title ? c.customer_name : null,
      c.technicians,
    ]),
    typeLabel: c.archived ? 'Arkiv (ClickUp)' : isContract ? 'Avtalsärende' : 'Ärende',
    archived: c.archived,
    choices,
    recentable: true,
  }
}

function customerItem(c: RpcCustomer, portal: SearchPortal): SearchItem {
  const prefix = PORTAL_PREFIX[portal]
  const name = c.site_name && c.is_multisite ? `${c.title}, ${c.site_name}` : c.title
  const customer: PrefillCustomer = c
  const choices: SearchChoice[] =
    portal === 'technician'
      ? [
          { label: 'Öppna stationsvyn', href: customerHref(portal, c.id) },
          { label: 'Skapa offert', run: nav => openOneflowCreator(nav, prefix, 'offer', customer) },
          { label: 'Skapa avtal', run: nav => openOneflowCreator(nav, prefix, 'contract', customer) },
        ]
      : [
          { label: 'Kundkort', href: customerHref(portal, c.id) },
          { label: 'Stationer', href: customerHref(portal, c.id, 'utrustning') },
          { label: 'Ny offert', run: nav => openOneflowCreator(nav, prefix, 'offer', customer) },
          { label: 'Nytt avtal', run: nav => openOneflowCreator(nav, prefix, 'contract', customer) },
        ]

  return {
    key: `customer:${c.id}`,
    group: c.exact ? 'exact' : 'customers',
    icon: isPrivateIdNumber(c.organization_number) ? 'kund-privat' : 'kund-foretag',
    tone: 'kund',
    title: name,
    status: c.is_active === false ? { tone: 'faint', text: 'Avslutad kund' } : null,
    meta: joinMeta([
      c.organization_number,
      c.customer_number ? `kundnr ${c.customer_number}` : null,
      c.contract_type,
    ]),
    typeLabel: portal === 'technician' ? 'Stationsvy' : 'Kund',
    choices,
    recentable: true,
  }
}

function documentItem(d: RpcDocument, portal: SearchPortal): SearchItem {
  const isOffer = d.doc_type === 'offer'
  const st = DOC_STATUS[d.status || ''] || { text: prettyStatus(d.status), tone: 'faint' as DotTone }
  const amount = isOffer
    ? formatKr(d.total_value)
    : d.annual_value
      ? `${formatKr(d.annual_value)}/år`
      : formatKr(d.total_value)
  return {
    key: `document:${d.id}`,
    group: d.archived ? 'archive' : 'documents',
    icon: d.archived ? 'arkiv' : isOffer ? 'offert' : 'avtal',
    tone: d.archived ? 'arkiv' : isOffer ? 'offert' : 'avtal',
    title: d.title,
    number: d.number,
    status: st.text ? { tone: st.tone, text: st.text } : null,
    meta: joinMeta([
      amount,
      !isOffer && d.end_date ? `t.o.m. ${formatDate(d.end_date)}` : formatDate(d.date),
      d.company_name && d.company_name !== d.title ? d.company_name : null,
    ]),
    typeLabel: d.archived ? 'Arkiv (Oneflow)' : isOffer ? 'Offert' : 'Avtal',
    archived: d.archived,
    choices: [{ label: 'Öppna', href: documentHref(portal, d.id) }],
    recentable: true,
  }
}

function leadItem(l: RpcLead, portal: SearchPortal): SearchItem {
  const st = LEAD_STATUS[l.status || ''] || { text: prettyStatus(l.status), tone: 'faint' as DotTone }
  return {
    key: `lead:${l.id}`,
    group: 'leads',
    icon: 'lead-webb',
    tone: 'lead',
    title: l.title,
    number: l.number,
    status: st.text ? { tone: st.tone, text: st.text } : null,
    meta: joinMeta([
      formatDate(l.date),
      l.company_name && l.name && l.name !== l.title ? l.name : null,
      l.pest,
      l.city,
    ]),
    typeLabel: 'Lead, webb',
    choices: [{ label: 'Öppna', href: `${PORTAL_PREFIX[portal]}/leads-webb?id=${encodeURIComponent(l.id)}` }],
    recentable: true,
  }
}

function technicianItem(t: RpcTechnician, portal: SearchPortal): SearchItem {
  const choices: SearchChoice[] = [
    { label: 'Schemat', href: `/koordinator/schema?tech=${encodeURIComponent(t.id)}` },
    { label: 'Bokningsassistent', href: `/koordinator/booking-assistant?tech=${encodeURIComponent(t.id)}` },
  ]
  if (portal === 'admin') {
    choices.push({ label: 'Personalkort', href: `/admin/anvandarkonton-personal?id=${encodeURIComponent(t.id)}` })
  }
  return {
    key: `technician:${t.id}`,
    group: 'technicians',
    icon: 'tekniker',
    tone: 'tekniker',
    title: t.title,
    status: t.is_active === false ? { tone: 'faint', text: 'Inaktiv' } : null,
    meta: joinMeta([t.role, t.phone, t.email]),
    typeLabel: 'Tekniker',
    choices,
    recentable: true,
  }
}

function invoiceItem(i: RpcInvoice, portal: SearchPortal): SearchItem {
  const st = INVOICE_STATUS[i.status || ''] || { text: prettyStatus(i.status), tone: 'faint' as DotTone }
  const statusText = i.status === 'paid' && i.paid_at ? `Betald ${formatDate(i.paid_at)}` : st.text
  return {
    key: `invoice:${i.id}`,
    group: i.exact ? 'exact' : 'invoices',
    icon: 'faktura',
    tone: 'faktura',
    title: i.title,
    number: i.number,
    status: statusText ? { tone: st.tone, text: statusText } : null,
    meta: joinMeta([
      formatKr(i.total_amount),
      i.status === 'paid' ? null : formatDate(i.date),
      i.fortnox_number ? `Fortnox ${i.fortnox_number}` : null,
    ]),
    typeLabel: 'Faktura',
    choices: [{ label: 'Öppna', href: `${PORTAL_PREFIX[portal]}/fakturering?invoiceId=${encodeURIComponent(i.id)}` }],
    recentable: true,
  }
}

// ---------------------------------------------------------------------------
// Sidor (ur menykonfigurationerna)
// ---------------------------------------------------------------------------

interface PageEntry { label: string; path: string; section: string }

function pagesFrom(top: NavItem[], groups: NavGroup[], crumbs: Record<string, string>, extra: PageEntry[] = []): PageEntry[] {
  const out: PageEntry[] = []
  const seen = new Set<string>()
  const add = (p: PageEntry) => {
    if (seen.has(p.path)) return
    seen.add(p.path)
    out.push(p)
  }
  for (const item of top) add({ label: item.label, path: item.path, section: 'Översikt' })
  for (const g of groups) {
    for (const item of g.items) {
      // Externa poster och poster som kräver särskild åtkomst hoppas över
      if (item.externalUrl || item.requires) continue
      add({ label: item.label, path: item.path, section: g.label })
    }
  }
  for (const p of extra) add(p)
  for (const [path, label] of Object.entries(crumbs)) {
    if (path.includes('/guides/') || path.includes('/organisation/') || path.endsWith('/upphandlingar')) continue
    add({ label, path, section: 'Sida' })
  }
  return out
}

const PAGES: Record<SearchPortal, PageEntry[]> = {
  admin: pagesFrom(adminTop, adminGroups, adminCrumbs, [
    { label: 'Ärenden', path: '/koordinator/arenden', section: 'Planering' },
    { label: 'Schema & Planering', path: '/koordinator/schema', section: 'Planering' },
    { label: 'Bokningsassistent', path: '/koordinator/booking-assistant', section: 'Planering' },
  ]),
  koordinator: pagesFrom(koordTop, koordGroups, koordCrumbs, [
    { label: 'Schema & Planering', path: '/koordinator/schema', section: 'Planering' },
  ]),
  technician: pagesFrom(techTop, techGroups, techCrumbs),
}

function matchesAll(haystack: string, tokens: string[]): boolean {
  const h = normalize(haystack)
  return tokens.every(t => h.includes(t))
}

function pageItems(portal: SearchPortal, term: string): SearchItem[] {
  const tokens = normalize(term).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  return PAGES[portal]
    .filter(p => matchesAll(`${p.label} ${p.section}`, tokens))
    .sort((a, b) => Number(matchesAll(b.label, tokens)) - Number(matchesAll(a.label, tokens)))
    .slice(0, MAX_PER_GROUP)
    .map(p => ({
      key: `page:${p.path}`,
      group: 'pages' as const,
      icon: 'sida' as const,
      tone: 'nav' as const,
      title: p.label,
      meta: p.section === 'Sida' ? '' : p.section,
      typeLabel: 'Sida',
      choices: [{ label: 'Gå till', href: p.path }],
      recentable: true,
    }))
}

// ---------------------------------------------------------------------------
// Åtgärder
// ---------------------------------------------------------------------------

interface ActionDef {
  key: string
  title: string
  meta: string
  /** Sökord, normaliserade (utan å/ä/ö) */
  words: string
  choice: SearchChoice
  /** Visas när sökrutan är tom */
  common?: boolean
}

function baseActions(portal: SearchPortal): ActionDef[] {
  const prefix = PORTAL_PREFIX[portal]
  const incident: ActionDef = {
    key: 'action:tillbud',
    title: 'Rapportera tillbud',
    meta: 'Tillbud, avvikelse eller olycka',
    words: 'rapportera tillbud avvikelse olycka incident',
    choice: { label: 'Öppna', href: `${prefix}/tillbud-avvikelser?new=1` },
    common: true,
  }

  if (portal === 'technician') {
    return [
      {
        key: 'action:offert', title: 'Skapa offert', meta: 'Öppnar offertguiden',
        words: 'skapa ny offert', common: true,
        choice: { label: 'Öppna', run: nav => openOneflowCreator(nav, prefix, 'offer') },
      },
      {
        key: 'action:avtal', title: 'Skapa avtal', meta: 'Öppnar avtalsguiden',
        words: 'skapa nytt avtal', common: true,
        choice: { label: 'Öppna', run: nav => openOneflowCreator(nav, prefix, 'contract') },
      },
      incident,
      {
        key: 'action:schema', title: 'Mitt schema', meta: 'Dina bokade besök',
        words: 'mitt schema kalender bokningar', common: true,
        choice: { label: 'Öppna', href: '/technician/schedule' },
      },
    ]
  }

  return [
    {
      key: 'action:nytt-arende', title: 'Nytt ärende', meta: 'Privat, företag eller avtal',
      words: 'nytt arende skapa boka ny', common: true,
      choice: { label: 'Öppna', href: '/koordinator/schema?newCase=1' },
    },
    {
      key: 'action:ledig-tid', title: 'Hitta ledig tid', meta: 'Öppnar bokningsassistenten',
      words: 'hitta ledig tid boka in bokningsassistent', common: true,
      choice: { label: 'Öppna', href: '/koordinator/booking-assistant' },
    },
    incident,
    {
      key: 'action:offert', title: 'Ny offert', meta: 'Öppnar offertguiden',
      words: 'ny skapa offert',
      choice: { label: 'Öppna', run: nav => openOneflowCreator(nav, prefix, 'offer') },
    },
    {
      key: 'action:avtal', title: 'Nytt avtal', meta: 'Öppnar avtalsguiden',
      words: 'nytt skapa avtal',
      choice: { label: 'Öppna', run: nav => openOneflowCreator(nav, prefix, 'contract') },
    },
  ]
}

function actionToItem(a: ActionDef): SearchItem {
  return {
    key: a.key,
    group: 'actions',
    icon: 'atgard',
    tone: 'atgard',
    title: a.title,
    meta: a.meta,
    typeLabel: 'Åtgärd',
    choices: [a.choice],
  }
}

/** Åtgärder för den aktuella frågan, inklusive "Boka in hos …" och "Ny offert till …". */
function actionItems(
  portal: SearchPortal,
  parsed: ParsedQuery,
  topCustomer: RpcCustomer | undefined,
  topTechnician: RpcTechnician | undefined,
): SearchItem[] {
  const prefix = PORTAL_PREFIX[portal]
  const out: SearchItem[] = []
  const verb = parsed.verb ? normalize(parsed.verb) : ''

  // Kontextuella åtgärder från bästa träffen
  if (topTechnician && portal !== 'technician' && (!verb || verb.startsWith('boka') || verb.startsWith('hitta'))) {
    const first = firstWord(topTechnician.title)
    out.push({
      key: `action:boka-hos:${topTechnician.id}`,
      group: 'actions',
      icon: 'atgard',
      tone: 'atgard',
      title: `Boka in ärende hos ${first}`,
      meta: `Öppnar bokningsassistenten med ${first} vald`,
      typeLabel: 'Åtgärd',
      choices: [{ label: 'Öppna', href: `/koordinator/booking-assistant?tech=${encodeURIComponent(topTechnician.id)}` }],
    })
  }
  // Söker man på en tekniker handlar åtgärderna om bokning, inte om kunder
  if (topCustomer && (verb || !topTechnician)) {
    const name = topCustomer.title
    const wantsOffer = !verb || verb.includes('offert') || verb === 'ny' || verb === 'skapa'
    const wantsContract = !verb || verb.includes('avtal') || verb === 'nytt' || verb === 'skapa'
    const offerTitle = portal === 'technician' ? `Skapa offert för ${name}` : `Ny offert till ${name}`
    const contractTitle = portal === 'technician' ? `Skapa avtal för ${name}` : `Nytt avtal för ${name}`
    if (wantsOffer) {
      out.push({
        key: `action:offert-kund:${topCustomer.id}`,
        group: 'actions', icon: 'atgard', tone: 'atgard',
        title: offerTitle, meta: 'Öppnar offertguiden med kunden ifylld', typeLabel: 'Åtgärd',
        choices: [{ label: 'Öppna', run: nav => openOneflowCreator(nav, prefix, 'offer', topCustomer) }],
      })
    }
    if (wantsContract) {
      out.push({
        key: `action:avtal-kund:${topCustomer.id}`,
        group: 'actions', icon: 'atgard', tone: 'atgard',
        title: contractTitle, meta: 'Öppnar avtalsguiden med kunden ifylld', typeLabel: 'Åtgärd',
        choices: [{ label: 'Öppna', run: nav => openOneflowCreator(nav, prefix, 'contract', topCustomer) }],
      })
    }
    if (portal !== 'technician' && topCustomer.contract_type && (!verb || verb.includes('arende') || verb.startsWith('boka') || verb === 'nytt')) {
      out.push({
        key: `action:arende-kund:${topCustomer.id}`,
        group: 'actions', icon: 'atgard', tone: 'atgard',
        title: `Nytt ärende hos ${name}`, meta: 'Avtalsärende med kunden vald', typeLabel: 'Åtgärd',
        choices: [{ label: 'Öppna', href: `/koordinator/schema?newCase=1&customerId=${encodeURIComponent(topCustomer.id)}` }],
      })
    }
  }

  // Fasta åtgärder: med verb filtreras de på verbet, annars på hela frågan
  const defs = baseActions(portal)
  const tokens = verb
    ? verb.split(' ')
    : normalize(parsed.term).split(/\s+/).filter(Boolean)
  for (const a of defs) {
    const words = `${normalize(a.title)} ${a.words}`
    const hit = tokens.length > 0 && tokens.every(t => words.split(' ').some(w => w.startsWith(t)))
    if (hit) out.push(actionToItem(a))
  }

  const seen = new Set<string>()
  return out.filter(i => (seen.has(i.key) ? false : (seen.add(i.key), true))).slice(0, MAX_PER_GROUP)
}

export function commonActions(portal: SearchPortal): SearchItem[] {
  return baseActions(portal).filter(a => a.common).map(actionToItem)
}

// ---------------------------------------------------------------------------
// Sammanställning
// ---------------------------------------------------------------------------

export function buildGroups(
  portal: SearchPortal,
  parsed: ParsedQuery,
  data: GlobalSearchResponse | null,
): SearchGroup[] {
  const buckets: Record<GroupKey, SearchItem[]> = {
    recent: [], exact: [], cases: [], customers: [], documents: [], archive: [],
    leads: [], technicians: [], invoices: [], pages: [], actions: [],
  }

  if (data) {
    for (const c of data.cases || []) {
      const it = caseItem(c, portal)
      buckets[it.group].push(it)
    }
    for (const c of data.customers || []) {
      const it = customerItem(c, portal)
      buckets[it.group].push(it)
    }
    for (const d of data.documents || []) {
      const it = documentItem(d, portal)
      buckets[it.group].push(it)
    }
    if (portal !== 'technician') {
      for (const l of data.leads || []) buckets.leads.push(leadItem(l, portal))
      for (const t of data.technicians || []) buckets.technicians.push(technicianItem(t, portal))
      for (const i of data.invoices || []) {
        const it = invoiceItem(i, portal)
        buckets[it.group].push(it)
      }
    }
  }

  if (parsed.kind === 'text' || (parsed.verb && !parsed.term)) {
    buckets.pages = parsed.term ? pageItems(portal, parsed.term) : []
  }

  const topCustomer = data?.customers?.[0]
  const topTechnician = portal !== 'technician' ? data?.technicians?.[0] : undefined
  buckets.actions = actionItems(portal, parsed, topCustomer, topTechnician)

  let order = GROUP_ORDER
  if (parsed.verb) {
    order = ['actions', ...GROUP_ORDER.filter(g => g !== 'actions')]
  }

  return order
    .map(key => ({ key, label: GROUP_LABELS[key], items: buckets[key].slice(0, MAX_PER_GROUP) }))
    .filter(g => g.items.length > 0)
}

// ---------------------------------------------------------------------------
// Senast öppnade (localStorage per användare och portal)
// ---------------------------------------------------------------------------

export interface RecentEntry {
  key: string
  icon: SearchIconName
  tone: SearchTone
  title: string
  number?: string | null
  meta?: string
  typeLabel: string
  href: string
}

const MAX_RECENT = 6

function recentKey(portal: SearchPortal, userId: string) {
  return `begone.globalSearch.recent.${portal}.${userId}`
}

export function readRecent(portal: SearchPortal, userId: string | undefined): RecentEntry[] {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(recentKey(portal, userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as RecentEntry[]).filter(e => e && e.key && e.href) : []
  } catch {
    return []
  }
}

export function pushRecent(portal: SearchPortal, userId: string | undefined, item: SearchItem, href: string) {
  if (!userId || !item.recentable) return
  try {
    const entry: RecentEntry = {
      key: item.key, icon: item.icon, tone: item.tone, title: item.title,
      number: item.number, meta: item.meta, typeLabel: item.typeLabel, href,
    }
    const next = [entry, ...readRecent(portal, userId).filter(e => e.key !== item.key)].slice(0, MAX_RECENT)
    localStorage.setItem(recentKey(portal, userId), JSON.stringify(next))
  } catch {
    // localStorage kan vara blockerad; senast öppnade är bara en bekvämlighet
  }
}

export function recentToItem(e: RecentEntry): SearchItem {
  return {
    key: e.key,
    group: 'recent',
    icon: e.icon,
    tone: e.tone,
    title: e.title,
    number: e.number,
    meta: e.meta,
    typeLabel: e.typeLabel,
    choices: [{ label: 'Öppna', href: e.href }],
    recentable: true,
  }
}

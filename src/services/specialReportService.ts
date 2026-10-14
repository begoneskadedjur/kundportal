// src/services/specialReportService.ts
// Specialrapporter (3.50.0, delar med färg 3.51.0): en fri rapport kopplad till
// ett ärende, uppbyggd av delar (tabellen special_report_sections) med block (text, händelser, bilder, kartutsnitt). Kontrakt:
// docs/specialrapporter/KONTRAKT.md. Behörigheten sköts av RLS
// (can_access_special_report: admin, koordinator, tekniker på ärendet och skaparen).
// PDF och utskick går via api/special-report-pdf.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { compressToWebP } from '../utils/imageUtils'
import { formatAddress } from '../utils/addressFormatter'
import { resolveFortnoxCustomerNumber } from '../utils/fortnoxCustomerResolver'
import { orgDigits } from '../shared/fortnoxCustomerNumbers'
import type {
  SpecialReport,
  SpecialReportBlock,
  SpecialReportBlockType,
  SpecialReportCaseOption,
  SpecialReportCaseType,
  SpecialReportDocType,
  SpecialReportEvent,
  SpecialReportEventType,
  SpecialReportFull,
  SpecialReportImage,
  SpecialReportImportCandidate,
  SpecialReportListItem,
  SpecialReportSection,
  SpecialReportSectionLabel,
  SpecialReportStart,
  SpecialReportVersion,
  LatLng,
} from '../types/specialReport'
import { SECTION_COLORS } from '../types/specialReport'

// Tabellerna finns inte i de genererade typerna; otypad klient för just dessa anrop
const db = supabase as unknown as SupabaseClient

const BUCKET = 'special-reports'
const SIGNED_URL_SECONDS = 3600
// Bildtyper som kan lagras och visas i rapporten, med filändelse per typ
const BILD_ANDELSER: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
}

type SectionWithContent = SpecialReportSection & {
  blocks: SpecialReportBlock[]
  events: SpecialReportEvent[]
  images: SpecialReportImage[]
}

/** Delens färg: #rrggbb (samma regel som check-constrainten) */
function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

/**
 * Nästa färg för en ny del: första i SECTION_COLORS som inte används i
 * rapporten, annars i tur och ordning efter antalet delar.
 */
export function nextSectionColor(used: (string | null | undefined)[]): string {
  const taken = new Set(used.filter(isColor).map(c => c.toLowerCase()))
  const free = SECTION_COLORS.find(c => !taken.has(c.value.toLowerCase()))
  return (free ?? SECTION_COLORS[used.length % SECTION_COLORS.length]).value
}

/**
 * Färgerna som redan används av rapportens delar. En del utan färg räknas med
 * den färg den visas i (paletten i tur och ordning, som fargForDel)
 */
async function usedSectionColors(reportId: string): Promise<string[]> {
  const { data } = await db
    .from('special_report_sections')
    .select('color, position, created_at')
    .eq('report_id', reportId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  return ((data ?? []) as { color: string | null }[]).map((r, i) =>
    isColor(r.color) ? r.color : SECTION_COLORS[i % SECTION_COLORS.length].value
  )
}

function fel(error: { message?: string } | null | undefined, standard: string): never {
  throw new Error(error?.message ? `${standard}: ${error.message}` : standard)
}

/** ÅÅÅÅ-MM-DD i svensk tid för en tidsstämpel */
function swedishDate(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

/** Tecken som bryter PostgREST:s or-filter tas bort ur söksträngen */
function cleanQuery(query: string): string {
  return query.replace(/[,()%*\\"]/g, ' ').replace(/\s+/g, ' ').trim()
}

function nonEmpty(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s ? s : null
}

/** Ett ensamt aktivt kundnummer i Fortnox-spegeln per org.nr (aldrig gissning vid flera) */
async function mirrorNumbersByDigits(digitsList: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const unique = [...new Set(digitsList.filter(Boolean))]
  if (unique.length === 0) return result
  const { data } = await db
    .from('fortnox_customer_numbers')
    .select('customer_number, org_digits, active, missing_since')
    .in('org_digits', unique)
  const byDigits = new Map<string, string[]>()
  for (const row of (data ?? []) as { customer_number: string; org_digits: string | null; active: boolean; missing_since: string | null }[]) {
    if (!row.org_digits || !row.active || row.missing_since) continue
    const list = byDigits.get(row.org_digits) ?? []
    list.push(row.customer_number)
    byDigits.set(row.org_digits, list)
  }
  for (const [digits, numbers] of byDigits) {
    if (numbers.length === 1) result.set(digits, numbers[0])
  }
  return result
}

interface CaseRowContract {
  id: string
  case_number: string | null
  title: string | null
  customer_id: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  address: unknown
  service_type: string | null
  pest_type: string | null
  created_at: string
  customer: { company_name: string | null; customer_number: number | null } | null
}

interface CaseRowClickUp {
  id: string
  case_number: string | null
  title: string | null
  kontaktperson: string | null
  e_post_kontaktperson: string | null
  telefon_kontaktperson: string | null
  adress: unknown
  skadedjur: string | null
  created_at: string
  company_name?: string | null
  org_nr?: string | null
  personnummer?: string | null
}

async function nextPosition(table: string, column: string, id: string): Promise<number> {
  const { data } = await db
    .from(table)
    .select('position')
    .eq(column, id)
    .order('position', { ascending: false })
    .limit(1)
  const top = (data as { position: number }[] | null)?.[0]?.position
  return typeof top === 'number' ? top + 1 : 0
}

async function signImages(images: SpecialReportImage[]): Promise<SpecialReportImage[]> {
  if (images.length === 0) return images
  const { data } = await db.storage.from(BUCKET).createSignedUrls(images.map(i => i.storage_path), SIGNED_URL_SECONDS)
  const urls = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl)
  }
  return images.map(i => ({ ...i, url: urls.get(i.storage_path) }))
}

async function readApiError(res: Response, standard: string): Promise<never> {
  let message = standard
  try {
    const body = await res.json()
    if (body?.error) message = String(body.error)
  } catch {
    // svaret var inte JSON
  }
  throw new Error(message)
}

export class SpecialReportService {
  // ==========================================================================
  // Lista och sök
  // ==========================================================================

  /** Alla rapporter användaren når (RLS), senast ändrad först */
  static async list(): Promise<SpecialReportListItem[]> {
    const { data: reports, error } = await db
      .from('special_reports')
      .select('id, title, doc_type, case_id, case_type, case_number, customer_name, customer_number, current_version, updated_at, updated_by')
      .order('updated_at', { ascending: false })
      .limit(1000)
    if (error) fel(error, 'Rapporterna kunde inte hämtas')
    const rows = (reports ?? []) as (Pick<SpecialReport,
      'id' | 'title' | 'doc_type' | 'case_id' | 'case_type' | 'case_number' | 'customer_name' |
      'customer_number' | 'current_version' | 'updated_at' | 'updated_by'>)[]
    if (rows.length === 0) return []

    const reportIds = rows.map(r => r.id)
    const [sectionsRes, versionsRes] = await Promise.all([
      db.from('special_report_sections').select('id, report_id').in('report_id', reportIds),
      db.from('special_report_versions').select('report_id, version, sent_at').in('report_id', reportIds),
    ])
    if (sectionsRes.error) fel(sectionsRes.error, 'Rapporternas delar kunde inte hämtas')
    const sections = (sectionsRes.data ?? []) as { id: string; report_id: string }[]
    const sectionReport = new Map(sections.map(s => [s.id, s.report_id]))

    const eventCounts = new Map<string, number>()
    if (sections.length > 0) {
      const { data: events, error: eventsError } = await db
        .from('special_report_events')
        .select('section_id')
        .in('section_id', sections.map(s => s.id))
      if (eventsError) fel(eventsError, 'Rapporternas händelser kunde inte hämtas')
      for (const e of (events ?? []) as { section_id: string }[]) {
        const reportId = sectionReport.get(e.section_id)
        if (reportId) eventCounts.set(reportId, (eventCounts.get(reportId) ?? 0) + 1)
      }
    }

    const sectionCounts = new Map<string, number>()
    for (const s of sections) sectionCounts.set(s.report_id, (sectionCounts.get(s.report_id) ?? 0) + 1)

    const lastSent = new Map<string, { version: number; sent_at: string | null }>()
    for (const v of (versionsRes.data ?? []) as { report_id: string; version: number; sent_at: string | null }[]) {
      const current = lastSent.get(v.report_id)
      if (!current || v.version > current.version) lastSent.set(v.report_id, { version: v.version, sent_at: v.sent_at })
    }

    // Namn på den som ändrade senast, bara de profiler användaren får läsa
    const names = new Map<string, string>()
    const userIds = [...new Set(rows.map(r => r.updated_by).filter((id): id is string => !!id))]
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds)
      for (const p of (profiles ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
        const name = nonEmpty(p.display_name) ?? nonEmpty(p.email)
        if (name) names.set(p.user_id, name)
      }
    }

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      doc_type: r.doc_type,
      case_id: r.case_id,
      case_type: r.case_type,
      case_number: r.case_number,
      customer_name: r.customer_name,
      customer_number: r.customer_number,
      section_count: sectionCounts.get(r.id) ?? 0,
      event_count: eventCounts.get(r.id) ?? 0,
      current_version: r.current_version,
      last_sent_at: lastSent.get(r.id)?.sent_at ?? null,
      last_sent_version: lastSent.get(r.id)?.version ?? null,
      updated_at: r.updated_at,
      updated_by_name: r.updated_by ? names.get(r.updated_by) ?? null : null,
    }))
  }

  /** Ärenden att koppla en ny rapport till: BE-nummer, kundnamn eller kontaktperson. RLS avgör urvalet. */
  static async searchCases(query: string): Promise<SpecialReportCaseOption[]> {
    const q = cleanQuery(query)
    if (q.length < 2) return []
    const like = `%${q}%`

    // Avtalskunder vars namn matchar, för att hitta deras ärenden
    const { data: customerHits } = await db
      .from('customers')
      .select('id')
      .ilike('company_name', like)
      .limit(50)
    const customerIds = ((customerHits ?? []) as { id: string }[]).map(c => c.id)

    const contractFilter = [
      `case_number.ilike.${like}`,
      `title.ilike.${like}`,
      `contact_person.ilike.${like}`,
      ...(customerIds.length > 0 ? [`customer_id.in.(${customerIds.join(',')})`] : []),
    ].join(',')
    const privateFilter = [
      `case_number.ilike.${like}`,
      `title.ilike.${like}`,
      `kontaktperson.ilike.${like}`,
    ].join(',')
    const businessFilter = [
      `case_number.ilike.${like}`,
      `title.ilike.${like}`,
      `kontaktperson.ilike.${like}`,
      `company_name.ilike.${like}`,
      `bestallare.ilike.${like}`,
    ].join(',')

    const clickUpColumns = 'id, case_number, title, kontaktperson, e_post_kontaktperson, telefon_kontaktperson, adress, skadedjur, created_at'
    const [contractRes, privateRes, businessRes] = await Promise.all([
      db.from('cases')
        .select('id, case_number, title, customer_id, contact_person, contact_email, contact_phone, address, service_type, pest_type, created_at, customer:customers(company_name, customer_number)')
        .or(contractFilter)
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('private_cases')
        .select(`${clickUpColumns}, personnummer`)
        .or(privateFilter)
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('business_cases')
        .select(`${clickUpColumns}, company_name, org_nr`)
        .or(businessFilter)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (contractRes.error && privateRes.error && businessRes.error) {
      fel(contractRes.error, 'Ärendena kunde inte sökas')
    }

    const contractRows = (contractRes.data ?? []) as unknown as CaseRowContract[]
    const privateRows = (privateRes.data ?? []) as unknown as CaseRowClickUp[]
    const businessRows = (businessRes.data ?? []) as unknown as CaseRowClickUp[]

    // Kundnummer för privat- och företagsärenden via Fortnox-spegeln (org.nr/personnummer)
    const digitsFor = (row: CaseRowClickUp) => orgDigits(row.org_nr ?? row.personnummer ?? null)
    const mirror = await mirrorNumbersByDigits(
      [...privateRows, ...businessRows].map(digitsFor).filter((d): d is string => !!d)
    ).catch(() => new Map<string, string>())

    const options: (SpecialReportCaseOption & { created_at: string })[] = []
    for (const r of contractRows) {
      options.push({
        case_id: r.id,
        case_type: 'contract',
        case_number: r.case_number,
        title: r.title,
        customer_id: r.customer_id,
        customer_name: r.customer?.company_name ?? null,
        customer_number: r.customer?.customer_number != null ? String(r.customer.customer_number) : null,
        contact_name: r.contact_person,
        contact_email: r.contact_email,
        contact_phone: r.contact_phone,
        address: nonEmpty(formatAddress(r.address)),
        service: nonEmpty(r.service_type) ?? nonEmpty(r.pest_type),
        created_at: r.created_at,
      })
    }
    const pushClickUp = (r: CaseRowClickUp, caseType: SpecialReportCaseType) => {
      const digits = digitsFor(r)
      options.push({
        case_id: r.id,
        case_type: caseType,
        case_number: r.case_number,
        title: r.title,
        customer_id: null,
        customer_name: caseType === 'business' ? nonEmpty(r.company_name) ?? r.kontaktperson : r.kontaktperson,
        customer_number: digits ? mirror.get(digits) ?? null : null,
        contact_name: r.kontaktperson,
        contact_email: r.e_post_kontaktperson,
        contact_phone: r.telefon_kontaktperson,
        address: nonEmpty(formatAddress(r.adress)),
        service: nonEmpty(r.skadedjur),
        created_at: r.created_at,
      })
    }
    privateRows.forEach(r => pushClickUp(r, 'private'))
    businessRows.forEach(r => pushClickUp(r, 'business'))

    return options
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 20)
      .map(o => {
        const rest: SpecialReportCaseOption & { created_at?: string } = { ...o }
        delete rest.created_at
        return rest
      })
  }

  // ==========================================================================
  // Skapa och läsa
  // ==========================================================================

  /** Skapar rapporten med ögonblicksbild av ärendet och returnerar id */
  static async create(input: {
    caseOption: SpecialReportCaseOption
    title: string
    docType: SpecialReportDocType
    start: SpecialReportStart
    copyFromReportId?: string
  }): Promise<string> {
    const opt = input.caseOption
    const title = input.title.trim()
    if (!title) throw new Error('Rapporten behöver en rubrik')

    let customerNumber = opt.customer_number
    if (!customerNumber && opt.case_type === 'contract' && opt.customer_id) {
      const resolved = await resolveFortnoxCustomerNumber(opt.customer_id).catch(() => null)
      customerNumber = resolved != null ? String(resolved) : null
    }

    let source: SpecialReportFull | null = null
    if (input.start === 'kopia') {
      if (!input.copyFromReportId) throw new Error('Välj vilken rapport som ska kopieras')
      source = await SpecialReportService.get(input.copyFromReportId)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Du är inte inloggad')

    const { data: created, error } = await db
      .from('special_reports')
      .insert({
        title,
        doc_type: input.docType,
        case_id: opt.case_id,
        case_type: opt.case_type,
        case_number: opt.case_number,
        customer_id: opt.customer_id,
        customer_name: opt.customer_name,
        customer_number: customerNumber,
        contact_name: opt.contact_name,
        contact_email: opt.contact_email,
        contact_phone: opt.contact_phone,
        address: opt.address,
        // En kopia tar med översiktskartan, annars hänger områdena i luften
        map_view: source?.map_view ?? null,
        intro: source?.intro ?? null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single()
    if (error || !created) fel(error, 'Rapporten kunde inte skapas')
    const reportId = (created as { id: string }).id

    try {
      if (input.start === 'per_besok') {
        await SpecialReportService.createSectionsPerVisit(reportId)
      } else if (input.start === 'kopia' && source) {
        await SpecialReportService.copySections(reportId, source)
      }
    } catch (err) {
      // Halvfärdig rapport städas bort så att listan inte fylls med skal
      await db.from('special_reports').delete().eq('id', reportId)
      throw err instanceof Error ? err : new Error('Rapportens innehåll kunde inte skapas')
    }

    return reportId
  }

  private static async createSectionsPerVisit(reportId: string): Promise<void> {
    const candidates = await SpecialReportService.getImportCandidates(reportId)
    await SpecialReportService.createSectionsFromCandidates(reportId, candidates)
  }

  /**
   * En del per kandidat (etikett besok, rubrik "Besök ÅÅÅÅ-MM-DD") med ett
   * händelseblock och händelsen. Läggs sist i rapporten med nästa lediga färg.
   */
  private static async createSectionsFromCandidates(
    reportId: string,
    candidates: SpecialReportImportCandidate[]
  ): Promise<SectionWithContent[]> {
    const sorted = [...candidates].sort((a, b) => a.event_date.localeCompare(b.event_date))
    if (sorted.length === 0) return []
    const startPosition = await nextPosition('special_report_sections', 'report_id', reportId)
    const used = await usedSectionColors(reportId)
    const created: SectionWithContent[] = []
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i]
      const color = nextSectionColor(used)
      used.push(color)
      const { data: section, error } = await db
        .from('special_report_sections')
        .insert({ report_id: reportId, position: startPosition + i, title: `Besök ${c.event_date}`, label: 'besok', color })
        .select('*')
        .single()
      if (error || !section) fel(error, 'Delen för besöket kunde inte skapas')
      const sectionRow = section as SpecialReportSection
      const { data: block, error: blockError } = await db
        .from('special_report_blocks')
        .insert({ section_id: sectionRow.id, position: 0, type: 'events', content: {} })
        .select('*')
        .single()
      if (blockError || !block) fel(blockError, 'Händelseblocket kunde inte skapas')
      const { data: event, error: eventError } = await db
        .from('special_report_events')
        .insert({
          section_id: sectionRow.id,
          event_date: c.event_date,
          type: c.type,
          title: c.title,
          description: c.description,
          source: c.source,
          source_id: c.source_id,
        })
        .select('*')
        .single()
      if (eventError || !event) fel(eventError, 'Händelsen kunde inte sparas')
      created.push({
        ...sectionRow,
        blocks: [block as SpecialReportBlock],
        events: [event as SpecialReportEvent],
        images: [],
      })
    }
    return created
  }

  /**
   * "Skapa en del per besök" i redigeraren: ärendets besök som inte finns i
   * rapporten än blir en del var. Returnerar de nya delarna i ordning.
   */
  static async createSectionsForVisits(reportId: string): Promise<SectionWithContent[]> {
    const candidates = await SpecialReportService.getImportCandidates(reportId)
    return SpecialReportService.createSectionsFromCandidates(
      reportId,
      candidates.filter(c => c.source === 'visit' && !c.already_imported)
    )
  }

  private static async copySections(reportId: string, source: SpecialReportFull): Promise<void> {
    for (const s of source.sections) {
      const { data: section, error } = await db
        .from('special_report_sections')
        .insert({
          report_id: reportId,
          position: s.position,
          title: s.title,
          subtitle: s.subtitle,
          label: s.label,
          area: s.area,
          color: isColor(s.color) ? s.color : null,
        })
        .select('id')
        .single()
      if (error || !section) fel(error, 'Delen kunde inte kopieras')
      const sectionId = (section as { id: string }).id
      if (s.blocks.length > 0) {
        const { error: blockError } = await db.from('special_report_blocks').insert(
          s.blocks.map(b => ({ section_id: sectionId, position: b.position, type: b.type, content: b.content ?? {} }))
        )
        if (blockError) fel(blockError, 'Delens block kunde inte kopieras')
      }
    }
  }

  /** Hela rapporten, sorterad på position, med signerade bild-URL:er (1 h) */
  static async get(id: string): Promise<SpecialReportFull> {
    const { data: report, error } = await db.from('special_reports').select('*').eq('id', id).maybeSingle()
    if (error) fel(error, 'Rapporten kunde inte hämtas')
    if (!report) throw new Error('Rapporten finns inte eller så saknar du behörighet')

    const { data: sectionRows, error: sectionsError } = await db
      .from('special_report_sections')
      .select('*')
      .eq('report_id', id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (sectionsError) fel(sectionsError, 'Delarna kunde inte hämtas')
    const sections = (sectionRows ?? []) as SpecialReportSection[]
    const sectionIds = sections.map(s => s.id)

    const empty = { data: [] as unknown[], error: null }
    const [blocksRes, eventsRes, imagesRes, versionsRes] = await Promise.all([
      sectionIds.length > 0
        ? db.from('special_report_blocks').select('*').in('section_id', sectionIds)
          .order('position', { ascending: true }).order('created_at', { ascending: true })
        : Promise.resolve(empty),
      sectionIds.length > 0
        ? db.from('special_report_events').select('*').in('section_id', sectionIds)
          .order('event_date', { ascending: true }).order('created_at', { ascending: true })
        : Promise.resolve(empty),
      db.from('special_report_images').select('*').eq('report_id', id)
        .order('position', { ascending: true }).order('created_at', { ascending: true }),
      db.from('special_report_versions').select('*').eq('report_id', id).order('version', { ascending: false }),
    ])
    if (blocksRes.error) fel(blocksRes.error, 'Blocken kunde inte hämtas')
    if (eventsRes.error) fel(eventsRes.error, 'Händelserna kunde inte hämtas')
    if (imagesRes.error) fel(imagesRes.error, 'Bilderna kunde inte hämtas')
    if (versionsRes.error) fel(versionsRes.error, 'Versionerna kunde inte hämtas')

    const blocks = (blocksRes.data ?? []) as SpecialReportBlock[]
    const events = (eventsRes.data ?? []) as SpecialReportEvent[]
    const images = await signImages((imagesRes.data ?? []) as SpecialReportImage[])

    return {
      ...(report as SpecialReport),
      sections: sections.map(s => ({
        ...s,
        blocks: blocks.filter(b => b.section_id === s.id),
        events: events.filter(e => e.section_id === s.id),
        images: images.filter(i => i.section_id === s.id),
      })),
      versions: (versionsRes.data ?? []) as SpecialReportVersion[],
    }
  }

  static async updateReport(
    id: string,
    patch: Partial<Pick<SpecialReport, 'title' | 'doc_type' | 'intro' | 'assessment' | 'recommendations' | 'map_view'>>
  ): Promise<void> {
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('Rapporten behöver en rubrik')
    const { error } = await db.from('special_reports').update(patch).eq('id', id)
    if (error) fel(error, 'Rapporten kunde inte sparas')
  }

  // ==========================================================================
  // Sektioner
  // ==========================================================================

  /** Ny del sist i rapporten. Tom rubrik är tillåten; färgen blir nästa lediga om ingen anges */
  static async addSection(reportId: string, input: {
    title: string
    subtitle?: string | null
    label: SpecialReportSectionLabel
    area?: LatLng[] | null
    blocks?: SpecialReportBlockType[]
    color?: string | null
  }): Promise<SectionWithContent> {
    const title = input.title.trim()
    const position = await nextPosition('special_report_sections', 'report_id', reportId)
    const color = isColor(input.color) ? input.color : nextSectionColor(await usedSectionColors(reportId))
    const { data: section, error } = await db
      .from('special_report_sections')
      .insert({
        report_id: reportId,
        position,
        title,
        subtitle: input.subtitle ?? null,
        label: input.label,
        area: input.area && input.area.length > 0 ? input.area : null,
        color,
      })
      .select('*')
      .single()
    if (error || !section) fel(error, 'Delen kunde inte skapas')

    const blockTypes = input.blocks ?? (input.area && input.area.length > 0 ? ['map', 'events'] as SpecialReportBlockType[] : [])
    // Högst ett händelseblock per del
    const seenEvents = { value: false }
    const rows = blockTypes
      .filter(t => {
        if (t !== 'events') return true
        if (seenEvents.value) return false
        seenEvents.value = true
        return true
      })
      .map((type, i) => ({ section_id: (section as SpecialReportSection).id, position: i, type, content: type === 'text' ? { text: '' } : {} }))

    let blocks: SpecialReportBlock[] = []
    if (rows.length > 0) {
      const { data: blockRows, error: blockError } = await db.from('special_report_blocks').insert(rows).select('*')
      if (blockError) fel(blockError, 'Delens block kunde inte skapas')
      blocks = ((blockRows ?? []) as SpecialReportBlock[]).sort((a, b) => a.position - b.position)
    }

    return { ...(section as SpecialReportSection), blocks, events: [], images: [] }
  }

  /** Tom rubrik är tillåten (visas som "Utan rubrik" i redigeraren) */
  static async updateSection(
    sectionId: string,
    patch: Partial<Pick<SpecialReportSection, 'title' | 'subtitle' | 'label' | 'area' | 'color'>>
  ): Promise<void> {
    const clean = { ...patch }
    if (clean.title !== undefined) clean.title = clean.title.trim()
    if (clean.area !== undefined && clean.area !== null && clean.area.length === 0) clean.area = null
    if (clean.color !== undefined && clean.color !== null && !isColor(clean.color)) throw new Error('Ogiltig färg')
    const { error } = await db.from('special_report_sections').update(clean).eq('id', sectionId)
    if (error) fel(error, 'Delen kunde inte sparas')
  }

  /** Tar bort delen med block, händelser och bilder (även filerna) */
  static async deleteSection(sectionId: string): Promise<void> {
    const { data: images } = await db.from('special_report_images').select('storage_path').eq('section_id', sectionId)
    const { error } = await db.from('special_report_sections').delete().eq('id', sectionId)
    if (error) fel(error, 'Delen kunde inte tas bort')
    const paths = ((images ?? []) as { storage_path: string }[]).map(i => i.storage_path)
    if (paths.length > 0) await db.storage.from(BUCKET).remove(paths)
  }

  static async reorderSections(reportId: string, orderedIds: string[]): Promise<void> {
    const results = await Promise.all(orderedIds.map((id, position) =>
      db.from('special_report_sections').update({ position }).eq('id', id).eq('report_id', reportId)
    ))
    const failed = results.find(r => r.error)
    if (failed?.error) fel(failed.error, 'Ordningen kunde inte sparas')
  }

  // ==========================================================================
  // Block
  // ==========================================================================

  /** Händelse- och bildblock finns högst en gång per del: finns det redan returneras det */
  static async addBlock(sectionId: string, type: SpecialReportBlockType): Promise<SpecialReportBlock> {
    if (type === 'events' || type === 'images') {
      const existing = await SpecialReportService.findBlock(sectionId, type)
      if (existing) return existing
    }
    const position = await nextPosition('special_report_blocks', 'section_id', sectionId)
    const { data, error } = await db
      .from('special_report_blocks')
      .insert({ section_id: sectionId, position, type, content: type === 'text' ? { text: '' } : {} })
      .select('*')
      .single()
    if (error || !data) fel(error, 'Blocket kunde inte skapas')
    return data as SpecialReportBlock
  }

  static async updateBlock(blockId: string, content: { text?: string }): Promise<void> {
    const { error } = await db.from('special_report_blocks').update({ content }).eq('id', blockId)
    if (error) fel(error, 'Blocket kunde inte sparas')
  }

  static async deleteBlock(blockId: string): Promise<void> {
    const { error } = await db.from('special_report_blocks').delete().eq('id', blockId)
    if (error) fel(error, 'Blocket kunde inte tas bort')
  }

  static async reorderBlocks(sectionId: string, orderedIds: string[]): Promise<void> {
    const results = await Promise.all(orderedIds.map((id, position) =>
      db.from('special_report_blocks').update({ position }).eq('id', id).eq('section_id', sectionId)
    ))
    const failed = results.find(r => r.error)
    if (failed?.error) fel(failed.error, 'Ordningen kunde inte sparas')
  }

  /** Första blocket av typen i delen (äldre delar kan ha fler bildblock) */
  private static async findBlock(sectionId: string, type: SpecialReportBlockType): Promise<SpecialReportBlock | null> {
    const { data } = await db
      .from('special_report_blocks')
      .select('*')
      .eq('section_id', sectionId)
      .eq('type', type)
      .order('position', { ascending: true })
      .limit(1)
    return ((data as SpecialReportBlock[] | null) ?? [])[0] ?? null
  }

  private static async ensureEventsBlock(sectionId: string): Promise<void> {
    await SpecialReportService.addBlock(sectionId, 'events')
  }

  // ==========================================================================
  // Händelser
  // ==========================================================================

  static async addEvent(sectionId: string, input: {
    event_date: string
    type: SpecialReportEventType
    title: string
    description?: string | null
  }): Promise<SpecialReportEvent> {
    const title = input.title.trim()
    if (!title) throw new Error('Händelsen behöver en rubrik')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.event_date)) throw new Error('Ange datum som ÅÅÅÅ-MM-DD')
    await SpecialReportService.ensureEventsBlock(sectionId)
    const { data, error } = await db
      .from('special_report_events')
      .insert({
        section_id: sectionId,
        event_date: input.event_date,
        type: input.type,
        title,
        description: nonEmpty(input.description),
      })
      .select('*')
      .single()
    if (error || !data) fel(error, 'Händelsen kunde inte sparas')
    return data as SpecialReportEvent
  }

  static async updateEvent(
    eventId: string,
    patch: Partial<Pick<SpecialReportEvent, 'event_date' | 'type' | 'title' | 'description'>>
  ): Promise<void> {
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('Händelsen behöver en rubrik')
    if (patch.event_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.event_date)) {
      throw new Error('Ange datum som ÅÅÅÅ-MM-DD')
    }
    const { error } = await db.from('special_report_events').update(patch).eq('id', eventId)
    if (error) fel(error, 'Händelsen kunde inte sparas')
  }

  static async deleteEvent(eventId: string): Promise<void> {
    const { error } = await db.from('special_report_events').delete().eq('id', eventId)
    if (error) fel(error, 'Händelsen kunde inte tas bort')
  }

  /** Besök (visits) för ärendet och, för avtalsärenden, avslutade stationskontroller */
  static async getImportCandidates(reportId: string): Promise<SpecialReportImportCandidate[]> {
    const { data: report, error } = await db
      .from('special_reports')
      .select('id, case_id, case_type')
      .eq('id', reportId)
      .maybeSingle()
    if (error) fel(error, 'Rapporten kunde inte hämtas')
    if (!report) throw new Error('Rapporten finns inte eller så saknar du behörighet')
    const { case_id: caseId, case_type: caseType } = report as { case_id: string; case_type: SpecialReportCaseType }

    // Redan inhämtat i den här rapporten
    const imported = new Set<string>()
    const { data: sections } = await db.from('special_report_sections').select('id').eq('report_id', reportId)
    const sectionIds = ((sections ?? []) as { id: string }[]).map(s => s.id)
    if (sectionIds.length > 0) {
      const { data: events } = await db
        .from('special_report_events')
        .select('source, source_id')
        .in('section_id', sectionIds)
        .not('source_id', 'is', null)
      for (const e of (events ?? []) as { source: string | null; source_id: string | null }[]) {
        if (e.source && e.source_id) imported.add(`${e.source}:${e.source_id}`)
      }
    }

    const candidates: SpecialReportImportCandidate[] = []

    const { data: visits, error: visitsError } = await db
      .from('visits')
      .select('id, visit_date, completed_date, visit_number, technician_name, work_performed, findings, recommendations')
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .order('visit_date', { ascending: true })
    if (visitsError) fel(visitsError, 'Besöken kunde inte hämtas')
    for (const v of (visits ?? []) as {
      id: string; visit_date: string | null; completed_date: string | null; visit_number: number | null
      technician_name: string | null; work_performed: string | null; findings: string | null; recommendations: string | null
    }[]) {
      const date = swedishDate(v.completed_date) ?? swedishDate(v.visit_date)
      if (!date) continue
      const parts = [
        nonEmpty(v.work_performed) ? `Utfört: ${v.work_performed!.trim()}` : null,
        nonEmpty(v.findings) ? `Iakttagelser: ${v.findings!.trim()}` : null,
        nonEmpty(v.recommendations) ? `Rekommendation: ${v.recommendations!.trim()}` : null,
      ].filter(Boolean)
      candidates.push({
        source: 'visit',
        source_id: v.id,
        event_date: date,
        type: 'besok',
        title: v.visit_number && v.visit_number > 1 ? `Besök ${v.visit_number}` : 'Besök',
        description: parts.length > 0 ? parts.join('\n') : null,
        already_imported: imported.has(`visit:${v.id}`),
      })
    }

    if (caseType === 'contract') {
      const { data: sessions, error: sessionsError } = await db
        .from('station_inspection_sessions')
        .select('id, completed_at, notes, total_outdoor_stations, total_indoor_stations, inspected_outdoor_stations, inspected_indoor_stations')
        .eq('case_id', caseId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })
      if (sessionsError) fel(sessionsError, 'Stationskontrollerna kunde inte hämtas')
      for (const s of (sessions ?? []) as {
        id: string; completed_at: string | null; notes: string | null
        total_outdoor_stations: number | null; total_indoor_stations: number | null
        inspected_outdoor_stations: number | null; inspected_indoor_stations: number | null
      }[]) {
        const date = swedishDate(s.completed_at)
        if (!date) continue
        const total = (s.total_outdoor_stations ?? 0) + (s.total_indoor_stations ?? 0)
        const inspected = (s.inspected_outdoor_stations ?? 0) + (s.inspected_indoor_stations ?? 0)
        const parts = [
          total > 0 ? `${inspected} av ${total} stationer kontrollerade.` : null,
          nonEmpty(s.notes),
        ].filter(Boolean)
        candidates.push({
          source: 'inspection_session',
          source_id: s.id,
          event_date: date,
          type: 'inspektion',
          title: 'Kontroll av stationerna',
          description: parts.length > 0 ? parts.join('\n') : null,
          already_imported: imported.has(`inspection_session:${s.id}`),
        })
      }
    }

    return candidates.sort((a, b) => a.event_date.localeCompare(b.event_date))
  }

  /** Hämtar in valda kandidater som händelser i sektionen (redan inhämtade hoppas över) */
  static async importEvents(sectionId: string, candidates: SpecialReportImportCandidate[]): Promise<SpecialReportEvent[]> {
    const wanted = candidates.filter(c => !c.already_imported)
    if (wanted.length === 0) return []

    const { data: section } = await db.from('special_report_sections').select('report_id').eq('id', sectionId).maybeSingle()
    if (!section) throw new Error('Delen finns inte eller så saknar du behörighet')
    const { data: sections } = await db
      .from('special_report_sections')
      .select('id')
      .eq('report_id', (section as { report_id: string }).report_id)
    const sectionIds = ((sections ?? []) as { id: string }[]).map(s => s.id)
    const existing = new Set<string>()
    if (sectionIds.length > 0) {
      const { data: events } = await db
        .from('special_report_events')
        .select('source, source_id')
        .in('section_id', sectionIds)
        .in('source_id', wanted.map(c => c.source_id))
      for (const e of (events ?? []) as { source: string; source_id: string }[]) existing.add(`${e.source}:${e.source_id}`)
    }
    const rows = wanted
      .filter(c => !existing.has(`${c.source}:${c.source_id}`))
      .map(c => ({
        section_id: sectionId,
        event_date: c.event_date,
        type: c.type,
        title: c.title,
        description: c.description,
        source: c.source,
        source_id: c.source_id,
      }))
    if (rows.length === 0) return []

    await SpecialReportService.ensureEventsBlock(sectionId)
    const { data, error } = await db.from('special_report_events').insert(rows).select('*')
    if (error) fel(error, 'Händelserna kunde inte hämtas in')
    return ((data ?? []) as SpecialReportEvent[]).sort((a, b) => a.event_date.localeCompare(b.event_date))
  }

  // ==========================================================================
  // Bilder
  // ==========================================================================

  static async uploadImage(
    reportId: string,
    sectionId: string,
    file: File,
    opts?: { eventId?: string | null; caption?: string | null }
  ): Promise<SpecialReportImage> {
    const arHeic = (typ: string, namn: string) => /^image\/hei[cf](-sequence)?$/i.test(typ) || /\.hei[cf]$/i.test(namn)
    // HEIC saknar ibland MIME-typ i webbläsaren, därför kontrolleras ändelsen före bildkontrollen
    if (!file.type.startsWith('image/') && !arHeic(file.type, file.name)) throw new Error('Filen är inte en bild')
    const blob = await compressToWebP(file)
    // Små bilder komprimeras inte och behåller sitt format. En HEIC-bild som
    // webbläsaren inte kunde avkoda kommer tillbaka orörd och går inte att visa
    if (blob === file && arHeic(file.type, file.name)) {
      throw new Error('Bilden är i HEIC-format och kan inte visas. Spara den som JPEG och försök igen.')
    }
    // Ändelsen följer alltid den typ som laddas upp
    const type = (blob.type || file.type).toLowerCase()
    const ext = BILD_ANDELSER[type]
    if (!ext) throw new Error('Bildformatet stöds inte. Använd JPEG, PNG eller WebP.')
    const path = `${reportId}/${crypto.randomUUID()}.${ext}`

    // En bild som bifogas en händelse hamnar i delens bildblock, som skapas om det saknas.
    // Före uppladdningen, så att ett fel här inte lämnar en fil utan rad i lagringen
    if (opts?.eventId) await SpecialReportService.addBlock(sectionId, 'images')

    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, blob, {
      contentType: ext === 'jpg' ? 'image/jpeg' : type,
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) fel(uploadError, 'Bilden kunde inte laddas upp')

    const position = await nextPosition('special_report_images', 'section_id', sectionId)
    const { data, error } = await db
      .from('special_report_images')
      .insert({
        report_id: reportId,
        section_id: sectionId,
        event_id: opts?.eventId ?? null,
        storage_path: path,
        caption: nonEmpty(opts?.caption),
        position,
      })
      .select('*')
      .single()
    if (error || !data) {
      await db.storage.from(BUCKET).remove([path])
      fel(error, 'Bilden kunde inte sparas')
    }
    const [signed] = await signImages([data as SpecialReportImage])
    return signed
  }

  /** Bildtext och/eller vilken händelse bilden hör till (null = ingen) */
  static async updateImage(imageId: string, patch: { caption?: string | null; event_id?: string | null }): Promise<void> {
    const update: { caption?: string | null; event_id?: string | null } = {}
    if (patch.caption !== undefined) update.caption = nonEmpty(patch.caption)
    if (patch.event_id !== undefined) update.event_id = patch.event_id || null
    if (Object.keys(update).length === 0) return
    const { error } = await db.from('special_report_images').update(update).eq('id', imageId)
    if (error) fel(error, update.event_id !== undefined ? 'Bildens koppling kunde inte sparas' : 'Bildtexten kunde inte sparas')
  }

  static async deleteImage(imageId: string): Promise<void> {
    const { data: image } = await db.from('special_report_images').select('storage_path').eq('id', imageId).maybeSingle()
    const { error } = await db.from('special_report_images').delete().eq('id', imageId)
    if (error) fel(error, 'Bilden kunde inte tas bort')
    const path = (image as { storage_path: string } | null)?.storage_path
    if (path) await db.storage.from(BUCKET).remove([path])
  }

  // ==========================================================================
  // PDF och utskick
  // ==========================================================================

  /** Förhandsgranskning av pågående version, ingen låsning */
  static async downloadPdf(reportId: string): Promise<{ url: string; filename: string }> {
    const res = await apiFetch('/api/special-report-pdf', {
      method: 'POST',
      body: JSON.stringify({ reportId, action: 'download' }),
    })
    if (!res.ok) await readApiError(res, 'PDF:en kunde inte skapas')
    const body = await res.json() as { url: string; filename: string }
    return { url: body.url, filename: body.filename }
  }

  /** Skickar pågående version, låser den och räknar upp current_version */
  static async send(reportId: string, input: {
    recipients: string[]
    subject: string
    message: string
    saveToCase: boolean
  }): Promise<SpecialReportVersion> {
    const recipients = input.recipients.map(r => r.trim()).filter(Boolean)
    if (recipients.length === 0) throw new Error('Lägg till minst en mottagare')
    const res = await apiFetch('/api/special-report-pdf', {
      method: 'POST',
      body: JSON.stringify({
        reportId,
        action: 'send',
        recipients,
        subject: input.subject,
        message: input.message,
        saveToCase: input.saveToCase,
      }),
    })
    if (!res.ok) await readApiError(res, 'Rapporten kunde inte skickas')
    const body = await res.json() as { version: SpecialReportVersion }
    return body.version
  }

  static async getVersionPdfUrl(versionId: string): Promise<string> {
    const { data, error } = await db
      .from('special_report_versions')
      .select('pdf_path')
      .eq('id', versionId)
      .maybeSingle()
    if (error) fel(error, 'Versionen kunde inte hämtas')
    if (!data) throw new Error('Versionen finns inte eller så saknar du behörighet')
    const { data: signed, error: signError } = await db.storage
      .from(BUCKET)
      .createSignedUrl((data as { pdf_path: string }).pdf_path, SIGNED_URL_SECONDS)
    if (signError || !signed?.signedUrl) fel(signError, 'PDF:en kunde inte öppnas')
    return signed.signedUrl
  }
}

// api/_lib/procurementKommers.ts
// Rena funktioner för Kommers annonsportal (www.kommersannons.se, "Antirio
// Supplier Hub"): sökformulärets token och cookie, POST-kroppen, resultatlistan
// och detaljsidan. Ingen databas, ingen import.meta. Används av
// api/cron/procurement-sync-kommers.ts. Underscore-prefix: ingen endpoint.
//
// VERIFIERAT MOT RIKTIGA SVAR 2026-09-25 (sparade exempel och testskript i
// sessionens scratchpad, inte i repot):
//
//   - robots.txt: "User-agent: * / allow: /".
//   - GET /Notices/TenderNotices ger 200, sätter kakan
//     .AspNetCore.Antiforgery.* och bär tre formulär med samma
//     __RequestVerificationToken. Samma token och kaka räcker för alla POST
//     under en körning.
//   - POST /Notices/TenderNotices (application/x-www-form-urlencoded) med
//     SearchString, SelectedCpvCode (flera värden tillåtna), SearchOldNotices
//     (false/true), PageIndex (1-baserad, sidan visas som "2 / 17") och
//     __RequestVerificationToken ger 200 och 40 poster per sida.
//   - AVVIKELSE: SelectedCpvCode tar CPV-NAMNET på svenska, inte koden
//     ("Bekämpning av skadedjur och skadeinsekter", inte 90922000). Kommers
//     namn för 90920000 är "Sanering av anläggningar". Namnen finns som
//     <option> i formuläret; bara namn som finns där skickas.
//   - SearchString söker i titel och beskrivning: "skadedjur" gav 0 aktuella
//     och 36 med SearchOldNotices=true, "sanering" 17 aktuella.
//   - Resultatlistan visar CPV som NAMN (inte koder), NUTS som länsnamn, datum
//     "Datum då annonsen skickades för publicering ÅÅÅÅ-MM-DD" och "N dagar
//     kvar". Köpare och exakt sista anbudsdag finns inte i listan.
//   - Detaljsidan /Notice/TenderNotice/{id} (utan s; /Notices/... svarar 302
//     dit) är en eForms-rendering med köpare, orgnr, CPV-koder, NUTS-koder,
//     värde, sista anbudsdag med offset och länken "För att delta gå till
//     .../Notice/NoticeOverview.aspx?ProcurementId=N".
//   - AVVIKELSE: detaljsidan finns BARA för eForms-annonser (EU-annonser).
//     Nationella annonser och äldre poster skickas till /StatusCode/400
//     (ungefär en tredjedel av de aktuella, två tredjedelar av de gamla
//     skadedjursposterna). För dem finns bara listans uppgifter.
//   - Id: Kommers annonsportal har egna löpnummer (22282) som INTE är samma
//     som Mercells sourceNoticeId för Kom-poster. Mercells sourceNoticeId är
//     ProcurementId i den underliggande Kommers-instansen (verifierat: Mercell
//     "Kom Traf" 19556 = upphandling.trafikverket.se ProcurementId=19556,
//     "Kom Lite" 73223 = kommersannons.se/elite ProcurementId=73223,
//     "Kom Pls" 7229 = upphandling.polisen.se ProcurementId=7229). Dedup mot
//     Mercell går därför via ProcurementId från detaljsidan.
//   - ProcurementId är löpnummer PER INSTANS (elite 73xxx, göteborg 58587,
//     malmö 58353 ...), så kommers:{ProcurementId} kan krocka mellan instanser.
//     Synken skyddar sig (se cron-filen), men nyckeln borde bära instansen.
//   - /Notices/PriorInfoNotices listar förhandsannonser (6 st 2026-09-25) med
//     CPV-koder och NUTS-koder i listan. POST-sökning där med
//     SearchOldNotices=true gav 500, så sidan läses med GET utan filter.

export const KOMMERS_BASE = 'https://www.kommersannons.se'
export const KOMMERS_TENDER_LIST_PATH = '/Notices/TenderNotices'
export const KOMMERS_PRIOR_LIST_PATH = '/Notices/PriorInfoNotices'

/** Bevakade CPV-koder och Kommers namn på dem (namnen skickas i SelectedCpvCode) */
export const KOMMERS_PEST_CPV: Record<string, string> = {
  '90920000': 'Sanering av anläggningar',
  '90921000': 'Desinficering och utrotning',
  '90922000': 'Bekämpning av skadedjur och skadeinsekter',
  '90923000': 'Desinfestation av råttor',
}

/** Fritextsökningar utöver CPV */
export const KOMMERS_KEYWORDS = ['skadedjur', 'sanering']

export type KommersNoticeType = 'TenderNotice' | 'QualificationNotice' | 'PriorInfoNotice'

// ---------------------------------------------------------------------------
// Text

const NAMED: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', copy: '©',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', aring: 'å', Aring: 'Å',
  eacute: 'é', Eacute: 'É', uuml: 'ü', Uuml: 'Ü', aelig: 'æ', oslash: 'ø',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', hellip: '…', sect: '§',
}

/** Avkodar numeriska (&#xE4; &#228;) och vanliga namngivna entiteter */
export function decodeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return NAMED[e] ?? m
  })
}

/** Taggar bort, entiteter avkodade, blanktecken hopslagna */
export function htmlText(s: string | null | undefined): string {
  return decodeHtml(String(s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Datum och tid (Europe/Stockholm med explicit offset)

const OFFSET_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', timeZoneName: 'longOffset' })

/** "+01:00" eller "+02:00" för ett svenskt kalenderdatum ÅÅÅÅ-MM-DD */
export function stockholmOffset(isoDate: string): string {
  const part = OFFSET_FMT.formatToParts(new Date(`${isoDate}T12:00:00Z`)).find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = part.match(/GMT([+-]\d{2}):?(\d{2})?/)
  return m ? `${m[1]}:${m[2] ?? '00'}` : '+01:00'
}

/** ÅÅÅÅ-MM-DD till midnatt svensk tid med offset */
export function swedishMidnight(isoDate: string | null): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  return `${isoDate}T00:00:00${stockholmOffset(isoDate)}`
}

/** "10/09/2026" till "2026-09-10" */
export function kommersDate(dmy: string | null | undefined): string | null {
  const m = String(dmy ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** "10/09/2026 23:59 +02:00" till "2026-09-10T23:59:00+02:00". Saknas offset används svensk. */
export function kommersDateTime(text: string | null | undefined): string | null {
  const t = String(text ?? '')
  const date = kommersDate(t)
  if (!date) return null
  const tm = t.match(/(\d{1,2}):(\d{2})(?:\s*([+-]\d{2}:\d{2}|Z))?/)
  if (!tm) return `${date}T23:59:00${stockholmOffset(date)}`
  const offset = tm[3] ? (tm[3] === 'Z' ? '+00:00' : tm[3]) : stockholmOffset(date)
  return `${date}T${tm[1].padStart(2, '0')}:${tm[2]}:00${offset}`
}

// ---------------------------------------------------------------------------
// Formulär, kakor och POST-kropp

export interface KommersFormState {
  token: string | null
  /** Cookie-headern att skicka med POST */
  cookie: string
  /** CPV-namnen som formuläret erbjuder */
  cpvOptions: string[]
}

/** Set-Cookie-raderna ur ett svar (Node 20: getSetCookie, annars sammanslagen header) */
export function setCookiesOf(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === 'function') return h.getSetCookie()
  const raw = headers.get('set-cookie')
  return raw ? raw.split(/,(?=\s*[^;,=\s]+=)/) : []
}

/** "namn=värde; path=/; ..." till "namn=värde; namn2=värde2" */
export function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(';')[0].trim())
    .filter((c) => c.includes('='))
    .join('; ')
}

export function parseFormState(html: string, setCookies: string[]): KommersFormState {
  const token = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1] ?? null
  const select = html.match(/<select[^>]*id="SelectedCpvCode"[^>]*>([\s\S]*?)<\/select>/)?.[1] ?? ''
  const cpvOptions = Array.from(select.matchAll(/<option value="([^"]*)"/g)).map((m) => decodeHtml(m[1]))
  return { token, cookie: cookieHeaderFrom(setCookies), cpvOptions }
}

export interface KommersSearch {
  searchString?: string
  cpvNames?: string[]
  /** SearchOldNotices: true tar med utgångna annonser */
  old: boolean
  /** 1-baserad */
  page?: number
}

export function buildSearchBody(search: KommersSearch, token: string): URLSearchParams {
  const body = new URLSearchParams()
  body.append('SearchString', search.searchString ?? '')
  for (const name of search.cpvNames ?? []) body.append('SelectedCpvCode', name)
  body.append('SearchOldNotices', search.old ? 'true' : 'false')
  if (search.page && search.page > 1) body.append('PageIndex', String(search.page))
  body.append('__RequestVerificationToken', token)
  return body
}

// ---------------------------------------------------------------------------
// Resultatlistan

export interface KommersListItem {
  type: KommersNoticeType
  /** Kommers annonsportals löpnummer (per posttyp) */
  id: string
  /** Källans id i procurement_notice_sources: id för TenderNotice, annars typ-id */
  sourceId: string
  /** Köparens interna referens före " - " i rubriken */
  ref: string | null
  title: string
  publishedDate: string | null
  nutsText: string | null
  nutsCodes: string[]
  cpvText: string | null
  /** Koder ur listan: explicita (förhandsannonser) och översatta bevakade namn */
  cpvCodes: string[]
  description: string | null
  daysLeft: number | null
  /** Filnamnet på köparens logga, bara som ledtråd */
  logo: string | null
}

export interface KommersListPage {
  items: KommersListItem[]
  page: number
  pageCount: number
}

export function kommersSourceId(type: KommersNoticeType, id: string): string {
  return type === 'TenderNotice' ? id : `${type}-${id}`
}

export function kommersDetailUrl(type: KommersNoticeType, id: string): string {
  return `${KOMMERS_BASE}/Notice/${type}/${id}`
}

/** "KS2025/0943 - Titel" till ref + titel. Ref utan blanksteg, högst 40 tecken, eller tom. */
export function splitRefTitle(heading: string): { ref: string | null; title: string } {
  const m = heading.match(/^\s*(.{0,40}?)\s*-\s+(.+)$/)
  if (m && (m[1] === '' || (/\d/.test(m[1]) && m[1].split(/\s+/).length <= 4))) return { ref: m[1] || null, title: m[2].trim() }
  return { ref: null, title: heading.trim() }
}

function cpvCodesFromText(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/\b(\d{8})(?:-\d)?\b/g)) out.add(m[1])
  const lower = text.toLowerCase()
  for (const [code, name] of Object.entries(KOMMERS_PEST_CPV)) if (lower.includes(name.toLowerCase())) out.add(code)
  return [...out]
}

export function parseListPage(html: string): KommersListPage {
  const items: KommersListItem[] = []
  // Varje post börjar med <div class="row mt-4 mb-4 align-items-center">
  const blocks = html.split(/<div class="row mt-4 mb-4 align-items-center">/).slice(1)
  for (const block of blocks) {
    const link = block.match(/<a href="\/Notices\/(TenderNotice|QualificationNotice|PriorInfoNotice)\/(\d+)">([\s\S]*?)<\/a>/)
    if (!link) continue
    const type = link[1] as KommersNoticeType
    const id = link[2]
    const { ref, title } = splitRefTitle(htmlText(link[3]))
    const smalls = Array.from(block.matchAll(/<small>([\s\S]*?)<\/small>/g)).map((m) => htmlText(m[1]))
    const pub = smalls.find((s) => /skickades för publicering/i.test(s))?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
    const nutsText = smalls.find((s) => /^NUTS:/i.test(s))?.replace(/^NUTS:\s*/i, '') ?? null
    const cpvText = smalls.find((s) => /^CPV:/i.test(s))?.replace(/^CPV:\s*/i, '') ?? null
    // Beskrivningen: synlig del + dold fortsättning, utan "..." och knappen
    const p = block.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? ''
    const description = htmlText(p.replace(/<span id="dots\d+">[\s\S]*?<\/span>/, '').replace(/<button[\s\S]*?<\/button>/g, '')) || null
    const days = block.match(/<h4 class="p-0 m-0">\s*(-?\d+)\s*<\/h4>\s*dagar kvar/)
    const logo = block.match(/<img[^>]*src="\/Images\/ProcuringEntities\/([^"?]+)/)?.[1] ?? null
    items.push({
      type,
      id,
      sourceId: kommersSourceId(type, id),
      ref,
      title,
      publishedDate: pub,
      nutsText,
      nutsCodes: nutsText ? Array.from(nutsText.matchAll(/\b(SE[0-9A-Z]{1,3})\b/g)).map((m) => m[1]) : [],
      cpvText,
      cpvCodes: cpvText ? cpvCodesFromText(cpvText) : [],
      description,
      daysLeft: days ? Number(days[1]) : null,
      logo: logo ? decodeHtml(decodeURIComponent(logo)) : null,
    })
  }
  const pager = html.match(/col-sm-4 col-3 text-center my-auto p-0">\s*(\d+)\s*\/\s*(\d+)/)
  return { items, page: pager ? Number(pager[1]) : 1, pageCount: pager ? Number(pager[2]) : items.length > 0 ? 1 : 0 }
}

// ---------------------------------------------------------------------------
// Detaljsidan (eForms-rendering)

export interface KommersDetail {
  title: string | null
  description: string | null
  buyerName: string | null
  buyerOrgNumber: string | null
  cpvCodes: string[]
  nutsCodes: string[]
  estimatedValue: number | null
  currency: string | null
  tenderDeadline: string | null
  dispatchedAt: string | null
  contractStart: string | null
  contractEnd: string | null
  procedureType: string | null
  isFramework: boolean | null
  criteriaType: 'price' | 'quality' | 'mixed' | 'cost' | null
  formType: string | null
  noticeType: string | null
  /** Instansens ProcurementId, samma som Mercells sourceNoticeId för Kom-poster */
  procurementId: string | null
  /** Instansens adress, t.ex. www.kommersannons.se/elite eller upphandling.trafikverket.se */
  instanceHost: string | null
  /** Länken till instansens annonssida där man registrerar intresse */
  platformUrl: string | null
  documentUrl: string | null
}

interface Row {
  label: string
  text: string
  values: string[]
  pos: number
}

function rowsOf(html: string): Row[] {
  const rows: Row[] = []
  // Raden slutar vid första <div eller </div> (Kriterium-raden har nästlade rader)
  const re = /<div><span class="label">([^<]*)<\/span>((?:(?!<\/?div)[\s\S])*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const rest = m[2]
    rows.push({
      label: htmlText(m[1]),
      text: htmlText(rest).replace(/^[:\s]+/, ''),
      values: Array.from(rest.matchAll(/<span class="(?:value|dynamic-label)">([^<]*)<\/span>/g)).map((v) => htmlText(v[1])),
      pos: m.index,
    })
  }
  return rows
}

function parseAmount(s: string | null | undefined): number | null {
  const d = String(s ?? '').replace(/\s/g, '').replace(',', '.')
  const n = Number(d)
  return d && Number.isFinite(n) ? n : null
}

/** Null om sidan är Kommers felsida (nationella och äldre annonser) */
export function parseDetailPage(html: string): KommersDetail | null {
  if (/<title>\s*Error\b/i.test(html) || /Statuscode\s+\d{3}/i.test(html)) return null
  if (!/<span class="label">/.test(html)) return null

  const rows = rowsOf(html)
  const first = (label: string) => rows.find((r) => r.label === label) ?? null
  const all = (label: string) => rows.filter((r) => r.label === label)

  const orgSection = html.search(/<h2 id="section-8"/)
  const buyerName = first('Officiellt namn')?.text || null

  // Köparens orgnr: Registreringsnummer i organisationsblocket med samma namn
  let buyerOrgNumber: string | null = null
  if (buyerName) {
    let current: string | null = null
    for (const r of rows) {
      if (orgSection >= 0 && r.pos < orgSection) continue
      if (r.label === 'Officiellt namn') current = r.text
      else if (r.label === 'Registreringsnummer' && current === buyerName) {
        buyerOrgNumber = r.text || null
        break
      }
    }
  }

  const cpv = new Set<string>()
  for (const r of rows) {
    if (r.label !== 'Huvudklassificering' && r.label !== 'Ytterligare klassificering') continue
    const code = r.values.find((v) => /^\d{8}$/.test(v))
    if (code) cpv.add(code)
  }
  const nuts = new Set<string>()
  for (const r of all('Del av land (NUTS)')) {
    if (orgSection >= 0 && r.pos > orgSection) continue // organisationernas adresser räknas inte
    const code = r.values.find((v) => /^[A-Z]{2}[0-9A-Z]{0,3}$/.test(v))
    if (code) nuts.add(code)
  }

  const valueRow = first('Beräknat värde exklusive moms')
  const valueNum = valueRow ? parseAmount(valueRow.values[0]) : null
  const currencyText = valueRow ? valueRow.text.replace(valueRow.values[0] ?? '', '').trim() : ''
  const currency = /svensk krona/i.test(currencyText) ? 'SEK' : /euro/i.test(currencyText) ? 'EUR' : currencyText || null

  const deadlineRow = first('Tidsfrist för mottagande av anbud') ?? first('Tidsfrist för mottagande av anbudsansökningar')
  const dispatchRow = first('Avsändningsdatum för meddelandet')

  const framework = first('Ramavtal')
  let isFramework: boolean | null = null
  if (framework) {
    const idx = html.indexOf('<span class="label">Ramavtal</span>')
    // Verifierade varianter: "Upphandlingen avser inte ett ramavtal",
    // "Ramavtal utan/med förnyad konkurrensutsättning", "Ramavtal delvis utan och delvis med ..."
    const near = htmlText(html.slice(idx, idx + 600)).replace(/^Ramavtal\s*:?\s*/i, '')
    isFramework = /avser inte ett ramavtal|inget ramavtal/i.test(near) ? false : /^ramavtal\b/i.test(near) ? true : null
  }

  const criteria = all('Typ').map((r) => r.text.toLowerCase())
  let criteriaType: KommersDetail['criteriaType'] = null
  if (criteria.length > 0) {
    const price = criteria.some((c) => c.includes('pris'))
    const cost = criteria.some((c) => c.includes('kostnad'))
    const quality = criteria.some((c) => c.includes('kvalitet'))
    criteriaType = quality && (price || cost) ? 'mixed' : quality ? 'quality' : cost ? 'cost' : price ? 'price' : null
  }

  const overview = html.match(/href="(https?:\/\/([^"]+?)\/Notice\/NoticeOverview\.aspx\?ProcurementId=(\d+))"/i)
  const dispatch = html.match(/https?:\/\/[^"<\s]+\/Notice\/NoticeDispatch\.aspx\?NoticeId=\d+/i)

  const titleRow = first('Titel')
  const descRow = first('Beskrivning')
  return {
    title: titleRow?.text || null,
    description: descRow?.text || null,
    buyerName,
    buyerOrgNumber,
    cpvCodes: [...cpv],
    nutsCodes: [...nuts],
    estimatedValue: valueNum,
    currency,
    tenderDeadline: deadlineRow ? kommersDateTime(deadlineRow.text) : null,
    dispatchedAt: dispatchRow ? kommersDateTime(dispatchRow.text) : null,
    contractStart: kommersDate(first('Startdatum')?.text),
    contractEnd: kommersDate(first('Slutdatum för varaktighet')?.text),
    procedureType: first('Typ av förfarande')?.text || null,
    isFramework,
    criteriaType,
    formType: first('Formulärtyp')?.text || null,
    noticeType: first('Meddelandetyp')?.text || null,
    procurementId: overview?.[3] ?? null,
    instanceHost: overview?.[2] ?? null,
    platformUrl: overview ? decodeHtml(overview[1]) : null,
    documentUrl: dispatch ? decodeHtml(dispatch[0]) : null,
  }
}

// ---------------------------------------------------------------------------
// Posttyp

export type KommersKind = 'tender' | 'direct' | 'rfi' | 'prior_information' | 'award' | 'modification' | 'other'

/** Detaljsidans Formulärtyp/Meddelandetyp i första hand, annars listans typ och rubrik */
export function kommersKind(item: Pick<KommersListItem, 'type' | 'title' | 'description'>, detail: KommersDetail | null): KommersKind {
  const form = `${detail?.formType ?? ''} ${detail?.noticeType ?? ''}`.toLowerCase()
  if (form.trim()) {
    if (/planering|förhandsmeddelande|förhandsannons/.test(form)) return 'prior_information'
    if (/ändring/.test(form)) return 'modification'
    if (/resultat|förhandsinsyn|tilldelning/.test(form)) return 'award'
    if (/konkurrensutsättning|upphandling/.test(form)) return 'tender'
  }
  if (item.type === 'PriorInfoNotice') return 'prior_information'
  const text = `${item.title} ${item.description ?? ''}`
  if (/\bRFI\b|request for information/i.test(item.title)) return 'rfi'
  if (/direktupphandling/i.test(text)) return 'direct'
  return 'tender'
}

// ---------------------------------------------------------------------------
// Titellikhet för dedup-skyddet

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9åäöéü ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  )
}

/** Jaccard på ord med minst tre tecken, 0 till 1 */
export function titleOverlap(a: string | null | undefined, b: string | null | undefined): number {
  const A = tokens(String(a ?? ''))
  const B = tokens(String(b ?? ''))
  if (A.size === 0 || B.size === 0) return 0
  let common = 0
  for (const t of A) if (B.has(t)) common++
  return common / (A.size + B.size - common)
}

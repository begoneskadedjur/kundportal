// src/shared/procurementRfiDocx.ts
// Köparens RFI-formulär i Word (docx) som stycken med ankare (3.71.0).
//
// Ren logik utan beroenden, används av API:t (utläsningen) och klienten
// (exporten). Anroparen packar upp docx-filen (jszip) och skickar in
// word/document.xml som text.
//
//   parseDocxParagraphs  stycken i dokumentordning med index, text, formatmall
//                        och tabellplats. Indexet är ankaret: "P30" är det
//                        trettionde stycket i brödtexten, räknat även i tabeller.
//   docxListing          stycken som rader för AI:n ("P30 [tabell 4 r1 c1] (tom)")
//   guessRfiItems        deterministisk tolkning av ett frågeformulär: rubriker,
//                        frågor, svarsrutor ("Svar" plus tom rad), tabeller med
//                        etikett och tom cell (företagsuppgifter, procent per år)
//   buildRfiQuestions    gör AI:ns eller tolkningens hänvisningar till frågor.
//                        Frågetexten tas ordagrant ur dokumentet, aldrig ur AI:n,
//                        och varje ankare kontrolleras (finns, är tomt).
//   fillDocxXml          skriver svaren i rätt stycken och behåller allt annat.

// ---------------------------------------------------------------------------
// Typer

export interface DocxParagraph {
  /** Ordningsnummer bland styckena i brödtexten (ankaret) */
  index: number
  text: string
  style: string | null
  /** Punkt- eller numrerad lista */
  list: boolean
  /** Tabellens ordningsnummer (0, 1, ...), raden och cellen, eller null utanför tabell */
  table: { t: number; row: number; cell: number } | null
  /** Position i document.xml: start för <w:p och slutet av elementet */
  start: number
  end: number
  /** Positionen för </w:p>, eller -1 för ett tomt <w:p/> */
  closeAt: number
}

export type RfiAnswerType = 'fritext' | 'ja_nej' | 'procent_per_ar' | 'foretagsuppgift'

export const RFI_ANSWER_TYPES: RfiAnswerType[] = ['fritext', 'ja_nej', 'procent_per_ar', 'foretagsuppgift']

/** En fråga som AI:n eller tolkningen pekar ut med styckeindex */
export interface RfiRawItem {
  section_p?: number | null
  question_p: number[]
  context_p?: number[]
  answer_type: RfiAnswerType
  answer_p?: number | null
  fields?: Array<{ key: string; label?: string | null; answer_p: number }>
  years?: Array<{ year: number; answer_p: number }>
}

export interface RfiField {
  key: string
  label: string
}

export interface RfiAnswerMeta {
  years?: number[]
  fields?: RfiField[]
}

/** Var svaret skrivs i köparens docx */
export interface RfiAnchor {
  kind: 'docx'
  /** Ett stycke för fritext och ja/nej */
  p?: number
  /** Ett stycke per fält eller år (nyckel = fältets nyckel eller året) */
  cells?: Record<string, number>
  /** Texten i närmaste ifyllda stycke före varje ankare, för kontrollen vid export */
  before?: Record<string, string>
  /** Alla ankare fanns och var tomma när frågorna lästes in */
  verified: boolean
}

export interface RfiQuestionDraft {
  sort_order: number
  section: string | null
  question: string
  context: string | null
  answer_type: RfiAnswerType
  answer_meta: RfiAnswerMeta
  anchor: RfiAnchor | null
}

// ---------------------------------------------------------------------------
// XML

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code] ?? m
  })
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Styrtecken som XML inte tillåter
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

/** Synlig text i ett stycke: w:t, tabbar och radbrytningar. Fältkoder och struken text räknas inte. */
function paragraphText(xml: string): string {
  let out = ''
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\s*\/>|<w:cr\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) out += decode(m[1])
    else if (m[0].startsWith('<w:tab')) out += '\t'
    else out += '\n'
  }
  return out.replace(/[ \t\u00a0]+/g, ' ').trim()
}

/**
 * Stycken i brödtexten i dokumentordning. Stycken i textrutor (ett stycke i
 * ett stycke) räknas inte som egna; deras text ingår i det yttre stycket.
 * Nästlade tabeller räknas som egna tabeller.
 */
export function parseDocxParagraphs(documentXml: string): DocxParagraph[] {
  const bodyStart = documentXml.indexOf('<w:body')
  if (bodyStart < 0) return []
  const re = /<(\/?)w:(p|tbl|tr|tc)(?=[\s>/])([^>]*?)(\/?)>/g
  re.lastIndex = bodyStart
  const out: DocxParagraph[] = []
  // Tabellstacken: tabellnummer, rad och cell per nivå
  const tables: Array<{ t: number; row: number; cell: number }> = []
  let tableCount = 0
  let pDepth = 0
  let pStart = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(documentXml))) {
    const closing = m[1] === '/'
    const tag = m[2]
    const selfClosing = m[4] === '/'
    if (tag === 'p') {
      if (selfClosing) {
        if (pDepth === 0) out.push(makePara(out.length, documentXml.slice(m.index, re.lastIndex), m.index, re.lastIndex, -1, tables))
        continue
      }
      if (!closing) {
        if (pDepth === 0) pStart = m.index
        pDepth++
      } else {
        pDepth--
        if (pDepth === 0 && pStart >= 0) {
          out.push(makePara(out.length, documentXml.slice(pStart, re.lastIndex), pStart, re.lastIndex, m.index, tables))
          pStart = -1
        }
      }
      continue
    }
    if (pDepth > 0) continue // tabeller i textrutor räknas inte
    if (tag === 'tbl') {
      if (!closing && !selfClosing) tables.push({ t: tableCount++, row: -1, cell: -1 })
      else if (closing) tables.pop()
    } else if (tag === 'tr' && !closing && !selfClosing) {
      const top = tables[tables.length - 1]
      if (top) {
        top.row++
        top.cell = -1
      }
    } else if (tag === 'tc' && !closing && !selfClosing) {
      const top = tables[tables.length - 1]
      if (top) top.cell++
    }
  }
  return out
}

function makePara(
  index: number,
  xml: string,
  start: number,
  end: number,
  closeAt: number,
  tables: Array<{ t: number; row: number; cell: number }>
): DocxParagraph {
  const style = xml.match(/<w:pStyle\s+w:val="([^"]+)"/)?.[1] ?? null
  const top = tables[tables.length - 1]
  return {
    index,
    text: closeAt < 0 ? '' : paragraphText(xml),
    style,
    list: /<w:numPr>/.test(xml) || /lista|list/i.test(style ?? ''),
    table: top ? { t: top.t, row: top.row, cell: top.cell } : null,
    start,
    end,
    closeAt,
  }
}

const HEADING_RE = /rubrik|heading|title/i

/** Rubrik enligt formatmallen (inte tabellrubrik, som Word ofta använder för tomma celler) */
export function isHeading(p: DocxParagraph): boolean {
  return !!p.style && HEADING_RE.test(p.style) && !/tabell|table/i.test(p.style) && !p.table && p.text.length > 0
}

/** Rader för AI:n: index, formatmall, tabellplats och texten (tomma stycken som "(tom)") */
export function docxListing(paras: DocxParagraph[]): string {
  const lines: string[] = []
  let lastEmpty = false
  for (const p of paras) {
    const empty = !p.text
    // Långa serier tomma stycken utanför tabeller säger inget; visa en
    if (empty && !p.table && lastEmpty) continue
    lastEmpty = empty && !p.table
    const tags = [p.style, p.list ? 'lista' : null, p.table ? `tabell ${p.table.t} r${p.table.row} c${p.table.cell}` : null].filter(Boolean).join(', ')
    lines.push(`P${p.index}${tags ? ` [${tags}]` : ''} ${empty ? '(tom)' : p.text.replace(/\s+/g, ' ').slice(0, 1500)}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Ankarkontroll

/** Ett ankare är giltigt om stycket finns, är tomt och inte är en rubrik */
export function anchorOk(paras: DocxParagraph[], p: number | null | undefined): boolean {
  if (p == null || !Number.isInteger(p) || p < 0 || p >= paras.length) return false
  const para = paras[p]
  return para.text === '' && !(para.style && HEADING_RE.test(para.style) && !para.table)
}

/** Texten i närmaste ifyllda stycke före p (i samma tabellrad om stycket ligger i en tabell) */
export function textBefore(paras: DocxParagraph[], p: number): string {
  for (let i = p - 1; i >= 0 && i >= p - 12; i--) {
    if (paras[i].text) return paras[i].text.slice(0, 120)
  }
  return ''
}

/**
 * Kontroll före export: varje ankare ska finnas, vara tomt och ha samma
 * text före sig som när frågan lästes in. Returnerar de nycklar som inte håller.
 */
export function checkAnchor(paras: DocxParagraph[], anchor: RfiAnchor | null | undefined): string[] {
  if (!anchor) return ['saknas']
  const bad: string[] = []
  const targets: Array<[string, number]> = anchor.p != null ? [['p', anchor.p]] : Object.entries(anchor.cells ?? {})
  if (targets.length === 0) return ['saknas']
  for (const [key, p] of targets) {
    if (!anchorOk(paras, p)) bad.push(key)
    else if (anchor.before && anchor.before[key] != null && textBefore(paras, p) !== anchor.before[key]) bad.push(key)
  }
  return bad
}

// ---------------------------------------------------------------------------
// Tolkning utan AI

const QUESTION_START =
  /^(beskriv|ange|hur|vilka|vilken|vilket|vad|varför|när|kan|har|är|finns|på vilket|i vilken|redogör|förklara|övriga|ge exempel|lista|motivera)\b/i

function questionLike(text: string): boolean {
  return text.includes('?') || QUESTION_START.test(text)
}

const YEAR_LABEL = /^(år\s*)?(19|20)\d{2}$/i

/** Fältnyckel ur etiketten i en tabell med företagsuppgifter */
export function fieldKeyOf(label: string, inContact: boolean): string {
  const l = label.toLowerCase()
  const year = l.match(/\b((?:19|20)\d{2})\b/)?.[1]
  if (/omsättning/.test(l)) return year ? `omsattning_${year}` : 'omsattning'
  if (/organisationsnummer|org\.?\s*nr/.test(l)) return 'organisationsnummer'
  if (/moderbolag/.test(l)) return 'moderbolag'
  if (/antal anställda|anställda/.test(l)) return 'antal_anstallda'
  if (/e-?post|mejl|mail/.test(l)) return inContact ? 'kontakt_epost' : 'epost'
  if (/telefon|mobil/.test(l)) return inContact ? 'kontakt_telefon' : 'telefon'
  if (/adress/.test(l)) return inContact ? 'kontakt_adress' : 'adress'
  if (/namn.*titel|titel/.test(l)) return 'kontakt_namn_titel'
  if (/företagsnamn|företagets namn|leverantör|bolagsnamn/.test(l)) return 'foretagsnamn'
  if (/^namn$/.test(l.trim())) return inContact ? 'kontakt_namn' : 'foretagsnamn'
  const slug = l
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return slug || 'uppgift'
}

interface TableRows {
  t: number
  rows: Map<number, Map<number, DocxParagraph[]>>
  paras: DocxParagraph[]
}

function collectTable(paras: DocxParagraph[], from: number): { table: TableRows; next: number } {
  const t = paras[from].table!.t
  const rows = new Map<number, Map<number, DocxParagraph[]>>()
  const list: DocxParagraph[] = []
  let i = from
  while (i < paras.length && paras[i].table && paras[i].table!.t >= t) {
    const p = paras[i]
    if (p.table!.t === t) {
      const r = rows.get(p.table!.row) ?? new Map<number, DocxParagraph[]>()
      const c = r.get(p.table!.cell) ?? []
      c.push(p)
      r.set(p.table!.cell, c)
      rows.set(p.table!.row, r)
    }
    list.push(p)
    i++
  }
  return { table: { t, rows, paras: list }, next: i }
}

/** Tolkar en tabell: svarsruta, etikett-och-tom-cell eller inget */
function readTable(table: TableRows, inContact: boolean): Omit<RfiRawItem, 'question_p' | 'context_p' | 'section_p'> | null {
  // Svarsruta: ett stycke "Svar" eller "Svar:" följt av ett tomt stycke
  const svar = table.paras.findIndex((p) => /^svar\s*:?$/i.test(p.text))
  if (svar >= 0) {
    const empty = table.paras.slice(svar + 1).find((p) => p.text === '')
    if (empty) return { answer_type: 'fritext', answer_p: empty.index }
  }
  // Etikett och tom cell per rad
  const fields: Array<{ label: string; p: number }> = []
  let prevFirst = ''
  for (const [, cells] of [...table.rows.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...cells.entries()].sort((a, b) => a[0] - b[0]).map(([, ps]) => ps)
    if (ordered.length < 2) continue
    const last = ordered[ordered.length - 1]
    if (last.some((p) => p.text)) continue
    const labels = ordered.slice(0, -1).map((ps) => ps.map((p) => p.text).filter(Boolean).join(' '))
    if (labels[0]) prevFirst = labels[0]
    else if (prevFirst) labels[0] = prevFirst.replace(/\s*\b(19|20)\d{2}\b/, '')
    const label = labels.filter(Boolean).join(' ').trim()
    if (!label) continue
    fields.push({ label, p: last[0].index })
  }
  if (fields.length === 0) {
    // En ensam tom ruta efter frågan
    if (table.paras.length > 0 && table.paras.every((p) => p.text === '') && table.rows.size === 1) {
      return { answer_type: 'fritext', answer_p: table.paras[0].index }
    }
    return null
  }
  if (fields.every((f) => YEAR_LABEL.test(f.label))) {
    return {
      answer_type: 'procent_per_ar',
      years: fields.map((f) => ({ year: Number(f.label.match(/(19|20)\d{2}/)![0]), answer_p: f.p })),
    }
  }
  const seen = new Set<string>()
  return {
    answer_type: 'foretagsuppgift',
    fields: fields.map((f) => {
      let key = fieldKeyOf(f.label, inContact)
      while (seen.has(key)) key = `${key}_2`
      seen.add(key)
      return { key, label: f.label, answer_p: f.p }
    }),
  }
}

/**
 * Deterministisk tolkning av ett frågeformulär. Rubriker blir avsnitt, text
 * före en svarsruta blir frågan (sammanhang före den första frågelika raden),
 * text som inte följs av någon svarsruta före nästa rubrik blir bakgrund.
 */
export function guessRfiItems(paras: DocxParagraph[]): { items: RfiRawItem[]; background_p: number[] } {
  const items: RfiRawItem[] = []
  const background: number[] = []
  let section: number | null = null
  let pending: number[] = []
  let i = 0
  while (i < paras.length) {
    const p = paras[i]
    if (!p.table) {
      if (isHeading(p)) {
        // Text före första rubriken är formulärets huvud (datum, dokumentnamn)
        if (section != null) background.push(...pending)
        pending = []
        section = p.index
      } else if (p.text) {
        pending.push(p.index)
      }
      i++
      continue
    }
    const { table, next } = collectTable(paras, i)
    i = next
    const lastText = pending.length ? paras[pending[pending.length - 1]].text : ''
    const inContact = /kontakt/i.test(lastText)
    const read = readTable(table, inContact)
    if (!read) {
      pending.push(...table.paras.filter((x) => x.text).map((x) => x.index))
      continue
    }
    const qi = pending.findIndex((idx) => questionLike(paras[idx].text))
    let question = qi >= 0 ? pending.slice(qi) : pending
    let context = qi > 0 ? pending.slice(0, qi) : []
    if (question.length === 0 && section != null) {
      question = [section]
      context = []
    }
    if (question.length === 0) continue
    let type = read.answer_type
    if (type === 'fritext') {
      const first = paras[question[0]].text
      const all = question.map((idx) => paras[idx].text).join(' ')
      if (/^(har|kan|är|finns)\s+ni\b/i.test(first) && /\bom ja\b/i.test(all)) type = 'ja_nej'
    }
    items.push({ ...read, answer_type: type, section_p: section, question_p: question, context_p: context })
    pending = []
  }
  return { items, background_p: background }
}

// ---------------------------------------------------------------------------
// Frågor ur hänvisningar

function joinParas(paras: DocxParagraph[], idx: number[] | undefined): string {
  return (idx ?? [])
    .filter((i) => Number.isInteger(i) && i >= 0 && i < paras.length && paras[i].text)
    .sort((a, b) => a - b)
    .map((i) => (paras[i].list ? `- ${paras[i].text}` : paras[i].text))
    .join('\n')
}

/** Text ur styckeindex (bakgrund och liknande) */
export function textOfParas(paras: DocxParagraph[], idx: number[] | undefined): string {
  return joinParas(paras, idx)
}

/**
 * Bygger frågorna ur hänvisningarna. Frågetext, sammanhang och avsnitt läses
 * ordagrant ur dokumentet. Ankare som inte finns eller inte är tomma tas bort
 * och frågan markeras som overifierad. Frågor utan text hoppas över; samma
 * ankare används bara en gång.
 */
export function buildRfiQuestions(paras: DocxParagraph[], items: RfiRawItem[]): RfiQuestionDraft[] {
  const used = new Set<number>()
  const out: RfiQuestionDraft[] = []
  const take = (p: number | null | undefined): number | null => {
    if (p == null || used.has(p) || !anchorOk(paras, p)) return null
    used.add(p)
    return p
  }
  const sorted = [...items].sort((a, b) => firstIndex(a) - firstIndex(b))
  for (const it of sorted) {
    const question = joinParas(paras, it.question_p)
    if (!question) continue
    const context = joinParas(paras, it.context_p) || null
    const section = it.section_p != null && paras[it.section_p]?.text ? paras[it.section_p].text : null
    const type: RfiAnswerType = RFI_ANSWER_TYPES.includes(it.answer_type) ? it.answer_type : 'fritext'
    const meta: RfiAnswerMeta = {}
    let anchor: RfiAnchor | null = null

    if (type === 'procent_per_ar' && it.years && it.years.length > 0) {
      const cells: Record<string, number> = {}
      const before: Record<string, string> = {}
      let ok = true
      const years: number[] = []
      for (const y of it.years) {
        if (!Number.isInteger(y.year) || y.year < 1990 || y.year > 2100 || years.includes(y.year)) continue
        years.push(y.year)
        const p = take(y.answer_p)
        if (p == null) ok = false
        else {
          cells[String(y.year)] = p
          before[String(y.year)] = textBefore(paras, p)
        }
      }
      meta.years = years
      anchor = Object.keys(cells).length ? { kind: 'docx', cells, before, verified: ok } : null
    } else if (type === 'foretagsuppgift' && it.fields && it.fields.length > 0) {
      const cells: Record<string, number> = {}
      const before: Record<string, string> = {}
      const fields: RfiField[] = []
      let ok = true
      for (const f of it.fields) {
        const key = String(f.key ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 80)
        if (!key || fields.some((x) => x.key === key)) continue
        const p = take(f.answer_p)
        let label = (f.label ?? '').trim() || (p != null ? textBefore(paras, p) : key)
        // En ensam årtalsetikett ("2025") ärver föregående rads etikett utan år
        const prev = fields[fields.length - 1]?.label
        if (/^(19|20)\d{2}$/.test(label) && prev) label = `${prev.replace(/\s*\b(19|20)\d{2}\b/, '').trim()} ${label}`
        fields.push({ key, label })
        if (p == null) ok = false
        else {
          cells[key] = p
          before[key] = textBefore(paras, p)
        }
      }
      meta.fields = fields
      anchor = Object.keys(cells).length ? { kind: 'docx', cells, before, verified: ok } : null
    } else {
      const p = take(it.answer_p)
      anchor = p != null ? { kind: 'docx', p, before: { p: textBefore(paras, p) }, verified: true } : null
    }
    out.push({
      sort_order: (out.length + 1) * 10,
      section,
      question,
      context,
      answer_type: type === 'procent_per_ar' && !meta.years?.length ? 'fritext' : type === 'foretagsuppgift' && !meta.fields?.length ? 'fritext' : type,
      answer_meta: meta,
      anchor,
    })
  }
  return out
}

function firstIndex(it: RfiRawItem): number {
  const all = [...(it.question_p ?? []), it.answer_p ?? Infinity]
  return Math.min(...all.filter((n): n is number => typeof n === 'number'))
}

// ---------------------------------------------------------------------------
// Export: skriv svaren i köparens dokument

export interface DocxFill {
  p: number
  text: string
}

/** Körningens formatering ur styckets formatering för styckemarkeringen (w:pPr/w:rPr) */
function runPropsOf(paraXml: string): string {
  const pPr = paraXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)?.[1] ?? ''
  const rPr = pPr.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1]
  if (!rPr) return ''
  const clean = rPr
    .replace(/<w:(ins|del|moveFrom|moveTo)\b[^>]*\/>/g, '')
    .replace(/<w:(ins|del|moveFrom|moveTo)\b[^>]*>[\s\S]*?<\/w:\1>/g, '')
    .replace(/<w:rPrChange\b[\s\S]*?<\/w:rPrChange>/g, '')
  return clean.trim() ? `<w:rPr>${clean}</w:rPr>` : ''
}

function runsFor(text: string, rPr: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  return lines
    .map((line, i) => `<w:r>${rPr}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
    .join('')
}

/**
 * Skriver text i angivna stycken. Allt annat i dokumentet lämnas byte för
 * byte orört. Stycken som inte finns hoppas över (anroparen har kontrollerat
 * ankarna). Returnerar den nya XML-texten.
 */
export function fillDocxXml(documentXml: string, fills: DocxFill[]): string {
  const paras = parseDocxParagraphs(documentXml)
  const byP = new Map<number, string>()
  for (const f of fills) {
    if (!f.text.trim() || f.p < 0 || f.p >= paras.length) continue
    byP.set(f.p, byP.has(f.p) ? `${byP.get(f.p)}\n${f.text}` : f.text)
  }
  const targets = [...byP.entries()].sort((a, b) => b[0] - a[0])
  let xml = documentXml
  for (const [p, text] of targets) {
    const para = paras[p]
    const paraXml = xml.slice(para.start, para.end)
    if (para.closeAt < 0) {
      // <w:p .../> blir <w:p ...>körningar</w:p>
      const open = paraXml.replace(/\s*\/>$/, '>')
      xml = `${xml.slice(0, para.start)}${open}${runsFor(text, '')}</w:p>${xml.slice(para.end)}`
    } else {
      const runs = runsFor(text, runPropsOf(paraXml))
      xml = `${xml.slice(0, para.closeAt)}${runs}${xml.slice(para.closeAt)}`
    }
  }
  return xml
}

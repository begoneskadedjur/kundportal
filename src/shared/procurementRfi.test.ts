// src/shared/procurementRfi.test.ts
// RFI-läget (3.71.0): docx-utläsning med ankare, ankarkontroll, export som
// skriver på rätt ställe och lämnar resten orört, stegens status och
// matchningen mot den riktiga annonsen. Fixturen är en avskalad och
// anonymiserad variant av en kommuns frågeformulär (rubriker, tabell med
// företagsuppgifter, frågor med svarsruta, procent per år).

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  anchorOk,
  buildRfiQuestions,
  checkAnchor,
  docxListing,
  fillDocxXml,
  guessRfiItems,
  parseDocxParagraphs,
  textOfParas,
} from './procurementRfiDocx'
import {
  answerAsText,
  answerFills,
  exportIssues,
  fillRfiAnswers,
  isAnswered,
  matchFollowUps,
  prefillValues,
  rfiProgress,
  rfiStepStates,
  workModeOf,
} from './procurementRfi'
import { stepOf } from '../components/admin/procurement/detail/steps'
import type { ProcurementRfiQuestion } from '../types/procurement'

// ---------------------------------------------------------------------------
// Fixtur

const p = (text: string, style?: string, extra = '') =>
  `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${text ? `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>` : ''}</w:p>`
const pBold = (style: string) => `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:pPr></w:p>`
const cell = (...paras: string[]) => `<w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>${paras.join('')}</w:tc>`
const row = (...cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`
const table = (...rows: string[]) => `<w:tbl><w:tblPr><w:tblStyle w:val="Tabellrutnt"/></w:tblPr>${rows.join('')}</w:tbl>`
const svarBox = () => table(row(cell(p('Svar:', 'Brdtext'), p('', 'Brdtext'))))
const bullet = (t: string) => p(t, 'Punktlista', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr>')

const BODY = [
  p('Bilaga svarsformulär RFI', 'Aliasfrvaltningorganisation'),
  p('Information om företaget', 'Rubrik1'),
  table(
    row(cell(p('Företagsnamn', 'Brdtext')), cell(pBold('Tabellrubrik'))),
    row(cell(p('Organisationsnummer', 'Brdtext')), cell(pBold('Tabellrubrik'))),
    row(cell(p('Företagets årsomsättning', 'Brdtext')), cell(p('2024', 'Brdtext')), cell(pBold('Tabellrubrik'))),
    row(cell(p('', 'Brdtext')), cell(p('2025', 'Brdtext')), cell(pBold('Tabellrubrik')))
  ),
  p('', 'Formatmall1'),
  p('Kontaktperson ', 'Formatmall1'),
  table(row(cell(p('Namn, titel', 'Brdtext')), cell(pBold('Tabellrubrik'))), row(cell(p('E-post', 'Brdtext')), cell(pBold('Tabellrubrik')))),
  p('Beskriv kortfattat företaget &amp; verksamheten.', 'Brdtext'),
  svarBox(),
  p('Har ni några certifieringar? Om JA, ange vilka.', 'Brdtext'),
  svarBox(),
  p('Bakgrund till frågorna', 'Rubrik1'),
  p('Kommunens nuvarande avtal omfattar', 'Brdtext'),
  bullet('Fullservice skadedjursbekämpning för cirka 600 objekt.'),
  p('Frågor om tjänsterna', 'Rubrik1'),
  p('Statistik och kartvy', 'Rubrik5'),
  p('Kommunen behöver överblick över alla fällor.', 'Brdtext'),
  p('Hur ser era möjligheter ut att erbjuda:', 'Brdtext'),
  bullet('Kartvy med fällornas koordinater.'),
  bullet('Statistik per fälla.'),
  svarBox(),
  p('Transporter', 'Rubrik4'),
  p('Ange % av totala antalet transporter:', 'Brdtext'),
  table(row(cell(p('År 2027', 'Brdtext')), cell(pBold('Tabellrubrik'))), row(cell(p('År 2028', 'Brdtext')), cell('<w:p/>'))),
  p('Tack för att ni tog er tid.', 'Brdtext'),
].join('')

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${BODY}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`

function questionsOf(xml = XML) {
  const paras = parseDocxParagraphs(xml)
  const g = guessRfiItems(paras)
  return { paras, guess: g, qs: buildRfiQuestions(paras, g.items) }
}

function asRow(q: ReturnType<typeof questionsOf>['qs'][number], i: number, patch: Partial<ProcurementRfiQuestion> = {}): ProcurementRfiQuestion {
  return {
    id: `q${i}`,
    notice_id: 'n',
    document_id: 'd',
    sort_order: q.sort_order,
    section: q.section,
    question: q.question,
    context: q.context,
    answer_type: q.answer_type,
    answer_meta: q.answer_meta,
    anchor: q.anchor,
    answer: null,
    answer_values: {},
    answer_status: 'utkast',
    answer_source: null,
    draft_sources: [],
    library_answer_id: null,
    updated_by: null,
    created_at: '2026-10-20T10:00:00+02:00',
    updated_at: '2026-10-20T10:00:00+02:00',
    ...patch,
  }
}

// ---------------------------------------------------------------------------

describe('parseDocxParagraphs', () => {
  it('räknar stycken i dokumentordning med tabellplats, formatmall och lista', () => {
    const paras = parseDocxParagraphs(XML)
    expect(paras[0]).toMatchObject({ index: 0, text: 'Bilaga svarsformulär RFI', table: null })
    expect(paras[1]).toMatchObject({ text: 'Information om företaget', style: 'Rubrik1' })
    expect(paras[2]).toMatchObject({ text: 'Företagsnamn', table: { t: 0, row: 0, cell: 0 } })
    expect(paras[3]).toMatchObject({ text: '', style: 'Tabellrubrik', table: { t: 0, row: 0, cell: 1 } })
    expect(paras.find((x) => x.text === 'Kartvy med fällornas koordinater.')?.list).toBe(true)
    expect(paras.find((x) => x.text.startsWith('Beskriv'))?.text).toBe('Beskriv kortfattat företaget & verksamheten.')
    // <w:p/> räknas som ett tomt stycke
    expect(paras.filter((x) => x.closeAt < 0)).toHaveLength(1)
  })

  it('räknar inte stycken i textrutor som egna', () => {
    const xml = XML.replace(
      p('Tack för att ni tog er tid.', 'Brdtext'),
      `<w:p><w:r><w:drawing><wp:inline><w:txbxContent><w:p><w:r><w:t>I rutan</w:t></w:r></w:p></w:txbxContent></wp:inline></w:drawing></w:r></w:p>${p('Tack', 'Brdtext')}`
    )
    const paras = parseDocxParagraphs(xml)
    expect(paras.some((x) => x.text === 'I rutan')).toBe(true)
    expect(paras[paras.length - 1].text).toBe('Tack')
    expect(paras.length).toBe(parseDocxParagraphs(XML).length + 1)
  })

  it('listar styckena med index för AI:n', () => {
    const listing = docxListing(parseDocxParagraphs(XML))
    expect(listing).toContain('P1 [Rubrik1] Information om företaget')
    expect(listing).toMatch(/P3 \[Tabellrubrik, tabell 0 r0 c1\] \(tom\)/)
  })
})

describe('guessRfiItems och buildRfiQuestions', () => {
  it('läser ut alla frågor i ordning med verifierade ankare', () => {
    const { qs, paras } = questionsOf()
    expect(qs.map((q) => q.answer_type)).toEqual(['foretagsuppgift', 'foretagsuppgift', 'fritext', 'ja_nej', 'fritext', 'procent_per_ar'])
    expect(qs.every((q) => q.anchor?.verified)).toBe(true)

    const company = qs[0]
    expect(company.question).toBe('Information om företaget')
    expect(company.answer_meta.fields?.map((f) => f.key)).toEqual(['foretagsnamn', 'organisationsnummer', 'omsattning_2024', 'omsattning_2025'])
    expect(company.answer_meta.fields?.[3].label).toBe('Företagets årsomsättning 2025')
    for (const pIdx of Object.values(company.anchor!.cells!)) expect(paras[pIdx].text).toBe('')

    expect(qs[1].question).toBe('Kontaktperson')
    expect(qs[1].answer_meta.fields?.map((f) => f.key)).toEqual(['kontakt_namn_titel', 'kontakt_epost'])

    const describe = qs[2]
    expect(describe.question).toBe('Beskriv kortfattat företaget & verksamheten.')
    expect(paras[describe.anchor!.p! - 1].text).toBe('Svar:')

    const map = qs[4]
    expect(map.section).toBe('Statistik och kartvy')
    expect(map.context).toBe('Kommunen behöver överblick över alla fällor.')
    expect(map.question).toBe('Hur ser era möjligheter ut att erbjuda:\n- Kartvy med fällornas koordinater.\n- Statistik per fälla.')

    expect(qs[5].answer_meta.years).toEqual([2027, 2028])
  })

  it('lägger text utan svarsruta som bakgrund och hoppar över formulärets huvud', () => {
    const { paras, guess } = questionsOf()
    const bg = textOfParas(paras, guess.background_p)
    expect(bg).toContain('Kommunens nuvarande avtal omfattar')
    expect(bg).toContain('- Fullservice skadedjursbekämpning')
    expect(bg).not.toContain('Bilaga svarsformulär')
  })

  it('tar bort ankare som pekar på text eller används två gånger', () => {
    const { paras, qs } = questionsOf()
    const textP = paras.findIndex((x) => x.text === 'Svar:')
    const good = qs[2].anchor!.p!
    const built = buildRfiQuestions(paras, [
      { question_p: [paras.findIndex((x) => x.text.startsWith('Beskriv'))], answer_type: 'fritext', answer_p: textP },
      { question_p: [paras.findIndex((x) => x.text.startsWith('Har ni'))], answer_type: 'fritext', answer_p: good },
      { question_p: [paras.findIndex((x) => x.text.startsWith('Hur ser'))], answer_type: 'fritext', answer_p: good },
      { question_p: [9999], answer_type: 'fritext', answer_p: good },
    ])
    expect(built).toHaveLength(3)
    expect(built[0].anchor).toBeNull()
    expect(built[1].anchor?.p).toBe(good)
    expect(built[2].anchor).toBeNull()
  })
})

describe('ankarkontroll', () => {
  it('godkänner tomma stycken och underkänner text, rubriker och index utanför', () => {
    const paras = parseDocxParagraphs(XML)
    expect(anchorOk(paras, 3)).toBe(true)
    expect(anchorOk(paras, 2)).toBe(false)
    expect(anchorOk(paras, 10_000)).toBe(false)
    expect(anchorOk(paras, null)).toBe(false)
  })

  it('upptäcker när dokumentet ändrats sedan frågorna lästes in', () => {
    const { qs } = questionsOf()
    const anchor = qs[2].anchor!
    expect(checkAnchor(parseDocxParagraphs(XML), anchor)).toEqual([])
    // Ett stycke till före frågan förskjuter alla index
    const shifted = XML.replace('<w:body>', `<w:body>${p('Ny inledning', 'Brdtext')}`)
    expect(checkAnchor(parseDocxParagraphs(shifted), anchor)).toEqual(['p'])
    expect(checkAnchor(parseDocxParagraphs(XML), null)).toEqual(['saknas'])
  })
})

describe('export', () => {
  const filled = () => {
    const { qs } = questionsOf()
    return [
      asRow(qs[0], 0, { answer_values: { foretagsnamn: 'BeGone Skadedjur & Sanering AB', organisationsnummer: '559378-9208', omsattning_2025: '12 mkr' } }),
      asRow(qs[1], 1),
      asRow(qs[2], 2, { answer: 'Rad ett <med> tecken\nRad två', answer_status: 'godkand' }),
      asRow(qs[3], 3, { answer: 'Behörighet klass 1.', answer_values: { choice: 'ja' } }),
      asRow(qs[4], 4, { answer: 'Kartvy finns.' }),
      asRow(qs[5], 5, { answer_values: { '2027': '30', '2028': '45.5' } }),
    ]
  }

  it('skriver svaren i rätt stycken och lämnar resten orört', () => {
    const rows = filled()
    const { xml, written, skipped } = fillRfiAnswers(XML, rows)
    expect(written).toBe(5)
    expect(skipped).toEqual([{ id: 'q1', reason: 'obesvarad' }])

    const before = parseDocxParagraphs(XML)
    const after = parseDocxParagraphs(xml)
    expect(after).toHaveLength(before.length)
    const changed = new Set<number>()
    for (const r of rows) for (const f of answerFills(r)) changed.add(f.p)
    for (let i = 0; i < before.length; i++) {
      if (!changed.has(i)) expect(after[i].text).toBe(before[i].text)
    }
    const c = rows[0].anchor!.cells!
    expect(after[c.foretagsnamn].text).toBe('BeGone Skadedjur & Sanering AB')
    expect(after[c.organisationsnummer].text).toBe('559378-9208')
    expect(after[c.omsattning_2024].text).toBe('')
    expect(after[c.omsattning_2025].text).toBe('12 mkr')
    expect(after[rows[2].anchor!.p!].text).toBe('Rad ett <med> tecken\nRad två')
    expect(after[rows[3].anchor!.p!].text).toBe('Ja. Behörighet klass 1.')
    const y = rows[5].anchor!.cells!
    expect(after[y['2027']].text).toBe('30 %')
    // Det tomma <w:p/> i sista tabellen får körningar och blir ett vanligt stycke
    expect(after[y['2028']].text).toBe('45,5 %')

    // Tecken escapas, styckeformateringen behålls och körningen ärver w:rPr
    expect(xml).toContain('Rad ett &lt;med&gt; tecken')
    expect(xml).toContain('<w:br/>')
    expect(xml).toContain('<w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">559378-9208</w:t></w:r>')
    // Allt före första ändrade stycket är byte för byte detsamma
    const first = Math.min(...[...changed])
    expect(xml.slice(0, before[first].start)).toBe(XML.slice(0, before[first].start))
    expect(xml.endsWith('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>')).toBe(true)
  })

  it('hoppar över frågor vars ankare inte längre håller', () => {
    const rows = filled()
    const shifted = XML.replace('<w:body>', `<w:body>${p('Ny inledning', 'Brdtext')}`)
    const r = fillRfiAnswers(shifted, rows)
    expect(r.written).toBe(0)
    expect(r.xml).toBe(shifted)
  })

  it('går att packa som docx och läsa tillbaka', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', XML)
    zip.file('word/styles.xml', '<w:styles/>')
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }))
    const xml = await loaded.file('word/document.xml')!.async('string')
    const { xml: out } = fillRfiAnswers(xml, filled())
    loaded.file('word/document.xml', out)
    const again = await JSZip.loadAsync(await loaded.generateAsync({ type: 'uint8array' }))
    expect(await again.file('word/styles.xml')!.async('string')).toBe('<w:styles/>')
    expect(parseDocxParagraphs(await again.file('word/document.xml')!.async('string')).some((x) => x.text === '30 %')).toBe(true)
  })

  it('fillDocxXml ignorerar tomma svar och index utanför dokumentet', () => {
    expect(fillDocxXml(XML, [{ p: 3, text: '   ' }, { p: 99_999, text: 'x' }])).toBe(XML)
  })

  it('varnar för obesvarade, ej godkända och luckor', () => {
    const rows = filled()
    rows[4] = { ...rows[4], answer: 'Vi har [FYLL I: antal fordon] bilar.' }
    expect(exportIssues(rows)).toEqual({ unanswered: 2, notApproved: 5, withGaps: 1, unanchored: 0 })
    expect(rfiProgress(rows)).toEqual({ total: 6, answered: 4, approved: 1 })
    expect(isAnswered(rows[3])).toBe(true)
    expect(answerAsText(rows[5])).toBe('2027: 30 %\n2028: 45,5 %')
  })
})

describe('företagsuppgifter', () => {
  it('fyller i sparade uppgifter, BeGones fasta uppgifter och ansvarig, och skriver inte över', () => {
    const fields = [{ key: 'foretagsnamn' }, { key: 'organisationsnummer' }, { key: 'omsattning_2025' }, { key: 'kontakt_namn_titel' }, { key: 'kontakt_epost' }, { key: 'kontakt_telefon' }]
    const v = prefillValues(fields, { kontakt_epost: 'redan@ifylld.se' }, { omsattning_2025: '12 mkr' }, { name: 'Anna Ansvarig', email: 'anna@begone.se', phone: '010 280 44 10' })
    expect(v).toEqual({
      foretagsnamn: 'BeGone Skadedjur & Sanering AB',
      organisationsnummer: '559378-9208',
      omsattning_2025: '12 mkr',
      kontakt_namn_titel: 'Anna Ansvarig',
      kontakt_epost: 'redan@ifylld.se',
      kontakt_telefon: '010 280 44 10',
    })
  })
})

describe('RFI-läget', () => {
  it('väljer läge ur notice_kind eller manuellt val', () => {
    expect(workModeOf({ notice_kind: 'rfi' })).toBe('rfi')
    expect(workModeOf({ notice_kind: 'tender' })).toBe('tender')
    expect(workModeOf({ notice_kind: 'rfi', work_mode: 'tender' })).toBe('tender')
    expect(workModeOf({ notice_kind: 'tender', work_mode: 'rfi' })).toBe('rfi')
  })

  it('stegen i adressen följer läget', () => {
    expect(stepOf('svar', 'rfi')).toBe('svar')
    expect(stepOf('uppfoljning', 'rfi')).toBe('uppfoljning')
    expect(stepOf('kalkyl', 'rfi')).toBe('oversikt')
    expect(stepOf('svar', 'tender')).toBe('oversikt')
    expect(stepOf('logg', 'rfi')).toBe('logg')
  })

  it('stegpunkterna i RFI-läget', () => {
    const base = { status: 'analyzing' as const, documents: 0, questions: 0, answered: 0, approved: 0, signalFollowed: false, savedToLibrary: 0 }
    expect(rfiStepStates({ ...base, status: 'new' })).toEqual({ oversikt: 'doing', underlag: 'todo', svar: 'todo', uppfoljning: 'todo' })
    expect(rfiStepStates({ ...base, documents: 1 }).underlag).toBe('doing')
    expect(rfiStepStates({ ...base, documents: 1, questions: 23 }).underlag).toBe('done')
    expect(rfiStepStates({ ...base, questions: 23, answered: 4 }).svar).toBe('doing')
    expect(rfiStepStates({ ...base, questions: 23, answered: 23, approved: 23 }).svar).toBe('done')
    expect(rfiStepStates({ ...base, status: 'submitted', questions: 23, approved: 20 })).toMatchObject({ svar: 'done', uppfoljning: 'doing' })
    expect(rfiStepStates({ ...base, status: 'submitted', questions: 23, approved: 20, signalFollowed: true, savedToLibrary: 18 }).uppfoljning).toBe('done')
  })

  it('hittar den riktiga annonsen hos samma köpare', () => {
    const rfi = { id: 'r', title: 'RFI Skadedjursbekämpning', buyer_id: 'b', buyer_name: 'Malmö stad', published_at: '2026-10-20T08:00:00Z', created_at: '2026-10-20T08:00:00Z' }
    const c = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
      id,
      title,
      buyer_id: 'b',
      buyer_name: 'Malmö stad',
      notice_kind: 'tender' as const,
      published_at: '2027-02-01T08:00:00Z',
      tender_deadline: null,
      bgu_number: 1,
      ...extra,
    })
    const m = matchFollowUps(rfi, [
      c('a', 'Skadedjursbekämpning och egenkontrolltjänster'),
      c('b', 'Städtjänster'),
      c('c', 'Skadedjursbekämpning', { buyer_id: 'annan' }),
      c('d', 'Skadedjursbekämpning', { published_at: '2026-01-01T00:00:00Z' }),
      c('e', 'RFI Skadedjur', { notice_kind: 'rfi' }),
      c('r', 'RFI Skadedjursbekämpning'),
    ])
    expect(m.map((x) => x.id)).toEqual(['a'])
  })
})

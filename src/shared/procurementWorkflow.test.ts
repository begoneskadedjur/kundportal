import { describe, expect, it } from 'vitest'
import { documentLinkFor, originalNoticeUrl, platformOfUrl } from './procurementPlatform'
import { MAX_DOCUMENT_BYTES, MAX_ZIP_BYTES, guessDocType, isJunkEntry, looksLikePriceAppendix, sortFiles } from './procurementFiles'
import {
  MANUAL_NOTE,
  appendixTotals,
  bestCatalogMatch,
  calcCost,
  lineKind,
  lineMarginTone,
  priceAtMargin,
  shouldSuggest,
  suggestPrice,
  type CalcBasis,
  type CatalogItem,
} from './procurementPricing'
import { columnOf, needsOutcomeChoice, statusForDrop } from './procurementBoard'
import { stepOf, stepStates } from '../components/admin/procurement/detail/steps'
import { cleanAppendixRows, colLetter, colNumber, sheetToGridText, type SheetCells } from './procurementAppendix'

// Riktiga rader ur databasen 2026-10-15 (procurement_notices och procurement_notice_sources)
const EAVROP_DOC = 'https://www.e-avrop.com/bolander/e-Upphandling/NoticeLink.aspx?id=138486'
const TENDSIGN_DOC = 'https://tendsign.com/doc.aspx?MeFormsNoticeId=96383'
const KOMMERS_DOC = 'https://www.kommersannons.se/elite/Notice/NoticeDispatch.aspx?NoticeId=95845'
const KOMMERS_WHITE = 'https://leverantorsportal.specialfastigheter.se/Notice/NoticeDispatch.aspx?NoticeId=4648'
const TED = 'https://ted.europa.eu/sv/notice/-/detail/711638-2026'
const MERCELL = 'https://app.mercell.com/tender/-1212611982'

describe('Hämta underlaget: plattform och länk', () => {
  it('känner igen plattformen ur dokumentlänken', () => {
    expect(platformOfUrl(EAVROP_DOC)).toBe('e-avrop')
    expect(platformOfUrl(TENDSIGN_DOC)).toBe('tendsign')
    expect(platformOfUrl(KOMMERS_DOC)).toBe('kommers')
    expect(platformOfUrl(KOMMERS_WHITE)).toBe('kommers')
    expect(platformOfUrl(TED)).toBe('ted')
    expect(platformOfUrl(MERCELL)).toBe('mercell')
    expect(platformOfUrl('javascript:alert(1)')).toBeNull()
  })

  it('document_url går först', () => {
    const l = documentLinkFor({ document_url: TENDSIGN_DOC, platform_url: TED, sources: [{ source: 'mercell', source_sub: 'TED', url: TED }] })
    expect(l).toMatchObject({ url: TENDSIGN_DOC, platform: 'tendsign', platformLabel: 'TendSign', kind: 'document' })
  })

  it('bygger aldrig länk ur sourceNoticeId: e-Avrop utan dokumentlänk ger Mercells annons', () => {
    const l = documentLinkFor({ document_url: null, platform_url: null, sources: [{ source: 'mercell', source_sub: 'e-Avrop', url: MERCELL }] })
    expect(l).toMatchObject({ url: MERCELL, platform: 'mercell', kind: 'notice' })
  })

  it('TED-annonsen före Mercell när dokumentlänk saknas', () => {
    const l = documentLinkFor({ document_url: null, platform_url: TED, sources: [{ source: 'mercell', source_sub: 'TED', url: TED }] })
    expect(l).toMatchObject({ url: TED, platform: 'ted', kind: 'notice' })
  })

  it('Kommers egen annonssida före Mercell', () => {
    const k = 'https://www.kommersannons.se/Notice/TenderNotice/22819'
    const l = documentLinkFor({ document_url: null, platform_url: null, sources: [{ source: 'mercell', url: MERCELL }, { source: 'kommers', url: k }] })
    expect(l).toMatchObject({ url: k, platform: 'kommers', kind: 'notice' })
  })

  it('null utan länkar', () => {
    expect(documentLinkFor({ document_url: null, platform_url: null, sources: [] })).toBeNull()
  })

  it('originalannonsen: TED först, annars källans sida', () => {
    expect(originalNoticeUrl({ document_url: EAVROP_DOC, platform_url: null, sources: [{ source: 'mercell', url: MERCELL }] })).toBe(MERCELL)
    expect(originalNoticeUrl({ document_url: null, platform_url: TED, sources: [{ source: 'ted', url: TED }] })).toBe(TED)
  })
})

describe('Släppytan: zip och lösa filer', () => {
  it('sorterar bort systemfiler och mappar tyst', () => {
    expect(isJunkEntry('__MACOSX/._a.pdf')).toBe(true)
    expect(isJunkEntry('Underlag/.DS_Store')).toBe(true)
    expect(isJunkEntry('Underlag/~$Prisbilaga.xlsx')).toBe(true)
    expect(isJunkEntry('Underlag/Förfrågningsunderlag.pdf')).toBe(false)
    const r = sortFiles([{ name: 'Underlag/', size: 0, dir: true }, { name: '__MACOSX/x.pdf', size: 10 }])
    expect(r.accepted).toHaveLength(0)
    expect(r.skipped).toHaveLength(0)
  })

  it('hoppar över för stora, oläsbara, tomma och zip i zip', () => {
    const r = sortFiles(
      [
        { name: 'a/Förfrågningsunderlag.pdf', size: 1000 },
        { name: 'a/Bilaga 2 Prisbilaga.xlsx', size: 2000 },
        { name: 'a/Ritning.dwg', size: 2000 },
        { name: 'a/Stor.pdf', size: MAX_DOCUMENT_BYTES + 1 },
        { name: 'a/inre.zip', size: 500 },
        { name: 'a/tom.pdf', size: 0 },
      ],
      { insideZip: true }
    )
    expect(r.accepted.map((f) => f.name)).toEqual(['a/Förfrågningsunderlag.pdf', 'a/Bilaga 2 Prisbilaga.xlsx'])
    expect(r.skipped.map((s) => [s.name, s.reason])).toEqual([
      ['Ritning.dwg', 'unreadable'],
      ['Stor.pdf', 'too_large'],
      ['inre.zip', 'nested_zip'],
      ['tom.pdf', 'empty'],
    ])
  })

  it('en zip på släppytan tas emot för uppackning', () => {
    expect(sortFiles([{ name: 'Underlag.zip', size: 1000 }]).accepted).toHaveLength(1)
    // Zip över 50 MB packas upp; bara filerna i den har 50 MB-gränsen
    expect(sortFiles([{ name: 'Underlag.zip', size: MAX_DOCUMENT_BYTES * 2 }]).accepted).toHaveLength(1)
    expect(sortFiles([{ name: 'Underlag.zip', size: MAX_ZIP_BYTES + 1 }]).skipped[0].reason).toBe('too_large')
  })

  it('köparens prisbilaga blir Bilaga, aldrig inkommen prisbilaga', () => {
    expect(guessDocType('Bilaga 2 Prisbilaga.xlsx')).toBe('appendix')
    expect(guessDocType('Förfrågningsunderlag.pdf')).toBe('tender_documents')
    expect(looksLikePriceAppendix('Bilaga 2 Prisbilaga.xlsx')).toBe(true)
    expect(looksLikePriceAppendix('Kravspecifikation.pdf')).toBe(false)
  })
})

describe('Föreslå priser', () => {
  const catalog: CatalogItem[] = [
    { id: 'p1', name: 'Råttbekämpning', unit: 'st', price: 3400, cost: null, kind: 'service', listName: 'Avtal 2026' },
    { id: 'p2', name: 'Fällor mekaniska', unit: 'st', price: 250, cost: 90, kind: 'article', listName: 'Avtal 2026' },
    { id: 'p3', name: 'Getingsanering', unit: 'st', price: 1990, cost: null, kind: 'service', listName: 'Avtal 2026' },
  ]
  const basis: CalcBasis = { hourlyCost: 1000, hoursPerVisit: 1, travelHoursPerVisit: 0.5, consumablesPerVisit: 50, hoursPerCallout: 1.5, targetMarginPercent: 35 }

  it('radens art ur benämning och enhet', () => {
    expect(lineKind('Timpris, sanering utöver fast pris', 'tim')).toBe('hour')
    expect(lineKind('Akut ärende, fast pris per utryckning', 'st')).toBe('callout')
    expect(lineKind('Förebyggande kontroll, per objekt och år', 'objekt')).toBe('visit')
    expect(lineKind('Duvnät', 'm2')).toBe('other')
  })

  it('kostnad ur kalkylen', () => {
    expect(calcCost('hour', basis)).toBe(1000)
    expect(calcCost('visit', basis)).toBe(1550)
    expect(calcCost('callout', basis)).toBe(2050)
    expect(calcCost('other', basis)).toBeNull()
    expect(priceAtMargin(650, 35)).toBeCloseTo(1000, 6)
  })

  it('matchar prislistan på ord, även böjda former', () => {
    expect(bestCatalogMatch('Råttbekämpningen i källare', catalog)?.item.id).toBe('p1')
    expect(bestCatalogMatch('Mekaniska fällor', catalog)?.item.id).toBe('p2')
    expect(bestCatalogMatch('Duvnät', catalog)).toBeNull()
  })

  it('prislistans pris och artikelns kostnad', () => {
    const s = suggestPrice({ label: 'Mekaniska fällor', unit: 'st' }, catalog, basis)
    expect(s).toMatchObject({ unitPrice: 250, unitCost: 90, priceListItemId: 'p2', source: 'price_list' })
    expect(s.marginPct).toBeCloseTo(64, 0)
    expect(s.note).toContain('prislistan Avtal 2026')
  })

  it('tjänst ur prislistan får kostnad ur kalkylen när raden är ett besök', () => {
    const s = suggestPrice({ label: 'Råttbekämpning, kontroll per besök', unit: 'besök' }, catalog, basis)
    expect(s.unitPrice).toBe(3400)
    expect(s.unitCost).toBe(1550)
    expect(s.note).toContain('kostnad ur kalkylen')
  })

  it('kalkylen när prislistan saknar raden', () => {
    const s = suggestPrice({ label: 'Timpris utöver fast pris', unit: 'tim' }, catalog, basis)
    expect(s).toMatchObject({ unitPrice: 1538, unitCost: 1000, source: 'calc', priceListItemId: null })
    expect(s.marginPct).toBeCloseTo(35, 0)
  })

  it('inget förslag utan träff och utan kalkylpost', () => {
    expect(suggestPrice({ label: 'Duvnät', unit: 'm2' }, catalog, basis)).toMatchObject({ unitPrice: null, source: 'none' })
    expect(suggestPrice({ label: 'Timpris', unit: 'tim' }, [], null)).toMatchObject({ unitPrice: null, source: 'none' })
  })

  it('skriver aldrig över hand-justerade rader', () => {
    expect(shouldSuggest({ unit_price: null, notes: null })).toBe(true)
    expect(shouldSuggest({ unit_price: 100, notes: 'Förslag från kalkylen: x' })).toBe(true)
    expect(shouldSuggest({ unit_price: 100, notes: MANUAL_NOTE })).toBe(false)
    expect(shouldSuggest({ unit_price: 100, notes: null })).toBe(false)
  })

  it('röd marginal under noll', () => {
    expect(lineMarginTone(-3, { min_margin_percent: 20, target_margin_percent: 35 })).toBe('bad')
    expect(lineMarginTone(22, { min_margin_percent: 20, target_margin_percent: 35 })).toBe('warn')
    expect(lineMarginTone(40, { min_margin_percent: 20, target_margin_percent: 35 })).toBe('good')
    expect(lineMarginTone(null)).toBe('none')
  })

  it('summor: marginal bara när kostnad finns på rader med pris', () => {
    expect(appendixTotals([{ quantity: 2, unit_price: 100, unit_cost: 60 }, { quantity: 1, unit_price: null, unit_cost: null }])).toEqual({
      revenue: 200,
      cost: 120,
      costKnown: true,
      margin: 40,
    })
    expect(appendixTotals([{ quantity: 2, unit_price: 100, unit_cost: null }]).margin).toBeNull()
  })
})

describe('Anbudstavlan', () => {
  it('kolumn per status', () => {
    expect(columnOf('watching')).toBe('bedoms')
    expect(columnOf('analyzing')).toBe('bedoms')
    expect(columnOf('bidding')).toBe('pagar')
    expect(columnOf('won')).toBe('avgjort')
    expect(columnOf('declined')).toBeNull()
  })

  it('släpp ändrar status, samma kolumn gör inget, Avgjort kräver val', () => {
    expect(statusForDrop('analyzing', 'pagar')).toBe('bidding')
    expect(statusForDrop('watching', 'bedoms')).toBeNull()
    expect(statusForDrop('bidding', 'lamnat')).toBe('submitted')
    expect(statusForDrop('submitted', 'avgjort')).toBeNull()
    expect(needsOutcomeChoice('submitted', 'avgjort')).toBe(true)
    expect(needsOutcomeChoice('won', 'avgjort')).toBe(false)
  })
})

describe('Läs in köparens prisbilaga', () => {
  const cells: SheetCells = new Map<string, string | number | boolean | null>([
    ['A1', 'Post'],
    ['C1', 'Mängd'],
    ['E1', 'À-pris'],
    ['F1', 'Summa'],
    ['A2', 'Förebyggande kontroll'],
    ['C2', 240],
    ['F2', 0],
    ['A3', 'Akut ärende'],
    ['C3', 180],
    ['E3', 'se bilaga'],
  ])
  const sheets = new Map([['Prisbilaga', cells]])

  it('kolumnbokstäver', () => {
    expect(colNumber('A')).toBe(1)
    expect(colNumber('AA')).toBe(27)
    expect(colLetter(27)).toBe('AA')
    expect(colLetter(5)).toBe('E')
  })

  it('rutnätet visar tomma celler i använda kolumner', () => {
    const t = sheetToGridText('Prisbilaga', cells)
    expect(t).toContain('R2: A2=Förebyggande kontroll | C2=240 | E2=(tom) | F2=0')
  })

  it('godkänner tom priscell på rätt rad, stryker textcell, fel rad och okänt blad', () => {
    const rows = cleanAppendixRows(
      {
        rows: [
          { label: 'Förebyggande kontroll', unit: 'objekt', quantity: 240, sheet: 'Prisbilaga', row: 2, price_cell: 'e2' },
          { label: 'Akut ärende', unit: 'st', quantity: '180', sheet: 'Prisbilaga', row: 3, price_cell: 'E3' },
          { label: 'Timpris', unit: 'tim', quantity: null, sheet: 'Prisbilaga', row: 4, price_cell: 'E9' },
          { label: 'Okänt blad', sheet: 'Blad9', price_cell: 'E2' },
          { label: '', price_cell: 'E2' },
        ],
      },
      sheets
    )
    expect(rows.map((r) => [r.label, r.price_cell, r.quantity])).toEqual([
      ['Förebyggande kontroll', 'E2', 240],
      ['Akut ärende', null, 180],
      ['Timpris', null, 1],
      ['Okänt blad', null, 1],
    ])
    expect(rows[3].sheet).toBeNull()
  })

  it('PDF: inga celler sparas', () => {
    const rows = cleanAppendixRows([{ label: 'Kontroll', sheet: 'X', price_cell: 'E2', quantity: 4 }], null)
    expect(rows).toEqual([{ label: 'Kontroll', unit: null, quantity: 4, sheet: null, price_cell: null, row: null }])
  })

  it('samma cell två gånger används bara en gång', () => {
    const rows = cleanAppendixRows(
      [
        { label: 'A', sheet: 'Prisbilaga', row: 2, price_cell: 'E2' },
        { label: 'B', sheet: 'Prisbilaga', row: 2, price_cell: 'E2' },
      ],
      sheets
    )
    expect(rows.map((r) => r.price_cell)).toEqual(['E2', null])
  })
})

describe('Detaljsidans steg', () => {
  const base = {
    status: 'analyzing' as const,
    documents: 0,
    documentsRead: 0,
    requirements: 0,
    requirementsDone: 0,
    hasBid: false,
    priceLines: 0,
    priceLinesPriced: 0,
    qualityTotal: 0,
    qualityDrafted: 0,
    signed: false,
    bidOutcomeSet: false,
    lesson: false,
    bidders: 0,
  }

  it('steget ur adressen, okänt blir Översikt', () => {
    expect(stepOf('kalkyl')).toBe('kalkyl')
    expect(stepOf(undefined)).toBe('oversikt')
    expect(stepOf('tidslinje')).toBe('oversikt')
  })

  it('ny träff: Översikt pågår, resten ej påbörjat', () => {
    expect(stepStates({ ...base, status: 'new' })).toEqual({ oversikt: 'doing', underlag: 'todo', kalkyl: 'todo', anbud: 'todo', utfall: 'todo' })
  })

  it('underlag klart när dokument lästs och alla krav är klara', () => {
    expect(stepStates({ ...base, documents: 2, documentsRead: 1, requirements: 3, requirementsDone: 2 }).underlag).toBe('doing')
    expect(stepStates({ ...base, documents: 2, documentsRead: 1, requirements: 3, requirementsDone: 3 }).underlag).toBe('done')
  })

  it('kalkyl klar med sparad kalkyl och pris på alla rader', () => {
    expect(stepStates({ ...base, hasBid: true }).kalkyl).toBe('doing')
    expect(stepStates({ ...base, hasBid: true, priceLines: 3, priceLinesPriced: 3 }).kalkyl).toBe('done')
  })

  it('anbud klart när lämnat, utfall klart med lärdom efter beslut', () => {
    expect(stepStates({ ...base, status: 'submitted' })).toMatchObject({ anbud: 'done', utfall: 'doing' })
    expect(stepStates({ ...base, status: 'won', lesson: true }).utfall).toBe('done')
    expect(stepStates({ ...base, status: 'lost' }).utfall).toBe('doing')
  })
})

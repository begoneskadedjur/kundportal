import { describe, expect, it } from 'vitest'
import type { PlannedPeriod } from './contractPlanner'
import {
  buildContractDiff,
  consolidationGroupKey,
  coveredByFortnox,
  cronFortnoxCovers,
  daysInclusive,
  findPlannedFor,
  fortnoxCovers,
  isCovered,
  matchModeFor,
  matchPeriods,
  monthKey,
  overlapShare,
  periodKey,
  periodOverlapShare,
  type MatchableInvoice,
} from './contractInvoiceMatch'

const period = (periodStart: string, periodEnd: string, over: Partial<PlannedPeriod> = {}): PlannedPeriod => ({
  kind: 'premium',
  periodStart,
  periodEnd,
  amount: 12000,
  annualInForce: 12000,
  equipmentRows: [],
  subtotal: 12000,
  vatAmount: 3000,
  totalAmount: 15000,
  invoiceDate: periodStart,
  dueDate: periodStart,
  isHistorical: false,
  sequenceNumber: 1,
  totalSequenceCount: 1,
  ...over,
})

const invoice = (id: string, start: string, end: string, over: Partial<MatchableInvoice> = {}): MatchableInvoice => ({
  id,
  invoice_number: `INV-${id}`,
  status: 'pending_approval',
  billing_period_start: start,
  billing_period_end: end,
  total_amount: 15000,
  subtotal: 12000,
  is_historical: false,
  invoice_type: 'contract',
  fortnox_document_number: null,
  has_generic_items: false,
  ...over,
})

describe('nycklar', () => {
  it('monthKey tar år och månad', () => {
    expect(monthKey('2025-11-18')).toBe('2025-11')
  })
  it('periodKey är typ plus månad, premium som standard', () => {
    expect(periodKey(null, '2026-07-01')).toBe('premium|2026-07')
    expect(periodKey('equipment', '2026-07-15')).toBe('equipment|2026-07')
  })
})

describe('Fortnox-täckning', () => {
  // Drottningens Pizzeria 2026-09-18: F- 2026-02-16 t.o.m. 2027-02-15 överlappar
  // planens 2027-02-01 t.o.m. 2028-01-31 med två veckor och ska inte täcka den.
  const plan = period('2027-02-01', '2028-01-31')
  const fortnox = { start: '2026-02-16', end: '2027-02-15' }

  it('överlapp under hälften täcker inte (generatorn och signeringen)', () => {
    expect(overlapShare(plan, fortnox)).toBeLessThan(0.5)
    expect(fortnoxCovers(plan, [fortnox])).toBe(false)
  })

  it('överlapp på minst hälften täcker', () => {
    expect(fortnoxCovers(period('2026-02-01', '2027-01-31'), [fortnox])).toBe(true)
  })

  it('cronen räknar varje överlapp av samma typ som täckt', () => {
    expect(coveredByFortnox(plan, [{ ...fortnox, kind: 'premium' }])).toBe(true)
    expect(coveredByFortnox(plan, [{ ...fortnox, kind: 'equipment' }])).toBe(false)
    expect(coveredByFortnox(plan, [{ start: '2025-01-01', end: '2025-12-31', kind: 'premium' }])).toBe(false)
  })
})

describe('buildContractDiff', () => {
  it('Drottningens Pizzeria: F-importen tar bort sin period, nästa årsfaktura skapas', () => {
    const planned = [period('2026-02-01', '2027-01-31', { isHistorical: true }), period('2027-02-01', '2028-01-31')]
    const existing = [
      invoice('f1', '2026-02-16', '2027-02-15', { invoice_number: 'F-123', is_historical: true, status: 'paid', invoice_type: 'adhoc' }),
    ]
    const diff = buildContractDiff(planned, existing, { real: true })
    expect(diff).toHaveLength(1)
    expect(diff[0].action).toBe('create')
    expect(diff[0].planned?.periodStart).toBe('2027-02-01')
  })

  it('matchar på månaden: importerad faktura från avtalsdagen paras med planen från den 1:a', () => {
    const diff = buildContractDiff([period('2025-11-01', '2026-10-31')], [invoice('a', '2025-11-18', '2026-11-17', { status: 'paid' })], {
      real: true,
    })
    expect(diff).toEqual([
      expect.objectContaining({ action: 'locked', existingId: 'a', existingFortnoxNumber: null }),
    ])
  })

  it('utkast med samma belopp behålls, annat belopp uppdateras, generiska rader uppdateras', () => {
    expect(buildContractDiff([period('2026-11-01', '2027-10-31')], [invoice('a', '2026-11-01', '2027-10-31')], { real: true })[0].action).toBe('keep')
    expect(
      buildContractDiff([period('2026-11-01', '2027-10-31')], [invoice('a', '2026-11-01', '2027-10-31', { subtotal: 11000 })], { real: true })[0].action
    ).toBe('update')
    expect(
      buildContractDiff([period('2026-11-01', '2027-10-31')], [invoice('a', '2026-11-01', '2027-10-31', { has_generic_items: true })], { real: true })[0]
        .action
    ).toBe('update')
  })

  it('HSB Kullen: andra redigerbara utkast på samma period blir duplicateIds', () => {
    const existing = [
      invoice('a', '2026-11-01', '2027-10-31'),
      invoice('b', '2026-11-01', '2027-10-31'),
      invoice('c', '2026-11-01', '2027-10-31', { fortnox_document_number: '900' }),
    ]
    const diff = buildContractDiff([period('2026-11-01', '2027-10-31')], existing, { real: true })
    // Kartan bär en faktura per månad: den sista vinner
    const matched = diff.find((e) => e.planned)
    expect(matched?.existingId).toBe('c')
    expect(matched?.duplicateIds).toEqual(['a', 'b'])
    expect(matched?.existingFortnoxNumber).toBe('900')
  })

  it('utkast efter planens sista period raderas med förlängningstexten', () => {
    const diff = buildContractDiff(
      [period('2026-11-01', '2027-10-31')],
      [invoice('a', '2026-11-01', '2027-10-31'), invoice('b', '2027-11-01', '2028-10-31')],
      { real: true }
    )
    const del = diff.find((e) => e.existingId === 'b')
    expect(del?.action).toBe('delete')
    expect(del?.reason).toMatch(/^Efter nuvarande bindningstid/)
  })

  it('utkast före planen raderas utan förlängningstext, låsta (också förfallna) och okänd status lämnas', () => {
    const diff = buildContractDiff(
      [period('2026-11-01', '2027-10-31')],
      [
        invoice('old', '2025-05-01', '2026-04-30'),
        invoice('paid', '2024-05-01', '2025-04-30', { status: 'paid' }),
        invoice('ovd', '2023-05-01', '2024-04-30', { status: 'overdue' }),
        invoice('odd', '2022-05-01', '2023-04-30', { status: 'credited' }),
      ],
      { real: true }
    )
    const byId = new Map(diff.map((e) => [e.existingId, e]))
    expect(byId.get('old')).toMatchObject({ action: 'delete' })
    expect(byId.get('old')?.reason).toBeUndefined()
    expect(byId.get('paid')).toMatchObject({ action: 'locked', reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
    // overdue räknas som låst sedan steg 7 (förut grenen Okänd status, samma utfall)
    expect(byId.get('ovd')).toMatchObject({ action: 'locked', reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
    expect(byId.get('odd')).toMatchObject({ action: 'locked', reason: 'Okänd status "credited" - rör ej' })
  })

  it('passerad period utan faktura: uncovered på riktigt avtal, create-historical annars', () => {
    const p = period('2025-11-01', '2026-10-31', { isHistorical: true })
    expect(buildContractDiff([p], [], { real: true })[0].action).toBe('uncovered')
    expect(buildContractDiff([p], [], { real: false })[0].action).toBe('create-historical')
  })

  it('perioden på samlingsfakturan blir consolidated', () => {
    const cons = invoice('s', '2026-11-01', '2027-10-31', { status: 'sent' })
    const diff = buildContractDiff([period('2026-11-01', '2027-10-31')], [], {
      real: true,
      consolidatedInvoices: [cons],
    })
    expect(diff[0]).toMatchObject({ action: 'consolidated', existingId: 's', existingStatus: 'sent' })
  })
})

// ---------------------------------------------------------------------------
// Steg 7: överlappsmatchning för avtal med exakt avtalsdag
// ---------------------------------------------------------------------------

describe('periodOverlapShare (samma regel som överlappsvakten i databasen)', () => {
  // Samma fall som scripts/regression/overlap-share.test.sql (V3, V4, V5) och
  // overlap-share-twin.mts, där SQL-funktionen ger samma tal.
  it('andelen räknas mot den kortare perioden, båda ändar med', () => {
    expect(periodOverlapShare({ start: '2030-01-01', end: '2030-01-10' }, { start: '2030-01-06', end: '2030-01-20' })).toBe(0.5)
    expect(periodOverlapShare({ start: '2030-01-01', end: '2030-01-10' }, { start: '2030-01-07', end: '2030-01-20' })).toBe(0.4)
    expect(periodOverlapShare({ start: '2030-01-07', end: '2030-01-20' }, { start: '2030-01-10', end: '2030-02-08' })).toBeCloseTo(11 / 14, 12)
  })
  it('symmetrisk, noll utan överlapp, en dag är en dag', () => {
    const a = { start: '2026-11-25', end: '2027-11-24' }
    const b = { start: '2026-11-01', end: '2027-10-31' }
    expect(periodOverlapShare(a, b)).toBe(periodOverlapShare(b, a))
    expect(periodOverlapShare({ start: '2027-01-01', end: '2027-01-31' }, { start: '2027-02-01', end: '2027-02-28' })).toBe(0)
    expect(periodOverlapShare({ start: '2027-06-30', end: '2028-06-29' }, { start: '2026-07-01', end: '2027-06-30' })).toBe(1 / 365)
    expect(daysInclusive({ start: '2028-02-01', end: '2028-02-29' })).toBe(29)
  })
  it('FEV: 2026-06-30 t.o.m. 2027-06-29 mot 2026-07-01 t.o.m. 2027-06-30 är 364 av 365', () => {
    expect(periodOverlapShare({ start: '2026-06-30', end: '2027-06-29' }, { start: '2026-07-01', end: '2027-06-30' })).toBe(364 / 365)
  })
})

describe('matchModeFor och samlingsnyckeln', () => {
  it('bara start_day med startdatum ger överlapp', () => {
    expect(matchModeFor({ billing_anchor_mode: 'start_day', contract_start_date: '2026-06-30' })).toBe('overlap')
    expect(matchModeFor({ billing_anchor_mode: 'start_day', contract_start_date: null })).toBe('legacy')
    expect(matchModeFor({ billing_anchor_mode: null, contract_start_date: '2026-06-30' })).toBe('legacy')
    expect(matchModeFor(null)).toBe('legacy')
  })
  it('M7: två avtal med samma frekvens, avtalsdag 03-01 och 03-15 i exakt läge: två grupper', () => {
    const a = { billing_frequency: 'annual', billing_anchor_month: 3, billing_anchor_mode: 'start_day', contract_start_date: '2026-03-01' }
    const b = { ...a, contract_start_date: '2026-03-15' }
    expect(consolidationGroupKey(a)).toBe('annual|start_day|03-01')
    expect(consolidationGroupKey(b)).toBe('annual|start_day|03-15')
    // Gamla läget: samma ankarmånad, samma grupp (som förut)
    expect(consolidationGroupKey({ ...a, billing_anchor_mode: null })).toBe('annual|3')
    expect(consolidationGroupKey({ ...b, billing_anchor_mode: null })).toBe('annual|3')
  })
})

describe('buildContractDiff i båda lägena', () => {
  const m1Plan = () => [period('2026-05-01', '2026-05-31')]
  const m1Existing = () => [invoice('e', '2026-05-20', '2026-06-19')]

  it('M1 legacy: andel under hälften men samma månad, paras via månadsnyckeln som i dag', () => {
    expect(periodOverlapShare({ start: '2026-05-01', end: '2026-05-31' }, { start: '2026-05-20', end: '2026-06-19' })).toBeCloseTo(12 / 31, 12)
    const diff = buildContractDiff(m1Plan(), m1Existing(), { real: true, mode: 'legacy' })
    expect(diff).toEqual([expect.objectContaining({ action: 'keep', existingId: 'e' })])
    // Standardläget är legacy
    expect(buildContractDiff(m1Plan(), m1Existing(), { real: true })).toEqual(diff)
  })

  it('M2 overlap: samma indata ger inget par, planen skapas och utkastet raderas', () => {
    const diff = buildContractDiff(m1Plan(), m1Existing(), { real: true, mode: 'overlap' })
    expect(diff.find((e) => e.planned)?.action).toBe('create')
    expect(diff.find((e) => e.existingId === 'e')?.action).toBe('delete')
  })

  it('M3: plan 2026-06-30 t.o.m. 2027-06-29 mot utkast 2026-07-01 t.o.m. 2027-06-30: par, update (datumen skiljer)', () => {
    const diff = buildContractDiff([period('2026-06-30', '2027-06-29')], [invoice('u', '2026-07-01', '2027-06-30')], { real: true, mode: 'overlap' })
    expect(diff).toEqual([expect.objectContaining({ action: 'update', existingId: 'u' })])
    // Samma belopp och samma datum: keep
    expect(
      buildContractDiff([period('2026-06-30', '2027-06-29')], [invoice('u', '2026-06-30', '2027-06-29')], { real: true, mode: 'overlap' })[0].action
    ).toBe('keep')
    // Legacy jämför bara beloppet (som förut): samma belopp, andra datum = keep
    expect(
      buildContractDiff([period('2026-07-01', '2027-06-30')], [invoice('u', '2026-07-15', '2027-07-14')], { real: true, mode: 'legacy' })[0].action
    ).toBe('keep')
  })

  it('M4: FEV, P1 paras med den låsta, P2 överlappar den en dag och skapas', () => {
    const diff = buildContractDiff(
      [period('2026-06-30', '2027-06-29'), period('2027-06-30', '2028-06-29')],
      [invoice('l', '2026-07-01', '2027-06-30', { status: 'paid' })],
      { real: true, mode: 'overlap' }
    )
    expect(diff).toHaveLength(2)
    expect(diff[0]).toMatchObject({ action: 'locked', existingId: 'l', planned: expect.objectContaining({ periodStart: '2026-06-30' }) })
    expect(diff[1]).toMatchObject({ action: 'create', planned: expect.objectContaining({ periodStart: '2027-06-30' }) })
  })

  it('M5: två utkast mot plan 2026-11-25: paras med 2026-11-25, det andra raderas och listas som dubblett', () => {
    const diff = buildContractDiff(
      [period('2026-11-25', '2027-11-24')],
      [invoice('first', '2026-11-01', '2027-10-31'), invoice('exact', '2026-11-25', '2027-11-24')],
      { real: true, mode: 'overlap' }
    )
    expect(diff.find((e) => e.planned)).toMatchObject({ action: 'keep', existingId: 'exact', duplicateIds: ['first'] })
    expect(diff.find((e) => e.existingId === 'first')).toMatchObject({ action: 'delete' })
  })

  it('M6 Brynäs: legacy som i dag, exakt läge flyttar utkastet till avtalsdagen', () => {
    const existing = () => [invoice('betald', '2025-11-25', '2026-11-24', { status: 'paid' }), invoice('utkast', '2026-11-01', '2027-10-31')]
    const legacy = buildContractDiff([period('2025-11-01', '2026-10-31'), period('2026-11-01', '2027-10-31')], existing(), { real: true, mode: 'legacy' })
    expect(legacy.map((e) => [e.action, e.existingId])).toEqual([
      ['locked', 'betald'],
      ['keep', 'utkast'],
    ])
    const exact = buildContractDiff([period('2025-11-25', '2026-11-24'), period('2026-11-25', '2027-11-24')], existing(), { real: true, mode: 'overlap' })
    expect(exact.map((e) => [e.action, e.existingId])).toEqual([
      ['locked', 'betald'],
      ['update', 'utkast'],
    ])
    expect(periodOverlapShare({ start: '2026-11-25', end: '2027-11-24' }, { start: '2026-11-01', end: '2027-10-31' })).toBeGreaterThan(0.93)
  })

  it('overlap: en period som en redan parad låst faktura täcker till minst hälften föreslås inte (vakten skulle stoppa den)', () => {
    const diff = buildContractDiff(
      [period('2027-01-01', '2027-01-31'), period('2027-02-01', '2027-02-28')],
      [invoice('ar', '2027-01-01', '2027-12-31', { status: 'sent' })],
      { real: true, mode: 'overlap' }
    )
    expect(diff.map((e) => [e.action, e.existingId])).toEqual([
      ['locked', 'ar'],
      ['locked', 'ar'],
    ])
  })

  it('overlap: utkast efter planens sista dag får förlängningstexten', () => {
    const diff = buildContractDiff(
      [period('2026-06-30', '2027-06-29')],
      [invoice('a', '2026-06-30', '2027-06-29'), invoice('b', '2027-06-30', '2028-06-29')],
      { real: true, mode: 'overlap' }
    )
    expect(diff.find((e) => e.existingId === 'b')?.reason).toMatch(/^Efter nuvarande bindningstid/)
  })

  it('overlap: samlingsfakturan matchas på överlapp, legacy på månad', () => {
    const cons = invoice('s', '2026-07-01', '2027-06-30', { status: 'sent' })
    expect(buildContractDiff([period('2026-06-30', '2027-06-29')], [], { real: true, mode: 'overlap', consolidatedInvoices: [cons] })[0]).toMatchObject({
      action: 'consolidated',
      existingId: 's',
    })
    expect(buildContractDiff([period('2026-06-30', '2027-06-29')], [], { real: true, mode: 'legacy', consolidatedInvoices: [cons] })[0].action).toBe('create')
  })

  it('overlap: Fortnox-importen räknas mot den kortare perioden, som vakten', () => {
    const planned = [period('2027-02-01', '2028-01-31')]
    const fx = invoice('f', '2027-03-01', '2027-04-30', { invoice_number: 'F-1', is_historical: true, status: 'paid', invoice_type: 'adhoc' })
    expect(buildContractDiff(planned, [fx], { real: true, mode: 'legacy' })[0].action).toBe('create')
    expect(buildContractDiff(planned, [fx], { real: true, mode: 'overlap' })).toEqual([])
  })
})

describe('matchPeriods', () => {
  it('legacy: sista fakturan i månaden vinner, de andra räknas till perioden (som förut)', () => {
    const m = matchPeriods(
      [{ start: '2026-11-01', end: '2027-10-31' }],
      [
        { id: 'a', start: '2026-11-01', end: '2027-10-31' },
        { id: 'b', start: '2026-11-20', end: '2027-11-19' },
        { id: 'c', start: '2025-11-01', end: '2026-10-31' },
      ],
      'legacy'
    )
    expect([...m.pairs]).toEqual([[0, 1]])
    expect(m.unmatchedExisting).toEqual([2])
  })
  it('overlap: störst andel först, sedan närmast startdag, sedan id', () => {
    const m = matchPeriods(
      [{ start: '2026-11-25', end: '2027-11-24' }],
      [
        { id: 'z', start: '2026-11-25', end: '2027-11-24' },
        { id: 'y', start: '2026-11-25', end: '2027-11-24' },
      ],
      'overlap'
    )
    expect([...m.pairs]).toEqual([[0, 1]])
    expect(m.unmatchedExisting).toEqual([0])
  })
})

describe('cronens och signeringens hjälpare', () => {
  const p = { start: '2026-06-30', end: '2027-06-29' }
  it('isCovered legacy är månadsnyckeln', () => {
    expect(isCovered(p, [{ id: 'x', start: '2026-06-01', end: '2026-06-01' }], 'legacy')).toBe(true)
    expect(isCovered(p, [{ id: 'x', start: '2026-07-01', end: '2027-06-30', status: 'paid' }], 'legacy')).toBe(false)
  })
  it('isCovered overlap: minst hälften, eller ett utkast som överlappar alls', () => {
    expect(isCovered(p, [{ id: 'x', start: '2026-07-01', end: '2027-06-30', status: 'paid' }], 'overlap')).toBe(true)
    const p2 = { start: '2027-06-30', end: '2028-06-29' }
    expect(isCovered(p2, [{ id: 'x', start: '2026-07-01', end: '2027-06-30', status: 'paid' }], 'overlap')).toBe(false)
    expect(isCovered(p2, [{ id: 'x', start: '2026-07-01', end: '2027-06-30', status: 'pending_approval' }], 'overlap')).toBe(true)
    expect(isCovered(p2, [{ id: 'x', start: '2026-07-01', end: '2027-06-30', status: 'pending_approval', invoice_number: 'F-9' }], 'overlap')).toBe(false)
  })
  it('cronFortnoxCovers: skarp körning utan v2 som förut, v2 och exakt läge som generatorn', () => {
    const plan = { periodStart: '2027-02-01', periodEnd: '2028-01-31', kind: 'premium' as const }
    const ranges = [{ start: '2026-02-16', end: '2027-02-15', kind: 'premium' }]
    expect(cronFortnoxCovers(plan, ranges, { mode: 'legacy', v2: false })).toBe(true)
    expect(cronFortnoxCovers(plan, ranges, { mode: 'legacy', v2: true })).toBe(false)
    expect(cronFortnoxCovers(plan, ranges, { mode: 'overlap', v2: false })).toBe(false)
    expect(cronFortnoxCovers(plan, [{ start: '2027-02-10', end: '2028-02-09', kind: 'premium' }], { mode: 'overlap', v2: false })).toBe(true)
    expect(cronFortnoxCovers(plan, [{ start: '2027-02-10', end: '2028-02-09', kind: 'equipment' }], { mode: 'overlap', v2: true })).toBe(false)
  })
  it('findPlannedFor: legacy exakt startdag, overlap störst andel', () => {
    const planned = [
      { periodStart: '2026-06-30', periodEnd: '2027-06-29' },
      { periodStart: '2027-06-30', periodEnd: '2028-06-29' },
    ]
    expect(findPlannedFor(planned, { start: '2027-07-01', end: '2028-06-30' }, 'legacy')).toBeUndefined()
    expect(findPlannedFor(planned, { start: '2027-06-30', end: '2028-06-29' }, 'legacy')).toBe(planned[1])
    expect(findPlannedFor(planned, { start: '2027-07-01', end: '2028-06-30' }, 'overlap')).toBe(planned[1])
  })
})

import { describe, expect, it } from 'vitest'
import type { PlannedPeriod } from './contractPlanner'
import {
  buildContractDiff,
  coveredByFortnox,
  fortnoxCovers,
  monthKey,
  overlapShare,
  periodKey,
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

  it('utkast före planen raderas utan förlängningstext, låsta och okänd status lämnas', () => {
    const diff = buildContractDiff(
      [period('2026-11-01', '2027-10-31')],
      [
        invoice('old', '2025-05-01', '2026-04-30'),
        invoice('paid', '2024-05-01', '2025-04-30', { status: 'paid' }),
        invoice('ovd', '2023-05-01', '2024-04-30', { status: 'overdue' }),
      ],
      { real: true }
    )
    const byId = new Map(diff.map((e) => [e.existingId, e]))
    expect(byId.get('old')).toMatchObject({ action: 'delete' })
    expect(byId.get('old')?.reason).toBeUndefined()
    expect(byId.get('paid')).toMatchObject({ action: 'locked', reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
    expect(byId.get('ovd')).toMatchObject({ action: 'locked', reason: 'Okänd status "overdue" - rör ej' })
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
      consolidatedPeriods: new Map([['2026-11', cons]]),
    })
    expect(diff[0]).toMatchObject({ action: 'consolidated', existingId: 's', existingStatus: 'sent' })
  })
})

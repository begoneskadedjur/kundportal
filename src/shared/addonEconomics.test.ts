import { describe, it, expect } from 'vitest'
import {
  computeAddonCalc,
  formatDateShortSv,
  formatKr,
  monthsLabel,
  premiumRaise,
  splitCaseLines,
  timelineExplanation,
  timelineForProposal,
  timelineFromRow,
} from './addonEconomics'

// BE-0008974, WBAB Bylandets reningsverk: 4 Aurotrap à 2 348 kr/år, utsatta
// 2026-09-29, avtalets år börjar 2027-07-01, kundens timpris 532, Arbetstid
// Företag 1 016 kr/h, teknikern föreslår 2 h per år.
const stationRow = {
  quantity: 4,
  unit_price: 1769.04,
  total_price: 7076.16,
  addon_annual_unit_price: 2348,
  billing_start_date: '2027-07-01',
}
const labourRow = {
  quantity: 1,
  unit_price: 801.64,
  total_price: 801.64,
  addon_annual_unit_price: 532,
  billing_start_date: '2027-07-01',
  is_addon_labour_line: true,
  addon_labour_hours: 2,
  addon_labour_hours_before: 0,
}

describe('timelineFromRow', () => {
  it('stationsraden: 9 av 12 månader, pris per station på båda sidor', () => {
    const t = timelineFromRow(stationRow)!
    expect(t.months).toBe(9)
    expect(monthsLabel(t.months)).toBe('9 av 12 månader')
    expect(t.days).toBe(275)
    expect(t.fromDate).toBe('2026-09-29')
    expect(t.toDate).toBe('2027-06-30')
    expect(t.perUnitNow).toBe(1769.04)
    expect(t.perUnitAnnual).toBe(2348)
    expect(t.totalAnnual).toBe(9392)
    expect(t.unit).toBe('station')
  })

  it('arbetstiden: 401 kr per timme nu, 532 per timme och 1 064 per år sedan', () => {
    const t = timelineFromRow(labourRow)!
    expect(t.months).toBe(9)
    expect(Math.round(t.perUnitNow)).toBe(401)
    expect(t.perUnitAnnual).toBe(532)
    expect(t.totalAnnual).toBe(1064)
    expect(t.quantityNow).toBe(2)
    expect(t.unit).toBe('timme')
  })

  it('arbetstid med timmar innan: bara ökningen betalas nu, hela timantalet sedan', () => {
    const t = timelineFromRow(
      { ...labourRow, addon_labour_hours: 3, addon_labour_hours_before: 2, total_price: 400.82, unit_price: 400.82 },
      '2026-09-29'
    )!
    expect(t.quantityNow).toBe(1)
    expect(t.quantityAnnual).toBe(3)
    expect(t.totalAnnual).toBe(1596)
    expect(t.months).toBe(9)
  })

  it('arbetstid utan ökning läser andelen ur datumen', () => {
    const t = timelineFromRow({ ...labourRow, addon_labour_hours: 2, addon_labour_hours_before: 2, total_price: 0 }, '2026-09-29')!
    expect(t.quantityNow).toBe(0)
    expect(t.months).toBe(9)
  })

  it('utan årspris ritas ingen tidslinje', () => {
    expect(timelineFromRow({ ...stationRow, addon_annual_unit_price: null })).toBeNull()
  })
})

describe('timelineForProposal', () => {
  it('samma formel som RPC:n (dagar / 365)', () => {
    const t = timelineForProposal({ fromDate: '2026-09-29', startDate: '2027-07-01', perUnitAnnual: 2348, quantityNow: 4, unit: 'station' })
    expect(t.perUnitNow).toBe(1769.04)
    expect(t.totalNow).toBe(7076.16)
    expect(t.months).toBe(9)
  })
})

describe('computeAddonCalc', () => {
  it('Bylandet: betalt tillbaka cirka juni 2028', () => {
    const c = computeAddonCalc({
      equipmentCost: 14200,
      annualStationRevenue: 9392,
      labourHours: 2,
      labourRate: 532,
      labourCostPerHour: 1016,
      firstPeriodRevenue: 7076.16 + 801.64,
      firstPeriodFraction: 275 / 365,
      startDate: '2027-07-01',
      today: '2026-09-30',
    })
    expect(c.annualRevenue).toBe(10456)
    expect(c.annualLabourRevenue).toBe(1064)
    expect(c.annualLabourCost).toBe(2032)
    expect(c.annualContribution).toBe(8424)
    expect(c.paybackNever).toBe(false)
    expect(c.paybackLabel).toBe('juni 2028')
  })

  it('arbetstid som äter hela intäkten betalas aldrig tillbaka', () => {
    const c = computeAddonCalc({
      equipmentCost: 3550,
      annualStationRevenue: 0,
      labourHours: 1,
      labourRate: 532,
      labourCostPerHour: 1016,
      firstPeriodRevenue: 0,
      firstPeriodFraction: 0.5,
      startDate: '2027-07-01',
      today: '2026-09-30',
    })
    expect(c.annualContribution).toBeLessThan(0)
    expect(c.paybackNever).toBe(true)
    expect(c.paybackLabel).toBe('aldrig')
  })

  it('utan utrustning är tillägget betalt direkt', () => {
    const c = computeAddonCalc({
      equipmentCost: 0, annualStationRevenue: 1000, labourHours: 0, labourRate: 532, labourCostPerHour: 1016,
      firstPeriodRevenue: 500, firstPeriodFraction: 0.5, startDate: '2027-07-01', today: '2026-09-30',
    })
    expect(c.paybackLabel).toBe('direkt')
  })

  it('betald under första perioden när nettot räcker', () => {
    const c = computeAddonCalc({
      equipmentCost: 100, annualStationRevenue: 10000, labourHours: 0, labourRate: null, labourCostPerHour: null,
      firstPeriodRevenue: 5000, firstPeriodFraction: 0.5, startDate: '2027-04-01', today: '2026-10-01',
    })
    expect(c.paybackDate! < '2027-04-01').toBe(true)
  })
})

describe('splitCaseLines', () => {
  it('tilläggsrader och deras mappade artiklar räknas inte i ärendets marginal', () => {
    const lines = [
      { id: 'etab', item_type: 'service' },
      { id: 'pr', item_type: 'service', is_addon_prorata_line: true },
      { id: 'lab', item_type: 'service', is_addon_prorata_line: true, is_addon_labour_line: true },
      { id: 'auro', item_type: 'article', mapped_service_id: 'pr' },
      { id: 'arb', item_type: 'article', mapped_service_id: 'etab' },
      { id: 'fri', item_type: 'article' },
    ]
    const { caseLines, addonLines } = splitCaseLines(lines)
    expect(caseLines.map((l) => l.id)).toEqual(['etab', 'arb', 'fri'])
    expect(addonLines.map((l) => l.id)).toEqual(['pr', 'lab', 'auro'])
  })
})

describe('text och format', () => {
  it('förklaringen följer avtalets datum', () => {
    expect(timelineExplanation('2027-07-01')).toMatch(/^Avtalets år börjar 1 juli\. Kunden betalar därför bara/)
    expect(timelineExplanation('2027-07-01')).toMatch(/Tilläggen slutar när avtalet slutar\.$/)
  })
  it('datum och kronor', () => {
    expect(formatDateShortSv('2027-07-01')).toBe('1 jul 2027')
    expect(formatKr(7076.16).replace(/\s/g, ' ')).toBe('7 076 kr')
  })
  it('premiehöjning från A till B', () => {
    expect(premiumRaise(25973, 10456)).toEqual({ from: 25973, to: 36429, add: 10456 })
  })
})

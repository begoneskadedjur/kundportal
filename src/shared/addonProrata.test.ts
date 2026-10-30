import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  groupProrataRows,
  prorataEnd,
  prorataLastValidDay,
  prorataStation,
  uncoveredDays,
  type ProrataContract,
} from './addonProrata'

// Årsvis premie i juli, gamla läget (perioden börjar den 1:a i ankarmånaden)
const annualJuly: ProrataContract = {
  contract_start_date: '2025-07-01',
  billing_frequency: 'annual',
  billing_anchor_month: 7,
  billing_anchor_mode: null,
  contract_end_date: '2028-06-30',
  renewal_mode: 'rolling',
}

const base = {
  caseId: 'case-1',
  contractId: 'avtal-1',
  stationTypeId: 'typ-1',
  model: 'per_year' as const,
  annualPrice: 1686,
}

describe('prorataEnd och prorataStation (steg 9)', () => {
  it('P1: station 2026-11-10, nästa period 2027-07-01, inget låst: 233 dagar', () => {
    const r = prorataStation({ ...base, stationId: 's1', startDay: '2026-11-10' }, annualJuly, [])
    expect(r?.endDay).toBe('2027-07-01')
    expect(r?.days).toBe(233)
  })

  it('P2: tilläggsfakturan för 2026-07-01 t.o.m. 2027-06-30 är skickad utan stationen: ledtidsregeln ger 386 dagar', () => {
    const locked = [{ number: 'INV-1', periodStart: '2026-07-01', periodEnd: '2027-06-30', stationIds: ['annan'] }]
    const r = prorataStation({ ...base, stationId: 's1', startDay: '2026-06-10' }, annualJuly, locked)
    expect(r?.endDay).toBe('2027-07-01')
    expect(r?.days).toBe(386)
  })

  it('P3: fakturan för 2026-07-01 är ett utkast (inte låst): slut 2026-07-01, 21 dagar', () => {
    const r = prorataStation({ ...base, stationId: 's1', startDay: '2026-06-10' }, annualJuly, [])
    expect(r?.endDay).toBe('2026-07-01')
    expect(r?.days).toBe(21)
  })

  it('P2b: låst faktura som redan har stationen förlänger inte', () => {
    const locked = [{ periodStart: '2026-07-01', periodEnd: '2027-06-30', stationIds: ['s1'] }]
    expect(prorataEnd('s1', '2026-06-10', annualJuly, locked)?.endDay).toBe('2026-07-01')
  })

  it('låst faktura utan station_ids: förlängningen stannar och fakturan rapporteras', () => {
    const locked = [{ number: 'INV-202609-0338', periodStart: '2026-07-01', periodEnd: '2027-06-30', stationIds: null }]
    const e = prorataEnd('s1', '2026-06-10', annualJuly, locked)
    expect(e?.endDay).toBe('2026-07-01')
    expect(e?.unknownInvoice).toBe('INV-202609-0338')
  })

  it('P4: uppsagt avtal med effective_end_date 2027-03-31, station 2026-11-10: slut 2027-04-01', () => {
    const c = { ...annualJuly, terminated_at: '2026-10-01T10:00:00+02:00', effective_end_date: '2027-03-31' }
    const r = prorataStation({ ...base, stationId: 's1', startDay: '2026-11-10' }, c, [])
    expect(r?.endDay).toBe('2027-04-01')
    expect(r?.capped).toBe(true)
    expect(r?.days).toBe(142)
  })

  it('P5: efterskänkt 2026-11-10 t.o.m. 2026-12-31: dagarna räknas från 2027-01-01', () => {
    const r = prorataStation(
      { ...base, stationId: 's1', startDay: '2026-11-10', coverage: [{ from: '2026-11-10', to: '2026-12-31' }] },
      annualJuly,
      [],
    )
    expect(r?.endDay).toBe('2027-07-01')
    expect(r?.days).toBe(181)
  })

  it('P6: två ärenden på samma enhet ger två rader, en per ärende', () => {
    const a = prorataStation({ ...base, stationId: 'A', caseId: 'arende-1', startDay: '2026-11-10' }, annualJuly, [])!
    const b = prorataStation({ ...base, stationId: 'B', caseId: 'arende-2', startDay: '2026-11-10' }, annualJuly, [])!
    const rows = groupProrataRows([a, b])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => [r.caseId, r.quantity, r.stationIds])).toEqual([
      ['arende-1', 1, ['A']],
      ['arende-2', 1, ['B']],
    ])
  })

  it('Falu (exakt avtalsdag, ingen premie, option): 246 dagar, 1 136,32 och 1 582,49 som i datadokumentet', () => {
    const falu: ProrataContract = {
      contract_start_date: '2026-06-30',
      billing_frequency: null,
      billing_anchor_mode: 'start_day',
      contract_end_date: '2028-06-29',
      renewal_mode: 'option',
    }
    const light = prorataStation(
      { ...base, stationId: 'f8d6e371', caseId: 'BE-0009544', startDay: '2026-10-27', annualPrice: 1686 },
      falu,
      [],
    )!
    const auro = prorataStation(
      { ...base, stationId: '489d7fe6', caseId: 'BE-0009545', stationTypeId: 'typ-2', startDay: '2026-10-27', annualPrice: 2348 },
      falu,
      [],
    )!
    expect(light.endDay).toBe('2027-06-30')
    expect(light.days).toBe(246)
    const rows = groupProrataRows([light, auro])
    expect(rows.map((r) => [r.caseId, r.unitPrice, r.total])).toEqual([
      ['BE-0009544', 1136.32, 1136.32],
      ['BE-0009545', 1582.49, 1582.49],
    ])
  })

  it('samma ärende, typ och slut: en rad med medeldagar', () => {
    const s1 = prorataStation({ ...base, stationId: 's1', startDay: '2026-11-10' }, annualJuly, [])!
    const s2 = prorataStation({ ...base, stationId: 's2', startDay: '2026-12-10' }, annualJuly, [])!
    const [row] = groupProrataRows([s1, s2])
    expect(row.quantity).toBe(2)
    // (233 + 203) / 2 = 218 dagar
    expect(row.unitPrice).toBe(Math.round(1686 * 218 / 365 * 100) / 100)
  })

  it('pris saknas på någon station: typpriset används, saknas det hoppas gruppen över', () => {
    const s = prorataStation({ ...base, stationId: 's1', startDay: '2026-11-10', annualPrice: null }, annualJuly, [])!
    expect(groupProrataRows([s])).toEqual([])
    expect(groupProrataRows([s], () => 3600)[0].annualPrice).toBe(3600)
  })

  it('avtal utan frekvens i gamla läget saknar perioder: ingen rad', () => {
    const c = { ...annualJuly, billing_frequency: null }
    expect(prorataStation({ ...base, stationId: 's1', startDay: '2026-11-10' }, c, [])).toBeNull()
  })
})

describe('hjälpfunktioner', () => {
  it('uncoveredDays räknar båda ändar', () => {
    expect(uncoveredDays('2026-10-27', '2027-06-29', [])).toBe(246)
    expect(uncoveredDays('2026-01-01', '2026-01-10', [{ from: '2026-01-03', to: '2026-01-04' }])).toBe(8)
    expect(uncoveredDays('2026-01-10', '2026-01-01', [])).toBe(0)
  })

  it('addDaysIso över månads- och årsskifte och skottdag', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysIso('2027-07-01', -1)).toBe('2027-06-30')
  })

  it('kapning bara för uppsagt, avslutat eller option', () => {
    expect(prorataLastValidDay(annualJuly)).toBeNull()
    expect(prorataLastValidDay({ ...annualJuly, renewal_mode: 'option' })).toBe('2028-06-30')
    expect(prorataLastValidDay({ ...annualJuly, status: 'ended', effective_end_date: '2027-01-31' })).toBe('2027-01-31')
  })
})

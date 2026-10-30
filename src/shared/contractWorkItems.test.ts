import { describe, expect, it } from 'vitest'
import {
  addonDecideInstruction,
  buildWorkItemLink,
  firstWorkItemFor,
  parseWorkItemLink,
  sortWorkItems,
  type ContractWorkItem,
} from './contractWorkItems'

const item = (over: Partial<ContractWorkItem>): ContractWorkItem => ({
  kind: 'addon_decide',
  root_customer_id: 'root',
  root_name: 'Kund',
  unit_id: 'unit',
  unit_name: 'Enhet',
  contract_id: 'c1',
  station_kind: null,
  station_ids: null,
  station_count: 1,
  case_id: null,
  case_number: null,
  invoice_id: null,
  invoice_number: null,
  coverage_ids: null,
  conflict_ids: null,
  period_from: null,
  period_to: null,
  annual_kr: null,
  v2: false,
  instruction: '',
  sort_order: 30,
  sort_at: null,
  ...over,
})

describe('buildWorkItemLink', () => {
  it('bygger länken till kartan med uppgift, avtal och enhet', () => {
    expect(buildWorkItemLink('/koordinator', 'addon_decide', { rootId: 'r1', contractId: 'c1', unitId: 'u1' })).toBe(
      '/koordinator/befintliga-kunder/r1?tab=avtalskarta&panel=innehall&todo=addon_decide&contract=c1&unit=u1'
    )
  })

  it('avtalsdagen öppnar faktureringsgruppen', () => {
    expect(buildWorkItemLink('/admin', 'anchor_verify', { rootId: 'r1', contractId: 'c1' })).toBe(
      '/admin/befintliga-kunder/r1?tab=avtalskarta&panel=fakturering&todo=anchor_verify&contract=c1'
    )
  })

  it('utan uppgift blir det dagens länk', () => {
    expect(buildWorkItemLink('/admin', null, { rootId: 'r1' })).toBe('/admin/befintliga-kunder/r1?tab=avtalskarta&panel=innehall')
  })

  it('läses tillbaka av parseWorkItemLink', () => {
    const url = buildWorkItemLink('/admin', 'coverage_cancelled', { rootId: 'r1', contractId: 'c1', unitId: 'u1' })
    expect(parseWorkItemLink(url.slice(url.indexOf('?')))).toEqual({ kind: 'coverage_cancelled', contractId: 'c1', unitId: 'u1' })
  })
})

describe('parseWorkItemLink', () => {
  it('okänd uppgift ger kind null men behåller avtalet', () => {
    expect(parseWorkItemLink('?todo=okand&contract=c1')).toEqual({ kind: null, contractId: 'c1', unitId: null })
  })
  it('ingen uppgift alls ger null', () => {
    expect(parseWorkItemLink('?tab=avtalskarta&panel=innehall')).toBeNull()
  })
})

describe('addonDecideInstruction', () => {
  it('gamla avtal saknar meningen om pro rata', () => {
    expect(addonDecideInstruction(2, 'Falu kommun', false)).toBe(
      '2 tilläggsstationer på Falu kommun väntar på beslut. Välj om de ingår i premien eller faktureras som tillägg.'
    )
  })
  it('nya tilläggsregler säger att pro rata kommer efter beslutet', () => {
    expect(addonDecideInstruction(1, 'Björnhyttan', true)).toBe(
      '1 tilläggsstation på Björnhyttan väntar på beslut. Välj om de ingår i premien eller faktureras som tillägg. Pro rata skapas först efter beslutet.'
    )
  })
})

describe('sortWorkItems och firstWorkItemFor', () => {
  it('makulerad faktura före tillägg, äldst först inom typen', () => {
    const rows = [
      item({ kind: 'addon_decide', sort_order: 30, sort_at: '2026-09-01T00:00:00Z', instruction: 'b' }),
      item({ kind: 'coverage_cancelled', sort_order: 10, sort_at: '2026-10-01T00:00:00Z', instruction: 'a' }),
      item({ kind: 'addon_decide', sort_order: 30, sort_at: '2026-08-01T00:00:00Z', instruction: 'c' }),
      item({ kind: 'gap_invoice', sort_order: 50, sort_at: null, instruction: 'd' }),
    ]
    expect(sortWorkItems(rows).map((r) => r.instruction)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('första uppgiften för rätt kund', () => {
    const rows = [
      item({ root_customer_id: 'x', sort_order: 10, instruction: 'annan kund' }),
      item({ root_customer_id: 'root', sort_order: 60, instruction: 'sist' }),
      item({ root_customer_id: 'root', sort_order: 20, instruction: 'först' }),
    ]
    expect(firstWorkItemFor(rows, 'root')?.instruction).toBe('först')
    expect(firstWorkItemFor(rows, 'saknas')).toBeNull()
  })
})

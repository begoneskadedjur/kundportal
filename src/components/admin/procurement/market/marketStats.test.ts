import { describe, expect, it } from 'vitest'
import type { AwardWithRelations, BidderWithSupplier } from '../../../../services/procurementService'
import {
  ORG_ANTICIMEX,
  ORG_BEGONE,
  ORG_NOMOR,
  annualValueOfGroup,
  awardYear,
  bidsByYear,
  buildProcurements,
  challengerBuyers,
  classifyOrg,
  expectedAnnouncementQuarter,
  groupAwards,
  indexBidders,
  isInWindow,
  marketByYear,
  matchesCounty,
  matchesHorizon,
  median,
  nextQuarters,
  overallBidsMedian,
  pipelineByQuarter,
  qualityBuyers,
  shareTotals,
  sharesByYear,
  sourceHealthState,
} from './marketStats'

let seq = 0
function award(p: Partial<AwardWithRelations>): AwardWithRelations {
  seq += 1
  return {
    id: `a${seq}`,
    award_key: `k${seq}`,
    notice_id: null,
    buyer_id: 'b1',
    buyer_name: 'Köpare 1',
    title: 'Skadedjursbekämpning',
    cpv_codes: ['90920000'],
    county_code: 'SE110',
    source: 'uhm',
    source_ref: `r${seq}`,
    supplier_id: null,
    winner_org_number: ORG_ANTICIMEX,
    winner_name: 'Anticimex AB',
    value: 1_000_000,
    value_kind: 'ceiling',
    bids_received: 2,
    lowest_bid: null,
    highest_bid: null,
    criteria_type: null,
    procedure_type: null,
    is_framework: null,
    award_date: '2024-03-01',
    contract_signed_date: null,
    contract_start: null,
    contract_end: null,
    renewal_max: null,
    calc_end_date: '2028-03-01',
    calc_end_source: 'assumption_2_2',
    corrected_end_date: null,
    corrected_by: null,
    corrected_at: null,
    window_start: null,
    window_end: null,
    was_appealed: null,
    status: 'open',
    owner_id: null,
    notes: null,
    raw: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    supplier: null,
    buyer: null,
    ...p,
  }
}

function bidder(p: Partial<BidderWithSupplier>): BidderWithSupplier {
  seq += 1
  return {
    id: `bd${seq}`,
    bidder_key: `bk${seq}`,
    notice_id: null,
    award_id: null,
    source_ref: null,
    supplier_id: null,
    org_number: null,
    name: 'Leverantör',
    price: null,
    score: null,
    rank: null,
    is_winner: false,
    is_begone: false,
    source: 'uhm',
    document_id: null,
    inbound_email_id: null,
    verified: false,
    verified_by: null,
    verified_at: null,
    raw: null,
    created_at: '2026-01-01T00:00:00Z',
    supplier: null,
    ...p,
  }
}

describe('hjälpare', () => {
  it('median', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([null, 5, undefined])).toBe(5)
  })

  it('klassar leverantörer på orgnr, inte namn', () => {
    expect(classifyOrg('556032-9285')).toBe('anticimex')
    expect(classifyOrg(ORG_NOMOR)).toBe('nomor')
    expect(classifyOrg(ORG_BEGONE)).toBe('begone')
    expect(classifyOrg('5560000000')).toBe('other')
    expect(classifyOrg(null, true)).toBe('begone')
  })

  it('år ur datum, UHM-rådata eller antagandet', () => {
    expect(awardYear(award({ award_date: '2023-05-01' }))).toBe(2023)
    expect(awardYear(award({ award_date: null, raw: { upphandling: { 'År': '2022' } } }))).toBe(2022)
    // UHM:s CSV-rubrik bär BOM, nyckeln är U+FEFF följt av år
    expect(awardYear(award({ award_date: null, raw: { upphandling: { [String.fromCharCode(0xfeff) + 'år']: '2021' } } }))).toBe(2021)
    expect(awardYear(award({ award_date: null, raw: null, calc_end_date: '2027-06-01', calc_end_source: 'assumption_2_2' }))).toBe(2023)
    expect(awardYear(award({ award_date: null, raw: null, calc_end_date: null }))).toBeNull()
  })

  it('länfilter', () => {
    expect(matchesCounty('SE110', 'begone')).toBe(true)
    expect(matchesCounty('SE224', 'begone')).toBe(false)
    expect(matchesCounty(null, 'all')).toBe(true)
    expect(matchesCounty(null, 'begone')).toBe(false)
    expect(matchesCounty('SE224', 'SE224')).toBe(true)
  })

  it('kommande kvartal', () => {
    expect(nextQuarters('2026-09-24', 3)).toEqual(['2026-Q3', '2026-Q4', '2027-Q1'])
  })
})

describe('gruppering', () => {
  it('ett ramavtal med två vinnare blir en upphandling och ramtaket räknas en gång', () => {
    const groups = groupAwards([
      award({ source_ref: 'X', winner_org_number: ORG_ANTICIMEX, value: 2_000_000 }),
      award({ source_ref: 'X', winner_org_number: ORG_NOMOR, winner_name: 'Nomor AB', value: 2_000_000 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].winners).toHaveLength(2)
    expect(groups[0].value).toBe(2_000_000)
    expect(groups[0].awardIds).toHaveLength(2)
  })

  it('TED-delområden med olika värden summeras', () => {
    const groups = groupAwards([
      award({ source: 'ted', source_ref: 'T1', winner_org_number: ORG_ANTICIMEX, value: 300_000, value_kind: 'actual' }),
      award({ source: 'ted', source_ref: 'T1', winner_org_number: ORG_NOMOR, value: 200_000, value_kind: 'actual' }),
    ])
    expect(groups[0].value).toBe(500_000)
    expect(groups[0].valueKind).toBe('actual')
  })

  it('rättat slutdatum vinner och fönstret räknas om', () => {
    const [g] = groupAwards([award({ calc_end_date: '2028-03-01', corrected_end_date: '2027-06-30' })])
    expect(g.endDate).toBe('2027-06-30')
    expect(g.endSource).toBe('manual')
    expect(g.windowStart).toBe('2025-12-30')
    expect(g.windowEnd).toBe('2026-06-30')
  })

  it('samma upphandling i TED och UHM slås ihop, TED:s slutdatum och UHM:s ramtak', () => {
    const groups = buildProcurements([
      award({ source: 'ted', source_ref: 'T9', award_date: '2022-04-01', value: null, value_kind: 'unknown', calc_end_date: '2026-12-31', calc_end_source: 'ted_end_plus_renewals', bids_received: 3 }),
      award({ source: 'uhm', source_ref: 'U9', award_date: null, raw: { upphandling: { år: '2022' } }, value: 4_000_000, value_kind: 'ceiling', calc_end_date: '2026-02-01', calc_end_source: 'assumption_2_2', bids_received: 2 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].value).toBe(4_000_000)
    expect(groups[0].valueKind).toBe('ceiling')
    expect(groups[0].endDate).toBe('2026-12-31')
    expect(groups[0].bidsReceived).toBe(3)
    expect(groups[0].refs).toEqual(['ted:T9', 'uhm:U9'])
  })

  it('slår inte ihop olika köpare eller olika vinnare', () => {
    const groups = buildProcurements([
      award({ source: 'ted', source_ref: 'A' }),
      award({ source: 'uhm', source_ref: 'B', buyer_id: 'b2' }),
      award({ source: 'uhm', source_ref: 'C', winner_org_number: ORG_NOMOR }),
    ])
    expect(groups).toHaveLength(3)
  })
})

describe('marknad', () => {
  const groups = buildProcurements([
    award({ source_ref: 'M1', award_date: '2023-01-10', value: 1_000_000, bids_received: 2 }),
    award({ source_ref: 'M2', award_date: '2023-05-10', winner_org_number: ORG_NOMOR, value: 3_000_000, bids_received: 3, buyer_id: 'b2' }),
    award({ source_ref: 'M3', award_date: '2024-02-10', value: 500_000, value_kind: 'estimated', bids_received: 1, buyer_id: 'b3' }),
    award({ source_ref: 'M4', award_date: '2024-06-10', winner_org_number: ORG_BEGONE, value: 1_000_000, bids_received: 5, buyer_id: 'b4' }),
    award({ source_ref: 'M4', award_date: '2024-06-10', winner_org_number: ORG_ANTICIMEX, value: 1_000_000, buyer_id: 'b4' }),
  ])

  it('storlek per år räknar bara ramtak och verkligt pris', () => {
    const m = marketByYear(groups)
    expect(m.map((r) => r.year)).toEqual([2023, 2024])
    expect(m[0]).toMatchObject({ procurements: 2, valued: 2, value: 4_000_000 })
    expect(m[1]).toMatchObject({ procurements: 2, valued: 1, value: 1_000_000 })
  })

  it('andel per vinnare och år', () => {
    const s = sharesByYear(groups)
    expect(s[0]).toMatchObject({ year: 2023, anticimex: 1_000_000, nomor: 3_000_000, total: 4_000_000 })
    expect(s[1]).toMatchObject({ year: 2024, begone: 1_000_000, anticimex: 1_000_000, total: 2_000_000 })
    const t = shareTotals(s)
    expect(t.total).toBe(6_000_000)
    expect(t.anticimex).toBe(2_000_000)
  })

  it('antal anbud per år och median', () => {
    const b = bidsByYear(groups)
    expect(b[0]).toMatchObject({ year: 2023, known: 2, median: 2.5, b2: 1, b3: 1 })
    expect(b[1]).toMatchObject({ year: 2024, known: 2, median: 3, b1: 1, b4plus: 1 })
    expect(overallBidsMedian(groups)).toBe(2.5)
  })
})

describe('avtalsklocka och pipeline', () => {
  const today = '2026-09-24'

  it('fönster, förväntad annons och horisont', () => {
    const [g] = groupAwards([award({ calc_end_date: '2027-12-31' })])
    expect(isInWindow(g, today)).toBe(true)
    expect(expectedAnnouncementQuarter(g, today)).toBe('2026-Q3')
    expect(matchesHorizon(g, '12', today)).toBe(false)
    expect(matchesHorizon(g, '18', today)).toBe(true)
    expect(matchesHorizon(g, 'window', today)).toBe(true)
    const [later] = groupAwards([award({ calc_end_date: '2028-09-01' })])
    expect(isInWindow(later, today)).toBe(false)
    expect(expectedAnnouncementQuarter(later, today)).toBe('2027-Q1')
    expect(matchesHorizon(later, '18', today)).toBe(false)
    expect(matchesHorizon(later, '24', today)).toBe(true)
  })

  it('årsvärde från avtalstid eller fyra år', () => {
    const [g] = groupAwards([award({ value: 4_000_000, contract_start: '2024-01-01', calc_end_date: '2026-01-01' })])
    expect(Math.round(annualValueOfGroup(g)!)).toBe(2_000_000)
    const [h] = groupAwards([award({ value: 4_000_000 })])
    expect(annualValueOfGroup(h)).toBe(1_000_000)
  })

  it('pipeline per kvartal summerar TB och avtalsklocka', () => {
    const groups = groupAwards([
      award({ award_date: '2024-09-30', calc_end_date: '2028-09-30', value: 4_000_000 }),
      award({ award_date: '2024-09-30', calc_end_date: '2028-09-30', value: 4_000_000, status: 'ignored' }),
    ])
    const rows = pipelineByQuarter(
      [
        { tender_deadline: '2026-11-15T12:00:00Z', expected_contribution: 100_000, our_status: 'bidding' },
        { tender_deadline: '2026-11-20T12:00:00Z', expected_contribution: 50_000, our_status: 'declined' },
        { tender_deadline: '2025-01-01T12:00:00Z', expected_contribution: 50_000, our_status: 'new' },
      ],
      groups,
      today,
      4
    )
    expect(rows.map((r) => r.quarter)).toEqual(['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2'])
    expect(rows[1]).toMatchObject({ notices: 1, contribution: 100_000 })
    expect(rows[2]).toMatchObject({ clock: 1, clockAnnualValue: 1_000_000 })
  })
})

describe('utmanarläge och kvalitetsköpare', () => {
  const today = '2026-09-24'

  it('bara Anticimex och Nomor lämnade anbud och avtalet löper ut inom 18 månader', () => {
    const groups = groupAwards([
      award({ source_ref: 'U1', buyer_id: 'b1', calc_end_date: '2027-06-30' }),
      award({ source_ref: 'U2', buyer_id: 'b2', calc_end_date: '2027-06-30' }),
      award({ source_ref: 'U3', buyer_id: 'b3', calc_end_date: '2030-01-01' }),
      award({ source_ref: 'U4', buyer_id: 'b4', calc_end_date: '2027-03-01', bids_received: 1 }),
    ])
    const bidders = indexBidders([
      bidder({ source_ref: 'U1', org_number: ORG_ANTICIMEX, is_winner: true }),
      bidder({ source_ref: 'U1', org_number: ORG_NOMOR }),
      bidder({ source_ref: 'U2', org_number: ORG_ANTICIMEX, is_winner: true }),
      bidder({ source_ref: 'U2', org_number: ORG_BEGONE, is_begone: true }),
      bidder({ source_ref: 'U3', org_number: ORG_ANTICIMEX, is_winner: true }),
    ])
    const rows = challengerBuyers(groups, bidders, today)
    expect(rows.map((r) => r.buyerId)).toEqual(['b4', 'b1'])
    expect(rows[0].basis).toBe('bid_count')
    expect(rows[1].bidderClasses.sort()).toEqual(['anticimex', 'nomor'])
  })

  it('använder köparens senaste upphandling', () => {
    const groups = groupAwards([
      award({ source_ref: 'O1', buyer_id: 'b1', award_date: '2020-01-01', calc_end_date: '2027-01-01', bids_received: 1 }),
      award({ source_ref: 'O2', buyer_id: 'b1', award_date: '2024-01-01', calc_end_date: '2029-01-01', bids_received: 1 }),
    ])
    expect(challengerBuyers(groups, new Map(), today)).toHaveLength(0)
  })

  it('kvalitetsviktade köpare', () => {
    const groups = groupAwards([
      award({ source_ref: 'Q1', buyer_id: 'b1', criteria_type: 'mixed', calc_end_date: '2027-01-01' }),
      award({ source_ref: 'Q2', buyer_id: 'b1', criteria_type: 'price', award_date: '2025-01-01', calc_end_date: '2029-01-01' }),
      award({ source_ref: 'Q3', buyer_id: 'b2', criteria_type: 'price' }),
    ])
    const rows = qualityBuyers(groups, today)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ buyerId: 'b1', qualityCount: 1, total: 2, latestCriteria: 'price', nextEnd: '2027-01-01' })
  })
})

describe('källhälsa', () => {
  const now = new Date('2026-09-24T12:00:00Z').getTime()
  it('tyst över 24 timmar ger varning, tre fel ger fel', () => {
    expect(sourceHealthState({ last_run_at: null, last_success_at: null, consecutive_failures: 0 }, now).tone).toBe('muted')
    expect(sourceHealthState({ last_run_at: '2026-09-24T11:00:00Z', last_success_at: '2026-09-24T11:00:00Z', consecutive_failures: 0 }, now).tone).toBe('good')
    expect(sourceHealthState({ last_run_at: '2026-09-24T11:00:00Z', last_success_at: '2026-09-22T11:00:00Z', consecutive_failures: 1 }, now)).toMatchObject({ tone: 'warn', silentHours: 49 })
    expect(sourceHealthState({ last_run_at: '2026-09-24T11:00:00Z', last_success_at: '2026-09-24T10:00:00Z', consecutive_failures: 3 }, now).tone).toBe('bad')
  })
})

describe('avtalsklockans uppföljning', () => {
  const today = '2026-09-24'
  it('slut passerat utan ny annons väntas nu, inte i ett förflutet kvartal', () => {
    const [g] = groupAwards([award({ source_ref: 'F1', calc_end_date: '2026-04-01', calc_end_source: 'assumption_2_2', followup_status: 'passed_no_notice' })])
    expect(expectedAnnouncementQuarter(g, today)).toBe('2026-Q3')
    expect(matchesHorizon(g, '18', today)).toBe(true)
    expect(matchesHorizon(g, 'passed', today)).toBe(true)
  })
  it('ny annons tas ur fönstret men syns under Ny upphandling', () => {
    const [g] = groupAwards([award({ source_ref: 'F2', calc_end_date: '2027-01-01', followup_status: 'new_notice', followup_title: 'Ny annons' })])
    expect(expectedAnnouncementQuarter(g, today)).toBeNull()
    expect(matchesHorizon(g, '18', today)).toBe(false)
    expect(matchesHorizon(g, 'reannounced', today)).toBe(true)
    expect(g.followupTitle).toBe('Ny annons')
  })
  it('starkaste uppföljningen vinner vid sammanslagning', () => {
    const groups = buildProcurements([
      award({ source: 'uhm', source_ref: 'U1', award_date: '2022-05-01', followup_status: 'passed_no_notice' }),
      award({ source: 'ted', source_ref: 'T1', award_date: '2022-06-01', followup_status: 'new_award' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].followupStatus).toBe('new_award')
  })
})

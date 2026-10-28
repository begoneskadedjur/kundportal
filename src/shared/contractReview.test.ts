import { describe, it, expect } from 'vitest'
import {
  buildReviewSnapshot,
  combineReviewStates,
  formatReviewKr,
  parseReviewSnapshot,
  reviewChecklist,
  reviewShortDate,
  reviewState,
  type ReviewInput,
} from './contractReview'

const base: ReviewInput = {
  contract: {
    annual_value: '27798',
    billing_frequency: 'annual',
    billing_anchor_month: 10,
    contract_start_date: '2025-10-01',
    contract_length: '3',
    contract_type: 'Skadedjursavtal Betongstation',
    display_name: null,
  },
  premiumEvents: [
    { event_type: 'start', annual_value: 27798, effective_from: '2025-10-01' },
  ],
  customer: { customer_number: 2526, organization_number: '556677-8899' },
}

const withContract = (patch: Partial<ReviewInput['contract']>): ReviewInput => ({ ...base, contract: { ...base.contract, ...patch } })

describe('buildReviewSnapshot', () => {
  it('normaliserar tal, org.nr och kundnummer', () => {
    const s = buildReviewSnapshot(base)
    expect(s.annual_value).toBe(27798)
    expect(s.organization_number).toBe('5566778899')
    expect(s.customer_number).toBe('2526')
    expect(s.contract_start_date).toBe('2025-10-01')
  })
  it('sorterar premiehändelserna', () => {
    const s = buildReviewSnapshot({
      ...base,
      premiumEvents: [
        { event_type: 'indexation', annual_value: '28400', effective_from: '2026-10-01' },
        { event_type: 'start', annual_value: 27798, effective_from: '2025-10-01' },
      ],
    })
    expect(s.premium_events.map((e) => e.event_type)).toEqual(['start', 'indexation'])
  })
  it('faller tillbaka på start_date', () => {
    expect(buildReviewSnapshot(withContract({ contract_start_date: null, start_date: '2024-05-01T00:00:00' })).contract_start_date).toBe('2024-05-01')
  })
  it('överlever en rundtur som jsonb', () => {
    const s = buildReviewSnapshot(base)
    const parsed = parseReviewSnapshot(JSON.parse(JSON.stringify(s)))
    expect(reviewState(parsed, s)).toEqual({ state: 'ok', changes: [] })
  })
})

describe('reviewState', () => {
  const snap = buildReviewSnapshot(base)

  it('utan bild: ej', () => {
    expect(reviewState(null, snap).state).toBe('ej')
    expect(parseReviewSnapshot(null)).toBeNull()
    expect(parseReviewSnapshot('x')).toBeNull()
  })

  it('oförändrat: ok', () => {
    expect(reviewState(snap, buildReviewSnapshot(base))).toEqual({ state: 'ok', changes: [] })
  })

  it('premien ändrad: en rad, startsteget räknas inte dubbelt', () => {
    const now = buildReviewSnapshot({
      ...withContract({ annual_value: 28400 }),
      premiumEvents: [{ event_type: 'start', annual_value: 28400, effective_from: '2025-10-01' }],
    })
    expect(reviewState(snap, now)).toEqual({ state: 'andrad', changes: ['Premien ändrades från 27 798 kr till 28 400 kr'] })
  })

  it('nytt trappsteg listas', () => {
    const now = buildReviewSnapshot({
      ...base,
      premiumEvents: [...(base.premiumEvents ?? []), { event_type: 'indexation', annual_value: 28400, effective_from: '2026-10-01' }],
    })
    expect(reviewState(snap, now).changes).toEqual(['Indexering från 2026-10-01 lades till, premien blir 28 400 kr'])
  })

  it('borttaget trappsteg listas', () => {
    const now = buildReviewSnapshot({ ...base, premiumEvents: [] })
    expect(reviewState(snap, now).changes).toEqual(['Start från 2025-10-01 togs bort (27 798 kr)'])
  })

  it('kundnummer, faktureringsmånad och frekvens', () => {
    const now = buildReviewSnapshot({
      ...withContract({ billing_anchor_month: 1, billing_frequency: 'quarterly' }),
      customer: { customer_number: 2527, organization_number: '556677-8899' },
    })
    expect(reviewState(snap, now).changes).toEqual([
      'Faktureringen ändrades från årsvis till kvartalsvis',
      'Faktureringsmånaden ändrades från oktober till januari',
      'Kundnumret ändrades från 2526 till 2527',
    ])
  })

  it('org.nr med annan formatering räknas inte som ändring', () => {
    const now = buildReviewSnapshot({ ...base, customer: { customer_number: 2526, organization_number: '5566778899' } })
    expect(reviewState(snap, now).state).toBe('ok')
  })

  it('avtalstid, start och typ', () => {
    const now = buildReviewSnapshot(withContract({ contract_length: '2 år', contract_start_date: '2025-11-01', contract_type: 'Mekaniska fällor' }))
    expect(reviewState(snap, now).changes).toEqual([
      'Avtalsstarten ändrades från 2025-10-01 till 2025-11-01',
      'Avtalstiden ändrades från 3 år till 2 år',
      'Avtalstypen ändrades från Skadedjursavtal Betongstation till Mekaniska fällor',
    ])
  })
})

describe('combineReviewStates', () => {
  it('väger ihop en samlad faktura', () => {
    expect(combineReviewStates([])).toBe('ej')
    expect(combineReviewStates(['ok', 'ok'])).toBe('ok')
    expect(combineReviewStates(['ok', 'ej'])).toBe('ej')
    expect(combineReviewStates(['ok', 'ej', 'andrad'])).toBe('andrad')
  })
})

describe('reviewChecklist', () => {
  const s = buildReviewSnapshot({ ...base, customer: { customer_number: 1507, organization_number: '559100-7819' } })
  it('kort variant till tooltipen', () => {
    expect(reviewChecklist(s, { today: '2026-10-28' })).toEqual([
      'Premie 27 798 kr enligt signerat avtal',
      'Fortnox-kort 1507 stämmer med namn och org.nr',
      'Perioden följer avtalsåret',
      'Ingen period fakturerad tidigare',
    ])
  })
  it('lång variant till fakturan', () => {
    expect(reviewChecklist(s, { variant: 'lang', oneflowId: '15085113', today: '2026-10-28' })).toEqual([
      'Premie 27 798 kr enligt signerat avtal (Oneflow 15085113)',
      'Fortnox-kort 1507 stämmer med namn och org.nr',
      'Fakturaperioden följer avtalsåret, oktober till september',
      'Ingen period är fakturerad tidigare',
    ])
  })
  it('premien som gäller idag ur trappan', () => {
    const t = buildReviewSnapshot({
      ...base,
      premiumEvents: [
        { event_type: 'start', annual_value: 27798, effective_from: '2025-10-01' },
        { event_type: 'indexation', annual_value: 28400, effective_from: '2026-10-01' },
        { event_type: 'step_up', annual_value: 30000, effective_from: '2027-10-01' },
      ],
    })
    expect(reviewChecklist(t, { today: '2026-10-28' })[0]).toBe('Premie 28 400 kr enligt signerat avtal')
  })
  it('lokalt Oneflow-id visas inte', () => {
    expect(reviewChecklist(s, { variant: 'lang', oneflowId: 'local-abc', today: '2026-10-28' })[0]).toBe('Premie 27 798 kr enligt signerat avtal')
  })
})

describe('format', () => {
  it('kronor och kort datum', () => {
    expect(formatReviewKr(1234567)).toBe('1 234 567 kr')
    expect(formatReviewKr(null)).toBe('ingen premie')
    expect(reviewShortDate('2026-10-28')).toBe('28 okt')
  })
})

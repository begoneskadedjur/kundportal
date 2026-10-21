import { describe, it, expect } from 'vitest'
import { scheduleHorizon } from './scheduleHorizon'
import { generateInspectionDates } from '../utils/inspectionDateGenerator'
import type { DateGenerationParams } from '../types/recurringSchedule'

const d = (iso: string) => new Date(iso + 'T00:00:00')

describe('scheduleHorizon', () => {
  const ulriksdal = {
    contract_start_date: '2024-11-04',
    contract_end_date: '2025-11-04',
    terminated_at: null,
    notice_period_months: null,
  }

  it('rullande avtal efter sista uppsägningsdag: hela nästa avtalsår', () => {
    const h = scheduleHorizon(ulriksdal, '2026-10-21')
    expect(h.currentEnd).toBe('2026-11-04')
    expect(h.lastNoticeDay).toBe('2026-09-04')
    expect(h.renewalDue).toBe(true)
    expect(h.planEnd).toBe('2027-11-04')
  })

  it('före sista uppsägningsdag: bara till periodskiftet', () => {
    const h = scheduleHorizon(ulriksdal, '2026-08-01')
    expect(h.renewalDue).toBe(false)
    expect(h.planEnd).toBe('2026-11-04')
  })

  it('uppsagt avtal: till sista giltiga dag', () => {
    const h = scheduleHorizon({ ...ulriksdal, terminated_at: '2026-10-01T10:00:00Z', effective_end_date: '2026-12-01' }, '2026-10-21')
    expect(h.terminated).toBe(true)
    expect(h.planEnd).toBe('2026-12-01')
  })

  it('tills vidare: uppsägningstiden framåt', () => {
    const h = scheduleHorizon({ contract_start_date: '2025-03-01', contract_end_date: null, terminated_at: null, notice_period_months: 3 }, '2026-10-21')
    expect(h.openEnded).toBe(true)
    expect(h.planEnd).toBe('2027-01-21')
  })
})

describe('generateInspectionDates med periodankare', () => {
  const base: Omit<DateGenerationParams, 'startDate' | 'endDate'> = {
    frequency: 'custom',
    dayPattern: 'first_weekday',
    preferredTime: '09:00',
    estimatedDurationMinutes: 60,
    customFrequencyConfig: { visits_per_period: 6, period_type: 'year' },
  }

  it('6 per år i ett tvåmånadersfönster ger en kontroll, inte sex', () => {
    const dates = generateInspectionDates({
      ...base,
      startDate: d('2026-10-19'),
      endDate: d('2026-12-18'),
      periodAnchor: d('2026-10-19'),
    })
    expect(dates).toHaveLength(1)
  })

  it('förlängningar i bitar ger samma kontroller som ett helt år', () => {
    const anchor = d('2026-10-19')
    const helt = generateInspectionDates({ ...base, startDate: anchor, endDate: d('2027-10-19'), periodAnchor: anchor })
    const bitar = [
      ['2026-10-19', '2026-12-18'],
      ['2026-12-18', '2027-02-18'],
      ['2027-02-18', '2027-10-19'],
    ].flatMap(([s, e]) => generateInspectionDates({ ...base, startDate: d(s), endDate: d(e), periodAnchor: anchor }))
    expect(helt).toHaveLength(6)
    expect(bitar.map(x => x.date.getTime())).toEqual(helt.map(x => x.date.getTime()))
  })

  it('kvartalsvis över ett år ger fyra', () => {
    const anchor = d('2026-11-02')
    const dates = generateInspectionDates({
      ...base,
      frequency: 'quarterly',
      customFrequencyConfig: undefined,
      startDate: anchor,
      endDate: d('2027-11-02'),
      periodAnchor: anchor,
    })
    expect(dates).toHaveLength(4)
  })

  it('startdatum bakåt sätter rytmen men inget läggs ut före fönstret', () => {
    const dates = generateInspectionDates({
      ...base,
      frequency: 'quarterly',
      customFrequencyConfig: undefined,
      startDate: d('2026-10-21'),
      endDate: d('2027-10-21'),
      periodAnchor: d('2026-08-03'),
    })
    expect(dates.every(x => x.date >= d('2026-10-21'))).toBe(true)
    // Perioder från 3 aug: nov, feb, maj, aug
    expect(dates.map(x => x.date.getMonth())).toEqual([10, 1, 4, 7])
  })

  it('uppsagt avtal: inget efter sista giltiga dag', () => {
    const dates = generateInspectionDates({
      ...base,
      frequency: 'monthly',
      customFrequencyConfig: undefined,
      startDate: d('2026-11-01'),
      endDate: d('2027-01-15'),
      periodAnchor: d('2026-11-01'),
      hardEndDate: d('2027-01-15'),
    })
    expect(dates.every(x => x.date < d('2027-01-15'))).toBe(true)
  })
})

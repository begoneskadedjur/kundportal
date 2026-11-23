import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { currentPeriodSegment, generateInspectionDates } from './inspectionDateGenerator'
import type { DateGenerationParams } from '../types/recurringSchedule'

const dag = (d: Date) => format(d, 'yyyy-MM-dd')

// Kvartalsschema som startade 2026-01-15. Ändringen görs 2026-11-23, mitt i
// perioden 2026-10-15 till 2027-01-14.
const bas: DateGenerationParams = {
  frequency: 'quarterly',
  dayPattern: 'first_weekday',
  preferredTime: '09:00',
  estimatedDurationMinutes: 60,
  startDate: new Date(2026, 10, 23),
  endDate: new Date(2028, 0, 15),
  periodAnchor: new Date(2026, 0, 15),
}

describe('generateInspectionDates med periodankare', () => {
  it('räknar perioderna från schemats start, inte från dagens datum', () => {
    const datum = generateInspectionDates(bas)
    expect(datum.map(d => dag(d.periodStart))).toEqual(['2027-01-15', '2027-04-15', '2027-07-15', '2027-10-15'])
    expect(dag(datum[0].date)).toBe('2027-01-15')
  })

  it('hoppar över en period som redan börjat när includeCurrentPeriod saknas', () => {
    const utan = generateInspectionDates(bas)
    const falskt = generateInspectionDates({ ...bas, includeCurrentPeriod: false })
    expect(falskt.map(d => d.date.getTime())).toEqual(utan.map(d => d.date.getTime()))
    expect(utan.some(d => dag(d.periodStart) === '2026-10-15')).toBe(false)
  })

  it('lägger ut ett besök i den pågående perioden när includeCurrentPeriod är satt', () => {
    const datum = generateInspectionDates({ ...bas, includeCurrentPeriod: true })
    expect(datum).toHaveLength(5)
    expect(dag(datum[0].periodStart)).toBe('2026-10-15')
    // Sökfönstret är [startDate, periodens slut]
    expect(dag(datum[0].date)).toBe('2026-11-23')
    // Resten av rytmen är oförändrad
    expect(datum.slice(1).map(d => dag(d.periodStart))).toEqual(['2027-01-15', '2027-04-15', '2027-07-15', '2027-10-15'])
  })

  it('tar inte med en period som slutat före fönstret', () => {
    const datum = generateInspectionDates({ ...bas, startDate: new Date(2027, 0, 15), includeCurrentPeriod: true })
    expect(dag(datum[0].periodStart)).toBe('2027-01-15')
  })
})

describe('currentPeriodSegment', () => {
  it('ger perioden som pågår', () => {
    const seg = currentPeriodSegment('quarterly', new Date(2026, 0, 15), new Date(2026, 10, 23))
    expect(seg && dag(seg.start)).toBe('2026-10-15')
    expect(seg && dag(seg.end)).toBe('2027-01-14')
  })

  it('ger delen av perioden vid flera besök per period', () => {
    const seg = currentPeriodSegment('twice_monthly', new Date(2026, 0, 1), new Date(2026, 10, 20))
    expect(seg && dag(seg.start)).toBe('2026-11-15')
    expect(seg && dag(seg.end)).toBe('2026-11-30')
  })

  it('ger null innan schemat har börjat', () => {
    expect(currentPeriodSegment('monthly', new Date(2027, 0, 1), new Date(2026, 10, 23))).toBeNull()
  })
})

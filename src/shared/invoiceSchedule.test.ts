import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  daysBetween,
  dueNoteText,
  frequencyFromPeriod,
  invoiceSchedule,
  scheduleStatusText,
  swedishDay,
} from './invoiceSchedule'

const TODAY = '2026-11-05'

describe('swedishDay', () => {
  it('UTC-midnatt dagen före blir svensk dag', () => {
    expect(swedishDay('2026-11-30T23:00:00+00:00')).toBe('2026-12-01')
    expect(swedishDay('2026-06-30T22:00:00Z')).toBe('2026-07-01')
    expect(swedishDay('2026-12-01T08:00:00Z')).toBe('2026-12-01')
  })
  it('rent datum lämnas', () => {
    expect(swedishDay('2026-12-01')).toBe('2026-12-01')
  })
})

describe('datumhjälp', () => {
  it('addDaysIso och daysBetween över månadsskifte och sommartid', () => {
    expect(addDaysIso('2026-11-05', 30)).toBe('2026-12-05')
    expect(addDaysIso('2026-03-28', 2)).toBe('2026-03-30')
    expect(daysBetween('2026-10-22', '2026-11-05')).toBe(14)
  })
})

describe('invoiceSchedule', () => {
  it('perioden har börjat: ej skickad och periodstart idag eller tidigare', () => {
    const s = invoiceSchedule({ created_at: '2026-11-02T23:00:00Z', billing_period_start: '2026-11-01' }, TODAY, 30)
    expect(s.status).toBe('started')
    expect(s.sendDate).toBe('2026-11-03')
    expect(s.dueIfSentToday).toBe('2026-12-05')
    expect(s.paysAfterPeriodStart).toBe(true)
    expect(scheduleStatusText(s)).toBe('Perioden började 1 nov')
  })

  it('försenad: skickdatum passerat, perioden har inte börjat', () => {
    const s = invoiceSchedule({ created_at: '2026-10-21T22:00:00Z', billing_period_start: '2026-12-01' }, TODAY, 30)
    expect(s.status).toBe('late')
    expect(s.days).toBe(14)
    expect(scheduleStatusText(s)).toBe('Försenad 14 dagar')
    expect(s.dueAfterStartDays).toBe(4)
    expect(dueNoteText(s)).toBe('Betalas efter periodstart')
  })

  it('försenad en dag, förfaller före periodstart', () => {
    const s = invoiceSchedule({ created_at: '2026-11-04T00:00:00+01:00', billing_period_start: '2026-12-15' }, TODAY, 30)
    expect(s.status).toBe('late')
    expect(scheduleStatusText(s)).toBe('Försenad 1 dag')
    expect(s.paysAfterPeriodStart).toBe(false)
    expect(dueNoteText(s)).toBe('Före periodstart')
  })

  it('skicka denna vecka: inom sju dagar, idag räknas', () => {
    const idag = invoiceSchedule({ created_at: '2026-11-05T08:00:00Z', billing_period_start: '2026-12-15' }, TODAY, 30)
    expect(idag.status).toBe('this_week')
    expect(scheduleStatusText(idag)).toBe('Skicka idag')
    const sju = invoiceSchedule({ created_at: '2026-11-12T08:00:00Z', billing_period_start: '2026-12-22' }, TODAY, 30)
    expect(sju.status).toBe('this_week')
    expect(scheduleStatusText(sju)).toBe('Om 7 dagar')
  })

  it('kommande: mer än sju dagar bort', () => {
    const s = invoiceSchedule({ created_at: '2026-12-01T08:00:00Z', billing_period_start: '2026-12-01' }, TODAY, 30)
    expect(s.status).toBe('upcoming')
    expect(s.days).toBe(26)
    expect(scheduleStatusText(s)).toBe('Om 26 dagar')
  })

  it('månadsfaktura skickad på sin dag förfaller 30 dagar in i perioden', () => {
    const s = invoiceSchedule({ created_at: '2026-12-01T08:00:00Z', billing_period_start: '2026-12-01' }, '2026-12-01', 30)
    expect(s.status).toBe('started')
    expect(s.dueIfSentToday).toBe('2026-12-31')
    expect(s.paysAfterPeriodStart).toBe(true)
  })

  it('utan period: bara skickdatumet styr', () => {
    const s = invoiceSchedule({ created_at: '2026-11-01T08:00:00Z', billing_period_start: null }, TODAY, 30)
    expect(s.status).toBe('late')
    expect(dueNoteText(s)).toBe('')
  })
})

describe('frequencyFromPeriod', () => {
  it('periodens längd ger frekvensen', () => {
    expect(frequencyFromPeriod('2026-12-01', '2026-12-31')).toBe('monthly')
    expect(frequencyFromPeriod('2027-01-01', '2027-03-31')).toBe('quarterly')
    expect(frequencyFromPeriod('2027-01-01', '2027-06-30')).toBe('semi_annual')
    expect(frequencyFromPeriod('2026-11-01', '2027-10-31')).toBe('annual')
    expect(frequencyFromPeriod(null, '2027-10-31')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { describePlanChange, PREVIEW_FOOTER, upcomingPeriods } from './contractAnchorPreview'

describe('describePlanChange', () => {
  // Heimstaden Brynäs: betald 2025-11-25 t.o.m. 2026-11-24, utkast 2026-11-01 t.o.m. 2027-10-31
  const existing = [
    { id: 'paid', invoice_number: 'INV-202511-0100', billing_period_start: '2025-11-25', billing_period_end: '2026-11-24', status: 'paid' },
    { id: 'draft', invoice_number: 'INV-202610-0004', billing_period_start: '2026-11-01', billing_period_end: '2027-10-31', status: 'pending_approval' },
  ]
  const before = [
    { action: 'locked', planned: { periodStart: '2025-11-01', periodEnd: '2026-10-31' }, existingId: 'paid' },
    { action: 'keep', planned: { periodStart: '2026-11-01', periodEnd: '2027-10-31' }, existingId: 'draft' },
  ]
  const after = [
    { action: 'locked', planned: { periodStart: '2025-11-25', periodEnd: '2026-11-24' }, existingId: 'paid' },
    { action: 'update', planned: { periodStart: '2026-11-25', periodEnd: '2027-11-24' }, existingId: 'draft' },
  ]

  it('utkastet som flyttas till avtalsdagen beskrivs med nya och gamla datum', () => {
    const out = describePlanChange(before, after, existing)
    expect(out.lines).toEqual([
      {
        kind: 'moved',
        text: 'Utkast INV-202610-0004 får datumen 2026-11-25 t.o.m. 2027-11-24 (i dag 2026-11-01 t.o.m. 2027-10-31).',
      },
    ])
    expect(out.footer).toBe(PREVIEW_FOOTER)
    expect(out.footer).toContain('Skickade fakturor ändras inte')
  })

  it('update med samma datum (bara belopp) och poster som finns i båda planerna visas inte', () => {
    const sameDates = [{ action: 'update', planned: { periodStart: '2026-11-01', periodEnd: '2027-10-31' }, existingId: 'draft' }]
    expect(describePlanChange([], sameDates, existing).lines).toEqual([])
    const create = [{ action: 'create', planned: { periodStart: '2027-11-01', periodEnd: '2028-10-31' } }]
    expect(describePlanChange(create, create, existing).lines).toEqual([])
  })

  it('nya fakturor och borttagna utkast, tilläggsfaktura får egen text', () => {
    const out = describePlanChange(
      [],
      [
        { action: 'delete', kind: 'equipment', existingId: 'draft' },
        { action: 'create', kind: 'equipment', planned: { periodStart: '2027-06-30', periodEnd: '2028-06-29' } },
        { action: 'create', planned: { periodStart: '2027-06-30', periodEnd: '2028-06-29' } },
      ],
      existing
    )
    expect(out.lines.map((l) => l.text)).toEqual([
      'Tilläggsfakturan INV-202610-0004 (2026-11-01 t.o.m. 2027-10-31) tas bort.',
      'Ny tilläggsfaktura 2027-06-30 t.o.m. 2028-06-29 skapas.',
      'Ny faktura 2027-06-30 t.o.m. 2028-06-29 skapas.',
    ])
  })
})

describe('upcomingPeriods', () => {
  it('exakt läge: perioderna efter dagen från avtalsdagen (Brynäs)', () => {
    expect(
      upcomingPeriods({ contract_start_date: '2025-11-25', billing_frequency: 'annual', billing_anchor_month: 11, billing_anchor_mode: 'start_day' }, '2026-10-30')
    ).toEqual([
      { periodStart: '2026-11-25', periodEnd: '2027-11-24' },
      { periodStart: '2027-11-25', periodEnd: '2028-11-24' },
      { periodStart: '2028-11-25', periodEnd: '2029-11-24' },
    ])
  })

  it('gamla läget: perioderna börjar den 1:a i ankarmånaden', () => {
    expect(upcomingPeriods({ contract_start_date: '2025-11-25', billing_frequency: 'annual', billing_anchor_month: 11, billing_anchor_mode: null }, '2026-10-30', 2)).toEqual([
      { periodStart: '2026-11-01', periodEnd: '2027-10-31' },
      { periodStart: '2027-11-01', periodEnd: '2028-10-31' },
    ])
  })

  it('exakt läge med klampning (31 januari, månadsvis) och frekvens saknas i gamla läget', () => {
    expect(
      upcomingPeriods({ contract_start_date: '2026-01-31', billing_frequency: 'monthly', billing_anchor_mode: 'start_day' }, '2026-02-10', 2)
    ).toEqual([
      { periodStart: '2026-02-28', periodEnd: '2026-03-30' },
      { periodStart: '2026-03-31', periodEnd: '2026-04-29' },
    ])
    expect(upcomingPeriods({ contract_start_date: '2026-01-01', billing_frequency: null, billing_anchor_mode: null }, '2026-02-10')).toEqual([])
  })
})

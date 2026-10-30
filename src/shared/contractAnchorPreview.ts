// src/shared/contractAnchorPreview.ts
// Förhandsvisningen när avtalsåret eller tilläggsreglerna byts i avtalskartan
// (steg 12 i docs/planer/avtalsar-exakt-arsdag-teknik.md). Ren logik utan
// Supabase: tar fakturaplanen före och efter bytet (ContractInvoiceGenerator
// i provläge, ingen apply) och de befintliga fakturornas datum, och säger i
// klartext vad Planera fakturor kommer att göra. Ingenting ändras här.

import {
  exactPeriodAt,
  exactPeriodIndexContaining,
  nextPeriodStart,
  periodContaining,
  periodStepMonths,
  type PeriodContract,
  type PeriodRangeIso,
} from './contractPeriods'

/** De fält ur en planpost som förhandsvisningen läser. */
export interface PreviewPlanEntry {
  action: string
  kind?: string | null
  planned?: { periodStart: string; periodEnd: string; subtotal?: number } | null
  existingId?: string | null
  existingStatus?: string | null
}

/** En befintlig faktura, för att kunna säga vilka datum den har i dag. */
export interface PreviewExistingInvoice {
  id: string
  invoice_number: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  status: string | null
}

export type PreviewLineKind = 'moved' | 'created' | 'deleted'

export interface PreviewLine {
  kind: PreviewLineKind
  text: string
}

export interface PlanChangePreview {
  lines: PreviewLine[]
  /** Står alltid sist: skickade fakturor rörs aldrig */
  footer: string
}

export const PREVIEW_FOOTER = 'Skickade fakturor ändras inte. Ingenting ändras förrän du kör Planera fakturor.'

const KIND_PREFIX: Record<string, string> = {
  equipment: 'Tilläggsfakturan',
  equipment_monthly: 'Tilläggsfakturan för månaden',
  equipment_gap: 'Fakturan för tillägg från utsättning',
}

const CREATE_LABEL: Record<string, string> = {
  equipment: 'Ny tilläggsfaktura',
  equipment_monthly: 'Ny tilläggsfaktura för månaden',
  equipment_gap: 'Ny faktura för tillägg från utsättning',
}

function invoiceLabel(ex: PreviewExistingInvoice | undefined, kind: string | null | undefined): string {
  const prefix = kind && KIND_PREFIX[kind] ? `${KIND_PREFIX[kind]} ` : 'Utkast '
  return `${prefix}${ex?.invoice_number ?? 'utan nummer'}`
}

function entryKey(e: PreviewPlanEntry): string {
  return `${e.action}|${e.kind ?? 'premium'}|${e.planned?.periodStart ?? ''}|${e.planned?.periodEnd ?? ''}|${e.existingId ?? ''}`
}

/**
 * Det som skiljer planen efter bytet från planen före, som meningar.
 * Bara poster som Planera fakturor gör något med: utkast som får nya datum
 * (update där datumen skiljer), nya fakturor (create) och utkast som tas bort
 * (delete). Poster som ser likadana ut i båda planerna visas inte, de händer
 * oavsett bytet.
 */
export function describePlanChange(
  before: PreviewPlanEntry[],
  after: PreviewPlanEntry[],
  existing: PreviewExistingInvoice[]
): PlanChangePreview {
  const byId = new Map(existing.map((e) => [e.id, e]))
  const beforeKeys = new Set(before.map(entryKey))
  const lines: PreviewLine[] = []
  const sorted = [...after].sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))
  for (const e of sorted) {
    if (beforeKeys.has(entryKey(e))) continue
    const ex = e.existingId ? byId.get(e.existingId) : undefined
    if (e.action === 'update' && e.planned && ex) {
      const sameDates = ex.billing_period_start === e.planned.periodStart && ex.billing_period_end === e.planned.periodEnd
      if (sameDates) continue
      lines.push({
        kind: 'moved',
        text: `${invoiceLabel(ex, e.kind)} får datumen ${e.planned.periodStart} t.o.m. ${e.planned.periodEnd} (i dag ${ex.billing_period_start ?? '?'} t.o.m. ${ex.billing_period_end ?? '?'}).`,
      })
    } else if (e.action === 'create' && e.planned) {
      const what = (e.kind && CREATE_LABEL[e.kind]) || 'Ny faktura'
      lines.push({ kind: 'created', text: `${what} ${e.planned.periodStart} t.o.m. ${e.planned.periodEnd} skapas.` })
    } else if (e.action === 'delete' && ex) {
      lines.push({
        kind: 'deleted',
        text: `${invoiceLabel(ex, e.kind)} (${ex.billing_period_start ?? '?'} t.o.m. ${ex.billing_period_end ?? '?'}) tas bort.`,
      })
    }
  }
  return { lines, footer: PREVIEW_FOOTER }
}

/**
 * De närmaste periodernas datum efter dagen, för raden under valet.
 * Exakt läge: från avtalsdagen med klampning. Gamla läget: dagens regel
 * (den 1:a, årsvis i ankarmånaden). Tom lista när avtalet saknar periodisk
 * fakturering i gamla läget.
 */
export function upcomingPeriods(c: PeriodContract, todayIso: string, count = 3): PeriodRangeIso[] {
  const out: PeriodRangeIso[] = []
  if (c.billing_anchor_mode === 'start_day' && c.contract_start_date) {
    const step = periodStepMonths(c.billing_frequency)
    const k0 = exactPeriodIndexContaining(c.contract_start_date, step, todayIso) + 1
    for (let k = k0; k < k0 + count; k++) out.push(exactPeriodAt(c.contract_start_date, step, k))
    return out
  }
  let from = todayIso
  for (let i = 0; i < count; i++) {
    const next = nextPeriodStart(c, from)
    if (!next) break
    const p = periodContaining(c, next)
    if (!p) break
    out.push(p)
    from = next
  }
  return out
}

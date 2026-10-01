// src/components/shared/AddonBillingTimeline.tsx
// Tidslinjen för ett tillägg bredvid avtalet: fylld del = det som betalas nu
// (dagar kvar till avtalets nästa periodstart), streckad del = från
// periodstarten följer tillägget avtalets år. Båda sidor visar pris per
// enhet (per station, per timme) så att det kan stämmas mot fasta priset.
// Ordet "pro rata" visas aldrig här: teknikern förstår det inte.
//
// All matte kommer från src/shared/addonEconomics.ts (timelineFromRow /
// timelineForProposal). Komponenten räknar ingenting själv.

import type { CSSProperties } from 'react'
import type { AddonTimeline } from '../../shared/addonEconomics'
import { formatDateShortSv, formatKr, monthsLabel } from '../../shared/addonEconomics'

interface AddonBillingTimelineProps {
  timeline: AddonTimeline
  /** Datumintervallet före månaderna i vänsterkolumnen ("29 sep 2026 till 30 jun 2027 · ") */
  showDates?: boolean
  /** Rubrik för vänstersidan, default "Betalas nu" */
  nowTitle?: string
  /** Visa beloppen per enhet (default true) */
  showPerUnit?: boolean
  /** "275 av 365 dagar" i stället för "9 av 12 månader" (fakturan) */
  showDays?: boolean
  /** Ersätter vänstersidans pris per enhet, t.ex. uträkningen på fakturan */
  nowDetail?: string
  className?: string
}

const STRIPES: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, var(--color-slate-700) 0 6px, var(--color-slate-800) 6px 12px)',
}

export function unitLabel(t: AddonTimeline): string {
  if (t.unit === 'timme') return 'per timme'
  return t.model === 'per_month' ? 'per station och månad' : 'per station'
}

export default function AddonBillingTimeline({
  timeline: t,
  showDates = true,
  nowTitle = 'Betalas nu',
  showPerUnit = true,
  showDays = false,
  nowDetail,
  className = '',
}: AddonBillingTimelineProps) {
  const perMonth = t.model === 'per_month'
  // Minsta synliga bredd på båda sidor så texten får plats även vid korta perioder
  const pct = Math.max(12, Math.min(88, Math.round(t.fraction * 100)))
  const tooltip = t.fromDate && t.toDate
    ? `${formatDateShortSv(t.fromDate)} till ${formatDateShortSv(t.toDate)}: ${t.days} dagar av 365`
    : `${t.days} dagar av 365`
  const rightTotal = perMonth
    ? `${formatKr(t.totalAnnual / 12)} per månad`
    : `${formatKr(t.totalAnnual)} per år`
  const rightPerUnit = perMonth ? t.perUnitAnnual / 12 : t.perUnitAnnual

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex h-2.5 gap-[3px]" title={tooltip} aria-label={tooltip}>
        <div className="rounded-l-full bg-[#20c58f]" style={{ width: `${pct}%` }} />
        <div className="flex-1 rounded-r-full" style={STRIPES} />
      </div>
      <div className="flex gap-[3px]">
        <div className="flex flex-col gap-0.5 pr-2" style={{ width: `${pct}%` }}>
          <span className="text-xs font-semibold text-[#20c58f]">{nowTitle}</span>
          <span className="text-xs text-slate-400" title={tooltip}>
            {showDates && t.fromDate && t.toDate && !perMonth
              ? `${formatDateShortSv(t.fromDate)} till ${formatDateShortSv(t.toDate)} · `
              : ''}
            {perMonth ? `${t.days} dagar` : showDays ? `${t.days} av 365 dagar` : monthsLabel(t.months)}
          </span>
          {nowDetail ? (
            <span className="text-xs text-slate-300 tabular-nums">{nowDetail}</span>
          ) : showPerUnit && (
            <span className="text-xs text-slate-300">
              {formatKr(t.perUnitNow)} {t.unit === 'timme' ? 'per timme' : 'per station'}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold text-slate-300">
            {t.startDate ? `Från ${formatDateShortSv(t.startDate)}` : 'Därefter'}
          </span>
          <span className="text-xs text-slate-400">{rightTotal}</span>
          {showPerUnit && (
            <span className="text-xs text-slate-300">
              {formatKr(rightPerUnit)} {unitLabel(t)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

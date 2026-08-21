// src/components/admin/customers/record/EquipmentGlyphs.tsx
//
// Tecknade objekt för utrustningsvyn. Samma hantverk som ContractStamp:
// egna paths, brusfilter, useId på filter-id:n så instanser inte krockar.

import { useId } from 'react'
import type { EquipmentAlarm } from '../../../../hooks/useCustomerEquipment'

/**
 * Beståndsglyf: ringen är hela beståndet, den blå streckade sektorn är
 * inomhusandelen. Formen är densamma vid 12 stationer som vid 607 — det är
 * proportionen som bär betydelsen, inte antalet.
 */
export function BestandGlyph({
  outdoor,
  indoor,
  tone = 'ok',
  size = 56,
}: {
  outdoor: number
  indoor: number
  tone?: 'ok' | 'warn' | 'bad' | 'none'
  size?: number
}) {
  const uid = useId().replace(/:/g, '')
  const total = Math.max(1, outdoor + indoor)
  const R = 22
  const C = 2 * Math.PI * R
  const indoorLen = (indoor / total) * C
  const ink = { ok: '#20c58f', warn: '#f59e0b', bad: '#ef4444', none: '#64748b' }[tone]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      role="img"
      aria-label={`${outdoor + indoor} stationer, ${outdoor} utomhus, ${indoor} inomhus`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-r`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="13" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-r)`}>
        {/* Utomhus: den hela ringen */}
        <circle cx="28" cy="28" r={R} fill="none" stroke={ink} strokeWidth="3" strokeOpacity="0.85" strokeLinecap="round" />
        {/* Inomhus: streckad sektor ovanpå — tak, inte mark */}
        {indoor > 0 && (
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeDasharray={`${indoorLen} ${C - indoorLen}`}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
          />
        )}
        {/* Navet: en station i genomskärning */}
        <rect x="21" y="24" width="14" height="10" rx="2.2" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <path d="M24.5 29 h7" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

const ALARM_SPEC: Record<
  Exclude<EquipmentAlarm, 'empty'>,
  { label: string; ink: string; bg: string; border: string }
> = {
  overdue_session: {
    label: 'KONTROLL FÖRSENAD',
    ink: '#f87171',
    bg: 'rgba(239,68,68,.10)',
    border: 'rgba(239,68,68,.45)',
  },
  activity_high: {
    label: 'HÖG AKTIVITET',
    ink: '#f87171',
    bg: 'rgba(239,68,68,.10)',
    border: 'rgba(239,68,68,.45)',
  },
  stale: {
    label: 'EJ KONTROLLERAD',
    ink: '#fbbf24',
    bg: 'rgba(245,158,11,.10)',
    border: 'rgba(245,158,11,.45)',
  },
  activity: {
    label: 'AKTIVITET',
    ink: '#fbbf24',
    bg: 'rgba(245,158,11,.10)',
    border: 'rgba(245,158,11,.45)',
  },
  // Neutral med flit: arbetet har inte börjat, det är inte ett fel
  never: {
    label: 'EJ PÅBÖRJAD',
    ink: '#94a3b8',
    bg: 'rgba(100,116,139,.12)',
    border: 'rgba(100,116,139,.40)',
  },
  ok: {
    label: 'UTAN ANMÄRKNING',
    ink: '#34d399',
    bg: 'rgba(32,197,143,.10)',
    border: 'rgba(32,197,143,.45)',
  },
}

/**
 * Larmmärke — samma familj som ContractStatusMark: dubbelram, brusig kant,
 * horisontell och oroterad. Motivet är en klämbräda: bock när allt är i
 * ordning, streck när inget påbörjats, utropstecken när något kräver åtgärd.
 */
export function StationAlarmMark({
  kind,
  subLabel,
}: {
  kind: Exclude<EquipmentAlarm, 'empty'>
  subLabel?: string | null
}) {
  const m = ALARM_SPEC[kind]
  const uid = useId().replace(/:/g, '')
  const w = 168
  const h = subLabel ? 34 : 22

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w * 2} ${h * 2}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={`${m.label.toLowerCase()}${subLabel ? `, ${subLabel}` : ''}`}
    >
      <defs>
        <filter id={`${uid}-rough`} x="-8%" y="-20%" width="116%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`}>
        <rect x="1.5" y="1.5" width={w * 2 - 3} height={h * 2 - 3} rx="5" fill={m.bg} stroke={m.border} strokeWidth="2.4" />
        <rect x="6" y="6" width={w * 2 - 12} height={h * 2 - 12} rx="3" fill="none" stroke={m.border} strokeWidth="1" opacity="0.55" />
      </g>
      {/* Klämbräda — samma motiv som tidslinjens inspektionsmarkör */}
      <g
        transform={`translate(12 ${h - 9}) scale(0.85)`}
        stroke={m.ink}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 2.5 H14 V17 H2 Z" />
        <path d="M5.5 0.5 H10.5 V3 H5.5 Z" fill={`${m.ink}55`} />
        {kind === 'ok' ? (
          <path d="M5 10 L7 12 L11.5 7.5" strokeWidth="1.8" />
        ) : kind === 'never' ? (
          <path d="M5.5 10.5 H10.5" strokeWidth="1.8" />
        ) : (
          <path d="M8 6.5 V11 M8 13.6 V13.8" strokeWidth="1.9" />
        )}
      </g>
      <text
        x="42"
        y={subLabel ? h * 0.95 : h + 5}
        fill={m.ink}
        fontSize="15"
        fontWeight="800"
        letterSpacing="1.8"
        fontFamily="ui-sans-serif, system-ui, 'Inter', sans-serif"
      >
        {m.label}
      </text>
      {subLabel && (
        <text
          x="42"
          y={h * 1.62}
          fill={m.ink}
          opacity="0.8"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.8"
          fontFamily="ui-sans-serif, system-ui, 'Inter', sans-serif"
        >
          {subLabel}
        </text>
      )}
    </svg>
  )
}

/** Tomt tillstånd: en station utan mark under sig. */
export function NoEquipmentIllustration({ className = '' }: { className?: string }) {
  return (
    <svg width="118" height="92" viewBox="0 0 118 92" fill="none" aria-hidden className={className}>
      {/* Marklinjen — streckad, inget utplacerat */}
      <path d="M12 74 H106" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
      {/* Stationen, tom och öppen */}
      <g transform="translate(40 34)">
        <path d="M2 8 H36 V30 H2 Z" fill="#0f172a" stroke="#475569" strokeWidth="1.8" strokeLinejoin="round" />
        {/* Locket på glänt */}
        <path d="M2 8 L19 0 L36 8" fill="none" stroke="#475569" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 19 H26" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* Kartnål utan position */}
      <g transform="translate(84 20)" opacity="0.4">
        <path
          d="M8 22 C8 22 15 14.5 15 9 A7 7 0 1 0 1 9 C1 14.5 8 22 8 22 Z"
          fill="none"
          stroke="#20c58f"
          strokeWidth="1.6"
          strokeDasharray="3 3"
        />
      </g>
    </svg>
  )
}

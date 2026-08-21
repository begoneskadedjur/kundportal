// src/components/admin/customers/record/ContractGlyphs.tsx
//
// Tecknade avtalsobjekt för kundsidans mörka flikar.
//
// Avtalskartans papper är dagsljus: ljust ark, bläck, gummistämpel. Här är det
// kväll — samma objekt, graverade i mörkret: linjer lyser, ytor är djupa.
// Släkt med ContractStamp (samma dubbelram, samma tre tillstånd, samma
// brusfilter) utan att vara pappersbundet.
//
// Filter-id:n görs unika per instans med useId — annars ärver alla monterade
// glyfer den först renderade instansens filter.

import { useId } from 'react'
import type { ContractState } from '../../../../utils/contractLifecycle'

export type ContractGlyphState = 'active' | 'terminated' | 'ended'

/** Livscykelns tre tillstånd → glyfens tre. En enda mappning, inga if-kedjor. */
export const GLYPH_BY_STATE: Record<ContractState, ContractGlyphState> = {
  active: 'active',
  'terminated-running': 'terminated',
  ended: 'ended',
}

const GLYPH_INK: Record<
  ContractGlyphState,
  { stroke: string; sheet: string; fold: string; seal: string; line: string }
> = {
  // Aktivt: brandgrönt sigill, arket lyser svagt.
  active: { stroke: '#20c58f', sheet: '#20c58f', fold: '#0f2a22', seal: '#20c58f', line: '#20c58f' },
  // Uppsagt men löpande: bärnsten. Avtalet FUNGERAR, men det tar slut.
  terminated: { stroke: '#f59e0b', sheet: '#f59e0b', fold: '#2a2010', seal: '#f59e0b', line: '#f59e0b' },
  // Avslutat: neutral grå. Inget att åtgärda, ingen färg som ropar.
  ended: { stroke: '#94a3b8', sheet: '#64748b', fold: '#1e293b', seal: '#64748b', line: '#64748b' },
}

interface SealProps {
  state?: ContractGlyphState
  size?: number
  /** Egen accentfärg — låt kortet matcha avtalskartans ACCENTS när det behövs */
  color?: string
  className?: string
  /** Sätt bara när glyfen står ensam utan text bredvid */
  title?: string
}

/**
 * Avtal som objekt: ark med vikt hörn, textrader och ett sigill.
 * Under 32px döljs textraderna — ark + sigill bär betydelsen ändå.
 */
export function ContractSeal({ state = 'active', size = 40, color, className = '', title }: SealProps) {
  const ink = GLYPH_INK[state]
  const accent = color ?? ink.seal
  const uid = useId().replace(/:/g, '')
  const showLines = size >= 32

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${uid}-sheet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ink.sheet} stopOpacity="0.16" />
          <stop offset="100%" stopColor={ink.sheet} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Arket. Hörnet uppe till höger är BORTA ur pathen — viket fyller det. */}
      <path
        d="M8 4.5 H25.5 L33 12 V34 Q33 36 31 36 H10 Q8 36 8 34 Z"
        fill={`url(#${uid}-sheet)`}
        stroke={ink.stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity={state === 'ended' ? 0.75 : 1}
      />
      {/* Vikt hörn: skuggad undersida + lysande vikkant */}
      <path d="M25.5 4.5 V12 H33 Z" fill={ink.fold} />
      <path
        d="M25.5 4.5 V12 H33"
        stroke={ink.stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
        opacity={state === 'ended' ? 0.75 : 1}
      />

      {/* Textrader — ojämna längder, annars läser det som streckkod */}
      {showLines && (
        <g stroke={ink.line} strokeWidth="1.5" strokeLinecap="round" opacity="0.45">
          <line x1="12.5" y1="17.5" x2="27.5" y2="17.5" />
          <line x1="12.5" y1="21.5" x2="24" y2="21.5" />
          <line x1="12.5" y1="25.5" x2="26" y2="25.5" />
        </g>
      )}

      {/* Sigill: dubbelring + bandsvansar. Samma dubbelram som ContractStamp. */}
      <g transform="translate(26.5 27.5)">
        <circle r="7.2" fill="#0f172a" />
        <circle r="7.2" fill={accent} fillOpacity="0.2" />
        <circle r="7.2" stroke={accent} strokeWidth="1.5" fill="none" />
        <circle r="4.5" stroke={accent} strokeWidth="0.9" fill="none" opacity="0.65" />
        <path d="M-2.6 6.6 L-4 11 L-1.2 9.6 Z" fill={accent} opacity="0.8" />
        <path d="M2.6 6.6 L4 11 L1.2 9.6 Z" fill={accent} opacity="0.8" />
        {state === 'active' && (
          <path
            d="M-2.2 0.2 L-0.6 2 L2.4 -1.8"
            stroke={accent}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {state === 'terminated' && (
          <path d="M-2.3 0 H2.3" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />
        )}
        {state === 'ended' && (
          <path d="M-2 -2 L2 2 M2 -2 L-2 2" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        )}
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------

const MARK: Record<ContractGlyphState, { label: string; ink: string; bg: string; border: string }> = {
  active: { label: 'AKTIVT', ink: '#34d399', bg: 'rgba(32,197,143,.10)', border: 'rgba(32,197,143,.45)' },
  terminated: { label: 'UPPSAGT', ink: '#fbbf24', bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.45)' },
  ended: { label: 'AVSLUTAT', ink: '#94a3b8', bg: 'rgba(100,116,139,.12)', border: 'rgba(100,116,139,.40)' },
}

/**
 * Statusmärke för avtalskortet — stämpelns lillebror.
 *
 * Dubbelram och brusig kant som ContractStamp, men horisontell och ORÖRD av
 * rotation: en lutad stämpel i en kortrubrik läser som att layouten är trasig.
 * Bruset är svagare eftersom ytan är liten.
 */
export function ContractStatusMark({
  state,
  subLabel,
}: {
  state: ContractGlyphState
  /** Andra raden, t.ex. "T.O.M. 2026-12-31" */
  subLabel?: string | null
}) {
  const m = MARK[state]
  const uid = useId().replace(/:/g, '')
  const w = subLabel ? 150 : 104
  const h = subLabel ? 34 : 22

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w * 2} ${h * 2}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={`Avtalsstatus: ${m.label.toLowerCase()}${subLabel ? `, ${subLabel.toLowerCase()}` : ''}`}
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

      {/* Glyfen till vänster — samma objekt som ContractSeal, i miniatyr */}
      <g transform={`translate(11 ${h - 8}) scale(0.8)`}>
        <path d="M2 0 H11 L15 4 V18 Q15 20 13 20 H4 Q2 20 2 18 Z" fill="none" stroke={m.ink} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M11 0 V4 H15" fill="none" stroke={m.ink} strokeWidth="1.6" strokeLinejoin="round" />
        {state === 'active' && (
          <path d="M5.5 12.5 L7.5 14.5 L11.5 9.5" stroke={m.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )}
        {state === 'terminated' && <path d="M5.5 12 H11.5" stroke={m.ink} strokeWidth="1.8" strokeLinecap="round" />}
        {state === 'ended' && (
          <path d="M6 10.5 L11 15 M11 10.5 L6 15" stroke={m.ink} strokeWidth="1.6" strokeLinecap="round" />
        )}
      </g>

      <text
        x="40"
        y={subLabel ? h * 0.95 : h + 5}
        fill={m.ink}
        fontFamily="ui-sans-serif, system-ui, 'Inter', sans-serif"
        fontSize="15"
        fontWeight="800"
        letterSpacing="2.4"
      >
        {m.label}
      </text>
      {subLabel && (
        <text
          x="40"
          y={h * 1.62}
          fill={m.ink}
          opacity="0.8"
          fontFamily="ui-sans-serif, system-ui, 'Inter', sans-serif"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.8"
        >
          {subLabel}
        </text>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tidslinjen
// ---------------------------------------------------------------------------

export type TimelineKind =
  | 'start'
  | 'signed'
  | 'addition'
  | 'index'
  | 'terminated'
  | 'notice'
  | 'end'
  | 'invoice'
  | 'premium'
  | 'scope'
  | 'pricelist'
  | 'inspection'

/**
 * Färg och etikett per händelsetyp — en enda sanning för hela tidslinjen.
 * Grönt = bra, bärnsten = varning, rött = avslut, blått = pengar,
 * lila = besök och justeringar.
 */
export const TIMELINE_STYLE: Record<TimelineKind, { color: string; label: string }> = {
  signed: { color: '#20c58f', label: 'Signering' },
  start: { color: '#20c58f', label: 'Avtalsstart' },
  addition: { color: '#34d399', label: 'Avtalstillägg' },
  premium: { color: '#a78bfa', label: 'Premiejustering' },
  index: { color: '#a78bfa', label: 'Indexjustering' },
  pricelist: { color: '#38bdf8', label: 'Prislista' },
  invoice: { color: '#60a5fa', label: 'Faktura' },
  inspection: { color: '#c084fc', label: 'Kontrollbesök' },
  scope: { color: '#38bdf8', label: 'Omfattning' },
  notice: { color: '#f59e0b', label: 'Uppsägningsfrist' },
  end: { color: '#f59e0b', label: 'Periodskifte' },
  terminated: { color: '#ef4444', label: 'Uppsägning' },
}

/**
 * Tidslinjemarkör. Ringen är alltid r=9 i viewBoxen så alla markörer ligger
 * på exakt samma axel — motivet varierar, geometrin aldrig.
 *
 * Tidslinjen byggde redan tolv semantiska händelsetyper men renderade dem
 * identiskt som 2,5px-prickar. All den informationen kastades bort i sista
 * steget.
 */
export function TimelineMarker({
  kind,
  isFuture = false,
  size = 22,
}: {
  kind: TimelineKind
  /** Framtida händelser: ihålig ring med streckad kant */
  isFuture?: boolean
  size?: number
}) {
  const c = TIMELINE_STYLE[kind].color
  const fill = isFuture ? '#0f172a' : `${c}1f`
  const op = isFuture ? 0.6 : 1

  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden className="shrink-0 block">
      <circle
        cx="11"
        cy="11"
        r="9"
        fill={fill}
        stroke={c}
        strokeWidth={isFuture ? 1.2 : 1.6}
        strokeDasharray={isFuture ? '2.6 2.2' : undefined}
        opacity={op}
      />
      <g stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={op}>
        {kind === 'signed' && (
          <>
            {/* Penna som drar en signaturslinga */}
            <path d="M6.5 13.5 Q8.5 9 10 11.5 T13.5 9.5" />
            <path d="M14 13.8 L15.8 12" strokeWidth="1.7" />
          </>
        )}
        {kind === 'start' && (
          <>
            {/* Flagga: här börjar det */}
            <path d="M8 6 V16.5" />
            <path d="M8 6.8 H15 L13 9.4 L15 12 H8 Z" fill={`${c}55`} />
          </>
        )}
        {kind === 'addition' && (
          <>
            <path d="M7 6.5 H12.5 L15 9 V15.5 H7 Z" />
            <path d="M11 10.5 V14 M9.2 12.2 H12.8" />
          </>
        )}
        {(kind === 'premium' || kind === 'index') && (
          /* Trappsteg uppåt — premietrappan bokstavligt */
          <path d="M6 15 H9 V12 H12 V9 H16" />
        )}
        {kind === 'invoice' && (
          <>
            {/* Ark med sågtandad underkant */}
            <path d="M7 6 H15 V15 L13.7 13.9 L12.3 15 L11 13.9 L9.6 15 L8.3 13.9 L7 15 Z" />
            <path d="M9 9 H13 M9 11.3 H12" strokeWidth="1.2" />
          </>
        )}
        {kind === 'inspection' && (
          <>
            {/* Klämbräda */}
            <path d="M7 7.5 H15 V16 H7 Z" />
            <path d="M9.5 6 H12.5 V8 H9.5 Z" fill={`${c}55`} />
            <path d="M9 11.5 L10.4 13 L13.2 10" strokeWidth="1.4" />
          </>
        )}
        {kind === 'scope' && (
          <>
            {/* Kartnål: en enhet ansluter eller lämnar */}
            <path d="M11 16 C11 16 15 12.4 15 10 A4 4 0 1 0 7 10 C7 12.4 11 16 11 16 Z" />
            <circle cx="11" cy="10" r="1.5" fill={c} stroke="none" />
          </>
        )}
        {kind === 'pricelist' && (
          <>
            {/* Prislapp med hål */}
            <path d="M11.5 6 H16 V10.5 L10 16.5 L5.5 12 Z" />
            <circle cx="13.6" cy="8.4" r="1.1" />
          </>
        )}
        {kind === 'notice' && (
          <>
            {/* Klocka: sista uppsägningsdag */}
            <circle cx="11" cy="11.4" r="4.6" />
            <path d="M11 8.8 V11.6 L13 12.8" />
          </>
        )}
        {kind === 'end' && (
          <>
            {/* Cirkelpil: perioden rullar vidare om ingen säger upp */}
            <path d="M15.4 11 A4.4 4.4 0 1 1 13.6 7.5" />
            <path d="M13.2 5 L14 7.8 L11.2 8.2" />
          </>
        )}
        {kind === 'terminated' && (
          <>
            {/* Brutet ark: avtalet upphör */}
            <path d="M7 6.5 H12.5 L15 9 V15.5 H7 Z" />
            <path d="M13.8 6.4 L8.2 15.8" strokeWidth="1.8" />
          </>
        )}
      </g>
    </svg>
  )
}

/** Tomt tillstånd: två tomma ark och ett obrutet sigill. */
export function EmptyContractsIllustration({ className = '' }: { className?: string }) {
  return (
    <svg width="132" height="104" viewBox="0 0 132 104" fill="none" aria-hidden className={className}>
      {/* Bakre ark, lätt lutat */}
      <g transform="rotate(-7 46 54)" opacity="0.4">
        <path
          d="M22 22 H62 L76 36 V86 Q76 90 72 90 H26 Q22 90 22 86 Z"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </g>
      {/* Främre ark */}
      <path
        d="M42 14 H86 L102 30 V84 Q102 88 98 88 H46 Q42 88 42 84 Z"
        fill="#0f172a"
        stroke="#475569"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M86 14 V30 H102 Z" fill="#1e293b" />
      <path d="M86 14 V30 H102" fill="none" stroke="#475569" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Streckade rader: här ska text stå, men gör det inte */}
      <g stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 5">
        <line x1="52" y1="44" x2="90" y2="44" />
        <line x1="52" y1="54" x2="82" y2="54" />
        <line x1="52" y1="64" x2="88" y2="64" />
      </g>
      {/* Obrutet sigill — vilande, inte stämplat */}
      <g transform="translate(94 74)">
        <circle r="12" fill="#0f172a" stroke="#20c58f" strokeWidth="1.6" strokeOpacity="0.45" strokeDasharray="3.5 3" />
        <path
          d="M-4 0 L-1 3.2 L4.4 -3.2"
          stroke="#20c58f"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.45"
        />
      </g>
    </svg>
  )
}

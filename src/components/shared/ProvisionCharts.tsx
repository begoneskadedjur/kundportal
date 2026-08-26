// src/components/shared/ProvisionCharts.tsx
//
// Tre små inline-SVG-visualiseringar för provisionsvyerna. Inga bibliotek:
// diagrammen är så små och så många att en chart-lib bara skulle kosta bundle
// och ge oss stilar vi ändå måste skriva över.
//
// Designregler (samma som resten av portalen):
//  - mörkt tema, brandgrönt #20c58f som enda accentfärg
//  - tunna streck, recessiv gråska (slate) för allt som inte är datat självt
//  - inga piller, siffror i tabular-nums
//  - dekorativ SVG är aria-hidden; betydelsen står i texten runt omkring.
//    Där en siffra bara finns i grafiken (ProgressRing) exponeras den i stället
//    som text i mitten, så den läses av skärmläsare.

const BRAND = '#20c58f'
const TRACK = '#334155'   // slate-700
const LINE = '#64748b'    // slate-500

// ────────────────────────────────────────────────────────────
// Sparkline
// ────────────────────────────────────────────────────────────

export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Tooltip på wrappern (grafiken själv är aria-hidden) */
  title?: string
  className?: string
}

/**
 * Minimal trendlinje: 1,5px slate-linje + fylld brandgrön punkt på sista värdet.
 * Tål tomma serier, ett enda värde och helt platta serier utan att ge NaN
 * (platt serie ritas som en linje mitt i ytan).
 */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  title,
  className
}: SparklineProps) {
  const clean = (values || []).filter(v => Number.isFinite(v))

  // Inget att rita: behåll ytan så layouten inte hoppar när data saknas
  if (clean.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={TRACK}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const pad = 2
  const innerW = Math.max(1, width - pad * 2)
  const innerH = Math.max(1, height - pad * 2)

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min

  const x = (i: number) =>
    clean.length === 1 ? pad + innerW / 2 : pad + (i / (clean.length - 1)) * innerW

  // Platt serie (span 0) → mittlinje, aldrig division med noll
  const y = (v: number) =>
    span === 0 ? pad + innerH / 2 : pad + innerH - ((v - min) / span) * innerH

  const points = clean.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const lastX = x(clean.length - 1)
  const lastY = y(clean[clean.length - 1])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {clean.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke={LINE}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={lastX} cy={lastY} r={3} fill={BRAND} />
    </svg>
  )
}

// ────────────────────────────────────────────────────────────
// FlowBand
// ────────────────────────────────────────────────────────────

export type FlowTone = 'brand' | 'amber' | 'slate' | 'dim'

const TONE_FILL: Record<FlowTone, string> = {
  brand: BRAND,
  amber: '#f59e0b',
  slate: '#64748b',
  dim: '#334155'
}

export interface FlowSegment {
  label: string
  value: number
  tone: FlowTone
}

export interface FlowBandProps {
  segments: FlowSegment[]
  width?: number
  height?: number
  /** Visa etiketter under bandet (9px) */
  showLabels?: boolean
  title?: string
  className?: string
}

/**
 * Horisontellt flödesband: ett segment per status, bredd proportionell mot
 * value, 2px mellanrum och rundade hörn. Visar fördelningen i en rad utan att
 * ta plats som ett diagram.
 *
 * Segment med value <= 0 hoppas över. Är allt noll ritas ett tomt spår.
 */
export function FlowBand({
  segments,
  width = 160,
  height = 6,
  showLabels = false,
  title,
  className
}: FlowBandProps) {
  const usable = (segments || []).filter(s => Number.isFinite(s.value) && s.value > 0)
  const total = usable.reduce((sum, s) => sum + s.value, 0)

  const gap = 2
  const radius = Math.min(3, height / 2)

  // Tomt spår när det inte finns något att fördela
  if (total <= 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <rect x={0} y={0} width={width} height={height} rx={radius} fill={TRACK} />
      </svg>
    )
  }

  const gapTotal = gap * Math.max(0, usable.length - 1)
  const barW = Math.max(1, width - gapTotal)

  let cursor = 0
  const rects = usable.map((seg, i) => {
    const w = Math.max(1, (seg.value / total) * barW)
    const x = cursor
    cursor += w + gap
    return { key: `${seg.label}-${i}`, x, w, seg }
  })

  const labelHeight = showLabels ? 12 : 0
  const totalHeight = height + labelHeight

  return (
    <svg
      width={width}
      height={totalHeight}
      viewBox={`0 0 ${width} ${totalHeight}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {rects.map(({ key, x, w, seg }) => (
        <rect
          key={key}
          x={x}
          y={0}
          width={w}
          height={height}
          rx={radius}
          fill={TONE_FILL[seg.tone] ?? TONE_FILL.slate}
        />
      ))}
      {showLabels &&
        rects.map(({ key, x, w, seg }) => (
          <text
            key={`label-${key}`}
            x={x + w / 2}
            y={height + 9}
            textAnchor="middle"
            fontSize={9}
            fill="#94a3b8"
          >
            {seg.label}
          </text>
        ))}
    </svg>
  )
}

// ────────────────────────────────────────────────────────────
// ProgressRing
// ────────────────────────────────────────────────────────────

export interface ProgressRingProps {
  /** Andel 0..1 (klampas) */
  value: number
  size?: number
  stroke?: number
  title?: string
  className?: string
}

/**
 * Andelsring: slate-700-spår + brandgrön båge, procenttalet i mono i mitten.
 * Bågen startar kl 12 och går medurs.
 */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  title,
  className
}: ProgressRingProps) {
  const safe = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const percent = Math.round(safe * 100)

  const r = Math.max(1, (size - stroke) / 2)
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title || `${percent} procent`}
      focusable="false"
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={BRAND}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(circumference * safe).toFixed(2)} ${circumference.toFixed(2)}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={Math.max(9, Math.round(size * 0.26))}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        fill="#e2e8f0"
      >
        {percent}%
      </text>
    </svg>
  )
}

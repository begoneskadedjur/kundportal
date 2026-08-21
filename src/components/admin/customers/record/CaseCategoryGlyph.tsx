// src/components/admin/customers/record/CaseCategoryGlyph.tsx
//
// Tecknade objekt för ärendekategorierna. Samma hantverk som ContractStamp:
// egna paths, brusfilter som bryter upp linjerna, inga ikonbibliotek i
// illustrationsrollen (lucide används fortfarande för små UI-affordanser).
//
// Filter-id:n måste vara unika per monterad instans — annars kolliderar de när
// flera glyfer renderas samtidigt och alla får den först monterade instansens
// filter.

import { useId } from 'react'

/** Polär → kartesisk för bågbyggaren nedan. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

/** SVG-bågsträng mellan två vinklar. */
function describeArc(cx: number, cy: number, r: number, from: number, to: number): string {
  if (to - from >= 360) {
    // Full cirkel går inte att uttrycka med en enda båge
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
  }
  const s = polar(cx, cy, r, from)
  const e = polar(cx, cy, r, to)
  const large = to - from > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

/**
 * Kontrollcykel: besökspunkterna på ett år. Utförda är fyllda, försenade
 * bärnsten, kommande ihåliga — hjulet visar direkt hur långt kunden kommit.
 */
export function RecurringGlyph({
  total = 4,
  done = 0,
  late = 0,
  size = 68,
}: {
  total?: number
  done?: number
  late?: number
  size?: number
}) {
  const uid = useId().replace(/:/g, '')
  const n = Math.max(2, Math.min(12, total || 4))
  const R = 26
  const cx = 34
  const cy = 34
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), i }
  })
  const doneClamped = Math.min(done, n)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 68 68"
      role="img"
      aria-label={`Kontrollcykel: ${done} av ${total} besök utförda`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.1"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`}>
        {/* Årsringen — bruten båge, inte en perfekt cirkel */}
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="#334155"
          strokeWidth="1.6"
          strokeDasharray="3 5"
          strokeLinecap="round"
        />
        {/* Utförd sträcka */}
        {doneClamped > 0 && (
          <path
            d={describeArc(cx, cy, R, 0, (doneClamped / n) * 360)}
            fill="none"
            stroke="#20c58f"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {pts.map((p) => {
          const isDone = p.i < doneClamped
          const isLate = p.i >= doneClamped && p.i < doneClamped + late
          return (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={isDone ? 4 : 3.2}
              fill={isDone ? '#20c58f' : isLate ? '#fbbf24' : '#0f172a'}
              stroke={isDone ? '#20c58f' : isLate ? '#fbbf24' : '#475569'}
              strokeWidth="1.6"
            />
          )
        })}
        {/* Navet: en betesstation, inte en generisk punkt */}
        <rect x={cx - 6} y={cy - 5} width="12" height="10" rx="2" fill="none" stroke="#64748b" strokeWidth="1.5" />
        <path d={`M ${cx - 3} ${cy} h 6`} stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/**
 * Extraärende: avtalslinjen med en gren som bryter ut. Bilden säger
 * "utanför det avtalade" utan ett ord.
 */
export function ExtraGlyph({ count = 0, size = 68 }: { count?: number; size?: number }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 68 68"
      role="img"
      aria-label={`Extraärenden: ${count} stycken`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`}>
        {/* Avtalslinjen — den stadiga grundtakten */}
        <path
          d="M 8 46 C 20 46 24 46 34 46 C 44 46 48 46 60 46"
          fill="none"
          stroke="#334155"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {[14, 27, 41, 54].map((x) => (
          <circle key={x} cx={x} cy="46" r="2.6" fill="#334155" />
        ))}
        {/* Utbrytningen */}
        <path
          d="M 34 46 C 34 34 38 26 46 18"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="46" cy="18" r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.2" />
        <path d="M 46 15.4 v 5.2 M 43.4 18 h 5.2" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Etablering: stationer som placeras ut över en yta vid avtalsstart. */
export function EstablishmentGlyph({ size = 68 }: { size?: number }) {
  const uid = useId().replace(/:/g, '')
  const stations: [number, number][] = [
    [16, 22],
    [30, 16],
    [46, 24],
    [22, 38],
    [38, 40],
    [52, 36],
  ]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 68 68"
      role="img"
      aria-label="Etablering: utplacering av stationer"
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="19" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`}>
        {/* Tomtgränsen — handdragen, inte en rect */}
        <path
          d="M 9 12 L 58 10 L 60 50 L 11 53 Z"
          fill="none"
          stroke="#334155"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeLinejoin="round"
        />
        {stations.map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 4} y={y - 3} width="8" height="6.5" rx="1.6" fill="#0f172a" stroke="#a78bfa" strokeWidth="1.5" />
            <path d={`M ${x - 2} ${y + 0.4} h 4`} stroke="#a78bfa" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        ))}
        <circle cx="34" cy="28" r="1.8" fill="#a78bfa" opacity="0.5" />
      </g>
    </svg>
  )
}

/** Missat besök: kalenderfält med en obockad ruta. Används i varningsband. */
export function MissedGlyph({ tone = '#f59e0b', size = 44 }: { tone?: string; size?: number }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label="Missat besök"
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-rough`} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`} opacity="0.85">
        <path d="M 8 12 L 36 11 L 37 35 L 9 36 Z" fill="none" stroke={tone} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M 8 18 L 37 17" stroke={tone} strokeWidth="1.5" />
        <path d="M 14 8 v 6 M 30 8 v 6" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
        {/* Den obockade rutan */}
        <path d="M 18 24 h 9 v 7 h -9 Z" fill="none" stroke={tone} strokeWidth="1.6" strokeDasharray="2.5 2.5" />
      </g>
    </svg>
  )
}

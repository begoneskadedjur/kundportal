// src/components/shared/stations/StationTypeTile.tsx
// Färgad ruta med stationstypens ikon (skissen "Stationskontroll före och efter",
// TypIkon). Fyllningen är typens färg (station_types.color) och ikonen ritas
// vit ur samma register som kartans markörer (src/shared/stationMarkers.ts via
// StationIcon), så att listan, modalen och kartan visar samma symbol.
// Tillägg utöver avtal får en lila plusbricka i övre högra hörnet.

import { StationIcon } from '../stationIcons'

export type StationTypeTileSize = 32 | 40 | 44 | 56

export interface StationTypeTileProps {
  /** Typens färg, t.ex. station_types.color. Saknas den blir rutan grå. */
  color?: string | null
  /** Ikonnyckel (station_types.icon, eller produktens articles.icon). Okänd blir Låda. */
  icon?: string | null
  size?: StationTypeTileSize
  /** Tillägg utöver avtal: lila plusbricka */
  addon?: boolean
  /** Skärmläsartext för rutan, t.ex. typens namn. Utan den är rutan dekorativ. */
  title?: string
  className?: string
}

const FALLBACK_COLOR = '#6b7280'

export default function StationTypeTile({
  color,
  icon,
  size = 40,
  addon = false,
  title,
  className = '',
}: StationTypeTileProps) {
  const glyph = Math.round(size * 0.55)
  const radius = Math.round(size * 0.25)
  const badge = size >= 56 ? 20 : 16

  return (
    <span
      className={`relative inline-flex flex-shrink-0 items-center justify-center border border-white/20 text-[#fff] ${className}`}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: color || FALLBACK_COLOR }}
      {...(title ? { role: 'img', 'aria-label': addon ? `${title}, tillägg` : title } : { 'aria-hidden': true })}
    >
      <span style={{ width: glyph, height: glyph }} className="block">
        <StationIcon name={icon || 'box'} className="w-full h-full" />
      </span>
      {addon && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-[#8b5cf6] border-2 border-slate-900 text-[#fff]"
          style={{ width: badge, height: badge, right: -4, top: -4 }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width={badge - 6} height={badge - 6} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      )}
    </span>
  )
}

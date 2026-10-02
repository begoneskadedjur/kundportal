// src/components/shared/equipment/MarkerGuide.tsx
// Förklaring av stationsmarkörerna i personalens kartor: samma SVG som kartan
// ritar (stationMarkerSvg), så att förklaringen aldrig visar något annat än
// det teknikern ser. Används i Utrustning › Karta och vid utplacering.

import { HelpCircle } from 'lucide-react'
import { stationMarkerSvg } from './stationMarkerIcon'
import { stationIconPaths } from '../stationIcons'

interface SymbolProps {
  color: string
  icon?: string | null
  stroke?: string
  strokeWeight?: number
  addon?: boolean
  ring?: boolean
  badge?: string | null
  label?: string
  opacity?: number
  /** Cirkelns radie i px */
  radius?: number
}

/** En markör precis som på kartan, som inline-SVG. */
export function MarkerSymbol({
  color,
  icon,
  stroke = '#ffffff',
  strokeWeight = 2,
  addon = false,
  ring = false,
  badge = null,
  label,
  opacity = 1,
  radius = 10,
}: SymbolProps) {
  const { svg, size, height } = stationMarkerSvg({
    fill: color,
    fillOpacity: opacity,
    stroke,
    strokeWeight,
    radius,
    addon,
    ring,
    iconPaths: label ? null : stationIconPaths(icon),
    badge,
  })
  const withLabel = label
    ? svg.replace(
        '</svg>',
        `<text x="${size / 2}" y="${size / 2 + radius * 0.4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${radius}" font-weight="700" fill="#ffffff">${label}</text></svg>`
      )
    : svg
  return (
    <span
      className="inline-block flex-shrink-0"
      style={{ width: size, height }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: withLabel }}
    />
  )
}

function Row({ symbol, title, text }: { symbol: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-9 flex justify-center pt-0.5">{symbol}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-200 leading-snug">{title}</p>
        <p className="text-xs text-slate-500 leading-snug mt-0.5">{text}</p>
      </div>
    </div>
  )
}

const STATUS: Array<{ stroke: string; fill?: string; label?: string; text: string; opacity?: number }> = [
  { stroke: '#ffffff', text: 'Normal' },
  { stroke: '#22c55e', fill: '#22c55e', label: '✓', text: 'Kontrollerad i rundan' },
  { stroke: '#f59e0b', label: '?', text: 'Saknas' },
  { stroke: '#ef4444', label: '!', text: 'Skadad' },
  { stroke: '#64748b', label: '✕', text: 'Borttagen', opacity: 0.5 },
  { stroke: '#3b82f6', text: 'Markerad' },
]

/**
 * "Så läser du kartan". Hopfälld som standard; open gör den öppen från start.
 * exampleColor/exampleIcon styr exempelmarkören, gärna en typ som finns på kartan.
 */
export function MarkerGuide({
  open = false,
  exampleColor = '#3b82f6',
  exampleIcon = 'aurotrap',
  showClusters = true,
}: {
  open?: boolean
  exampleColor?: string
  exampleIcon?: string
  showClusters?: boolean
}) {
  return (
    <details open={open} className="group rounded-xl border border-slate-700/60 bg-slate-900/30">
      <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none text-sm text-slate-300 hover:text-white">
        <HelpCircle className="w-4 h-4 text-slate-400" />
        <span className="flex-1">Så läser du kartan</span>
        <span className="text-slate-500 text-xs group-open:hidden">Visa</span>
        <span className="text-slate-500 text-xs hidden group-open:inline">Dölj</span>
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <Row
          symbol={<MarkerSymbol color={exampleColor} />}
          title="Färgen är stationstypen"
          text="Samma färg som i listan med typer."
        />
        <Row
          symbol={<MarkerSymbol color={exampleColor} icon={exampleIcon} />}
          title="Ikonen är produkten"
          text="Har stationen ingen produkt med ikon visas typens ikon."
        />
        <Row
          symbol={<MarkerSymbol color={exampleColor} icon={exampleIcon} addon />}
          title="Plusbrickan betyder tillägg"
          text="Stationen ligger utöver avtalet."
        />
        <Row
          symbol={<MarkerSymbol color={exampleColor} icon={exampleIcon} badge="12" />}
          title="Brickan under är stationsnumret"
          text="Visas när kartan numrerar stationerna, till exempel i kontrollrundan."
        />
        {showClusters && (
          <Row
            symbol={
              <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                <circle cx="13" cy="13" r="12" fill="#0f172a" stroke="#fff" strokeWidth="1.2" />
                <path d="M13 3.5 A9.5 9.5 0 0 1 22.5 13" fill="none" stroke="#6b7280" strokeWidth="4" />
                <path d="M22.5 13 A9.5 9.5 0 0 1 6 19.7" fill="none" stroke="#3b82f6" strokeWidth="4" />
                <path d="M6 19.7 A9.5 9.5 0 0 1 13 3.5" fill="none" stroke="#06b6d4" strokeWidth="4" />
                <text x="13" y="16.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">42</text>
              </svg>
            }
            title="Ringen runt en grupp visar typerna i den"
            text="Zooma in för att se de enskilda stationerna."
          />
        )}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1.5">Kanten och tecknet visar status</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {STATUS.map((s) => (
              <div key={s.text} className="flex items-center gap-2 text-xs text-slate-300">
                <MarkerSymbol
                  color={s.fill ?? '#475569'}
                  stroke={s.stroke}
                  strokeWeight={s.stroke === '#ffffff' ? 2 : 2.5}
                  label={s.label}
                  opacity={s.opacity ?? 1}
                  radius={8}
                />
                {s.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}

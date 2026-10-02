// src/shared/reportStationMarkers.ts
// Stationsmarkörer och teckenförklaring för kundrapporterna (kontrollrapport,
// stationskarta, utrustnings-PDF). Samma markör som kunden ser i appen:
// cirkel i stationstypens färg, typens ikon i vitt, numret i en mörk bricka
// under cirkeln, vit plusbricka för tillägg och status som kantfärg + symbol.
// Rapporterna visar ALDRIG produktens ikon, bara stationstypens.
// Ren TypeScript utan React och DOM, så att både servern (api/) och
// webbläsaren (jsPDF) kan använda den.

import { stationIconPaths, stationMarkerSvg } from './stationMarkers'

export interface ReportStatusStyle {
  stroke: string
  label: string
  /** Symbolen i cirkeln i stället för ikonen */
  symbol: '?' | '!' | 'x'
}

/** Statusar som visas på markören. Aktiv station har vit kant och typens ikon. */
export const REPORT_STATUS_STYLES: Record<string, ReportStatusStyle> = {
  missing: { stroke: '#f59e0b', label: 'Saknas', symbol: '?' },
  damaged: { stroke: '#ef4444', label: 'Skadad', symbol: '!' },
  removed: { stroke: '#64748b', label: 'Borttagen', symbol: 'x' },
}

/** Ordning i teckenförklaringen */
const STATUS_ORDER = ['missing', 'damaged', 'removed']

export const REPORT_FALLBACK_COLOR = '#64748b'

export interface ReportMarkerInput {
  /** Stationstypens färg */
  color: string | null | undefined
  /** Stationstypens ikon (station_types.icon), aldrig produktens */
  icon?: string | null
  /** Stationens status (active, missing, damaged, removed) */
  status?: string | null
  /** Tillägg utöver avtal */
  addon?: boolean | null
  /** Numret i brickan under cirkeln, samma numrering som rapportens tabeller */
  number?: string | number | null
  /** Cirkelns radie i px (standard 11) */
  radius?: number
}

export interface ReportMarker {
  svg: string
  size: number
  height: number
  center: number
}

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i

function safeColor(color: string | null | undefined): string {
  return color && HEX.test(color.trim()) ? color.trim() : REPORT_FALLBACK_COLOR
}

function symbolMarkup(symbol: ReportStatusStyle['symbol'], c: number, radius: number): string {
  if (symbol === 'x') {
    const a = radius * 0.42
    return `<path d="M${c - a} ${c - a}L${c + a} ${c + a}M${c + a} ${c - a}L${c - a} ${c + a}" stroke="#ffffff" stroke-width="${Math.max(2, radius * 0.22)}" stroke-linecap="round"/>`
  }
  const fs = Math.round(radius * 1.25 * 10) / 10
  return `<text x="${c}" y="${c + fs * 0.36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="700" fill="#ffffff">${symbol}</text>`
}

/** SVG-markören för en station i en kundrapport. */
export function reportMarkerSvg(input: ReportMarkerInput): ReportMarker {
  const radius = input.radius ?? 11
  const statusStyle = input.status ? REPORT_STATUS_STYLES[input.status] : undefined
  const removed = input.status === 'removed'
  const badge = input.number !== null && input.number !== undefined && input.number !== ''
    ? String(input.number).replace(/[^0-9A-Za-z\-.]/g, '')
    : null
  const marker = stationMarkerSvg({
    fill: safeColor(input.color),
    fillOpacity: removed ? 0.45 : 1,
    stroke: statusStyle ? statusStyle.stroke : '#ffffff',
    strokeWeight: statusStyle ? 3 : 2,
    radius,
    addon: input.addon === true && !removed,
    iconPaths: statusStyle ? null : stationIconPaths(input.icon),
    badge,
  })
  if (!statusStyle) return marker
  const svg = marker.svg.replace(/<\/svg>$/, `${symbolMarkup(statusStyle.symbol, marker.center, radius)}</svg>`)
  return { ...marker, svg: removed ? svg.replace('<svg ', '<svg opacity="0.75" ') : svg }
}

/** Markören som data-URI, för Google Maps-ikoner och bilder. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// ------------------------------------------------------------------
// Teckenförklaring
// ------------------------------------------------------------------

export interface LegendStation {
  typeName: string
  color: string | null | undefined
  icon?: string | null
  status?: string | null
  addon?: boolean | null
}

export interface LegendRow {
  kind: 'type' | 'addon' | 'status'
  label: string
  count: number
  marker: ReportMarker
}

/**
 * Raderna i teckenförklaringen: en per stationstyp som finns på kartan
 * (i den ordning typerna först förekommer), sedan tillägg och de statusar
 * som förekommer. Tillägg och status ritas på en neutral grå cirkel.
 */
export function reportLegendRows(stations: LegendStation[], radius = 8): LegendRow[] {
  const types = new Map<string, { color: string | null | undefined; icon?: string | null; count: number }>()
  let addonCount = 0
  const statusCounts = new Map<string, number>()
  for (const s of stations) {
    const t = types.get(s.typeName)
    if (t) t.count++
    else types.set(s.typeName, { color: s.color, icon: s.icon, count: 1 })
    if (s.addon === true && s.status !== 'removed') addonCount++
    if (s.status && REPORT_STATUS_STYLES[s.status]) statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1)
  }
  const rows: LegendRow[] = []
  for (const [name, t] of types) {
    rows.push({ kind: 'type', label: name, count: t.count, marker: reportMarkerSvg({ color: t.color, icon: t.icon, radius }) })
  }
  if (addonCount > 0) {
    rows.push({ kind: 'addon', label: 'Tillägg utöver avtal', count: addonCount, marker: reportMarkerSvg({ color: '#94a3b8', addon: true, radius }) })
  }
  for (const status of STATUS_ORDER) {
    const n = statusCounts.get(status)
    if (!n) continue
    rows.push({ kind: 'status', label: REPORT_STATUS_STYLES[status].label, count: n, marker: reportMarkerSvg({ color: '#94a3b8', status, radius }) })
  }
  return rows
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Kompakt teckenförklaring som HTML (inline-SVG), för rapporter som
 * renderas i Puppeteer. Tom sträng när kartan saknar stationer.
 */
export function reportLegendHtml(stations: LegendStation[], options: { title?: string; fontSize?: string } = {}): string {
  const rows = reportLegendRows(stations)
  if (rows.length === 0) return ''
  const items = rows.map(r =>
    `<span style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">` +
    `<span style="display:inline-block;line-height:0;">${r.marker.svg}</span>` +
    `<span>${escapeText(r.label)} <span style="color:#6b7280;">(${r.count} st)</span></span></span>`
  ).join('')
  const title = options.title ?? 'Teckenförklaring'
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;margin-top:6px;padding:5px 10px;border:1px solid #e5e7eb;border-radius:4px;background:#fafafa;font-size:${options.fontSize ?? '9px'};color:#334155;">` +
    (title ? `<span style="font-weight:600;color:#0f172a;">${escapeText(title)}</span>` : '') +
    items +
    `</div>`
}

// src/components/shared/equipment/stationMarkerIcon.ts
//
// Bygger stationsmarkören som SVG data-URI för google.maps.Marker.
//
// Varför inte SymbolPath.CIRCLE: den kan bara rita EN form med EN fyllning.
// Tilläggsstationer visas med en liten vit plusbricka i övre vänstra kanten,
// utanför cirkeln, och det kräver en riktig SVG. Vi behåller google.maps.Marker
// (inte AdvancedMarkerElement) så att siffran via label, MarkerClusterer och
// dra-för-att-flytta fungerar som förut. labelOrigin läggs i cirkelns mitt.
//
// Ikonerna cachas per kombination av färg, kant, storlek och tillägg så att
// inget ritas om i onödan när kartan uppdaterar markörerna.

export interface StationMarkerSpec {
  /** Fyllning, normalt stationstypens färg */
  fill: string
  fillOpacity: number
  /** Kantfärg, bär status (vit normal, bärnsten saknas, röd skadad, grön kontrollerad, blå markerad) */
  stroke: string
  strokeWeight: number
  /** Cirkelns radie i px, motsvarar tidigare scale på SymbolPath.CIRCLE */
  radius: number
  /** Tillägg utöver avtal: plusbricka i kanten */
  addon: boolean
  /** Produktens ikon (SVG-innehåll ur stationIcons), ritas vit i cirkeln. Bara personalvyer. */
  iconPaths?: string | null
  /** Stationsnumret i en bricka under cirkeln, när ikonen tar cirkelns plats */
  badge?: string | null
  /** Streckad grön ring runt cirkeln: en ny station som inte är sparad än */
  ring?: boolean
}

/** Plusbrickans färger: vit med mörk kontur, lånar ingen typ- eller statusfärg */
export const ADDON_BADGE_FILL = '#ffffff'
export const ADDON_BADGE_INK = '#0f172a'

const cache = new Map<string, google.maps.Icon>()

function badgeRadius(radius: number): number {
  return Math.max(5.5, Math.round(radius * 0.46 * 10) / 10)
}

/**
 * SVG-strängen för en markör. Exporterad så att legenden kan rita samma
 * symbol som kartan visar.
 */
export function stationMarkerSvg(spec: StationMarkerSpec): { svg: string; size: number; height: number; center: number } {
  const { fill, fillOpacity, stroke, strokeWeight, radius, addon, iconPaths, badge, ring } = spec
  const br = badgeRadius(radius)
  const offset = radius * 0.72
  // Halva kanvasen: cirkeln med kant, eller plusbrickan som sticker ut i hörnet
  const ringR = radius + 7
  const half = Math.ceil(Math.max(radius + strokeWeight / 2 + 1, addon ? offset + br + 1.5 : 0, ring ? ringR + 2 : 0))
  const size = half * 2
  const c = half
  // Nummerbrickan under cirkeln gör kanvasen högre nedåt, ankaret står kvar i mitten
  const pillH = 12
  const pillTop = c + radius + strokeWeight / 2 + 1
  const height = badge ? Math.max(size, Math.ceil(pillTop + pillH + 1)) : size

  let body = ring
    ? `<circle cx="${c}" cy="${c}" r="${ringR}" fill="#20c58f" fill-opacity="0.15" stroke="#20c58f" stroke-width="2" stroke-dasharray="4 3"/>`
    : ''
  body += `<circle cx="${c}" cy="${c}" r="${radius}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWeight}"/>`
  if (addon) {
    const bx = c - offset
    const by = c - offset
    const arm = br * 0.52
    body +=
      `<circle cx="${bx}" cy="${by}" r="${br}" fill="${ADDON_BADGE_FILL}" stroke="${ADDON_BADGE_INK}" stroke-width="1.3"/>` +
      `<path d="M${bx - arm} ${by}h${arm * 2}M${bx} ${by - arm}v${arm * 2}" stroke="${ADDON_BADGE_INK}" stroke-width="${Math.max(1.6, br * 0.3)}" stroke-linecap="round"/>`
  }
  if (iconPaths) {
    const sc = (radius * 1.25) / 24
    body += `<g transform="translate(${c - 12 * sc} ${c - 12 * sc}) scale(${sc})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</g>`
  }
  if (badge) {
    const w = Math.max(pillH, 6 + badge.length * 6)
    body +=
      `<rect x="${c - w / 2}" y="${pillTop}" width="${w}" height="${pillH}" rx="${pillH / 2}" fill="#0f172a" fill-opacity="0.9" stroke="#ffffff" stroke-width="1"/>` +
      `<text x="${c}" y="${pillTop + pillH / 2 + 3.2}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#ffffff">${badge}</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}">${body}</svg>`
  return { svg, size, height, center: c }
}

/** Ikon för google.maps.Marker, cachad. */
export function buildStationMarkerIcon(spec: StationMarkerSpec): google.maps.Icon {
  const key = [spec.fill, spec.fillOpacity, spec.stroke, spec.strokeWeight, spec.radius, spec.addon ? 1 : 0, spec.iconPaths ?? '', spec.badge ?? '', spec.ring ? 1 : 0].join('|')
  const hit = cache.get(key)
  if (hit) return hit

  const { svg, size, height, center } = stationMarkerSvg(spec)
  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(center, center),
    labelOrigin: new google.maps.Point(center, center),
  }
  cache.set(key, icon)
  return icon
}

/**
 * Klustermarkör: antalet i mitten och en ring i stationstypernas färger, i
 * proportion till hur många av varje typ klustret döljer. Personalvyer.
 */
export function buildClusterIcon(colors: string[], count: number): google.maps.Icon {
  const tally = new Map<string, number>()
  colors.forEach((c) => tally.set(c, (tally.get(c) ?? 0) + 1))
  const parts = [...tally.entries()].sort((a, b) => b[1] - a[1])
  const r = count > 100 ? 28 : count > 50 ? 24 : count > 10 ? 20 : 16
  const size = (r + 3) * 2
  const c = size / 2
  const R = r - 2.5
  const total = colors.length || 1
  let arcs = ''
  if (parts.length === 1) {
    arcs = `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${ringColor(parts[0][0])}" stroke-width="5"/>`
  } else {
    let a0 = -Math.PI / 2
    for (const [color, n] of parts) {
      const a1 = a0 + (n / total) * Math.PI * 2
      const gap = Math.min(0.06, (a1 - a0) / 3)
      const x0 = c + R * Math.cos(a0 + gap / 2), y0 = c + R * Math.sin(a0 + gap / 2)
      const x1 = c + R * Math.cos(a1 - gap / 2), y1 = c + R * Math.sin(a1 - gap / 2)
      const large = a1 - a0 - gap > Math.PI ? 1 : 0
      arcs += `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${ringColor(color)}" stroke-width="5"/>`
      a0 = a1
    }
  }
  const fontSize = count >= 1000 ? 10 : count >= 100 ? 11 : 12
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="#0f172a" fill-opacity="0.9" stroke="#ffffff" stroke-width="1.5"/>${arcs}` +
    `<text x="${c}" y="${c + fontSize * 0.36}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${count}</text></svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(c, c),
  }
}

/** Mörka typfärger (t.ex. Betesstation #1f2937) syns inte mot klustrets mörka botten. */
function ringColor(color: string): string {
  return color.toLowerCase() === '#1f2937' ? '#94a3b8' : color
}

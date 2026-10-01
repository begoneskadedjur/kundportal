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
  const { fill, fillOpacity, stroke, strokeWeight, radius, addon, iconPaths, badge } = spec
  const br = badgeRadius(radius)
  const offset = radius * 0.72
  // Halva kanvasen: cirkeln med kant, eller plusbrickan som sticker ut i hörnet
  const half = Math.ceil(Math.max(radius + strokeWeight / 2 + 1, addon ? offset + br + 1.5 : 0))
  const size = half * 2
  const c = half
  // Nummerbrickan under cirkeln gör kanvasen högre nedåt, ankaret står kvar i mitten
  const pillH = 12
  const pillTop = c + radius + strokeWeight / 2 + 1
  const height = badge ? Math.max(size, Math.ceil(pillTop + pillH + 1)) : size

  let body = `<circle cx="${c}" cy="${c}" r="${radius}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWeight}"/>`
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
  const key = [spec.fill, spec.fillOpacity, spec.stroke, spec.strokeWeight, spec.radius, spec.addon ? 1 : 0, spec.iconPaths ?? '', spec.badge ?? ''].join('|')
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

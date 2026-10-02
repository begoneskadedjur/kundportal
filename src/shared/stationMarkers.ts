// src/shared/stationMarkers.ts
// Stationsikoner och stationsmarkörer som ren SVG, utan React och utan Google
// Maps. Delas av appen (kartor, listor, förklaringar) och rapportservern
// (kontrollrapport, stationskarta, ärenderapport), så att en ikon ser likadan
// ut överallt. Ikonerna är ritade efter produkterna som står ute (Killgerm-
// katalogen 2026 och tillverkarnas produktblad): 24 × 24, linje 1,75.

/** SVG-innehåll för de egna ikonerna (statiska strängar, inga användardata). */
export const PATHS: Record<string, string> = {
  // Stationstyper
  betesstation: '<path d="M4.2 10 5.6 7h12.8l1.4 3"/><rect x="2" y="10" width="20" height="8" rx="1.5"/><path d="M3.8 18v-1.7a1.5 1.5 0 0 1 3 0V18"/><path d="M17.2 18v-1.7a1.5 1.5 0 0 1 3 0V18"/><circle cx="10" cy="13.2" r=".9"/><circle cx="14" cy="13.2" r=".9"/>',
  betongstation: '<path d="M2.5 19.5h19"/><path d="M4.5 19.5V10l2.5-2.5h10L19.5 10v9.5"/><path d="M4.5 10h15"/><path d="M8 19.5v-2.3a1.7 1.7 0 0 1 3.4 0v2.3"/><path d="M14.6 13.5h.01M16.8 15.8h.01M7.4 13.2h.01"/>',
  platstation: '<path d="M3 3v18"/><path d="M3 6.5 1.5 8M3 11l-1.5 1.5M3 15.5 1.5 17"/><path d="M3 5h14.5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H13"/><path d="M8.5 19H3"/><rect x="12.5" y="10" width="4" height="3.4" rx=".6"/><path d="M13.5 10V9a1 1 0 0 1 2 0v1"/>',
  'mekanisk-falla': '<rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M5.5 9.2l1.25-1.2L8 9.2l1.25-1.2 1.25 1.2 1.25-1.2L13 9.2l1.25-1.2 1.25 1.2 1.25-1.2L18.5 9.2"/><path d="M6.5 19v-5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v5"/><rect x="10.2" y="14.6" width="3.6" height="2.4" rx=".5"/>',
  ljusfalla: '<rect x="3" y="9" width="18" height="10" rx="2"/><path d="M6 12.5h12"/><path d="M6 15.5h12"/><path d="M7 6.2 6.2 4.5M12 5.8V3.5M17 6.2l.8-1.7"/>',
  'klisterfalla-krypande': '<path d="M2 17.5h20L18.5 13h-13z"/><path d="M5.5 13 7.5 10h9l2 3"/><path d="M9.5 11.6h.01M12 11.6h.01M14.5 11.6h.01"/>',
  'klisterfalla-flygande': '<path d="M2.5 19.5 8 9l5.5 10.5z"/><path d="M8 9l11-2.5 3 10.5-8.5 2.5"/><path d="M13.5 7.8V4.6a1.6 1.6 0 0 1 3.2 0"/><path d="M5.6 16.5h4.8"/>',
  avloppsfalla: '<path d="M3 3.5h9.5"/><path d="M5 3.5V18h17"/><path d="M10.5 3.5V11H22"/><rect x="6.4" y="5.3" width="2.8" height="2.6" rx=".5"/><path d="M7.8 7.9v2.6"/><rect x="14.5" y="12.4" width="5.5" height="4.2" rx="1"/><path d="M15.8 12.4v1.6M17.2 12.4v1.6M18.6 12.4v1.6"/>',
  // Produkter
  aurotrap: '<path d="M2.5 3v18"/><rect x="4.5" y="5" width="17" height="13.5" rx="1.5"/><rect x="7" y="7.8" width="7.5" height="2.8" rx="1.4"/><path d="M14.5 9.2h1.8"/><path d="M10.2 18.5v-2.4a2.8 2.8 0 0 1 5.6 0v2.4"/><path d="M18.5 7.6h.01"/>',
  'goodnature-a24': '<path d="M4 2v20"/><path d="M2 21.5h20"/><path d="M4 12.5h4M4 15.5h4"/><path d="M8.5 18.5V8a2.5 2.5 0 0 1 5 0v10.5"/><path d="M8 5.6h6"/><path d="M13 6.2 17.2 3.3l1.1 1.6-4 2.9"/>',
  'snap-e': '<rect x="3" y="15" width="18" height="4.5" rx="1.5"/><path d="M7 15V5.5h7.5V15"/><path d="M10 17.2h8"/>',
  'af-multis': '<path d="M4 7.5 12 3.5l8 4V17l-8 4-8-4z"/><path d="M4 7.5l8 4 8-4M12 11.5V21"/><path d="M6.2 16.6v-2a1.5 1.5 0 0 1 3 1.4v2"/><path d="M16 14.2h.01"/>',
  'af-tunnel': '<rect x="2.5" y="10" width="6.5" height="6.5" rx="1"/><path d="M2.5 10l12-3.5h7l-13 3.5"/><path d="M21.5 6.5V13L9 16.5"/><rect x="4.2" y="11.8" width="3.1" height="3.1" rx=".5"/>',
  'af-underground': '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h9"/><circle cx="17.4" cy="6.4" r=".6"/>',
  'chameleon-uplight': '<path d="M2.5 3v18"/><path d="M2.5 9h8.5l7 3.5v1.5H2.5"/><path d="M6 14l1 4.5h4l1-4.5"/><path d="M12 6.5l1.8-2.3M16 8l2.4-1.6M19 11h2.5"/>',
  'nemesis-titan': '<rect x="3" y="6" width="18" height="11.5" rx="1.5"/><path d="M7 6v11.5M10.3 6v11.5M13.7 6v11.5M17 6v11.5"/><path d="M5 20h14"/>',
  climbup: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><rect x="10.4" y="10.4" width="3.2" height="3.2" rx=".5"/>',
  'funnel-trap': '<path d="M12 2v3"/><path d="M5.5 5h13"/><path d="M7 5v4M17 5v4"/><path d="M10.5 5v2h3V5"/><path d="M5.5 9h13l-4 4h-5z"/><path d="M7 13l1 8h8l1-8"/>',
  'daddi-long-legs': '<path d="M8 21h8"/><path d="M12 21v-4"/><circle cx="12" cy="15.5" r="1.6"/><path d="M12 14 4 6M12 14 2.5 12.5M12 14l8-8M12 14l9.5-1.5M12 14V3"/><path d="M4 6h.01M2.5 12.5h.01M20 6h.01M21.5 12.5h.01M12 3h.01"/>',
  'eagle-eye': '<path d="M12 21.5V12"/><path d="M8.5 21.5h7"/><path d="M12 2.5l5.5 8h-11z"/><path d="M12 2.5v8"/><path d="M19.5 3.5l1.5-1M20 7.5h1.8"/>',
}

/** De enkla formerna ritade som linjer, så att även de syns i kartans cirklar. */
export const FORM_PATHS: Record<string, string> = {
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  package: '<path d="M20 7.5 12 3.5 4 7.5v9l8 4 8-4z"/><path d="M4 7.5l8 4 8-4M12 11.5v9"/>',
  crosshair: '<circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  circle: '<circle cx="12" cy="12" r="7"/>',
  mechanical_trap: '<circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  concrete_station: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  bait_station: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
}

/** SVG-innehållet för en ikon, eller null för okänt namn. */
export function stationIconPaths(name: string | null | undefined): string | null {
  return (name && (PATHS[name] || FORM_PATHS[name])) || null
}

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

/** Mörka typfärger (t.ex. Betesstation #1f2937) syns inte mot klustrets mörka botten. */
export function ringColor(color: string): string {
  return color.toLowerCase() === '#1f2937' ? '#94a3b8' : color
}

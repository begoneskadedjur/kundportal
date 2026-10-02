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


import { stationMarkerSvg, ringColor, type StationMarkerSpec } from '../../../shared/stationMarkers'

export { stationMarkerSvg, ADDON_BADGE_FILL, ADDON_BADGE_INK } from '../../../shared/stationMarkers'
export type { StationMarkerSpec } from '../../../shared/stationMarkers'

const cache = new Map<string, google.maps.Icon>()



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


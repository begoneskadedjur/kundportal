// src/components/shared/equipment/markerFanOut.ts
//
// Radiell utspridning av markörer som ligger för tätt på skärmen.
//
// Stationer som står några meter från varandra ritas ovanpå varandra vid
// normal zoom, och kartans största zoom (19) räcker inte alltid för att
// skilja dem åt. I stället för gruppmarkör (delas aldrig upp vid maxzoom,
// siffran förväxlas med stationsnummer) eller solfjäder vid tryck (två tryck
// per station i fält) läggs markörer som ligger närmare än THRESHOLD_PX ut i
// en liten cirkel runt gruppens mitt, med en tunn vit linje och en ankarprick
// vid den verkliga positionen. Körs på kartans idle, alltså efter zoom eller
// panorering. När stationerna får plats på riktigt försvinner linjerna.
//
// Markörer som flyttas eller är markerade lämnas på sin riktiga plats och
// deltar inte i grupperna.

export interface FanOutEntry {
  marker: google.maps.Marker
  /** Verklig position, den markören ska stå på när den får plats */
  position: google.maps.LatLngLiteral
  /** Deltar inte i utspridning (flyttas, markerad, nedtonad kontext) */
  pinned?: boolean
}

export interface FanOutHandle {
  /** Räkna om direkt, t.ex. efter att markörerna byggts om */
  refresh: () => void
  /** Ta bort linjer, ankare och lyssnare, återställ positioner */
  dispose: () => void
}

export interface FanOutOptions {
  /** Pixelavstånd under vilket två markörer räknas som en hög */
  thresholdPx?: number
  /** Anropas när antalet utspridda grupper ändras (för legenden) */
  onChange?: (spreadGroups: number) => void
}

const THRESHOLD_PX = 30
const LINE_COLOR = '#ffffff'
const ANCHOR_INK = '#0f172a'

interface Pixel {
  x: number
  y: number
}

export function createFanOut(
  map: google.maps.Map,
  entries: FanOutEntry[],
  options: FanOutOptions = {}
): FanOutHandle {
  const threshold = options.thresholdPx ?? THRESHOLD_PX
  const lines: google.maps.Polyline[] = []
  const anchors: google.maps.Marker[] = []
  let lastGroups = -1
  let disposed = false

  const clearDecorations = () => {
    lines.forEach((l) => l.setMap(null))
    anchors.forEach((a) => a.setMap(null))
    lines.length = 0
    anchors.length = 0
  }

  const restoreAll = () => {
    entries.forEach((e) => e.marker.setPosition(e.position))
  }

  const compute = () => {
    if (disposed) return
    const projection = map.getProjection()
    const zoom = map.getZoom()
    if (!projection || zoom == null) return
    const scale = Math.pow(2, zoom)

    clearDecorations()

    const candidates = entries.filter((e) => !e.pinned)
    const pixels: Pixel[] = candidates.map((e) => {
      const p = projection.fromLatLngToPoint(new google.maps.LatLng(e.position))
      return p ? { x: p.x * scale, y: p.y * scale } : { x: NaN, y: NaN }
    })

    // Gruppera: enkel sammanslagning av par som ligger närmare än tröskeln.
    // Antalet stationer per karta är litet (klustret tar över vid 80), så
    // en kvadratisk jämförelse räcker gott.
    const groupOf = candidates.map((_, i) => i)
    const find = (i: number): number => {
      while (groupOf[i] !== i) {
        groupOf[i] = groupOf[groupOf[i]]
        i = groupOf[i]
      }
      return i
    }
    for (let i = 0; i < candidates.length; i++) {
      if (Number.isNaN(pixels[i].x)) continue
      for (let j = i + 1; j < candidates.length; j++) {
        if (Number.isNaN(pixels[j].x)) continue
        const dx = pixels[i].x - pixels[j].x
        const dy = pixels[i].y - pixels[j].y
        if (dx * dx + dy * dy < threshold * threshold) {
          groupOf[find(i)] = find(j)
        }
      }
    }

    const groups = new Map<number, number[]>()
    candidates.forEach((_, i) => {
      const root = find(i)
      const list = groups.get(root) ?? []
      list.push(i)
      groups.set(root, list)
    })

    let spread = 0
    groups.forEach((members) => {
      if (members.length < 2) {
        members.forEach((i) => candidates[i].marker.setPosition(candidates[i].position))
        return
      }
      spread += 1
      const cx = members.reduce((s, i) => s + pixels[i].x, 0) / members.length
      const cy = members.reduce((s, i) => s + pixels[i].y, 0) / members.length
      // Radien växer med antalet så att markörerna får plats runt cirkeln
      const radius = 18 + 6 * members.length
      const start = -Math.PI / 2
      members.forEach((i, k) => {
        const angle = start + (2 * Math.PI * k) / members.length
        const px = cx + radius * Math.cos(angle)
        const py = cy + radius * Math.sin(angle)
        const latLng = projection.fromPointToLatLng(new google.maps.Point(px / scale, py / scale))
        if (!latLng) return
        const entry = candidates[i]
        entry.marker.setPosition(latLng)

        lines.push(
          new google.maps.Polyline({
            map,
            path: [entry.position, latLng],
            strokeColor: LINE_COLOR,
            strokeOpacity: 0.9,
            strokeWeight: 1.3,
            clickable: false,
            zIndex: 90,
          })
        )
        anchors.push(
          new google.maps.Marker({
            map,
            position: entry.position,
            clickable: false,
            zIndex: 95,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 2.8,
              fillColor: LINE_COLOR,
              fillOpacity: 1,
              strokeColor: ANCHOR_INK,
              strokeWeight: 1,
            },
          })
        )
      })
    })

    if (spread !== lastGroups) {
      lastGroups = spread
      options.onChange?.(spread)
    }
  }

  const listener = map.addListener('idle', compute)
  compute()

  return {
    refresh: compute,
    dispose: () => {
      disposed = true
      google.maps.event.removeListener(listener)
      clearDecorations()
      restoreAll()
      if (lastGroups !== 0) options.onChange?.(0)
    },
  }
}

import { describe, expect, it } from 'vitest'
import { countBadgeCollisions, markerFitPadding, spreadOverlappingPoints, MAP_PADDING_AIR } from './satelliteMapLayout'
import { reportMarkerLayers, reportMarkerSvg } from './reportStationMarkers'

// Kista Galleria, lastkajer: 24 utomhusstationer (nummer, lat, lng)
const KISTA: Array<[number, number, number]> = [
  [1, 59.4030511, 17.9466911], [2, 59.4030443, 17.9466903], [3, 59.4034352, 17.9452125], [4, 59.4043594, 17.9438634],
  [5, 59.4038473, 17.9446198], [6, 59.4036562, 17.9455068], [7, 59.4038457, 17.9457943], [8, 59.4027682, 17.945465],
  [9, 59.4022009, 17.9464354], [10, 59.4018599, 17.9457609], [11, 59.4018257, 17.9454243], [12, 59.4019159, 17.945043],
  [13, 59.4023267, 17.9448003], [14, 59.4025416, 17.9450679], [15, 59.4027144, 17.9440566], [16, 59.4028369, 17.943944],
  [17, 59.4031261, 17.943617], [18, 59.4032891, 17.9437402], [19, 59.403688, 17.9429589], [20, 59.4042302, 17.9424688],
  [21, 59.4017278, 17.943602], [22, 59.4019097, 17.9442002], [23, 59.40272406, 17.94361319], [24, 59.402916, 17.9433736],
]

// Webb-Mercator som Google: världen 256 px vid zoom 0
const wx = (lng: number) => ((lng + 180) / 360) * 256
const wy = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256
}

// Samma som fitBounds med fraktionell zoom och padding per sida
function project(points: Array<[number, number, number]>, W: number, H: number, pad: { top: number; right: number; bottom: number; left: number }) {
  const xs = points.map(p => wx(p[2]))
  const ys = points.map(p => wy(p[1]))
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys)
  const k = Math.min((W - pad.left - pad.right) / (maxx - minx), (H - pad.top - pad.bottom) / (maxy - miny))
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
  const ox = pad.left + (W - pad.left - pad.right) / 2
  const oy = pad.top + (H - pad.top - pad.bottom) / 2
  return points.map((_, i) => ({ x: ox + (xs[i] - cx) * k, y: oy + (ys[i] - cy) * k }))
}

describe('markerFitPadding', () => {
  it('ger plats för nummerbrickan under den sydligaste stationen', () => {
    const l = reportMarkerLayers({ color: '#22c55e', number: 21, radius: 11 })
    const pad = markerFitPadding([{ circle: l.circle, badge: l.badge }], 15)
    // Brickan slutar 26 px under punkten (radie 11 + kant 1 + 1 + 12 + 1)
    expect(l.badge!.height).toBe(26)
    expect(pad.bottom).toBe(26 + MAP_PADDING_AIR)
    expect(pad.top).toBe(l.circle.center + MAP_PADDING_AIR)
    expect(pad.left).toBe(pad.right)
  })

  it('går aldrig under minimimarginalen', () => {
    const l = reportMarkerLayers({ color: '#22c55e', radius: 11 })
    expect(markerFitPadding([{ circle: l.circle, badge: l.badge }], 40)).toEqual({ top: 40, right: 40, bottom: 40, left: 40 })
  })

  it('räknar med plusbrickan och statuskanten', () => {
    const plain = reportMarkerLayers({ color: '#22c55e', number: 1, radius: 11 })
    const addon = reportMarkerLayers({ color: '#22c55e', number: 1, radius: 11, addon: true, status: 'damaged' })
    const a = markerFitPadding([{ circle: plain.circle, badge: plain.badge }])
    const b = markerFitPadding([{ circle: plain.circle, badge: plain.badge }, { circle: addon.circle, badge: addon.badge }])
    expect(b.top).toBeGreaterThanOrEqual(a.top)
    expect(b.bottom).toBeGreaterThan(a.bottom)
  })
})

describe('reportMarkerLayers', () => {
  it('har samma cirkel som hela markören och brickan på samma plats', () => {
    const whole = reportMarkerSvg({ color: '#22c55e', number: 12, radius: 11 })
    const l = reportMarkerLayers({ color: '#22c55e', number: 12, radius: 11 })
    expect(l.circle.center).toBe(whole.center)
    expect(l.circle.svg).not.toContain('<text')
    // Brickans nederkant räknat från ankaret = hela markörens höjd under ankaret
    expect(l.badge!.height).toBe(whole.height - whole.center)
    expect(l.badge!.svg).toContain('>12</text>')
  })

  it('saknar bricka utan nummer', () => {
    expect(reportMarkerLayers({ color: '#22c55e', radius: 11 }).badge).toBeNull()
  })
})

describe('spreadOverlappingPoints', () => {
  it('lämnar stationer som inte krockar orörda', () => {
    const pts = [{ x: 10, y: 10, w: 12 }, { x: 100, y: 10, w: 12 }, { x: 10, y: 100, w: 12 }]
    expect(spreadOverlappingPoints(pts)).toEqual(pts.map(p => ({ x: p.x, y: p.y })))
  })

  it('lägger två stationer på samma pixel sida vid sida, västra till vänster, en cirkel isär', () => {
    const out = spreadOverlappingPoints([{ x: 50.3, y: 50, w: 12 }, { x: 50, y: 50.4, w: 12 }], { minChord: 26 })
    expect(out[1].x).toBeLessThan(out[0].x)
    expect(out[0].x - out[1].x).toBeCloseTo(26, 5)
    expect(out[0].y).toBeCloseTo(out[1].y, 5)
    expect(countBadgeCollisions(out, [12, 12])).toBe(0)
  })

  it('utan minChord räcker det att brickorna inte krockar', () => {
    const out = spreadOverlappingPoints([{ x: 50, y: 50, w: 18 }, { x: 50, y: 50, w: 18 }])
    expect(countBadgeCollisions(out, [18, 18])).toBe(0)
  })

  it('sprider tre stationer på samma punkt utan krock', () => {
    const pts = [{ x: 0, y: 0, w: 18 }, { x: 0, y: 0, w: 18 }, { x: 0, y: 0, w: 18 }]
    const out = spreadOverlappingPoints(pts, { minChord: 26 })
    expect(countBadgeCollisions(out, [18, 18, 18])).toBe(0)
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) expect(Math.hypot(out[a].x - out[b].x, out[a].y - out[b].y)).toBeGreaterThanOrEqual(26 - 1e-9)
    // Deterministisk
    expect(spreadOverlappingPoints(pts, { minChord: 26 })).toEqual(out)
  })

  it('stationer utan nummer påverkar inget', () => {
    const out = spreadOverlappingPoints([{ x: 5, y: 5, w: 0 }, { x: 5, y: 5, w: 12 }])
    expect(out).toEqual([{ x: 5, y: 5 }, { x: 5, y: 5 }])
  })
})

describe('Kista Galleria, lastkajer (kontrollrapportens karta 900 x 450)', () => {
  const layers = KISTA.map(p => reportMarkerLayers({ color: '#1f2937', icon: 'betesstation', number: p[0], radius: 11 }))
  const pad = markerFitPadding(layers.map(l => ({ circle: l.circle, badge: l.badge })), 15)
  const px = project(KISTA, 900, 450, pad)
  const out = spreadOverlappingPoints(px.map((p, i) => ({ x: p.x, y: p.y, w: layers[i].badge!.width })), { minChord: layers[0].circle.size })
  const widths = layers.map(l => l.badge!.width)

  it('före: station 1 och 2 krockade, med gamla marginalen 15 skars brickan för 21', () => {
    expect(countBadgeCollisions(px, widths)).toBeGreaterThan(0)
    const old = project(KISTA, 900, 450, { top: 15, right: 15, bottom: 15, left: 15 })
    expect(old[20].y + 26).toBeGreaterThan(450)
  })

  it('efter: alla 24 brickor inne i bilden och inga brickor krockar', () => {
    expect(countBadgeCollisions(out, widths)).toBe(0)
    out.forEach((p, i) => {
      const b = layers[i].badge!
      expect(p.y + b.height).toBeLessThanOrEqual(450)
      expect(p.y - layers[i].circle.center).toBeGreaterThanOrEqual(0)
      expect(p.x - layers[i].circle.center).toBeGreaterThanOrEqual(0)
      expect(p.x + layers[i].circle.center).toBeLessThanOrEqual(900)
    })
  })

  it('bara station 1 och 2 flyttas, högst några pixlar', () => {
    out.forEach((p, i) => {
      const moved = Math.hypot(p.x - px[i].x, p.y - px[i].y)
      if (i <= 1) expect(moved).toBeLessThanOrEqual(14)
      else expect(moved).toBe(0)
    })
  })
})

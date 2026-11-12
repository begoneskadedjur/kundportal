// src/shared/satelliteMapLayout.ts
// Ren layoutlogik för rapporternas satellitkartor (kontrollrapporten och
// stationskartan): hur mycket marginal kartan behöver runt stationerna så
// att ingen markör eller nummerbricka skärs av i kanten, och hur stationer
// som hamnar nästan på samma pixel sprids ut några pixlar så att båda
// numren syns. Utspridningen gäller bara bilden, aldrig sparade positioner.

export interface MarkerExtent {
  /** Cirkelns bild: bredd/höjd och ankaret (cirkelns mitt) */
  circle: { size: number; height: number; center: number }
  /** Nummerbrickan: bredd, höjd från punkten och nedåt, ankarets x */
  badge: { width: number; height: number; anchorX: number } | null
}

export interface MapPadding { top: number; right: number; bottom: number; left: number }

/** Luft utöver markörens mått, rymmer också utspridningen (ett par flyttas en halv cirkel åt var sitt håll) */
export const MAP_PADDING_AIR = 16

/**
 * Marginal för fitBounds räknad från markörernas mått, så att hela markören
 * (cirkel uppåt och åt sidorna, nummerbricka nedåt) ryms inne i bilden.
 * minimum är den marginal kartan hade utan markörer.
 */
export function markerFitPadding(markers: MarkerExtent[], minimum = 0, air = MAP_PADDING_AIR): MapPadding {
  let up = 0
  let side = 0
  let down = 0
  for (const m of markers) {
    up = Math.max(up, m.circle.center)
    side = Math.max(side, m.circle.center, m.circle.size - m.circle.center, m.badge ? Math.max(m.badge.anchorX, m.badge.width - m.badge.anchorX) : 0)
    down = Math.max(down, m.circle.height - m.circle.center, m.badge ? m.badge.height : 0)
  }
  const edge = (v: number) => Math.max(minimum, Math.ceil(v + air))
  return { top: edge(up), right: edge(side), bottom: edge(down), left: edge(side) }
}

export interface SpreadPoint {
  x: number
  y: number
  /** Nummerbrickans bredd i px (0 = ingen bricka) */
  w: number
}

export interface SpreadOptions {
  /** Minsta lodräta avstånd mellan två brickor (brickans höjd + luft) */
  minDy?: number
  /** Luft i sidled mellan två brickor */
  gapX?: number
  /** Största ringradie */
  maxRadius?: number
  /** Minsta avstånd mellan grannar på ringen, t.ex. cirkelns diameter så att cirklarna inte täcker varandra */
  minChord?: number
}

/**
 * Utspridningen som ren JavaScript-källkod, så att exakt samma funktion kan
 * köras i kartsidan i Puppeteer (efter att Google-projektionen finns) och i
 * testerna. Inga beroenden, inga hjälpfunktioner utanför.
 *
 * Två brickor krockar när de ligger närmare än minDy i höjdled och
 * närmare än halva bredderna + gapX i sidled. Krockande stationer bildar en
 * grupp (transitivt). Ett par läggs sida vid sida (västra till vänster).
 * Större grupper läggs på en ring runt gruppens mittpunkt, första stationen
 * rakt upp och resten medurs, i ordning norr till söder (sedan väst till
 * öst, sedan index). Ringen börjar så att grannarna står minChord isär och
 * växer en pixel i taget tills inga brickor i gruppen krockar. Upprepas några varv om en utspridd grupp
 * krockar med en granne.
 */
export const SPREAD_POINTS_JS = `function spreadPoints(points, opts) {
  var minDy = (opts && opts.minDy) || 14;
  var gapX = (opts && opts.gapX) || 2;
  var maxR = (opts && opts.maxRadius) || 40;
  var minChord = (opts && opts.minChord) || 0;
  var n = points.length;
  var out = [];
  for (var i = 0; i < n; i++) out.push({ x: points[i].x, y: points[i].y });
  for (var pass = 0; pass < 4; pass++) {
    var parent = [];
    for (var a = 0; a < n; a++) parent.push(a);
    var any = false;
    for (var a1 = 0; a1 < n; a1++) {
      if (!points[a1].w) continue;
      for (var b1 = a1 + 1; b1 < n; b1++) {
        if (!points[b1].w) continue;
        var dxA = Math.abs(out[a1].x - out[b1].x);
        var dyA = Math.abs(out[a1].y - out[b1].y);
        if (dxA < (points[a1].w + points[b1].w) / 2 + gapX && dyA < minDy) {
          var ra = a1; while (parent[ra] !== ra) ra = parent[ra];
          var rb = b1; while (parent[rb] !== rb) rb = parent[rb];
          if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
          any = true;
        }
      }
    }
    if (!any) break;
    var groups = {};
    for (var g = 0; g < n; g++) {
      var r0 = g; while (parent[r0] !== r0) r0 = parent[r0];
      if (!groups[r0]) groups[r0] = [];
      groups[r0].push(g);
    }
    for (var key in groups) {
      var mem = groups[key];
      if (mem.length < 2) continue;
      var pair = mem.length === 2;
      mem.sort(function (p, q) {
        if (pair && out[p].x !== out[q].x) return out[p].x - out[q].x;
        if (out[p].y !== out[q].y) return out[p].y - out[q].y;
        if (out[p].x !== out[q].x) return out[p].x - out[q].x;
        return p - q;
      });
      var start = pair ? Math.PI : -Math.PI / 2;
      var r1 = Math.max(minDy / 2, minChord / (2 * Math.sin(Math.PI / mem.length)));
      var cx = 0, cy = 0;
      for (var k = 0; k < mem.length; k++) { cx += out[mem[k]].x; cy += out[mem[k]].y; }
      cx /= mem.length; cy /= mem.length;
      var placed = null;
      for (var r = Math.min(r1, maxR); r <= maxR; r += 1) {
        var pos = [];
        for (var k2 = 0; k2 < mem.length; k2++) {
          var ang = start + (2 * Math.PI * k2) / mem.length;
          pos.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
        }
        var ok = true;
        for (var u = 0; u < mem.length && ok; u++) {
          for (var v = u + 1; v < mem.length; v++) {
            var wu = points[mem[u]].w, wv = points[mem[v]].w;
            if (Math.abs(pos[u].x - pos[v].x) < (wu + wv) / 2 + gapX && Math.abs(pos[u].y - pos[v].y) < minDy) { ok = false; break; }
          }
        }
        placed = pos;
        if (ok) break;
      }
      for (var k3 = 0; k3 < mem.length; k3++) out[mem[k3]] = placed[k3];
    }
  }
  return out;
}`

/**
 * Sprider ut stationer vars nummerbrickor skulle krocka. Ger nya
 * bildpositioner i samma ordning; stationer utan krock står kvar.
 */
export const spreadOverlappingPoints = new Function(`return (${SPREAD_POINTS_JS})`)() as (
  points: SpreadPoint[],
  options?: SpreadOptions,
) => Array<{ x: number; y: number }>

/** Antal krockande brickpar, för kontroll och tester */
export function countBadgeCollisions(points: Array<{ x: number; y: number }>, widths: number[], options: SpreadOptions = {}): number {
  const minDy = options.minDy || 14
  const gapX = options.gapX || 2
  let hits = 0
  for (let a = 0; a < points.length; a++) {
    if (!widths[a]) continue
    for (let b = a + 1; b < points.length; b++) {
      if (!widths[b]) continue
      if (Math.abs(points[a].x - points[b].x) < (widths[a] + widths[b]) / 2 + gapX && Math.abs(points[a].y - points[b].y) < minDy) hits++
    }
  }
  return hits
}

// api/_lib/satelliteMapShot.ts
// Satellitkarta som bild för kundrapporterna (kontrollrapporten och
// stationskartan). Google Maps JS API i en Puppeteer-sida, eftersom Static
// Maps saknar satellitvy i EU/EEA.
//
// Markören ritas i två lager: stationscirklarna underst och alla
// nummerbrickor i ett eget lager överst, så att ingen grannes cirkel täcker
// ett nummer. Marginalen till fitBounds räknas från markörens mått så att
// brickorna längst söderut inte skärs av, och stationer som hamnar nästan
// på samma pixel sprids ut några pixlar i bilden (inte i data).

import { reportMarkerLayers, svgDataUri, type ReportMarkerInput } from '../../src/shared/reportStationMarkers'
import { markerFitPadding, SPREAD_POINTS_JS, type MapPadding } from '../../src/shared/satelliteMapLayout'

/** Högsta zoom, så att en enstaka station inte zoomas förbi satellitbilderna */
export const SATELLITE_MAX_ZOOM = 20

export interface SatelliteStation extends ReportMarkerInput {
  lat: number
  lng: number
}

export interface SatellitePolygon {
  path: Array<{ lat: number; lng: number }>
  color: string
  label: string
}

export interface SatelliteMapOptions {
  width: number
  height: number
  stations: SatelliteStation[]
  polygons?: SatellitePolygon[]
  /** Minsta marginal per sida, som kartan hade tidigare */
  minPadding: number
  /** Väntetid efter att allt laddat, ms */
  settleMs?: number
  logTag?: string
}

interface PageMarker {
  lat: number
  lng: number
  cu: string; cw: number; ch: number; cc: number
  bu: string | null; bw: number; bh: number; ba: number
}

/** Sidans HTML. Exporterad för tester och felsökning. */
export function buildSatelliteMapHtml(apiKey: string, opts: SatelliteMapOptions): { html: string; padding: MapPadding } {
  const layers = opts.stations.map(s => ({ s, l: reportMarkerLayers(s) }))
  const padding = markerFitPadding(
    layers.map(({ l }) => ({ circle: l.circle, badge: l.badge })),
    opts.minPadding,
  )
  const markers: PageMarker[] = layers.map(({ s, l }) => ({
    lat: s.lat,
    lng: s.lng,
    cu: svgDataUri(l.circle.svg), cw: l.circle.size, ch: l.circle.height, cc: l.circle.center,
    bu: l.badge ? svgDataUri(l.badge.svg) : null,
    bw: l.badge ? l.badge.width : 0,
    bh: l.badge ? l.badge.height : 0,
    ba: l.badge ? l.badge.anchorX : 0,
  }))
  const polygons = opts.polygons || []
  const settle = opts.settleMs ?? 500
  const usesPolygons = polygons.length > 0

  const html = `<!DOCTYPE html>
<html><head><style>* { margin:0; padding:0; } #map { width:${opts.width}px; height:${opts.height}px; }
.cnt { background:#0f172a; color:#fff; font:700 12px 'Segoe UI',Arial,sans-serif; padding:3px 8px; border-radius:10px; border:2px solid #fff; white-space:nowrap; }
</style></head><body><div id="map"></div>
<script>
  var spreadPoints = ${SPREAD_POINTS_JS};
  function initMap() {
    var markers = ${JSON.stringify(markers)};
    var polygons = ${JSON.stringify(polygons)};
    var padding = ${JSON.stringify(padding)};
    // Grannar på ringen står minst en cirkel isär, så att cirklarna inte täcker varandra
    var minChord = ${Math.max(0, ...markers.map(m => m.cw))};
    var bounds = new google.maps.LatLngBounds();
    var map = new google.maps.Map(document.getElementById('map'), {
      mapTypeId: 'satellite', disableDefaultUI: true, isFractionalZoomEnabled: true, maxZoom: ${SATELLITE_MAX_ZOOM}
    });
    polygons.forEach(function(p) {
      new google.maps.Polygon({ paths: p.path, map: map, strokeColor: p.color, strokeOpacity: 0.95, strokeWeight: 2, fillColor: p.color, fillOpacity: 0.28 });
      var pb = new google.maps.LatLngBounds();
      p.path.forEach(function(pt) { pb.extend(pt); bounds.extend(pt); });
      var c = pb.getCenter();
      var el = document.createElement('div'); el.className = 'cnt'; el.textContent = p.label; el.style.borderColor = p.color;
      new google.maps.marker.AdvancedMarkerElement({ position: c, map: map, content: el });
    });
    markers.forEach(function(m) { bounds.extend({ lat: m.lat, lng: m.lng }); });

    // Projektionen (pixel <-> lat/lng) finns först när kartan ritats
    var overlay = new google.maps.OverlayView();
    overlay.onAdd = function() {};
    overlay.draw = function() {};
    overlay.onRemove = function() {};
    overlay.setMap(map);

    var tiles = false, placed = false, done = false;
    function check() {
      if (done || !tiles || !placed) return;
      done = true;
      setTimeout(function() { window.__MAP_READY = true; }, ${settle});
    }
    google.maps.event.addListener(map, 'tilesloaded', function() { tiles = true; check(); });

    function place() {
      var proj = overlay.getProjection();
      if (!proj) { setTimeout(place, 50); return; }
      var pts = markers.map(function(m) {
        var p = proj.fromLatLngToContainerPixel(new google.maps.LatLng(m.lat, m.lng));
        return { x: p.x, y: p.y, w: m.bw };
      });
      var out = spreadPoints(pts, { minDy: 14, gapX: 2, maxRadius: 40, minChord: minChord });
      markers.forEach(function(m, i) {
        var pos = proj.fromContainerPixelToLatLng(new google.maps.Point(out[i].x, out[i].y));
        // Cirklarna underst, sydligare cirkel över nordligare som tidigare
        new google.maps.Marker({
          position: pos, map: map, clickable: false, zIndex: 1000 + Math.round(out[i].y),
          icon: { url: m.cu, scaledSize: new google.maps.Size(m.cw, m.ch), anchor: new google.maps.Point(m.cc, m.cc) }
        });
        // Nummerbrickorna i eget lager överst
        if (m.bu) {
          new google.maps.Marker({
            position: pos, map: map, clickable: false, zIndex: 100000 + Math.round(out[i].y),
            icon: { url: m.bu, scaledSize: new google.maps.Size(m.bw, m.bh), anchor: new google.maps.Point(m.ba, 0) }
          });
        }
      });
      window.__MAP_LAYOUT = { zoom: map.getZoom(), padding: padding, points: pts, placed: out };
      placed = true;
      check();
    }
    google.maps.event.addListenerOnce(map, 'idle', place);
    map.fitBounds(bounds, padding);
  }
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}${usesPolygons ? '&libraries=marker' : ''}&callback=initMap" async defer></script>
</body></html>`
  return { html, padding }
}

/**
 * Renderar satellitkartan och ger en PNG som data-URI, eller null om
 * nyckel saknas, inget finns att visa eller kartan inte laddar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function renderSatelliteMapShot(browser: any, opts: SatelliteMapOptions): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  if (opts.stations.length === 0 && (opts.polygons || []).length === 0) return null

  const { html } = buildSatelliteMapHtml(apiKey, opts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = null
  try {
    page = await browser.newPage()
    await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 })
    await page.waitForFunction('window.__MAP_READY === true', { timeout: 15000 })
    const shot = await page.screenshot({ type: 'png' })
    await page.close()
    return `data:image/png;base64,${Buffer.from(shot).toString('base64')}`
  } catch (err) {
    console.error(`[${opts.logTag || 'satellite-map'}] satellitkarta misslyckades:`, err)
    if (page) await page.close().catch(() => {})
    return null
  }
}

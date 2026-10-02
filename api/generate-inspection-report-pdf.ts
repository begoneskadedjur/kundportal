// api/generate-inspection-report-pdf.ts
// Puppeteer-baserad PDF-generering för kontrollrapporter (inspektionssessioner)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { requireAuth, requireAuthenticated } from './_lib/auth'
import { canonicalTypeCode } from '../src/utils/stationTaxonomy'
import { reportLegendHtml, reportMarkerSvg, svgDataUri, type LegendStation } from '../src/shared/reportStationMarkers'

// Gräns för bifogad PDF vid e-postutskick. Resend tillåter 40 MB per mejl, men många
// mottagande e-postservrar avvisar bilagor över ~10 MB, så vi stannar vid 8 MB.
const MAX_EMAIL_ATTACHMENT_BYTES = 8 * 1024 * 1024

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const beGoneColors = {
  primary: '#0A1328',
  accent: '#20C58F',
  accentDark: '#10B981',
  white: '#FFFFFF',
  lightestGray: '#F8FAFC',
  lightGray: '#F1F5F9',
  mediumGray: '#94A3B8',
  darkGray: '#334155',
  charcoal: '#1E293B',
  border: '#CBD5E1',
  divider: '#E2E8F0',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const getStatusColor = (status: string, dynamicColors?: Record<string, string>) => {
  if (dynamicColors?.[status]) return dynamicColors[status]
  switch (status) {
    case 'none':
    case 'ok': return '#22c55e'
    case 'low': return '#eab308'
    case 'medium':
    case 'activity': return '#f97316'
    case 'high':
    case 'needs_service': return '#ef4444'
    case 'replaced': return '#3B82F6'
    default: return beGoneColors.mediumGray
  }
}

const getStatusLabel = (status: string, dynamicLabels?: Record<string, string>) => {
  if (dynamicLabels?.[status]) return dynamicLabels[status]
  const labels: Record<string, string> = {
    none: 'Ingen aktivitet',
    low: 'Lite aktivitet',
    medium: 'Medelhög aktivitet',
    high: 'Betydande aktivitet',
    ok: 'Ingen aktivitet',
    activity: 'Aktivitet',
    needs_service: 'Behöver service',
    replaced: 'Utbytt',
    not_inspected: 'Ej kontrollerad'
  }
  return labels[status] || status || '-'
}

// ------------------------------------------------------------------
// Stationstyp per station: färg, ikon och namn ur station_types (samma
// regel som stationskartan: station_type_id först, sedan fritextkoden).
// Rapporten visar aldrig produktens ikon, bara stationstypens.
// ------------------------------------------------------------------

interface ReportTypeRow { id: string; code: string; name: string; color: string | null; icon: string | null }

async function loadReportStationTypes(): Promise<ReportTypeRow[]> {
  const { data } = await supabase.from('station_types').select('id, code, name, color, icon')
  return (data as ReportTypeRow[] | null) || []
}

interface ResolvedStation extends LegendStation {
  number: number
}

function resolveReportStation(insp: any, number: number, types: ReportTypeRow[]): ResolvedStation {
  const st = insp.station || {}
  const legacy: string | null = st.equipment_type || st.station_type || null
  const typeId: string | null = st.station_type_id || st.station_type_data?.id || null
  const row = (typeId ? types.find(t => t.id === typeId) : undefined)
    || (legacy ? types.find(t => canonicalTypeCode(t.code) === canonicalTypeCode(legacy)) : undefined)
  return {
    number,
    typeName: st.station_type_data?.name || row?.name || legacy || 'Okänd typ',
    color: st.station_type_data?.color || row?.color || null,
    icon: row?.icon || st.station_type_data?.icon || null,
    status: st.status || null,
    addon: st.is_addon === true,
  }
}

function markerFor(s: ResolvedStation) {
  return reportMarkerSvg({ color: s.color, icon: s.icon, status: s.status, addon: s.addon, number: s.number, radius: 11 })
}

// Rendera Google Maps satellitbild via Puppeteer + JavaScript API (Static API blockerar satellit i EU/EEA)
async function renderSatelliteMapScreenshot(
  browser: any,
  stations: Array<ResolvedStation & { lat: number; lng: number }>
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  if (stations.length === 0) return null

  // Markören som SVG-ikon (samma som kunden ser i appen), ankrad i cirkelns mitt
  const markersJSON = JSON.stringify(stations.map(s => {
    const m = markerFor(s)
    return { lat: s.lat, lng: s.lng, url: svgDataUri(m.svg), w: m.size, h: m.height, c: m.center }
  }))

  const mapHtml = `<!DOCTYPE html>
<html><head>
  <style>* { margin: 0; padding: 0; } #map { width: 900px; height: 450px; }</style>
</head><body>
  <div id="map"></div>
  <script>
    function initMap() {
      var markers = ${markersJSON};
      var bounds = new google.maps.LatLngBounds();
      var map = new google.maps.Map(document.getElementById('map'), {
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        isFractionalZoomEnabled: true
      });
      markers.forEach(function(m) {
        var pos = { lat: m.lat, lng: m.lng };
        bounds.extend(pos);
        new google.maps.Marker({
          position: pos,
          map: map,
          icon: {
            url: m.url,
            scaledSize: new google.maps.Size(m.w, m.h),
            anchor: new google.maps.Point(m.c, m.c)
          }
        });
      });
      map.fitBounds(bounds, 15);
      google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
        setTimeout(function() { window.__MAP_READY = true; }, 500);
      });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap" async defer></script>
</body></html>`

  let page: any = null
  try {
    page = await browser.newPage()
    await page.setViewport({ width: 900, height: 450, deviceScaleFactor: 2 })
    await page.setContent(mapHtml, { waitUntil: 'networkidle0', timeout: 20000 })
    await page.waitForFunction('window.__MAP_READY === true', { timeout: 15000 })
    const screenshot = await page.screenshot({ type: 'png' })
    await page.close()
    return `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`
  } catch (err) {
    console.error('[MapScreenshot] Error:', err)
    if (page) await page.close().catch(() => {})
    return null
  }
}

// Rendera planritning + markörer som Puppeteer screenshot (löser sidbrytningsproblem)
async function renderFloorPlanScreenshot(
  browser: any,
  imageBase64: string,
  stations: Array<ResolvedStation & { x: number; y: number }>
): Promise<string | null> {
  // Samma markör som på satellitkartan, cirkelns mitt på stationens punkt
  const markerHtml = stations.map(s => {
    const m = markerFor(s)
    return `
    <div style="position:absolute;left:${s.x}%;top:${s.y}%;
      margin-left:-${m.center}px;margin-top:-${m.center}px;line-height:0;
      filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));">${m.svg}</div>`
  }).join('')

  const html = `<!DOCTYPE html><html><head>
    <style>*{margin:0;padding:0;}
    #container{position:relative;width:900px;}
    img{width:100%;display:block;}
    </style></head><body>
    <div id="container">
      <img id="img" src="${imageBase64}" />
      ${markerHtml}
    </div>
    <script>
      var img = document.getElementById('img');
      function onLoad() {
        document.getElementById('container').style.height = img.offsetHeight + 'px';
        window.__HEIGHT = img.offsetHeight;
        window.__READY = true;
      }
      if (img.complete) { onLoad(); } else { img.onload = onLoad; }
    </script>
  </body></html>`

  let page: any = null
  try {
    page = await browser.newPage()
    await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
    await page.waitForFunction('window.__READY === true', { timeout: 10000 })
    const height = await page.evaluate(() => (window as any).__HEIGHT)
    await page.setViewport({ width: 900, height: Math.max(1, Math.ceil(height)), deviceScaleFactor: 2 })
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    await page.close()
    return `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`
  } catch (err) {
    console.error('[FloorPlanScreenshot] Error:', err)
    if (page) await page.close().catch(() => {})
    return null
  }
}

// Hämta planritningsbild som base64 data-URI
async function fetchFloorPlanBase64(imagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('floor-plans')
      .createSignedUrl(imagePath, 3600)
    if (error || !data?.signedUrl) return null

    const response = await fetch(data.signedUrl)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/webp'
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
  } catch {
    return null
  }
}

async function generateInspectionReportHTML(data: {
  session: any
  customer: any
  technician: any
  outdoorInspections: any[]
  indoorInspections: any[]
  summary: { ok: number; warning: number; critical: number; total: number }
  dynamicLabels: Record<string, string>
  dynamicColors: Record<string, string>
  sessionPhotos?: Array<{ url?: string; caption?: string | null }>
}, browser: any) {
  const { session, customer, technician, outdoorInspections, indoorInspections, dynamicLabels, dynamicColors, sessionPhotos } = data

  // Sortera utomhusinspektioner efter placed_at för korrekt numrering (samma som kundportalen)
  const sortedOutdoor = [...outdoorInspections].sort((a, b) =>
    new Date(a.station?.placed_at || 0).getTime() - new Date(b.station?.placed_at || 0).getTime()
  )

  // Hämta sessionsbilder som base64
  let sessionPhotosHtml = ''
  if (sessionPhotos && sessionPhotos.length > 0) {
    const photoBase64List = await Promise.all(
      sessionPhotos.map(async (p) => {
        const base64 = p.url ? await fetchImageAsBase64(p.url) : null
        return { base64, caption: p.caption }
      })
    )
    const validPhotos = photoBase64List.filter(p => p.base64)
    if (validPhotos.length > 0) {
      const photoItems = validPhotos.map(p => `
        <div style="break-inside:avoid;">
          <img src="${p.base64}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid ${beGoneColors.border};display:block;" alt="${p.caption || 'Bild'}" />
          ${p.caption ? `<p style="font-size:9px;color:${beGoneColors.mediumGray};margin-top:3px;text-align:center;">${p.caption}</p>` : ''}
        </div>
      `).join('')
      sessionPhotosHtml = `
        <div class="notes-section" style="margin-bottom:20px;">
          <div class="notes-label">Bilder från besöket</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;">
            ${photoItems}
          </div>
        </div>
      `
    }
  }

  const stationTypes = await loadReportStationTypes()

  // Rendera Google Maps satellitbild via Puppeteer. Numret är samma som i
  // tabellen (placed_at-ordning över alla utomhusstationer).
  const outdoorOnMap = sortedOutdoor
    .map((insp: any, i: number) => ({ insp, s: resolveReportStation(insp, i + 1, stationTypes) }))
    .filter(({ insp }) => insp.station?.latitude && insp.station?.longitude)
    .map(({ insp, s }) => ({ ...s, lat: parseFloat(insp.station.latitude), lng: parseFloat(insp.station.longitude) }))
  const mapBase64 = await renderSatelliteMapScreenshot(browser, outdoorOnMap)
  const mapImageHtml = mapBase64 ? `
    <div style="margin-bottom: 12px;">
      <div style="border-radius: 8px; overflow: hidden; border: 1px solid ${beGoneColors.border};">
        <img src="${mapBase64}" style="width: 100%; height: auto; display: block;" alt="Stationskarta" />
      </div>
      ${reportLegendHtml(outdoorOnMap)}
    </div>
  ` : ''

  // Räkna per aktivitetsnivå för sammanfattningsfältet
  const allInspections = [...outdoorInspections, ...indoorInspections]
  const levelCounts = { none: 0, low: 0, medium: 0, high: 0 }
  for (const insp of allInspections) {
    const lvl = insp.status as keyof typeof levelCounts
    if (lvl in levelCounts) levelCounts[lvl]++
  }

  // Bygg nummermappning för utomhus (1, 2, 3... baserat på placed_at-order)
  const outdoorTableRows = sortedOutdoor.map((insp: any, index: number) => {
    const statusColor = getStatusColor(insp.status, dynamicColors)
    const stationNumber = index + 1
    return `
      <tr>
        <td><strong>${stationNumber}</strong></td>
        <td>${insp.station?.station_type_data?.name || insp.station?.equipment_type || '-'}${insp.station?.is_addon ? `<br/><span style="font-size:8px;color:#7c3aed;">Tillägg utöver avtal</span>` : ''}</td>
        <td><span class="status-badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">${getStatusLabel(insp.status, dynamicLabels)}</span></td>
        <td>${insp.station?.station_type_data?.measurement_label || '-'}</td>
        <td class="text-right">${insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '-'}</td>
        <td>${insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-'}</td>
        <td>${insp.findings || '-'}</td>
        <td>${insp.preparation?.name || '-'}</td>
        <td class="text-small">${insp.preparation?.registration_number || '-'}</td>
        <td class="text-small">${formatDateTime(insp.inspected_at)}</td>
      </tr>
    `
  }).join('')

  // Group indoor inspections by floor plan
  const indoorByFloorPlan = new Map<string, { name: string; building: string | null; imagePath: string | null; inspections: any[] }>()
  for (const insp of indoorInspections) {
    const fp = insp.station?.floor_plan
    const fpId = fp?.id || 'unknown'
    if (!indoorByFloorPlan.has(fpId)) {
      indoorByFloorPlan.set(fpId, {
        name: fp?.name || 'Okänd planritning',
        building: fp?.building_name || null,
        imagePath: fp?.image_path || null,
        inspections: []
      })
    }
    indoorByFloorPlan.get(fpId)!.inspections.push(insp)
  }

  // Bygg inomhussektioner med planritningsbilder och korrekt numrering
  const indoorSectionsArr: string[] = []

  for (const [, group] of indoorByFloorPlan) {
    const sectionTitle = group.building
      ? `${group.name} (${group.building}) — ${group.inspections.length} st`
      : `${group.name} — ${group.inspections.length} st`

    // Sortera efter placed_at inom gruppen
    const sortedInGroup = [...group.inspections].sort((a: any, b: any) =>
      new Date(a.station?.placed_at || 0).getTime() - new Date(b.station?.placed_at || 0).getTime()
    )

    // Rendera planritning + markörer som screenshot (markörer inbakade i bilden)
    let floorPlanHtml = ''
    if (group.imagePath) {
      const imageBase64 = await fetchFloorPlanBase64(group.imagePath)
      if (imageBase64) {
        // Numret är stationens rad i gruppens tabell (placed_at-ordning)
        const stationMarkers = sortedInGroup
          .map((insp: any, idx: number) => ({ insp, s: resolveReportStation(insp, idx + 1, stationTypes) }))
          .filter(({ insp }) => insp.station?.position_x_percent && insp.station?.position_y_percent)
          .map(({ insp, s }) => ({
            ...s,
            x: insp.station.position_x_percent,
            y: insp.station.position_y_percent,
          }))
        const compositeBase64 = await renderFloorPlanScreenshot(browser, imageBase64, stationMarkers)
        if (compositeBase64) {
          floorPlanHtml = `
            <div style="margin-bottom: 12px;">
              <div style="border-radius: 8px; overflow: hidden; border: 1px solid ${beGoneColors.border};">
                <img src="${compositeBase64}" style="width: 100%; height: auto; max-height: 170mm; display: block;" alt="${group.name}" />
              </div>
              ${reportLegendHtml(stationMarkers)}
            </div>
          `
        }
      }
    }

    const rows = sortedInGroup.map((insp: any, index: number) => {
      const statusColor = getStatusColor(insp.status, dynamicColors)
      const stationNumber = index + 1
      return `
        <tr>
          <td><strong>${stationNumber}</strong></td>
          <td>${insp.station?.station_type_data?.name || insp.station?.station_type || '-'}${insp.station?.is_addon ? `<br/><span style="font-size:8px;color:#7c3aed;">Tillägg utöver avtal</span>` : ''}</td>
          <td><span class="status-badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">${getStatusLabel(insp.status, dynamicLabels)}</span></td>
          <td>${insp.station?.station_type_data?.measurement_label || '-'}</td>
          <td class="text-right">${insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '-'}</td>
          <td>${insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-'}</td>
          <td>${insp.findings || '-'}</td>
          <td>${insp.preparation?.name || '-'}</td>
          <td class="text-small">${insp.preparation?.registration_number || '-'}</td>
          <td class="text-small">${formatDateTime(insp.inspected_at)}</td>
        </tr>
      `
    }).join('')

    indoorSectionsArr.push(`
      <div class="floor-plan-block">
        <div class="section-header">
          <span class="section-icon">🏠</span>
          Inomhusstationer — ${sectionTitle}
        </div>
        ${floorPlanHtml}
      </div>
      <div class="table-block">
        <table>
          <thead>
            <tr>
              <th>Nr</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Mätvärde avser</th>
              <th class="text-right">Mätvärde</th>
              <th>Enhet</th>
              <th>Anteckning</th>
              <th>Preparat</th>
              <th>Reg.nr</th>
              <th>Kontrollerad</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `)
  }

  const indoorSections = indoorSectionsArr.join('')

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Kontrollrapport - ${customer?.company_name || 'Kund'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: ${beGoneColors.darkGray};
      background: white;
      line-height: 1.5;
      font-size: 11px;
    }

    .container {
      max-width: 297mm;
      margin: 0 auto;
      padding: 12mm 15mm;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${beGoneColors.accent};
      padding-bottom: 16px;
      margin-bottom: 20px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: ${beGoneColors.accent};
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      color: white;
    }

    .logo-text {
      font-size: 24px;
      font-weight: 800;
      color: ${beGoneColors.primary};
    }

    .header-meta {
      text-align: right;
    }

    .header-title {
      font-size: 13px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .header-date {
      font-size: 11px;
      color: ${beGoneColors.mediumGray};
    }

    .info-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 16px;
    }

    .info-block {
      padding: 12px 16px;
      background: ${beGoneColors.lightestGray};
      border-radius: 8px;
      border: 1px solid ${beGoneColors.divider};
    }

    .info-block-title {
      font-size: 10px;
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .info-item {
      display: flex;
      gap: 8px;
      margin-bottom: 3px;
      font-size: 11px;
    }

    .info-label {
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      min-width: 80px;
    }

    .info-value {
      color: ${beGoneColors.darkGray};
      font-weight: 500;
    }

    .summary-bar {
      display: flex;
      gap: 20px;
      align-items: center;
      padding: 10px 16px;
      background: ${beGoneColors.lightGray};
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .summary-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .floor-plan-block {
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
      margin-bottom: 0;
    }

    .table-block {
      break-before: avoid;
      page-break-before: avoid;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 20px;
    }

    .section-header {
      font-size: 14px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${beGoneColors.divider};
    }

    .section-icon {
      font-size: 16px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 6px;
      overflow: hidden;
      font-size: 10px;
    }

    thead { background: ${beGoneColors.primary}; }

    th {
      padding: 7px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 9px;
      color: white;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    td {
      padding: 5px 6px;
      font-size: 10px;
      color: ${beGoneColors.darkGray};
      border-bottom: 1px solid ${beGoneColors.lightGray};
    }

    tr:nth-child(even) td {
      background: ${beGoneColors.lightestGray};
    }

    .text-right { text-align: right; }
    .text-small { font-size: 9px; }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      white-space: nowrap;
    }

    .notes-section {
      padding: 10px 16px;
      background: ${beGoneColors.lightestGray};
      border-radius: 8px;
      border: 1px solid ${beGoneColors.divider};
      margin-bottom: 20px;
    }

    .notes-label {
      font-size: 10px;
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .notes-text {
      font-size: 11px;
      color: ${beGoneColors.darkGray};
      white-space: pre-wrap;
    }

    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 3px solid ${beGoneColors.accent};
      text-align: center;
      page-break-inside: avoid;
    }

    .footer-text {
      font-size: 10px;
      color: ${beGoneColors.mediumGray};
      line-height: 1.6;
    }

    .footer-contact {
      margin-top: 8px;
      font-size: 10px;
      color: ${beGoneColors.darkGray};
    }

    .footer-contact a {
      color: ${beGoneColors.accent};
      text-decoration: none;
      font-weight: 600;
    }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .container { padding: 8mm 10mm; }
      .section { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">B</div>
        <div class="logo-text">BeGone</div>
      </div>
      <div class="header-meta">
        <div class="header-title">Kontrollrapport</div>
        <div class="header-date">${formatDate(session?.completed_at || session?.created_at)}</div>
      </div>
    </div>

    <div class="info-row">
      <div class="info-block">
        <div class="info-block-title">Utförare</div>
        <div class="info-item"><span class="info-label">Företag</span><span class="info-value">BeGone Skadedjur & Sanering AB</span></div>
        <div class="info-item"><span class="info-label">Org.nr</span><span class="info-value">559378-9208</span></div>
        <div class="info-item"><span class="info-label">Tekniker</span><span class="info-value">${technician?.name || '-'}</span></div>
        <div class="info-item"><span class="info-label">Email</span><span class="info-value">${technician?.email || '-'}</span></div>
        <div class="info-item"><span class="info-label">Telefon</span><span class="info-value">010 280 44 10</span></div>
      </div>
      <div class="info-block">
        <div class="info-block-title">Kund</div>
        <div class="info-item"><span class="info-label">Företag</span><span class="info-value">${customer?.company_name || '-'}</span></div>
        <div class="info-item"><span class="info-label">Kontakt</span><span class="info-value">${customer?.contact_person || '-'}</span></div>
        <div class="info-item"><span class="info-label">Adress</span><span class="info-value">${customer?.contact_address || '-'}</span></div>
        <div class="info-item"><span class="info-label">Telefon</span><span class="info-value">${customer?.contact_phone || '-'}</span></div>
        <div class="info-item"><span class="info-label">Email</span><span class="info-value">${customer?.contact_email || '-'}</span></div>
      </div>
    </div>

    <div class="summary-bar">
      <span style="color: ${beGoneColors.primary};">Totalt: ${allInspections.length} stationer</span>
      <div class="summary-item"><div class="summary-dot" style="background: ${getStatusColor('none', dynamicColors)};"></div> ${getStatusLabel('none', dynamicLabels)}: ${levelCounts.none}</div>
      <div class="summary-item"><div class="summary-dot" style="background: ${getStatusColor('low', dynamicColors)};"></div> ${getStatusLabel('low', dynamicLabels)}: ${levelCounts.low}</div>
      <div class="summary-item"><div class="summary-dot" style="background: ${getStatusColor('medium', dynamicColors)};"></div> ${getStatusLabel('medium', dynamicLabels)}: ${levelCounts.medium}</div>
      <div class="summary-item"><div class="summary-dot" style="background: ${getStatusColor('high', dynamicColors)};"></div> ${getStatusLabel('high', dynamicLabels)}: ${levelCounts.high}</div>
    </div>

    ${session?.notes ? `
    <div class="notes-section">
      <div class="notes-label">Anteckningar</div>
      <div class="notes-text">${session.notes}</div>
    </div>
    ` : ''}

    ${sessionPhotosHtml}

    ${sortedOutdoor.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">📍</span>
        Utomhusstationer (${sortedOutdoor.length} st)
      </div>
      ${mapImageHtml}
      <table>
        <thead>
          <tr>
            <th>Nr</th>
            <th>Typ</th>
            <th>Status</th>
            <th>Mätvärde avser</th>
            <th class="text-right">Mätvärde</th>
            <th>Enhet</th>
            <th>Anteckning</th>
            <th>Preparat</th>
            <th>Reg.nr</th>
            <th>Kontrollerad</th>
          </tr>
        </thead>
        <tbody>
          ${outdoorTableRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${indoorSections}

    <div class="footer">
      <div class="footer-text">
        <strong>BeGone Skadedjur & Sanering AB</strong><br>
        Professionell skadedjursbekämpning
      </div>
      <div class="footer-contact">
        <strong>Kontakt:</strong> info@begone.se | 010 280 44 10 |
        <a href="https://begone.se">www.begone.se</a>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

const escapeHtml = (value: string) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Mejlmall för kontrollrapport, samma formspråk som saneringsrapportens kundmejl (send-work-report)
function getInspectionReportEmailHtml(p: {
  recipientName: string
  customerName: string
  address: string
  caseNumber: string
  dateText: string
  technicianName: string
}): string {
  const row = (label: string, value: string) => value ? `<tr>
                  <td style="padding:6px 0;width:130px;color:#64748b;font-size:13px;vertical-align:top;">${label}</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${escapeHtml(value)}</td>
                </tr>` : ''
  const greeting = p.recipientName ? `Hej ${escapeHtml(p.recipientName)},` : 'Hej,'
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Kontrollrapport</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;text-align:left;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#20c58f;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                      <span style="color:white;font-size:18px;font-weight:800;line-height:36px;">B</span>
                    </td>
                    <td style="padding-left:12px;color:white;font-size:20px;font-weight:700;">BeGone</td>
                  </tr>
                </table>
              </td>
              <td style="text-align:right;color:#94a3b8;font-size:12px;vertical-align:middle;">
                KONTROLLRAPPORT${p.caseNumber ? `<br><span style="color:#20c58f;font-weight:600;">${escapeHtml(p.caseNumber)}</span>` : ''}
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:white;padding:40px;">
          <p style="margin:0 0 8px 0;font-size:16px;color:#1e293b;">${greeting}</p>
          <p style="margin:0 0 28px 0;color:#64748b;font-size:14px;line-height:1.6;">
            Här kommer kontrollrapporten från vårt senaste servicebesök. Rapporten med stationernas status och våra iakttagelser finns bifogad som PDF.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 16px 0;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">Servicebesök</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Kund', p.customerName)}
                ${row('Adress', p.address)}
                ${row('Datum', p.dateText)}
                ${row('Ärende nr', p.caseNumber)}
                ${row('Tekniker', p.technicianName)}
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 24px 0;color:#64748b;font-size:13px;line-height:1.6;">
            Alla kontrollrapporter finns även i kundportalen under Kontrollrapporter.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:3px solid #20c58f;border-radius:0 6px 6px 0;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 2px 0;font-size:13px;font-weight:600;color:#1e293b;">Har du frågor?</p>
              <p style="margin:0;font-size:13px;color:#64748b;">Kontakta oss på <a href="mailto:info@begone.se" style="color:#20c58f;text-decoration:none;">info@begone.se</a> eller ring 010 280 44 10.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;">BeGone Skadedjur & Sanering AB</p>
          <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">Telefon: 010 280 44 10 | E-post: info@begone.se | www.begone.se</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">Org.nr: 559378-9208</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Med sendEmail skickas rapporten som bilaga till kunden i stället för att returneras.
  // Utskick med företagets avsändare kräver intern roll; nedladdning räcker med inloggning.
  const sendEmail = req.body?.sendEmail as { to?: string; recipientName?: string; caseNumber?: string } | undefined
  const auth = sendEmail
    ? await requireAuth(req, res, ['admin', 'koordinator', 'technician'])
    : await requireAuthenticated(req, res)
  if (!auth) return

  const emailTo = (sendEmail?.to || '').trim()
  if (sendEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'E-posttjänsten är inte konfigurerad' })
    }
  }

  try {
    const { session, customer, technician, outdoorInspections, indoorInspections, summary, sessionPhotos } = req.body

    if (!session || !summary) {
      return res.status(400).json({ error: 'Missing session or summary data' })
    }

    const customerName = (customer?.company_name || 'Kund').replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
    const sessionDate = session.completed_at || session.created_at
    const dateStr = sessionDate ? new Date(sessionDate).toISOString().slice(0, 10) : 'okänt-datum'
    const filename = `Avtalat Servicebesök - ${customerName} ${dateStr}.pdf`

    // Hämta dynamiska etiketter och färger från databasen
    const { data: labelRows } = await supabase
      .from('inspection_status_labels')
      .select('level, label, color')
    const dynamicLabels: Record<string, string> = {}
    const dynamicColors: Record<string, string> = {}
    for (const row of (labelRows || [])) {
      dynamicLabels[row.level] = row.label
      dynamicColors[row.level] = row.color
    }

    // Starta browser FÖRE HTML-generering — behövs för satellitkartan
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    })

    const html = await generateInspectionReportHTML({
      session,
      customer,
      technician,
      outdoorInspections: outdoorInspections || [],
      indoorInspections: indoorInspections || [],
      summary,
      dynamicLabels,
      dynamicColors,
      sessionPhotos: sessionPhotos || []
    }, browser)

    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    })

    await browser.close()

    if (sendEmail) {
      const pdfBuffer = Buffer.from(pdf)
      if (pdfBuffer.length > MAX_EMAIL_ATTACHMENT_BYTES) {
        const sizeMb = (pdfBuffer.length / (1024 * 1024)).toFixed(1).replace('.', ',')
        return res.status(413).json({
          error: `Rapporten är ${sizeMb} MB, för stor för att skickas som bilaga (max 8 MB). Ladda ned den och dela den på annat sätt.`
        })
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
      })

      await transporter.sendMail({
        from: 'BeGone Kontrollrapporter <noreply@begone.se>',
        replyTo: 'info@begone.se',
        to: emailTo,
        subject: `Kontrollrapport ${customer?.company_name ? `för ${customer.company_name} ` : ''}(${dateStr})`,
        html: getInspectionReportEmailHtml({
          recipientName: sendEmail.recipientName || customer?.contact_person || '',
          customerName: customer?.company_name || '',
          address: customer?.contact_address || '',
          caseNumber: sendEmail.caseNumber || '',
          dateText: formatDate(sessionDate),
          technicianName: technician?.name || ''
        }),
        attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }]
      })

      console.log('Inspection report emailed to:', emailTo, 'by user', auth.userId)
      return res.status(200).json({ success: true, sentTo: emailTo })
    }

    const pdfBase64 = Buffer.from(pdf).toString('base64')

    res.status(200).json({
      success: true,
      pdf: pdfBase64,
      filename
    })

  } catch (error) {
    console.error('Inspection report PDF generation error:', error)
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

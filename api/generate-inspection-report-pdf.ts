// api/generate-inspection-report-pdf.ts
// Puppeteer-baserad PDF-generering för kontrollrapporter (inspektionssessioner)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ok': return beGoneColors.success
    case 'activity': return beGoneColors.warning
    case 'needs_service': return beGoneColors.error
    case 'replaced': return '#3B82F6'
    default: return beGoneColors.mediumGray
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    ok: 'OK',
    activity: 'Aktivitet',
    needs_service: 'Behöver service',
    replaced: 'Utbytt',
    not_inspected: 'Ej kontrollerad'
  }
  return labels[status] || status || '-'
}

// Rendera Google Maps satellitbild via Puppeteer + JavaScript API (Static API blockerar satellit i EU/EEA)
async function renderSatelliteMapScreenshot(browser: any, inspections: any[]): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const stations = inspections
    .filter((i: any) => i.station?.latitude && i.station?.longitude)
    .sort((a: any, b: any) =>
      new Date(a.station.placed_at).getTime() - new Date(b.station.placed_at).getTime()
    )

  if (stations.length === 0) return null

  const markersJSON = JSON.stringify(stations.map((s: any, i: number) => ({
    lat: parseFloat(s.station.latitude),
    lng: parseFloat(s.station.longitude),
    label: String(i + 1),
    color: s.status === 'ok' ? '#22C55E' : s.status === 'activity' ? '#F59E0B' : s.status === 'needs_service' ? '#EF4444' : '#3B82F6'
  })))

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
          label: { text: m.label, color: 'white', fontWeight: 'bold', fontSize: '9px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: m.color,
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 1.5,
            scale: 10
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
  stations: Array<{ x: number; y: number; label: string; color: string }>
): Promise<string | null> {
  const markerHtml = stations.map(s => `
    <div style="position:absolute;left:${s.x}%;top:${s.y}%;
      transform:translate(-50%,-50%);width:22px;height:22px;
      border-radius:50%;background:${s.color};color:white;
      font-size:10px;font-weight:700;display:flex;
      align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);">
      ${s.label}
    </div>`).join('')

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

async function generateInspectionReportHTML(data: {
  session: any
  customer: any
  technician: any
  outdoorInspections: any[]
  indoorInspections: any[]
  summary: { ok: number; warning: number; critical: number; total: number }
}, browser: any) {
  const { session, customer, technician, outdoorInspections, indoorInspections, summary } = data

  // Sortera utomhusinspektioner efter placed_at för korrekt numrering (samma som kundportalen)
  const sortedOutdoor = [...outdoorInspections].sort((a, b) =>
    new Date(a.station?.placed_at || 0).getTime() - new Date(b.station?.placed_at || 0).getTime()
  )

  // Rendera Google Maps satellitbild via Puppeteer
  const mapBase64 = await renderSatelliteMapScreenshot(browser, sortedOutdoor)
  const mapImageHtml = mapBase64 ? `
    <div style="margin-bottom: 12px; border-radius: 8px; overflow: hidden; border: 1px solid ${beGoneColors.border};">
      <img src="${mapBase64}" style="width: 100%; height: auto; display: block;" alt="Stationskarta" />
    </div>
  ` : ''

  // Bygg nummermappning för utomhus (1, 2, 3... baserat på placed_at-order)
  const outdoorTableRows = sortedOutdoor.map((insp: any, index: number) => {
    const statusColor = getStatusColor(insp.status)
    const stationNumber = index + 1
    return `
      <tr>
        <td><strong>${stationNumber}</strong></td>
        <td>${insp.station?.station_type_data?.name || insp.station?.equipment_type || '-'}</td>
        <td><span class="status-badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">${getStatusLabel(insp.status)}</span></td>
        <td>${insp.station?.station_type_data?.measurement_label || '-'}</td>
        <td class="text-right">${insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '-'}</td>
        <td>${insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-'}</td>
        <td>${insp.findings || '-'}</td>
        <td>${insp.preparation?.name || '-'}</td>
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
        const stationMarkers = sortedInGroup
          .filter((insp: any) => insp.station?.position_x_percent && insp.station?.position_y_percent)
          .map((insp: any, idx: number) => ({
            x: insp.station.position_x_percent,
            y: insp.station.position_y_percent,
            label: String(idx + 1),
            color: getStatusColor(insp.status)
          }))
        const compositeBase64 = await renderFloorPlanScreenshot(browser, imageBase64, stationMarkers)
        if (compositeBase64) {
          floorPlanHtml = `
            <div style="margin-bottom: 12px; border-radius: 8px; overflow: hidden; border: 1px solid ${beGoneColors.border};">
              <img src="${compositeBase64}" style="width: 100%; height: auto; max-height: 170mm; display: block;" alt="${group.name}" />
            </div>
          `
        }
      }
    }

    const rows = sortedInGroup.map((insp: any, index: number) => {
      const statusColor = getStatusColor(insp.status)
      const stationNumber = index + 1
      return `
        <tr>
          <td><strong>${stationNumber}</strong></td>
          <td>${insp.station?.station_type_data?.name || insp.station?.station_type || '-'}</td>
          <td><span class="status-badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">${getStatusLabel(insp.status)}</span></td>
          <td>${insp.station?.station_type_data?.measurement_label || '-'}</td>
          <td class="text-right">${insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '-'}</td>
          <td>${insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-'}</td>
          <td>${insp.findings || '-'}</td>
          <td>${insp.preparation?.name || '-'}</td>
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
      <span style="color: ${beGoneColors.primary};">Totalt: ${summary.total} stationer</span>
      <div class="summary-item"><div class="summary-dot" style="background: ${beGoneColors.success};"></div> OK: ${summary.ok}</div>
      <div class="summary-item"><div class="summary-dot" style="background: ${beGoneColors.warning};"></div> Varning: ${summary.warning}</div>
      <div class="summary-item"><div class="summary-dot" style="background: ${beGoneColors.error};"></div> Kritisk: ${summary.critical}</div>
    </div>

    ${session?.notes ? `
    <div class="notes-section">
      <div class="notes-label">Anteckningar</div>
      <div class="notes-text">${session.notes}</div>
    </div>
    ` : ''}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { session, customer, technician, outdoorInspections, indoorInspections, summary } = req.body

    if (!session || !summary) {
      return res.status(400).json({ error: 'Missing session or summary data' })
    }

    const customerName = (customer?.company_name || 'kund').replace(/[^a-zåäöA-ZÅÄÖ0-9]/g, '_')
    const sessionDate = session.completed_at || session.created_at
    const dateStr = sessionDate ? new Date(sessionDate).toISOString().slice(0, 10) : 'okänt-datum'
    const filename = `Kontrollrapport_${customerName}_${dateStr}.pdf`

    // Starta browser FÖRE HTML-generering — behövs för satellitkartan
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const html = await generateInspectionReportHTML({
      session,
      customer,
      technician,
      outdoorInspections: outdoorInspections || [],
      indoorInspections: indoorInspections || [],
      summary
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

// api/generate-inspection-report-pdf.ts
// Puppeteer-baserad PDF-generering för kontrollrapporter (inspektionssessioner)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

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

function generateInspectionReportHTML(data: {
  session: any
  customer: any
  technician: any
  outdoorInspections: any[]
  indoorInspections: any[]
  summary: { ok: number; warning: number; critical: number; total: number }
}) {
  const { session, customer, technician, outdoorInspections, indoorInspections, summary } = data

  // Group indoor inspections by floor plan
  const indoorByFloorPlan = new Map<string, { name: string; building: string | null; inspections: any[] }>()
  for (const insp of indoorInspections) {
    const fp = insp.station?.floor_plan
    const fpId = fp?.id || 'unknown'
    if (!indoorByFloorPlan.has(fpId)) {
      indoorByFloorPlan.set(fpId, {
        name: fp?.name || 'Okänd planritning',
        building: fp?.building_name || null,
        inspections: []
      })
    }
    indoorByFloorPlan.get(fpId)!.inspections.push(insp)
  }

  const outdoorTableRows = outdoorInspections.map(insp => {
    const statusColor = getStatusColor(insp.status)
    return `
      <tr>
        <td>${insp.station?.serial_number || '-'}</td>
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

  const indoorSections = Array.from(indoorByFloorPlan.entries()).map(([, group]) => {
    const sectionTitle = group.building
      ? `${group.name} (${group.building}) — ${group.inspections.length} st`
      : `${group.name} — ${group.inspections.length} st`

    const rows = group.inspections.map((insp: any) => {
      const statusColor = getStatusColor(insp.status)
      const station = insp.station
      return `
        <tr>
          <td>${station?.station_number || '-'}</td>
          <td>${station?.station_type_data?.name || station?.station_type || '-'}</td>
          <td><span class="status-badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">${getStatusLabel(insp.status)}</span></td>
          <td>${station?.station_type_data?.measurement_label || '-'}</td>
          <td class="text-right">${insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '-'}</td>
          <td>${insp.measurement_unit || station?.station_type_data?.measurement_unit || '-'}</td>
          <td>${insp.findings || '-'}</td>
          <td>${insp.preparation?.name || '-'}</td>
          <td class="text-small">${formatDateTime(insp.inspected_at)}</td>
        </tr>
      `
    }).join('')

    return `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">🏠</span>
          Inomhusstationer — ${sectionTitle}
        </div>
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
    `
  }).join('')

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
        <div class="header-date">${formatDate(session?.completed_at)}</div>
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

    ${outdoorInspections.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">📍</span>
        Utomhusstationer (${outdoorInspections.length} st)
      </div>
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

    const html = generateInspectionReportHTML({
      session,
      customer,
      technician,
      outdoorInspections: outdoorInspections || [],
      indoorInspections: indoorInspections || [],
      summary
    })

    const customerName = (customer?.company_name || 'kund').replace(/[^a-zåäöA-ZÅÄÖ0-9]/g, '_')
    const dateStr = session.completed_at ? new Date(session.completed_at).toISOString().slice(0, 10) : 'okänt-datum'
    const filename = `Kontrollrapport_${customerName}_${dateStr}.pdf`

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

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

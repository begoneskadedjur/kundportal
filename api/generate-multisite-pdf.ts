import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Helper function to format date
const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('sv-SE')
}

// Helper function to get status display
const getStatusDisplay = (status: string): string => {
  const statusMap: Record<string, string> = {
    'öppen': 'Öppen',
    'open': 'Öppen',
    'scheduled': 'Schemalagd',
    'schemalagd': 'Schemalagd',
    'in_progress': 'Pågående',
    'pågående': 'Pågående',
    'completed': 'Genomförd',
    'completed_closed': 'Avslutad',
    'slutförd': 'Slutförd',
    'stängd': 'Stängd',
    'canceled': 'Avbruten',
    'pending': 'Väntande',
    'requested': 'Öppen',
    'on_hold': 'Pausad',
    'offert_skickad': 'Offert skickad',
    'genomförd': 'Genomförd',
    'avslutad': 'Avslutad'
  }
  return statusMap[status.toLowerCase()] || status
}

// Generate HTML content for multisite PDF
const generateMultisitePDFHTML = (data: any) => {
  const { organization, sites, cases, statistics, period, roleType } = data

  // Calculate insights
  const insights = []
  
  // 1. Completion rate insight
  if (statistics.completionRate >= 80) {
    insights.push({
      icon: '✅',
      title: 'Utmärkt avslutningsgrad',
      value: `${statistics.completionRate}%`,
      description: 'Hög effektivitet i ärendehantering'
    })
  } else if (statistics.completionRate >= 60) {
    insights.push({
      icon: '📊',
      title: 'God avslutningsgrad',
      value: `${statistics.completionRate}%`,
      description: 'Fortsatt förbättringspotential'
    })
  } else {
    insights.push({
      icon: '⚠️',
      title: 'Låg avslutningsgrad',
      value: `${statistics.completionRate}%`,
      description: 'Behöver uppmärksamhet'
    })
  }

  // 2. Sites overview
  insights.push({
    icon: '🏢',
    title: 'Antal enheter',
    value: statistics.totalSites.toString(),
    description: getRoleDescription(roleType)
  })

  // 3. Response time insight
  if (statistics.avgResponseTime <= 3) {
    insights.push({
      icon: '⚡',
      title: 'Snabb responstid',
      value: `${statistics.avgResponseTime} dagar`,
      description: 'Utmärkt kundservice'
    })
  } else if (statistics.avgResponseTime <= 7) {
    insights.push({
      icon: '⏱️',
      title: 'Normal responstid',
      value: `${statistics.avgResponseTime} dagar`,
      description: 'Inom branschstandard'
    })
  } else {
    insights.push({
      icon: '🐌',
      title: 'Långsam responstid',
      value: `${statistics.avgResponseTime} dagar`,
      description: 'Kan förbättras'
    })
  }

  // 4. Cost efficiency
  const avgCostPerCase = statistics.totalCases > 0 
    ? Math.round(statistics.totalCost / statistics.totalCases)
    : 0
  insights.push({
    icon: '💰',
    title: 'Genomsnittlig kostnad',
    value: formatCurrency(avgCostPerCase),
    description: 'Per ärende'
  })

  // 5. Most common pest
  if (statistics.topPestType) {
    insights.push({
      icon: '🐛',
      title: 'Vanligaste skadedjur',
      value: statistics.topPestType,
      description: `${statistics.pestTypeCounts[statistics.topPestType] || 0} ärenden`
    })
  }

  // 6. Active cases status
  if (statistics.activeCases === 0) {
    insights.push({
      icon: '✨',
      title: 'Inga aktiva ärenden',
      value: '0',
      description: 'Alla ärenden avslutade'
    })
  } else {
    insights.push({
      icon: '📋',
      title: 'Aktiva ärenden',
      value: statistics.activeCases.toString(),
      description: 'Pågående behandlingar'
    })
  }

  // Period display
  const periodDisplay = {
    '30d': 'Senaste 30 dagarna',
    '3m': 'Senaste 3 månaderna',
    '6m': 'Senaste 6 månaderna',
    '1y': 'Senaste året',
    'all': 'Hela tiden'
  }[period] || period

  // Get role description
  function getRoleDescription(role: string): string {
    switch(role) {
      case 'verksamhetschef':
        return 'Hela organisationen'
      case 'regionchef':
        return 'Din region'
      case 'platsansvarig':
        return 'Din enhet'
      default:
        return 'Tilldelade enheter'
    }
  }

  // Generate sites table rows
  const sitesTableRows = sites.slice(0, 10).map((site: any) => `
    <tr>
      <td>${site.site_name}</td>
      <td>${site.region || '-'}</td>
      <td class="text-center">${site.activeCases || 0}</td>
      <td class="text-center">${site.completedCases || 0}</td>
      <td class="text-right">${site.totalCost ? formatCurrency(site.totalCost) : '-'}</td>
    </tr>
  `).join('')

  // Generate cases table rows
  const casesTableRows = cases.slice(0, 15).map((caseItem: any) => `
    <tr>
      <td>${caseItem.title}</td>
      <td>${caseItem.site_name || 'Okänd enhet'}</td>
      <td><span class="status-badge">${getStatusDisplay(caseItem.status)}</span></td>
      <td>${caseItem.pest_type || '-'}</td>
      <td>${formatDate(caseItem.scheduled_start)}</td>
      <td class="text-right">${caseItem.price ? formatCurrency(caseItem.price) : '-'}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Organisationsrapport - ${organization.organization_name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      background: white;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 32px;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }
    
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }
    
    .report-meta {
      text-align: right;
    }
    
    .report-date {
      color: #64748b;
      font-size: 14px;
    }
    
    .report-period {
      color: #8b5cf6;
      font-weight: 600;
      font-size: 14px;
      margin-top: 4px;
    }
    
    /* Title Section */
    .title-section {
      margin-bottom: 20px;
    }
    
    .main-title {
      font-size: 32px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }
    
    .company-name {
      font-size: 20px;
      color: #64748b;
      font-weight: 500;
    }
    
    .role-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      color: white;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .kpi-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      page-break-inside: avoid;
    }
    
    .kpi-card:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    
    .kpi-label {
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    
    .kpi-subtitle {
      color: #94a3b8;
      font-size: 13px;
    }
    
    /* Insights Section */
    .insights-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .insights-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .insight-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      gap: 8px;
      align-items: start;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .insight-icon {
      font-size: 20px;
      line-height: 1;
      min-width: 20px;
    }
    
    .insight-content {
      flex: 1;
    }
    
    .insight-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 2px;
      line-height: 1.3;
    }
    
    .insight-value {
      font-size: 16px;
      font-weight: 700;
      color: #8b5cf6;
      margin-bottom: 4px;
      line-height: 1.2;
    }
    
    .insight-description {
      font-size: 11px;
      color: #64748b;
      line-height: 1.3;
    }
    
    /* Table Section */
    .table-section {
      margin-bottom: 24px;
      page-break-before: auto;
      page-break-inside: avoid;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      page-break-inside: avoid;
    }
    
    thead {
      background: #f8fafc;
    }
    
    th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    td {
      padding: 8px 12px;
      font-size: 12px;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tr:hover {
      background: #f8fafc;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: #dbeafe;
      color: #1e40af;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      page-break-inside: avoid;
    }
    
    .footer-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .footer-text {
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.6;
    }
    
    .footer-contact {
      margin-top: 12px;
      color: #64748b;
      font-size: 13px;
    }
    
    .footer-contact a {
      color: #8b5cf6;
      text-decoration: none;
      font-weight: 600;
    }
    
    /* Page Break Rules */
    .title-section {
      page-break-after: avoid;
    }
    
    .insights-section {
      page-break-before: avoid;
    }
    
    .table-section {
      page-break-before: auto;
    }
    
    /* Ensure orphan/widow control */
    h1, h2, .section-title {
      orphans: 2;
      widows: 2;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      
      .container {
        padding: 16px;
      }
      
      .kpi-card:hover {
        background: #f8fafc;
        border-color: #e2e8f0;
      }
      
      tr:hover {
        background: transparent;
      }
      
      /* Enhanced page break control for print */
      .kpi-grid, .insights-section, .table-section {
        page-break-inside: avoid;
      }
      
      .insights-grid {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      .insight-card, .kpi-card {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      
      /* Optimize spacing for print */
      .kpi-grid {
        margin-bottom: 16px;
      }
      
      .insights-section {
        margin-bottom: 16px;
      }
      
      /* Better table handling for print */
      table {
        page-break-inside: avoid;
      }
      
      thead {
        display: table-header-group;
      }
      
      tbody {
        display: table-row-group;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <div class="logo-icon">B</div>
        <div class="logo-text">BeGone</div>
      </div>
      <div class="report-meta">
        <div class="report-date">${new Date().toLocaleDateString('sv-SE', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
        <div class="report-period">${periodDisplay}</div>
      </div>
    </div>
    
    <!-- Title Section -->
    <div class="title-section">
      <h1 class="main-title">Organisationsrapport</h1>
      <div class="company-name">${organization.organization_name}</div>
      <div class="role-badge">${getRoleDescription(roleType)}</div>
    </div>
    
    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Totalt antal ärenden</div>
        <div class="kpi-value">${statistics.totalCases}</div>
        <div class="kpi-subtitle">${periodDisplay}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avslutningsgrad</div>
        <div class="kpi-value">${statistics.completionRate}%</div>
        <div class="kpi-subtitle">${statistics.completedCases} av ${statistics.totalCases} avslutade</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Antal enheter</div>
        <div class="kpi-value">${statistics.totalSites}</div>
        <div class="kpi-subtitle">${getRoleDescription(roleType)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Aktiva ärenden</div>
        <div class="kpi-value">${statistics.activeCases}</div>
        <div class="kpi-subtitle">${statistics.activeCases === 1 ? 'Aktivt ärende' : 'Aktiva ärenden'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Genomsnittlig responstid</div>
        <div class="kpi-value">${statistics.avgResponseTime} dagar</div>
        <div class="kpi-subtitle">Från registrering till åtgärd</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total kostnad</div>
        <div class="kpi-value">${formatCurrency(statistics.totalCost)}</div>
        <div class="kpi-subtitle">${formatCurrency(avgCostPerCase)} per ärende</div>
      </div>
    </div>
    
    <!-- Insights Section -->
    <div class="insights-section">
      <h2 class="section-title">
        <span>💡</span>
        Viktiga insikter
      </h2>
      <div class="insights-grid">
        ${insights.map(insight => `
          <div class="insight-card">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
              <div class="insight-title">${insight.title}</div>
              <div class="insight-value">${insight.value}</div>
              <div class="insight-description">${insight.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Sites Table Section -->
    ${sites.length > 0 ? `
      <div class="table-section">
        <h2 class="section-title">
          <span>🏢</span>
          Enhetsöversikt
        </h2>
        <table>
          <thead>
            <tr>
              <th>Enhet</th>
              <th>Region</th>
              <th class="text-center">Aktiva</th>
              <th class="text-center">Avslutade</th>
              <th class="text-right">Kostnad</th>
            </tr>
          </thead>
          <tbody>
            ${sitesTableRows}
          </tbody>
        </table>
      </div>
    ` : ''}
    
    <!-- Cases Table Section -->
    <div class="table-section">
      <h2 class="section-title">
        <span>📋</span>
        Senaste ärenden
      </h2>
      <table>
        <thead>
          <tr>
            <th>Ärende</th>
            <th>Enhet</th>
            <th>Status</th>
            <th>Skadedjur</th>
            <th>Datum</th>
            <th class="text-right">Kostnad</th>
          </tr>
        </thead>
        <tbody>
          ${casesTableRows}
        </tbody>
      </table>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-logo">
        <div class="logo-icon" style="width: 24px; height: 24px; font-size: 14px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);">B</div>
        <div class="logo-text" style="font-size: 18px;">BeGone</div>
      </div>
      <div class="footer-text">
        Professionell skadedjursbekämpning för organisationer<br>
        Vi säkerställer en trygg och skadedjursfri miljö för alla era enheter
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
    const { organization, sites, cases, statistics, period, roleType } = req.body

    if (!organization || !statistics) {
      return res.status(400).json({ error: 'Missing required data' })
    }

    // Generate HTML content
    const html = generateMultisitePDFHTML({ 
      organization, 
      sites: sites || [], 
      cases: cases || [], 
      statistics, 
      period,
      roleType: roleType || 'verksamhetschef'
    })

    // Launch Puppeteer with Chrome
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    
    // Set content with proper encoding
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Generate PDF with optimized settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      },
      // Optimize for smaller file size
      tagged: false,
      omitBackground: false
    })

    await browser.close()

    // Return PDF as base64
    const pdfBase64 = Buffer.from(pdf).toString('base64')
    
    res.status(200).json({ 
      success: true, 
      pdf: pdfBase64,
      filename: `BeGone_Organisationsrapport_${organization.organization_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
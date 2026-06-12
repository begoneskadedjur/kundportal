import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { requireAuthenticated } from './_lib/auth'

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

// Helper function to get customer status display
const getCustomerStatusDisplay = (status: string): string => {
  const statusMap: Record<string, string> = {
    'öppen': 'Öppen',
    'open': 'Öppen',
    'scheduled': 'Bokad',
    'in_progress': 'Pågående',
    'pågående': 'Pågående',
    'completed': 'Genomförd',
    'completed_closed': 'Avslutad',
    'canceled': 'Avbruten',
    'pending': 'Väntande',
    'requested': 'Öppen',
    'on_hold': 'Pausad',
    'offert_skickad': 'Offert skickad',
    'genomförd': 'Genomförd',
    'avslutad': 'Avslutad',
    'offert_tackad_nej': 'Offert tackad nej',
    'makulerad': 'Makulerad',
    'kontakta_kund': 'Kontakta kund',
    'påbörjad': 'Påbörjad',
    'utförd_väntar_på_rapport': 'Utförd, väntar på rapport',
    'avvaktar_inventering': 'Avvaktar inventering',
    'återbesök': 'Återbesök'
  }
  return statusMap[status.toLowerCase()] || status
}

// Generate HTML content for PDF
const generatePDFHTML = (data: any) => {
  const { customer, cases, statistics, period } = data

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

  // 2. Response time insight
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

  // 3. Cost efficiency
  const avgCostPerCase = statistics.totalCases > 0 
    ? Math.round(statistics.totalCost / statistics.totalCases)
    : 0
  insights.push({
    icon: '💰',
    title: 'Genomsnittlig kostnad',
    value: formatCurrency(avgCostPerCase),
    description: 'Per ärende'
  })

  // 4. Most common pest
  insights.push({
    icon: '🐛',
    title: 'Vanligaste skadedjur',
    value: statistics.topPestType || 'Ingen data',
    description: `${statistics.pestTypeCounts[statistics.topPestType] || 0} ärenden`
  })

  // 5. Active cases status
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

  // 6. Total value insight
  insights.push({
    icon: '📈',
    title: 'Total investering',
    value: formatCurrency(statistics.totalCost),
    description: 'För perioden'
  })

  // Period display
  const periodDisplay = {
    '30d': 'Senaste 30 dagarna',
    '3m': 'Senaste 3 månaderna',
    '6m': 'Senaste 6 månaderna',
    '1y': 'Senaste året',
    'all': 'Hela tiden'
  }[period as '30d' | '3m' | '6m' | '1y' | 'all'] || period

  // Generate table rows - show more rows to utilize space better
  const tableRows = cases.slice(0, 20).map((caseItem: any) => `
    <tr>
      <td>${caseItem.title}</td>
      <td><span class="status-badge">${getCustomerStatusDisplay(caseItem.status)}</span></td>
      <td>${caseItem.pest_type || 'Okänt'}</td>
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
  <title>BeGone Statistikrapport - ${customer.company_name}</title>
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
      background: #059669;
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
    
    /* Alternative compact layout for insights when space is limited */
    @media (max-width: 800px) {
      .insights-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
      }
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
      color: #059669;
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
      <h1 class="main-title">Statistikrapport</h1>
      <div class="company-name">${customer.company_name}</div>
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
        <div class="kpi-label">Aktiva ärenden</div>
        <div class="kpi-value">${statistics.activeCases}</div>
        <div class="kpi-subtitle">${statistics.activeCases === 1 ? 'Aktivt ärende' : 'Aktiva ärenden'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Genomsnittlig responstid</div>
        <div class="kpi-value">${statistics.avgResponseTime} dagar</div>
        <div class="kpi-subtitle">Från registrering till schemaläggning</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Vanligaste skadedjur</div>
        <div class="kpi-value">${statistics.topPestType || 'Ingen data'}</div>
        <div class="kpi-subtitle">${statistics.pestTypeCounts[statistics.topPestType] || 0} ärenden</div>
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
    
    <!-- Table Section -->
    <div class="table-section">
      <h2 class="section-title">
        <span>📋</span>
        Senaste ärenden
      </h2>
      <table>
        <thead>
          <tr>
            <th>Ärende</th>
            <th>Status</th>
            <th>Skadedjur</th>
            <th>Datum</th>
            <th class="text-right">Kostnad</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-logo">
        <div class="logo-icon" style="width: 24px; height: 24px; font-size: 14px;">B</div>
        <div class="logo-text" style="font-size: 18px;">BeGone</div>
      </div>
      <div class="footer-text">
        Professionell skadedjursbekämpning sedan 2022<br>
        Vi säkerställer en trygg och skadedjursfri miljö för er verksamhet
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

  // Anropas av kunder OCH multisite-användare (statistikexport). Kräv giltig
  // inloggning men ingen roll - PDF:en renderar bara data anroparen redan har,
  // skyddet gäller Puppeteer-kostnad/missbruk, inte databehörighet.
  const auth = await requireAuthenticated(req, res)
  if (!auth) return

  try {
    const { customer, cases, statistics, period } = req.body

    if (!customer || !cases || !statistics) {
      return res.status(400).json({ error: 'Missing required data' })
    }

    // Generate HTML content
    const html = generatePDFHTML({ customer, cases, statistics, period })

    // Launch Puppeteer with Chrome
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    })

    const page = await browser.newPage()
    
    // Set content with proper encoding
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Generate PDF with optimized settings for smaller file size
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

    // Return PDF as base64 - properly handle Buffer conversion
    console.log('PDF buffer type:', typeof pdf)
    console.log('PDF buffer length:', pdf.length)
    console.log('PDF buffer constructor:', pdf.constructor.name)
    
    // Debug: Check what pdf actually contains
    if (pdf instanceof Uint8Array || (pdf as any) instanceof Buffer) {
      console.log('PDF is a valid buffer/array')
    } else {
      console.error('PDF is not a buffer/array, it is:', pdf)
    }
    
    // Ensure proper base64 conversion
    const pdfBase64 = Buffer.from(pdf).toString('base64')
    console.log('Base64 conversion successful, length:', pdfBase64.length)
    console.log('Base64 sample (first 100 chars):', pdfBase64.substring(0, 100))
    
    // Extra verification
    if (pdfBase64.includes(',')) {
      console.error('WARNING: Base64 contains commas, this is wrong!')
      console.error('PDF toString() result:', pdf.toString().substring(0, 200))
    }
    
    res.status(200).json({ 
      success: true, 
      pdf: pdfBase64,
      filename: `BeGone_Statistik_${customer.company_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
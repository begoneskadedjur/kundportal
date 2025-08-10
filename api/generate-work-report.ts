// api/generate-work-report.ts - Puppeteer-baserad saneringsrapport generator
import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// BeGone Professional Color Palette (samma som pdfReportGenerator.ts)
const beGoneColors = {
  primary: '#0A1328',        // BeGone Dark Blue
  accent: '#20C58F',         // BeGone Green
  accentDark: '#10B981',     // Darker green
  white: '#FFFFFF',
  lightestGray: '#F8FAFC',   // Slate-50
  lightGray: '#F1F5F9',      // Slate-100  
  mediumGray: '#94A3B8',     // Slate-400
  darkGray: '#334155',       // Slate-700
  charcoal: '#1E293B',       // Slate-800
  border: '#CBD5E1',         // Slate-300
  divider: '#E2E8F0',        // Slate-200
  success: '#22C55E',        // Emerald-500
  info: '#3B82F6',           // Blue-500
  warning: '#F59E0B',        // Amber-500
}

interface TaskDetails {
  task_id: string;
  task_info: {
    name: string;
    status: string;
    description: string;
    created: string;
    updated: string;
  };
  assignees: Array<{
    name: string;
    email: string;
  }>;
  custom_fields: Array<{
    id: string;
    name: string;
    type: string;
    value: any;
    has_value: boolean;
    type_config?: {
      options?: Array<{
        id: string;
        name: string;
        color: string;
        orderindex: number;
      }>;
    };
  }>;
}

interface CustomerInfo {
  company_name: string;
  org_number: string;
  contact_person: string;
}

// Hjälpfunktion för att hitta custom field
const getFieldValue = (taskDetails: TaskDetails, fieldName: string) => {
  return taskDetails.custom_fields.find(field => 
    field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
  )
}

// Hjälpfunktion för dropdown-text
const getDropdownText = (field: any): string => {
  if (!field || !field.has_value) return 'Ej specificerat'
  
  if (field.type_config?.options && Array.isArray(field.type_config.options)) {
    const selectedOption = field.type_config.options.find((option: any) => 
      option.orderindex === field.value
    )
    if (selectedOption) {
      return selectedOption.name
    }
  }
  
  return field.value?.toString() || 'Ej specificerat'
}

// Hjälpfunktion för att formatera datum
const formatDate = (timestamp: string): string => {
  if (!timestamp) return 'Ej angivet'
  
  // Hantera både millisekunder timestamp och ISO-datum
  let date: Date
  if (/^\d+$/.test(timestamp)) {
    date = new Date(parseInt(timestamp))
  } else {
    date = new Date(timestamp)
  }
  
  if (isNaN(date.getTime())) return 'Ej angivet'
  
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Hjälpfunktion för att formatera adresser
const formatAddress = (addressValue: any): string => {
  if (!addressValue) return 'Adress ej angiven'
  
  // Om det är en string som ser ut som JSON, försök parsa den
  if (typeof addressValue === 'string') {
    if (addressValue.startsWith('{') && addressValue.includes('formatted_address')) {
      try {
        const parsed = JSON.parse(addressValue)
        if (parsed.formatted_address) {
          return parsed.formatted_address.replace(/, Sverige$/, '').trim()
        }
      } catch (e) {
        // Fallback to string value
      }
    }
    return addressValue.replace(/, Sverige$/, '').trim()
  }
  
  // Om det är ett objekt
  if (typeof addressValue === 'object' && addressValue !== null) {
    if (addressValue.formatted_address) {
      const addr = addressValue.formatted_address
      return typeof addr === 'string' ? addr.replace(/, Sverige$/, '').trim() : addr
    }
    
    if (addressValue.address) {
      const addr = addressValue.address
      return typeof addr === 'string' ? addr.replace(/, Sverige$/, '').trim() : addr
    }
    
    if (addressValue.street) {
      const addr = addressValue.street
      return typeof addr === 'string' ? addr.replace(/, Sverige$/, '').trim() : addr
    }
  }
  
  return 'Adress ej angiven'
}

// Generera HTML för saneringsrapport
const generateWorkReportHTML = (taskDetails: TaskDetails, customerInfo: CustomerInfo) => {
  // Hämta alla relevanta custom fields
  const addressField = getFieldValue(taskDetails, 'adress')
  const pestField = getFieldValue(taskDetails, 'skadedjur')
  const caseTypeField = getFieldValue(taskDetails, 'case_type')
  const priceField = getFieldValue(taskDetails, 'pris')
  const reportField = getFieldValue(taskDetails, 'rapport')
  const startDateField = getFieldValue(taskDetails, 'start_date')
  const phoneField = getFieldValue(taskDetails, 'telefon_kontaktperson') || getFieldValue(taskDetails, 'telefon')
  const emailField = getFieldValue(taskDetails, 'e_post_kontaktperson') || getFieldValue(taskDetails, 'email')
  
  // Avgör om det är privatperson eller företag
  const isCompany = caseTypeField?.value === 'business'
  
  // Formatera data
  const addressText = formatAddress(addressField?.value)
  const pestText = pestField ? (pestField.value || 'Ej specificerat') : 'Ej specificerat'
  const priceText = priceField && priceField.value ? `${priceField.value} SEK` : 'Ej angivet'
  const phoneText = phoneField ? phoneField.value : 'Telefon ej angiven'
  const emailText = emailField ? emailField.value : 'Email ej angiven'
  const workDate = startDateField ? formatDate(startDateField.value) : formatDate(taskDetails.task_info.created)
  
  // Tekniker information
  const technicianName = taskDetails.assignees.length > 0 ? taskDetails.assignees[0].name : 'Ej tilldelad'
  const technicianEmail = taskDetails.assignees.length > 0 ? taskDetails.assignees[0].email : ''

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Saneringsrapport - ${taskDetails.task_info.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: ${beGoneColors.darkGray};
      background: white;
      line-height: 1.6;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
    }
    
    /* Modern Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 2px solid ${beGoneColors.divider};
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, ${beGoneColors.accent} 0%, ${beGoneColors.accentDark} 100%);
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
      color: ${beGoneColors.primary};
    }
    
    .report-meta {
      text-align: right;
    }
    
    .report-title {
      color: ${beGoneColors.primary};
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .report-date {
      color: ${beGoneColors.mediumGray};
      font-size: 14px;
      margin-top: 4px;
    }
    
    /* Title Section */
    .title-section {
      margin-bottom: 32px;
      padding: 20px 0;
      border-bottom: 1px solid ${beGoneColors.divider};
    }
    
    .main-title {
      font-size: 28px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 8px;
    }
    
    .case-subtitle {
      font-size: 16px;
      color: ${beGoneColors.mediumGray};
      font-weight: 500;
    }
    
    /* KPI Cards - Modern metadata display */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .kpi-card {
      background: ${beGoneColors.lightestGray};
      border: 1px solid ${beGoneColors.border};
      border-radius: 12px;
      padding: 16px;
      transition: all 0.3s ease;
      page-break-inside: avoid;
    }
    
    .kpi-card:hover {
      background: ${beGoneColors.lightGray};
      border-color: ${beGoneColors.mediumGray};
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .kpi-label {
      color: ${beGoneColors.mediumGray};
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 20px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 4px;
    }
    
    .kpi-subtitle {
      color: ${beGoneColors.mediumGray};
      font-size: 11px;
    }
    
    /* Section Headers - Modern style */
    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      page-break-after: avoid;
    }
    
    .section-title.accent {
      color: ${beGoneColors.accent};
    }
    
    .section-icon {
      font-size: 20px;
      min-width: 20px;
      line-height: 1;
    }
    
    /* Cards - Modern style */
    .card {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
    }
    
    .card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: ${beGoneColors.accent};
      transform: translateY(-1px);
    }
    
    .card.accent-border {
      border: 2px solid ${beGoneColors.accent};
      background: linear-gradient(135deg, ${beGoneColors.lightestGray} 0%, white 100%);
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .info-group {
      margin-bottom: 16px;
    }
    
    .info-label {
      font-size: 11px;
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 14px;
      color: ${beGoneColors.darkGray};
      font-weight: 500;
    }
    
    /* Report Section - Enhanced modern style */
    .report-section {
      background: linear-gradient(135deg, ${beGoneColors.lightestGray} 0%, ${beGoneColors.lightGray} 100%);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .report-content {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 12px;
      padding: 24px;
      min-height: 200px;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    .report-text {
      font-size: 15px;
      line-height: 1.8;
      color: ${beGoneColors.darkGray};
      white-space: pre-wrap;
      padding: 0;
    }
    
    .no-report {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-style: italic;
      color: ${beGoneColors.mediumGray};
      text-align: center;
      padding: 48px;
    }
    
    .no-report-icon {
      font-size: 48px;
      opacity: 0.3;
      color: ${beGoneColors.mediumGray};
    }
    
    /* Cost Summary - KPI Style */
    .cost-summary {
      text-align: center;
      padding: 24px;
      page-break-inside: avoid;
    }
    
    .cost-label {
      font-size: 13px;
      color: ${beGoneColors.mediumGray};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    
    .cost-value {
      font-size: 32px;
      font-weight: 700;
      color: ${beGoneColors.accent};
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    
    .cost-subtitle {
      color: ${beGoneColors.mediumGray};
      font-size: 13px;
      margin-top: 8px;
    }
    
    /* Footer - Matching statistics style */
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid ${beGoneColors.divider};
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
      color: ${beGoneColors.mediumGray};
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    
    .footer-contact {
      margin-top: 12px;
      color: ${beGoneColors.darkGray};
      font-size: 13px;
    }
    
    .footer-contact a {
      color: ${beGoneColors.accent};
      text-decoration: none;
      font-weight: 600;
    }
    
    /* Print Optimizations */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      
      .container {
        padding: 15mm;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      .card {
        page-break-inside: avoid;
      }
      
      h1, h2, h3 {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Modern Header -->
    <div class="header">
      <div class="logo">
        <div class="logo-icon">B</div>
        <div class="logo-text">BeGone</div>
      </div>
      <div class="report-meta">
        <div class="report-title">SANERINGSRAPPORT</div>
        <div class="report-date">${new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>
    
    <!-- Title Section -->
    <div class="title-section">
      <h1 class="main-title">${taskDetails.task_info.name}</h1>
      <div class="case-subtitle">Professionell skadedjursrapport</div>
    </div>
    
    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ärende ID</div>
        <div class="kpi-value">${taskDetails.task_id}</div>
        <div class="kpi-subtitle">Unikt ärende</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Status</div>
        <div class="kpi-value">${taskDetails.task_info.status || 'Okänd'}</div>
        <div class="kpi-subtitle">Aktuell status</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Skadedjur</div>
        <div class="kpi-value">${pestText}</div>
        <div class="kpi-subtitle">Behandlat skadedjur</div>
      </div>
    </div>
    
    <!-- Kunduppgifter -->
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">👤</span>
        Kunduppgifter
      </h2>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">UPPDRAGSGIVARE</div>
            <div class="info-value">${isCompany ? customerInfo.company_name : customerInfo.contact_person}</div>
          </div>
          <div class="info-group">
            <div class="info-label">${isCompany ? 'KONTAKTPERSON' : 'PERSONNUMMER'}</div>
            <div class="info-value">${isCompany ? customerInfo.contact_person : (customerInfo.org_number || 'Ej angivet')}</div>
          </div>
          ${isCompany ? `
          <div class="info-group">
            <div class="info-label">ORG NR</div>
            <div class="info-value">${customerInfo.org_number || 'Ej angivet'}</div>
          </div>
          ` : ''}
          <div class="info-group">
            <div class="info-label">TELEFON</div>
            <div class="info-value">${phoneText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">EMAIL</div>
            <div class="info-value">${emailText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">ÄRENDE ID</div>
            <div class="info-value">${taskDetails.task_id}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Leverantörsuppgifter -->
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🏢</span>
        Leverantörsuppgifter
      </h2>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">FÖRETAG</div>
            <div class="info-value">BeGone Skadedjur & Sanering AB</div>
          </div>
          <div class="info-group">
            <div class="info-label">ORGANISATIONSNUMMER</div>
            <div class="info-value">559378-9208</div>
          </div>
          <div class="info-group">
            <div class="info-label">BESÖKSADRESS</div>
            <div class="info-value">Bläcksvampsvägen 17, 141 60 Huddinge</div>
          </div>
          <div class="info-group">
            <div class="info-label">TELEFON</div>
            <div class="info-value">010 280 44 10</div>
          </div>
          <div class="info-group">
            <div class="info-label">EMAIL</div>
            <div class="info-value">info@begone.se</div>
          </div>
          ${technicianName !== 'Ej tilldelad' ? `
          <div class="info-group">
            <div class="info-label">ANSVARIG TEKNIKER</div>
            <div class="info-value">${technicianName}</div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
    
    <!-- Arbetsinformation -->
    <div class="section">
      <h2 class="section-title accent">
        <span class="section-icon">🔧</span>
        Arbetsinformation
      </h2>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">DATUM FÖR UTFÖRANDE</div>
            <div class="info-value">${workDate}</div>
          </div>
          <div class="info-group">
            <div class="info-label">ARBETSPLATS</div>
            <div class="info-value">${addressText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">ÄRENDET AVSER</div>
            <div class="info-value">${pestText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">ARBETSSTATUS</div>
            <div class="info-value">${taskDetails.task_info.status || 'Okänd status'}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Detaljerad Saneringsrapport -->
    <div class="section">
      <h2 class="section-title accent">
        <span class="section-icon">📋</span>
        Detaljerad saneringsrapport
      </h2>
      <div class="report-section">
        <div class="report-content">
          ${reportField && reportField.value ? `
            <div class="report-text">${reportField.value}</div>
          ` : `
            <div class="no-report">
              <div class="no-report-icon">📄</div>
              <div>Ingen detaljerad rapport registrerad för detta ärende.</div>
            </div>
          `}
        </div>
      </div>
    </div>
    
    <!-- Ekonomisk sammanfattning -->
    ${priceField && priceField.value ? `
    <div class="section">
      <h2 class="section-title accent">
        <span class="section-icon">💰</span>
        Ekonomisk sammanfattning
      </h2>
      <div class="card accent-border">
        <div class="cost-summary">
          <div class="cost-label">Totalkostnad för utförd sanering</div>
          <div class="cost-value">${priceText}</div>
          <div class="cost-subtitle">Inkl. moms och arbete</div>
        </div>
      </div>
    </div>
    ` : ''}
    
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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { taskDetails, customerInfo } = req.body as {
      taskDetails: TaskDetails
      customerInfo: CustomerInfo
    }

    if (!taskDetails || !customerInfo) {
      return res.status(400).json({ error: 'Missing taskDetails or customerInfo' })
    }

    console.log('Generating work report PDF for task:', taskDetails.task_id)

    // Generate HTML
    const html = generateWorkReportHTML(taskDetails, customerInfo)

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    
    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Generate PDF with optimized settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    })

    await browser.close()

    // Convert PDF buffer to base64
    const pdfBase64 = Buffer.from(pdf).toString('base64')
    
    console.log('PDF generated successfully, size:', pdf.length)
    
    res.status(200).json({ 
      success: true, 
      pdf: pdfBase64,
      filename: `Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
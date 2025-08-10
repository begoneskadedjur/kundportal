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
    
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      background: #ffffff;
      border-radius: 8px;
    }
    
    .container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #059669;
      border-radius: 8px 8px 0 0;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 0;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      margin: -15mm -15mm 24px -15mm;
      padding-left: 15mm;
      padding-right: 15mm;
      page-break-inside: avoid;
    }
    
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 48px;
      height: 48px;
      background: #059669;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 24px;
    }
    
    
    .logo-text {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
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
    
    .title-section {
      margin-bottom: 32px;
      padding: 16px 0;
      text-align: center;
    }
    
    .main-title {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    
    .case-subtitle {
      font-size: 16px;
      color: ${beGoneColors.mediumGray};
      font-weight: 500;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    
    .kpi-label {
      color: ${beGoneColors.mediumGray};
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
      opacity: 0.8;
    }
    
    .kpi-value {
      font-size: 24px;
      font-weight: 900;
      color: #059669;
      margin-bottom: 6px;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    
    .kpi-subtitle {
      color: ${beGoneColors.mediumGray};
      font-size: 12px;
      font-weight: 500;
      opacity: 0.8;
    }
    
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      page-break-after: avoid;
    }
    
    .section-title.accent {
      color: #059669;
    }
    
    .section-icon {
      font-size: 22px;
      min-width: 22px;
      line-height: 1;
      opacity: 0.8;
    }
    
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    
    .card.accent-border {
      border: 2px solid #059669;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(5, 150, 105, 0.15);
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    
    .info-group {
      margin-bottom: 16px;
    }
    
    .info-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 14px;
      color: #0f172a;
      font-weight: 600;
      line-height: 1.4;
    }
    
    .report-section {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    
    .report-content {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      min-height: 200px;
      page-break-inside: avoid;
    }
    
    .report-text {
      font-size: 14px;
      line-height: 1.6;
      color: #0f172a;
      white-space: pre-wrap;
      font-weight: 400;
    }
    
    .no-report {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-style: italic;
      color: #64748b;
      text-align: center;
      padding: 32px;
    }
    
    .no-report-icon {
      font-size: 40px;
      opacity: 0.4;
      color: #64748b;
    }
    
    .cost-summary {
      text-align: center;
      padding: 24px;
      page-break-inside: avoid;
    }
    
    .cost-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    
    .cost-value {
      font-size: 36px;
      font-weight: 900;
      color: #059669;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    
    .cost-subtitle {
      color: #64748b;
      font-size: 14px;
      margin-top: 8px;
      font-weight: 500;
    }
    
    .footer {
      margin-top: 32px;
      padding: 24px 0;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      page-break-inside: avoid;
      margin-left: -15mm;
      margin-right: -15mm;
      padding-left: 15mm;
      padding-right: 15mm;
      margin-bottom: -15mm;
      border-radius: 0 0 8px 8px;
    }
    
    
    .footer-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .footer-text {
      color: #64748b;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 12px;
      font-weight: 500;
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .footer-contact {
      margin-top: 12px;
      color: #0f172a;
      font-size: 13px;
      font-weight: 500;
    }
    
    .footer-contact a {
      color: #059669;
      text-decoration: none;
      font-weight: 600;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      
      .container {
        padding: 12mm;
      }
      
      .section {
        page-break-inside: avoid;
        margin-bottom: 16px;
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
        Vi säkerställer trygga och skadedjursfria miljöer för hem och verksamheter
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
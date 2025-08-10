// src/lib/pdf-generator.ts - Shared PDF generation module for work reports
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// BeGone Professional Color Palette
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

export interface TaskDetails {
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

export interface CustomerInfo {
  company_name: string;
  org_number: string;
  contact_person: string;
}

// Helper function to find custom field
const getFieldValue = (taskDetails: TaskDetails, fieldName: string) => {
  return taskDetails.custom_fields.find(field => 
    field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
  )
}

// Helper function for dropdown text
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

// Helper function to format dates
const formatDate = (timestamp: string): string => {
  if (!timestamp) return 'Ej angivet'
  
  // Handle both millisecond timestamps and ISO dates
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

// Helper function to format addresses
const formatAddress = (addressValue: any): string => {
  if (!addressValue) return 'Adress ej angiven'
  
  // If it's a string that looks like JSON, try to parse it
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
  
  // If it's an object
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

// Generate HTML for work report
const generateWorkReportHTML = (taskDetails: TaskDetails, customerInfo: CustomerInfo) => {
  // Get all relevant custom fields
  const addressField = getFieldValue(taskDetails, 'adress')
  const pestField = getFieldValue(taskDetails, 'skadedjur')
  const caseTypeField = getFieldValue(taskDetails, 'case_type')
  const priceField = getFieldValue(taskDetails, 'pris')
  const reportField = getFieldValue(taskDetails, 'rapport')
  const startDateField = getFieldValue(taskDetails, 'start_date')
  const phoneField = getFieldValue(taskDetails, 'telefon_kontaktperson') || getFieldValue(taskDetails, 'telefon')
  const emailField = getFieldValue(taskDetails, 'e_post_kontaktperson') || getFieldValue(taskDetails, 'email')
  
  // Determine if it's a company or private person
  const isCompany = caseTypeField?.value === 'business'
  
  // Format data
  const addressText = formatAddress(addressField?.value)
  const pestText = pestField ? (pestField.value || 'Ej specificerat') : 'Ej specificerat'
  const priceText = priceField && priceField.value ? `${priceField.value} SEK` : 'Ej angivet'
  const phoneText = phoneField ? phoneField.value : 'Telefon ej angiven'
  const emailText = emailField ? emailField.value : 'Email ej angiven'
  const workDate = startDateField ? formatDate(startDateField.value) : formatDate(taskDetails.task_info.created)
  
  // Technician information
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${beGoneColors.darkGray};
      background: white;
      line-height: 1.6;
      font-optical-sizing: auto;
      font-variant-ligatures: common-ligatures;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
    }
    
    /* Header */
    .header {
      background: white;
      border-bottom: 3px solid ${beGoneColors.accent};
      padding: 24px 0;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .logo-icon {
      width: 48px;
      height: 48px;
      background: ${beGoneColors.accent};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 800;
      color: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .logo-text {
      font-size: 28px;
      font-weight: 800;
      color: ${beGoneColors.primary};
      letter-spacing: -0.5px;
    }
    
    .header-meta {
      text-align: right;
    }
    
    .header-title {
      font-size: 14px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    
    .header-date {
      font-size: 13px;
      color: ${beGoneColors.mediumGray};
    }
    
    /* Title Section */
    .title-section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .main-title {
      font-size: 28px;
      font-weight: 800;
      color: ${beGoneColors.primary};
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .kpi-card {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 8px;
      padding: 20px;
      transition: all 0.2s ease;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    
    .kpi-card:hover {
      border-color: ${beGoneColors.accent};
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    
    .kpi-label {
      font-size: 11px;
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 24px;
      font-weight: 800;
      color: ${beGoneColors.primary};
      margin-bottom: 4px;
    }
    
    .kpi-value.accent {
      color: ${beGoneColors.accent};
    }
    
    .kpi-subtitle {
      font-size: 12px;
      color: ${beGoneColors.mediumGray};
    }
    
    /* Section Headers */
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    
    .section-header {
      font-size: 18px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${beGoneColors.divider};
    }
    
    .section-header.accent {
      color: ${beGoneColors.accent};
    }
    
    .section-icon {
      font-size: 20px;
      opacity: 0.8;
    }
    
    /* Cards */
    .card {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .info-group {
      margin-bottom: 12px;
      padding-left: 12px;
      border-left: 3px solid ${beGoneColors.lightGray};
    }
    
    .info-label {
      font-size: 10px;
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
    
    /* Report Content */
    .report-container {
      background: ${beGoneColors.lightestGray};
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    
    .report-content {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 8px;
      padding: 20px;
      min-height: 120px;
    }
    
    .report-text {
      font-size: 14px;
      line-height: 1.7;
      color: ${beGoneColors.darkGray};
      white-space: pre-wrap;
    }
    
    .no-report {
      font-style: italic;
      color: ${beGoneColors.mediumGray};
      text-align: center;
      padding: 30px;
    }
    
    /* Cost Summary */
    .cost-summary {
      background: white;
      border: 2px solid ${beGoneColors.accent};
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 2px 4px rgba(32, 197, 143, 0.1);
    }
    
    .cost-label {
      font-size: 12px;
      font-weight: 600;
      color: ${beGoneColors.darkGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .cost-value {
      font-size: 36px;
      font-weight: 900;
      color: ${beGoneColors.accent};
    }
    
    .cost-subtitle {
      font-size: 12px;
      color: ${beGoneColors.mediumGray};
      margin-top: 4px;
    }
    
    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 3px solid ${beGoneColors.accent};
      text-align: center;
      page-break-inside: avoid;
      background: white;
    }
    
    .footer-logo {
      font-size: 20px;
      font-weight: 800;
      color: ${beGoneColors.primary};
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .footer-logo-icon {
      width: 32px;
      height: 32px;
      background: ${beGoneColors.accent};
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: white;
    }
    
    .footer-text {
      font-size: 12px;
      color: ${beGoneColors.mediumGray};
      margin-bottom: 12px;
      line-height: 1.6;
    }
    
    .footer-contact {
      font-size: 11px;
      color: ${beGoneColors.darkGray};
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
        padding: 12mm;
        box-shadow: none;
      }
      
      .kpi-card:hover,
      .card:hover {
        border-color: ${beGoneColors.border};
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon">B</div>
          <div class="logo-text">BeGone</div>
        </div>
        <div class="header-meta">
          <div class="header-title">SANERINGSRAPPORT</div>
          <div class="header-date">${new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
    </div>
    
    <!-- Title Section -->
    <div class="title-section">
      <h1 class="main-title">${taskDetails.task_info.name || 'Saneringsrapport'}</h1>
    </div>
    
    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ärende ID</div>
        <div class="kpi-value">${taskDetails.task_id.substring(0, 8)}...</div>
        <div class="kpi-subtitle">Unikt ärende</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Status</div>
        <div class="kpi-value accent">${taskDetails.task_info.status || 'Okänd'}</div>
        <div class="kpi-subtitle">Aktuell status</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Skadedjur</div>
        <div class="kpi-value">${pestText}</div>
        <div class="kpi-subtitle">Behandlat skadedjur</div>
      </div>
    </div>
    
    <!-- Customer Information -->
    <div class="section">
      <div class="section-header">
        <span class="section-icon">👤</span>
        Kunduppgifter
      </div>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">Uppdragsgivare</div>
            <div class="info-value">${isCompany ? customerInfo.company_name : customerInfo.contact_person}</div>
          </div>
          <div class="info-group">
            <div class="info-label">${isCompany ? 'Kontaktperson' : 'Personnummer'}</div>
            <div class="info-value">${isCompany ? customerInfo.contact_person : (customerInfo.org_number || 'Ej angivet')}</div>
          </div>
          ${isCompany ? `
          <div class="info-group">
            <div class="info-label">Org Nr</div>
            <div class="info-value">${customerInfo.org_number || 'Ej angivet'}</div>
          </div>
          ` : ''}
          <div class="info-group">
            <div class="info-label">Telefon</div>
            <div class="info-value">${phoneText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Email</div>
            <div class="info-value">${emailText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Ärende ID</div>
            <div class="info-value">${taskDetails.task_id}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Supplier Information -->
    <div class="section">
      <div class="section-header">
        <span class="section-icon">🏢</span>
        Leverantörsuppgifter
      </div>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">Företag</div>
            <div class="info-value">BeGone Skadedjur & Sanering AB</div>
          </div>
          <div class="info-group">
            <div class="info-label">Organisationsnummer</div>
            <div class="info-value">559378-9208</div>
          </div>
          <div class="info-group">
            <div class="info-label">Besöksadress</div>
            <div class="info-value">Bläcksvampsvägen 17, 141 60 Huddinge</div>
          </div>
          <div class="info-group">
            <div class="info-label">Telefon</div>
            <div class="info-value">010 280 44 10</div>
          </div>
          <div class="info-group">
            <div class="info-label">Email</div>
            <div class="info-value">info@begone.se</div>
          </div>
          ${technicianName !== 'Ej tilldelad' ? `
          <div class="info-group">
            <div class="info-label">Ansvarig Tekniker</div>
            <div class="info-value">${technicianName}</div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
    
    <!-- Work Information -->
    <div class="section">
      <div class="section-header accent">
        <span class="section-icon">🔧</span>
        Arbetsinformation
      </div>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">Datum för utförande</div>
            <div class="info-value">${workDate}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Arbetsplats</div>
            <div class="info-value">${addressText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Ärendet avser</div>
            <div class="info-value">${pestText}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Arbetsstatus</div>
            <div class="info-value">${taskDetails.task_info.status || 'Okänd status'}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Detailed Work Report -->
    <div class="section">
      <div class="section-header accent">
        <span class="section-icon">📋</span>
        Detaljerad saneringsrapport
      </div>
      ${reportField && reportField.value ? `
        <div class="report-container">
          <div class="report-content">
            <div class="report-text">${reportField.value}</div>
          </div>
        </div>
      ` : `
        <div class="report-container">
          <div class="report-content">
            <div class="no-report">Ingen detaljerad rapport registrerad för detta ärende.</div>
          </div>
        </div>
      `}
    </div>
    
    <!-- Economic Summary -->
    ${priceField && priceField.value ? `
    <div class="section">
      <div class="section-header accent">
        <span class="section-icon">💰</span>
        Ekonomisk sammanfattning
      </div>
      <div class="cost-summary">
        <div class="cost-label">Totalkostnad för utförd sanering</div>
        <div class="cost-value">${priceText}</div>
        <div class="cost-subtitle">Inklusive material och arbete</div>
      </div>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-logo">
        <div class="footer-logo-icon">B</div>
        <span>BeGone</span>
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

/**
 * Generate a work report PDF using Puppeteer
 * @param taskDetails - Task details from ClickUp or database
 * @param customerInfo - Customer information
 * @returns PDF as Buffer
 */
export async function generateWorkReportPDF(
  taskDetails: TaskDetails,
  customerInfo: CustomerInfo
): Promise<Buffer> {
  let browser = null
  
  try {
    console.log('Generating work report PDF for task:', taskDetails.task_id)
    
    // Generate HTML
    const html = generateWorkReportHTML(taskDetails, customerInfo)
    
    // Launch Puppeteer
    browser = await puppeteer.launch({
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
    
    console.log('PDF generated successfully, size:', pdf.length)
    
    // Return as Buffer
    return Buffer.from(pdf)
    
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * Generate a work report PDF and return as base64
 * @param taskDetails - Task details from ClickUp or database
 * @param customerInfo - Customer information
 * @returns Object with base64 PDF and filename
 */
export async function generateWorkReportBase64(
  taskDetails: TaskDetails,
  customerInfo: CustomerInfo
): Promise<{ pdf: string; filename: string }> {
  const pdfBuffer = await generateWorkReportPDF(taskDetails, customerInfo)
  const pdfBase64 = pdfBuffer.toString('base64')
  const filename = `Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`
  
  return {
    pdf: pdfBase64,
    filename
  }
}
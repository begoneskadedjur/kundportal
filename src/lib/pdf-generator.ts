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

export interface PreparationItem {
  quantity: number;
  unit: string;
  dosage_notes: string | null;
  preparation: { name: string; registration_number: string | null; category: string } | null;
}

export interface BillingItem {
  article_name: string;
  quantity: number;
  article_code: string | null;
}

// Helper function to find custom field
const getFieldValue = (taskDetails: TaskDetails, fieldName: string) => {
  return taskDetails.custom_fields.find(field =>
    field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
  )
}

// Helper function to format dates
const formatDate = (timestamp: string): string => {
  if (!timestamp) return 'Ej angivet'

  // ISO date-only string (YYYY-MM-DD) – return directly, no conversion needed
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp
  }

  // ISO datetime – take only the date part to avoid timezone shifts
  if (/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
    return timestamp.substring(0, 10)
  }

  // Millisecond timestamp
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
const generateWorkReportHTML = (
  taskDetails: TaskDetails,
  customerInfo: CustomerInfo,
  preparations: PreparationItem[] = [],
  billingItems: BillingItem[] = [],
  mapUrl: string | null = null
) => {
  // Get all relevant custom fields
  const addressField = getFieldValue(taskDetails, 'adress')
  const pestField = getFieldValue(taskDetails, 'skadedjur')
  const caseTypeField = getFieldValue(taskDetails, 'case_type')
  const reportField = getFieldValue(taskDetails, 'rapport')
  const startDateField = getFieldValue(taskDetails, 'start_date')
  const phoneField = getFieldValue(taskDetails, 'telefon_kontaktperson') || getFieldValue(taskDetails, 'telefon')
  const emailField = getFieldValue(taskDetails, 'e_post_kontaktperson') || getFieldValue(taskDetails, 'email')

  // Determine if it's a company or private person
  const isCompany = caseTypeField?.value === 'business'

  // Format data
  const addressText = formatAddress(addressField?.value)
  const pestText = pestField ? (pestField.value || 'Ej specificerat') : 'Ej specificerat'
  const phoneText = phoneField ? phoneField.value : 'Telefon ej angiven'
  const emailText = emailField ? emailField.value : 'Email ej angiven'
  const workDate = startDateField ? formatDate(startDateField.value) : formatDate(taskDetails.task_info.created)

  // Technician information (all assignees)
  const technicianNames = taskDetails.assignees.length > 0
    ? taskDetails.assignees.map(a => a.name).join(', ')
    : 'Ej tilldelad'
  const technicianLabel = taskDetails.assignees.length > 1 ? 'Ansvariga tekniker' : 'Ansvarig tekniker'

  // Case number: prefer task_info.name (e.g. "BE-0007475"), fallback to truncated UUID
  const caseNumber = taskDetails.task_info.name || (taskDetails.task_id.substring(0, 8) + '...')

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
      padding: 15mm;
      background: white;
    }

    /* Header */
    .header {
      background: white;
      border-bottom: 3px solid ${beGoneColors.accent};
      padding: 20px 0;
      margin-bottom: 24px;
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

    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .kpi-card {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 8px;
      padding: 14px 16px;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .kpi-value {
      font-size: 20px;
      font-weight: 800;
      color: ${beGoneColors.primary};
      margin-bottom: 2px;
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
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .section-header {
      font-size: 15px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${beGoneColors.divider};
    }

    .section-header.accent {
      color: ${beGoneColors.accent};
    }

    /* Cards */
    .card {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .info-group {
      margin-bottom: 8px;
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

    /* Data Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th {
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 12px;
      border-bottom: 2px solid ${beGoneColors.divider};
    }
    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid ${beGoneColors.divider};
      color: ${beGoneColors.darkGray};
    }
    .data-table tr:last-child td {
      border-bottom: none;
    }

    /* Map */
    .map-container {
      margin-top: 16px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid ${beGoneColors.border};
    }
    .map-image {
      width: 100%;
      display: block;
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

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ärende ID</div>
        <div class="kpi-value" style="font-size: 18px">${caseNumber}</div>
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
      <div class="section-header">Kunduppgifter</div>
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
        </div>
      </div>
    </div>

    <!-- Supplier Information -->
    <div class="section">
      <div class="section-header">Leverantörsuppgifter</div>
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
          <div class="info-group">
            <div class="info-label">${technicianLabel}</div>
            <div class="info-value">${technicianNames}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Work Information -->
    <div class="section">
      <div class="section-header accent">Arbetsinformation</div>
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
          ${taskDetails.task_info.description ? `
          <div class="info-group" style="grid-column: 1 / -1">
            <div class="info-label">Ärendebeskrivning</div>
            <div class="info-value">${taskDetails.task_info.description}</div>
          </div>
          ` : ''}
        </div>
        ${mapUrl ? `
        <div class="map-container">
          <img src="${mapUrl}" class="map-image" alt="Karta över arbetsplatsen" />
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Detailed Work Report -->
    <div class="section">
      <div class="section-header accent">Detaljerad saneringsrapport</div>
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

    <!-- Preparations -->
    ${preparations.length > 0 ? `
    <div class="section">
      <div class="section-header accent">Använda preparat</div>
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Preparat</th>
              <th>Mängd</th>
              <th>Reg.nr</th>
            </tr>
          </thead>
          <tbody>
            ${preparations.map(p => `
              <tr>
                <td>${p.preparation?.name || 'Okänt'}</td>
                <td>${p.quantity} ${p.unit}</td>
                <td>${p.preparation?.registration_number || '–'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Products & Services -->
    ${billingItems.length > 0 ? `
    <div class="section">
      <div class="section-header accent">Produkter &amp; tjänster</div>
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Antal</th>
            </tr>
          </thead>
          <tbody>
            ${billingItems.map(item => `
              <tr>
                <td>${item.article_name}</td>
                <td>${item.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
 */
export async function generateWorkReportPDF(
  taskDetails: TaskDetails,
  customerInfo: CustomerInfo,
  preparations: PreparationItem[] = [],
  billingItems: BillingItem[] = []
): Promise<Buffer> {
  let browser = null

  try {
    console.log('Generating work report PDF for task:', taskDetails.task_id)

    // Build Google Maps Static API URL for the work address
    const addressField = taskDetails.custom_fields.find(
      f => f.name.toLowerCase() === 'adress' && f.has_value
    )
    const addressText = formatAddress(addressField?.value)
    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || ''
    let mapUrl: string | null = null
    if (googleMapsKey && addressText && addressText !== 'Adress ej angiven') {
      const encodedAddress = encodeURIComponent(addressText)
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=560x200&scale=2&maptype=roadmap&markers=color:0x20C58F|${encodedAddress}&key=${googleMapsKey}`
    }

    // Generate HTML
    const html = generateWorkReportHTML(taskDetails, customerInfo, preparations, billingItems, mapUrl)

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
 */
export async function generateWorkReportBase64(
  taskDetails: TaskDetails,
  customerInfo: CustomerInfo,
  preparations: PreparationItem[] = [],
  billingItems: BillingItem[] = []
): Promise<{ pdf: string; filename: string }> {
  const pdfBuffer = await generateWorkReportPDF(taskDetails, customerInfo, preparations, billingItems)
  const pdfBase64 = pdfBuffer.toString('base64')
  const filename = `Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`

  return {
    pdf: pdfBase64,
    filename
  }
}

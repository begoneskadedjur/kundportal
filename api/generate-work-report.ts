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
    
    /* Header */
    .header {
      background: linear-gradient(135deg, ${beGoneColors.primary} 0%, ${beGoneColors.charcoal} 100%);
      margin: -20mm -20mm 0 -20mm;
      padding: 30px;
      text-align: center;
      page-break-inside: avoid;
    }
    
    .header h1 {
      color: white;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    
    .header .subtitle {
      color: ${beGoneColors.accent};
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .accent-line {
      height: 4px;
      background: ${beGoneColors.accent};
      margin-top: 30px;
    }
    
    /* Metadata Section */
    .metadata {
      text-align: center;
      padding: 20px 0;
      color: ${beGoneColors.mediumGray};
      font-size: 12px;
      border-bottom: 1px solid ${beGoneColors.divider};
      margin-bottom: 30px;
    }
    
    .metadata p {
      margin: 4px 0;
    }
    
    /* Section Headers */
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .section-header {
      background: ${beGoneColors.charcoal};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
      page-break-after: avoid;
    }
    
    .section-header.accent {
      background: ${beGoneColors.accent};
    }
    
    /* Cards */
    .card {
      background: ${beGoneColors.lightestGray};
      border: 1px solid ${beGoneColors.border};
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .card.white {
      background: white;
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
    
    /* Report Text */
    .report-content {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 12px;
      padding: 24px;
      min-height: 150px;
      page-break-inside: avoid;
    }
    
    .report-text {
      font-size: 14px;
      line-height: 1.8;
      color: ${beGoneColors.darkGray};
      white-space: pre-wrap;
    }
    
    .no-report {
      font-style: italic;
      color: ${beGoneColors.mediumGray};
      text-align: center;
      padding: 40px;
    }
    
    /* Cost Summary */
    .cost-summary {
      background: white;
      border: 2px solid ${beGoneColors.accent};
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      page-break-inside: avoid;
    }
    
    .cost-label {
      font-size: 14px;
      color: ${beGoneColors.darkGray};
      margin-bottom: 8px;
    }
    
    .cost-value {
      font-size: 28px;
      font-weight: 700;
      color: ${beGoneColors.accent};
    }
    
    /* Footer */
    .footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 2px solid ${beGoneColors.divider};
      text-align: center;
      page-break-inside: avoid;
    }
    
    .footer-logo {
      font-size: 20px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 16px;
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
    <!-- Professional Header -->
    <div class="header">
      <h1>SANERINGSRAPPORT</h1>
      <div class="subtitle">BeGone Skadedjur & Sanering</div>
      <div class="accent-line"></div>
    </div>
    
    <!-- Metadata -->
    <div class="metadata">
      <p><strong>Rapport genererad:</strong> ${new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p><strong>Ärende ID:</strong> ${taskDetails.task_id}</p>
      ${addressText !== 'Adress ej angiven' ? `<p><strong>Arbetsplats:</strong> ${addressText}</p>` : ''}
    </div>
    
    <!-- Kunduppgifter -->
    <div class="section">
      <div class="section-header">KUNDUPPGIFTER</div>
      <div class="card white">
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
      <div class="section-header">LEVERANTÖRSUPPGIFTER</div>
      <div class="card white">
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
      <div class="section-header accent">ARBETSINFORMATION</div>
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
      <div class="section-header accent">DETALJERAD SANERINGSRAPPORT</div>
      ${reportField && reportField.value ? `
        <div class="report-content">
          <div class="report-text">${reportField.value}</div>
        </div>
      ` : `
        <div class="report-content">
          <div class="no-report">Ingen detaljerad rapport registrerad för detta ärende.</div>
        </div>
      `}
    </div>
    
    <!-- Ekonomisk sammanfattning -->
    ${priceField && priceField.value ? `
    <div class="section">
      <div class="section-header accent">EKONOMISK SAMMANFATTNING</div>
      <div class="cost-summary">
        <div class="cost-label">Totalkostnad för utförd sanering:</div>
        <div class="cost-value">${priceText}</div>
      </div>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-logo">BeGone</div>
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
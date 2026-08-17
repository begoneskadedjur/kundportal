// src/lib/pdf-generator.ts - Shared PDF generation module for work reports
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { BEGONE_LOGO_DATA_URI } from './begoneLogo'

// Färgpalett enligt Begones dokumentstandard (samma formspråk som interna dokument)
const colors = {
  ink: '#0f172a',            // Rubriker
  text: '#1f2937',           // Brödtext
  label: '#6b7280',          // Etiketter / dämpad text
  accent: '#20c58f',         // Brandgrön
  tableHeaderBg: '#f0fdf9',  // Ljusgrön tabellheader
  zebra: '#fafafa',          // Zebra-rader
  border: '#e5e7eb',         // Tunn grå border
  rule: '#d1d5db',           // Sektionslinjer
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

export interface ReportImage {
  /** Signerad eller publik URL som Chromium kan hämta vid rendering */
  url: string;
  tags?: string[];
  description?: string | null;
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

// Enkel HTML-escape för användarinmatad text
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Generate HTML for work report (exporterad för lokal visuell testning)
export const generateWorkReportHTML = (
  taskDetails: TaskDetails,
  customerInfo: CustomerInfo,
  preparations: PreparationItem[] = [],
  billingItems: BillingItem[] = [],
  mapUrl: string | null = null,
  images: ReportImage[] = []
) => {
  // Get all relevant custom fields
  const addressField = getFieldValue(taskDetails, 'adress')
  const pestField = getFieldValue(taskDetails, 'skadedjur')
  const caseTypeField = getFieldValue(taskDetails, 'case_type')
  const reportField = getFieldValue(taskDetails, 'rapport')
  const startDateField = getFieldValue(taskDetails, 'start_date')
  const phoneField = getFieldValue(taskDetails, 'telefon_kontaktperson') || getFieldValue(taskDetails, 'telefon')
  const emailField = getFieldValue(taskDetails, 'e_post_kontaktperson') || getFieldValue(taskDetails, 'email')
  // 🏷️ Ärendemärkning (kunder med aktiverad ärendemärkning)
  const workOrderField = getFieldValue(taskDetails, 'work_order_number')
  const workObjectField = getFieldValue(taskDetails, 'work_object')

  // Determine if it's a company or private person
  const isCompany = caseTypeField?.value === 'business'

  // Format data
  const addressText = formatAddress(addressField?.value)
  const pestText = pestField ? (pestField.value || 'Ej specificerat') : 'Ej specificerat'
  const phoneText = phoneField ? phoneField.value : 'Ej angiven'
  const emailText = emailField ? emailField.value : 'Ej angiven'
  const workDate = startDateField ? formatDate(startDateField.value) : formatDate(taskDetails.task_info.created)

  // Technician information (all assignees)
  const technicianNames = taskDetails.assignees.length > 0
    ? taskDetails.assignees.map(a => a.name).join(', ')
    : 'Ej tilldelad'
  const technicianLabel = taskDetails.assignees.length > 1 ? 'Ansvariga tekniker' : 'Ansvarig tekniker'

  // Case number: prefer task_info.name (e.g. "BE-0007475"), fallback to truncated UUID
  const caseNumber = taskDetails.task_info.name || (taskDetails.task_id.substring(0, 8) + '...')

  const todayLong = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })

  // Sektioner numreras löpande — sektioner utan innehåll renderas inte alls
  let sectionNo = 0
  const sectionTitle = (title: string) =>
    `<h2 class="section-title"><span class="section-no">${++sectionNo}.</span> ${title}</h2>`

  // 1. Ärendeinformation
  const infoRows: Array<[string, string]> = [
    ['Datum för utförande', esc(workDate)],
    ['Arbetsplats', esc(addressText)],
    ['Tjänst', esc(pestText)],
    [technicianLabel, esc(technicianNames)],
  ]
  if (workOrderField?.value) infoRows.push(['Arbetsorder nr', esc(workOrderField.value)])
  if (workObjectField?.value) infoRows.push(['Objekt', esc(workObjectField.value)])

  const caseInfoSection = `
    <section class="section">
      ${sectionTitle('Ärendeinformation')}
      <div class="info-grid">
        ${infoRows.map(([label, value]) => `
          <div class="info-item">
            <div class="info-label">${label}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
        ${taskDetails.task_info.description ? `
          <div class="info-item span-2">
            <div class="info-label">Ärendebeskrivning</div>
            <div class="info-value prewrap">${esc(taskDetails.task_info.description)}</div>
          </div>
        ` : ''}
      </div>
      ${mapUrl ? `
        <div class="map-frame">
          <img src="${mapUrl}" class="map-image" alt="Karta över arbetsplatsen" />
        </div>
      ` : ''}
    </section>`

  // 2. Utfört arbete — rapportens kärna. Renderas bara när det finns innehåll.
  const workReportSection = reportField?.value ? `
    <section class="section">
      ${sectionTitle('Utfört arbete')}
      <div class="report-text prewrap">${esc(reportField.value)}</div>
    </section>` : ''

  // 3. Bilder från ärendet (signerade URL:er hämtas av Chromium vid rendering)
  const imagesSection = images.length > 0 ? `
    <section class="section">
      ${sectionTitle('Bilder från ärendet')}
      <div class="image-grid">
        ${images.map(img => `
          <figure class="image-item">
            <img src="${img.url}" alt="Ärendebild" />
            ${img.description ? `<figcaption>${esc(img.description)}</figcaption>` : ''}
          </figure>`
        ).join('')}
      </div>
    </section>` : ''

  // 4. Använda preparat
  const preparationsSection = preparations.length > 0 ? `
    <section class="section">
      ${sectionTitle('Använda preparat')}
      <table class="data-table">
        <thead>
          <tr><th>Preparat</th><th>Mängd</th><th>Reg.nr</th></tr>
        </thead>
        <tbody>
          ${preparations.map(p => `
            <tr>
              <td>${esc(p.preparation?.name || 'Okänt')}</td>
              <td>${esc(p.quantity)} ${esc(p.unit)}</td>
              <td>${esc(p.preparation?.registration_number || '–')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>` : ''

  // 5. Utförda tjänster & material (aldrig priser i ärenderapporter)
  const billingSection = billingItems.length > 0 ? `
    <section class="section">
      ${sectionTitle('Utförda tjänster & material')}
      <table class="data-table">
        <thead>
          <tr><th>Tjänst / material</th><th class="num">Antal</th></tr>
        </thead>
        <tbody>
          ${billingItems.map(item => `
            <tr>
              <td>${esc(item.article_name)}</td>
              <td class="num">${esc(item.quantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>` : ''

  // 6. Uppgifter — kund och leverantör sida vid sida, kompakt
  const partiesSection = `
    <section class="section">
      ${sectionTitle('Uppgifter')}
      <div class="parties">
        <div class="party">
          <div class="party-heading">Kund</div>
          <div class="party-row"><span>Uppdragsgivare</span>${esc(isCompany ? customerInfo.company_name : customerInfo.contact_person)}</div>
          ${isCompany
            ? `<div class="party-row"><span>Kontaktperson</span>${esc(customerInfo.contact_person)}</div>
               <div class="party-row"><span>Org.nr</span>${esc(customerInfo.org_number || 'Ej angivet')}</div>`
            : `<div class="party-row"><span>Personnummer</span>${esc(customerInfo.org_number || 'Ej angivet')}</div>`}
          <div class="party-row"><span>Telefon</span>${esc(phoneText)}</div>
          <div class="party-row"><span>E-post</span>${esc(emailText)}</div>
        </div>
        <div class="party">
          <div class="party-heading">Leverantör</div>
          <div class="party-row"><span>Företag</span>BeGone Skadedjur &amp; Sanering AB</div>
          <div class="party-row"><span>Org.nr</span>559378-9208</div>
          <div class="party-row"><span>Adress</span>Bläcksvampsvägen 17, 141 60 Huddinge</div>
          <div class="party-row"><span>Telefon</span>010 280 44 10</div>
          <div class="party-row"><span>E-post</span>info@begone.se</div>
        </div>
      </div>
    </section>`

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Saneringsrapport ${esc(caseNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      color: ${colors.text};
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Sidhuvud ── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 12px;
      border-bottom: 3px solid ${colors.accent};
      margin-bottom: 22px;
    }
    .doc-logo { width: 150px; height: auto; display: block; }
    .doc-meta { text-align: right; }
    .doc-type {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: ${colors.label};
    }
    .doc-case {
      font-size: 15pt;
      font-weight: 700;
      color: ${colors.ink};
      margin-top: 2px;
    }
    .doc-date { font-size: 9pt; color: ${colors.label}; margin-top: 2px; }

    /* ── Sektioner ── */
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 12.5pt;
      font-weight: 700;
      color: ${colors.ink};
      padding-bottom: 5px;
      border-bottom: 1px solid ${colors.rule};
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    .section-no { color: ${colors.accent}; }

    /* ── Ärendeinformation ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .info-item.span-2 { grid-column: 1 / -1; }
    .info-label {
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: ${colors.label};
    }
    .info-value { font-size: 10.5pt; color: ${colors.text}; }
    .prewrap { white-space: pre-wrap; }

    .map-frame {
      margin-top: 12px;
      border: 1px solid ${colors.border};
      border-radius: 4px;
      overflow: hidden;
    }
    .map-image { width: 100%; height: 140px; object-fit: cover; display: block; }

    /* ── Utfört arbete ── */
    .report-text { font-size: 10.5pt; line-height: 1.6; }

    /* ── Bilder ── */
    .image-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .image-item {
      border: 1px solid ${colors.border};
      border-radius: 4px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .image-item img {
      width: 100%;
      height: 190px;
      object-fit: cover;
      display: block;
    }
    .image-item figcaption {
      font-size: 8.5pt;
      color: ${colors.label};
      padding: 4px 8px;
      border-top: 1px solid ${colors.border};
    }

    /* ── Tabeller ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      border: 1px solid ${colors.border};
    }
    .data-table th {
      background: ${colors.tableHeaderBg};
      text-align: left;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${colors.ink};
      padding: 6px 10px;
      border-bottom: 1px solid ${colors.border};
    }
    .data-table td {
      padding: 6px 10px;
      border-bottom: 1px solid ${colors.border};
    }
    .data-table tbody tr:nth-child(even) td { background: ${colors.zebra}; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table .num { text-align: right; width: 70px; }

    /* ── Uppgifter (kund/leverantör) ── */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .party {
      border: 1px solid ${colors.border};
      border-radius: 4px;
      padding: 10px 12px;
    }
    .party-heading {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${colors.accent};
      margin-bottom: 6px;
    }
    .party-row {
      display: flex;
      font-size: 9.5pt;
      padding: 2px 0;
    }
    .party-row span {
      flex: 0 0 105px;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: ${colors.label};
      padding-top: 1.5px;
    }

    section, .party, .data-table, .map-frame { page-break-inside: avoid; }
  </style>
</head>
<body>
  <header class="doc-header">
    <img src="${BEGONE_LOGO_DATA_URI}" class="doc-logo" alt="BeGone Skadedjur & Sanering" />
    <div class="doc-meta">
      <div class="doc-type">Saneringsrapport</div>
      <div class="doc-case">${esc(caseNumber)}</div>
      <div class="doc-date">${todayLong}</div>
    </div>
  </header>

  ${caseInfoSection}
  ${workReportSection}
  ${imagesSection}
  ${preparationsSection}
  ${billingSection}
  ${partiesSection}
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
  billingItems: BillingItem[] = [],
  images: ReportImage[] = []
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
    const html = generateWorkReportHTML(taskDetails, customerInfo, preparations, billingItems, mapUrl, images)

    // Launch Puppeteer
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    })

    const page = await browser.newPage()

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Sidfot på varje sida via Puppeteer (kontakt + sidnummer) — ingen egen footersida
    const footerTemplate = `
      <div style="width: 100%; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #6b7280; padding: 0 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; padding-top: 6px; margin: 0 15mm;">
        <span>BeGone Skadedjur &amp; Sanering AB · info@begone.se · 010 280 44 10 · www.begone.se</span>
        <span>Sida <span class="pageNumber"></span> av <span class="totalPages"></span></span>
      </div>`

    // Generate PDF with optimized settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '20mm',
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
  billingItems: BillingItem[] = [],
  images: ReportImage[] = []
): Promise<{ pdf: string; filename: string }> {
  const pdfBuffer = await generateWorkReportPDF(taskDetails, customerInfo, preparations, billingItems, images)
  const pdfBase64 = pdfBuffer.toString('base64')
  const filename = `Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`

  return {
    pdf: pdfBase64,
    filename
  }
}

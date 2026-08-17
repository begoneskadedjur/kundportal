// api/generate-case-report-pdf.ts
// API endpoint for generating comprehensive case report PDFs using Puppeteer

import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'
import { requireAuthenticated } from './_lib/auth'
import { BEGONE_LOGO_DATA_URI } from '../src/lib/begoneLogo'

// Färgpalett enligt Begones dokumentstandard (används av single-case-mallen)
const docColors = {
  ink: '#0f172a',            // Rubriker
  text: '#1f2937',           // Brödtext
  label: '#6b7280',          // Etiketter / dämpad text
  accent: '#20c58f',         // Brandgrön
  tableHeaderBg: '#f0fdf9',  // Ljusgrön tabellheader
  zebra: '#fafafa',          // Zebra-rader
  border: '#e5e7eb',         // Tunn grå border
  rule: '#d1d5db',           // Sektionslinjer
}

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
  error: '#EF4444',          // Red-500
}

// Helper functions
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Ej angivet'
  // Returnera bara datumdelen (YYYY-MM-DD) utan tidzon-konvertering
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateString)) {
    return dateString.substring(0, 10)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Ej angivet'
  return date.toISOString().substring(0, 10)
}

const formatCurrency = (amount: number | null) => {
  if (!amount || amount === 0) return 'Ingår i avtal'
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const nl2br = (text: string | null | undefined): string => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>')
}

const getStatusBadgeColor = (status: string) => {
  if (status === 'Slutförd' || status === 'Stängd') return { bg: '#22C55E', text: '#FFFFFF' }
  if (status === 'Bokad' || status === 'Återbesök') return { bg: '#F59E0B', text: '#FFFFFF' }
  if (status === 'Öppen') return { bg: '#3B82F6', text: '#FFFFFF' }
  if (status === 'Pågående') return { bg: '#8B5CF6', text: '#FFFFFF' }
  return { bg: '#6B7280', text: '#FFFFFF' }
}

const getTrafficLightStatus = (pest_level: number | null, problem_rating: number | null) => {
  if (pest_level === null && problem_rating === null) {
    return { 
      color: '#6B7280', 
      emoji: '⚪', 
      label: 'Ej bedömd',
      assessment: 'Vår bedömning:\n⚪\nEj bedömd - Avvaktar inspektion\nBaserat på inspektion och expertis har vår tekniker inte ännu bedömt situationen.'
    }
  }
  
  if ((pest_level && pest_level >= 3) || (problem_rating && problem_rating >= 4)) {
    const activityLevel = pest_level! >= 3 ? `Nivå ${pest_level} av 3\n\nHög nivå - Kräver omedelbar åtgärd` : `Nivå ${pest_level || 0} av 3\n\nMedium nivå - Bör åtgärdas`
    const situationRating = problem_rating! >= 4 ? `${problem_rating} av 5\n\nAllvarligt - Åtgärd krävs` : `${problem_rating || 0} av 5\n\nMedium - Övervakning rekommenderas`
    
    return { 
      color: '#EF4444', 
      emoji: '🔴', 
      label: 'Kritisk - Åtgärd krävs',
      assessment: `Vår bedömning:\n🔴\nKritisk - Åtgärd krävs\nBaserat på inspektion och expertis har vår tekniker bedömt situationen:\n\nAktivitetsnivå\n\n${activityLevel}\n\nSituationsbedömning\n\n${situationRating}`
    }
  }
  
  if ((pest_level && pest_level === 2) || (problem_rating && problem_rating === 3)) {
    const activityLevel = `Nivå ${pest_level || 0} av 3\n\nMedium nivå - Bör åtgärdas`
    const situationRating = `${problem_rating || 0} av 5\n\nMedium - Övervakning rekommenderas`
    
    return { 
      color: '#F59E0B', 
      emoji: '🟡', 
      label: 'Varning - Övervakning krävs',
      assessment: `Vår bedömning:\n🟡\nVarning - Övervakning krävs\nBaserat på inspektion och expertis har vår tekniker bedömt situationen:\n\nAktivitetsnivå\n\n${activityLevel}\n\nSituationsbedömning\n\n${situationRating}`
    }
  }
  
  const activityLevel = `Nivå ${pest_level || 0} av 3\n\nLåg nivå - Under kontroll`
  const situationRating = `${problem_rating || 0} av 5\n\nLåg - Situationen är stabil`
  
  return { 
    color: '#22C55E', 
    emoji: '🟢', 
    label: 'OK - Situation under kontroll',
    assessment: `Vår bedömning:\n🟢\nOK - Situation under kontroll\nBaserat på inspektion och expertis har vår tekniker bedömt situationen:\n\nAktivitetsnivå\n\n${activityLevel}\n\nSituationsbedömning\n\n${situationRating}`
  }
}

// Enkel HTML-escape för användarinmatad text (enradsvärden; nl2br hanterar flerradiga)
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Generate HTML for single case report — följer Begones dokumentstandard
// (samma formspråk som saneringsrapporten i src/lib/pdf-generator.ts)
export const generateSingleCaseHTML = (
  caseData: any,
  customerData: any,
  _reportType: string,
  images: { url: string; description?: string; tags: string[] }[] = [],
  preparations: any[] = [],
  billingItems: any[] = [],
  mapUrl: string | null = null
) => {
  const trafficLight = getTrafficLightStatus(caseData.pest_level, caseData.problem_rating)
  const addressStr = typeof caseData.address === 'string'
    ? caseData.address
    : (caseData.address?.address || customerData?.contact_address || null)
  const hasTrafficLight = caseData.pest_level !== null || caseData.problem_rating !== null

  const caseNumber = caseData.case_number || caseData.title || ''
  const todayLong = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })

  // Sektioner numreras löpande — sektioner utan innehåll renderas inte alls
  let sectionNo = 0
  const sectionTitle = (title: string) =>
    `<h2 class="section-title"><span class="section-no">${++sectionNo}.</span> ${title}</h2>`

  // 1. Ärendeinformation
  const infoRows: Array<[string, string]> = [
    ['Datum för utförande', esc(formatDate(caseData.scheduled_start))],
    ['Arbetsplats', esc(addressStr || 'Ej angivet')],
    ['Tjänst', esc(caseData.pest_type || 'Ej specificerat')],
    ['Ansvarig tekniker', esc(caseData.primary_technician_name || 'Ej tilldelad')],
  ]
  if (caseData.visit_number && caseData.visit_number > 1) infoRows.push(['Besök nr', esc(caseData.visit_number)])
  if (caseData.work_order_number) infoRows.push(['Arbetsorder nr', esc(caseData.work_order_number)])
  if (caseData.work_object) infoRows.push(['Objekt', esc(caseData.work_object)])

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
        ${caseData.description ? `
          <div class="info-item span-2">
            <div class="info-label">Ärendebeskrivning</div>
            <div class="info-value">${nl2br(caseData.description)}</div>
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
  const workReportSection = caseData.work_report ? `
    <section class="section">
      ${sectionTitle('Utfört arbete')}
      <div class="report-text">${nl2br(caseData.work_report)}</div>
    </section>` : ''

  // 3. Teknisk bedömning (trafikljus) — färgkodad callout
  const assessmentSection = hasTrafficLight ? `
    <section class="section">
      ${sectionTitle('Teknisk bedömning')}
      <div class="assessment" style="border-left-color: ${trafficLight.color};">
        <div class="assessment-label" style="color: ${trafficLight.color};">${trafficLight.label}</div>
        <div class="assessment-sub">Bedömning av vår tekniker efter inspektion på plats</div>
        <div class="assessment-grid">
          <div>
            <div class="info-label">Aktivitetsnivå</div>
            <div class="assessment-value" style="color: ${trafficLight.color};">Nivå ${caseData.pest_level || 0} av 3</div>
            <div class="assessment-note">${(caseData.pest_level >= 3) ? 'Hög nivå - kräver omedelbar åtgärd' : (caseData.pest_level === 2) ? 'Medium nivå - bör åtgärdas' : 'Låg nivå - under kontroll'}</div>
          </div>
          <div>
            <div class="info-label">Situationsbedömning</div>
            <div class="assessment-value" style="color: ${trafficLight.color};">${caseData.problem_rating || 0} av 5</div>
            <div class="assessment-note">${(caseData.problem_rating >= 4) ? 'Allvarligt - åtgärd krävs' : (caseData.problem_rating === 3) ? 'Medium - övervakning rekommenderas' : 'Låg - situationen är stabil'}</div>
          </div>
        </div>
      </div>
    </section>` : ''

  // 4. Rekommendationer (+ ev. kundbekräftelse)
  const recommendationsSection = caseData.recommendations ? `
    <section class="section">
      ${sectionTitle('Rekommendationer')}
      <div class="report-text">${nl2br(caseData.recommendations)}</div>
      ${caseData.recommendations_acknowledged ? `
        <div class="ack-row">Bekräftat av kund ${esc(formatDate(caseData.recommendations_acknowledged_at))}</div>
      ` : ''}
    </section>` : ''

  // 5. Bilder från ärendet
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

  // 6. Använda preparat
  const preparationsSection = preparations.length > 0 ? `
    <section class="section">
      ${sectionTitle('Använda preparat')}
      <table class="data-table">
        <thead>
          <tr><th>Preparat</th><th>Mängd</th><th>Reg.nr</th></tr>
        </thead>
        <tbody>
          ${preparations.map((p: any) => `
            <tr>
              <td>${esc(p.preparation?.name || p.name || 'Okänt')}</td>
              <td>${esc(p.quantity)} ${esc(p.unit || '')}</td>
              <td>${esc(p.preparation?.registration_number || p.registration_number || '–')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>` : ''

  // 7. Utförda tjänster & material (aldrig priser i ärenderapporter)
  const billingSection = billingItems.length > 0 ? `
    <section class="section">
      ${sectionTitle('Utförda tjänster & material')}
      <table class="data-table">
        <thead>
          <tr><th>Tjänst / material</th><th class="num">Antal</th></tr>
        </thead>
        <tbody>
          ${billingItems.map((item: any) => `
            <tr>
              <td>${esc(item.article_name)}</td>
              <td class="num">${esc(item.quantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>` : ''

  // 8. Uppgifter — kund och leverantör sida vid sida, kompakt
  const partiesSection = `
    <section class="section">
      ${sectionTitle('Uppgifter')}
      <div class="parties">
        <div class="party">
          <div class="party-heading">Kund</div>
          <div class="party-row"><span>Företag</span>${esc(customerData?.company_name || 'Ej angivet')}</div>
          <div class="party-row"><span>Kontaktperson</span>${esc(caseData.contact_person || customerData?.contact_person || 'Ej angivet')}</div>
          ${customerData?.org_number ? `<div class="party-row"><span>Org.nr</span>${esc(customerData.org_number)}</div>` : ''}
          <div class="party-row"><span>Telefon</span>${esc(caseData.contact_phone || customerData?.contact_phone || 'Ej angivet')}</div>
          <div class="party-row"><span>E-post</span>${esc(caseData.contact_email || customerData?.contact_email || 'Ej angivet')}</div>
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
  <title>Ärenderapport ${esc(caseNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      color: ${docColors.text};
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
      border-bottom: 3px solid ${docColors.accent};
      margin-bottom: 22px;
    }
    .doc-logo { width: 150px; height: auto; display: block; }
    .doc-meta { text-align: right; }
    .doc-type {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: ${docColors.label};
    }
    .doc-case {
      font-size: 15pt;
      font-weight: 700;
      color: ${docColors.ink};
      margin-top: 2px;
    }
    .doc-date { font-size: 9pt; color: ${docColors.label}; margin-top: 2px; }

    /* ── Sektioner ── */
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 12.5pt;
      font-weight: 700;
      color: ${docColors.ink};
      padding-bottom: 5px;
      border-bottom: 1px solid ${docColors.rule};
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    .section-no { color: ${docColors.accent}; }

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
      color: ${docColors.label};
    }
    .info-value { font-size: 10.5pt; color: ${docColors.text}; overflow-wrap: break-word; }

    .map-frame {
      margin-top: 12px;
      border: 1px solid ${docColors.border};
      border-radius: 4px;
      overflow: hidden;
    }
    .map-image { width: 100%; height: 140px; object-fit: cover; display: block; }

    /* ── Löptext ── */
    .report-text { font-size: 10.5pt; line-height: 1.6; overflow-wrap: break-word; }

    /* ── Teknisk bedömning ── */
    .assessment {
      border: 1px solid ${docColors.border};
      border-left: 4px solid ${docColors.accent};
      border-radius: 4px;
      padding: 10px 14px;
      background: #fafafa;
    }
    .assessment-label { font-size: 11.5pt; font-weight: 700; }
    .assessment-sub { font-size: 9pt; color: ${docColors.label}; margin-bottom: 8px; }
    .assessment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .assessment-value { font-size: 11pt; font-weight: 700; }
    .assessment-note { font-size: 9pt; color: ${docColors.label}; }

    .ack-row {
      margin-top: 8px;
      font-size: 9.5pt;
      font-weight: 600;
      color: ${docColors.accent};
    }

    /* ── Bilder ── */
    .image-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .image-item {
      border: 1px solid ${docColors.border};
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
      color: ${docColors.label};
      padding: 4px 8px;
      border-top: 1px solid ${docColors.border};
    }

    /* ── Tabeller ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      border: 1px solid ${docColors.border};
    }
    .data-table th {
      background: ${docColors.tableHeaderBg};
      text-align: left;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${docColors.ink};
      padding: 6px 10px;
      border-bottom: 1px solid ${docColors.border};
    }
    .data-table td {
      padding: 6px 10px;
      border-bottom: 1px solid ${docColors.border};
    }
    .data-table tbody tr:nth-child(even) td { background: ${docColors.zebra}; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table .num { text-align: right; width: 70px; }

    /* ── Uppgifter (kund/leverantör) ── */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .party {
      border: 1px solid ${docColors.border};
      border-radius: 4px;
      padding: 10px 12px;
    }
    .party-heading {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${docColors.accent};
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
      color: ${docColors.label};
      padding-top: 1.5px;
    }

    section, .party, .data-table, .map-frame, .assessment { page-break-inside: avoid; }
  </style>
</head>
<body>
  <header class="doc-header">
    <img src="${BEGONE_LOGO_DATA_URI}" class="doc-logo" alt="BeGone Skadedjur & Sanering" />
    <div class="doc-meta">
      <div class="doc-type">Ärenderapport</div>
      <div class="doc-case">${esc(caseNumber)}</div>
      <div class="doc-date">${todayLong}</div>
    </div>
  </header>

  ${caseInfoSection}
  ${workReportSection}
  ${assessmentSection}
  ${recommendationsSection}
  ${imagesSection}
  ${preparationsSection}
  ${billingSection}
  ${partiesSection}
</body>
</html>
  `
}

// Generate HTML for multiple cases report
const generateMultipleCasesHTML = (cases: any[], customerData: any, userRole: string, period: string) => {
  const totalCases = cases.length
  const activeCases = cases.filter(c => 
    ['Öppen', 'Bokad', 'Pågående', 'Återbesök'].includes(c.status)
  ).length
  const completedCases = cases.filter(c => 
    ['Slutförd', 'Stängd', 'Avslutat'].includes(c.status)
  ).length
  const totalCost = cases.reduce((sum, c) => sum + (c.price || 0), 0)

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Ärenderapport - ${customerData?.company_name || 'Organisationsrapport'}</title>
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
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
    }
    
    /* Header */
    .header {
      background: white;
      border-bottom: 3px solid ${beGoneColors.accent};
      padding: 24px 0;
      margin-bottom: 32px;
      page-break-inside: avoid;
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
    
    .subtitle {
      font-size: 16px;
      color: ${beGoneColors.mediumGray};
      margin-bottom: 8px;
    }
    
    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: ${beGoneColors.accent}20;
      color: ${beGoneColors.accent};
      text-transform: capitalize;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .kpi-card {
      background: white;
      border: 1px solid ${beGoneColors.border};
      border-radius: 8px;
      padding: 20px;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
    
    /* Table */
    .table-section {
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
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    thead {
      background: ${beGoneColors.lightestGray};
    }
    
    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      color: ${beGoneColors.darkGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid ${beGoneColors.border};
    }
    
    td {
      padding: 8px;
      font-size: 11px;
      color: ${beGoneColors.darkGray};
      border-bottom: 1px solid ${beGoneColors.lightGray};
    }
    
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    
    .traffic-light {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }
    
    .text-right {
      text-align: right;
    }
    
    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 3px solid ${beGoneColors.accent};
      text-align: center;
      page-break-inside: avoid;
    }
    
    .footer-text {
      font-size: 12px;
      color: ${beGoneColors.mediumGray};
      line-height: 1.6;
    }
    
    .footer-contact {
      margin-top: 12px;
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
      
      .kpi-grid, .table-section {
        page-break-inside: avoid;
      }
      
      h1, .section-header {
        page-break-after: avoid;
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
      <div class="header-meta">
        <div class="header-title">ÄRENDERAPPORT</div>
        <div class="header-date">${new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>
    
    <!-- Title Section -->
    <div class="title-section">
      <h1 class="main-title">Ärenderapport</h1>
      <div class="subtitle">${customerData?.company_name || 'Organisationsrapport'}</div>
      <div class="role-badge">${userRole} - ${period || 'Alla ärenden'}</div>
    </div>
    
    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Totalt antal ärenden</div>
        <div class="kpi-value">${totalCases}</div>
        <div class="kpi-subtitle">I denna rapport</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Aktiva ärenden</div>
        <div class="kpi-value accent">${activeCases}</div>
        <div class="kpi-subtitle">Pågående behandling</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avslutade ärenden</div>
        <div class="kpi-value">${completedCases}</div>
        <div class="kpi-subtitle">Genomförda uppdrag</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total kostnad</div>
        <div class="kpi-value">${formatCurrency(totalCost)}</div>
        <div class="kpi-subtitle">Alla ärenden</div>
      </div>
    </div>
    
    <!-- Cases Table -->
    <div class="table-section">
      <div class="section-header">
        <span style="font-size: 20px;">📋</span>
        Alla ärenden
      </div>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Ärendenummer</th>
            <th>Titel</th>
            <th>Skadedjur</th>
            <th>Tekniker</th>
            <th>Datum</th>
            <th class="text-right">Kostnad</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map(caseItem => {
            const trafficLight = getTrafficLightStatus(caseItem.pest_level, caseItem.problem_rating)
            const statusColors = getStatusBadgeColor(caseItem.status)
            
            return `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="traffic-light" style="background-color: ${trafficLight.color};" title="${trafficLight.label}"></div>
                    <span class="status-badge" style="background-color: ${statusColors.bg}; color: ${statusColors.text};">
                      ${caseItem.status}
                    </span>
                  </div>
                </td>
                <td>${caseItem.case_number || 'N/A'}</td>
                <td>${caseItem.title || 'Ingen titel'}</td>
                <td>${caseItem.pest_type || 'Ej specificerat'}</td>
                <td>${caseItem.primary_technician_name || 'Ej tilldelad'}</td>
                <td>${formatDate(caseItem.scheduled_start || caseItem.created_at)}</td>
                <td class="text-right">${formatCurrency(caseItem.price)}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">
        <strong>BeGone Skadedjur & Sanering AB</strong><br>
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Kostnads-/dataskydd: endpointen slår upp kunddata via service-role från
  // case_id i bodyn - kräver inloggad användare (även kundportalen anropar hit)
  const auth = await requireAuthenticated(req, res)
  if (!auth) return

  try {
    const { reportType, caseData, cases, customerData, userRole, period } = req.body

    if (!reportType) {
      return res.status(400).json({ error: 'Missing reportType' })
    }

    let html: string
    let filename: string

    if (reportType === 'single' && caseData) {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Hämta bilder
      const { data: rawImages } = await supabase
        .from('case_images')
        .select('id, file_path, file_name, tags, description')
        .eq('case_id', caseData.id)
        .eq('case_type', 'contract')
        .order('uploaded_at', { ascending: true })

      const images: { url: string; description?: string; tags: string[] }[] = []
      for (const img of rawImages ?? []) {
        const { data: signed } = await supabase.storage
          .from('case-images')
          .createSignedUrl(img.file_path, 3600)
        if (signed?.signedUrl) {
          images.push({ url: signed.signedUrl, description: img.description, tags: img.tags ?? [] })
        }
      }

      // Hämta preparat
      const { data: preparations } = await supabase
        .from('case_preparations')
        .select('*, preparation:preparations(name, registration_number)')
        .eq('case_id', caseData.id)
        .eq('case_type', 'contract')

      // Hämta fakturarader
      const { data: billingItems } = await supabase
        .from('case_billing_items')
        .select('article_name, quantity')
        .eq('case_id', caseData.id)
        .eq('case_type', 'contract')

      // Bygg Google Maps URL
      const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || ''
      const addressStr = typeof caseData.address === 'string'
        ? caseData.address
        : (caseData.address?.address || customerData?.contact_address || null)
      let mapUrl: string | null = null
      if (googleMapsKey && addressStr) {
        const encodedAddress = encodeURIComponent(addressStr)
        mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=560x200&scale=2&maptype=roadmap&markers=color:0x20C58F|${encodedAddress}&key=${googleMapsKey}`
      }

      html = generateSingleCaseHTML(caseData, customerData, reportType, images, preparations ?? [], billingItems ?? [], mapUrl)
      filename = `BeGone_Arende_${caseData.case_number || 'N/A'}_${new Date().toISOString().split('T')[0]}.pdf`
    } else if (reportType === 'multiple' && cases) {
      html = generateMultipleCasesHTML(cases, customerData, userRole || 'användare', period || 'alla')
      filename = `BeGone_Arenderapport_${customerData?.company_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Organisation'}_${new Date().toISOString().split('T')[0]}.pdf`
    } else {
      return res.status(400).json({ error: 'Invalid report configuration' })
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
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

    // Generate PDF — single-case följer dokumentstandarden med sidfot på varje
    // sida; multiple-cases behåller sin egen inbyggda footer
    const isSingle = reportType === 'single'
    const footerTemplate = `
      <div style="width: 100%; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #6b7280; padding: 0 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; padding-top: 6px; margin: 0 15mm;">
        <span>BeGone Skadedjur &amp; Sanering AB · info@begone.se · 010 280 44 10 · www.begone.se</span>
        <span>Sida <span class="pageNumber"></span> av <span class="totalPages"></span></span>
      </div>`
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      ...(isSingle ? {
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate,
      } : {}),
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: isSingle ? '20mm' : '15mm',
        left: '15mm'
      }
    })

    await browser.close()

    // Return PDF as base64
    const pdfBase64 = Buffer.from(pdf).toString('base64')
    
    res.status(200).json({ 
      success: true, 
      pdf: pdfBase64,
      filename
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
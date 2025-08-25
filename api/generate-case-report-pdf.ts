// api/generate-case-report-pdf.ts
// API endpoint for generating comprehensive case report PDFs using Puppeteer

import type { VercelRequest, VercelResponse } from '@vercel/node'
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
  error: '#EF4444',          // Red-500
}

// Helper functions
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Ej angivet'
  const date = new Date(dateString)
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
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

const getStatusBadgeColor = (status: string) => {
  if (status === 'Slutförd' || status === 'Stängd') return { bg: '#22C55E', text: '#FFFFFF' }
  if (status === 'Bokad' || status === 'Bokat' || status.startsWith('Återbesök')) return { bg: '#F59E0B', text: '#FFFFFF' }
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
    const activityLevel = pest_level >= 3 ? `Nivå ${pest_level} av 3\n\nHög nivå - Kräver omedelbar åtgärd` : `Nivå ${pest_level || 0} av 3\n\nMedium nivå - Bör åtgärdas`
    const situationRating = problem_rating >= 4 ? `${problem_rating} av 5\n\nAllvarligt - Åtgärd krävs` : `${problem_rating || 0} av 5\n\nMedium - Övervakning rekommenderas`
    
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

// Generate HTML for single case report
const generateSingleCaseHTML = (caseData: any, customerData: any, reportType: string) => {
  const trafficLight = getTrafficLightStatus(caseData.pest_level, caseData.problem_rating)
  const statusColors = getStatusBadgeColor(caseData.status)

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Ärenderapport - ${caseData.case_number || caseData.title}</title>
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
    
    .case-subtitle {
      font-size: 18px;
      color: ${beGoneColors.mediumGray};
      margin-bottom: 16px;
    }
    
    .status-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    
    .status-badge {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      background: ${statusColors.bg};
      color: ${statusColors.text};
    }
    
    .traffic-light {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      background: rgba(${trafficLight.color === '#EF4444' ? '239, 68, 68' : trafficLight.color === '#F59E0B' ? '245, 158, 11' : '34, 197, 94'}, 0.1);
      color: ${trafficLight.color};
      border: 1px solid ${trafficLight.color};
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
      margin-bottom: 16px;
      padding-left: 12px;
      border-left: 3px solid ${beGoneColors.lightGray};
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
    
    .no-content {
      font-style: italic;
      color: ${beGoneColors.mediumGray};
      text-align: center;
      padding: 20px;
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
        box-shadow: none;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      .card {
        page-break-inside: avoid;
      }
      
      h1, h2, .section-header {
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
      <h1 class="main-title">${caseData.case_number || 'Ärenderapport'}</h1>
      <div class="case-subtitle">${caseData.title || 'Ingen titel'}</div>
      <div class="status-row">
        <div class="status-badge">${caseData.status}</div>
        <div class="traffic-light">
          <span style="font-size: 16px;">${trafficLight.emoji}</span>
          <span>${trafficLight.label}</span>
        </div>
      </div>
    </div>
    
    <!-- Customer Information -->
    <div class="section">
      <div class="section-header">
        <span class="section-icon">🏢</span>
        Kunduppgifter
      </div>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">Företag</div>
            <div class="info-value">${customerData?.company_name || 'Okänt företag'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Kontaktperson</div>
            <div class="info-value">${caseData.contact_person || customerData?.contact_person || 'Ej specificerat'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Telefon</div>
            <div class="info-value">${caseData.contact_phone || customerData?.contact_phone || 'Ej angivet'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">E-post</div>
            <div class="info-value">${caseData.contact_email || customerData?.contact_email || 'Ej angivet'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Adress</div>
            <div class="info-value">${caseData.address?.address || customerData?.contact_address || 'Ej angivet'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Skadedjur</div>
            <div class="info-value">${caseData.pest_type || 'Ej specificerat'}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Service Information -->
    <div class="section">
      <div class="section-header">
        <span class="section-icon">👨‍🔧</span>
        Serviceinformation
      </div>
      <div class="card">
        <div class="info-grid">
          <div class="info-group">
            <div class="info-label">Tekniker</div>
            <div class="info-value">${caseData.primary_technician_name || 'Ej tilldelad'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Schemalagd tid</div>
            <div class="info-value">${formatDate(caseData.scheduled_start)}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Kostnad</div>
            <div class="info-value">${formatCurrency(caseData.price)}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Ärendet skapat</div>
            <div class="info-value">${formatDate(caseData.created_at)}</div>
          </div>
          ${caseData.time_spent_minutes ? `
          <div class="info-group">
            <div class="info-label">Arbetstid</div>
            <div class="info-value">${Math.floor(caseData.time_spent_minutes / 60)}h ${caseData.time_spent_minutes % 60}min</div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
    
    <!-- Technical Assessment -->
    ${(caseData.pest_level !== null || caseData.problem_rating !== null) ? `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">🔍</span>
        Teknisk bedömning
      </div>
      <div class="card">
        <div style="white-space: pre-line; line-height: 1.6; color: #374151; font-size: 14px; background: #F8FAFC; padding: 16px; border-radius: 8px; border-left: 4px solid ${trafficLight.color};">
          ${trafficLight.assessment}
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Description -->
    ${caseData.description ? `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">📝</span>
        Ärendebeskrivning
      </div>
      <div class="report-container">
        <div class="report-content">
          <div class="report-text">${caseData.description}</div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Work Report -->
    ${caseData.work_report ? `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">📋</span>
        Arbetsrapport
      </div>
      <div class="report-container">
        <div class="report-content">
          <div class="report-text">${caseData.work_report}</div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Recommendations -->
    ${caseData.recommendations ? `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">💡</span>
        Rekommendationer
      </div>
      <div class="report-container">
        <div class="report-content">
          <div class="report-text">${caseData.recommendations}</div>
          ${caseData.recommendations_acknowledged ? `
          <div style="margin-top: 16px; padding: 12px; background: #22C55E20; border-radius: 6px; border: 1px solid #22C55E;">
            <strong style="color: #22C55E;">✓ Bekräftat av kund:</strong> ${formatDate(caseData.recommendations_acknowledged_at)}
          </div>
          ` : ''}
        </div>
      </div>
    </div>
    ` : ''}
    
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

// Generate HTML for multiple cases report
const generateMultipleCasesHTML = (cases: any[], customerData: any, userRole: string, period: string) => {
  const totalCases = cases.length
  const activeCases = cases.filter(c => 
    ['Öppen', 'Bokad', 'Bokat', 'Pågående'].includes(c.status) || 
    c.status.startsWith('Återbesök')
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

  try {
    const { reportType, caseData, cases, customerData, userRole, period } = req.body

    if (!reportType) {
      return res.status(400).json({ error: 'Missing reportType' })
    }

    let html: string
    let filename: string

    if (reportType === 'single' && caseData) {
      html = generateSingleCaseHTML(caseData, customerData, reportType)
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
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    
    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Generate PDF
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
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
      color: ${beGoneColors.darkGray};
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
      line-height: 1.6;
      font-feature-settings: 'kern' 1, 'liga' 1, 'calt' 1;
      font-variant-ligatures: common-ligatures;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-optical-sizing: auto;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      position: relative;
      background: linear-gradient(135deg, #ffffff 0%, rgba(248, 250, 252, 0.3) 100%);
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.05),
        0 2px 4px rgba(10, 19, 40, 0.05),
        0 8px 24px rgba(10, 19, 40, 0.08),
        0 32px 64px rgba(10, 19, 40, 0.12);
      border-radius: 8px;
      backdrop-filter: blur(20px);
      overflow: hidden;
    }
    
    .container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, 
        ${beGoneColors.primary} 0%, 
        rgba(32, 197, 143, 0.8) 25%,
        ${beGoneColors.accent} 50%, 
        rgba(32, 197, 143, 0.8) 75%,
        ${beGoneColors.primary} 100%
      );
      border-radius: 8px 8px 0 0;
      box-shadow: 0 2px 8px rgba(32, 197, 143, 0.3);
    }
    
    .container::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle at 20% 20%, rgba(32, 197, 143, 0.02) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(10, 19, 40, 0.01) 0%, transparent 50%);
      pointer-events: none;
      z-index: 1;
    }
    
    /* Enterprise Header with Premium Styling */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 40px 0;
      background: linear-gradient(135deg, 
        rgba(248, 250, 252, 0.9) 0%, 
        rgba(255, 255, 255, 0.95) 40%,
        rgba(241, 245, 249, 0.8) 100%
      );
      border-bottom: 1px solid rgba(203, 213, 225, 0.3);
      margin: -20mm -20mm 40px -20mm;
      padding-left: 20mm;
      padding-right: 20mm;
      position: relative;
      page-break-inside: avoid;
      backdrop-filter: blur(12px);
      z-index: 2;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, 
        rgba(32, 197, 143, 0.02) 0%, 
        transparent 30%, 
        rgba(10, 19, 40, 0.01) 70%, 
        transparent 100%
      );
      pointer-events: none;
    }
    
    .header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 20mm;
      right: 20mm;
      height: 4px;
      background: linear-gradient(90deg, 
        transparent 0%, 
        rgba(32, 197, 143, 0.4) 10%,
        ${beGoneColors.accent} 30%, 
        ${beGoneColors.primary} 50%,
        ${beGoneColors.accent} 70%,
        rgba(32, 197, 143, 0.4) 90%,
        transparent 100%
      );
      opacity: 0.8;
      border-radius: 2px;
      box-shadow: 0 2px 8px rgba(32, 197, 143, 0.2);
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, 
        ${beGoneColors.accent} 0%, 
        rgba(32, 197, 143, 0.9) 30%,
        ${beGoneColors.accentDark} 70%,
        rgba(16, 185, 129, 0.95) 100%
      );
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 26px;
      box-shadow: 
        0 0 0 3px rgba(255, 255, 255, 0.1),
        0 4px 12px rgba(32, 197, 143, 0.2),
        0 8px 24px rgba(32, 197, 143, 0.15),
        0 16px 48px rgba(32, 197, 143, 0.1);
      position: relative;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .logo-icon::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, 
        transparent 30%, 
        rgba(255, 255, 255, 0.15) 45%,
        rgba(255, 255, 255, 0.25) 50%,
        rgba(255, 255, 255, 0.15) 55%,
        transparent 70%
      );
      transform: rotate(45deg) translateY(-20px);
      transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      animation: shimmer 3s ease-in-out infinite;
    }
    
    @keyframes shimmer {
      0%, 100% { transform: rotate(45deg) translateY(-20px); opacity: 0; }
      50% { transform: rotate(45deg) translateY(20px); opacity: 1; }
    }
    
    .logo-text {
      font-size: 32px;
      font-weight: 900;
      background: linear-gradient(135deg, 
        ${beGoneColors.primary} 0%, 
        rgba(10, 19, 40, 0.9) 30%,
        ${beGoneColors.accent} 70%,
        rgba(32, 197, 143, 0.8) 100%
      );
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.03em;
      position: relative;
      filter: drop-shadow(0 2px 4px rgba(10, 19, 40, 0.1));
    }
    
    .logo-text::after {
      content: 'BeGone';
      position: absolute;
      top: 0;
      left: 0;
      background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.1) 0%, 
        transparent 50%, 
        rgba(255, 255, 255, 0.05) 100%
      );
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      z-index: -1;
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
    
    /* Premium Title Section */
    .title-section {
      margin-bottom: 48px;
      padding: 32px 0;
      text-align: center;
      position: relative;
    }
    
    .title-section::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 120px;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, ${beGoneColors.accent} 50%, transparent 100%);
    }
    
    .main-title {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, ${beGoneColors.primary} 0%, ${beGoneColors.accent} 100%);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    
    .case-subtitle {
      font-size: 16px;
      color: ${beGoneColors.mediumGray};
      font-weight: 500;
    }
    
    /* Premium KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-bottom: 48px;
      page-break-inside: avoid;
      z-index: 2;
      position: relative;
    }
    
    .kpi-card {
      background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.95) 0%, 
        rgba(248, 250, 252, 0.9) 50%,
        rgba(241, 245, 249, 0.8) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 28px;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(20px) saturate(180%);
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.1),
        0 2px 4px rgba(10, 19, 40, 0.05),
        0 8px 24px rgba(10, 19, 40, 0.08),
        0 16px 48px rgba(10, 19, 40, 0.06);
    }
    
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, 
        rgba(32, 197, 143, 0.1) 0%, 
        transparent 30%,
        rgba(10, 19, 40, 0.02) 70%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.4s ease;
      border-radius: 20px;
    }
    
    .kpi-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, 
        transparent 0%,
        ${beGoneColors.accent} 20%,
        ${beGoneColors.primary} 50%,
        ${beGoneColors.accent} 80%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.4s ease;
      border-radius: 20px 20px 0 0;
      box-shadow: 0 2px 8px rgba(32, 197, 143, 0.3);
    }
    
    .kpi-card:hover {
      background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.98) 0%, 
        rgba(248, 250, 252, 0.95) 50%,
        rgba(241, 245, 249, 0.9) 100%
      );
      border-color: rgba(32, 197, 143, 0.4);
      transform: translateY(-4px) scale(1.02);
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.2),
        0 4px 8px rgba(10, 19, 40, 0.08),
        0 12px 32px rgba(10, 19, 40, 0.15),
        0 24px 64px rgba(32, 197, 143, 0.1);
    }
    
    .kpi-card:hover::before,
    .kpi-card:hover::after {
      opacity: 1;
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
      font-size: 28px;
      font-weight: 900;
      background: linear-gradient(135deg, 
        ${beGoneColors.primary} 0%, 
        rgba(10, 19, 40, 0.9) 20%,
        ${beGoneColors.accent} 60%,
        rgba(32, 197, 143, 0.9) 80%,
        ${beGoneColors.primary} 100%
      );
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
      line-height: 1.1;
      letter-spacing: -0.02em;
      position: relative;
      filter: drop-shadow(0 1px 2px rgba(10, 19, 40, 0.1));
      transition: all 0.3s ease;
    }
    
    .kpi-card:hover .kpi-value {
      transform: scale(1.05);
      filter: drop-shadow(0 2px 4px rgba(32, 197, 143, 0.2));
    }
    
    .kpi-subtitle {
      color: ${beGoneColors.mediumGray};
      font-size: 12px;
      font-weight: 500;
      opacity: 0.8;
    }
    
    /* Premium Section Headers */
    .section {
      margin-bottom: 48px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 22px;
      font-weight: 700;
      color: ${beGoneColors.primary};
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      page-break-after: avoid;
      position: relative;
      padding-bottom: 12px;
    }
    
    .section-title::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 60px;
      height: 2px;
      background: linear-gradient(90deg, ${beGoneColors.primary} 0%, ${beGoneColors.accent} 100%);
      opacity: 0.6;
    }
    
    .section-title.accent {
      color: ${beGoneColors.accent};
    }
    
    .section-title.accent::after {
      background: linear-gradient(90deg, ${beGoneColors.accent} 0%, ${beGoneColors.primary} 100%);
    }
    
    .section-icon {
      font-size: 22px;
      min-width: 22px;
      line-height: 1;
      opacity: 0.8;
    }
    
    /* Premium Cards */
    .card {
      background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.95) 0%, 
        rgba(248, 250, 252, 0.9) 40%,
        rgba(241, 245, 249, 0.85) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 36px;
      margin-bottom: 32px;
      page-break-inside: avoid;
      backdrop-filter: blur(20px) saturate(180%);
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.05),
        0 2px 4px rgba(10, 19, 40, 0.04),
        0 8px 24px rgba(10, 19, 40, 0.06),
        0 16px 48px rgba(10, 19, 40, 0.04);
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 20px;
      background: linear-gradient(135deg, 
        rgba(32, 197, 143, 0.08) 0%, 
        transparent 30%,
        rgba(10, 19, 40, 0.03) 70%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    
    .card::after {
      content: '';
      position: absolute;
      top: -1px;
      left: -1px;
      right: -1px;
      bottom: -1px;
      border-radius: 21px;
      background: linear-gradient(135deg, 
        rgba(32, 197, 143, 0.2) 0%, 
        transparent 30%,
        rgba(10, 19, 40, 0.1) 70%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.4s ease;
      z-index: -1;
    }
    
    .card:hover {
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.1),
        0 4px 8px rgba(10, 19, 40, 0.08),
        0 16px 48px rgba(10, 19, 40, 0.12),
        0 24px 80px rgba(32, 197, 143, 0.08);
      border-color: rgba(32, 197, 143, 0.4);
      transform: translateY(-3px) scale(1.005);
      background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.98) 0%, 
        rgba(248, 250, 252, 0.95) 40%,
        rgba(241, 245, 249, 0.9) 100%
      );
    }
    
    .card:hover::before,
    .card:hover::after {
      opacity: 1;
    }
    
    .card.accent-border {
      border: 2px solid ${beGoneColors.accent};
      background: linear-gradient(135deg, rgba(32, 197, 143, 0.02) 0%, white 100%);
      box-shadow: 0 8px 24px rgba(32, 197, 143, 0.15);
    }
    
    /* Premium Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    
    .info-group {
      margin-bottom: 20px;
      position: relative;
      padding-left: 16px;
    }
    
    .info-group::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      width: 3px;
      height: calc(100% - 8px);
      background: linear-gradient(180deg, ${beGoneColors.accent} 0%, transparent 100%);
      opacity: 0.3;
      border-radius: 2px;
    }
    
    .info-label {
      font-size: 10px;
      font-weight: 700;
      color: ${beGoneColors.mediumGray};
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
      opacity: 0.8;
    }
    
    .info-value {
      font-size: 15px;
      color: ${beGoneColors.darkGray};
      font-weight: 600;
      line-height: 1.4;
    }
    
    /* Premium Report Section */
    .report-section {
      background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.6) 100%);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 40px;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
    }
    
    .report-section::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(32, 197, 143, 0.03) 0%, transparent 50%);
      opacity: 0.6;
      pointer-events: none;
    }
    
    .report-content {
      background: linear-gradient(135deg, white 0%, rgba(248, 250, 252, 0.9) 100%);
      border: 1px solid rgba(203, 213, 225, 0.4);
      border-radius: 16px;
      padding: 32px;
      min-height: 240px;
      page-break-inside: avoid;
      box-shadow: 0 4px 16px rgba(10, 19, 40, 0.08);
      position: relative;
      backdrop-filter: blur(4px);
    }
    
    .report-text {
      font-size: 16px;
      line-height: 1.8;
      color: ${beGoneColors.darkGray};
      white-space: pre-wrap;
      padding: 0;
      font-weight: 400;
      letter-spacing: 0.01em;
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
    
    /* Premium Cost Summary */
    .cost-summary {
      text-align: center;
      padding: 32px;
      page-break-inside: avoid;
      position: relative;
    }
    
    .cost-summary::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 120px;
      height: 120px;
      background: radial-gradient(circle, rgba(32, 197, 143, 0.08) 0%, transparent 70%);
      border-radius: 50%;
      z-index: -1;
    }
    
    .cost-label {
      font-size: 12px;
      color: ${beGoneColors.mediumGray};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      opacity: 0.8;
    }
    
    .cost-value {
      font-size: 48px;
      font-weight: 900;
      background: linear-gradient(135deg, 
        ${beGoneColors.accent} 0%, 
        rgba(32, 197, 143, 0.9) 25%,
        ${beGoneColors.primary} 50%,
        rgba(10, 19, 40, 0.9) 75%,
        ${beGoneColors.accent} 100%
      );
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
      letter-spacing: -0.03em;
      position: relative;
      filter: drop-shadow(0 2px 4px rgba(32, 197, 143, 0.15));
      animation: subtle-pulse 4s ease-in-out infinite;
    }
    
    @keyframes subtle-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    
    .cost-subtitle {
      color: ${beGoneColors.mediumGray};
      font-size: 14px;
      margin-top: 12px;
      font-weight: 500;
      opacity: 0.8;
    }
    
    /* Premium Footer */
    .footer {
      margin-top: 72px;
      padding: 48px 0 32px 0;
      background: linear-gradient(135deg, 
        rgba(248, 250, 252, 0.9) 0%, 
        rgba(241, 245, 249, 0.85) 40%,
        rgba(226, 232, 240, 0.7) 100%
      );
      border-top: 1px solid rgba(203, 213, 225, 0.3);
      text-align: center;
      page-break-inside: avoid;
      position: relative;
      margin-left: -20mm;
      margin-right: -20mm;
      padding-left: 20mm;
      padding-right: 20mm;
      margin-bottom: -20mm;
      border-radius: 0 0 8px 8px;
      backdrop-filter: blur(20px);
      z-index: 2;
    }
    
    .footer::before {
      content: '';
      position: absolute;
      top: 0;
      left: 20mm;
      right: 20mm;
      height: 4px;
      background: linear-gradient(90deg, 
        transparent 0%, 
        rgba(32, 197, 143, 0.3) 10%,
        ${beGoneColors.accent} 25%, 
        ${beGoneColors.primary} 50%, 
        ${beGoneColors.accent} 75%,
        rgba(32, 197, 143, 0.3) 90%,
        transparent 100%
      );
      opacity: 0.6;
      border-radius: 2px;
      box-shadow: 0 2px 12px rgba(32, 197, 143, 0.2);
    }
    
    .footer::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle at 30% 40%, rgba(32, 197, 143, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 70% 60%, rgba(10, 19, 40, 0.02) 0%, transparent 50%);
      pointer-events: none;
    }
    
    .footer-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .footer-text {
      color: ${beGoneColors.mediumGray};
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 16px;
      font-weight: 500;
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .footer-contact {
      margin-top: 16px;
      color: ${beGoneColors.darkGray};
      font-size: 14px;
      font-weight: 500;
    }
    
    .footer-contact a {
      color: ${beGoneColors.accent};
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }
    
    .footer-contact a:hover {
      color: ${beGoneColors.primary};
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
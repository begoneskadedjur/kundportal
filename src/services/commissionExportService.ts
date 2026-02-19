// 📁 src/services/commissionExportService.ts - Excel/PDF export och email-rapporter för löneavdelning
import type { CommissionCaseDetail } from '../types/commission';
import { formatCurrency, formatSwedishDate, prepareExportData } from './commissionCalculations';

// 1. Excel export (CSV format för enkel implementation)
export const exportToExcel = async (
  cases: CommissionCaseDetail[], 
  month: string,
  filename?: string
): Promise<void> => {
  try {
    const exportData = prepareExportData(cases);
    
    // Skapa CSV headers
    const headers = [
      'Tekniker',
      'E-post',
      'Antal ärenden',
      'Total provision',
      'Privatperson provision',
      'Företag provision',
      'Ärendenummer',
      'Ärendetitel',
      'Typ',
      'Ärendepris',
      'Provision',
      'Slutfört datum',
      'Kundinfo'
    ];
    
    // Skapa CSV rader
    const rows: string[] = [headers.join(',')];
    
    exportData.forEach(tech => {
      tech.cases.forEach((case_, index) => {
        const row = [
          // Tekniker-info (endast på första raden per tekniker)
          index === 0 ? `"${tech.technician_name}"` : '""',
          index === 0 ? `"${tech.technician_email}"` : '""',
          index === 0 ? tech.case_count.toString() : '""',
          index === 0 ? tech.total_commission.toString() : '""',
          index === 0 ? tech.private_commission.toString() : '""',
          index === 0 ? tech.business_commission.toString() : '""',
          
          // Ärende-info
          `"${case_.case_number}"`,
          `"${case_.title}"`,
          `"${case_.type}"`,
          case_.case_price.toString(),
          case_.commission_amount.toString(),
          `"${case_.completed_date}"`,
          `"${case_.customer_info}"`
        ];
        
        rows.push(row.join(','));
      });
      
      // Tom rad mellan tekniker
      if (tech.cases.length > 0) {
        rows.push('');
      }
    });
    
    // Skapa och ladda ner fil
    const csvContent = rows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const defaultFilename = filename || `provisioner_${month}_${new Date().toISOString().slice(0, 10)}.csv`;
    
    downloadBlob(blob, defaultFilename);
    
    console.log(`✅ Excel export completed: ${defaultFilename}`);
    
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};

// 2. PDF export (HTML to PDF conversion)
export const exportToPdf = async (
  cases: CommissionCaseDetail[],
  month: string,
  filename?: string
): Promise<void> => {
  try {
    const exportData = prepareExportData(cases);
    
    // Beräkna totaler
    const totalCommission = cases.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
    const totalCases = cases.length;
    const uniqueTechnicians = new Set(cases.map(c => c.primary_assignee_id)).size;
    
    // Skapa HTML content
    const htmlContent = createHtmlReport(exportData, month, totalCommission, totalCases, uniqueTechnicians);
    
    // Skapa blob och ladda ner som HTML (för utskrift till PDF)
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const defaultFilename = filename || `provisioner_${month}_${new Date().toISOString().slice(0, 10)}.html`;
    
    downloadBlob(blob, defaultFilename);
    
    console.log(`✅ PDF/HTML export completed: ${defaultFilename}`);
    
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
};

// 3. Email export data preparation
export const prepareEmailData = (
  cases: CommissionCaseDetail[],
  month: string
): {
  subject: string;
  htmlContent: string;
  attachmentData?: string;
} => {
  const exportData = prepareExportData(cases);
  const totalCommission = cases.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const totalCases = cases.length;
  const uniqueTechnicians = new Set(cases.map(c => c.primary_assignee_id)).size;
  
  const subject = `BeGone Provisionsrapport - ${getMonthDisplayName(month)}`;
  
  const htmlContent = createEmailHtml(exportData, month, totalCommission, totalCases, uniqueTechnicians);
  
  return {
    subject,
    htmlContent
  };
};

// 4. Batch export for payroll
export const exportForPayroll = async (
  cases: CommissionCaseDetail[],
  month: string
): Promise<{ excel: Blob; summary: string }> => {
  try {
    const exportData = prepareExportData(cases);
    
    // Skapa payroll-specifikt CSV format (använd semikolon som avgränsare)
    const headers = [
      'Anställningsnummer',
      'Namn',
      'E-post', 
      'Provisionsbelopp',
      'Antal ärenden',
      'Period',
      'Kommentar'
    ];
    
    const rows: string[] = [headers.join(';')];
    
    exportData.forEach(tech => {
      const comment = `${tech.case_count} ärenden (${tech.private_commission > 0 ? 'Privat: ' + formatCurrency(tech.private_commission) : ''}${tech.private_commission > 0 && tech.business_commission > 0 ? ', ' : ''}${tech.business_commission > 0 ? 'Företag: ' + formatCurrency(tech.business_commission) : ''})`;
      
      const row = [
        '""', // Anställningsnummer - fylls i av löneadmin
        `"${tech.technician_name}"`,
        `"${tech.technician_email}"`,
        tech.total_commission.toString().replace('.', ','), // Svenska decimaler
        tech.case_count.toString(),
        `"${getMonthDisplayName(month)}"`,
        `"${comment}"`
      ];
      
      rows.push(row.join(';'));
    });
    
    const csvContent = rows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const summary = `
      Provisionsexport för lönehantering - ${getMonthDisplayName(month)}
      
      📊 Sammanfattning:
      • ${exportData.length} tekniker med provisioner
      • ${cases.length} ärenden totalt
      • ${formatCurrency(exportData.reduce((sum, t) => sum + t.total_commission, 0))} total provision
      
      📋 Nästa steg:
      1. Öppna CSV-filen i Excel (bör öppnas korrekt med semikolon-avgränsare).
      2. Fyll i anställningsnummer för varje tekniker.
      3. Kontrollera beloppen.
      4. Importera till lönesystem.
      
      ⚠️ OBS: Kontrollera att alla provisioner är korrekta innan import till lönesystem.
    `;
    
    return { excel: blob, summary };
    
  } catch (error) {
    console.error('Error exporting for payroll:', error);
    throw error;
  }
};

// 5. Summary report generation (for text-based views)
export const generateSummaryReport = (cases: CommissionCaseDetail[], month: string): string => {
  const exportData = prepareExportData(cases);
  const totalCommission = cases.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const privateCommission = cases.filter(c => c.type === 'private').reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const businessCommission = cases.filter(c => c.type === 'business').reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  
  const commissions = exportData.map(t => t.total_commission);
  const avgCommission = commissions.length > 0 ? commissions.reduce((sum, c) => sum + c, 0) / commissions.length : 0;
  const maxCommission = commissions.length > 0 ? Math.max(...commissions) : 0;
  const topPerformer = exportData.find(t => t.total_commission === maxCommission);
  
  return `
BeGone Provisionsrapport - ${getMonthDisplayName(month)}
${'='.repeat(50)}

📊 SAMMANFATTNING
• Total provision: ${formatCurrency(totalCommission)}
• Antal ärenden: ${cases.length}
• Aktiva tekniker: ${exportData.length}
• Genomsnittlig provision: ${formatCurrency(avgCommission)}

📈 FÖRDELNING
• Privatpersoner: ${formatCurrency(privateCommission)} (${cases.filter(c => c.type === 'private').length} ärenden)
• Företag: ${formatCurrency(businessCommission)} (${cases.filter(c => c.type === 'business').length} ärenden)

🏆 TOPPRESTANDA
• Högsta provision: ${formatCurrency(maxCommission)}${topPerformer ? ` (${topPerformer.technician_name})` : ''}

👥 TEKNIKER RANKING
${exportData.map((tech, index) => 
  `${(index + 1).toString().padStart(2, ' ')}. ${tech.technician_name.padEnd(20, ' ')}: ${formatCurrency(tech.total_commission)} (${tech.case_count} ärenden)`
).join('\n')}

📅 GENERERAD: ${formatSwedishDate(new Date().toISOString())}
🔗 KÄLLA: BeGone Kundportal
  `;
};

// 6. Export utilities
const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!navigator.clipboard) {
    console.warn('Clipboard API not available.');
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

// 7. Print utility
export const printReport = (htmlContent: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Could not open print window.');
    return;
  }
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  // Ge innehållet en chans att rendera innan utskrift
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

// 8. Helper functions
const getMonthDisplayName = (month: string): string => {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
};

// 9. Export validation
export const validateExportData = (cases: CommissionCaseDetail[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!cases || cases.length === 0) {
    errors.push('Det finns inga provisionsgrundande ärenden för den valda perioden.');
    return { isValid: false, errors };
  }
  
  const casesWithoutCommission = cases.filter(c => (c.commission_amount || 0) <= 0);
  if (casesWithoutCommission.length > 0) {
    // This might be a valid state (e.g., cases with 0 price), so we can make it a warning instead of an error.
    // For now, let's report it.
    console.warn(`${casesWithoutCommission.length} ärenden har inget provisionsbelopp.`);
  }
  
  const casesWithoutTechnician = cases.filter(c => !c.primary_assignee_id);
  if (casesWithoutTechnician.length > 0) {
    errors.push(`${casesWithoutTechnician.length} ärenden saknar en primär tekniker och kan inte ingå i exporten.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// --- HTML Generation Helpers ---

function createHtmlReport(exportData: CommissionExportData[], month: string, totalCommission: number, totalCases: number, uniqueTechnicians: number): string {
    return `
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="utf-8">
        <title>BeGone Provisionsrapport - ${month}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #22c55e; padding-bottom: 20px; }
          .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; text-align: center; }
          .summary-value { font-size: 24px; font-weight: bold; color: #22c55e; }
          .technician-section { margin-bottom: 40px; page-break-inside: avoid; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
          .technician-header { background: #22c55e; color: white; padding: 15px; font-size: 18px; font-weight: bold; }
          .technician-summary { background: #f1f8f1; padding: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
          .cases-table { width: 100%; border-collapse: collapse; margin-top: 0; }
          .cases-table th, .cases-table td { border-top: 1px solid #ddd; padding: 10px; text-align: left; }
          .cases-table th { background: #f8f9fa; font-weight: 600; }
          .cases-table tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
          @media print {
            body { margin: 0.5in; }
            .no-print { display: none; }
            .technician-section { page-break-before: always; }
            .technician-section:first-of-type { page-break-before: auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🐛 BeGone Skadedjur</h1>
          <h2>Provisionsrapport - ${getMonthDisplayName(month)}</h2>
          <p>Genererad: ${formatSwedishDate(new Date().toISOString())}</p>
        </div>
        
        <div class="summary">
          <h3>Total Sammanfattning</h3>
          <div class="summary-grid">
            <div><div class="summary-value">${formatCurrency(totalCommission)}</div><div>Total provision</div></div>
            <div><div class="summary-value">${totalCases}</div><div>Antal ärenden</div></div>
            <div><div class="summary-value">${uniqueTechnicians}</div><div>Aktiva tekniker</div></div>
          </div>
        </div>
        
        ${exportData.map(tech => `
          <div class="technician-section">
            <div class="technician-header">${tech.technician_name} (${tech.technician_email})</div>
            <div class="technician-summary">
              <div><strong>Total provision:</strong><br>${formatCurrency(tech.total_commission)}</div>
              <div><strong>Antal ärenden:</strong><br>${tech.case_count}</div>
              <div><strong>Privatperson:</strong><br>${formatCurrency(tech.private_commission)}</div>
              <div><strong>Företag:</strong><br>${formatCurrency(tech.business_commission)}</div>
            </div>
            <table class="cases-table">
              <thead><tr><th>Ärendenr</th><th>Titel</th><th>Typ</th><th>Pris</th><th>Provision</th><th>Datum</th><th>Kund</th></tr></thead>
              <tbody>
                ${tech.cases.map(case_ => `
                  <tr>
                    <td>${case_.case_number}</td><td>${case_.title}</td><td>${case_.type}</td>
                    <td>${formatCurrency(case_.case_price)}</td><td>${formatCurrency(case_.commission_amount)}</td>
                    <td>${case_.completed_date}</td><td>${case_.customer_info}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
        
        <div class="footer">
          <p>BeGone Skadedjur | Denna rapport är konfidentiell</p>
        </div>
        <button class="no-print" onclick="window.print()" style="position:fixed; bottom:20px; right:20px; padding: 12px 20px; background: #22c55e; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
          Skriv ut
        </button>
      </body>
      </html>
    `;
}

function createEmailHtml(exportData: CommissionExportData[], month: string, totalCommission: number, totalCases: number, uniqueTechnicians: number): string {
    const portalUrl = window.location.origin;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">🐛 BeGone Skadedjur</h1>
          <h2 style="margin: 10px 0 0 0; font-weight: normal;">Provisionsrapport - ${getMonthDisplayName(month)}</h2>
        </div>
        <div style="background: #f8f9fa; padding: 30px;">
          <h3 style="color: #22c55e; margin-top: 0;">Sammanfattning</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
            <div style="text-align: center; background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${formatCurrency(totalCommission)}</div><div style="color: #666;">Total provision</div>
            </div>
            <div style="text-align: center; background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${totalCases}</div><div style="color: #666;">Antal ärenden</div>
            </div>
            <div style="text-align: center; background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${uniqueTechnicians}</div><div style="color: #666;">Aktiva tekniker</div>
            </div>
          </div>
          <h3 style="color: #22c55e;">Provision per tekniker</h3>
          ${exportData.map(tech => `
            <div style="background: white; margin-bottom: 15px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
              <div style="background: #f1f8f1; color: #333; padding: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${tech.technician_name} (${tech.case_count} ärenden)</div>
              <div style="padding: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div><strong>Total:</strong><br>${formatCurrency(tech.total_commission)}</div>
                <div><strong>Privat:</strong><br>${formatCurrency(tech.private_commission)}</div>
                <div><strong>Företag:</strong><br>${formatCurrency(tech.business_commission)}</div>
              </div>
            </div>
          `).join('')}
          <div style="margin-top: 30px; padding: 20px; background: #e0f2fe; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <h4 style="margin: 0 0 10px 0; color: #0369a1;">📋 För fullständig rapport</h4>
            <p style="margin: 0;">En detaljerad CSV-fil för lönesystemet bifogas. För att granska eller skriva ut den fullständiga rapporten, vänligen logga in i portalen.</p>
            <a href="${portalUrl}/admin/provisioner" style="display: inline-block; margin-top: 15px; background: #0ea5e9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Öppna provisionshantering</a>
          </div>
        </div>
        <div style="background: #1f2937; color: #a0aec0; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">Automatiskt genererad från BeGone Kundportal. Svara inte på detta e-postmeddelande.</p>
        </div>
      </div>
    `;
}
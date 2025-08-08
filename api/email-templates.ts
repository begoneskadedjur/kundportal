// api/email-templates.ts - Professionella e-postmallar för Begone Skadedjur

interface EmailTemplateParams {
  recipientName?: string
  companyName?: string
  contractType?: string
  startDate?: string
  loginLink?: string
  tempPassword?: string
  contactPerson?: string
  technicianName?: string
  reportContent?: string
  customMessage?: string
}

// Bas HTML-mall med responsiv design och dark mode stöd
const baseTemplate = (content: string, title: string = 'Begone Skadedjur') => `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a202c !important; }
      .email-container { background-color: #2d3748 !important; }
      .text-primary { color: #e2e8f0 !important; }
      .text-secondary { color: #cbd5e0 !important; }
      .card { background-color: #2d3748 !important; border-color: #4a5568 !important; }
      .button-primary { background-color: #48bb78 !important; }
      .footer { background-color: #1a202c !important; }
    }
    
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 20px !important; }
      .content-section { padding: 20px !important; }
      .button-primary { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333;">
  <div class="email-body" style="background-color: #f7fafc; padding: 40px 0;">
    <div class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0a1328 0%, #1e3a5f 100%); padding: 40px 30px; text-align: center;">
        <div style="display: inline-block; padding: 12px 24px; background-color: rgba(255, 255, 255, 0.1); border-radius: 8px; backdrop-filter: blur(10px);">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
            Begone Skadedjur & Sanering AB
          </h1>
        </div>
        <p style="margin: 10px 0 0 0; color: #20c58f; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
          Skadedjursbekämpning i världsklass
        </p>
      </div>
      
      <!-- Content -->
      <div class="content-section" style="padding: 40px 30px;">
        ${content}
      </div>
      
      <!-- Footer -->
      <div class="footer" style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px;">
          Begone Skadedjur & Sanering AB
        </p>
        <p style="margin: 0 0 10px 0; color: #718096; font-size: 13px;">
          Org.nr: 559378-9208 | Tel: 010 280 44 10
        </p>
        <p style="margin: 0 0 10px 0; color: #718096; font-size: 13px;">
          E-post: <a href="mailto:info@begone.se" style="color: #20c58f; text-decoration: none;">info@begone.se</a>
        </p>
        <p style="margin: 0 0 15px 0; color: #718096; font-size: 13px;">
          <a href="https://begone.se" style="color: #20c58f; text-decoration: none;">www.begone.se</a>
        </p>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #a0aec0; font-size: 12px;">
            Detta är ett automatiskt meddelande från Begone Kundportal.<br>
            Vänligen svara inte på detta e-postmeddelande.
          </p>
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>
`

// Välkomstmall för nya användare
export const welcomeEmailTemplate = (params: EmailTemplateParams): string => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 24px; font-weight: 600;" class="text-primary">
      Välkommen till Begone Kundportal!
    </h2>
    
    <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;" class="text-secondary">
      Vi är glada att välkomna <strong>${params.companyName}</strong> som kund hos Begone Skadedjur.
    </p>
    
    <p style="margin: 0 0 25px 0; color: #4a5568; font-size: 16px; line-height: 1.6;" class="text-secondary">
      Ni har nu tillgång till vår kundportal där ni enkelt kan:
    </p>
    
    <div class="card" style="background-color: #f7fafc; border-left: 4px solid #20c58f; padding: 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <ul style="margin: 0; padding: 0 0 0 20px; color: #4a5568; font-size: 15px; line-height: 1.8;">
        <li>Se och hantera era avtal</li>
        <li>Följa upp pågående ärenden</li>
        <li>Ladda ner rapporter och dokumentation</li>
        <li>Kontakta er dedikerade kontaktperson</li>
        <li>Boka service och uppföljningar</li>
      </ul>
    </div>
    
    ${params.contractType ? `
    <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 18px; font-weight: 600;">
        Era avtalsuppgifter
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #4a5568; font-size: 14px;">Avtalstyp:</td>
          <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">${params.contractType}</td>
        </tr>
        ${params.startDate ? `
        <tr>
          <td style="padding: 8px 0; color: #4a5568; font-size: 14px;">Startdatum:</td>
          <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">${params.startDate}</td>
        </tr>
        ` : ''}
        ${params.contactPerson ? `
        <tr>
          <td style="padding: 8px 0; color: #4a5568; font-size: 14px;">Er kontaktperson:</td>
          <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">${params.contactPerson}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    ` : ''}
    
    ${params.tempPassword ? `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: #991b1b; font-size: 18px; font-weight: 600;">
        Era inloggningsuppgifter
      </h3>
      <p style="margin: 0 0 10px 0; color: #4a5568; font-size: 14px;">
        <strong>E-post:</strong> ${params.recipientName}
      </p>
      <p style="margin: 0 0 15px 0; color: #4a5568; font-size: 14px;">
        <strong>Tillfälligt lösenord:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${params.tempPassword}</code>
      </p>
      <p style="margin: 0; color: #991b1b; font-size: 13px; font-style: italic;">
        Av säkerhetsskäl ber vi er att ändra lösenordet vid första inloggningen.
      </p>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${params.loginLink}" class="button-primary" style="display: inline-block; padding: 14px 32px; background-color: #20c58f; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(32, 197, 143, 0.25); transition: all 0.3s;">
        Logga in till Kundportalen
      </a>
    </div>
    
    <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 35px;">
      <p style="margin: 0 0 15px 0; color: #4a5568; font-size: 15px;">
        <strong>Behöver ni hjälp?</strong>
      </p>
      <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
        Vårt supportteam finns tillgängligt vardagar 08:00-17:00<br>
        E-post: <a href="mailto:info@begone.se" style="color: #20c58f; text-decoration: none;">info@begone.se</a><br>
        Telefon: <a href="tel:0102804410" style="color: #20c58f; text-decoration: none;">010 280 44 10</a>
      </p>
    </div>
  `
  
  return baseTemplate(content, 'Välkommen till Begone Kundportal')
}

// Mall för befintliga användare som får tillgång till ny kund
export const accessGrantedEmailTemplate = (params: EmailTemplateParams): string => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 24px; font-weight: 600;" class="text-primary">
      Ny kundåtkomst beviljad
    </h2>
    
    <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;" class="text-secondary">
      Ni har nu fått tillgång till kundportalen för <strong>${params.companyName}</strong>.
    </p>
    
    <div class="card" style="background-color: #f7fafc; border-left: 4px solid #20c58f; padding: 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #1a202c; font-size: 16px; font-weight: 600;">
        Vad innebär detta?
      </p>
      <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
        Ni kan nu logga in med era befintliga inloggningsuppgifter för att se och hantera information relaterad till ${params.companyName}.
      </p>
    </div>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${params.loginLink}" class="button-primary" style="display: inline-block; padding: 14px 32px; background-color: #20c58f; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(32, 197, 143, 0.25);">
        Gå till Kundportalen
      </a>
    </div>
  `
  
  return baseTemplate(content, 'Ny kundåtkomst - Begone Kundportal')
}

// Mall för påminnelse om befintlig access
export const reminderEmailTemplate = (params: EmailTemplateParams): string => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 24px; font-weight: 600;" class="text-primary">
      Påminnelse om er portalåtkomst
    </h2>
    
    <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;" class="text-secondary">
      Detta är en påminnelse om att ni redan har tillgång till Begone Kundportal för <strong>${params.companyName}</strong>.
    </p>
    
    <div class="card" style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <p style="margin: 0; color: #9a3412; font-size: 14px;">
        Om ni har glömt era inloggningsuppgifter kan ni återställa lösenordet via länken nedan.
      </p>
    </div>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${params.loginLink}" class="button-primary" style="display: inline-block; padding: 14px 32px; background-color: #20c58f; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(32, 197, 143, 0.25);">
        Logga in
      </a>
    </div>
    
    <p style="margin: 25px 0 0 0; color: #718096; font-size: 14px; text-align: center;">
      <a href="${params.loginLink}/reset-password" style="color: #20c58f; text-decoration: none;">
        Återställ lösenord →
      </a>
    </p>
  `
  
  return baseTemplate(content, 'Påminnelse - Begone Kundportal')
}

// Mall för arbetsrapporter
export const workReportEmailTemplate = (params: EmailTemplateParams): string => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 24px; font-weight: 600;" class="text-primary">
      Arbetsrapport från Begone Skadedjur
    </h2>
    
    <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;" class="text-secondary">
      En ny arbetsrapport har skapats för ${params.companyName}.
    </p>
    
    ${params.technicianName ? `
    <div style="background-color: #f7fafc; padding: 15px 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <p style="margin: 0; color: #4a5568; font-size: 14px;">
        <strong>Tekniker:</strong> ${params.technicianName}
      </p>
    </div>
    ` : ''}
    
    ${params.reportContent ? `
    <div class="card" style="background-color: #ffffff; border: 1px solid #e2e8f0; padding: 20px; margin: 0 0 25px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: #1a202c; font-size: 18px; font-weight: 600;">
        Utfört arbete
      </h3>
      <div style="color: #4a5568; font-size: 14px; line-height: 1.6;">
        ${params.reportContent}
      </div>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${params.loginLink}" class="button-primary" style="display: inline-block; padding: 14px 32px; background-color: #20c58f; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(32, 197, 143, 0.25);">
        Se fullständig rapport
      </a>
    </div>
    
    <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 35px;">
      <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
        Har ni frågor om rapporten? Kontakta oss gärna på<br>
        <a href="mailto:info@begone.se" style="color: #20c58f; text-decoration: none;">info@begone.se</a> eller 
        <a href="tel:0102804410" style="color: #20c58f; text-decoration: none;">010 280 44 10</a>
      </p>
    </div>
  `
  
  return baseTemplate(content, 'Arbetsrapport - Begone Skadedjur')
}

// Generisk mall för anpassade meddelanden
export const customEmailTemplate = (title: string, params: EmailTemplateParams): string => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 24px; font-weight: 600;" class="text-primary">
      ${title}
    </h2>
    
    ${params.customMessage ? `
    <div style="color: #4a5568; font-size: 16px; line-height: 1.6;" class="text-secondary">
      ${params.customMessage}
    </div>
    ` : ''}
    
    ${params.loginLink ? `
    <div style="text-align: center; margin: 35px 0;">
      <a href="${params.loginLink}" class="button-primary" style="display: inline-block; padding: 14px 32px; background-color: #20c58f; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(32, 197, 143, 0.25);">
        Gå till Kundportalen
      </a>
    </div>
    ` : ''}
  `
  
  return baseTemplate(content, title)
}

// Funktion för välkomstmail (ny användare)
export const getWelcomeEmailTemplate = (params: {
  customer: any;
  recipientEmail: string;
  recipientName: string;
  loginLink: string;
  isNewUser: boolean;
  tempPassword?: string | null;
}): string => {
  return welcomeEmailTemplate({
    companyName: params.customer.company_name,
    contractType: params.customer.contract_type,
    startDate: params.customer.contract_start_date 
      ? new Date(params.customer.contract_start_date).toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: 'long', 
          day: 'numeric'
        })
      : undefined,
    contactPerson: params.customer.assigned_account_manager || params.customer.sales_person,
    recipientName: params.recipientEmail,
    loginLink: params.loginLink,
    tempPassword: params.tempPassword || undefined
  })
}

// Funktion för befintlig användare som får ny kundåtkomst
export const getAccessEmailTemplate = (params: {
  customer: any;
  recipientEmail: string;
  recipientName: string;
  loginLink: string;
  isNewUser: boolean;
}): string => {
  return accessGrantedEmailTemplate({
    companyName: params.customer.company_name,
    recipientName: params.recipientEmail,
    loginLink: params.loginLink
  })
}

// Funktion för påminnelse-mail (redan har access)
export const getReminderEmailTemplate = (params: {
  customer: any;
  recipientEmail: string;
  recipientName: string;
  loginLink: string;
  isNewUser: boolean;
}): string => {
  return reminderEmailTemplate({
    companyName: params.customer.company_name,
    recipientName: params.recipientEmail,
    loginLink: params.loginLink
  })
}
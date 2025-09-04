// api/email-templates/staff-welcome.ts - Välkomstmail för anställda

export interface StaffWelcomeEmailParams {
  recipientName: string
  recipientEmail: string
  tempPassword: string
  role: 'admin' | 'koordinator' | 'technician'
  loginLink: string
}

const getRoleDescription = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Som administratör har du full tillgång till alla systemfunktioner, inklusive personalhantering, ekonomi och rapporter.'
    case 'koordinator':
      return 'Som koordinator hanterar du schemaläggning, ärenden och samordning mellan tekniker och kunder.'
    case 'technician':
      return 'Som tekniker har du tillgång till dina ärenden, scheman, provision och kundrapporter.'
    default:
      return 'Du har tillgång till de funktioner som krävs för din roll.'
  }
}

const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Administratör'
    case 'koordinator':
      return 'Koordinator'
    case 'technician':
      return 'Skadedjurstekniker'
    default:
      return 'Anställd'
  }
}

export const getStaffWelcomeEmailTemplate = (params: StaffWelcomeEmailParams): string => {
  const {
    recipientName,
    recipientEmail,
    tempPassword,
    role,
    loginLink
  } = params

  const roleDescription = getRoleDescription(role)
  const roleDisplayName = getRoleDisplayName(role)

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Välkommen till Begone Kundportal</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f7fa;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-top: 20px;
      margin-bottom: 20px;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    
    .header p {
      margin: 10px 0 0;
      font-size: 16px;
      opacity: 0.95;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .greeting {
      font-size: 20px;
      color: #333;
      margin-bottom: 20px;
      font-weight: 500;
    }
    
    .message {
      color: #555;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    
    .credentials-box {
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      border: 2px solid #667eea30;
      border-radius: 8px;
      padding: 25px;
      margin: 30px 0;
    }
    
    .credentials-title {
      font-size: 18px;
      color: #667eea;
      margin: 0 0 20px 0;
      font-weight: 600;
      text-align: center;
    }
    
    .credential-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 15px;
      padding: 12px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    .credential-label {
      font-weight: 600;
      color: #667eea;
      min-width: 100px;
      margin-right: 15px;
    }
    
    .credential-value {
      color: #333;
      word-break: break-all;
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    
    .role-badge {
      display: inline-block;
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin: 20px 0;
    }
    
    .features-section {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 25px;
      margin: 30px 0;
    }
    
    .features-title {
      font-size: 18px;
      color: #333;
      margin: 0 0 15px 0;
      font-weight: 600;
    }
    
    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
      color: #555;
    }
    
    .feature-icon {
      color: #48bb78;
      margin-right: 10px;
      font-weight: bold;
      font-size: 18px;
      line-height: 1.2;
    }
    
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    
    .login-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .login-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .security-note {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 30px 0;
      border-radius: 4px;
    }
    
    .security-note-title {
      font-weight: 600;
      color: #856404;
      margin: 0 0 8px 0;
    }
    
    .security-note-text {
      color: #856404;
      margin: 0;
      font-size: 14px;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    
    .footer-text {
      color: #6c757d;
      font-size: 14px;
      margin: 0 0 10px 0;
    }
    
    .footer-link {
      color: #667eea;
      text-decoration: none;
    }
    
    .company-info {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
    }
    
    .company-name {
      font-weight: 600;
      color: #333;
      margin: 0 0 5px 0;
    }
    
    .company-details {
      color: #6c757d;
      font-size: 13px;
      line-height: 1.5;
    }
    
    @media (prefers-color-scheme: dark) {
      body { background-color: #1a202c; }
      .email-container { background-color: #2d3748; }
      .content { background-color: #2d3748; }
      .greeting, .credential-value { color: #e2e8f0; }
      .message, .feature-item { color: #cbd5e0; }
      .features-section { background: #374151; }
      .features-title { color: #e2e8f0; }
      .footer { background: #1a202c; }
      .security-note { background: #44403c; border-left-color: #fbbf24; }
      .security-note-title, .security-note-text { color: #fef3c7; }
    }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        border-radius: 0;
        margin: 0;
      }
      
      .header, .content, .footer {
        padding: 20px;
      }
      
      .credential-item {
        flex-direction: column;
      }
      
      .credential-label {
        margin-bottom: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Välkommen till Begone Kundportal</h1>
      <p>Din personliga inloggning har aktiverats</p>
    </div>
    
    <div class="content">
      <div class="greeting">
        Hej ${recipientName}!
      </div>
      
      <div class="message">
        Vi är glada att välkomna dig till Begone Kundportal. Ditt konto har nu aktiverats och du kan logga in för att börja använda systemet.
      </div>
      
      <div class="role-badge">
        Din roll: ${roleDisplayName}
      </div>
      
      <div class="message">
        ${roleDescription}
      </div>
      
      <div class="credentials-box">
        <h3 class="credentials-title">🔐 Dina inloggningsuppgifter</h3>
        
        <div class="credential-item">
          <span class="credential-label">E-post:</span>
          <span class="credential-value">${recipientEmail}</span>
        </div>
        
        <div class="credential-item">
          <span class="credential-label">Lösenord:</span>
          <span class="credential-value">${tempPassword}</span>
        </div>
      </div>
      
      <div class="security-note">
        <p class="security-note-title">⚠️ Säkerhetsnotering</p>
        <p class="security-note-text">
          Vi rekommenderar starkt att du ändrar ditt lösenord vid första inloggningen. 
          Gå till din profil och välj "Byt lösenord" för att skapa ett personligt lösenord.
        </p>
      </div>
      
      <div class="features-section">
        <h3 class="features-title">Vad du kan göra i portalen:</h3>
        <ul class="feature-list">
          ${role === 'admin' ? `
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Hantera personal och användare</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Övervaka ekonomi och provision</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Generera rapporter och analyser</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Administrera kunder och avtal</span>
            </li>
          ` : role === 'koordinator' ? `
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Schemalägga tekniker och uppdrag</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Hantera ärenden och uppföljningar</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Koordinera mellan kunder och tekniker</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Övervaka arbetsflöden</span>
            </li>
          ` : `
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Se dina tilldelade ärenden</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Visa ditt arbetsschema</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Spåra din provision</span>
            </li>
            <li class="feature-item">
              <span class="feature-icon">✓</span>
              <span>Rapportera utfört arbete</span>
            </li>
          `}
        </ul>
      </div>
      
      <div class="button-container">
        <a href="${loginLink}" class="login-button">
          Logga in nu →
        </a>
      </div>
      
      <div class="message" style="text-align: center; color: #6c757d; font-size: 14px;">
        Om du har några frågor eller behöver hjälp, tveka inte att kontakta oss.
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        Detta e-postmeddelande skickades till ${recipientEmail} eftersom ett konto har skapats åt dig i Begone Kundportal.
      </p>
      
      <p class="footer-text">
        Behöver du hjälp? Kontakta oss på 
        <a href="mailto:support@begone.se" class="footer-link">support@begone.se</a>
      </p>
      
      <div class="company-info">
        <p class="company-name">Begone Skadedjur & Sanering AB</p>
        <p class="company-details">
          Organisationsnummer: 559351-6094<br>
          Telefon: 08-123 456 78<br>
          E-post: info@begone.se<br>
          Webb: www.begone.se
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

export default getStaffWelcomeEmailTemplate
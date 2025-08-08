// api/preview-email-templates.ts - Förhandsgranskning av e-postmallar
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { 
  welcomeEmailTemplate, 
  accessGrantedEmailTemplate, 
  reminderEmailTemplate,
  workReportEmailTemplate,
  customEmailTemplate
} from './email-templates'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { template = 'all' } = req.query

  // Testdata för mallarna
  const testData = {
    recipientName: 'Anna Andersson',
    companyName: 'Testföretaget AB',
    contractType: 'Företagsavtal Premium',
    startDate: '2025-01-15',
    loginLink: 'https://begone-kundportal.vercel.app/login',
    tempPassword: 'Test123!Secure',
    contactPerson: 'Erik Eriksson',
    technicianName: 'Johan Johansson',
    reportContent: `
      <p><strong>Utförd åtgärd:</strong> Rutinkontroll och behandling</p>
      <ul>
        <li>Inspekterade alla utrymmen enligt avtal</li>
        <li>Genomförde förebyggande behandling i kök och lagerutrymmen</li>
        <li>Bytte ut betesstationer vid lastbryggan</li>
        <li>Dokumenterade status med foton</li>
      </ul>
      <p><strong>Observationer:</strong> Inga tecken på skadedjur. Lokalen är i gott skick.</p>
      <p><strong>Rekommendationer:</strong> Fortsätt med nuvarande rutiner för renhållning.</p>
    `,
    customMessage: `
      <p>Detta är ett viktigt meddelande angående era tjänster hos Begone Skadedjur.</p>
      <p>Vi vill informera er om kommande förändringar i vårt serviceutbud som kan påverka ert avtal.</p>
      <p>Vänligen logga in på kundportalen för mer information.</p>
    `
  }

  // Generera HTML baserat på vald mall
  let html = ''
  let title = 'E-postmallar - Förhandsgranskning'

  switch (template) {
    case 'welcome':
      html = welcomeEmailTemplate(testData)
      title = 'Välkomstmail - Förhandsgranskning'
      break
    
    case 'access':
      html = accessGrantedEmailTemplate(testData)
      title = 'Ny åtkomst - Förhandsgranskning'
      break
    
    case 'reminder':
      html = reminderEmailTemplate(testData)
      title = 'Påminnelse - Förhandsgranskning'
      break
    
    case 'report':
      html = workReportEmailTemplate(testData)
      title = 'Arbetsrapport - Förhandsgranskning'
      break
    
    case 'custom':
      html = customEmailTemplate('Viktigt meddelande från Begone Skadedjur', testData)
      title = 'Anpassat meddelande - Förhandsgranskning'
      break
    
    case 'all':
      // Visa alla mallar med navigation
      html = `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Alla e-postmallar - Begone Skadedjur</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 40px 20px;
            }
            
            .container {
              max-width: 1400px;
              margin: 0 auto;
            }
            
            h1 {
              color: white;
              text-align: center;
              margin-bottom: 40px;
              font-size: 2.5rem;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .nav {
              background: white;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 40px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            }
            
            .nav h2 {
              color: #1a202c;
              margin-bottom: 20px;
              font-size: 1.5rem;
            }
            
            .nav-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
            }
            
            .nav-link {
              display: block;
              padding: 15px 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              text-align: center;
              font-weight: 600;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .nav-link:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
            
            .template-section {
              margin-bottom: 60px;
            }
            
            .template-header {
              background: white;
              padding: 20px 30px;
              border-radius: 12px 12px 0 0;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            
            .template-header h3 {
              color: #1a202c;
              font-size: 1.5rem;
              margin-bottom: 10px;
            }
            
            .template-header p {
              color: #718096;
              font-size: 0.95rem;
            }
            
            .template-frame {
              background: white;
              border-radius: 0 0 12px 12px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            }
            
            iframe {
              width: 100%;
              height: 800px;
              border: none;
              display: block;
            }
            
            .info-box {
              background: rgba(255, 255, 255, 0.95);
              border-left: 4px solid #20c58f;
              padding: 20px;
              margin-bottom: 30px;
              border-radius: 8px;
            }
            
            .info-box h4 {
              color: #1a202c;
              margin-bottom: 10px;
            }
            
            .info-box ul {
              color: #4a5568;
              margin-left: 20px;
              line-height: 1.8;
            }
            
            @media (max-width: 768px) {
              h1 {
                font-size: 1.8rem;
              }
              
              .nav-grid {
                grid-template-columns: 1fr;
              }
              
              iframe {
                height: 600px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>E-postmallar - Begone Skadedjur</h1>
            
            <div class="info-box">
              <h4>Testinformation</h4>
              <ul>
                <li>Företag: Testföretaget AB</li>
                <li>Kontaktperson: Anna Andersson</li>
                <li>E-post: anna.andersson@testforetaget.se</li>
                <li>Avtalstyp: Företagsavtal Premium</li>
                <li>Responsiv design - testa genom att ändra fönsterstorlek</li>
                <li>Dark mode stöd - aktiveras automatiskt baserat på systempreferenser</li>
              </ul>
            </div>
            
            <div class="nav">
              <h2>Snabbnavigation</h2>
              <div class="nav-grid">
                <a href="#welcome" class="nav-link">Välkomstmail</a>
                <a href="#access" class="nav-link">Ny åtkomst</a>
                <a href="#reminder" class="nav-link">Påminnelse</a>
                <a href="#report" class="nav-link">Arbetsrapport</a>
                <a href="#custom" class="nav-link">Anpassat meddelande</a>
              </div>
            </div>
            
            <div id="welcome" class="template-section">
              <div class="template-header">
                <h3>1. Välkomstmail för nya användare</h3>
                <p>Skickas när en helt ny användare skapas i systemet. Innehåller tillfälligt lösenord och instruktioner.</p>
              </div>
              <div class="template-frame">
                <iframe srcdoc="${welcomeEmailTemplate(testData).replace(/"/g, '&quot;')}"></iframe>
              </div>
            </div>
            
            <div id="access" class="template-section">
              <div class="template-header">
                <h3>2. Ny åtkomst för befintliga användare</h3>
                <p>Skickas när en befintlig användare får tillgång till en ny kund/företag.</p>
              </div>
              <div class="template-frame">
                <iframe srcdoc="${accessGrantedEmailTemplate(testData).replace(/"/g, '&quot;')}"></iframe>
              </div>
            </div>
            
            <div id="reminder" class="template-section">
              <div class="template-header">
                <h3>3. Påminnelse om befintlig åtkomst</h3>
                <p>Skickas när man försöker bjuda in någon som redan har tillgång.</p>
              </div>
              <div class="template-frame">
                <iframe srcdoc="${reminderEmailTemplate(testData).replace(/"/g, '&quot;')}"></iframe>
              </div>
            </div>
            
            <div id="report" class="template-section">
              <div class="template-header">
                <h3>4. Arbetsrapport</h3>
                <p>Skickas efter utfört arbete med rapport från tekniker.</p>
              </div>
              <div class="template-frame">
                <iframe srcdoc="${workReportEmailTemplate(testData).replace(/"/g, '&quot;')}"></iframe>
              </div>
            </div>
            
            <div id="custom" class="template-section">
              <div class="template-header">
                <h3>5. Anpassat meddelande</h3>
                <p>Flexibel mall för olika typer av kommunikation.</p>
              </div>
              <div class="template-frame">
                <iframe srcdoc="${customEmailTemplate('Viktigt meddelande från Begone Skadedjur', testData).replace(/"/g, '&quot;')}"></iframe>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
      break
    
    default:
      return res.status(400).json({ 
        error: 'Ogiltig mall',
        available: ['welcome', 'access', 'reminder', 'report', 'custom', 'all']
      })
  }

  // Returnera HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(html)
}
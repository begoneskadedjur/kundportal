// api/send-work-report.ts - API för att skicka saneringsrapporter via email
import type { VercelRequest, VercelResponse } from '@vercel/node'
const nodemailer = require('nodemailer')
import { generateWorkReportPDF, type TaskDetails, type CustomerInfo } from '../src/lib/pdf-generator'

// Environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY!

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
        console.warn('Failed to parse address JSON string:', e)
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
    
    if (addressValue.location && !addressValue.formatted_address) {
      return 'Adress ej angiven'
    }
    
    try {
      const objStr = JSON.stringify(addressValue)
      if (objStr.includes('formatted_address')) {
        const match = objStr.match(/"formatted_address":"([^"]+)"/)
        if (match && match[1]) {
          return match[1].replace(/, Sverige$/, '').trim()
        }
      }
    } catch (e) {
      console.warn('Failed to extract address from object:', e)
    }
  }
  
  const fallback = addressValue?.toString()?.trim() || 'Adress ej angiven'
  return typeof fallback === 'string' ? fallback.replace(/, Sverige$/, '') : fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== SEND WORK REPORT API START ===')
    
    const { 
      taskDetails, 
      customerInfo, 
      recipientType, 
      recipientEmail, 
      recipientName 
    }: {
      taskDetails: TaskDetails;
      customerInfo: CustomerInfo;
      recipientType: 'technician' | 'contact';
      recipientEmail: string;
      recipientName?: string;
    } = req.body

    console.log('Report request:', { 
      taskId: taskDetails.task_id, 
      recipientType, 
      recipientEmail, 
      recipientName 
    })

    // Validera inkommande data
    if (!taskDetails || !customerInfo || !recipientType || !recipientEmail) {
      return res.status(400).json({ 
        error: 'Alla fält är obligatoriska: taskDetails, customerInfo, recipientType, recipientEmail' 
      })
    }

    // Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // Generera PDF-rapport med Puppeteer
    console.log('Generating PDF report with shared module...')
    const pdfBuffer = await generateWorkReportPDF(taskDetails, customerInfo)

    // Skicka email med PDF bifogad
    console.log('Sending email with PDF attachment...')
    await sendReportEmail({
      recipientEmail,
      recipientName,
      recipientType,
      taskDetails,
      customerInfo,
      pdfBuffer
    })

    console.log('Report email sent successfully')
    return res.status(200).json({
      success: true,
      message: `Saneringsrapport skickad till ${recipientName || recipientEmail}`
    })

  } catch (error: any) {
    console.error('=== SEND WORK REPORT API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skickande av saneringsrapport'
    })
  }
}

// Skicka email med PDF-bilaga
async function sendReportEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  recipientType: 'technician' | 'contact';
  taskDetails: TaskDetails;
  customerInfo: CustomerInfo;
  pdfBuffer: Buffer;
}) {
  const { recipientEmail, recipientName, recipientType, taskDetails, customerInfo, pdfBuffer } = params

  // Skapa Nodemailer transporter med Resend SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY
    }
  })

  const recipientDisplayName = recipientName || recipientEmail
  const isForTechnician = recipientType === 'technician'
  
  // Olika email-innehåll beroende på mottagare
  const emailHtml = isForTechnician 
    ? getTechnicianEmailTemplate(recipientDisplayName, taskDetails, customerInfo)
    : getContactEmailTemplate(recipientDisplayName, taskDetails, customerInfo)

  const subject = isForTechnician 
    ? `📋 Saneringsrapport - ${taskDetails.task_info.name} (${taskDetails.task_id})`
    : `📋 Saneringsrapport för ${customerInfo.company_name} (${taskDetails.task_id})`

  // Säker filnamnsformatering
  const customerName = customerInfo.company_name
    .replace(/[^\w\s-åäöÅÄÖ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 25)
  
  const reportDate = new Date().toISOString().split('T')[0]
  const fileName = `Saneringsrapport_${taskDetails.task_id}_${customerName}_${reportDate}.pdf`

  const mailOptions = {
    from: 'BeGone Saneringsrapporter <noreply@begone.se>',
    to: recipientEmail,
    subject: subject,
    html: emailHtml,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  }

  await transporter.sendMail(mailOptions)
  console.log(`Report email sent to ${recipientType}:`, recipientEmail)
}

function getTechnicianEmailTemplate(
  technicianName: string, 
  taskDetails: TaskDetails, 
  customerInfo: CustomerInfo
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #0A1328 0%, #1E293B 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #f8fafc;
            border-left: 4px solid #20C58F;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: #20C58F;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Saneringsrapport - Teknisk Dokumentation</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">BeGone Skadedjur & Sanering</p>
        </div>
        <div class="content">
          <p>Hej ${technicianName},</p>
          
          <p>Här kommer saneringsrapporten för ärendet du har arbetat med.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Ärendeinformation</h3>
            <p><strong>Ärende:</strong> ${taskDetails.task_info.name}</p>
            <p><strong>Ärende ID:</strong> ${taskDetails.task_id}</p>
            <p><strong>Kund:</strong> ${customerInfo.company_name}</p>
            <p><strong>Kontaktperson:</strong> ${customerInfo.contact_person}</p>
            <p><strong>Status:</strong> ${taskDetails.task_info.status}</p>
          </div>
          
          <p>Rapporten innehåller fullständig dokumentation av utfört arbete, inklusive:</p>
          <ul>
            <li>Detaljerad arbetsbeskrivning</li>
            <li>Använda metoder och material</li>
            <li>Eventuella observationer</li>
            <li>Rekommendationer för uppföljning</li>
          </ul>
          
          <p>PDF-rapporten är bifogad till detta email. Vänligen spara den för din dokumentation.</p>
          
          <p><strong>OBS!</strong> Om du upptäcker felaktigheter eller behöver göra tillägg, vänligen kontakta din koordinator eller uppdatera ärendet i systemet.</p>
          
          <div class="footer">
            <p><strong>BeGone Skadedjur & Sanering AB</strong></p>
            <p>Telefon: 010 280 44 10 | Email: teknik@begone.se</p>
            <p>Org.nr: 559378-9208</p>
            <p style="font-size: 12px; margin-top: 10px;">Detta är ett automatiskt genererat email från BeGone Kundportal</p>
          </div>
        </div>
      </body>
    </html>
  `
}

function getContactEmailTemplate(
  contactName: string, 
  taskDetails: TaskDetails, 
  customerInfo: CustomerInfo
): string {
  // Hämta adress från custom fields
  const addressField = taskDetails.custom_fields.find(f => 
    f.name.toLowerCase() === 'adress' && f.has_value
  )
  const addressText = addressField ? formatAddress(addressField.value) : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #0A1328 0%, #1E293B 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #f8fafc;
            border-left: 4px solid #20C58F;
            padding: 15px;
            margin: 20px 0;
          }
          .success-box {
            background: #f0fdf4;
            border: 1px solid #86efac;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: #20C58F;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Saneringsrapport</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">BeGone Skadedjur & Sanering</p>
        </div>
        <div class="content">
          <p>Hej ${contactName},</p>
          
          <p>Tack för att ni valde BeGone Skadedjur & Sanering för ert saneringsbehov. Härmed översänder vi den kompletta saneringsrapporten för det utförda arbetet.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Sammanfattning av utfört arbete</h3>
            <p><strong>Företag:</strong> ${customerInfo.company_name}</p>
            ${addressText ? `<p><strong>Arbetsplats:</strong> ${addressText}</p>` : ''}
            <p><strong>Ärende ID:</strong> ${taskDetails.task_id}</p>
            <p><strong>Status:</strong> ${taskDetails.task_info.status}</p>
          </div>
          
          <div class="success-box">
            <p style="margin: 0;"><strong>✅ Arbetet har dokumenterats</strong></p>
            <p style="margin: 10px 0 0 0;">Den bifogade PDF-rapporten innehåller fullständig dokumentation av det utförda saneringsarbetet.</p>
          </div>
          
          <p><strong>Rapporten innehåller:</strong></p>
          <ul>
            <li>Detaljerad beskrivning av utfört arbete</li>
            <li>Använda saneringsmetoder</li>
            <li>Identifierade skadedjur och omfattning</li>
            <li>Rekommendationer för förebyggande åtgärder</li>
            <li>Eventuella uppföljningsbehov</li>
          </ul>
          
          <p>Vi rekommenderar att ni sparar denna rapport för er dokumentation. Den kan vara värdefull vid framtida inspektioner eller som underlag för försäkringsärenden.</p>
          
          <p><strong>Har ni frågor?</strong><br>
          Tveka inte att kontakta oss om ni har frågor om rapporten eller behöver ytterligare information om det utförda arbetet.</p>
          
          <div class="footer">
            <p><strong>BeGone Skadedjur & Sanering AB</strong></p>
            <p>Telefon: 010 280 44 10 | Email: info@begone.se</p>
            <p>Webb: www.begone.se | Org.nr: 559378-9208</p>
            <p style="margin-top: 20px;">
              <em>Vi säkerställer en trygg och skadedjursfri miljö för er verksamhet</em>
            </p>
            <p style="font-size: 12px; margin-top: 10px;">Detta email har genererats automatiskt. Vänligen svara inte direkt på detta email.</p>
          </div>
        </div>
      </body>
    </html>
  `
}
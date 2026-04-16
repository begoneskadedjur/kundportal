// api/send-work-report.ts - API för att skicka saneringsrapporter via email
import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import { generateWorkReportPDF, type TaskDetails, type CustomerInfo } from '../src/lib/pdf-generator'

// Environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY!

// Hjälpfunktion för att formatera adresser
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
        console.warn('Failed to parse address JSON string:', e)
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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    console.log('=== SEND WORK REPORT API START ===')

    const {
      taskDetails,
      customerInfo,
      caseData,
      customerData,
      pdf: pdfBase64,
      filename: pdfFilename,
      recipientType,
      recipientEmail,
      recipientName
    } = req.body

    if (!recipientType || !recipientEmail) {
      return res.status(400).json({ error: 'recipientType och recipientEmail är obligatoriska' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // Stöd för två flöden:
    // 1. Nytt flöde (useModernWorkReportGeneration): caseData + customerData + pdf (base64)
    // 2. Gammalt flöde (useWorkReportGeneration): taskDetails + customerInfo (genererar PDF internt)
    let pdfBuffer: Buffer
    let caseNumber: string
    let contactPersonName: string
    let addressText: string
    let status: string
    let techName: string | undefined

    if (caseData && pdfBase64) {
      // Nytt flöde — PDF redan genererad, extrahera metadata från caseData
      pdfBuffer = Buffer.from(pdfBase64, 'base64')
      caseNumber = caseData.case_number || caseData.id?.substring(0, 8) || 'Okänt'
      contactPersonName = caseData.contact_person || customerData?.contact_person || recipientName || ''
      addressText = typeof caseData.address === 'string'
        ? caseData.address.replace(/, Sverige$/, '').trim()
        : (caseData.address?.formatted_address || caseData.address?.address || '').replace(/, Sverige$/, '').trim()
      status = caseData.status || 'Okänd'
      techName = caseData.primary_technician_name || caseData.assignee_name
    } else if (taskDetails && customerInfo) {
      // Gammalt flöde — generera PDF internt
      pdfBuffer = await generateWorkReportPDF(taskDetails, customerInfo)
      caseNumber = taskDetails.task_info?.name || taskDetails.task_id || 'Okänt'
      contactPersonName = customerInfo.contact_person || recipientName || ''
      const addrField = taskDetails.custom_fields?.find((f: any) => f.name?.toLowerCase() === 'adress' && f.has_value)
      addressText = addrField ? formatAddress(addrField.value) : ''
      status = taskDetails.task_info?.status || 'Okänd'
      techName = taskDetails.assignees?.[0]?.name
    } else {
      return res.status(400).json({ error: 'Antingen caseData+pdf eller taskDetails+customerInfo krävs' })
    }

    // Kundnamn: kontaktperson för privatperson, annars customerData.company_name
    const customerDisplayName = customerData?.company_name || customerInfo?.company_name || contactPersonName

    const reportDate = new Date().toISOString().split('T')[0]
    const safeCustomerName = customerDisplayName.replace(/[^\w\s-åäöÅÄÖ]/g, '').replace(/\s+/g, '_').substring(0, 25)
    const fileName = pdfFilename || `Saneringsrapport_${caseNumber}_${safeCustomerName}_${reportDate}.pdf`

    const subject = `Saneringsrapport avseende ärende: ${caseNumber} (${reportDate})`

    const emailHtml = recipientType === 'technician'
      ? getTechnicianEmailTemplate(recipientName || techName || 'Tekniker', caseNumber, contactPersonName, customerDisplayName, addressText, status)
      : getContactEmailTemplate(contactPersonName || recipientName || 'Kund', caseNumber, customerDisplayName, addressText, status)

    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: RESEND_API_KEY }
    })

    await transporter.sendMail({
      from: 'BeGone Saneringsrapporter <noreply@begone.se>',
      to: recipientEmail,
      subject,
      html: emailHtml,
      attachments: [{ filename: fileName, content: pdfBuffer, contentType: 'application/pdf' }]
    })

    console.log('Report email sent to:', recipientEmail)
    return res.status(200).json({ success: true, message: `Saneringsrapport skickad till ${recipientName || recipientEmail}` })

  } catch (error: any) {
    console.error('=== SEND WORK REPORT ERROR ===', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod vid skickande av saneringsrapport' })
  }
}

function getTechnicianEmailTemplate(
  technicianName: string,
  caseNumber: string,
  contactPerson: string,
  customerName: string,
  address: string,
  status: string
): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Saneringsrapport</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;text-align:left;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#20c58f;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                      <span style="color:white;font-size:18px;font-weight:800;line-height:36px;">B</span>
                    </td>
                    <td style="padding-left:12px;color:white;font-size:20px;font-weight:700;">BeGone</td>
                  </tr>
                </table>
              </td>
              <td style="text-align:right;color:#94a3b8;font-size:12px;vertical-align:middle;">
                SANERINGSRAPPORT<br>
                <span style="color:#20c58f;font-weight:600;">${caseNumber}</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:white;padding:40px;">
          <p style="margin:0 0 8px 0;font-size:16px;color:#1e293b;">Hej ${technicianName},</p>
          <p style="margin:0 0 28px 0;color:#64748b;font-size:14px;line-height:1.6;">
            Här är saneringsrapporten för ärendet du har arbetat med. PDF-rapporten är bifogad.
          </p>

          <!-- Info box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 16px 0;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">Ärendeinformation</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;width:130px;color:#64748b;font-size:13px;vertical-align:top;">Ärende nr</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${caseNumber}</td>
                </tr>
                ${customerName ? `<tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Kund</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${customerName}</td>
                </tr>` : ''}
                ${contactPerson ? `<tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Kontaktperson</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${contactPerson}</td>
                </tr>` : ''}
                ${address ? `<tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Arbetsplats</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${address}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Status</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${status}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 8px 0;color:#64748b;font-size:13px;line-height:1.6;">
            Om du upptäcker felaktigheter eller behöver göra tillägg, vänligen kontakta din koordinator eller uppdatera ärendet i systemet.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;">BeGone Skadedjur & Sanering AB</p>
          <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">Telefon: 010 280 44 10 | Email: teknik@begone.se</p>
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Detta är ett automatiskt genererat email från BeGone Kundportal.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function getContactEmailTemplate(
  contactName: string,
  caseNumber: string,
  customerName: string,
  address: string,
  status: string
): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeGone Saneringsrapport</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;text-align:left;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#20c58f;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                      <span style="color:white;font-size:18px;font-weight:800;line-height:36px;">B</span>
                    </td>
                    <td style="padding-left:12px;color:white;font-size:20px;font-weight:700;">BeGone</td>
                  </tr>
                </table>
              </td>
              <td style="text-align:right;color:#94a3b8;font-size:12px;vertical-align:middle;">
                SANERINGSRAPPORT<br>
                <span style="color:#20c58f;font-weight:600;">${caseNumber}</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:white;padding:40px;">
          <p style="margin:0 0 8px 0;font-size:16px;color:#1e293b;">Hej ${contactName},</p>
          <p style="margin:0 0 28px 0;color:#64748b;font-size:14px;line-height:1.6;">
            Tack för att du valde BeGone Skadedjur & Sanering. Vi bifogar här den kompletta saneringsrapporten för det utförda arbetet.
          </p>

          <!-- Info box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 16px 0;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">Sammanfattning av utfört arbete</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;width:130px;color:#64748b;font-size:13px;vertical-align:top;">Kund</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${contactName}</td>
                </tr>
                ${address ? `<tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Arbetsplats</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${address}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Ärende nr</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${caseNumber}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Status</td>
                  <td style="padding:6px 0;color:#1e293b;font-size:13px;">${status}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Success box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#166534;">Arbetet har dokumenterats</p>
              <p style="margin:0;font-size:13px;color:#15803d;line-height:1.5;">Den bifogade PDF-rapporten innehåller fullständig dokumentation av det utförda arbetet.</p>
            </td></tr>
          </table>

          <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#1e293b;">Rapporten innehåller:</p>
          <ul style="margin:0 0 24px 0;padding-left:20px;color:#64748b;font-size:13px;line-height:2;">
            <li>Detaljerad beskrivning av utfört arbete</li>
            <li>Använda saneringsmetoder</li>
            <li>Rekommendationer för förebyggande åtgärder</li>
            <li>Eventuella uppföljningsbehov</li>
          </ul>

          <p style="margin:0 0 24px 0;color:#64748b;font-size:13px;line-height:1.6;">
            Vi rekommenderar att du sparar rapporten för din dokumentation. Den kan vara värdefull vid framtida inspektioner eller som underlag vid försäkringsärenden.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:3px solid #20c58f;border-radius:0 6px 6px 0;margin-bottom:8px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 2px 0;font-size:13px;font-weight:600;color:#1e293b;">Har du frågor?</p>
              <p style="margin:0;font-size:13px;color:#64748b;">Kontakta oss gärna på <a href="mailto:info@begone.se" style="color:#20c58f;text-decoration:none;">info@begone.se</a> eller ring 010 280 44 10.</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;">BeGone Skadedjur & Sanering AB</p>
          <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">Telefon: 010 280 44 10 | Email: info@begone.se | www.begone.se</p>
          <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;">Org.nr: 559378-9208</p>
          <p style="margin:0;font-size:11px;color:#cbd5e1;font-style:italic;">Vi säkerställer en trygg och skadedjursfri miljö</p>
          <p style="margin:8px 0 0 0;font-size:11px;color:#cbd5e1;">Detta email har genererats automatiskt. Vänligen svara inte direkt på detta email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

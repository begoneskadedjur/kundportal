// api/send-email-campaign.ts - API för att skicka e-postkampanjer till kunder
import { VercelRequest, VercelResponse } from '@vercel/node'
const nodemailer = require('nodemailer')
import { customEmailTemplate } from './email-templates'

interface CampaignRecipient {
  id: string
  email: string
  name: string
  companyName: string
}

interface CampaignRequest {
  recipients: CampaignRecipient[]
  subject: string
  message: string
  loginLink: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { recipients, subject, message, loginLink } = req.body as CampaignRequest

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'Inga mottagare angivna' })
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Ämne och meddelande krävs' })
    }

    // Validera e-postadresser
    const validEmails = recipients.filter(r => 
      r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)
    )

    if (validEmails.length === 0) {
      return res.status(400).json({ error: 'Inga giltiga e-postadresser hittades' })
    }

    // Skapa e-posttransporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    // Skicka e-post till varje mottagare individuellt
    const results = []
    
    for (const recipient of validEmails) {
      try {
        // Formatera meddelandet med HTML line breaks
        const formattedMessage = message.replace(/\n/g, '<br>')
        
        // Generera personaliserad e-post
        const htmlContent = customEmailTemplate(subject, {
          recipientName: recipient.name,
          companyName: recipient.companyName,
          customMessage: formattedMessage,
          loginLink: loginLink
        })

        const mailOptions = {
          from: {
            name: 'Begone Skadedjur',
            address: process.env.SMTP_FROM || 'noreply@begone.se'
          },
          to: recipient.email,
          subject: subject,
          html: htmlContent,
          headers: {
            'List-Unsubscribe': `<mailto:unsubscribe@begone.se?subject=Unsubscribe>`,
            'X-Campaign': 'Customer-Campaign'
          }
        }

        await transporter.sendMail(mailOptions)
        
        results.push({
          recipient: recipient.email,
          status: 'sent',
          error: null
        })

        // Kort paus mellan e-postmeddelanden för att undvika spam-flaggor
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (emailError) {
        console.error(`Error sending to ${recipient.email}:`, emailError)
        results.push({
          recipient: recipient.email,
          status: 'failed',
          error: (emailError as Error).message
        })
      }
    }

    const successCount = results.filter(r => r.status === 'sent').length
    const failedCount = results.filter(r => r.status === 'failed').length

    return res.status(200).json({
      message: `E-postkampanj slutförd. ${successCount} skickade, ${failedCount} misslyckades.`,
      results: {
        sent: successCount,
        failed: failedCount,
        details: results
      }
    })

  } catch (error) {
    console.error('Email campaign error:', error)
    return res.status(500).json({ 
      error: 'Ett fel uppstod vid skickande av e-postkampanj',
      details: (error as Error).message
    })
  }
}
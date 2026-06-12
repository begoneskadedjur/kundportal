// api/revoke-invitation.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== REVOKE INVITATION API START ===')
    
    const { customerId, email, reason, sendNotification = false, adminUserId } = req.body
    console.log('Revoke invitation request:', { customerId, email, reason, sendNotification })

    // 1. Validera inkommande data
    if (!customerId || !email) {
      return res.status(400).json({ error: 'customerId och email är obligatoriska' })
    }

    // 2. Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 3. Hämta inbjudan och kundinfo
    const { data: invitation, error: findError } = await supabase
      .from('user_invitations')
      .select(`
        *,
        customers (
          company_name,
          contact_person
        )
      `)
      .eq('customer_id', customerId)
      .eq('email', email)
      .single()

    if (findError || !invitation) {
      console.error('Invitation not found:', findError)
      return res.status(404).json({ error: 'Inbjudan hittades inte' })
    }

    // 4. Kontrollera om inbjudan redan är accepterad
    if (invitation.accepted_at) {
      return res.status(400).json({ 
        error: 'Kan inte återkalla accepterad inbjudan',
        details: 'Användaren har redan aktiverat sitt konto'
      })
    }

    // 5. Ta bort inbjudan från databasen
    const { error: deleteError } = await supabase
      .from('user_invitations')
      .delete()
      .eq('id', invitation.id)

    if (deleteError) {
      console.error('Delete invitation error:', deleteError)
      return res.status(500).json({ error: 'Kunde inte ta bort inbjudan' })
    }

    console.log('Invitation revoked successfully:', invitation.id)

    // 6. Skicka notifiering till kunden om begärt
    if (sendNotification && RESEND_API_KEY) {
      try {
        await sendRevocationEmail({
          email,
          contactPerson: invitation.customers?.contact_person || 'Kund',
          companyName: invitation.customers?.company_name || 'Företag',
          reason: reason || 'admin_action'
        })
        console.log('Revocation notification sent')
      } catch (emailError) {
        console.error('Email notification failed (non-critical):', emailError)
        // Fortsätt ändå - huvudfunktionen fungerade
      }
    }

    // 7. Valfritt: Inaktivera användarens profil om de inte har andra aktiva kunder
    if (reason === 'customer_terminated' || reason === 'security_concern') {
      try {
        // Hitta användare med denna email
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const user = users.find((u: any) => u.email === email)
        
        if (user) {
          // Kontrollera om användaren har andra aktiva kundrelationer
          const { data: otherProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .neq('customer_id', customerId)
            .eq('is_active', true)

          if (!otherProfiles || otherProfiles.length === 0) {
            // Användaren har inga andra aktiva kunder - inaktivera profilen
            await supabase
              .from('profiles')
              .update({ is_active: false })
              .eq('user_id', user.id)
              .eq('customer_id', customerId)
            
            console.log('User profile deactivated due to revocation')
          }
        }
      } catch (profileError) {
        console.error('Profile cleanup error (non-critical):', profileError)
        // Fortsätt ändå
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Inbjudan återkallad',
      reason: reason || 'not_specified',
      notificationSent: sendNotification,
      revokedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('=== REVOKE INVITATION API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid återkallning av inbjudan'
    })
  }
}

// Hjälpfunktion för att skicka återkallnings-email
async function sendRevocationEmail({ email, contactPerson, companyName, reason }: {
  email: string
  contactPerson: string
  companyName: string
  reason: string
}) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY
    }
  })

  const reasonTexts: { [key: string]: { title: string, message: string, color: string } } = {
    'admin_action': {
      title: 'Administrativ åtgärd',
      message: 'Er inbjudan har återkallats av administrativ anledning.',
      color: '#3b82f6'
    },
    'customer_request': {
      title: 'På din begäran',
      message: 'Er inbjudan har återkallats på er begäran.',
      color: '#22c55e'
    },
    'customer_terminated': {
      title: 'Avtal avslutat',
      message: 'Er tillgång till kundportalen har återkallats eftersom avtalet har avslutats.',
      color: '#ef4444'
    },
    'security_concern': {
      title: 'Säkerhetsskäl',
      message: 'Er inbjudan har återkallats av säkerhetsskäl. Kontakta oss för mer information.',
      color: '#f59e0b'
    },
    'duplicate_invitation': {
      title: 'Dubblettinbjudan',
      message: 'En nyare inbjudan har skickats. Denna gamla inbjudan är inte längre giltig.',
      color: '#8b5cf6'
    }
  }

  const reasonInfo = reasonTexts[reason] || reasonTexts['admin_action']

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inbjudan återkallad - Begone Kundportal</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: ${reasonInfo.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Inbjudan återkallad</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Begone Kundportal</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: ${reasonInfo.color}; margin-top: 0;">Hej ${contactPerson}!</h2>
          
          <p>Vi vill informera er om att er inbjudan till Begone Kundportal för <strong>${companyName}</strong> har återkallats.</p>

          <div style="background-color: #fff; border: 1px solid ${reasonInfo.color}; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: ${reasonInfo.color}; margin: 0 0 10px 0;">📋 Anledning</h3>
            <p style="margin: 0;"><strong>${reasonInfo.title}:</strong> ${reasonInfo.message}</p>
          </div>

          ${reason !== 'customer_request' ? `
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #475569;"><strong>Har ni frågor?</strong> Kontakta oss gärna så hjälper vi er.</p>
          </div>
          ` : ''}

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
            <p>📧 <a href="mailto:support@begone.se" style="color: ${reasonInfo.color};">support@begone.se</a> | 📞 <a href="tel:0101292200" style="color: ${reasonInfo.color};">010-129 22 00</a></p>
            <p style="margin-top: 20px;">
              Med vänliga hälsningar,<br>
              <strong>Begone Skadedjur</strong>
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const mailOptions = {
    from: 'Begone Kundportal <noreply@begone.se>',
    to: email,
    subject: `⚠️ Inbjudan återkallad - ${companyName} | Begone Kundportal`,
    html: emailHtml
  }

  await transporter.sendMail(mailOptions)
  console.log('Revocation email sent to:', email)
}
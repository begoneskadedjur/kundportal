// api/reset-password.ts - Lösenordsåterställning med Resend
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== RESET PASSWORD API START ===')
    
    const { email } = req.body
    console.log('Password reset request for:', email)

    // 1. Validera e-post
    if (!email) {
      return res.status(400).json({ error: 'E-postadress krävs' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 2. Kontrollera om användaren finns
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      // Av säkerhetsskäl, returnera success även om användaren inte finns
      console.log('User not found, returning success for security')
      return res.status(200).json({
        success: true,
        message: 'Om en användare med denna e-postadress finns kommer ett återställningsmail skickas.'
      })
    }

    console.log('User found:', user.id)

    // 3. Hämta användarens namn och organisation
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, organization_id')
      .eq('id', user.id)
      .single()

    const userName = profile?.display_name || user.user_metadata?.name || 'Användare'
    
    // Hämta organisationsnamn om användaren tillhör en organisation
    let organizationName = null
    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from('customers')
        .select('company_name')
        .eq('organization_id', profile.organization_id)
        .eq('site_type', 'huvudkontor')
        .single()
      
      organizationName = org?.company_name
    }

    // 4. Generera återställningstoken
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    
    // Spara token i databas (använd auth.users metadata)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1 timme utgång

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        reset_token: tokenHash,
        reset_token_expires: expiresAt.toISOString()
      }
    })

    if (updateError) {
      console.error('Failed to save reset token:', updateError)
      throw new Error('Kunde inte skapa återställningstoken')
    }

    // 5. Skapa återställningslänk
    const resetLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

    // 6. Skicka e-post via Resend
    const emailHtml = getPasswordResetEmailTemplate({
      userName,
      organizationName,
      resetLink,
      email
    })

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Begone Kundportal <noreply@begone.se>',
          to: [email],
          subject: 'Återställ ditt lösenord - Begone Kundportal',
          html: emailHtml
        }),
      })

      if (!emailResponse.ok) {
        const error = await emailResponse.text()
        console.error('Failed to send email via Resend:', error)
        throw new Error('Failed to send email')
      }

      const emailData = await emailResponse.json()
      console.log('Password reset email sent via Resend:', emailData)
    } catch (emailError: any) {
      console.error('Failed to send password reset email:', emailError)
      throw new Error('Kunde inte skicka återställningsmail')
    }

    console.log('Password reset email sent successfully')
    return res.status(200).json({
      success: true,
      message: 'Återställningsmail skickat'
    })

  } catch (error: any) {
    console.error('=== RESET PASSWORD API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid lösenordsåterställning'
    })
  }
}

function getPasswordResetEmailTemplate({
  userName,
  organizationName,
  resetLink,
  email
}: {
  userName: string
  organizationName: string | null
  resetLink: string
  email: string
}) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Återställ ditt lösenord - Begone Kundportal</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
        
        <!-- Header med gradient -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 2rem; text-align: center;">
            <div style="background-color: rgba(255, 255, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
            </div>
            <h1 style="margin: 0; color: white; font-size: 1.75rem; font-weight: bold;">
                Återställ ditt lösenord
            </h1>
            <p style="margin: 0.5rem 0 0; color: rgba(255, 255, 255, 0.9); font-size: 1rem;">
                Begone Kundportal
            </p>
        </div>

        <!-- Innehåll -->
        <div style="padding: 2rem;">
            <p style="font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem; color: #e2e8f0;">
                Hej ${userName},
            </p>

            <p style="line-height: 1.6; margin-bottom: 1.5rem; color: #cbd5e1;">
                Vi har mottagit en begäran om att återställa lösenordet för ditt konto${organizationName ? ` hos <strong style="color: #a855f7;">${organizationName}</strong>` : ''}.
            </p>

            <p style="line-height: 1.6; margin-bottom: 1.5rem; color: #cbd5e1;">
                Klicka på knappen nedan för att skapa ett nytt lösenord. Länken är giltig i <strong style="color: #fbbf24;">1 timme</strong> av säkerhetsskäl.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 2rem 0;">
                <a href="${resetLink}" 
                   style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); 
                          color: white; 
                          text-decoration: none; 
                          padding: 1rem 2rem; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          display: inline-block; 
                          font-size: 1.1rem;
                          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);">
                    🔐 Återställ lösenord
                </a>
            </div>

            <!-- Alternativ länk -->
            <div style="background-color: #334155; border-radius: 8px; padding: 1rem; margin: 1.5rem 0;">
                <p style="color: #94a3b8; font-size: 0.9rem; margin: 0 0 0.5rem;">
                    Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:
                </p>
                <p style="color: #60a5fa; font-size: 0.85rem; margin: 0; word-break: break-all; font-family: monospace;">
                    ${resetLink}
                </p>
            </div>

            <!-- Säkerhetsvarning -->
            <div style="background-color: #7f1d1d; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
                <h3 style="color: #fca5a5; margin: 0 0 0.5rem; font-size: 1rem; font-weight: bold;">
                    ⚠️ Säkerhetsnotis
                </h3>
                <p style="color: #fecaca; font-size: 0.9rem; margin: 0; line-height: 1.5;">
                    <strong>Har du inte begärt denna återställning?</strong><br>
                    Du kan ignorera detta e-postmeddelande. Ditt lösenord kommer inte att ändras om du inte klickar på länken ovan.
                </p>
            </div>

            <!-- Kontoinformation -->
            <div style="background-color: #334155; border-radius: 8px; padding: 1rem; margin: 1.5rem 0;">
                <p style="color: #94a3b8; font-size: 0.9rem; margin: 0;">
                    <strong>Ditt konto:</strong> ${email}
                </p>
            </div>

            <div style="border-top: 1px solid #475569; padding-top: 1.5rem; margin-top: 2rem; text-align: center; color: #94a3b8; font-size: 0.9rem;">
                <p>Behöver du hjälp? Kontakta oss på <a href="mailto:support@begone.se" style="color: #a855f7;">support@begone.se</a></p>
                <p style="margin-top: 1rem;">
                    Med vänliga hälsningar,<br>
                    <strong style="color: #e2e8f0;">Begone Skadedjur & Sanering AB</strong>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
  `
}
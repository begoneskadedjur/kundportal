// api/reset-password.ts - Lösenordsåterställning via Resend med snyggt HTML-mail
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

  console.log('=== RESET PASSWORD API START ===')
  
  // Använd Service Key för admin-operationer
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
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

    console.log('Finding user...')
    
    // 2. Hitta användaren
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      throw new Error('Kunde inte söka efter användare')
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (!user) {
      // Av säkerhetsskäl, returnera success även om användaren inte finns
      console.log('User not found, but returning success for security')
      return res.status(200).json({
        success: true,
        message: 'Om e-postadressen finns kommer du att få ett återställningsmail'
      })
    }

    console.log('User found:', user.id)

    // 3. Kontrollera rate limiting (max 1 token per 5 minuter)
    const existingMetadata = user.user_metadata || {}
    const lastTokenTime = existingMetadata.reset_token_created_at
    
    if (lastTokenTime) {
      const timeSinceLastToken = Date.now() - new Date(lastTokenTime).getTime()
      const fiveMinutes = 5 * 60 * 1000
      
      if (timeSinceLastToken < fiveMinutes) {
        const remainingTime = Math.ceil((fiveMinutes - timeSinceLastToken) / 1000 / 60)
        return res.status(429).json({
          error: `Du kan begära en ny återställning om ${remainingTime} minut${remainingTime !== 1 ? 'er' : ''}`
        })
      }
    }

    // 4. Generera säker token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 timme

    console.log('Generated token, updating user metadata...')

    // 5. Spara token i user metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...existingMetadata,
        reset_token_hash: tokenHash,
        reset_token_created_at: new Date().toISOString(),
        reset_token_expires_at: expiresAt.toISOString()
      }
    })

    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      throw new Error('Kunde inte spara återställningstoken')
    }

    // 6. Hämta användarnamn och organisation
    console.log('Fetching user profile...')
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, customer_id')
      .eq('user_id', user.id)
      .single()

    const firstName = (profile?.display_name || '').split(' ')[0] || 'Hej'

    let organizationName: string | null = null
    if (profile?.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('company_name')
        .eq('id', profile.customer_id)
        .maybeSingle()
      organizationName = customer?.company_name || null
    }

    console.log('User details:', { firstName, organizationName })

    // 7. Skapa återställningslänk
    const resetLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

    // 8. Skapa snyggt HTML-mail
    const emailHtml = getPasswordResetEmailTemplate({
      firstName,
      organizationName,
      resetLink,
      email
    })

    console.log('Sending email via Resend...')

    // 9. Skicka e-post via Resend
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
      throw new Error('Kunde inte skicka e-post')
    }

    const emailData = await emailResponse.json()
    console.log('Password reset email sent via Resend:', emailData)

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
  firstName,
  organizationName,
  resetLink,
  email
}: {
  firstName: string
  organizationName: string | null
  resetLink: string
  email: string
}) {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Återställ ditt lösenord - BeGone Kundportal</title>
</head>
<body style="margin: 0; padding: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #070f1a;">
  <div style="max-width: 560px; margin: 0 auto;">

    <!-- Header -->
    <div style="background: linear-gradient(160deg, #0d3524 0%, #061810 100%); border-radius: 12px 12px 0 0; padding: 32px 36px 28px; text-align: center; border-bottom: 2px solid #20c58f;">
      <div style="font-size: 26px; font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1;">BeGone</div>
      <div style="font-size: 10px; color: #20c58f; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; margin-top: 4px;">Skadedjur &amp; Sanering</div>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(32,197,143,0.18);">
        <div style="font-size: 20px; font-weight: 700; color: #fff;">Återställ ditt lösenord</div>
        ${organizationName ? `<div style="font-size: 13px; color: #20c58f; margin-top: 4px;">${organizationName}</div>` : ''}
      </div>
    </div>

    <!-- Body -->
    <div style="background: #111827; border-radius: 0 0 12px 12px; padding: 28px 36px 32px;">

      <p style="font-size: 16px; font-weight: 600; color: #f1f5f9; margin: 0 0 8px;">Hej ${firstName},</p>
      <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
        Vi har mottagit en begäran om att återställa lösenordet för <span style="color: #cbd5e1;">${email}</span>. Länken nedan är giltig i <strong style="color: #fbbf24;">1 timme</strong>.
      </p>

      <!-- CTA -->
      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${resetLink}"
           style="display: inline-block; background-color: #20c58f; color: #071811; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 36px; border-radius: 7px; letter-spacing: 0.01em;">
          Återställ lösenord
        </a>
      </div>

      <!-- Länk-fallback -->
      <div style="background: #0b1220; border: 1px solid #1e293b; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">Om knappen inte fungerar, klistra in länken i webbläsaren:</div>
        <div style="font-size: 11px; color: #20c58f; word-break: break-all; font-family: 'Courier New', monospace;">${resetLink}</div>
      </div>

      <!-- Säkerhetsnotis -->
      <div style="border-left: 3px solid #ef4444; background: rgba(90,20,20,0.4); border-radius: 0 6px 6px 0; padding: 10px 14px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #fca5a5; margin: 0 0 2px; font-weight: 600;">Begärde du inte detta?</p>
        <p style="font-size: 13px; color: #f87171; margin: 0; line-height: 1.5;">Du kan ignorera detta mail. Ditt lösenord förblir oförändrat.</p>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center;">
        <p style="font-size: 12px; color: #374151; margin: 0 0 4px;">
          Frågor? <a href="mailto:support@begone.se" style="color: #20c58f; text-decoration: none;">support@begone.se</a>
        </p>
        <p style="font-size: 12px; color: #374151; margin: 0;">
          BeGone Skadedjur &amp; Sanering AB
        </p>
      </div>

    </div>
  </div>
</body>
</html>`
}
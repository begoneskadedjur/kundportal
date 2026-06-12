import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const { email } = req.body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // Hitta användaren via profiles (undviker listUsers)
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, display_name, customer_id')
      .eq('email', email)
      .maybeSingle()

    if (!profile?.user_id) {
      return res.status(404).json({ error: 'Ingen användare hittades med den e-postadressen' })
    }

    // Hämta namn och ev. kundorganisation
    let userName = profile.display_name || 'Användare'
    let organizationName: string | null = null

    if (profile.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('company_name')
        .eq('id', profile.customer_id)
        .maybeSingle()
      organizationName = customer?.company_name || null
    }

    // Generera säkert lösenord
    const newPassword = generateSecurePassword()

    // Sätt lösenordet och rensa gamla reset-tokens
    const { data: currentUser } = await supabase.auth.admin.getUserById(profile.user_id)
    const existingMeta = currentUser?.user?.user_metadata || {}
    const { reset_token_hash: _rth, reset_token_created_at: _rtc, reset_token_expires_at: _rte, ...cleanMeta } = existingMeta

    const { error: updateError } = await supabase.auth.admin.updateUserById(profile.user_id, {
      password: newPassword,
      user_metadata: cleanMeta
    })

    if (updateError) {
      throw new Error(`Kunde inte uppdatera lösenord: ${updateError.message}`)
    }

    // Skicka välkomstmail
    const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`
    const emailHtml = getWelcomeEmailTemplate({ userName, organizationName, email, newPassword, loginLink })

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'BeGone Kundportal <noreply@begone.se>',
        to: [email],
        subject: 'Välkommen till BeGone Kundportal – dina inloggningsuppgifter',
        html: emailHtml
      }),
    })

    if (!emailResponse.ok) {
      const err = await emailResponse.text()
      throw new Error(`Kunde inte skicka e-post: ${err}`)
    }

    return res.status(200).json({ success: true, message: 'Välkomstmail skickat' })

  } catch (error: any) {
    console.error('send-welcome-password error:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod' })
  }
}

function generateSecurePassword(): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%])/.test(password)) {
    return generateSecurePassword()
  }
  return password
}

function getWelcomeEmailTemplate({
  userName,
  organizationName,
  email,
  newPassword,
  loginLink
}: {
  userName: string
  organizationName: string | null
  email: string
  newPassword: string
  loginLink: string
}) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Välkommen till BeGone Kundportal</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #134e35 0%, #0a1f14 100%); padding: 2.5rem 2rem; text-align: center; border-bottom: 3px solid #20c58f;">
            <div style="margin-bottom: 0.75rem;">
                <span style="font-size: 2rem; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">BeGone</span>
            </div>
            <div style="font-size: 0.75rem; color: #20c58f; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;">
                Skadedjur &amp; Sanering
            </div>
            <div style="margin-top: 1.5rem; border-top: 1px solid rgba(32, 197, 143, 0.2); padding-top: 1.5rem;">
                <h1 style="margin: 0; color: white; font-size: 1.5rem; font-weight: 700;">
                    Välkommen till kundportalen
                </h1>
            </div>
        </div>

        <!-- Innehåll -->
        <div style="padding: 2rem;">
            <p style="font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem; color: #e2e8f0;">
                Hej ${userName},
            </p>

            <p style="line-height: 1.6; margin-bottom: 1.5rem; color: #cbd5e1;">
                Ditt konto i BeGone Kundportal är nu klart${organizationName ? ` för <strong style="color: #20c58f;">${organizationName}</strong>` : ''}. Nedan hittar du dina inloggningsuppgifter.
            </p>

            <!-- Inloggningsuppgifter -->
            <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
                <p style="color: #94a3b8; font-size: 0.8rem; margin: 0 0 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Inloggningsuppgifter</p>
                <div style="font-family: 'Courier New', monospace; font-size: 0.95rem;">
                    <div style="margin-bottom: 0.5rem; color: #cbd5e1;">
                        <span style="color: #64748b;">E-post:&nbsp;&nbsp;</span>${email}
                    </div>
                    <div style="color: #cbd5e1;">
                        <span style="color: #64748b;">Lösenord: </span><strong style="color: #20c58f;">${newPassword}</strong>
                    </div>
                </div>
            </div>

            <!-- Varning -->
            <div style="background-color: rgba(120, 80, 10, 0.3); border-left: 3px solid #f59e0b; border-radius: 6px; padding: 1rem 1.25rem; margin: 1.5rem 0;">
                <p style="color: #fcd34d; font-size: 0.9rem; margin: 0; line-height: 1.5;">
                    <strong>Byt lösenord vid första inloggning</strong> — välj ett eget lösenord under dina kontoinställningar.
                </p>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 2rem 0;">
                <a href="${loginLink}"
                   style="background-color: #20c58f;
                          color: #0f172a;
                          text-decoration: none;
                          padding: 14px 32px;
                          border-radius: 8px;
                          font-weight: 700;
                          display: inline-block;
                          font-size: 1rem;">
                    Logga in nu
                </a>
            </div>

            <div style="border-top: 1px solid #334155; padding-top: 1.5rem; margin-top: 2rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                <p style="margin: 0 0 0.5rem;">Frågor? Kontakta oss på <a href="mailto:support@begone.se" style="color: #20c58f; text-decoration: underline;">support@begone.se</a></p>
                <p style="margin: 1rem 0 0;">
                    Med vänliga hälsningar,<br>
                    <strong style="color: #e2e8f0;">BeGone Skadedjur &amp; Sanering AB</strong>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
  `
}

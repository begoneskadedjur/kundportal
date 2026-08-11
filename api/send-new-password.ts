// api/send-new-password.ts
// Admin skickar ett nytt slumpat lösenord till en anställd.
// Lösenordet genereras server-side (admin ser det aldrig), kontot flaggas
// med must_change_password så att personen tvingas välja eget lösenord
// vid nästa inloggning, och uppgifterna mailas till den anställda.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { randomInt } from 'crypto'
import { requireAuth } from './_lib/auth'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const STAFF_ROLES = ['admin', 'koordinator', 'technician', 'säljare']

/** 14 tecken, garanterat minst en liten/stor bokstav, siffra och specialtecken (crypto-slump) */
function generateSecurePassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const special = '!@#$%&*'
  const all = lower + upper + digits + special

  const chars = [
    lower[randomInt(lower.length)],
    upper[randomInt(upper.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ]
  while (chars.length < 14) {
    chars.push(all[randomInt(all.length)])
  }
  // Fisher-Yates med crypto-slump
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function buildEmailHtml(name: string, email: string, password: string, loginLink: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
      <div style="background-color:#20c58f;padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Nytt lösenord till Begone Kundportal</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6;margin:0 0 16px;">Hej ${name},</p>
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Ett nytt lösenord har skapats till ditt konto i Begone Kundportal. Logga in med uppgifterna nedan.
        </p>
        <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
          <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">E-post</p>
          <p style="color:#ffffff;font-size:15px;font-weight:bold;margin:0 0 16px;">${email}</p>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">Tillfälligt lösenord</p>
          <p style="color:#20c58f;font-size:18px;font-weight:bold;font-family:Consolas,Menlo,monospace;letter-spacing:1px;margin:0;">${password}</p>
        </div>
        <p style="color:#e2e8f0;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Av säkerhetsskäl behöver du välja ett eget lösenord första gången du loggar in.
        </p>
        <a href="${loginLink}" style="display:inline-block;background-color:#20c58f;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:10px;">Logga in</a>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:28px 0 0;">
          Har du inte begärt ett nytt lösenord? Kontakta din administratör på Begone direkt.
        </p>
      </div>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;margin:16px 0 0;">Begone Skadedjur &amp; Sanering AB</p>
  </div>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Endast admin får skicka nya lösenord
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  try {
    const { user_id } = req.body
    if (!user_id) {
      return res.status(400).json({ error: 'user_id saknas' })
    }

    // Slå upp profilen och säkerställ att det är ett personalkonto
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, display_name, role, is_admin, is_active')
      .eq('user_id', user_id)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Användaren hittades inte' })
    }
    if (!STAFF_ROLES.includes(profile.role) && !profile.is_admin) {
      return res.status(400).json({ error: 'Nytt lösenord kan bara skickas till personalkonton' })
    }
    if (!profile.email) {
      return res.status(400).json({ error: 'Kontot saknar e-postadress' })
    }

    const newPassword = generateSecurePassword()

    // Behåll befintlig metadata och flagga för obligatoriskt lösenordsbyte
    const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (getUserError || !existingUser?.user) {
      return res.status(404).json({ error: 'Auth-kontot hittades inte' })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: newPassword,
      user_metadata: {
        ...existingUser.user.user_metadata,
        must_change_password: true,
        temp_password: true,
      }
    })

    if (updateError) {
      console.error('Password update error:', updateError.message)
      return res.status(500).json({ error: 'Kunde inte sätta det nya lösenordet' })
    }

    // Maila det nya lösenordet till den anställda
    const name = profile.display_name || profile.email
    const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`

    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: { user: 'resend', pass: RESEND_API_KEY }
    })

    try {
      await transporter.sendMail({
        from: 'Begone Skadedjur & Sanering AB <info@begone.se>',
        to: profile.email,
        subject: 'Nytt lösenord till Begone Kundportal',
        html: buildEmailHtml(name, profile.email, newPassword, loginLink)
      })
    } catch (emailError) {
      console.error('Email send error:', emailError instanceof Error ? emailError.message : emailError)
      // Lösenordet är redan bytt - viktigt att admin får veta båda sakerna
      return res.status(500).json({
        error: 'Lösenordet är bytt men mailet kunde inte skickas. Skicka ett nytt lösenord igen, eller be personen använda Glömt lösenord på inloggningssidan.'
      })
    }

    console.log(`New password sent to ${profile.email} (requested by ${auth.email})`)
    return res.status(200).json({
      success: true,
      message: `Ett nytt lösenord har skickats till ${profile.email}`
    })

  } catch (error) {
    console.error('Error in send-new-password:', error)
    const message = error instanceof Error ? error.message : 'Ett fel uppstod'
    return res.status(500).json({ error: message })
  }
}

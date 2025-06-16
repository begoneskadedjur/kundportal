// api/send-invitation-direct.ts
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// SMTP credentials (samma som i Supabase)
const SMTP_CONFIG = {
  host: 'kumano.oderland.com',
  port: 465,
  secure: true,
  auth: {
    user: 'kundportal@begone.se',
    pass: process.env.SMTP_PASSWORD! // Lägg till detta i Vercel env vars
  }
}

interface RequestBody {
  email: string
  companyName: string
}

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, companyName }: RequestBody = req.body

    if (!email || !companyName) {
      return res.status(400).json({ error: 'Email and company name are required' })
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Create user in Supabase Auth (without sending email)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false, // Don't auto-confirm
      user_metadata: {
        company_name: companyName,
        invited_by: 'admin'
      }
    })

    if (userError) {
      console.error('Failed to create user:', userError)
      return res.status(500).json({ 
        error: 'Failed to create user account',
        details: userError.message 
      })
    }

    // 2. Generate secure token for account activation
    const activationToken = generateSecureToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // 3. Store activation token in database
    const { error: tokenError } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        user_id: userData.user.id,
        email,
        company_name: companyName,
        activation_token: activationToken,
        expires_at: expiresAt.toISOString(),
        used: false
      })

    if (tokenError) {
      console.error('Failed to store invitation token:', tokenError)
      // Clean up created user
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return res.status(500).json({ 
        error: 'Failed to create invitation',
        details: tokenError.message 
      })
    }

    // 4. Send email directly via SMTP
    const transporter = nodemailer.createTransporter(SMTP_CONFIG)

    const activationUrl = `${req.headers.origin || 'https://your-domain.com'}/activate?token=${activationToken}`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Välkommen till BeGone Kundportal</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #2563eb;">Välkommen till BeGone Kundportal!</h1>
    
    <p>Hej,</p>
    
    <p>Du har blivit inbjuden att få tillgång till BeGone Kundportal där du kan se alla dina ärenden och besöksrapporter.</p>
    
    <p><strong>Företag:</strong> ${companyName}</p>
    
    <p>Klicka på knappen nedan för att aktivera ditt konto och välja ett lösenord:</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${activationUrl}" 
         style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Aktivera mitt konto
      </a>
    </p>
    
    <p style="margin-top: 20px; font-size: 14px; color: #666;">
      Fungerar inte knappen? Kopiera och klistra in denna länk i din webbläsare:<br>
      <span style="color: #2563eb; word-break: break-all;">${activationUrl}</span>
    </p>
    
    <p style="margin-top: 20px; font-size: 14px; color: #666;">
      Länken är giltig i 24 timmar.
    </p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    
    <p style="font-size: 12px; color: #888;">
      Med vänliga hälsningar,<br>
      BeGone Skadedjur<br>
      <a href="mailto:kundportal@begone.se">kundportal@begone.se</a>
    </p>
  </div>
</body>
</html>`

    const textContent = `
Välkommen till BeGone Kundportal!

Du har blivit inbjuden att få tillgång till BeGone Kundportal där du kan se alla dina ärenden och besöksrapporter.

Företag: ${companyName}

Aktivera ditt konto genom att klicka på denna länk:
${activationUrl}

Länken är giltig i 24 timmar.

Med vänliga hälsningar,
BeGone Skadedjur
kundportal@begone.se
`

    const mailOptions = {
      from: '"BeGone Kundportal" <kundportal@begone.se>',
      to: email,
      subject: `Välkommen till BeGone Kundportal - ${companyName}`,
      text: textContent,
      html: htmlContent
    }

    await transporter.sendMail(mailOptions)

    console.log(`✅ Direct invitation sent successfully to ${email} for ${companyName}`)

    return res.status(200).json({ 
      success: true,
      method: 'direct_smtp',
      message: 'Invitation sent successfully via direct SMTP',
      activationToken // Only for development - remove in production
    })

  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: (error as Error).message 
    })
  }
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// You'll also need to create this table in your database:
/*
CREATE TABLE user_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  company_name text NOT NULL,
  activation_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_invitations_token ON user_invitations(activation_token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
*/
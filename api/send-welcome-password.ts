import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, display_name, customer_id, organization_id')
      .eq('email', email)
      .maybeSingle()

    if (!profile?.user_id) {
      return res.status(404).json({ error: 'Ingen användare hittades med den e-postadressen' })
    }

    const firstName = (profile.display_name || '').split(' ')[0] || 'Hej'

    // Hämta organisationsnamn
    let organizationName: string | null = null
    if (profile.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('company_name')
        .eq('id', profile.customer_id)
        .maybeSingle()
      organizationName = customer?.company_name || null
    }

    // Hämta anläggningar via multisite_user_roles
    let sites: { name: string; region: string | null }[] = []
    let roleType: string | null = null
    let isVerksamhetschef = false

    const { data: roleData } = await supabase
      .from('multisite_user_roles')
      .select('role_type, site_ids, organization_id')
      .eq('user_id', profile.user_id)
      .eq('is_active', true)
      .maybeSingle()

    if (roleData) {
      roleType = roleData.role_type
      isVerksamhetschef = roleData.role_type === 'verksamhetschef'

      let sitesQuery = supabase
        .from('customers')
        .select('site_name, company_name, region')
        .eq('organization_id', roleData.organization_id)
        .eq('site_type', 'enhet')
        .eq('is_active', true)
        .order('site_name')

      if (!isVerksamhetschef && roleData.site_ids && roleData.site_ids.length > 0) {
        sitesQuery = sitesQuery.in('id', roleData.site_ids)
      }

      const { data: sitesData } = await sitesQuery
      sites = (sitesData || []).map(s => ({
        name: s.site_name || s.company_name,
        region: s.region || null
      }))

      // Hämta org-namn om vi inte redan har det
      if (!organizationName) {
        const { data: org } = await supabase
          .from('customers')
          .select('company_name')
          .eq('organization_id', roleData.organization_id)
          .eq('site_type', 'huvudkontor')
          .maybeSingle()
        organizationName = org?.company_name || null
      }
    }

    // Generera lösenord och uppdatera
    const newPassword = generateSecurePassword()

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

    const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`
    const emailHtml = getWelcomeEmailTemplate({
      firstName,
      organizationName,
      email,
      newPassword,
      loginLink,
      sites,
      isVerksamhetschef,
      roleType
    })

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

function getRoleLabel(roleType: string | null): string {
  const map: Record<string, string> = {
    verksamhetschef: 'Verksamhetschef',
    regionchef: 'Regionchef',
    platsansvarig: 'Platsansvarig'
  }
  return roleType ? (map[roleType] || roleType) : ''
}

function getWelcomeEmailTemplate({
  firstName,
  organizationName,
  email,
  newPassword,
  loginLink,
  sites,
  isVerksamhetschef,
  roleType
}: {
  firstName: string
  organizationName: string | null
  email: string
  newPassword: string
  loginLink: string
  sites: { name: string; region: string | null }[]
  isVerksamhetschef: boolean
  roleType: string | null
}) {
  const roleLabel = getRoleLabel(roleType)
  const MAX_SITES = 10
  const visibleSites = sites.slice(0, MAX_SITES)
  const hiddenCount = sites.length - visibleSites.length

  const sitesSection = sites.length > 0 ? `
    <div style="margin: 20px 0;">
      <p style="margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em;">
        ${isVerksamhetschef ? 'Tillgång till hela organisationen' : 'Dina anläggningar'}
        ${roleLabel ? `<span style="margin-left: 8px; background: rgba(32,197,143,0.15); color: #20c58f; font-size: 11px; padding: 2px 8px; border-radius: 20px; text-transform: none; letter-spacing: 0;">${roleLabel}</span>` : ''}
      </p>
      <div style="background: #0f172a; border: 1px solid #1e3a2a; border-radius: 8px; overflow: hidden;">
        ${visibleSites.map((s, i) => `
        <div style="display: flex; align-items: center; padding: 9px 14px; ${i < visibleSites.length - 1 ? 'border-bottom: 1px solid #1e293b;' : ''}">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #20c58f; display: inline-block; margin-right: 10px; flex-shrink: 0;"></span>
          <span style="font-size: 13px; color: #e2e8f0; flex: 1;">${s.name}</span>
          ${s.region ? `<span style="font-size: 11px; color: #475569; margin-left: 8px;">${s.region}</span>` : ''}
        </div>`).join('')}
        ${hiddenCount > 0 ? `
        <div style="padding: 8px 14px; border-top: 1px solid #1e293b;">
          <span style="font-size: 12px; color: #475569;">... och ${hiddenCount} till</span>
        </div>` : ''}
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Välkommen till BeGone Kundportal</title>
</head>
<body style="margin: 0; padding: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #070f1a;">
  <div style="max-width: 560px; margin: 0 auto;">

    <!-- Header -->
    <div style="background: linear-gradient(160deg, #0d3524 0%, #061810 100%); border-radius: 12px 12px 0 0; padding: 32px 36px 28px; text-align: center; border-bottom: 2px solid #20c58f;">
      <div style="font-size: 26px; font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1;">BeGone</div>
      <div style="font-size: 10px; color: #20c58f; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; margin-top: 4px;">Skadedjur &amp; Sanering</div>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(32,197,143,0.18);">
        <div style="font-size: 20px; font-weight: 700; color: #fff;">Välkommen till kundportalen</div>
        ${organizationName ? `<div style="font-size: 13px; color: #20c58f; margin-top: 4px;">${organizationName}</div>` : ''}
      </div>
    </div>

    <!-- Body -->
    <div style="background: #111827; border-radius: 0 0 12px 12px; padding: 28px 36px 32px;">

      <p style="font-size: 16px; font-weight: 600; color: #f1f5f9; margin: 0 0 8px;">Hej ${firstName},</p>
      <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
        Ditt konto är nu aktiverat. Logga in med uppgifterna nedan och byt lösenord vid första tillfället.
      </p>

      <!-- Inloggningsuppgifter -->
      <div style="background: #0b1220; border: 1px solid #1e293b; border-radius: 8px; padding: 16px 18px; margin-bottom: 16px;">
        <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">Inloggningsuppgifter</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-size: 12px; color: #475569; padding: 4px 0; width: 72px; vertical-align: top;">E-post</td>
            <td style="font-size: 13px; color: #cbd5e1; padding: 4px 0; font-family: 'Courier New', monospace;">${email}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #475569; padding: 4px 0; vertical-align: top;">Lösenord</td>
            <td style="font-size: 15px; color: #20c58f; padding: 4px 0; font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 0.04em;">${newPassword}</td>
          </tr>
        </table>
      </div>

      <!-- Byt lösenord-notis -->
      <div style="border-left: 3px solid #d97706; background: rgba(92,55,0,0.35); border-radius: 0 6px 6px 0; padding: 10px 14px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #fbbf24; margin: 0; line-height: 1.5;">
          <strong>Byt lösenord</strong> — gå till kontoinställningarna och välj ett eget lösenord vid första inloggning.
        </p>
      </div>

      ${sitesSection}

      <!-- CTA -->
      <div style="text-align: center; margin: 24px 0 20px;">
        <a href="${loginLink}"
           style="display: inline-block; background-color: #20c58f; color: #071811; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 36px; border-radius: 7px; letter-spacing: 0.01em;">
          Logga in nu
        </a>
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

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
        subject: organizationName ? `${organizationName} — Välkommen till BeGone Kundportal` : 'Välkommen till BeGone Kundportal',
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
    <div style="margin: 0 0 24px 0;">
      <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;">
        ${isVerksamhetschef ? 'Tillgång till hela organisationen' : 'Dina anläggningar'}${roleLabel ? ` &nbsp;<span style="font-weight: 400; text-transform: none; letter-spacing: 0; color: #20c58f;">${roleLabel}</span>` : ''}
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          ${visibleSites.map((s, i) => `<tr>
            <td style="padding: 9px 16px; font-size: 13px; color: #374151; ${i < visibleSites.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #20c58f; margin-right: 10px; vertical-align: middle;"></span>${s.name}
              ${s.region ? `<span style="float: right; font-size: 11px; color: #9CA3AF;">${s.region}</span>` : ''}
            </td>
          </tr>`).join('')}
          ${hiddenCount > 0 ? `<tr><td style="padding: 8px 16px; font-size: 12px; color: #9CA3AF; border-top: 1px solid #e2e8f0;">... och ${hiddenCount} till</td></tr>` : ''}
        </table>
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="sv" style="color-scheme: light;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Välkommen till BeGone Kundportal</title>
</head>
<body style="margin: 0; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f1f5f9;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f1f5f9;">Ditt konto hos BeGone Kundportal är aktiverat. Logga in med uppgifterna nedan.</div>

  <div style="max-width: 560px; margin: 32px auto; box-shadow: 0 2px 12px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background: linear-gradient(160deg, #0d2a1c 0%, #071610 100%); border-radius: 8px 8px 0 0; padding: 32px 36px 28px; text-align: center; border-bottom: 2px solid #20c58f;">
      <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1;">BeGone Skadedjur</div>
      <div style="margin-top: 16px;">
        <div style="font-size: 20px; font-weight: 700; color: #ffffff;">Välkommen till kundportalen</div>
        ${organizationName ? `<div style="font-size: 13px; color: #20c58f; margin-top: 5px; font-weight: 500;">${organizationName}</div>` : ''}
      </div>
    </div>

    <!-- Body -->
    <div style="background: #ffffff; padding: 32px 36px;">

      <p style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 6px;">Hej ${firstName},</p>
      <p style="font-size: 15px; color: #4B5563; margin: 0 0 24px; line-height: 1.7;">
        Ditt konto i BeGone Kundportal är nu aktiverat. Nedan hittar du dina inloggningsuppgifter.
      </p>

      <!-- Inloggningsuppgifter -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px 24px; margin: 0 0 24px 0;">
        <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Inloggningsuppgifter</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #9CA3AF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; width: 130px;">E-postadress</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #111827; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 11px; color: #9CA3AF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Lösenord</td>
            <td style="padding: 8px 0; font-size: 14px; color: #111827; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; letter-spacing: 0.04em;">${newPassword}</td>
          </tr>
        </table>
      </div>

      ${sitesSection}

      <!-- Amber-varning -->
      <div style="border-left: 3px solid #F59E0B; background-color: #FFFBEB; border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 0 0 28px 0;">
        <p style="font-size: 13px; font-weight: 600; color: #92400E; margin: 0 0 3px 0;">Byt lösenord vid första inloggning</p>
        <p style="font-size: 13px; color: #92400E; margin: 0; line-height: 1.5;">Gå till profil-ikonen i sidomenyn och välj ett eget lösenord.</p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 0 0 8px 0;">
        <a href="${loginLink}"
           style="display: inline-block; background-color: #20c58f; color: #071610; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 40px; border-radius: 6px; letter-spacing: 0.01em;">
          Logga in nu
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; padding: 24px 36px; text-align: center;">
      <p style="font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 6px 0;">BeGone Skadedjur &amp; Sanering AB</p>
      <p style="font-size: 12px; color: #9CA3AF; margin: 0 0 16px 0;">
        Org.nr: 559378-9208 &nbsp;&middot;&nbsp; 010 280 44 10 &nbsp;&middot;&nbsp;
        <a href="mailto:info@begone.se" style="color: #20c58f; text-decoration: none;">info@begone.se</a>
      </p>
      <p style="font-size: 11px; color: #D1D5DB; margin: 0;">Detta är ett automatiserat meddelande. Vänligen svara inte på detta mail.</p>
    </div>

  </div>
</body>
</html>`
}

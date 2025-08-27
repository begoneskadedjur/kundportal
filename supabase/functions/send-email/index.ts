// Edge Function för Send Email Hook - Skickar lösenordsåterställning via Resend
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

interface EmailHookPayload {
  type: 'recovery'
  user: {
    id: string
    email: string
    user_metadata?: {
      name?: string
      organization_id?: string
    }
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    confirmation_url: string
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload: EmailHookPayload = await req.json()
    console.log('Email hook triggered:', { 
      type: payload.type, 
      email: payload.user.email,
      hasToken: !!payload.email_data.token 
    })

    // Endast hantera recovery emails (lösenordsåterställning)
    if (payload.type !== 'recovery') {
      console.log('Ignoring non-recovery email type:', payload.type)
      return new Response(JSON.stringify({ message: 'Email type not handled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const { user, email_data } = payload

    // Hämta användarnamn och organisation (samma logik som tidigare)
    const userName = user.user_metadata?.name || 'Användare'
    
    // Hämta organisationsnamn om användaren tillhör en organisation
    let organizationName: string | null = null
    if (user.user_metadata?.organization_id) {
      // Här skulle vi kunna hämta från Supabase, men för att hålla det enkelt
      // använder vi samma logik som tidigare
      try {
        // Detta skulle vara en Supabase-query, men för Edge Functions 
        // måste vi skicka organization_id från frontend eller använda en annan approach
        organizationName = null // Sätts till null för nu
      } catch (error) {
        console.log('Could not fetch organization name:', error)
      }
    }

    // Skapa återställningslänk från Supabase confirmation_url
    const resetLink = email_data.confirmation_url

    console.log('Preparing email:', {
      userName,
      organizationName,
      resetLink: resetLink?.substring(0, 50) + '...'
    })

    // Skapa e-post HTML (samma som tidigare men med Supabase link)
    const emailHtml = getPasswordResetEmailTemplate({
      userName,
      organizationName,
      resetLink,
      email: user.email
    })

    // Skicka e-post via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Begone Kundportal <noreply@begone.se>',
        to: [user.email],
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

    return new Response(
      JSON.stringify({ message: 'Email sent successfully', id: emailData.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Error in send-email hook:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Samma HTML-mall som tidigare - behåller all styling!
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
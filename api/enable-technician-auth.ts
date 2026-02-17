// api/enable-technician-auth.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { technician_id, email, password, display_name } = req.body

    // 1. Kontrollera om tekniker existerar
    const { data: technician, error: techError } = await supabaseAdmin
      .from('technicians')
      .select('*')
      .eq('id', technician_id)
      .single()

    if (techError || !technician) {
      return res.status(404).json({ error: 'Tekniker hittades inte' })
    }

    // 2. Kontrollera om auth redan finns
    // Admins har technician_id=NULL i profilen (pga check constraint), så vi måste matcha via email också
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .or(`technician_id.eq.${technician_id},email.eq.${email}`)
      .single()

    if (existingProfile) {
      return res.status(400).json({ error: 'Personen har redan inloggning aktiverat' })
    }

    // 3. Mappa roll
    const roleMapping: { [key: string]: string } = {
      'Admin': 'admin',
      'Koordinator': 'koordinator',
      'Skadedjurstekniker': 'technician'
    }
    const correctRole = roleMapping[technician.role] || 'technician'

    // 4. Validera email och lösenord
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltigt e-postformat' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Lösenord måste vara minst 6 tecken' })
    }

    // 5. Skapa auth user — handle_new_user trigger skapar profilen automatiskt
    // Alla roller får samma metadata (triggern bestämmer vad som sparas baserat på role)
    const userMetadata: Record<string, string> = {
      display_name: display_name || technician.name,
      role: correctRole,
      technician_id: technician_id,
      technician_name: technician.name
    }

    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata
    })

    if (authError) {
      console.error('Auth creation error:', authError.message)

      let errorMessage = 'Kunde inte skapa användarkonto'
      if (authError.message.includes('duplicate')) {
        errorMessage = 'En användare med denna e-postadress existerar redan'
      } else if (authError.status === 422) {
        errorMessage = 'E-postformat eller lösenord uppfyller inte kraven'
      }

      return res.status(500).json({ error: errorMessage })
    }

    // 6. Verifiera att profilen skapades av triggern
    await new Promise(resolve => setTimeout(resolve, 500))

    const { data: createdProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, technician_id, role')
      .eq('user_id', newAuthUser.user.id)
      .single()

    if (profileCheckError || !createdProfile) {
      console.error('Profile not created by trigger:', profileCheckError)
      try {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return res.status(500).json({ error: 'Profil skapades inte automatiskt av trigger' })
    }

    // 7. Skicka välkomstmail om det begärts
    if (req.body.sendWelcomeEmail) {
      try {
        const invitationResponse = await fetch(`${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/api/send-staff-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technicianId: technician_id,
            email: email,
            name: display_name || technician.name,
            role: correctRole,
            tempPassword: password,
            invitedBy: req.body.invitedBy || null
          })
        })

        if (!invitationResponse.ok) {
          const errorData = await invitationResponse.json()
          console.error('Failed to send welcome email:', errorData)
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError)
      }
    }

    return res.status(200).json({
      success: true,
      message: `Inloggning aktiverat för ${technician.name}`,
      auth_user_id: newAuthUser.user.id,
      profile: createdProfile,
      welcomeEmailSent: req.body.sendWelcomeEmail || false
    })

  } catch (error: any) {
    console.error('Error in enable-technician-auth:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod' })
  }
}

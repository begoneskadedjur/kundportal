// api/enable-technician-auth.ts - UPPDATERAD VERSION
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key

// Server-side supabase client med service role
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
    
    console.log('🔐 Enabling auth for technician:', { technician_id, email, display_name })

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
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('technician_id', technician_id)
      .single()

    if (existingProfile) {
      return res.status(400).json({ error: 'Tekniker har redan inloggning aktiverat' })
    }

    // 3. Mappa korrekt roll baserat på technicians.role
    const roleMapping: { [key: string]: string } = {
      'Admin': 'admin',
      'Koordinator': 'koordinator', 
      'Skadedjurstekniker': 'technician'
    }
    
    const correctRole = roleMapping[technician.role] || 'technician'
    console.log(`🔄 Mapping role: ${technician.role} -> ${correctRole}`)

    // 4. Skapa auth user med ADMIN CLIENT
    // handle_new_user trigger kommer automatiskt skapa profilen
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name,
        role: correctRole,             // Korrekt roll baserat på technicians.role
        technician_id: technician_id, // Trigger använder detta för FK
        technician_name: technician.name
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return res.status(500).json({ error: `Kunde inte skapa användarkonto: ${authError.message}` })
    }

    console.log('✅ Auth user created:', newAuthUser.user.id)
    console.log('✅ Profile will be created automatically by handle_new_user trigger')

    // 5. Vänta en kort stund och verifiera att profilen skapades
    await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay

    const { data: createdProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, technician_id, role')
      .eq('user_id', newAuthUser.user.id)
      .single()

    if (profileCheckError || !createdProfile) {
      console.warn('Profile may not have been created by trigger:', profileCheckError)
      // Försök cleanup om något gick fel
      try {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return res.status(500).json({ error: 'Profil skapades inte automatiskt av trigger' })
    }

    console.log('✅ Profile verified:', createdProfile)

    // 6. Skicka välkomstmail om det begärts
    if (req.body.sendWelcomeEmail) {
      try {
        console.log('📧 Sending welcome email to:', email)
        
        const invitationResponse = await fetch(`${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/api/send-staff-invitation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
          // Fortsätt ändå - kontot är skapat
        } else {
          console.log('✅ Welcome email sent successfully')
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError)
        // Fortsätt ändå - kontot är skapat
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
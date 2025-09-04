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

    // 3.5. Validera email och lösenord innan Supabase-anrop
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email)
      return res.status(400).json({ error: 'Ogiltigt e-postformat' })
    }
    
    if (!password || password.length < 6) {
      console.error('Invalid password length:', password ? password.length : 0)
      return res.status(400).json({ error: 'Lösenord måste vara minst 6 tecken' })
    }

    console.log('✅ Email and password validation passed')

    // 3.6 DEBUG: Kontrollera om email redan existerar i auth.users
    console.log('🔍 Checking if email already exists in auth system...')
    try {
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) {
        console.warn('Could not check existing users:', listError)
      } else {
        const existingUser = existingUsers.users.find(u => u.email === email)
        if (existingUser) {
          console.error('🚨 EMAIL ALREADY EXISTS in auth.users:', existingUser.id)
          return res.status(400).json({ 
            error: 'En användare med denna e-postadress existerar redan i auth-systemet',
            existingUserId: existingUser.id
          })
        }
        console.log('✅ Email is unique in auth system')
      }
    } catch (listUsersError) {
      console.warn('Error checking existing users:', listUsersError)
    }

    // 4. Skapa auth user med ADMIN CLIENT
    // handle_new_user trigger kommer automatiskt skapa profilen
    const userMetadata = {
      display_name: display_name,
      role: correctRole,             // Korrekt roll baserat på technicians.role
      technician_id: technician_id, // Trigger använder detta för FK
      technician_name: technician.name
    }
    
    console.log('🔍 DEBUG: Creating user with metadata:', JSON.stringify(userMetadata, null, 2))
    console.log('🔍 DEBUG: User creation parameters:', {
      email: email,
      passwordLength: password ? password.length : 0,
      email_confirm: true
    })

    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata
    })

    if (authError) {
      console.error('🚨 AUTH CREATION FAILED')
      console.error('Auth creation error:', authError)
      console.error('Full error object:', JSON.stringify(authError, null, 2))
      console.error('Error details:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        name: authError.name,
        __isAuthError: authError.__isAuthError
      })
      
      // DEBUG: Log all properties of the error
      console.error('🔍 All error properties:', Object.getOwnPropertyNames(authError))
      console.error('🔍 Error prototype:', Object.getPrototypeOf(authError))
      
      // Try to extract any nested error information
      if (authError.cause) {
        console.error('🔍 Error cause:', authError.cause)
      }
      if (authError.stack) {
        console.error('🔍 Error stack:', authError.stack)
      }
      
      let errorMessage = `Database error creating new user`
      if (authError.message.includes('duplicate')) {
        errorMessage = 'En användare med denna e-postadress existerar redan'
      } else if (authError.message.includes('invalid')) {
        errorMessage = 'Ogiltiga användaruppgifter'
      } else if (authError.status === 422) {
        errorMessage = 'E-postformat eller lösenord uppfyller inte kraven'
      }
      
      return res.status(500).json({ 
        error: `Kunde inte skapa användarkonto: ${errorMessage}`,
        supabaseError: authError.message,
        errorCode: authError.code,
        debugInfo: {
          errorName: authError.name,
          errorStatus: authError.status,
          isAuthError: authError.__isAuthError,
          userMetadata: userMetadata,
          email: email
        }
      })
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
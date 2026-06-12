// api/create-admin-user.ts - API för att skapa admin-användare
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './_lib/auth'

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

  // Endast inloggade admins får skapa admin-användare
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  try {
    const { email, password, display_name, sendWelcomeEmail } = req.body
    
    console.log('🔐 Creating admin user:', { email, display_name })

    // 1. Validera email och lösenord
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltigt e-postformat' })
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Lösenord måste vara minst 6 tecken' })
    }

    // 2. Kontrollera om email redan finns
    console.log('🔍 Checking if email already exists...')
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (!listError) {
      const existingUser = existingUsers.users.find((u: any) => u.email === email)
      if (existingUser) {
        return res.status(400).json({ 
          error: 'En användare med denna e-postadress finns redan'
        })
      }
    }

    // 3. Skapa auth user för admin (endast role i metadata)
    const userMetadata = {
      role: 'admin'  // Endast role för admin - handle_new_user trigger kommer skapa profilen
    }
    
    console.log('🔍 Creating admin user with metadata:', userMetadata)

    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata
    })

    if (authError) {
      console.error('🚨 Admin creation failed:', authError)
      return res.status(500).json({ 
        error: `Kunde inte skapa admin-konto: ${authError.message}`,
        supabaseError: authError.message
      })
    }

    console.log('✅ Admin auth user created:', newAuthUser.user.id)

    // 4. Vänta kort tid och verifiera att profilen skapades av handle_new_user trigger
    await new Promise(resolve => setTimeout(resolve, 500))

    const { data: createdProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, role, is_admin')
      .eq('user_id', newAuthUser.user.id)
      .single()

    if (profileCheckError || !createdProfile) {
      console.warn('Profile may not have been created by trigger:', profileCheckError)
      // Cleanup om något gick fel
      try {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return res.status(500).json({ error: 'Profil skapades inte automatiskt av trigger' })
    }

    console.log('✅ Admin profile verified:', createdProfile)

    // 5. Skicka välkomstmail om det begärts
    if (sendWelcomeEmail) {
      try {
        console.log('📧 Sending welcome email to admin:', email)
        
        const invitationResponse = await fetch(`${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/api/send-staff-invitation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            technicianId: null, // Admins har ingen technician_id
            email: email,
            name: display_name,
            role: 'admin',
            tempPassword: password,
            invitedBy: null // Kan lägga till senare om behövs
          })
        })

        if (!invitationResponse.ok) {
          const errorData = await invitationResponse.json()
          console.error('Failed to send welcome email:', errorData)
        } else {
          console.log('✅ Welcome email sent successfully')
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError)
      }
    }

    return res.status(200).json({
      success: true,
      message: `Admin-konto skapat för ${display_name}`,
      auth_user_id: newAuthUser.user.id,
      profile: createdProfile,
      welcomeEmailSent: sendWelcomeEmail || false
    })

  } catch (error: any) {
    console.error('Error in create-admin-user:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod vid skapande av admin' })
  }
}
// api/enable-technician-auth.ts - NY SERVERLESS FUNCTION
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

    // 3. Skapa auth user med ADMIN CLIENT
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name,
        role: 'technician',
        technician_id: technician_id,
        technician_name: technician.name
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return res.status(500).json({ error: `Kunde inte skapa användarkonto: ${authError.message}` })
    }

    console.log('✅ Auth user created:', newAuthUser.user.id)

    // 4. Skapa profil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newAuthUser.user.id,
        user_id: newAuthUser.user.id,
        email: email,
        customer_id: null,
        is_admin: false,
        is_active: true,
        technician_id: technician_id,
        role: 'technician',
        display_name: display_name
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      return res.status(500).json({ error: `Kunde inte skapa profil: ${profileError.message}` })
    }

    console.log('✅ Technician profile created successfully')

    return res.status(200).json({
      success: true,
      message: `Inloggning aktiverat för ${technician.name}`,
      auth_user_id: newAuthUser.user.id
    })

  } catch (error: any) {
    console.error('Error in enable-technician-auth:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod' })
  }
}
// api/disable-technician-auth.ts — Inaktivera auth för en tekniker
// Accepterar antingen user_id ELLER technician_id, hanterar profil + auth-radering server-side
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
    const { user_id, technician_id } = req.body

    if (!user_id && !technician_id) {
      return res.status(400).json({ error: 'user_id eller technician_id krävs' })
    }

    // Slå upp user_id om det inte skickades
    let authUserId = user_id
    if (!authUserId && technician_id) {
      // Försök via technician_id FK (tekniker/koordinator)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('technician_id', technician_id)
        .single()

      if (profile) {
        authUserId = profile.user_id
      } else {
        // Fallback: slå upp via email (admin-profiler har technician_id=NULL pga check constraint)
        const { data: technician } = await supabaseAdmin
          .from('technicians')
          .select('email')
          .eq('id', technician_id)
          .single()

        if (technician) {
          const { data: emailProfile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', technician.email)
            .single()

          if (emailProfile) {
            authUserId = emailProfile.user_id
          }
        }
      }
    }

    if (!authUserId) {
      return res.status(404).json({ error: 'Ingen profil/användare hittades för denna person' })
    }

    // 1. Radera profil-raden (server-side med service role)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', authUserId)

    if (profileError) {
      console.error('Failed to delete profile:', profileError)
      // Fortsätt ändå — vi vill fortfarande ta bort auth-användaren
    }

    // 2. Radera auth-användaren
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)

    if (authError) {
      console.error('Failed to delete auth user:', authError)
      // Försök soft delete som fallback
      const { error: softError } = await supabaseAdmin.auth.admin.deleteUser(authUserId, true)
      if (softError) {
        console.error('Soft delete also failed:', softError)
        return res.status(500).json({
          error: 'Kunde inte ta bort auth-användaren',
          details: authError.message
        })
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Inloggning inaktiverad — profil och auth-användare borttagna'
    })

  } catch (error: any) {
    console.error('Error in disable-technician-auth:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod' })
  }
}

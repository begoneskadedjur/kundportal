// api/delete-technician.ts - Ta bort tekniker/admin permanent
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
    const { technician_id } = req.body

    if (!technician_id) {
      return res.status(400).json({ error: 'technician_id krävs' })
    }

    // 1. Hämta tekniker-information
    const { data: technician, error: techError } = await supabaseAdmin
      .from('technicians')
      .select('name, email, role')
      .eq('id', technician_id)
      .single()

    if (techError || !technician) {
      return res.status(404).json({ error: 'Tekniker hittades inte' })
    }

    // 2. Hitta kopplad profil via FK (alla roller har nu technician_id)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('technician_id', technician_id)
      .single()

    if (profile) {
      // 3. Ta bort auth user först
      try {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id, false)
        if (authError) {
          const { error: softError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id, true)
          if (softError) {
            console.warn('Auth deletion failed, continuing with cleanup:', softError.message)
          }
        }
      } catch (authError: any) {
        console.warn('Auth deletion threw exception, continuing:', authError.message)
      }

      // 4. Ta bort profil via FK
      try {
        await supabaseAdmin.from('profiles').delete().eq('technician_id', technician_id)
      } catch (profileError: any) {
        console.error('Profile deletion failed:', profileError.message)
      }
    }

    // 5. Ta bort från technicians-tabellen sist
    const { error: deleteError } = await supabaseAdmin
      .from('technicians')
      .delete()
      .eq('id', technician_id)

    if (deleteError) {
      throw new Error(`Kunde inte ta bort från technicians-tabellen: ${deleteError.message}`)
    }

    return res.status(200).json({
      success: true,
      message: `${technician.name} har tagits bort från systemet`,
      deleted: {
        technician: true,
        profile: !!profile,
        authUser: !!profile
      }
    })

  } catch (error: any) {
    console.error('Error in delete-technician:', error)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid borttagning'
    })
  }
}

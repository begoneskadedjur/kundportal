// api/delete-technician.ts - Ta bort tekniker/admin permanent
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
    const { technician_id } = req.body
    
    console.log('🗑️ Deleting technician:', technician_id)

    if (!technician_id) {
      return res.status(400).json({ error: 'technician_id krävs' })
    }

    // 1. Hämta tekniker-information först
    const { data: technician, error: techError } = await supabaseAdmin
      .from('technicians')
      .select('name, email, role')
      .eq('id', technician_id)
      .single()

    if (techError || !technician) {
      console.error('Tekniker hittades inte:', techError)
      return res.status(404).json({ error: 'Tekniker hittades inte' })
    }

    console.log('📋 Technician to delete:', { 
      name: technician.name, 
      email: technician.email, 
      role: technician.role 
    })

    // 2. Hitta kopplad profil - olika logik för admins vs tekniker
    let profileQuery
    if (technician.role === 'Admin') {
      // För admins: sök på email (de har inte technician_id i profiles)
      profileQuery = supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('email', technician.email)
        .single()
    } else {
      // För tekniker: sök på technician_id
      profileQuery = supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('technician_id', technician_id)
        .single()
    }

    const { data: profile, error: profileError } = await profileQuery

    if (profile) {
      console.log('👤 Found profile, deleting user_id:', profile.user_id)

      // 3. Försök ta bort auth user FÖRST (medan profil-referensen finns)
      try {
        console.log('🔄 Attempting to delete auth user first...')
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id, false) // false = hard delete
        if (authError) {
          console.error('❌ Auth deletion failed:', authError)
          
          // Om auth-borttagning misslyckas, försök "soft delete" istället
          console.log('🔄 Trying soft delete approach...')
          const { error: softDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id, true) // true = soft delete
          if (softDeleteError) {
            console.warn('⚠️ Both hard and soft delete failed, continuing with profile cleanup...')
            console.warn('Auth error details:', softDeleteError)
          } else {
            console.log('✅ Auth user soft deleted')
          }
        } else {
          console.log('✅ Auth user hard deleted')
        }
      } catch (authError: any) {
        console.warn('⚠️ Auth deletion threw exception, continuing with cleanup...', authError.message)
      }

      // 4. Ta bort från profiles-tabellen efter auth-försök
      try {
        if (technician.role === 'Admin') {
          await supabaseAdmin.from('profiles').delete().eq('email', technician.email)
        } else {
          await supabaseAdmin.from('profiles').delete().eq('technician_id', technician_id)
        }
        console.log('✅ Profile deleted from database')
      } catch (profileError: any) {
        console.error('❌ Profile deletion failed:', profileError)
        // Fortsätt ändå för att ta bort från technicians
      }
    } else {
      console.log('ℹ️ No profile found, skipping auth deletion')
    }

    // 5. Ta bort från technicians-tabellen sist
    const { error: deleteError } = await supabaseAdmin
      .from('technicians')
      .delete()
      .eq('id', technician_id)

    if (deleteError) {
      console.error('❌ Failed to delete technician:', deleteError)
      throw new Error(`Kunde inte ta bort från technicians-tabellen: ${deleteError.message}`)
    }

    console.log('✅ Technician deleted from database')
    console.log('🎉 Deletion completed for:', technician.name)

    return res.status(200).json({
      success: true,
      message: `${technician.name} har tagits bort från systemet`,
      deleted: {
        technician: true,
        profile: !!profile,
        authUser: !!profile // Vi försökte alltid ta bort auth om profile fanns
      },
      warning: profile ? 'Auth-borttagning kan ha misslyckats men användaren är borttagen från systemet' : null
    })

  } catch (error: any) {
    console.error('❌ Error in delete-technician:', error)
    return res.status(500).json({ 
      error: error.message || 'Ett fel uppstod vid borttagning',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
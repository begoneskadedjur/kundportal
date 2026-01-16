// api/disable-technician-auth.ts - Inaktivera auth för en tekniker
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    const { user_id, technician_id } = req.body

    console.log('🔐 Disabling auth for technician:', { user_id, technician_id })

    if (!user_id) {
      return res.status(400).json({ error: 'user_id krävs' })
    }

    // Ta bort auth-användaren
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authError) {
      console.error('Failed to delete auth user:', authError)
      // Försök soft delete istället
      const { error: softError } = await supabaseAdmin.auth.admin.deleteUser(user_id, true)
      if (softError) {
        console.error('Soft delete also failed:', softError)
        return res.status(500).json({
          error: 'Kunde inte ta bort auth-användaren',
          details: authError.message
        })
      }
    }

    console.log('✅ Auth user deleted for technician:', technician_id)

    return res.status(200).json({
      success: true,
      message: 'Auth-användare borttagen'
    })

  } catch (error: any) {
    console.error('Error in disable-technician-auth:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod' })
  }
}

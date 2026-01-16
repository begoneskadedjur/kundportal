// api/update-user-password.ts
// Serverless function för att uppdatera användarlösenord
// Kräver service_role key som inte kan användas från frontend

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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user_id, new_password } = req.body

    // Validera input
    if (!user_id) {
      return res.status(400).json({ error: 'Användar-ID saknas' })
    }

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Lösenordet måste vara minst 6 tecken' })
    }

    console.log('🔐 Updating password for user:', user_id)

    // Verifiera att användaren existerar
    const { data: user, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (getUserError || !user) {
      console.error('User not found:', getUserError)
      return res.status(404).json({ error: 'Användaren hittades inte' })
    }

    // Uppdatera lösenordet
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password
    })

    if (error) {
      console.error('Password update error:', error)
      return res.status(500).json({
        error: `Kunde inte uppdatera lösenordet: ${error.message}`
      })
    }

    console.log('✅ Password updated for user:', user_id)

    return res.status(200).json({
      success: true,
      message: 'Lösenordet har uppdaterats'
    })

  } catch (error: any) {
    console.error('Error in update-user-password:', error)
    return res.status(500).json({ error: error.message || 'Ett fel uppstod' })
  }
}

// api/verify-reset-token.ts - Hantera Supabase lösenordsåterställning
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  console.log('=== VERIFY RESET TOKEN API START (Supabase Auth) ===')
  console.log('Request timestamp:', new Date().toISOString())

  // Använd anon key för Supabase Auth-operationer
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    const { access_token, refresh_token, newPassword } = req.body
    console.log('Request data received:', { 
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      passwordLength: newPassword?.length
    })

    // Validera indata
    if (!access_token || !refresh_token || !newPassword) {
      console.log('Missing required fields')
      return res.status(400).json({ error: 'Access token, refresh token och nytt lösenord krävs' })
    }

    console.log('Setting session with tokens from Supabase...')

    // Sätt session med tokens från Supabase
    const { data: { user }, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })

    if (sessionError || !user) {
      console.error('Failed to set session:', sessionError)
      return res.status(400).json({ error: 'Ogiltig återställningslänk eller utgången session' })
    }

    console.log('Session set successfully for user:', { 
      userId: user.id,
      email: user.email 
    })

    // Uppdatera lösenord
    console.log('Updating password...')
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Failed to update password:', updateError)
      return res.status(500).json({ error: 'Kunde inte uppdatera lösenordet' })
    }

    console.log('Password updated successfully')

    // Uppdatera display_name i profiles om det behövs
    if (user.user_metadata?.name) {
      console.log('Updating display_name in profiles...')
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: user.user_metadata.name })
        .eq('id', user.id)
      
      if (profileError) {
        console.error('Failed to update profile display_name:', profileError)
        // Detta är inte kritiskt, så vi fortsätter ändå
      } else {
        console.log('Profile display_name updated successfully')
      }
    }

    console.log('=== VERIFY RESET TOKEN API SUCCESS ===')
    return res.status(200).json({
      success: true,
      message: 'Lösenordet har uppdaterats'
    })

  } catch (error: any) {
    console.error('Error verifying reset token:', error)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid lösenordsuppdatering'
    })
  }
}
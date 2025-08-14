// api/verify-reset-token.ts - Verifiera token och uppdatera lösenord
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const { token, email, newPassword } = req.body

    // Validera indata
    if (!token || !email || !newPassword) {
      return res.status(400).json({ error: 'Token, e-post och nytt lösenord krävs' })
    }

    // Hasha token för jämförelse
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Hämta användare och verifiera token
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    // Verifiera token och utgångstid
    const storedToken = user.user_metadata?.reset_token
    const expiresAt = user.user_metadata?.reset_token_expires

    if (!storedToken || storedToken !== tokenHash) {
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    if (!expiresAt || new Date(expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Återställningslänken har gått ut' })
    }

    // Uppdatera lösenord
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: {
        ...user.user_metadata,
        reset_token: null,
        reset_token_expires: null
      }
    })

    if (updateError) {
      console.error('Failed to update password:', updateError)
      return res.status(500).json({ error: 'Kunde inte uppdatera lösenordet' })
    }

    // Uppdatera display_name i profiles om det behövs
    if (user.user_metadata?.name) {
      await supabase
        .from('profiles')
        .update({ display_name: user.user_metadata.name })
        .eq('id', user.id)
    }

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
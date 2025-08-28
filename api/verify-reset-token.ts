// api/verify-reset-token.ts - Manuell token-verifiering för lösenordsåterställning
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

  console.log('=== VERIFY RESET TOKEN API START ===')
  console.log('Request timestamp:', new Date().toISOString())

  // Använd Service Key för admin-operationer
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { token, email, newPassword } = req.body
    console.log('Request data received:', { 
      hasToken: !!token,
      email: email,
      passwordLength: newPassword?.length
    })

    // Validera indata
    if (!token || !email || !newPassword) {
      console.log('Missing required fields')
      return res.status(400).json({ error: 'Token, e-post och nytt lösenord krävs' })
    }

    console.log('Finding user by email:', email)

    // Hitta användaren
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      throw new Error('Kunde inte söka efter användare')
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (!user) {
      console.log('User not found for email:', email)
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    console.log('User found:', user.id)

    // Använd getUserById för att få färsk data (undvik cache)
    let userData = user
    try {
      const { data: freshUserData, error: getUserError } = await supabase.auth.admin.getUserById(user.id)
      
      if (getUserError) {
        console.warn('getUserById failed, using cached data:', getUserError.message)
      } else if (freshUserData?.user) {
        console.log('Using fresh user data from getUserById')
        userData = freshUserData.user
      }
    } catch (getUserError) {
      console.warn('getUserById exception, using cached data:', getUserError)
    }

    // Kontrollera token från user_metadata (samma som raw_user_meta_data men konsekvent med reset-password.ts)
    const metadata = userData.user_metadata || {}
    console.log('User metadata keys:', Object.keys(metadata))
    console.log('Has reset_token_hash:', !!metadata.reset_token_hash)
    console.log('Has reset_token_expires_at:', !!metadata.reset_token_expires_at)
    console.log('Debug - checking both metadata sources:')
    console.log('user_metadata:', userData.user_metadata)
    console.log('raw_user_meta_data:', userData.raw_user_meta_data)

    if (!metadata.reset_token_hash || !metadata.reset_token_expires_at) {
      console.log('No reset token found in user metadata')
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    // Kontrollera att token inte har gått ut
    const expiresAt = new Date(metadata.reset_token_expires_at)
    const now = new Date()
    
    console.log('Token expiry check:', {
      expiresAt: expiresAt.toISOString(),
      now: now.toISOString(),
      isExpired: now > expiresAt
    })

    if (now > expiresAt) {
      console.log('Reset token has expired')
      return res.status(400).json({ error: 'Återställningslänken har gått ut' })
    }

    // Verifiera token-hash
    const providedTokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const storedTokenHash = metadata.reset_token_hash
    
    console.log('Token verification:', {
      providedHash: providedTokenHash.substring(0, 16) + '...',
      storedHash: storedTokenHash.substring(0, 16) + '...',
      match: providedTokenHash === storedTokenHash
    })

    if (providedTokenHash !== storedTokenHash) {
      console.log('Token hash mismatch')
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    console.log('Token verified successfully, updating password...')

    // Uppdatera lösenord
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    })

    if (updateError) {
      console.error('Failed to update password:', updateError)
      return res.status(500).json({ error: 'Kunde inte uppdatera lösenordet' })
    }

    console.log('Password updated successfully, clearing reset token...')

    // Rensa reset token från metadata
    const { error: clearTokenError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...metadata,
        reset_token_hash: null,
        reset_token_created_at: null,
        reset_token_expires_at: null
      }
    })

    if (clearTokenError) {
      console.error('Failed to clear reset token:', clearTokenError)
      // Detta är inte kritiskt, så vi fortsätter ändå
    } else {
      console.log('Reset token cleared successfully')
    }

    // Uppdatera display_name i profiles om det behövs
    if (metadata.name) {
      console.log('Updating display_name in profiles...')
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: metadata.name })
        .eq('user_id', user.id)
      
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
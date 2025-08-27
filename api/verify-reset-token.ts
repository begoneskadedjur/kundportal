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

  console.log('=== VERIFY RESET TOKEN API START ===')
  console.log('Request timestamp:', new Date().toISOString())

  // Kontrollera miljövariabler
  if (!SUPABASE_URL) {
    console.error('SUPABASE_URL is not defined')
    return res.status(500).json({ error: 'Server konfigurationsfel - SUPABASE_URL saknas' })
  }
  
  if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_KEY is not defined')
    return res.status(500).json({ error: 'Server konfigurationsfel - SUPABASE_SERVICE_KEY saknas' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  console.log('Supabase client created successfully')

  try {
    const { token, email, newPassword } = req.body
    console.log('Request data received:', { 
      email: email, 
      tokenLength: token?.length, 
      passwordLength: newPassword?.length,
      tokenPreview: token?.substring(0, 8) + '...' // Visa bara början av token för säkerhet
    })

    // Validera indata
    if (!token || !email || !newPassword) {
      console.log('Missing required fields')
      return res.status(400).json({ error: 'Token, e-post och nytt lösenord krävs' })
    }

    // Validera token-format (ska vara exakt 64 hex-tecken)
    const hexRegex = /^[a-f0-9]{64}$/i
    if (!hexRegex.test(token)) {
      console.error('Invalid token format:', { 
        tokenLength: token.length, 
        isHex: /^[a-f0-9]+$/i.test(token),
        tokenSample: token.substring(0, 10) + '...'
      })
      return res.status(400).json({ error: 'Ogiltig återställningslänk - felaktigt token-format' })
    }

    // Validera e-postformat
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email)
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    console.log('Input validation passed')

    // Hasha token för jämförelse
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    console.log('Token hash generated:', { 
      tokenHashLength: tokenHash.length,
      tokenHashPreview: tokenHash.substring(0, 8) + '...'
    })

    // Hämta användare och verifiera token
    console.log('Looking up user by email...')
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      console.error('User not found for email:', email)
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    console.log('User found:', { 
      userId: user.id,
      userEmail: user.email,
      lastSignIn: user.last_sign_in_at,
      updatedAt: user.updated_at
    })

    // Verifiera token och utgångstid
    const storedToken = user.raw_user_meta_data?.reset_token
    const expiresAt = user.raw_user_meta_data?.reset_token_expires

    console.log('Token comparison:', {
      hasStoredToken: !!storedToken,
      storedTokenPreview: storedToken?.substring(0, 8) + '...',
      generatedTokenPreview: tokenHash.substring(0, 8) + '...',
      tokensMatch: storedToken === tokenHash,
      expiresAt: expiresAt,
      currentTime: new Date().toISOString(),
      isExpired: expiresAt ? new Date(expiresAt) < new Date() : 'no_expiry_set'
    })

    if (!storedToken || storedToken !== tokenHash) {
      console.error('Token mismatch or missing stored token')
      return res.status(400).json({ error: 'Ogiltig återställningslänk' })
    }

    if (!expiresAt || new Date(expiresAt) < new Date()) {
      console.error('Token has expired')
      return res.status(400).json({ error: 'Återställningslänken har gått ut' })
    }

    console.log('Token validation successful, proceeding to update password')

    // Uppdatera lösenord och rensa token
    console.log('Updating password and clearing reset token...')
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: {
        ...user.raw_user_meta_data,
        reset_token: null,
        reset_token_expires: null
      }
    })

    if (updateError) {
      console.error('Failed to update password:', updateError)
      return res.status(500).json({ error: 'Kunde inte uppdatera lösenordet' })
    }

    console.log('Password updated successfully, token cleared')

    // Uppdatera display_name i profiles om det behövs
    if (user.raw_user_meta_data?.name) {
      console.log('Updating display_name in profiles...')
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: user.raw_user_meta_data.name })
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
// api/reset-password.ts - Lösenordsåterställning med Supabase inbyggda system
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

  console.log('=== RESET PASSWORD API START (Supabase Auth) ===')
  
  // Använd anon key för resetPasswordForEmail - inte service key
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    const { email } = req.body
    console.log('Password reset request for:', email)

    // 1. Validera e-post
    if (!email) {
      return res.status(400).json({ error: 'E-postadress krävs' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    console.log('Triggering Supabase resetPasswordForEmail...')

    // 2. Använd Supabase inbyggda lösenordsåterställning
    // Detta kommer att trigga vår Edge Function via Email Hook
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/reset-password`
    })

    if (error) {
      console.error('Supabase resetPasswordForEmail error:', error)
      
      // Hantera olika typer av fel
      if (error.message?.includes('rate limit')) {
        return res.status(429).json({
          error: 'För många försök. Vänta innan du begär en ny återställning.'
        })
      }
      
      throw error
    }

    console.log('Supabase resetPasswordForEmail triggered successfully')
    
    // Supabase kommer nu att:
    // 1. Generera säker token
    // 2. Trigga vår Edge Function (send-email)
    // 3. Edge Function skickar vår snygga mail via Resend
    
    return res.status(200).json({
      success: true,
      message: 'Återställningsmail skickat'
    })

  } catch (error: any) {
    console.error('=== RESET PASSWORD API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid lösenordsåterställning'
    })
  }
}
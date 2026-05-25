// api/update-multisite-user-email.ts - Uppdatera e-post för befintlig multisite-användare
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Serverkonfiguration saknas' })
  }

  const { userId, newEmail } = req.body
  if (!userId || !newEmail) {
    return res.status(400).json({ error: 'userId och newEmail krävs' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail)) {
    return res.status(400).json({ error: 'Ogiltig e-postadress' })
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail })
  if (error) {
    console.error('Failed to update user email:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ success: true })
}

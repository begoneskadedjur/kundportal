// api/activate-account.ts
import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

interface ActivateRequestBody {
  token: string
  password: string
}

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    // Validate token (for showing activation form)
    const { token } = req.query
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' })
    }

    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const { data: invitation, error } = await supabaseAdmin
        .from('user_invitations')
        .select('*')
        .eq('activation_token', token)
        .eq('used', false)
        .single()

      if (error || !invitation) {
        return res.status(404).json({ error: 'Invalid or expired token' })
      }

      // Check if token is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Token has expired' })
      }

      return res.status(200).json({ 
        valid: true,
        email: invitation.email,
        companyName: invitation.company_name
      })

    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    // Activate account with password
    try {
      const { token, password }: ActivateRequestBody = req.body

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' })
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      // Find invitation
      const { data: invitation, error: invitationError } = await supabaseAdmin
        .from('user_invitations')
        .select('*')
        .eq('activation_token', token)
        .eq('used', false)
        .single()

      if (invitationError || !invitation) {
        return res.status(404).json({ error: 'Invalid or expired token' })
      }

      // Check if token is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Token has expired' })
      }

      // Update user password and confirm email
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        invitation.user_id,
        {
          password,
          email_confirm: true
        }
      )

      if (updateError) {
        console.error('Failed to update user:', updateError)
        return res.status(500).json({ error: 'Failed to activate account' })
      }

      // Mark invitation as used
      await supabaseAdmin
        .from('user_invitations')
        .update({ 
          used: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', invitation.id)

      // Create customer profile if it doesn't exist
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: invitation.user_id,
          email: invitation.email,
          created_at: new Date().toISOString()
        })

      if (profileError) {
        console.error('Failed to create profile:', profileError)
        // Don't fail the activation for this
      }

      console.log(`✅ Account activated for ${invitation.email}`)

      return res.status(200).json({ 
        success: true,
        message: 'Account activated successfully'
      })

    } catch (error) {
      console.error('Activation error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
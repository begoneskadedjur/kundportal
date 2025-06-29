// api/accept-invitation.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
    console.log('=== ACCEPT INVITATION API START ===')
    
    const { customerId, email, userId } = req.body
    console.log('Accept invitation request:', { customerId, email, userId })

    // 1. Validera inkommande data
    if (!customerId || !email) {
      return res.status(400).json({ error: 'customerId och email är obligatoriska' })
    }

    // 2. Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 3. Hitta inbjudan som ska markeras som accepterad
    const { data: invitation, error: findError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('customer_id', customerId)
      .eq('email', email)
      .single()

    if (findError || !invitation) {
      console.error('Invitation not found:', findError)
      return res.status(404).json({ error: 'Inbjudan hittades inte' })
    }

    // 4. Kontrollera om inbjudan redan är accepterad
    if (invitation.accepted_at) {
      console.log('Invitation already accepted:', invitation.accepted_at)
      return res.status(200).json({
        success: true,
        message: 'Inbjudan redan accepterad',
        acceptedAt: invitation.accepted_at
      })
    }

    // 5. Kontrollera om inbjudan har gått ut
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (expiresAt < now) {
      console.log('Invitation expired:', invitation.expires_at)
      return res.status(400).json({ error: 'Inbjudan har gått ut' })
    }

    // 6. Markera inbjudan som accepterad
    const { data: updatedInvitation, error: updateError } = await supabase
      .from('user_invitations')
      .update({
        accepted_at: now.toISOString(),
        // Uppdatera även invited_by om userId tillhandahålls
        ...(userId && { invited_by: userId })
      })
      .eq('id', invitation.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update invitation error:', updateError)
      return res.status(500).json({ error: 'Kunde inte uppdatera inbjudan' })
    }

    console.log('Invitation accepted successfully:', updatedInvitation.id)

    // 7. Valfritt: Logga aktivitet (för framtida analytics)
    try {
      // Här kan du lägga till logging till en activity_log tabell om du vill
      console.log('Invitation acceptance logged for customer:', customerId)
    } catch (logError) {
      console.error('Logging error (non-critical):', logError)
      // Fortsätt ändå - huvudfunktionen fungerade
    }

    return res.status(200).json({
      success: true,
      message: 'Inbjudan markerad som accepterad',
      acceptedAt: updatedInvitation.accepted_at,
      invitation: {
        id: updatedInvitation.id,
        customer_id: updatedInvitation.customer_id,
        email: updatedInvitation.email,
        accepted_at: updatedInvitation.accepted_at,
        expires_at: updatedInvitation.expires_at
      }
    })

  } catch (error: any) {
    console.error('=== ACCEPT INVITATION API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid acceptering av inbjudan'
    })
  }
}
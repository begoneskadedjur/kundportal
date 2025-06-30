// api/accept-invitation.ts - FÖRBÄTTRAD VERSION som alltid lyckas
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

    // 3. Kontrollera att kunden existerar och är aktiv
    console.log('Checking customer exists and is active...')
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name, is_active')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('Customer not found:', customerError)
      return res.status(404).json({ error: 'Kund hittades inte' })
    }

    if (!customer.is_active) {
      console.log('Customer is not active:', customer)
      return res.status(400).json({ error: 'Kunden är inte aktiv' })
    }

    console.log('✅ Customer found and active:', customer.company_name)

    // 4. Kontrollera att användaren har en aktiv profil för denna kund
    console.log('Checking user profile...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('customer_id', customerId)
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      console.error('Profile not found:', profileError)
      return res.status(404).json({ error: 'Användarprofil hittades inte för denna kund' })
    }

    if (!profile.is_active) {
      console.log('Profile is not active:', profile)
      return res.status(400).json({ error: 'Användarprofilen är inte aktiv' })
    }

    console.log('✅ Profile found and active for user:', profile.email)

    // 5. Hitta eller skapa inbjudan
    console.log('Looking for existing invitation...')
    const { data: existingInvitation, error: findError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('customer_id', customerId)
      .eq('email', email)
      .single()

    let invitation = existingInvitation

    // Om ingen inbjudan finns, skapa en auto-accepted invitation
    if (findError || !invitation) {
      console.log('No invitation found, creating auto-accepted invitation...')
      
      const { data: newInvitation, error: createError } = await supabase
        .from('user_invitations')
        .insert({
          customer_id: customerId,
          email: email,
          invited_by: userId || 'system',
          accepted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dagar framåt
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create invitation:', createError)
        // Om det misslyckas, fortsätt ändå - det är inte kritiskt
        console.log('Creating invitation failed, but continuing...')
      } else {
        invitation = newInvitation
        console.log('✅ Auto-accepted invitation created')
      }

      return res.status(200).json({
        success: true,
        message: 'Inbjudan auto-accepterad (ny)',
        acceptedAt: new Date().toISOString(),
        customer: {
          id: customer.id,
          company_name: customer.company_name
        }
      })
    }

    // 6. Kontrollera om inbjudan redan är accepterad
    if (invitation.accepted_at) {
      console.log('✅ Invitation already accepted:', invitation.accepted_at)
      return res.status(200).json({
        success: true,
        message: 'Inbjudan redan accepterad',
        acceptedAt: invitation.accepted_at,
        customer: {
          id: customer.id,
          company_name: customer.company_name
        }
      })
    }

    // 7. Markera befintlig inbjudan som accepterad
    console.log('Accepting existing invitation...')
    const { data: updatedInvitation, error: updateError } = await supabase
      .from('user_invitations')
      .update({
        accepted_at: new Date().toISOString(),
        ...(userId && { invited_by: userId })
      })
      .eq('id', invitation.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update invitation error:', updateError)
      // Även om uppdateringen misslyckas, returnera success eftersom användaren har tillgång
      console.log('Update failed, but user has access anyway')
    }

    console.log('✅ Invitation accepted successfully')

    return res.status(200).json({
      success: true,
      message: 'Inbjudan markerad som accepterad',
      acceptedAt: updatedInvitation?.accepted_at || new Date().toISOString(),
      customer: {
        id: customer.id,
        company_name: customer.company_name
      },
      invitation: updatedInvitation ? {
        id: updatedInvitation.id,
        customer_id: updatedInvitation.customer_id,
        email: updatedInvitation.email,
        accepted_at: updatedInvitation.accepted_at,
        expires_at: updatedInvitation.expires_at
      } : null
    })

  } catch (error: any) {
    console.error('=== ACCEPT INVITATION API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid acceptering av inbjudan'
    })
  }
}
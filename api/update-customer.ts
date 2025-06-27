// api/update-customer.ts - NY API för säker kunduppdatering
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only PUT allowed
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('=== UPDATE CUSTOMER API START ===')
  console.log('Request body:', JSON.stringify(req.body, null, 2))
  console.log('Headers:', req.headers)

  try {
    const { 
      customer_id,
      contact_person,
      email,
      phone,
      new_password
    } = req.body

    // Validera required fields
    if (!customer_id || !contact_person || !email || !phone) {
      return res.status(400).json({ 
        error: 'customer_id, contact_person, email och phone är obligatoriska' 
      })
    }

    console.log('Uppdaterar kund med ID:', customer_id)

    // 1. Först - hämta nuvarande kunddata för att verifiera att kunden finns
    const { data: existingCustomer, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customer_id)
      .single()

    if (fetchError || !existingCustomer) {
      console.error('Customer not found:', fetchError)
      return res.status(404).json({ error: 'Kunde inte hitta kund' })
    }

    console.log('Befintlig kund hittad:', existingCustomer.company_name)

    // 2. Uppdatera customers tabellen
    const { data: updatedCustomer, error: customerError } = await supabase
      .from('customers')
      .update({
        contact_person: contact_person,
        email: email,
        phone: phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer_id)
      .select()
      .single()

    if (customerError) {
      console.error('Customer update error:', customerError)
      return res.status(500).json({ 
        error: `Kunde inte uppdatera kunduppgifter: ${customerError.message}` 
      })
    }

    console.log('Customer uppdaterad framgångsrikt:', updatedCustomer.id)

    // 3. Hämta användar-ID för auth-uppdateringar
    const { data: profileData, error: profileFetchError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('customer_id', customer_id)
      .single()

    if (profileFetchError) {
      console.warn('Kunde inte hitta profil för auth-uppdatering:', profileFetchError.message)
      // Fortsätt ändå eftersom kunddata är uppdaterat
    } else {
      console.log('Profil hittad för user_id:', profileData.user_id)

      // 4. Uppdatera profil-tabellen
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          email: email,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profileData.user_id)

      if (profileUpdateError) {
        console.warn('Profil-uppdatering misslyckades:', profileUpdateError.message)
        // Fortsätt ändå
      } else {
        console.log('Profil uppdaterad framgångsrikt')
      }

      // 5. Uppdatera lösenord i auth om angivet
      if (new_password && new_password.length >= 6) {
        console.log('Uppdaterar lösenord...')
        
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          profileData.user_id,
          { password: new_password }
        )

        if (passwordError) {
          console.error('Lösenordsuppdatering misslyckades:', passwordError.message)
          return res.status(500).json({ 
            error: `Kunduppgifter uppdaterade men lösenord kunde inte ändras: ${passwordError.message}` 
          })
        } else {
          console.log('Lösenord uppdaterat framgångsrikt')
        }
      }

      // 6. Uppdatera e-post i auth om den ändrats
      if (email !== existingCustomer.email) {
        console.log('Uppdaterar e-post i auth...')
        
        const { error: emailError } = await supabase.auth.admin.updateUserById(
          profileData.user_id,
          { email: email }
        )

        if (emailError) {
          console.warn('E-post uppdatering i auth misslyckades:', emailError.message)
          // Fortsätt ändå eftersom kunddata är uppdaterat
        } else {
          console.log('E-post uppdaterat i auth framgångsrikt')
        }
      }
    }

    console.log('=== UPDATE CUSTOMER API SUCCESS ===')
    return res.status(200).json({
      success: true,
      customer: updatedCustomer,
      message: 'Kunduppgifter har uppdaterats framgångsrikt'
    })

  } catch (error: any) {
    console.error('=== UPDATE CUSTOMER API ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid uppdatering av kunduppgifter'
    })
  }
}
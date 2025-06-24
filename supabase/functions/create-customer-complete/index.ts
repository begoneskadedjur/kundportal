// supabase/functions/create-customer-complete/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Hantera OPTIONS requests för CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Logga request för debugging
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers))

    // Kontrollera att det är POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const body = await req.json()
    console.log('Request body:', body)

    const {
      company_name,
      org_number,
      contact_person,
      email,
      phone,
      address,
      contract_type_id
    } = body

    // Validera alla required fields
    if (!company_name || !org_number || !contact_person || !email || !phone || !address || !contract_type_id) {
      console.error('Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Alla fält måste fyllas i' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Skapa Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Hämta contract type för att få clickup_folder_id
    console.log('Fetching contract type:', contract_type_id)
    const { data: contractType, error: contractError } = await supabaseAdmin
      .from('contract_types')
      .select('clickup_folder_id, name')
      .eq('id', contract_type_id)
      .single()

    if (contractError || !contractType) {
      console.error('Contract type error:', contractError)
      return new Response(
        JSON.stringify({ error: 'Ogiltig avtalstyp' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Contract type found:', contractType)

    // 1. Skapa ClickUp lista
    const clickupApiKey = Deno.env.get('CLICKUP_API_KEY')
    if (!clickupApiKey) {
      console.error('Missing ClickUp API key')
      return new Response(
        JSON.stringify({ error: 'ClickUp configuration missing' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Creating ClickUp list in folder:', contractType.clickup_folder_id)
    
    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/folder/${contractType.clickup_folder_id}/list`,
      {
        method: 'POST',
        headers: {
          'Authorization': clickupApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: company_name,
          content: `Kund: ${company_name}\nOrg.nr: ${org_number}\nKontakt: ${contact_person}\nTelefon: ${phone}\nAdress: ${address}`
        })
      }
    )

    if (!clickupResponse.ok) {
      const errorText = await clickupResponse.text()
      console.error('ClickUp API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Kunde inte skapa ClickUp lista' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const clickupList = await clickupResponse.json()
    console.log('ClickUp list created:', clickupList.id)

    // 2. Skapa kund i databasen
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        company_name,
        org_number,
        contact_person,
        email,
        phone,
        address,
        contract_type_id,
        clickup_list_id: clickupList.id,
        clickup_list_name: clickupList.name,
        is_active: true
      })
      .select()
      .single()

    if (customerError) {
      console.error('Customer creation error:', customerError)
      return new Response(
        JSON.stringify({ error: 'Kunde inte skapa kund i databasen' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Customer created:', customer.id)

    // 3. Skapa användare och skicka inbjudan
    try {
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`
      
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          company_name: company_name,
          contact_person: contact_person
        }
      })

      if (authError) {
        console.error('Auth user creation error:', authError)
        // Fortsätt ändå - kunden är skapad
      } else if (authUser) {
        console.log('Auth user created:', authUser.id)

        // Skapa profil
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: authUser.id,
            user_id: authUser.id,
            customer_id: customer.id,
            email: email,
            is_admin: false,
            is_active: true
          })

        if (profileError) {
          console.error('Profile creation error:', profileError)
        }

        // Skicka inbjudan
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (resendApiKey) {
          const inviteLink = `https://begone-kundportal.vercel.app/set-password?token=${tempPassword}&email=${encodeURIComponent(email)}`
          
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'BeGone Skadedjur <no-reply@resend.dev>',
              to: [email],
              subject: 'Välkommen till BeGone Kundportal',
              html: `
                <h2>Välkommen ${contact_person}!</h2>
                <p>Ditt företag ${company_name} har nu tillgång till BeGone Kundportal.</p>
                <p>Klicka på länken nedan för att sätta ditt lösenord och komma igång:</p>
                <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 6px;">Aktivera ditt konto</a>
                <p>Om länken inte fungerar, kopiera och klistra in denna URL i din webbläsare:</p>
                <p>${inviteLink}</p>
                <p>Med vänliga hälsningar,<br>BeGone Skadedjur</p>
              `
            })
          })

          if (!emailResponse.ok) {
            console.error('Email send error:', await emailResponse.text())
          } else {
            console.log('Invitation email sent')
          }
        }
      }
    } catch (inviteError) {
      console.error('Invitation process error:', inviteError)
      // Fortsätt ändå - kunden är skapad
    }

    // Returnera framgång
    return new Response(
      JSON.stringify({
        success: true,
        customer: customer,
        clickup_list_id: clickupList.id,
        invitation: true
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Ett oväntat fel uppstod' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
// supabase/functions/create-customer-complete/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== CREATE-CUSTOMER-COMPLETE FUNCTION STARTED ===')
    
    // Hämta miljövariabler
    const CLICKUP_API_TOKEN = Deno.env.get('CLICKUP_API_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!CLICKUP_API_TOKEN) {
      throw new Error('CLICKUP_API_TOKEN saknas i Supabase Edge Function Secrets')
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase miljövariabler saknas')
    }

    // Skapa Supabase admin-klient
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Verifiera användaren från Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header saknas')
    }

    // Hämta användaren
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      throw new Error('Ogiltig autentisering')
    }

    console.log('Användare verifierad:', user.id)

    // Kontrollera att användaren är admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      throw new Error('Endast administratörer kan skapa kunder')
    }

    // Läs request body
    const body = await req.json()
    console.log('Request body:', body)
    
    const { 
      company_name,
      org_number,
      contact_person,
      email,
      phone,
      address,
      contract_type_id,
      clickup_folder_id
    } = body

    // Validera input
    if (!company_name || !org_number || !clickup_folder_id) {
      throw new Error('Företagsnamn, organisationsnummer och folder ID krävs')
    }

    // STEG 1: Skapa ClickUp-lista
    console.log('Skapar ClickUp-lista...')
    const listName = `${company_name} - ${org_number}`
    
    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/folder/${clickup_folder_id}/list`,
      {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: listName,
          content: `Kundportal för ${company_name}`,
          priority: 1,
          status: 'active'
        }),
      }
    )

    if (!clickupResponse.ok) {
      const errorText = await clickupResponse.text()
      console.error('ClickUp API fel:', errorText)
      throw new Error(`ClickUp API fel (${clickupResponse.status}): ${errorText}`)
    }

    const clickupList = await clickupResponse.json()
    console.log('ClickUp-lista skapad:', clickupList.id)

    // STEG 2: Spara kund i databasen
    console.log('Sparar kund i databasen...')
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
      console.error('Fel vid kundskapande:', customerError)
      throw customerError
    }

    console.log('Kund skapad:', customer.id)

    // STEG 3: Skapa användarinbjudan
    console.log('Skapar användarinbjudan...')
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        email: email,
        customer_id: customer.id,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Fel vid inbjudan:', inviteError)
      // Vi fortsätter ändå eftersom kunden är skapad
    }

    // STEG 4: Skicka inbjudan via Supabase Auth (om inbjudan skapades)
    if (invitation) {
      console.log('Skickar e-postinbjudan...')
      const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: { 
            customer_id: customer.id,
            invitation_id: invitation.id 
          },
          redirectTo: `${req.headers.get('origin')}/set-password?token=${invitation.token}`
        }
      )

      if (emailError) {
        console.error('Fel vid e-postutskick:', emailError)
      }
    }

    console.log('=== ALLT KLART! ===')
    
    // Returnera lyckat svar
    return new Response(
      JSON.stringify({
        success: true,
        customer,
        invitation,
        clickupList
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('=== FEL I EDGE FUNCTION ===', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400
      }
    )
  }
})
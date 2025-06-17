// supabase/functions/send-invitation/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dessa CORS-headers är bra att ha för testning och standardisering.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Hanterar en eventuell 'preflight'-förfrågan (standard för CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Databas-triggern skickar den nya raden som 'record'
    const { record: invitation } = await req.json()

    if (!invitation || !invitation.email) {
      throw new Error("Inbjudningsdata eller e-post saknas i anropet.")
    }

    // Skapa en Supabase-klient med admin-rättigheter för att kunna bjuda in användare.
    // Dessa miljövariabler är automatiskt tillgängliga i dina deployade funktioner.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Använd Supabase inbyggda funktion för att bjuda in en användare.
    // Detta skapar en användare i auth.users och skickar ett e-postmeddelande
    // baserat på din "Invite user"-mall i Supabase Auth-inställningar.
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      invitation.email,
      { 
        // Du kan skicka med extra data som sparas med användaren
        data: { customer_id: invitation.customer_id } 
      }
    )

    if (error) {
      console.error('Fel vid inbjudan:', error)
      throw error
    }

    // Skicka ett lyckat svar tillbaka
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // Skicka ett felsvar om något går fel
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
// supabase/functions/create-clickup-list/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Mottagen data:", body)

    // Denna funktion gör INGENTING annat än att returnera ett falskt, hårdkodat svar.
    // Vi anropar inte Deno.env eller fetch.
    const dummyResponse = {
      id: 'dummy-list-12345',
      name: `Dummy List för ${body.customerName || 'Okänd'}`,
    }

    return new Response(
      JSON.stringify(dummyResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    // Om något går fel med att läsa request-body, returnera ett fel.
    return new Response(
      JSON.stringify({ error: `Fel i dummy-funktion: ${error.message}` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
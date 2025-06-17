// supabase/functions/create-clickup-list/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- OMFATTANDE FELHANTERING STARTAR HÄR ---
  try {
    // STEG 1: Kontrollera API-nyckeln FÖRST
    const CLICKUP_API_TOKEN = Deno.env.get('CLICKUP_API_TOKEN')
    if (!CLICKUP_API_TOKEN) {
      // Om nyckeln saknas, returnera ett tydligt fel direkt.
      throw new Error('Fel i serverkonfiguration: CLICKUP_API_TOKEN är inte satt i Supabase secrets.')
    }

    // STEG 2: Försök att läsa datan från anropet
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Kunde inte läsa anropets data. Se till att det är giltig JSON.')
    }
    
    const { customerName, orgNumber, folderId } = body;

    // STEG 3: Validera att all nödvändig data finns
    if (!customerName || !orgNumber || !folderId) {
      throw new Error(`Nödvändig data saknas i anropet. Fick: customerName=${customerName}, orgNumber=${orgNumber}, folderId=${folderId}`);
    }

    // STEG 4: Försök att anropa ClickUp API
    let clickupResponse;
    try {
      clickupResponse = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list`, {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `${customerName} - ${orgNumber}` }),
      });
    } catch (e) {
      // Detta fångar nätverksfel, t.ex. om ClickUp API inte kan nås
      throw new Error(`Nätverksfel vid anrop till ClickUp API: ${e.message}`);
    }

    // STEG 5: Kontrollera om ClickUp svarade med ett fel
    if (!clickupResponse.ok) {
      const errorText = await clickupResponse.text();
      throw new Error(`ClickUp API svarade med fel (Status: ${clickupResponse.status}): ${errorText}`);
    }

    // STEG 6: Försök att tolka svaret från ClickUp
    const list = await clickupResponse.json();

    // STEG 7: Allt gick bra! Skicka tillbaka ett lyckat svar.
    return new Response(
      JSON.stringify({ id: list.id, name: list.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    // Detta är vår "catch-all". Om NÅGOT i `try`-blocket ovan misslyckas,
    // hamnar vi här och returnerar ett felsvar istället för att hänga oss.
    console.error('Ett fel inträffade i create-clickup-list:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
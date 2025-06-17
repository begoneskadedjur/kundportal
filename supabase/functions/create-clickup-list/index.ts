// supabase/functions/create-clickup-list/index.ts

// UPPdaterad: Använder en mer modern och stabil version av Deno's standardbibliotek.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Definierar CORS-headers för att tillåta anrop från din webbapp.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Tillåter alla domäner. Byt till din Vercel-URL för ökad säkerhet.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Hanterar CORS "preflight"-förfrågan som webbläsaren skickar först.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Hämtar data som skickats från din frontend.
    const { customerName, orgNumber, folderId } = await req.json()

    // Validering för att säkerställa att nödvändig data finns.
    if (!customerName || !orgNumber || !folderId) {
      throw new Error('customerName, orgNumber, and folderId are required.')
    }

    // Hämtar ClickUp API-nyckel från Supabase secrets.
    const CLICKUP_API_TOKEN = Deno.env.get('CLICKUP_API_TOKEN')
    if (!CLICKUP_API_TOKEN) {
      throw new Error('ClickUp API token is not configured in Supabase secrets.')
    }

    // Skapar listan i ClickUp via deras API.
    const response = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list`, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${customerName} - ${orgNumber}`,
        // content: `Kundportal för ${customerName}`, // Valfri, kan läggas till vid behov
      }),
    })

    // Kontrollerar om ClickUp-anropet misslyckades.
    if (!response.ok) {
      const errorText = await response.text()
      console.error('ClickUp API Error:', errorText) // Loggar felet för enklare felsökning
      throw new Error(`ClickUp API error: ${response.status} ${errorText}`)
    }

    const list = await response.json()

    // Skickar tillbaka ett lyckat svar med den skapade listans data.
    return new Response(
      JSON.stringify({
        id: list.id,
        name: list.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    // Fångar alla fel och skickar ett tydligt felsvar.
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Använder 400 för "Bad Request" eller 500 för "Internal Server Error"
      }
    )
  }
})
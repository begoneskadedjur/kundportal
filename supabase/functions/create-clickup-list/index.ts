// supabase/functions/create-clickup-list/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { customerName, orgNumber, folderId } = await req.json()

    // Get ClickUp API token from environment
    const CLICKUP_API_TOKEN = Deno.env.get('CLICKUP_API_TOKEN')
    if (!CLICKUP_API_TOKEN) {
      throw new Error('ClickUp API token not configured')
    }

    // Create list in ClickUp
    const response = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list`, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${customerName} - ${orgNumber}`,
        content: `Kundportal för ${customerName}`,
        priority: 1,
        status: 'active'
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ClickUp API error: ${error}`)
    }

    const list = await response.json()

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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
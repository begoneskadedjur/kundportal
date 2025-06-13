import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Testing ClickUp connection...')
    
    // Kontrollera att API token finns
    if (!process.env.CLICKUP_API_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'ClickUp API token not configured',
        environment: {
          hasClickUpToken: false,
          hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
        }
      })
    }

    console.log('ClickUp API Token found, testing connection...')
    
    // Test ClickUp API connection med bättre error handling
    const response = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': process.env.CLICKUP_API_TOKEN!,
        'Content-Type': 'application/json'
      }
    })

    console.log('ClickUp API Response Status:', response.status)
    console.log('ClickUp API Response Headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ClickUp API Error Response:', errorText)
      throw new Error(`ClickUp API error: ${response.status} - ${response.statusText}. Response: ${errorText}`)
    }

    let data
    try {
      const responseText = await response.text()
      console.log('Raw ClickUp Response (first 500 chars):', responseText.substring(0, 500))
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError)
      return res.status(500).json({
        success: false,
        error: 'Failed to parse ClickUp API response as JSON',
        details: parseError.message
      })
    }

    console.log('ClickUp teams found:', data.teams?.length || 0)
    
    // Returnera grundläggande info först för att säkerställa att det fungerar
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      clickup: {
        connected: true,
        teams: data.teams?.map(team => ({
          id: team.id,
          name: team.name
        })) || [],
        spaces: [], // Tomt för nu, vi bygger ut steg för steg
        folders: [],
        lists: []
      },
      debug: {
        apiTokenPresent: !!process.env.CLICKUP_API_TOKEN,
        responseStatus: response.status,
        teamsCount: data.teams?.length || 0
      },
      environment: {
        hasClickUpToken: !!process.env.CLICKUP_API_TOKEN,
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      },
      message: 'ClickUp basic connection test successful!'
    })
    
  } catch (error) {
    console.error('ClickUp test error:', error)
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      environment: {
        hasClickUpToken: !!process.env.CLICKUP_API_TOKEN,
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      }
    })
  }
}
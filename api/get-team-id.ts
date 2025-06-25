// api/get-team-id.ts - Hämta ditt ClickUp Team ID
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔍 Fetching ClickUp teams...')
    
    const response = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ClickUp API error:', response.status, errorText)
      return res.status(response.status).json({
        error: 'Failed to fetch teams',
        details: errorText
      })
    }

    const data = await response.json()
    console.log('✅ Teams fetched successfully:', data)

    // Extrahera team information
    const teams = data.teams || []
    const teamInfo = teams.map((team: any) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      avatar: team.avatar,
      members: team.members?.length || 0
    }))

    return res.status(200).json({
      success: true,
      teams: teamInfo,
      rawData: data // För debugging
    })

  } catch (error) {
    console.error('❌ Error fetching teams:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
import { VercelRequest, VercelResponse } from '@vercel/node'

// Hjälpfunktion för att göra fetch-anrop till ClickUp
const clickupFetch = async (endpoint: string, token: string) => {
  const response = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`ClickUp API Error for endpoint ${endpoint}:`, errorText)
    throw new Error(`ClickUp API error: ${response.status} - ${response.statusText}`)
  }

  return response.json()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.CLICKUP_API_TOKEN
  if (!token) {
    return res.status(500).json({ success: false, error: 'ClickUp API token not configured on the server.' })
  }

  try {
    console.log('Initiating ClickUp data fetch...')

    // Steg 1: Hämta Team ID
    const teamData = await clickupFetch('/team', token)
    const team = teamData.teams?.[0]
    if (!team) {
      return res.status(404).json({ success: false, error: 'No ClickUp team found.' })
    }
    console.log(`Found team: "${team.name}" (ID: ${team.id})`)

    // Steg 2: Hämta alla Spaces i teamet
    const spacesData = await clickupFetch(`/team/${team.id}/space`, token)
    const spaces = spacesData.spaces || []
    console.log(`Found ${spaces.length} spaces. Fetching lists and folders...`)

    let allLists = []

    // Steg 3 & 4: Hämta alla listor från alla spaces (både i folders och direkt i space)
    for (const space of spaces) {
      // Hämta listor som ligger direkt i space:n
      const spaceListsData = await clickupFetch(`/space/${space.id}/list`, token)
      if (spaceListsData.lists) {
        allLists.push(...spaceListsData.lists)
      }

      // Hämta folders i space:n
      const foldersData = await clickupFetch(`/space/${space.id}/folder`, token)
      const folders = foldersData.folders || []
      
      // Hämta listor inuti varje folder
      for (const folder of folders) {
        const folderListsData = await clickupFetch(`/folder/${folder.id}/list`, token)
        if (folderListsData.lists) {
          allLists.push(...folderListsData.lists)
        }
      }
    }

    console.log(`Total lists found across all spaces: ${allLists.length}`)

    return res.status(200).json({
      success: true,
      message: `Successfully fetched ${allLists.length} lists from ClickUp.`,
      team: { id: team.id, name: team.name },
      lists: allLists.map(list => ({
        id: list.id,
        name: list.name,
        folder: list.folder, // Innehåller mappens namn och id
        space: list.space,   // Innehåller spacens namn och id
      })),
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Full error in /api/test/clickup:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}
import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Testing ClickUp connection...')
    
    // Test ClickUp API connection
    const response = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': process.env.CLICKUP_API_TOKEN!,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log('ClickUp teams found:', data.teams?.length || 0)
    
    // Get more detailed info for first team
    let spacesInfo = []
    let listsInfo = []
    
    if (data.teams && data.teams.length > 0) {
      const teamId = data.teams[0].id
      
      // Get spaces
      const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space`, {
        headers: {
          'Authorization': process.env.CLICKUP_API_TOKEN!,
          'Content-Type': 'application/json'
        }
      })
      
      if (spacesResponse.ok) {
        const spacesData = await spacesResponse.json()
        spacesInfo = spacesData.spaces || []
        
        // Get lists from first space
        if (spacesInfo.length > 0) {
          const spaceId = spacesInfo[0].id
          
          // Get folderless lists
          const listsResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list`, {
            headers: {
              'Authorization': process.env.CLICKUP_API_TOKEN!,
              'Content-Type': 'application/json'
            }
          })
          
          if (listsResponse.ok) {
            const listsData = await listsResponse.json()
            listsInfo = listsData.lists || []
          }
          
          // Get folders with lists
          const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/folder`, {
            headers: {
              'Authorization': process.env.CLICKUP_API_TOKEN!,
              'Content-Type': 'application/json'
            }
          })
          
          if (foldersResponse.ok) {
            const foldersData = await foldersResponse.json()
            const folders = foldersData.folders || []
            
            // Add lists from folders
            folders.forEach(folder => {
              if (folder.lists) {
                listsInfo.push(...folder.lists)
              }
            })
          }
        }
      }
    }
    
    // Return comprehensive test results
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      clickup: {
        connected: true,
        teams: data.teams?.map(team => ({
          id: team.id,
          name: team.name
        })) || [],
        spaces: spacesInfo.map(space => ({
          id: space.id,
          name: space.name
        })),
        lists: listsInfo.map(list => ({
          id: list.id,
          name: list.name,
          folder: list.folder?.name || 'No folder'
        }))
      },
      environment: {
        hasClickUpToken: !!process.env.CLICKUP_API_TOKEN,
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      },
      message: 'ClickUp connection test successful!'
    })
    
  } catch (error) {
    console.error('ClickUp test error:', error)
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      environment: {
        hasClickUpToken: !!process.env.CLICKUP_API_TOKEN,
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      }
    })
  }
}
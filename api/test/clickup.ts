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
    let foldersInfo = []
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
        
        // Get folders and lists from first space
        if (spacesInfo.length > 0) {
          const spaceId = spacesInfo[0].id
          console.log(`Checking space: ${spacesInfo[0].name} (${spaceId})`)
          
          // Get folders with their lists
          const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/folder`, {
            headers: {
              'Authorization': process.env.CLICKUP_API_TOKEN!,
              'Content-Type': 'application/json'
            }
          })
          
          if (foldersResponse.ok) {
            const foldersData = await foldersResponse.json()
            const folders = foldersData.folders || []
            
            console.log(`Found ${folders.length} folders`)
            
            // Process each folder
            folders.forEach(folder => {
              console.log(`Folder: ${folder.name} (${folder.id})`)
              
              foldersInfo.push({
                id: folder.id,
                name: folder.name,
                lists: folder.lists?.map(list => ({
                  id: list.id,
                  name: list.name
                })) || []
              })
              
              // Add lists from folders to main lists array
              if (folder.lists) {
                folder.lists.forEach(list => {
                  listsInfo.push({
                    id: list.id,
                    name: list.name,
                    folder: folder.name,
                    folderId: folder.id
                  })
                })
              }
            })
          } else {
            console.log('Failed to fetch folders:', await foldersResponse.text())
          }
          
          // Get folderless lists
          const listsResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list`, {
            headers: {
              'Authorization': process.env.CLICKUP_API_TOKEN!,
              'Content-Type': 'application/json'
            }
          })
          
          if (listsResponse.ok) {
            const listsData = await listsResponse.json()
            const folderlessLists = listsData.lists || []
            
            console.log(`Found ${folderlessLists.length} folderless lists`)
            
            // Add folderless lists
            folderlessLists.forEach(list => {
              listsInfo.push({
                id: list.id,
                name: list.name,
                folder: 'No folder',
                folderId: null
              })
            })
          }
        }
      }
    }
    
    // Log important information for debugging
    console.log('\n=== FOLDER MAPPING INFORMATION ===')
    console.log('Folders found:')
    foldersInfo.forEach(folder => {
      console.log(`  - ${folder.name}: ${folder.id} (${folder.lists.length} lists)`)
    })
    
    console.log('\nContract types that need mapping:')
    const contractTypes = [
      'Avrop - 2.490kr',
      'Betongstationer', 
      'Betesstationer',
      'Mekaniska råttfällor',
      'Skadedjursavtal',
      'Avloppsfällor',
      'Fågelavtal'
    ]
    contractTypes.forEach(type => {
      console.log(`  - ${type}`)
    })
    
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
        folders: foldersInfo,
        lists: listsInfo
      },
      mapping: {
        contractTypes: contractTypes,
        foldersFound: foldersInfo.map(f => ({ id: f.id, name: f.name })),
        needsMapping: contractTypes.length > 0 && foldersInfo.length > 0
      },
      environment: {
        hasClickUpToken: !!process.env.CLICKUP_API_TOKEN,
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      },
      message: 'ClickUp connection test successful! Check console for folder mapping information.'
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
// api/find-begone-lists.ts - Hitta alla listor i BeGone teamet
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { team_id } = req.query

  try {
    // Om inget team_id anges, hämta alla team först
    let teams = []
    if (!team_id) {
      const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })

      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json()
        teams = teamsData.teams || []
      }
    }

    // Hitta BeGone team eller använd angivet team_id
    const targetTeamId = team_id || teams.find((t: any) => 
      t.name.toLowerCase().includes('begone')
    )?.id

    if (!targetTeamId) {
      return res.status(400).json({
        error: 'Kunde inte hitta BeGone team',
        available_teams: teams.map((t: any) => ({ id: t.id, name: t.name })),
        usage: 'Använd ?team_id=YOUR_TEAM_ID om du vet team ID'
      })
    }

    // Hämta alla spaces för teamet
    const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${targetTeamId}/space`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!spacesResponse.ok) {
      throw new Error(`Failed to fetch spaces: ${spacesResponse.statusText}`)
    }

    const spacesData = await spacesResponse.json()
    const allLists: any[] = []

    // För varje space, hämta folders och listor
    for (const space of spacesData.spaces || []) {
      try {
        const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/folder`, {
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json'
          }
        })

        if (foldersResponse.ok) {
          const foldersData = await foldersResponse.json()
          
          for (const folder of foldersData.folders || []) {
            // Hämta listor för varje folder
            const listsResponse = await fetch(`https://api.clickup.com/api/v2/folder/${folder.id}/list`, {
              headers: {
                'Authorization': CLICKUP_API_TOKEN,
                'Content-Type': 'application/json'
              }
            })

            if (listsResponse.ok) {
              const listsData = await listsResponse.json()
              
              listsData.lists?.forEach((list: any) => {
                allLists.push({
                  id: list.id,
                  name: list.name,
                  folder_name: folder.name,
                  space_name: space.name,
                  task_count: list.task_count,
                  url: `https://app.clickup.com/${targetTeamId}/v/li/${list.id}`
                })
              })
            }
          }
        }

        // Hämta också listor direkt under space (utan folder)
        const spaceListsResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/list`, {
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json'
          }
        })

        if (spaceListsResponse.ok) {
          const spaceListsData = await spaceListsResponse.json()
          
          spaceListsData.lists?.forEach((list: any) => {
            allLists.push({
              id: list.id,
              name: list.name,
              folder_name: 'Ingen folder',
              space_name: space.name,
              task_count: list.task_count,
              url: `https://app.clickup.com/${targetTeamId}/v/li/${list.id}`
            })
          })
        }

      } catch (error) {
        console.error(`Error processing space ${space.name}:`, error)
      }
    }

    // Hitta specifikt "Privatperson" och "Företag" listor
    const privatpersonList = allLists.find(l => l.name.toLowerCase().includes('privatperson'))
    const foretagList = allLists.find(l => l.name.toLowerCase().includes('företag'))

    return res.status(200).json({
      success: true,
      team_id: targetTeamId,
      total_lists: allLists.length,
      target_lists: {
        privatperson: privatpersonList || 'Inte hittad',
        foretag: foretagList || 'Inte hittad'
      },
      all_lists: allLists.sort((a, b) => a.name.localeCompare(b.name)),
      next_step: privatpersonList && foretagList ? 
        `Kör /api/map-clickup-fields?privatperson_id=${privatpersonList.id}&foretag_id=${foretagList.id}` :
        'Hitta rätt list IDs manuellt från ClickUp'
    })

  } catch (error: any) {
    return res.status(500).json({
      error: 'Kunde inte hämta ClickUp listor',
      details: error.message
    })
  }
}
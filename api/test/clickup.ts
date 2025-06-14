import { VercelRequest, VercelResponse } from '@vercel/node';

// Hjälpfunktion för att göra fetch-anrop till ClickUp
const clickupFetch = async (endpoint: string, token: string) => {
  const response = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`ClickUp API Error for endpoint ${endpoint}:`, errorText);
    throw new Error(`ClickUp API error: ${response.status} - ${response.statusText}`);
  }
  
  return response.json();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    return res.status(500).json({ success: false, error: 'ClickUp API token not configured on the server.' });
  }
  
  try {
    console.log('Initiating ClickUp data fetch...');
    
    // Steg 1: Hämta Team ID
    const teamData = await clickupFetch('/team', token);
    const team = teamData.teams?.[0];
    if (!team) {
      return res.status(404).json({ success: false, error: 'No ClickUp team found.' });
    }
    console.log(`Found team: "${team.name}" (ID: ${team.id})`);
    
    // Steg 2: Hämta alla Spaces i teamet
    const spacesData = await clickupFetch(`/team/${team.id}/space`, token);
    const spaces = spacesData.spaces || [];
    console.log(`Found ${spaces.length} spaces.`);
    
    // Steg 3: Hämta folders och listor för varje space
    const spaceDetails = await Promise.all(
      spaces.map(async (space: any) => {
        // Hämta folders
        const foldersData = await clickupFetch(`/space/${space.id}/folder`, token);
        const folders = foldersData.folders || [];
        
        // Hämta listor direkt under space (folderless lists)
        const folderlessListsData = await clickupFetch(`/space/${space.id}/list`, token);
        const folderlessLists = folderlessListsData.lists || [];
        
        // Hämta listor för varje folder
        const foldersWithLists = await Promise.all(
          folders.map(async (folder: any) => {
            const folderListsData = await clickupFetch(`/folder/${folder.id}/list`, token);
            return {
              id: folder.id,
              name: folder.name,
              lists: folderListsData.lists || []
            };
          })
        );
        
        return {
          id: space.id,
          name: space.name,
          folders: foldersWithLists,
          folderlessLists: folderlessLists
        };
      })
    );
    
    // Formatera resultatet för enkel läsning
    const formattedResult = {
      success: true,
      message: 'Successfully fetched ClickUp workspace structure',
      team: {
        id: team.id,
        name: team.name
      },
      spaces: spaceDetails.map(space => ({
        id: space.id,
        name: space.name,
        folders: space.folders.map((folder: any) => ({
          id: folder.id,
          name: folder.name,
          listCount: folder.lists.length,
          lists: folder.lists.map((list: any) => ({
            id: list.id,
            name: list.name
          }))
        })),
        folderlessLists: space.folderlessLists.map((list: any) => ({
          id: list.id,
          name: list.name
        }))
      })),
      timestamp: new Date().toISOString()
    };
    
    // Lägg till en sammanfattning
    const totalFolders = spaceDetails.reduce((sum, space) => sum + space.folders.length, 0);
    const totalLists = spaceDetails.reduce((sum, space) => {
      const folderLists = space.folders.reduce((folderSum: number, folder: any) => folderSum + folder.lists.length, 0);
      return sum + folderLists + space.folderlessLists.length;
    }, 0);
    
    return res.status(200).json({
      ...formattedResult,
      summary: {
        totalSpaces: spaces.length,
        totalFolders: totalFolders,
        totalLists: totalLists
      }
    });
    
  } catch (error) {
    console.error('Full error in /api/test/clickup:', error);
    
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}
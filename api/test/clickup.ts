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
    console.log(`Found ${spaces.length} spaces. Fetching lists and folders...`);

    // Använder Promise.all för att göra anropen snabbare och parallellt
    const listPromises = spaces.flatMap(space => [
      clickupFetch(`/space/${space.id}/list`, token), // Hämta listor direkt i space
      clickupFetch(`/space/${space.id}/folder`, token).then(folderData => {
        const folderPromises = (folderData.folders || []).map(folder => 
          clickupFetch(`/folder/${folder.id}/list`, token)
        );
        return Promise.all(folderPromises);
      })
    ]);

    const results = await Promise.all(listPromises);
    
    // Platta ut den nästlade arrayen av listor
    const allLists = results.flat(2).flatMap(listData => listData.lists || []);

    console.log(`Total lists found across all spaces: ${allLists.length}`);

    return res.status(200).json({
      success: true,
      message: `Successfully fetched ${allLists.length} lists from ClickUp.`,
      team: { id: team.id, name: team.name },
      lists: allLists.map((list: any) => ({ // lagt till any för att undvika type-errors på list
        id: list.id,
        name: list.name,
        folder: list.folder,
        space: list.space,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Full error in /api/test/clickup:', error);
    
    // FIX: Hantera 'unknown' typ för error-objektet
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
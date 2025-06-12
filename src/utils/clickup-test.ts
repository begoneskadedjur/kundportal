const CLICKUP_TOKEN = import.meta.env.VITE_CLICKUP_API_TOKEN;

// Testa ClickUp anslutning
export const testClickUpConnection = async () => {
  try {
    // 1. Hämta teams
    const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': CLICKUP_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const teamsData = await teamsResponse.json();
    console.log('Teams:', teamsData);
    
    if (teamsData.teams && teamsData.teams.length > 0) {
      const teamId = teamsData.teams[0].id;
      
      // 2. Hämta spaces för första teamet
      const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space`, {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      const spacesData = await spacesResponse.json();
      console.log('Spaces:', spacesData);
      
      if (spacesData.spaces && spacesData.spaces.length > 0) {
        const spaceId = spacesData.spaces[0].id;
        
        // 3. Hämta folders/lists
        const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/folder`, {
          headers: {
            'Authorization': CLICKUP_TOKEN,
            'Content-Type': 'application/json'
          }
        });
        
        const foldersData = await foldersResponse.json();
        console.log('Folders:', foldersData);
        
        // 4. Hämta folderless lists
        const listsResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list`, {
          headers: {
            'Authorization': CLICKUP_TOKEN,
            'Content-Type': 'application/json'
          }
        });
        
        const listsData = await listsResponse.json();
        console.log('Lists:', listsData);
      }
    }
  } catch (error) {
    console.error('ClickUp API Error:', error);
  }
};
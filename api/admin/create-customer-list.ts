import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdminService } from '../../src/lib/supabase-admin.js';

// Mappning mellan contract_type_id och folder IDs
const CONTRACT_TYPE_TO_FOLDER: { [key: string]: string } = {
  '21ed7bc7-e767-48e3-b981-4305b1ae7141': '90122895234',  // Betongstationer
  '242dff01-ecff-4de1-ab5f-7fad11cb8812': '90125272072',  // Skadedjursavtal
  '37eeca21-f8b3-45f7-810a-7f616f84e71e': '90124483870',  // Mekaniska råttfällor
  '3d749768-63be-433f-936d-be070edf4876': '90122872190',  // Avrop - 2.490kr
  '73c7c42b-a302-4da2-abf2-8d6080045bc8': '90125556108',  // Fågelavtal
  'bc612355-b6ce-4ca8-82cd-4f82a8538b71': '90125348422',  // Avloppsfällor
  'e3a610c9-15b9-42fe-8085-d0a7e17d4465': '90124483434',  // Betesstationer
  'default': '127553498'                                    // Ärenden (default)
};

// Hjälpfunktion för att göra ClickUp API-anrop
const clickupFetch = async (endpoint: string, options: any = {}) => {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    throw new Error('ClickUp API token not configured');
  }

  const response = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    ...options,
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`ClickUp API Error: ${response.status}`, errorText);
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  return response.json();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerId, customerName, contractTypeId } = req.body;

    if (!customerId || !customerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Bestäm vilken folder att använda baserat på contract_type_id
    const folderId = CONTRACT_TYPE_TO_FOLDER[contractTypeId] || CONTRACT_TYPE_TO_FOLDER['default'];
    
    console.log(`Creating list for customer: ${customerName} in folder: ${folderId}`);

    // Skapa ny lista i ClickUp
    const listData = await clickupFetch(`/folder/${folderId}/list`, {
      method: 'POST',
      body: JSON.stringify({
        name: customerName,
        content: `Ärenden för ${customerName}`,
        due_date: false,
        priority: 3,
        status: {
          status: 'active',
          color: '#2ecc71',
          hide_label: false
        }
      })
    });

    console.log(`Created ClickUp list: ${listData.id} - ${listData.name}`);

    // Uppdatera kunden i databasen med ClickUp list ID
    const { error: updateError } = await supabaseAdminService.supabase
      .from('customers')
      .update({ 
        clickup_list_id: listData.id,
        clickup_list_name: listData.name
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer with ClickUp list ID:', updateError);
      // Vi fortsätter ändå eftersom listan är skapad
    }

    return res.status(200).json({
      success: true,
      message: `Successfully created ClickUp list for ${customerName}`,
      listId: listData.id,
      listName: listData.name,
      folderId: folderId
    });

  } catch (error) {
    console.error('Error creating customer list:', error);
    
    let errorMessage = 'Failed to create ClickUp list';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}
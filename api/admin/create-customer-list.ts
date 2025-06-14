// Sökväg: /api/admin/create-customer-list.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
// Vi behöver bara den direkta admin-klienten nu
import { supabaseAdmin } from '../../src/lib/supabase-admin';

// Hjälpfunktion för att anropa ClickUp API. Denna är bra och kan behållas.
async function clickupFetch(endpoint: string, options: RequestInit) {
  const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!CLICKUP_API_TOKEN) {
    throw new Error("Miljövariabeln CLICKUP_API_TOKEN är inte satt.");
  }

  const response = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': CLICKUP_API_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`ClickUp API Error (${response.status}):`, errorBody);
    throw new Error(`ClickUp API error: ${response.status}`);
  }
  return response.json();
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { customerId, customerName, contractTypeId } = req.body;

    // Validera att vi har all information vi behöver
    if (!customerId || !customerName || !contractTypeId) {
      return res.status(400).json({ success: false, error: 'Saknar obligatoriska fält: customerId, customerName, contractTypeId' });
    }

    // --- STEG 1: Hämta ClickUp Folder ID dynamiskt från databasen ---
    const { data: contractType, error: dbError } = await supabaseAdmin
      .from('contract_types')
      .select('clickup_folder_id')
      .eq('id', contractTypeId)
      .single();

    // Hantera fel om mappningen saknas i databasen
    if (dbError || !contractType || !contractType.clickup_folder_id) {
      console.error(`Kunde inte hitta en konfigurerad ClickUp Folder ID för avtalstyp: ${contractTypeId}`, dbError);
      return res.status(404).json({ success: false, error: 'Ingen ClickUp-mapp är konfigurerad för denna avtalstyp.' });
    }

    const targetFolderId = contractType.clickup_folder_id;
    console.log(`Hittade ClickUp Folder ID: ${targetFolderId} för avtalstyp ${contractTypeId}`);

    // --- STEG 2: Skapa listan i rätt mapp på ClickUp ---
    const listData = {
      name: customerName,
      // Du kan lägga till mer konfiguration här om du vill
    };

    const createdList = await clickupFetch(`/folder/${targetFolderId}/list`, {
      method: 'POST',
      body: JSON.stringify(listData),
    });

    console.log(`Skapade ClickUp-lista "${createdList.name}" med ID: ${createdList.id}`);
    
    // --- STEG 3: Uppdatera kund-posten i databasen med det nya list-ID:t ---
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({ 
        clickup_list_id: createdList.id,
        clickup_list_name: createdList.name,
      })
      .eq('id', customerId);

    if (updateError) {
      // Logga felet men fortsätt, eftersom det viktigaste (att listan skapades) är klart
      console.warn(`Misslyckades att uppdatera kund ${customerId} med ClickUp-info:`, updateError.message);
    }

    // --- STEG 4: Skicka ett framgångsrikt svar ---
    return res.status(200).json({
      success: true,
      message: `ClickUp-lista för ${customerName} skapades.`,
      listId: createdList.id,
      listName: createdList.name,
    });

  } catch (error: any) {
    console.error('Allvarligt fel vid skapande av ClickUp-lista:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
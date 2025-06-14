// Sökväg: /api/admin/create-customer.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdminService, supabaseAdmin } from '../../src/lib/supabase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { company_name, org_number, contact_person, email, phone, address, contract_type_id } = req.body;

    if (!company_name || !email || !contract_type_id) {
      return res.status(400).json({ success: false, error: 'Fälten företagsnamn, e-post och avtalstyp är obligatoriska.' });
    }

    // --- Steg 1: Skapa kunden i databasen ---
    const { data: customer, error: customerError } = await supabaseAdminService.createCustomer({
      company_name, org_number, contact_person, email, phone, address, contract_type_id
    });

    if (customerError) {
      console.error('Database Error:', customerError.message);
      if (customerError.code === '23505') {
        return res.status(409).json({ success: false, error: `En kund med detta namn eller e-postadress finns redan.` });
      }
      return res.status(500).json({ success: false, error: `Databasfel: ${customerError.message}` });
    }
    console.log(`[Success] Customer created in DB: ${customer.id}`);

    // --- Steg 2: Skapa Auth-användare och hantera om den redan finns ---
    try {
      // Försök skapa användaren.
      const { error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          full_name: contact_person || company_name,
          company_name: company_name,
          customer_id: customer.id
        }
      });

      // Kontrollera felet.
      if (authError) {
        // Om felet är specifikt "User already exists", är det OK. Vi loggar det och fortsätter.
        if (authError.message.includes('User already exists')) {
          console.log(`[Info] Auth user for ${email} already exists. Continuing.`);
        } else {
          // Om det är något annat fel, kasta det så att processen avbryts.
          throw new Error(`Kunde inte skapa användarkonto: ${authError.message}`);
        }
      } else {
        console.log(`[Success] Auth user created for ${email}`);
      }

      // Oavsett vad, skicka en "sätt lösenord"-länk.
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: email });

      if (resetError) {
        console.warn(`[Warning] Password set email failed for ${email}:`, resetError.message);
      } else {
        console.log(`[Success] "Set password" link sent to: ${email}`);
      }
    } catch (authProcessError: any) {
      console.error('[Fatal] Auth process error:', authProcessError.message);
      return res.status(500).json({ success: false, error: authProcessError.message });
    }
    
    // --- Steg 3: Skapa ClickUp-lista ---
    try {
      const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const response = await fetch(`${vercelUrl}/api/admin/create-customer-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.company_name,
          contractTypeId: customer.contract_type_id
        })
      });

      const listResult = await response.json();
      
      if (listResult.success) {
        console.log(`[Success] ClickUp list created: ${listResult.listId}`);
        await supabaseAdminService.updateCustomerWithClickUpInfo(customer.id, {
          listId: listResult.listId,
          listName: listResult.listName
        });
      } else {
        console.warn('[Warning] ClickUp integration failed:', listResult.error);
      }
    } catch (clickupError: any) {
      console.warn('[Warning] ClickUp integration error:', clickupError.message);
    }
    
    // --- Steg 4: Allt klart! ---
    return res.status(200).json({ success: true, message: 'Kund skapad framgångsrikt!' });

  } catch (error: any) {
    console.error('[Fatal] Unhandled Create Customer Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Ett okänt serverfel inträffade.' });
  }
}
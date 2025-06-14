// Sökväg: /api/admin/create-customer.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdminService, supabaseAdmin } from '../../src/lib/supabase-admin';
import { PostgrestError } from '@supabase/supabase-js';

// Definiera en typ för felet från getUserByEmail för bättre felhantering
interface UserError extends PostgrestError {
    status?: number;
}

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

    // --- Steg 2: Skapa Auth-användare (OM DEN INTE FINNS) och skicka lösenordslänk ---
    try {
      // KORRIGERAD RAD: Byt från getUserByEmail till getUserByEmail
      const { data: { user: existingAuthUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email) as { data: { user: any }, error: UserError | null };

      if (getUserError && getUserError.status !== 404) {
          throw new Error(`Fel vid kontroll av befintlig användare: ${getUserError.message}`);
      }

      if (existingAuthUser) {
        console.log(`[Info] Auth user for ${email} already exists. Skipping creation.`);
      } else {
        const { error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          email_confirm: true,
          user_metadata: {
            full_name: contact_person || company_name,
            company_name: company_name,
            customer_id: customer.id
          }
        });
        if (authError) throw new Error(`Kunde inte skapa användarkonto: ${authError.message}`);
        console.log(`[Success] Auth user created for ${email}`);
      }

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
// Sökväg: /api/admin/create-customer.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdminService, supabaseAdmin } from '../../src/lib/supabase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Säkerställ att anropet är en POST-request
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // 2. Hämta data från request body
    const {
      company_name,
      org_number,
      contact_person,
      email,
      phone,
      address,
      contract_type_id
    } = req.body;

    // 3. Validera att obligatoriska fält finns med
    if (!company_name || !email || !contract_type_id) {
      return res.status(400).json({ success: false, error: 'Fälten företagsnamn, e-post och avtalstyp är obligatoriska.' });
    }

    // --- Steg 1: Skapa kunden i databasen ---
    const { data: customer, error: customerError } = await supabaseAdminService.createCustomer({
      company_name,
      org_number,
      contact_person,
      email,
      phone,
      address,
      contract_type_id
    });

    // Hantera fel från databasen (t.ex. om kunden redan finns)
    if (customerError) {
      console.error('Database Error:', customerError.message);
      if (customerError.code === '23505') { // Unikhetsfel
        return res.status(409).json({ success: false, error: `En kund med detta namn eller e-postadress finns redan.` });
      }
      return res.status(500).json({ success: false, error: `Databasfel: ${customerError.message}` });
    }
    console.log(`[Success] Customer created in DB: ${customer.id}`);

    // --- Steg 2: Skapa Auth-användare och skicka en "sätt lösenord"-länk ---
    try {
      // Först, skapa användaren via admin-API.
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true, // Sätt till true direkt, eftersom vi litar på e-posten
        user_metadata: {
          full_name: contact_person || company_name,
          company_name: company_name,
          customer_id: customer.id
        }
      });

      if (authError) {
        // Om detta misslyckas är det allvarligt, så vi avbryter.
        throw new Error(`Kunde inte skapa användarkonto: ${authError.message}`);
      }
      console.log(`[Success] Auth user created: ${authData.user.id}`);

      // Omedelbart efter, generera en "recovery"-länk. Supabase skickar då ut
      // "Password Recovery"-mailet, som fungerar som en "sätt lösenord"-länk för nya användare.
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email
      });

      if (resetError) {
        // Detta är inte lika kritiskt, så vi loggar bara en varning och fortsätter.
        console.warn(`[Warning] "Set password" email failed for ${email}:`, resetError.message);
      } else {
        console.log(`[Success] "Set password" link sent to: ${email}`);
      }
    } catch (authProcessError: any) {
      // Fånga allvarliga fel från auth-processen (som att användaren redan finns i Auth) och stoppa flödet.
      console.error('[Fatal] Auth process error:', authProcessError.message);
      // Valfritt: Radera kunden som skapades i databasen för att undvika osynk.
      // await supabaseAdmin.from('customers').delete().eq('id', customer.id);
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
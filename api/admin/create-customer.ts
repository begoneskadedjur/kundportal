// Sökväg: /api/admin/create-customer.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
// Importera BÅDE service-klassen och den direkta admin-klienten från din biblioteksfil
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
    // Använd den dedikerade metoden från din service-klass för att hålla koden ren
    const { data: customer, error: customerError } = await supabaseAdminService.createCustomer({
      company_name,
      org_number,
      contact_person,
      email,
      phone,
      address,
      contract_type_id
    });

    // Hantera fel från databasen
    if (customerError) {
      console.error('Database Error:', customerError.message);
      if (customerError.code === '23505') { // "unique_violation"
        return res.status(409).json({ success: false, error: `En kund med detta namn eller e-postadress finns redan.` });
      }
      return res.status(500).json({ success: false, error: `Databasfel: ${customerError.message}` });
    }
    console.log(`[Success] Customer created in DB: ${customer.id}`);

    // --- Steg 2: Bjud in användaren till Supabase Auth ---
    // Använd den direkta `supabaseAdmin`-klienten för auth-operationer
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { customer_id: customer.id, company_name: customer.company_name, full_name: contact_person || company_name }
    });
    
    if (inviteError) {
      // Logga som en varning, men stoppa inte hela processen
      console.warn(`[Warning] Auth Invite Error for ${email}:`, inviteError.message);
    } else {
      console.log(`[Success] Auth invite sent to: ${email}`);
    }

    // --- Steg 3: Anropa API:et för att skapa en ClickUp-lista ---
    try {
      // Konstruera URL:en korrekt för Vercel och lokal utveckling
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
        // Använd service-metoden för att uppdatera kunden med ClickUp-info
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
    
    // --- Steg 4: Allt klart! Skicka ett framgångsrikt svar ---
    return res.status(200).json({ success: true, message: 'Kund skapad framgångsrikt!' });

  } catch (error: any) {
    console.error('[Fatal] Unhandled Create Customer Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Ett okänt serverfel inträffade.' });
  }
}
// Sökväg: /api/admin/create-customer.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdminService, supabaseAdmin } from '../../src/lib/supabase-admin';

// Hjälpfunktion för ClickUp, direkt i denna fil.
async function clickupFetch(endpoint: string, options: RequestInit) {
  const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!CLICKUP_API_TOKEN) throw new Error("Miljövariabeln CLICKUP_API_TOKEN är inte satt.");

  const response = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': CLICKUP_API_TOKEN, ...options.headers },
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
    
    // --- Steg 2: Skapa ClickUp-lista (Flyttad hit för att undvika timeout) ---
    try {
      const { data: contractType } = await supabaseAdmin
        .from('contract_types').select('clickup_folder_id').eq('id', contract_type_id).single();
      
      if (!contractType || !contractType.clickup_folder_id) {
        throw new Error(`Ingen ClickUp-mapp är konfigurerad för avtalstyp ${contract_type_id}`);
      }
      
      const createdList = await clickupFetch(`/folder/${contractType.clickup_folder_id}/list`, {
        method: 'POST',
        body: JSON.stringify({ name: customer.company_name }),
      });

      console.log(`[Success] ClickUp list created: ${createdList.id}`);
      await supabaseAdminService.updateCustomerWithClickUpInfo(customer.id, {
        listId: createdList.id,
        listName: createdList.name
      });
    } catch (clickupError: any) {
      console.warn('[Warning] ClickUp integration error:', clickupError.message);
      // Fortsätt ändå, admin kan skapa listan manuellt.
    }

    // --- Steg 3: Bjud in användare med inviteUserByEmail ---
    let inviteLink: string | null = null;
    let emailSent = false;

    try {
      // Bestäm redirect URL
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      const redirectTo = `${siteUrl}/activate-account`;

      console.log(`[Info] Using redirect URL: ${redirectTo}`);

      // Använd inviteUserByEmail som skapar användare OCH skickar inbjudan
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectTo,
          data: {
            full_name: contact_person || company_name,
            company_name: company_name,
            customer_id: customer.id,
            needs_password_setup: true
          }
        }
      );

      if (inviteError) {
        console.error(`[Error] inviteUserByEmail failed: ${inviteError.message}`);
        
        // Om användaren redan finns, försök med generateLink istället
        if (inviteError.message.includes('already registered')) {
          console.log('[Info] User already exists, generating invite link instead...');
          
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: {
              redirectTo: redirectTo,
              data: {
                full_name: contact_person || company_name,
                company_name: company_name,
                customer_id: customer.id,
                needs_password_setup: true
              }
            }
          });

          if (linkError) {
            throw new Error(`Kunde inte skapa inbjudningslänk: ${linkError.message}`);
          }

          inviteLink = linkData?.properties?.action_link || null;
          console.log(`[Success] Invite link generated for existing user`);
        } else {
          throw new Error(`Kunde inte skicka inbjudan: ${inviteError.message}`);
        }
      } else {
        emailSent = true;
        console.log(`[Success] Invite email sent to: ${email}`);
        
        // Om inviteData innehåller en länk, spara den som backup
        if (inviteData?.user?.confirmation_token) {
          inviteLink = `${siteUrl}/activate-account#access_token=${inviteData.user.confirmation_token}&type=invite`;
        }
      }

      // Logga i user_invitations-tabellen
      await supabaseAdmin.from('user_invitations').insert({ 
        email, 
        customer_id: customer.id,
        invited_at: new Date().toISOString()
      });
      console.log(`[Success] Invitation logged in database`);

    } catch (authProcessError: any) {
      console.error('[Error] Invite process error:', authProcessError.message);
      
      // Om vi redan skapat kunden, returnera framgång men med varning
      return res.status(200).json({ 
        success: true, 
        warning: `Kund skapad men inbjudan misslyckades: ${authProcessError.message}`,
        customer,
        requiresManualInvite: true
      });
    }
    
    // Returnera framgångsmeddelande med extra info om behövs
    return res.status(200).json({ 
      success: true, 
      message: emailSent 
        ? 'Kund skapad och inbjudan skickad!' 
        : 'Kund skapad! Inbjudan kan vara försenad.',
      customer,
      emailSent,
      recoveryLink: inviteLink, // Använder samma fältnamn för bakåtkompatibilitet
      debugInfo: {
        emailMethod: 'inviteUserByEmail',
        redirectUrl: redirectTo
      }
    });

  } catch (error: any) {
    console.error('[Fatal] Unhandled Create Customer Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Ett okänt serverfel inträffade.' 
    });
  }
}
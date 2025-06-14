import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdminService } from '../../src/lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      company_name,
      org_number,
      contact_person,
      email,
      phone,
      address,
      contract_type_id
    } = req.body;

    // Validera required fields
    if (!company_name || !email || !contract_type_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: company_name, email, contract_type_id' 
      });
    }

    console.log(`Creating customer: ${company_name}`);

    // Steg 1: Skapa kunden i databasen
    const { data: customer, error: customerError } = await supabaseAdminService.supabase
      .from('customers')
      .insert({
        company_name,
        org_number,
        contact_person,
        email,
        phone,
        address,
        contract_type_id,
        is_active: true
      })
      .select()
      .single();

    if (customerError) {
      console.error('Error creating customer:', customerError);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    console.log(`Customer created with ID: ${customer.id}`);

    // Steg 2: Skapa auth-användare och skicka inbjudan
    try {
      // Skapa användare i Supabase Auth
      const { data: authUser, error: authError } = await supabaseAdminService.supabase.auth.admin.createUser({
        email: email,
        email_confirm: false,
        user_metadata: {
          full_name: contact_person || company_name,
          company_name: company_name,
          customer_id: customer.id
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        // Fortsätt ändå, kunden är skapad
      } else {
        console.log(`Auth user created: ${authUser.user.id}`);

        // Skicka inbjudan via email
        const { error: inviteError } = await supabaseAdminService.supabase.auth.admin.inviteUserByEmail(email, {
          data: {
            customer_id: customer.id,
            company_name: company_name
          }
        });

        if (inviteError) {
          console.error('Error sending invite:', inviteError);
        } else {
          console.log(`Invite sent to: ${email}`);
        }

        // Koppla auth user till customer
        const { error: profileError } = await supabaseAdminService.supabase
          .from('profiles')
          .insert({
            id: authUser.user.id,
            email: email,
            customer_id: customer.id
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }
    } catch (authError) {
      console.error('Auth process error:', authError);
      // Fortsätt ändå
    }

    // Steg 3: Skapa ClickUp-lista
    try {
      const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/admin/create-customer-list`, {
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
        console.log(`ClickUp list created: ${listResult.listId}`);
        
        // Uppdatera kunden med ClickUp list info
        await supabaseAdminService.supabase
          .from('customers')
          .update({
            clickup_list_id: listResult.listId,
            clickup_list_name: listResult.listName
          })
          .eq('id', customer.id);
      } else {
        console.error('Failed to create ClickUp list:', listResult.error);
      }
    } catch (clickupError) {
      console.error('ClickUp integration error:', clickupError);
      // Fortsätt ändå
    }

    // Hämta den uppdaterade kunden
    const { data: updatedCustomer } = await supabaseAdminService.supabase
      .from('customers')
      .select('*, contract_types(*)')
      .eq('id', customer.id)
      .single();

    return res.status(200).json({
      success: true,
      message: 'Customer created successfully',
      customer: updatedCustomer,
      inviteSent: true
    });

  } catch (error) {
    console.error('Create customer error:', error);
    
    let errorMessage = 'Failed to create customer';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}
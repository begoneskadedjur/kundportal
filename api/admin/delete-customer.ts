// Sökväg: /api/admin/delete-customer.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../src/lib/supabase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { customerId, email } = req.body;

    if (!customerId || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer ID och email krävs' 
      });
    }

    console.log(`[Delete Customer] Starting deletion for customer ${customerId}, email: ${email}`);

    // Steg 1: Ta bort alla visits för kundens cases
    const { error: visitsError } = await supabaseAdmin
      .from('visits')
      .delete()
      .in('case_id', 
        supabaseAdmin
          .from('cases')
          .select('id')
          .eq('customer_id', customerId)
      );

    if (visitsError && visitsError.code !== 'PGRST116') {
      console.error('Error deleting visits:', visitsError);
    }

    // Steg 2: Ta bort alla cases för kunden
    const { error: casesError } = await supabaseAdmin
      .from('cases')
      .delete()
      .eq('customer_id', customerId);

    if (casesError && casesError.code !== 'PGRST116') {
      console.error('Error deleting cases:', casesError);
    }

    // Steg 3: Ta bort från user_invitations
    const { error: invitationsError } = await supabaseAdmin
      .from('user_invitations')
      .delete()
      .eq('customer_id', customerId);

    if (invitationsError && invitationsError.code !== 'PGRST116') {
      console.error('Error deleting invitations:', invitationsError);
    }

    // Steg 4: Ta bort profile
    // Först, hitta user_id från profiles baserat på customer_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('customer_id', customerId)
      .single();

    if (profile?.user_id) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', profile.user_id);

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error deleting profile:', profileError);
      }

      // Steg 5: Ta bort auth-användaren
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
        profile.user_id
      );

      if (authError) {
        console.error('Error deleting auth user:', authError);
        // Fortsätt ändå, auth-användaren kanske redan är borttagen
      } else {
        console.log(`[Success] Auth user deleted: ${profile.user_id}`);
      }
    }

    // Steg 6: Slutligen, ta bort kunden
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (customerError) {
      throw new Error(`Kunde inte ta bort kund: ${customerError.message}`);
    }

    console.log(`[Success] Customer ${customerId} and all related data deleted`);

    return res.status(200).json({ 
      success: true, 
      message: 'Kund och all relaterad data har tagits bort' 
    });

  } catch (error: any) {
    console.error('[Fatal] Delete Customer Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Ett okänt fel inträffade vid borttagning' 
    });
  }
}
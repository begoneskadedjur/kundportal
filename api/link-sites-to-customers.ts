import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Hämta alla organization_sites som saknar customer_id
    const { data: sites, error: sitesError } = await supabase
      .from('organization_sites')
      .select('*')
      .is('customer_id', null)
    
    if (sitesError) throw sitesError
    
    if (!sites || sites.length === 0) {
      return res.status(200).json({ 
        message: 'Alla sites är redan kopplade till customers',
        updatedCount: 0 
      })
    }
    
    const updates = []
    
    for (const site of sites) {
      // Skapa en ny customer för varje site
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company_name: site.site_name,
          org_number: `SITE-${site.id.substring(0, 8)}`, // Generera ett unikt org-nummer
          address: site.address,
          postal_code: site.postal_code,
          city: site.city,
          contact_person: site.contact_person,
          contact_email: site.contact_email,
          contact_phone: site.contact_phone,
          contract_type: 'multisite',
          is_active: site.is_active,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (customerError) {
        console.error('Error creating customer for site:', site.site_name, customerError)
        continue
      }
      
      // Uppdatera site med customer_id
      const { error: updateError } = await supabase
        .from('organization_sites')
        .update({ 
          customer_id: newCustomer.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', site.id)
      
      if (updateError) {
        console.error('Error updating site:', site.site_name, updateError)
        continue
      }
      
      updates.push({
        site_id: site.id,
        site_name: site.site_name,
        customer_id: newCustomer.id
      })
    }
    
    return res.status(200).json({ 
      message: `Kopplade ${updates.length} sites till customers`,
      updates: updates
    })
    
  } catch (error: any) {
    console.error('Error in link-sites-to-customers:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to link sites to customers' 
    })
  }
}
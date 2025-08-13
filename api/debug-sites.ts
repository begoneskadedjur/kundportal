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
    
    // Check existing sites
    const { data: existingSites, error: checkError } = await supabase
      .from('organization_sites')
      .select('*')
      .eq('organization_id', 'b3099b45-d0a7-450a-a407-55361b50e416')
    
    if (checkError) {
      throw checkError
    }
    
    // If no sites exist, create them
    if (!existingSites || existingSites.length === 0) {
      const testSites = [
        {
          organization_id: 'b3099b45-d0a7-450a-a407-55361b50e416',
          site_name: 'Huvudkontoret Stockholm',
          address: 'Kungsgatan 45',
          postal_code: '11156',
          city: 'Stockholm',
          region: 'Stockholm',
          contact_person: 'Anna Andersson',
          contact_email: 'anna@espresso900.se',
          contact_phone: '08-1234567',
          is_active: true
        },
        {
          organization_id: 'b3099b45-d0a7-450a-a407-55361b50e416',
          site_name: 'Filial Göteborg',
          address: 'Avenyn 12',
          postal_code: '41136',
          city: 'Göteborg',
          region: 'Väst',
          contact_person: 'Bengt Bengtsson',
          contact_email: 'bengt@espresso900.se',
          contact_phone: '031-9876543',
          is_active: true
        },
        {
          organization_id: 'b3099b45-d0a7-450a-a407-55361b50e416',
          site_name: 'Filial Malmö',
          address: 'Storgatan 8',
          postal_code: '21142',
          city: 'Malmö',
          region: 'Syd',
          contact_person: 'Cecilia Carlsson',
          contact_email: 'cecilia@espresso900.se',
          contact_phone: '040-5555555',
          is_active: true
        },
        {
          organization_id: 'b3099b45-d0a7-450a-a407-55361b50e416',
          site_name: 'Lager Uppsala',
          address: 'Industrivägen 23',
          postal_code: '75323',
          city: 'Uppsala',
          region: 'Stockholm',
          contact_person: 'David Davidsson',
          contact_email: 'david@espresso900.se',
          contact_phone: '018-444444',
          is_active: true
        }
      ]
      
      const { data: newSites, error: insertError } = await supabase
        .from('organization_sites')
        .insert(testSites)
        .select()
      
      if (insertError) {
        throw insertError
      }
      
      return res.status(200).json({ 
        message: 'Sites created successfully',
        sites: newSites 
      })
    }
    
    return res.status(200).json({ 
      message: 'Sites already exist',
      sites: existingSites 
    })
    
  } catch (error: any) {
    console.error('Error in debug-sites:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to debug sites' 
    })
  }
}
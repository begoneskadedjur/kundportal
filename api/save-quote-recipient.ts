// api/save-quote-recipient.ts - Save multisite quote recipient after successful quote creation
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface SaveRecipientRequest {
  quote_id: string
  recipient: {
    role: string
    userId?: string
    label: string
    sites?: any[]
    organization_id: string
  }
  organization_id: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { quote_id, recipient, organization_id } = req.body as SaveRecipientRequest

    if (!quote_id || !recipient || !organization_id) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    console.log('Saving quote recipient:', {
      quote_id,
      recipient_role: recipient.role,
      organization_id
    })

    // Prepare site_ids based on recipient role
    let siteIds: string[] = []
    let region: string | null = null

    if (recipient.role === 'platsansvarig') {
      // For platschef, would need specific site logic here
      siteIds = [] // This would need to be populated based on the specific site
    } else if (recipient.role === 'regionchef') {
      // For regionchef, use the sites from the recipient data
      if (recipient.sites && Array.isArray(recipient.sites)) {
        siteIds = recipient.sites.map((site: any) => site.id || site)
      }
      region = 'Huddinge' // This could be extracted from recipient data
    } else if (recipient.role === 'verksamhetschef') {
      // For verksamhetschef, get all sites in organization
      const { data: orgSites } = await supabase
        .from('organization_sites')
        .select('id')
        .eq('organization_id', organization_id)
      
      siteIds = orgSites?.map(site => site.id) || []
    }

    const { error } = await supabase
      .from('quote_recipients')
      .insert({
        quote_id,
        source_type: 'case',
        organization_id,
        recipient_role: recipient.role,
        site_ids: siteIds,
        region,
        is_active: true
      })

    if (error) {
      console.error('Error saving quote recipient:', error)
      return res.status(500).json({ message: 'Database error', error: error.message })
    }

    console.log('✅ Quote recipient saved successfully')
    return res.status(200).json({ success: true })

  } catch (error: any) {
    console.error('Error in save-quote-recipient:', error)
    return res.status(500).json({ message: 'Internal server error', error: error.message })
  }
}
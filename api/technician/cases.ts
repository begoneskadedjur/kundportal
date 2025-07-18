// 📁 api/technician/cases.ts - UPPDATERAD MED UUID-BASERAD SÖKNING  
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { technician_id, limit = '50' } = req.query

  if (!technician_id) {
    return res.status(400).json({ error: 'technician_id is required' })
  }

  try {
    console.log('🔄 Fetching technician cases for UUID:', technician_id)

    const limitNum = parseInt(limit as string) || 50

    // ✅ DIREKT UUID-SÖKNING - INGEN NAMN-LOOKUP BEHÖVS
    const [privateCases, businessCases] = await Promise.all([
      // Private cases med UUID
      supabase
        .from('private_cases')
        .select(`
          id, clickup_task_id, title, status, priority, created_date, completed_date,
          commission_amount, pris as case_price, kontaktperson, telefon, email, adress,
          skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .order('created_date', { ascending: false })
        .limit(limitNum),

      // Business cases med UUID
      supabase
        .from('business_cases')
        .select(`
          id, clickup_task_id, title, status, priority, created_date, completed_date,
          commission_amount, pris as case_price, kontaktperson, telefon, email, adress,
          foretag, org_nr, skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .order('created_date', { ascending: false })
        .limit(limitNum)
    ])

    // Kombinera och märk med typ
    const allCases = [
      ...(privateCases.data || []).map(c => ({ 
        ...c, 
        case_type: 'private' as const,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(businessCases.data || []).map(c => ({ 
        ...c, 
        case_type: 'business' as const,
        case_number: `B-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      }))
    ]

    // Sortera efter skapandedatum
    allCases.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())

    // Begränsa till önskat antal
    const limitedCases = allCases.slice(0, limitNum)

    // Beräkna statistik
    const totalCases = allCases.length
    const completedCases = allCases.filter(c => c.completed_date).length
    const pendingCases = allCases.filter(c => !c.completed_date && c.status?.toLowerCase() !== 'completed').length
    const inProgressCases = allCases.filter(c => 
      !c.completed_date && 
      (c.status?.toLowerCase().includes('progress') || c.status?.toLowerCase().includes('pågående'))
    ).length
    const totalCommission = allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    // Hämta tekniker-namn för display (efter all beräkning)
    const { data: technician } = await supabase
      .from('technicians')
      .select('name')
      .eq('id', technician_id)
      .single()

    const stats = {
      total_cases: totalCases,
      completed_cases: completedCases,
      pending_cases: pendingCases,
      in_progress_cases: inProgressCases,
      total_commission: totalCommission
    }

    console.log(`✅ Cases fetched for UUID ${technician_id}:`, {
      total: totalCases,
      returned: limitedCases.length,
      commission: totalCommission
    })

    res.status(200).json({
      cases: limitedCases,
      stats,
      technician_name: technician?.name || 'Okänd tekniker',
      total_found: totalCases,
      returned: limitedCases.length
    })

  } catch (error) {
    console.error('Error fetching technician cases:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
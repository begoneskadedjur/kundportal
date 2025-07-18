// api/technician/cases.ts - API för tekniker-ärenden
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
    // Hämta tekniker info
    const { data: technician } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    if (!technician) {
      return res.status(404).json({ error: 'Tekniker hittades inte' })
    }

    const limitNum = parseInt(limit as string) || 50

    // Hämta private cases
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select(`
        id, clickup_task_id, title, status, priority, created_date, completed_date,
        commission_amount, case_price, kontaktperson, telefon, email, adress,
        skadedjur, beskrivning, billing_status
      `)
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .order('created_date', { ascending: false })
      .limit(limitNum)

    // Hämta business cases
    const { data: businessCases } = await supabase
      .from('business_cases')
      .select(`
        id, clickup_task_id, title, status, priority, created_date, completed_date,
        commission_amount, case_price, kontaktperson, telefon, email, adress,
        foretag, org_nr, skadedjur, beskrivning, billing_status
      `)
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .order('created_date', { ascending: false })
      .limit(limitNum)

    // Kombinera och märk med typ
    const allCases = [
      ...(privateCases || []).map(c => ({ 
        ...c, 
        case_type: 'private' as const,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(businessCases || []).map(c => ({ 
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

    const stats = {
      total_cases: totalCases,
      completed_cases: completedCases,
      pending_cases: pendingCases,
      in_progress_cases: inProgressCases,
      total_commission: totalCommission
    }

    res.status(200).json({
      cases: limitedCases,
      stats,
      technician_name: technician.name,
      total_found: totalCases,
      returned: limitedCases.length
    })

  } catch (error) {
    console.error('Error fetching technician cases:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
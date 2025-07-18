// api/technician/commissions/cases.ts - API för tekniker provisionsärenden per månad
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { technician_id, month } = req.query

  if (!technician_id || !month) {
    return res.status(400).json({ error: 'technician_id and month are required' })
  }

  // Validera månadsformat (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month as string)) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' })
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

    const monthStr = month as string
    const startDate = `${monthStr}-01`
    const endDate = `${monthStr}-31`

    // Hämta private cases för månaden
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select(`
        id, clickup_task_id, title, commission_amount, case_price, completed_date,
        kontaktperson, telefon, email, adress, skadedjur, beskrivning, billing_status
      `)
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .not('commission_amount', 'is', null)
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .order('completed_date', { ascending: false })

    // Hämta business cases för månaden
    const { data: businessCases } = await supabase
      .from('business_cases')
      .select(`
        id, clickup_task_id, title, commission_amount, case_price, completed_date,
        kontaktperson, telefon, email, adress, foretag, org_nr, skadedjur, beskrivning, billing_status
      `)
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .not('commission_amount', 'is', null)
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .order('completed_date', { ascending: false })

    // Kombinera och formatera
    const cases = [
      ...(privateCases || []).map(c => ({
        ...c,
        type: 'private' as const,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(businessCases || []).map(c => ({
        ...c,
        type: 'business' as const,
        case_number: `B-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      }))
    ]

    // Sortera efter datum (senaste först)
    cases.sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())

    // Beräkna sammanfattning för månaden
    const totalCommission = cases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const totalCasePrice = cases.reduce((sum, c) => sum + (c.case_price || 0), 0)
    const privateCommission = cases
      .filter(c => c.type === 'private')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const businessCommission = cases
      .filter(c => c.type === 'business')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    const summary = {
      total_commission: totalCommission,
      total_case_price: totalCasePrice,
      case_count: cases.length,
      private_commission: privateCommission,
      business_commission: businessCommission,
      private_count: cases.filter(c => c.type === 'private').length,
      business_count: cases.filter(c => c.type === 'business').length,
      avg_commission_per_case: cases.length > 0 ? totalCommission / cases.length : 0
    }

    res.status(200).json({
      cases,
      summary,
      month: monthStr,
      technician_name: technician.name
    })

  } catch (error) {
    console.error('Error fetching month commission cases:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
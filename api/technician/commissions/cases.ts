// 📁 api/technician/commissions/cases.ts - UPPDATERAD MED UUID-BASERAD SÖKNING
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
    console.log(`🔄 Fetching month commission cases for UUID: ${technician_id}, month: ${month}`)

    const monthStr = month as string
    const startDate = `${monthStr}-01`
    const endDate = `${monthStr}-31`

    // ✅ DIREKT UUID-SÖKNING - INGEN NAMN-LOOKUP BEHÖVS
    const [privateCases, businessCases] = await Promise.all([
      // Private cases för månaden med UUID
      supabase
        .from('private_cases')
        .select(`
          id, clickup_task_id, title, commission_amount, pris as case_price, completed_date,
          kontaktperson, telefon, email, adress, skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .gte('completed_date', startDate)
        .lte('completed_date', endDate)
        .order('completed_date', { ascending: false }),

      // Business cases för månaden med UUID
      supabase
        .from('business_cases')
        .select(`
          id, clickup_task_id, title, commission_amount, pris as case_price, completed_date,
          kontaktperson, telefon, email, adress, foretag, org_nr, skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .gte('completed_date', startDate)
        .lte('completed_date', endDate)
        .order('completed_date', { ascending: false })
    ])

    // Kombinera och formatera
    const cases = [
      ...(privateCases.data || []).map(c => ({
        ...c,
        type: 'private' as const,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(businessCases.data || []).map(c => ({
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

    // Hämta tekniker-namn för display (efter all beräkning)
    const { data: technician } = await supabase
      .from('technicians')
      .select('name')
      .eq('id', technician_id)
      .single()

    console.log(`✅ Month commission cases fetched for UUID ${technician_id}:`, {
      month: monthStr,
      cases: cases.length,
      total_commission: totalCommission
    })

    res.status(200).json({
      cases,
      summary,
      month: monthStr,
      technician_name: technician?.name || 'Okänd tekniker'
    })

  } catch (error) {
    console.error('Error fetching month commission cases:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
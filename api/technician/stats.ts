// 📁 api/technician/stats.ts - UPPDATERAD MED UUID-BASERAD SÖKNING
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { technician_id } = req.query

  if (!technician_id) {
    return res.status(400).json({ error: 'technician_id is required' })
  }

  try {
    console.log('🔄 Fetching technician stats for UUID:', technician_id)

    // Nuvarande år och månad
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // ✅ DIREKT UUID-SÖKNING - INGEN NAMN-MATCHNING
    const [privateCases, businessCases, pendingPrivate, pendingBusiness] = await Promise.all([
      // YTD Private cases med UUID
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date, pris')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .gte('completed_date', `${currentYear}-01-01`),

      // YTD Business cases med UUID  
      supabase
        .from('business_cases')
        .select('commission_amount, completed_date, pris')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .gte('completed_date', `${currentYear}-01-01`),

      // Pågående private cases
      supabase
        .from('private_cases')
        .select('id')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .is('completed_date', null),

      // Pågående business cases
      supabase
        .from('business_cases')
        .select('id')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .is('completed_date', null)
    ])

    // Kombinera alla ärenden
    const allCases = [...(privateCases.data || []), ...(businessCases.data || [])]

    // Beräkna statistik
    const totalCommissionYtd = allCases.reduce((sum, case_) => sum + (case_.commission_amount || 0), 0)
    const totalCasesYtd = allCases.length

    // Denna månad
    const currentMonthCases = allCases.filter(case_ => 
      case_.completed_date?.startsWith(currentMonth)
    )
    const currentMonthCommission = currentMonthCases.reduce((sum, case_) => sum + (case_.commission_amount || 0), 0)

    // Pågående ärenden
    const pendingCases = (pendingPrivate.data?.length || 0) + (pendingBusiness.data?.length || 0)

    // Genomsnittlig provision per ärende
    const avgCommissionPerCase = totalCasesYtd > 0 ? totalCommissionYtd / totalCasesYtd : 0

    // Hämta tekniker-namn för display (efter all beräkning)
    const { data: technician } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    const stats = {
      total_commission_ytd: totalCommissionYtd,
      total_cases_ytd: totalCasesYtd,
      avg_commission_per_case: avgCommissionPerCase,
      current_month_commission: currentMonthCommission,
      pending_cases: pendingCases,
      completed_cases_this_month: currentMonthCases.length,
      technician_name: technician?.name || 'Okänd tekniker',
      technician_email: technician?.email || ''
    }

    console.log(`✅ Stats calculated for UUID ${technician_id}:`, {
      total_commission: totalCommissionYtd,
      total_cases: totalCasesYtd,
      pending: pendingCases
    })

    res.status(200).json(stats)

  } catch (error) {
    console.error('Error fetching technician stats:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
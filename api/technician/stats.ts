// api/technician/stats.ts - API för tekniker-statistik
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
    // Hämta tekniker info för att få namnet
    const { data: technician } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    if (!technician) {
      return res.status(404).json({ error: 'Tekniker hittades inte' })
    }

    // Nuvarande år
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Beräkna provisioner från private_cases (namn-matchning)
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('commission_amount, completed_date, case_price')
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .not('commission_amount', 'is', null)
      .gte('completed_date', `${currentYear}-01-01`)

    // Beräkna provisioner från business_cases (namn-matchning)
    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('commission_amount, completed_date, case_price')
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .not('commission_amount', 'is', null)
      .gte('completed_date', `${currentYear}-01-01`)

    // Kombinera alla ärenden
    const allCases = [...(privateCases || []), ...(businessCases || [])]

    // Beräkna statistik
    const totalCommissionYtd = allCases.reduce((sum, case_) => sum + (case_.commission_amount || 0), 0)
    const totalCasesYtd = allCases.length

    // Denna månad
    const currentMonthCases = allCases.filter(case_ => 
      case_.completed_date?.startsWith(currentMonth)
    )
    const currentMonthCommission = currentMonthCases.reduce((sum, case_) => sum + (case_.commission_amount || 0), 0)

    // Pågående ärenden (utan completed_date)
    const { data: pendingPrivate } = await supabase
      .from('private_cases')
      .select('id')
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .is('completed_date', null)

    const { data: pendingBusiness } = await supabase
      .from('business_cases')
      .select('id')
      .ilike('primary_assignee_name', `%${technician.name}%`)
      .is('completed_date', null)

    const pendingCases = (pendingPrivate?.length || 0) + (pendingBusiness?.length || 0)

    // Genomsnittlig provision per ärende
    const avgCommissionPerCase = totalCasesYtd > 0 ? totalCommissionYtd / totalCasesYtd : 0

    const stats = {
      total_commission_ytd: totalCommissionYtd,
      total_cases_ytd: totalCasesYtd,
      avg_commission_per_case: avgCommissionPerCase,
      current_month_commission: currentMonthCommission,
      pending_cases: pendingCases,
      completed_cases_this_month: currentMonthCases.length,
      technician_name: technician.name,
      technician_email: technician.email
    }

    res.status(200).json(stats)

  } catch (error) {
    console.error('Error fetching technician stats:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
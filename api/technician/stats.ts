// 📁 api/technician/stats.ts - FÖRBÄTTRAD MED DEBUG OCH ROBUST HANTERING
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../_lib/auth'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Död endpoint utan UI-anropare - låst till admin (säkerhetsaudit juni 2026)
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  const { technician_id } = req.query

  if (!technician_id) {
    return res.status(400).json({ error: 'technician_id is required' })
  }

  try {
    console.log('🔄 Fetching technician stats for UUID:', technician_id)

    // Nuvarande år och månad
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    console.log(`📅 Calculating stats for year: ${currentYear}, current month: ${currentMonth}`)

    // ✅ DIREKT UUID-SÖKNING - INGEN NAMN-MATCHNING
    const [privateCases, businessCases, pendingPrivate, pendingBusiness] = await Promise.all([
      // YTD Private cases med UUID
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date, pris, start_date, status')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .gte('completed_date', `${currentYear}-01-01`),

      // YTD Business cases med UUID  
      supabase
        .from('business_cases')
        .select('commission_amount, completed_date, pris, start_date, status')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .gte('completed_date', `${currentYear}-01-01`),

      // Pågående private cases
      supabase
        .from('private_cases')
        .select('id, status, start_date')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .is('completed_date', null),

      // Pågående business cases
      supabase
        .from('business_cases')
        .select('id, status, start_date')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .is('completed_date', null)
    ])

    // ✅ DEBUG: Logga vad vi faktiskt hittar
    console.log('🔍 YTD Private cases result:', {
      data_length: privateCases.data?.length || 0,
      error: privateCases.error?.message,
      sample_case: privateCases.data?.[0] ? {
        commission_amount: privateCases.data[0].commission_amount,
        completed_date: privateCases.data[0].completed_date,
        status: privateCases.data[0].status
      } : null
    })

    console.log('🔍 YTD Business cases result:', {
      data_length: businessCases.data?.length || 0,
      error: businessCases.error?.message,
      sample_case: businessCases.data?.[0] ? {
        commission_amount: businessCases.data[0].commission_amount,
        completed_date: businessCases.data[0].completed_date,
        status: businessCases.data[0].status
      } : null
    })

    console.log('🔍 Pending cases result:', {
      pending_private: pendingPrivate.data?.length || 0,
      pending_business: pendingBusiness.data?.length || 0,
      private_error: pendingPrivate.error?.message,
      business_error: pendingBusiness.error?.message
    })

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
      pending: pendingCases,
      current_month_commission: currentMonthCommission,
      current_month_cases: currentMonthCases.length,
      avg_per_case: avgCommissionPerCase
    })

    // ✅ EXTRA DEBUG om stats verkar låga jämfört med förväntningar
    if (totalCasesYtd === 0) {
      console.log('⚠️ NO YTD STATS FOUND - checking for data without commission...')
      
      // Kolla om det finns cases för tekniker utan commission filter
      const debugCheck = await supabase
        .from('private_cases')
        .select('id, title, start_date, completed_date, commission_amount, status, primary_assignee_name')
        .eq('primary_assignee_id', technician_id)
        .limit(10)
      
      console.log('🔍 Debug check - all cases for technician:', debugCheck.data)
      
      // Kolla också för completed cases without commission
      const completedCheck = await supabase
        .from('private_cases')
        .select('id, title, completed_date, commission_amount, pris')
        .eq('primary_assignee_id', technician_id)
        .not('completed_date', 'is', null)
        .limit(5)
      
      console.log('🔍 Debug check - completed cases (any commission):', completedCheck.data)
    }

    res.status(200).json(stats)

  } catch (error) {
    console.error('💥 Error fetching technician stats:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
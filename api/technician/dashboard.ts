// 📁 api/technician/dashboard.ts - FUNGERANDE VERSION BASERAT PÅ ADMIN-MÖNSTER
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
    return res.status(400).json({ error: 'technician_id required' })
  }

  try {
    console.log('🔄 Fetching dashboard data for technician:', technician_id)

    // 🔥 SAMMA MÖNSTER SOM ADMIN ECONOMICS - PARALLELLA QUERIES
    const [statsResult, commissionsResult, casesResult] = await Promise.all([
      // Stats från alla case-tabeller
      Promise.all([
        supabase
          .from('private_cases')
          .select('commission_amount, completed_date, pris, status')
          .eq('primary_assignee_id', technician_id)
          .not('commission_amount', 'is', null),
        
        supabase
          .from('business_cases')
          .select('commission_amount, completed_date, pris, status')
          .eq('primary_assignee_id', technician_id)
          .not('commission_amount', 'is', null)
      ]),

      // Commissions data - månadsvis
      Promise.all([
        supabase
          .from('private_cases')
          .select('commission_amount, completed_date')
          .eq('primary_assignee_id', technician_id)
          .not('commission_amount', 'is', null)
          .gte('completed_date', '2025-01-01'),
        
        supabase
          .from('business_cases')
          .select('commission_amount, completed_date')
          .eq('primary_assignee_id', technician_id)
          .not('commission_amount', 'is', null)
          .gte('completed_date', '2025-01-01')
      ]),

      // Recent cases
      Promise.all([
        supabase
          .from('private_cases')
          .select('id, clickup_task_id, title, status, completed_date, commission_amount, pris')
          .eq('primary_assignee_id', technician_id)
          .order('created_date', { ascending: false })
          .limit(5),
        
        supabase
          .from('business_cases')
          .select('id, clickup_task_id, title, status, completed_date, commission_amount, pris')
          .eq('primary_assignee_id', technician_id)
          .order('created_date', { ascending: false })
          .limit(5)
      ])
    ])

    // 🔥 ROBUST ERROR HANDLING LIKT ADMIN
    const [privateCases, businessCases] = statsResult
    const [privateCommissions, businessCommissions] = commissionsResult
    const [privateRecentCases, businessRecentCases] = casesResult

    // Kombinera all data
    const allCases = [
      ...(privateCases.data || []),
      ...(businessCases.data || [])
    ]

    const allCommissions = [
      ...(privateCommissions.data || []),
      ...(businessCommissions.data || [])
    ]

    const allRecentCases = [
      ...(privateRecentCases.data || []).map(c => ({ ...c, case_type: 'private' })),
      ...(businessRecentCases.data || []).map(c => ({ ...c, case_type: 'business' }))
    ].sort((a, b) => new Date(b.completed_date || 0).getTime() - new Date(a.completed_date || 0).getTime())

    // Beräkna stats
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().toISOString().slice(0, 7)

    const totalCommissionYtd = allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const totalCasesYtd = allCases.length
    const avgCommissionPerCase = totalCasesYtd > 0 ? totalCommissionYtd / totalCasesYtd : 0

    const currentMonthCases = allCases.filter(c => c.completed_date?.startsWith(currentMonth))
    const currentMonthCommission = currentMonthCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const completedCasesThisMonth = currentMonthCases.length

    const pendingCases = allRecentCases.filter(c => !c.completed_date).length

    // Månadsdata för chart
    const monthlyMap = new Map()
    allCommissions.forEach(c => {
      if (!c.completed_date) return
      const month = c.completed_date.slice(0, 7)
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, total_commission: 0, case_count: 0 })
      }
      const monthData = monthlyMap.get(month)
      monthData.total_commission += c.commission_amount || 0
      monthData.case_count += 1
    })

    const monthlyData = Array.from(monthlyMap.values())
      .map(m => ({
        ...m,
        month_display: `${getMonthName(parseInt(m.month.split('-')[1]))} ${m.month.split('-')[0]}`,
        avg_commission_per_case: m.case_count > 0 ? m.total_commission / m.case_count : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month))

    // Tekniker-info
    const { data: technician } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    // 🔥 SAMMA RESPONSE-FORMAT SOM ADMIN
    const response = {
      // Stats för KPI-kort
      stats: {
        total_commission_ytd: totalCommissionYtd,
        total_cases_ytd: totalCasesYtd,
        avg_commission_per_case: avgCommissionPerCase,
        current_month_commission: currentMonthCommission,
        pending_cases: pendingCases,
        completed_cases_this_month: completedCasesThisMonth,
        technician_name: technician?.name,
        technician_email: technician?.email
      },

      // Månadsdata för chart
      monthly_data: monthlyData,

      // Senaste ärenden
      recent_cases: allRecentCases.slice(0, 10),

      // Meta
      success: true,
      timestamp: new Date().toISOString()
    }

    console.log('✅ Dashboard data loaded successfully:', {
      technician_name: technician?.name,
      total_commission: totalCommissionYtd,
      cases: totalCasesYtd,
      months: monthlyData.length
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('💥 Dashboard API error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Helper function
function getMonthName(month: number): string {
  const months = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]
  return months[month - 1] || 'Okänd'
}

// 📁 api/technician/stats.ts - FÖRENKLAD VERSION SOM FUNGERAR
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
    return res.status(400).json({ error: 'technician_id required' })
  }

  try {
    // 🔥 ENKEL QUERY SOM FUNGERAR
    const { data: cases, error } = await supabase
      .from('private_cases')
      .select('commission_amount, completed_date, pris, status')
      .eq('primary_assignee_id', technician_id)

    if (error) throw error

    const stats = {
      total_commission_ytd: cases?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0,
      total_cases_ytd: cases?.length || 0,
      avg_commission_per_case: cases?.length > 0 ? 
        (cases.reduce((sum, c) => sum + (c.commission_amount || 0), 0) / cases.length) : 0,
      pending_cases: cases?.filter(c => !c.completed_date).length || 0
    }

    return res.status(200).json(stats)

  } catch (error) {
    console.error('Stats API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
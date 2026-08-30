// 📁 api/technician/dashboard.ts - FIXAD VERSION SOM ÅTERGÅR TILL URSPRUNGLIG LOGIK
import { logMissingAuth, requireAuth } from '../_lib/auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { isCompletedStatus } from '../../src/types/database'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const monthNames = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

// ✅ ÅTERANVÄND SAMMA LOGIK SOM ADMIN technicianAnalyticsService.ts
async function getTechnicianPerformanceById(technicianId: string) {
  console.log('🔄 Getting technician performance using admin logic...')
  
  // Hämta tekniker-info
  const { data: technician, error: techError } = await supabase
    .from('technicians')
    .select('id, name, role, email, is_active')
    .eq('id', technicianId)
    .single()

  if (techError || !technician) {
    throw new Error('Technician not found')
  }

  console.log(`✅ Found technician: ${technician.name}`)

  // ✅ EXAKT SAMMA QUERIES SOM ADMIN technicianAnalyticsService.ts
  const [privateCasesResult, businessCasesResult, contractCasesResult] = await Promise.allSettled([
    // Private cases - SAMMA SOM ADMIN
    supabase
      .from('private_cases')
      .select('pris, commission_amount, completed_date, created_at, status')
      .eq('primary_assignee_id', technician.id)
      .eq('status', 'Avslutat')
      .not('pris', 'is', null),

    // Business cases - SAMMA SOM ADMIN
    supabase
      .from('business_cases')
      .select('pris, commission_amount, completed_date, created_at, status')
      .eq('primary_assignee_id', technician.id) 
      .eq('status', 'Avslutat')
      .not('pris', 'is', null),

    // Contract cases - SAMMA SOM ADMIN
    supabase
      .from('cases')
      .select('price, completed_date, created_date, status')
      .eq('assigned_technician_id', technician.id)
      .in('status', ['Avslutat', 'Genomförd', 'Klar'])
      .not('price', 'is', null)
  ])

  // ✅ SÄKER DATA EXTRACTION
  const privateCases = privateCasesResult.status === 'fulfilled' ? privateCasesResult.value.data || [] : []
  const businessCases = businessCasesResult.status === 'fulfilled' ? businessCasesResult.value.data || [] : []
  const contractCases = contractCasesResult.status === 'fulfilled' ? contractCasesResult.value.data || [] : []

  console.log(`📊 Cases found: Private: ${privateCases.length}, Business: ${businessCases.length}, Contract: ${contractCases.length}`)

  // ✅ EXAKT SAMMA BERÄKNING SOM ADMIN
  const privateRevenue = privateCases.reduce((sum, c) => sum + (c.pris || 0), 0)
  const businessRevenue = businessCases.reduce((sum, c) => sum + (c.pris || 0), 0)
  const contractRevenue = contractCases.reduce((sum, c) => sum + (c.price || 0), 0)

  const totalRevenue = privateRevenue + businessRevenue + contractRevenue
  const totalCases = privateCases.length + businessCases.length + contractCases.length

  // ✅ COMMISSION BERÄKNING (bara BeGone cases har commission)
  const totalCommissionYtd = privateCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0) +
                           businessCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)

  return {
    technician,
    totalRevenue,
    totalCases,
    totalCommissionYtd,
    privateCases,
    businessCases,
    contractCases
  }
}

// ✅ MÅNADSDATA SAMMA SOM ADMIN useTechnicianMonthlyData
async function getTechnicianMonthlyData(technicianId: string) {
  console.log('🔄 Getting monthly data using admin logic...')
  
  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`

  // ✅ SAMMA QUERIES SOM ADMIN
  const [privateMonthly, businessMonthly] = await Promise.allSettled([
    supabase
      .from('private_cases')
      .select('commission_amount, completed_date, pris')
      .eq('primary_assignee_id', technicianId)
      .eq('status', 'Avslutat')
      .not('commission_amount', 'is', null)
      .gte('completed_date', yearStart),

    supabase
      .from('business_cases')
      .select('commission_amount, completed_date, pris')
      .eq('primary_assignee_id', technicianId)
      .eq('status', 'Avslutat')
      .not('commission_amount', 'is', null)
      .gte('completed_date', yearStart)
  ])

  const privateData = privateMonthly.status === 'fulfilled' ? privateMonthly.value.data || [] : []
  const businessData = businessMonthly.status === 'fulfilled' ? businessMonthly.value.data || [] : []
  
  console.log(`📊 Monthly commission data: Private: ${privateData.length}, Business: ${businessData.length}`)
  
  const allCommissionCases = [...privateData, ...businessData]
  
  console.log(`📊 Total commission cases for monthly: ${allCommissionCases.length}`)
  console.log('📊 Sample commission case:', allCommissionCases[0])

  // ✅ SAMMA GRUPPERING SOM ADMIN
  const monthlyMap = new Map()
  
  allCommissionCases.forEach(case_ => {
    if (!case_.completed_date) return
    
    const month = case_.completed_date.slice(0, 7) // YYYY-MM
    
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        total_commission: 0,
        case_count: 0
      })
    }
    
    const monthData = monthlyMap.get(month)
    monthData.total_commission += case_.commission_amount || 0
    monthData.case_count += 1
  })

  // ✅ SAMMA FORMAT SOM ADMIN
  const monthlyData = Array.from(monthlyMap.values())
    .map(m => ({
      ...m,
      month_display: `${monthNames[parseInt(m.month.split('-')[1]) - 1]} ${m.month.split('-')[0]}`,
      avg_commission_per_case: m.case_count > 0 ? m.total_commission / m.case_count : 0
    }))
    .sort((a, b) => b.month.localeCompare(a.month))

  return monthlyData
}

// ✅ RECENT CASES - MED UTÖKADE FÄLT FÖR EDITCASEMODAL
async function getRecentCases(technicianId: string) {
  const [recentPrivate, recentBusiness] = await Promise.allSettled([
    // Private cases - ALLA FÄLT för både visning och pending-räkning
    // Inkluderar primary_assignee_id och primary_assignee_name för rapport-generering
    supabase
      .from('private_cases')
      .select('id, clickup_task_id, title, status, completed_date, commission_amount, kontaktperson, created_at, description, skadedjur, telefon_kontaktperson, e_post_kontaktperson, personnummer, pris, material_cost, time_spent_minutes, work_started_at, start_date, due_date, r_rot_rut, r_fastighetsbeteckning, r_arbetskostnad, r_material_utrustning, r_servicebil, rapport, adress, priority, case_number, billing_status, filer, reklamation, avvikelser_tillbud_olyckor, annat_skadedjur, skicka_bokningsbekraftelse, primary_assignee_id, primary_assignee_name')
      .eq('primary_assignee_id', technicianId)
      .order('created_at', { ascending: false })
      .limit(50), // Öka limit för att få fler cases för pending-räkning

    // Business cases - ALLA FÄLT för både visning och pending-räkning
    // Inkluderar primary_assignee_id och primary_assignee_name för rapport-generering
    supabase
      .from('business_cases')
      .select('id, clickup_task_id, title, status, completed_date, commission_amount, kontaktperson, created_at, description, skadedjur, telefon_kontaktperson, e_post_kontaktperson, org_nr, pris, material_cost, time_spent_minutes, work_started_at, start_date, due_date, rapport, adress, priority, case_number, billing_status, filer, reklamation, avvikelser_tillbud_olyckor, annat_skadedjur, skicka_bokningsbekraftelse, markning_faktura, e_post_faktura, skicka_erbjudande, bestallare, primary_assignee_id, primary_assignee_name')
      .eq('primary_assignee_id', technicianId)
      .order('created_at', { ascending: false })
      .limit(50) // Öka limit för att få fler cases för pending-räkning
  ])

  const privateRecent = recentPrivate.status === 'fulfilled' ? recentPrivate.value.data || [] : []
  const businessRecent = recentBusiness.status === 'fulfilled' ? recentBusiness.value.data || [] : []

  console.log(`📋 Recent cases found: Private: ${privateRecent.length}, Business: ${businessRecent.length}`)

  const allRecentCases = [
    ...privateRecent.map(c => ({ ...c, case_type: 'private' })),
    ...businessRecent.map(c => ({ ...c, case_type: 'business' }))
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  return allRecentCases
}

// ✅ MAIN HANDLER
export default async function handler(req: VercelRequest, res: VercelResponse) {
  logMissingAuth(req, 'technician/dashboard')
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Guard etapp 5 (docs/sakerhetsplan-api-auth-vag2.md): provisions- och
  // prestandadata. Tekniker får bara läsa sitt eget technician_id (stänger
  // IDOR-hålet); admin/koordinator får läsa alla.
  const auth = await requireAuth(req, res, ['admin', 'koordinator', 'technician'])
  if (!auth) return

  const { technician_id } = req.query

  const isStaffOverride = auth.isAdmin || auth.role === 'admin' || auth.role === 'koordinator'
  if (!isStaffOverride) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('technician_id')
      .eq('user_id', auth.userId)
      .single()
    if (!callerProfile?.technician_id || callerProfile.technician_id !== technician_id) {
      return res.status(403).json({ error: 'Behörighet saknas för denna tekniker' })
    }
  }

  if (!technician_id) {
    return res.status(400).json({ 
      success: false,
      error: 'technician_id is required' 
    })
  }

  try {
    console.log('🔄 Fetching dashboard data for technician:', technician_id)

    // ✅ ANVÄND BEFINTLIGA ADMIN SERVICES - UTAN getPendingCases
    const [performanceData, monthlyData, recentCases] = await Promise.all([
      getTechnicianPerformanceById(technician_id as string),
      getTechnicianMonthlyData(technician_id as string),
      getRecentCases(technician_id as string)
    ])

    // ✅ BERÄKNA DASHBOARD STATS SAMMA SOM ADMIN
    const currentMonth = new Date().toISOString().slice(0, 7)
    
    const currentMonthData = monthlyData.find(m => m.month === currentMonth)
    const currentMonthCommission = currentMonthData?.total_commission || 0
    const completedCasesThisMonth = currentMonthData?.case_count || 0

    // ✅ KORREKT LOGIK - separera recent_cases och pending_cases
    const pendingCases = recentCases.filter(c => 
      c.status && !isCompletedStatus(c.status)
    )

    // Recent cases - de 10 senaste oavsett status för "Senaste ärenden" sektionen
    const recentCasesForDisplay = recentCases.slice(0, 10)

    console.log(`📋 Total cases fetched: ${recentCases.length}`)
    console.log(`📋 Recent cases for display: ${recentCasesForDisplay.length}`)
    console.log(`📋 Pending cases after filtering: ${pendingCases.length}`)

    const avgCommissionPerCase = performanceData.totalCases > 0 ? 
      performanceData.totalCommissionYtd / performanceData.totalCases : 0

    // ✅ SAMMA RESPONSE FORMAT SOM ADMIN
    const response = {
      success: true,
      stats: {
        total_commission_ytd: performanceData.totalCommissionYtd,
        total_cases_ytd: performanceData.totalCases,
        avg_commission_per_case: avgCommissionPerCase,
        current_month_commission: currentMonthCommission,
        pending_cases: pendingCases.length,
        completed_cases_this_month: completedCasesThisMonth,
        technician_name: performanceData.technician.name,
        technician_email: performanceData.technician.email
      },
      monthly_data: monthlyData,
      recent_cases: recentCasesForDisplay, // De 10 senaste för "Senaste ärenden"
      pending_cases: pendingCases, // Alla pending för "Pågående ärenden" klickbar lista
      meta: {
        technician_id,
        timestamp: new Date().toISOString(),
        data_sources: {
          private_cases: performanceData.privateCases.length,
          business_cases: performanceData.businessCases.length,
          contract_cases: performanceData.contractCases.length,
          recent_cases: recentCasesForDisplay.length,
          pending_cases: pendingCases.length,
          monthly_periods: monthlyData.length
        }
      }
    }

    console.log('✅ Dashboard data compiled successfully:', {
      technician_name: performanceData.technician.name,
      total_commission: performanceData.totalCommissionYtd,
      cases: performanceData.totalCases,
      months: monthlyData.length,
      current_month_commission: currentMonthCommission,
      pending_count: pendingCases.length,
      recent_count: recentCasesForDisplay.length
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('💥 Dashboard API error:', error)
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}
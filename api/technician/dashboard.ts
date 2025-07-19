// 📁 api/technician/dashboard.ts - KORRIGERAD VERSION MED RÄTT EXPORT
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

// ✅ KORREKT DEFAULT EXPORT för Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { technician_id } = req.query

  if (!technician_id) {
    return res.status(400).json({ 
      success: false,
      error: 'technician_id is required' 
    })
  }

  try {
    console.log('🔄 Fetching dashboard data for technician:', technician_id)

    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const yearStart = `${currentYear}-01-01`

    // ✅ HÄMTA TEKNIKER FÖRST för att få namn
    const { data: technician, error: techError } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    if (techError || !technician) {
      return res.status(404).json({
        success: false,
        error: 'Technician not found',
        technician_id
      })
    }

    console.log(`✅ Technician found: ${technician.name}`)

    // ✅ PARALLELLA QUERIES med BÅDE UUID OCH NAMN-SÖKNING
    const results = await Promise.allSettled([
      // Stats queries - HYBRID SÖKNING (UUID + namn)
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date, pris, status, created_date, primary_assignee_name')
        .or(`primary_assignee_id.eq.${technician_id},primary_assignee_name.eq.${technician.name}`),

      supabase
        .from('business_cases')
        .select('commission_amount, completed_date, pris, status, created_date, primary_assignee_name')
        .or(`primary_assignee_id.eq.${technician_id},primary_assignee_name.eq.${technician.name}`),

      // Commission queries för månadsdata - HYBRID SÖKNING
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date')
        .or(`primary_assignee_id.eq.${technician_id},primary_assignee_name.eq.${technician.name}`)
        .not('commission_amount', 'is', null)
        .gte('completed_date', yearStart),

      supabase
        .from('business_cases')
        .select('commission_amount, completed_date')
        .or(`primary_assignee_id.eq.${technician_id},primary_assignee_name.eq.${technician.name}`)
        .not('commission_amount', 'is', null)
        .gte('completed_date', yearStart),

      // Recent cases queries - HYBRID SÖKNING
      supabase
        .from('private_cases')
        .select('id, clickup_task_id, title, status, completed_date, commission_amount, pris, kontaktperson, telefon, email, adress, skadedjur, beskrivning')
        .or(`primary_assignee_id.eq.${technician_id},primary_assignee_name.eq.${technician.name}`)
        .order('created_date', { ascending: false })
        .limit(10),

      supabase
        .from('business_cases')
        .select('id, clickup_task_id, title, status, completed_date, commission_amount, pris, kontaktperson, telefon, email, adress, foretag, org_nr, skadedjur, beskrivning')
        .or(`primary_assignee_id.eq.${technician_id},primary_assignee_name.eq.${technician.name}`)
        .order('created_date', { ascending: false })
        .limit(10)
    ])

    // ✅ EXTRAHERA RESULTAT från Promise.allSettled
    const [
      privateCasesResult,
      businessCasesResult,
      privateCommissionsResult,
      businessCommissionsResult,
      recentPrivateResult,
      recentBusinessResult
    ] = results

    // ✅ SÄKER DATA EXTRACTION från Promise.allSettled
    const privateCases = privateCasesResult.status === 'fulfilled' ? privateCasesResult.value.data || [] : []
    const businessCases = businessCasesResult.status === 'fulfilled' ? businessCasesResult.value.data || [] : []
    const privateCommissions = privateCommissionsResult.status === 'fulfilled' ? privateCommissionsResult.value.data || [] : []
    const businessCommissions = businessCommissionsResult.status === 'fulfilled' ? businessCommissionsResult.value.data || [] : []
    const recentPrivate = recentPrivateResult.status === 'fulfilled' ? recentPrivateResult.value.data || [] : []
    const recentBusiness = recentBusinessResult.status === 'fulfilled' ? recentBusinessResult.value.data || [] : []

    // ✅ LOGGA EVENTUELLA FEL
    if (privateCasesResult.status === 'rejected') {
      console.error('❌ Private cases error:', privateCasesResult.reason)
    }
    if (businessCasesResult.status === 'rejected') {
      console.error('❌ Business cases error:', businessCasesResult.reason)
    }

    // ✅ DEBUG LOGGING för att se vad vi faktiskt hittar
    console.log(`🔍 Data found for ${technician.name}:`, {
      privateCases: privateCases.length,
      businessCases: businessCases.length,
      privateCommissions: privateCommissions.length,
      businessCommissions: businessCommissions.length,
      recentPrivate: recentPrivate.length,
      recentBusiness: recentBusiness.length
    })

    // Kombinera all data för beräkningar
    const allCases = [...privateCases, ...businessCases]
    const allCommissions = [...privateCommissions, ...businessCommissions]
    const allRecentCases = [
      ...recentPrivate.map((c: any) => ({ ...c, case_type: 'private' })),
      ...recentBusiness.map((c: any) => ({ ...c, case_type: 'business' }))
    ].sort((a, b) => new Date(b.completed_date || 0).getTime() - new Date(a.completed_date || 0).getTime())

    // ✅ BERÄKNA DASHBOARD STATS
    const totalCommissionYtd = allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const totalCasesYtd = allCases.length
    const avgCommissionPerCase = totalCasesYtd > 0 ? totalCommissionYtd / totalCasesYtd : 0

    const currentMonthCases = allCases.filter(c => c.completed_date?.startsWith(currentMonth))
    const currentMonthCommission = currentMonthCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const completedCasesThisMonth = currentMonthCases.length

    const pendingCases = allRecentCases.filter(c => !c.completed_date).length

    // ✅ MÅNADSDATA för chart
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
        month_display: `${monthNames[parseInt(m.month.split('-')[1]) - 1]} ${m.month.split('-')[0]}`,
        avg_commission_per_case: m.case_count > 0 ? m.total_commission / m.case_count : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month))

    // ✅ FINAL RESPONSE
    const response = {
      success: true,
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
      monthly_data: monthlyData,
      recent_cases: allRecentCases.slice(0, 10),
      meta: {
        technician_id,
        timestamp: new Date().toISOString(),
        data_sources: {
          private_cases: privateCases.length,
          business_cases: businessCases.length,
          recent_cases: allRecentCases.length
        }
      }
    }

    console.log('✅ Dashboard data compiled successfully:', {
      technician_name: technician?.name,
      total_commission: totalCommissionYtd,
      cases: totalCasesYtd,
      months: monthlyData.length
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
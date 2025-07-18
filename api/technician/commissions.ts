// 📁 api/technician/commissions.ts - FIXAD MED ROBUST DATUM-HANTERING OCH DEBUG
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Månadsnamn på svenska
const MONTH_NAMES: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { technician_id } = req.query

  if (!technician_id) {
    return res.status(400).json({ error: 'technician_id is required' })
  }

  try {
    console.log('🔄 Fetching technician commissions for UUID:', technician_id)

    // Hämta alla avslutade ärenden med provision för senaste 12 månaderna
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

    console.log('📅 Looking for commissions from:', oneYearAgoStr, 'to now')

    // ✅ DIREKT UUID-SÖKNING - ANVÄNDER completed_date (korrekt för provisioner)
    const [privateCases, businessCases] = await Promise.all([
      // Private cases med UUID
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date, pris as case_price, clickup_task_id, title, kontaktperson, adress, billing_status')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .not('completed_date', 'is', null)
        .gte('completed_date', oneYearAgoStr)
        .order('completed_date', { ascending: false }),

      // Business cases med UUID
      supabase
        .from('business_cases')
        .select('commission_amount, completed_date, pris as case_price, clickup_task_id, title, kontaktperson, foretag, org_nr, adress, billing_status')
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .not('commission_amount', 'is', null)
        .not('completed_date', 'is', null)
        .gte('completed_date', oneYearAgoStr)
        .order('completed_date', { ascending: false })
    ])

    // ✅ DEBUG: Logga vad vi faktiskt hittar
    console.log('🔍 Private commission cases result:', {
      data_length: privateCases.data?.length || 0,
      error: privateCases.error?.message,
      sample_case: privateCases.data?.[0] ? {
        commission_amount: privateCases.data[0].commission_amount,
        completed_date: privateCases.data[0].completed_date,
        title: privateCases.data[0].title
      } : null
    })

    console.log('🔍 Business commission cases result:', {
      data_length: businessCases.data?.length || 0,
      error: businessCases.error?.message,
      sample_case: businessCases.data?.[0] ? {
        commission_amount: businessCases.data[0].commission_amount,
        completed_date: businessCases.data[0].completed_date,
        title: businessCases.data[0].title
      } : null
    })

    // Kombinera och märk med typ
    const allCases = [
      ...(privateCases.data || []).map(c => ({ ...c, type: 'private' as const })),
      ...(businessCases.data || []).map(c => ({ ...c, type: 'business' as const }))
    ]

    console.log(`🔍 Total commission cases found: ${allCases.length}`)

    // Gruppera per månad
    const monthlyData: Record<string, {
      month: string
      month_display: string
      total_commission: number
      case_count: number
      private_commission: number
      business_commission: number
      cases: any[]
    }> = {}

    allCases.forEach(case_ => {
      const monthKey = case_.completed_date!.slice(0, 7) // YYYY-MM
      const [year, month] = monthKey.split('-')
      const monthDisplay = `${MONTH_NAMES[month]} ${year}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          month_display: monthDisplay,
          total_commission: 0,
          case_count: 0,
          private_commission: 0,
          business_commission: 0,
          cases: []
        }
      }

      const commission = case_.commission_amount || 0
      monthlyData[monthKey].total_commission += commission
      monthlyData[monthKey].case_count += 1
      monthlyData[monthKey].cases.push(case_)

      if (case_.type === 'private') {
        monthlyData[monthKey].private_commission += commission
      } else {
        monthlyData[monthKey].business_commission += commission
      }
    })

    // Konvertera till array och sortera
    const monthlyArray = Object.values(monthlyData)
      .map(month => ({
        ...month,
        avg_commission_per_case: month.case_count > 0 ? month.total_commission / month.case_count : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month)) // Senaste månaden först

    console.log(`🔍 Monthly data created: ${monthlyArray.length} months`)
    if (monthlyArray.length > 0) {
      console.log('📅 Sample months:', monthlyArray.slice(0, 3).map(m => ({
        month: m.month_display,
        commission: m.total_commission,
        cases: m.case_count
      })))
    }

    // Beräkna årstatistik
    const totalYtd = monthlyArray.reduce((sum, month) => sum + month.total_commission, 0)
    const totalCasesYtd = monthlyArray.reduce((sum, month) => sum + month.case_count, 0)
    const avgPerCase = totalCasesYtd > 0 ? totalYtd / totalCasesYtd : 0

    // Hitta bästa månaden
    const bestMonth = monthlyArray.reduce((best, current) => 
      current.total_commission > best.total_commission ? current : best,
      monthlyArray[0] || { total_commission: 0, month_display: 'Ingen data' }
    )

    // Hämta tekniker-namn för display (efter all beräkning)
    const { data: technician } = await supabase
      .from('technicians')
      .select('name')
      .eq('id', technician_id)
      .single()

    const stats = {
      total_ytd: totalYtd,
      total_cases_ytd: totalCasesYtd,
      avg_per_case: avgPerCase,
      highest_month: bestMonth.total_commission,
      best_month_name: bestMonth.month_display
    }

    console.log(`✅ Commissions calculated for UUID ${technician_id}:`, {
      total_ytd: totalYtd,
      cases: totalCasesYtd,
      months: monthlyArray.length,
      best_month: bestMonth.month_display,
      highest_commission: bestMonth.total_commission
    })

    // ✅ EXTRA DEBUG om inga data hittas
    if (allCases.length === 0) {
      console.log('⚠️ NO COMMISSION DATA FOUND - checking for data without commission...')
      
      // Kolla om det finns completed cases utan commission_amount
      const debugCheck = await supabase
        .from('private_cases')
        .select('id, title, completed_date, commission_amount, pris, primary_assignee_name')
        .eq('primary_assignee_id', technician_id)
        .not('completed_date', 'is', null)
        .limit(5)
      
      console.log('🔍 Debug check - completed cases without commission filter:', debugCheck.data)
    }

    res.status(200).json({
      monthly_data: monthlyArray,
      stats,
      technician_name: technician?.name || 'Okänd tekniker',
      debug_info: {
        total_cases_found: allCases.length,
        private_cases_found: privateCases.data?.length || 0,
        business_cases_found: businessCases.data?.length || 0,
        months_with_data: monthlyArray.length,
        date_range_from: oneYearAgoStr
      }
    })

  } catch (error) {
    console.error('💥 Error fetching technician commissions:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
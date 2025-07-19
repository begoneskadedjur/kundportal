// 📁 api/technician/commissions.ts - FÖRENKLAD VERSION BASERAT PÅ ADMIN-MÖNSTER
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const monthNames = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { technician_id } = req.query

  if (!technician_id) {
    return res.status(400).json({ error: 'technician_id required' })
  }

  try {
    console.log('🔄 Fetching commission data for technician:', technician_id)

    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`

    // 🔥 SAMMA PARALLELLA QUERY-MÖNSTER SOM ADMIN ECONOMICS
    const [privateResult, businessResult] = await Promise.all([
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date, pris')
        .eq('primary_assignee_id', technician_id)
        .not('commission_amount', 'is', null)
        .gte('completed_date', yearStart),

      supabase
        .from('business_cases')
        .select('commission_amount, completed_date, pris')
        .eq('primary_assignee_id', technician_id)
        .not('commission_amount', 'is', null)
        .gte('completed_date', yearStart)
    ])

    // 🔥 SAMMA ERROR HANDLING SOM ADMIN
    if (privateResult.error) {
      console.error('Private commission error:', privateResult.error)
    }
    if (businessResult.error) {
      console.error('Business commission error:', businessResult.error)
    }

    // Kombinera alla cases
    const allCases = [
      ...(privateResult.data || []).map(c => ({ ...c, source: 'private' })),
      ...(businessResult.data || []).map(c => ({ ...c, source: 'business' }))
    ]

    // Gruppera per månad - SAMMA LOGIK SOM ADMIN MONTHLY DATA
    const monthlyMap = new Map()

    allCases.forEach(case_ => {
      if (!case_.completed_date) return
      
      const monthKey = case_.completed_date.slice(0, 7) // YYYY-MM
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          total_commission: 0,
          case_count: 0,
          private_commission: 0,
          business_commission: 0,
          private_count: 0,
          business_count: 0
        })
      }

      const month = monthlyMap.get(monthKey)
      const commission = case_.commission_amount || 0
      
      month.total_commission += commission
      month.case_count += 1
      
      if (case_.source === 'private') {
        month.private_commission += commission
        month.private_count += 1
      } else {
        month.business_commission += commission
        month.business_count += 1
      }
    })

    // Konvertera till array och lägg till display names - SAMMA FORMAT SOM ADMIN
    const monthlyData = Array.from(monthlyMap.values())
      .map((month: any) => ({
        ...month,
        month_display: `${monthNames[parseInt(month.month.split('-')[1]) - 1]} ${month.month.split('-')[0]}`,
        avg_commission_per_case: month.case_count > 0 ? month.total_commission / month.case_count : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month)) // Senaste först

    // Beräkna årsstatistik - SAMMA MÖNSTER SOM ADMIN ECONOMICS
    const stats = {
      total_ytd: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
      total_cases_ytd: allCases.length,
      avg_per_case: allCases.length > 0 ? 
        allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0) / allCases.length : 0,
      highest_month: Math.max(...monthlyData.map(m => m.total_commission), 0),
      best_month_name: monthlyData.length > 0 ? 
        monthlyData.find(m => m.total_commission === Math.max(...monthlyData.map(d => d.total_commission)))?.month_display || '' : ''
    }

    // Hämta tekniker-info
    const { data: technician } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    console.log(`✅ Commission data loaded for technician ${technician_id}:`, {
      technician_name: technician?.name,
      months: monthlyData.length,
      total_ytd: stats.total_ytd,
      cases_ytd: stats.total_cases_ytd
    })

    // 🔥 SAMMA RESPONSE-FORMAT SOM ADMIN ECONOMICS
    return res.status(200).json({
      success: true,
      monthly_data: monthlyData,
      stats,
      meta: {
        technician_id,
        technician_name: technician?.name,
        year: currentYear,
        months_available: monthlyData.length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('💥 Commission API error:', error)
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
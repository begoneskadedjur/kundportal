// 📁 api/technician/commissions.ts - ANVÄND SAMMA LOGIK SOM ADMIN
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
    console.log('🔄 Fetching commission data for technician:', technician_id)

    // Hämta tekniker-info
    const { data: technician, error: techError } = await supabase
      .from('technicians')
      .select('name, email')
      .eq('id', technician_id)
      .single()

    if (techError || !technician) {
      return res.status(404).json({
        success: false,
        error: 'Technician not found'
      })
    }

    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`

    // ✅ SAMMA QUERIES SOM ADMIN - hämta alla commission cases för året
    const [privateResult, businessResult] = await Promise.allSettled([
      supabase
        .from('private_cases')
        .select('commission_amount, completed_date, pris')
        .eq('primary_assignee_id', technician_id)
        .eq('status', 'Avslutat')
        .not('commission_amount', 'is', null)
        .gte('completed_date', yearStart),

      supabase
        .from('business_cases')
        .select('commission_amount, completed_date, pris')
        .eq('primary_assignee_id', technician_id)
        .eq('status', 'Avslutat')
        .not('commission_amount', 'is', null)
        .gte('completed_date', yearStart)
    ])

    const privateCases = privateResult.status === 'fulfilled' ? privateResult.value.data || [] : []
    const businessCases = businessResult.status === 'fulfilled' ? businessResult.value.data || [] : []

    console.log(`📊 Commission cases found: Private: ${privateCases.length}, Business: ${businessCases.length}`)

    // Kombinera alla cases
    const allCases = [
      ...privateCases.map(c => ({ ...c, source: 'private' })),
      ...businessCases.map(c => ({ ...c, source: 'business' }))
    ]

    // ✅ SAMMA MÅNADSGRUPPERING SOM ADMIN
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

    // ✅ SAMMA FORMAT SOM ADMIN
    const monthlyData = Array.from(monthlyMap.values())
      .map((month: any) => ({
        ...month,
        month_display: `${monthNames[parseInt(month.month.split('-')[1]) - 1]} ${month.month.split('-')[0]}`,
        avg_commission_per_case: month.case_count > 0 ? month.total_commission / month.case_count : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month)) // Senaste först

    // ✅ SAMMA ÅRSSTATISTIK SOM ADMIN
    const stats = {
      total_ytd: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
      total_cases_ytd: allCases.length,
      avg_per_case: allCases.length > 0 ? 
        allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0) / allCases.length : 0,
      highest_month: Math.max(...monthlyData.map(m => m.total_commission), 0),
      best_month_name: monthlyData.length > 0 ? 
        monthlyData.find(m => m.total_commission === Math.max(...monthlyData.map(d => d.total_commission)))?.month_display || '' : ''
    }

    console.log(`✅ Commission data compiled for ${technician.name}:`, {
      months: monthlyData.length,
      total_ytd: stats.total_ytd,
      cases_ytd: stats.total_cases_ytd
    })

    // ✅ SAMMA RESPONSE-FORMAT SOM ADMIN
    return res.status(200).json({
      success: true,
      monthly_data: monthlyData,
      stats,
      meta: {
        technician_id,
        technician_name: technician.name,
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
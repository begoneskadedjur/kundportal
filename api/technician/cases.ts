// 📁 api/technician/cases.ts - FIXAD VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { technician_id, limit = '50' } = req.query

  if (!technician_id) {
    return res.status(400).json({ error: 'technician_id is required' })
  }

  try {
    console.log('🔄 Fetching cases for technician UUID:', technician_id)

    // ✅ DIREKT UUID-SÖKNING med komplett case-data
    const [privateCases, businessCases, contractCases] = await Promise.all([
      // Private cases
      supabase
        .from('private_cases')
        .select(`
          id, clickup_task_id, title, status, priority, created_date, completed_date,
          commission_amount, pris as case_price, primary_assignee_name as assignee_name,
          kontaktperson, telefon, email, adress, skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)
        .order('created_date', { ascending: false })
        .limit(parseInt(limit as string)),

      // Business cases  
      supabase
        .from('business_cases')
        .select(`
          id, clickup_task_id, title, status, priority, created_date, completed_date,
          commission_amount, pris as case_price, primary_assignee_name as assignee_name,
          kontaktperson, telefon, email, adress, foretag, org_nr, skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)
        .order('created_date', { ascending: false })
        .limit(parseInt(limit as string)),

      // Contract cases (avtalskunder)
      supabase
        .from('cases')
        .select(`
          id, clickup_task_id, title, status, priority, created_date, completed_date,
          price as case_price, assigned_technician_name as assignee_name,
          billing_status
        `)
        .eq('assigned_technician_id', technician_id)
        .order('created_date', { ascending: false })
        .limit(parseInt(limit as string))
    ])

    // Kombinera och formattera alla cases
    const allCases = [
      ...(privateCases.data || []).map(c => ({
        ...c,
        case_type: 'private' as const,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(businessCases.data || []).map(c => ({
        ...c,
        case_type: 'business' as const,
        case_number: `B-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(contractCases.data || []).map(c => ({
        ...c,
        case_type: 'contract' as const,
        case_number: `C-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`,
        commission_amount: 0 // Avtalskunder har ingen provision
      }))
    ]

    // Sortera efter datum (senaste först)
    allCases.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())

    // Beräkna stats
    const stats = {
      total_cases: allCases.length,
      completed_cases: allCases.filter(c => 
        c.status?.toLowerCase() === 'avslutat' || 
        c.status?.toLowerCase() === 'completed' ||
        c.completed_date
      ).length,
      pending_cases: allCases.filter(c => 
        !c.completed_date && 
        c.status?.toLowerCase() !== 'avslutat' && 
        c.status?.toLowerCase() !== 'completed'
      ).length,
      in_progress_cases: allCases.filter(c => 
        c.status?.toLowerCase().includes('pågående') ||
        c.status?.toLowerCase().includes('progress')
      ).length,
      total_commission: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    }

    console.log(`✅ Cases loaded for UUID ${technician_id}:`, {
      total: allCases.length,
      private: privateCases.data?.length || 0,
      business: businessCases.data?.length || 0,
      contract: contractCases.data?.length || 0,
      stats
    })

    res.status(200).json({
      cases: allCases,
      stats
    })

  } catch (error) {
    console.error('💥 Error fetching technician cases:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// 📁 api/technician/commissions.ts - FIXAD VERSION
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
    return res.status(400).json({ error: 'technician_id is required' })
  }

  try {
    console.log('🔄 Fetching commission data for UUID:', technician_id)

    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`

    // ✅ DIREKT UUID-SÖKNING för hela året
    const [privateCases, businessCases] = await Promise.all([
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

    // Kombinera alla cases
    const allCases = [...(privateCases.data || []), ...(businessCases.data || [])]

    // Gruppera per månad
    const monthlyMap: { [month: string]: any } = {}

    allCases.forEach(case_ => {
      if (!case_.completed_date) return
      
      const monthKey = case_.completed_date.slice(0, 7) // YYYY-MM
      
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          total_commission: 0,
          case_count: 0,
          private_commission: 0,
          business_commission: 0,
          private_count: 0,
          business_count: 0
        }
      }

      const month = monthlyMap[monthKey]
      const commission = case_.commission_amount || 0
      
      month.total_commission += commission
      month.case_count += 1
      
      // Identifiera typ baserat på ursprungstabell (enkelt sätt)
      // Private cases kommer från private_cases, business från business_cases
      const isPrivate = privateCases.data?.includes(case_)
      
      if (isPrivate) {
        month.private_commission += commission
        month.private_count += 1
      } else {
        month.business_commission += commission
        month.business_count += 1
      }
    })

    // Konvertera till array och lägg till display names
    const monthlyData = Object.values(monthlyMap)
      .map((month: any) => ({
        ...month,
        month_display: `${monthNames[parseInt(month.month.split('-')[1]) - 1]} ${month.month.split('-')[0]}`,
        avg_commission_per_case: month.case_count > 0 ? month.total_commission / month.case_count : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month)) // Senaste först

    // Beräkna årsstatistik
    const stats = {
      total_ytd: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
      total_cases_ytd: allCases.length,
      avg_per_case: allCases.length > 0 ? 
        allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0) / allCases.length : 0,
      highest_month: Math.max(...monthlyData.map(m => m.total_commission), 0),
      best_month_name: monthlyData.length > 0 ? 
        monthlyData.find(m => m.total_commission === Math.max(...monthlyData.map(d => d.total_commission)))?.month_display || '' : ''
    }

    console.log(`✅ Commission data loaded for UUID ${technician_id}:`, {
      months: monthlyData.length,
      total_ytd: stats.total_ytd,
      cases_ytd: stats.total_cases_ytd
    })

    res.status(200).json({
      monthly_data: monthlyData,
      stats
    })

  } catch (error) {
    console.error('💥 Error fetching commission data:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
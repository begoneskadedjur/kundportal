// 📁 api/technician/cases.ts - FIXAD MED start_date ISTÄLLET FÖR created_date
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
    console.log('🔄 Fetching technician cases for UUID:', technician_id)

    const limitNum = parseInt(limit as string) || 50

    // ✅ FIXAD: Använd start_date istället för created_date
    const [privateCases, businessCases] = await Promise.all([
      // Private cases med UUID
      supabase
        .from('private_cases')
        .select(`
          id, clickup_task_id, title, status, priority, start_date, completed_date,
          commission_amount, pris as case_price, kontaktperson, telefon, email, adress,
          skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .order('start_date', { ascending: false })  // ✅ FIXAD: start_date
        .limit(limitNum),

      // Business cases med UUID
      supabase
        .from('business_cases')
        .select(`
          id, clickup_task_id, title, status, priority, start_date, completed_date,
          commission_amount, pris as case_price, kontaktperson, telefon, email, adress,
          foretag, org_nr, skadedjur, beskrivning, billing_status
        `)
        .eq('primary_assignee_id', technician_id)  // ✅ DIREKT UUID-SÖKNING
        .order('start_date', { ascending: false })  // ✅ FIXAD: start_date
        .limit(limitNum)
    ])

    // ✅ DEBUG: Logga vad vi faktiskt hittar
    console.log('🔍 Private cases query result:', {
      data_length: privateCases.data?.length || 0,
      error: privateCases.error?.message,
      sample_case: privateCases.data?.[0] ? {
        id: privateCases.data[0].id,
        title: privateCases.data[0].title,
        start_date: privateCases.data[0].start_date,
        completed_date: privateCases.data[0].completed_date,
        status: privateCases.data[0].status
      } : null
    })

    console.log('🔍 Business cases query result:', {
      data_length: businessCases.data?.length || 0,
      error: businessCases.error?.message,
      sample_case: businessCases.data?.[0] ? {
        id: businessCases.data[0].id,
        title: businessCases.data[0].title,
        start_date: businessCases.data[0].start_date,
        completed_date: businessCases.data[0].completed_date,
        status: businessCases.data[0].status
      } : null
    })

    // Kombinera och märk med typ
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
      }))
    ]

    // ✅ FIXAD: Sortera efter start_date istället för created_date
    allCases.sort((a, b) => {
      const dateA = new Date(a.start_date || '1970-01-01').getTime()
      const dateB = new Date(b.start_date || '1970-01-01').getTime()
      return dateB - dateA
    })

    // Begränsa till önskat antal
    const limitedCases = allCases.slice(0, limitNum)

    // Beräkna statistik
    const totalCases = allCases.length
    const completedCases = allCases.filter(c => 
      c.completed_date || 
      c.status?.toLowerCase() === 'completed' || 
      c.status?.toLowerCase() === 'avslutat'
    ).length
    
    const pendingCases = allCases.filter(c => 
      !c.completed_date && 
      c.status?.toLowerCase() !== 'completed' && 
      c.status?.toLowerCase() !== 'avslutat'
    ).length
    
    const inProgressCases = allCases.filter(c => 
      !c.completed_date && 
      (c.status?.toLowerCase().includes('progress') || 
       c.status?.toLowerCase().includes('pågående') ||
       c.status?.toLowerCase().includes('första'))
    ).length
    
    const totalCommission = allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    // Hämta tekniker-namn för display (efter all beräkning)
    const { data: technician } = await supabase
      .from('technicians')
      .select('name')
      .eq('id', technician_id)
      .single()

    const stats = {
      total_cases: totalCases,
      completed_cases: completedCases,
      pending_cases: pendingCases,
      in_progress_cases: inProgressCases,
      total_commission: totalCommission
    }

    console.log(`✅ Cases fetched for UUID ${technician_id}:`, {
      total: totalCases,
      returned: limitedCases.length,
      commission: totalCommission,
      completed: completedCases,
      pending: pendingCases,
      in_progress: inProgressCases
    })

    // ✅ DEBUG: Logga sample data för felsökning
    if (limitedCases.length > 0) {
      console.log('📋 Sample cases found:', limitedCases.slice(0, 3).map(c => ({
        title: c.title,
        case_type: c.case_type,
        status: c.status,
        start_date: c.start_date,
        completed_date: c.completed_date,
        commission: c.commission_amount
      })))
    } else {
      console.log('⚠️ NO CASES FOUND - checking for data inconsistency...')
      
      // Extra debug: Kolla om det finns ärenden utan UUID-koppling
      const nameCheck = await supabase
        .from('private_cases')
        .select('id, title, primary_assignee_name, primary_assignee_id, start_date')
        .ilike('primary_assignee_name', '%mathias%')
        .limit(5)
      
      console.log('🔍 Name-based search result:', nameCheck.data)
    }

    res.status(200).json({
      cases: limitedCases,
      stats,
      technician_name: technician?.name || 'Okänd tekniker',
      total_found: totalCases,
      returned: limitedCases.length,
      debug_info: {
        private_cases_found: privateCases.data?.length || 0,
        business_cases_found: businessCases.data?.length || 0,
        combined_total: allCases.length,
        has_private_error: !!privateCases.error,
        has_business_error: !!businessCases.error
      }
    })

  } catch (error) {
    console.error('💥 Error fetching technician cases:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
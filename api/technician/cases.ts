// 📁 api/technician/cases.ts - FÖRENKLAD VERSION BASERAT PÅ ADMIN-MÖNSTER
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
    return res.status(400).json({ error: 'technician_id required' })
  }

  try {
    console.log('🔄 Fetching cases for technician:', technician_id)

    // 🔥 SAMMA PARALLELLA QUERY-MÖNSTER SOM ADMIN ECONOMICS
    const [privateResult, businessResult, contractResult] = await Promise.all([
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

      // Contract cases (avtalskunder) - använder assigned_technician_id
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

    // 🔥 SAMMA ERROR HANDLING SOM ADMIN
    if (privateResult.error) console.error('Private cases error:', privateResult.error)
    if (businessResult.error) console.error('Business cases error:', businessResult.error)
    if (contractResult.error) console.error('Contract cases error:', contractResult.error)

    // Kombinera och formattera alla cases
    const allCases = [
      ...(privateResult.data || []).map(c => ({
        ...c,
        case_type: 'private' as const,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(businessResult.data || []).map(c => ({
        ...c,
        case_type: 'business' as const,
        case_number: `B-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...(contractResult.data || []).map(c => ({
        ...c,
        case_type: 'contract' as const,
        case_number: `C-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`,
        commission_amount: 0 // Avtalskunder har ingen provision
      }))
    ]

    // Sortera efter datum (senaste först)
    allCases.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())

    // Beräkna stats - SAMMA MÖNSTER SOM ADMIN
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

    console.log(`✅ Cases loaded for technician ${technician_id}:`, {
      total: allCases.length,
      private: privateResult.data?.length || 0,
      business: businessResult.data?.length || 0,
      contract: contractResult.data?.length || 0,
      stats
    })

    // 🔥 SAMMA RESPONSE-FORMAT SOM ADMIN
    return res.status(200).json({
      success: true,
      cases: allCases,
      stats,
      meta: {
        technician_id,
        total_found: allCases.length,
        sources: {
          private: privateResult.data?.length || 0,
          business: businessResult.data?.length || 0,
          contract: contractResult.data?.length || 0
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('💥 Cases API error:', error)
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
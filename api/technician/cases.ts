// 📁 api/technician/cases.ts - FIXAD SUPABASE QUERY SYNTAX
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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

  const { technician_id, limit = '100' } = req.query

  if (!technician_id) {
    return res.status(400).json({ 
      success: false,
      error: 'technician_id required' 
    })
  }

  try {
    console.log('🔄 Fetching cases for technician:', technician_id)

    // ✅ FIXAD QUERY SYNTAX - Inga multi-line select strings
    const [privateResult, businessResult, contractResult] = await Promise.allSettled([
      // Private cases - ALLA STATUS (inte bara avslutade)
      supabase
        .from('private_cases')
        .select('id, clickup_task_id, title, status, priority, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon, e_post_kontaktperson, adress, skadedjur, beskrivning, billing_status')
        .eq('primary_assignee_id', technician_id)
        .order('start_date', { ascending: false })
        .limit(parseInt(limit as string)),

      // Business cases - ALLA STATUS (inte bara avslutade)
      supabase
        .from('business_cases')
        .select('id, clickup_task_id, title, status, priority, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon, e_post_kontaktperson, adress, foretag, org_nr, skadedjur, beskrivning, billing_status')
        .eq('primary_assignee_id', technician_id)
        .order('start_date', { ascending: false })
        .limit(parseInt(limit as string)),

      // Contract cases - använder assigned_technician_id
      supabase
        .from('cases')
        .select('id, clickup_task_id, title, status, priority, created_date, completed_date, price, assigned_technician_name, billing_status')
        .eq('assigned_technician_id', technician_id)
        .order('created_date', { ascending: false })
        .limit(parseInt(limit as string))
    ])

    // ✅ SÄKER ERROR HANDLING
    if (privateResult.status === 'rejected') {
      console.error('Private cases error:', privateResult.reason)
    }
    if (businessResult.status === 'rejected') {
      console.error('Business cases error:', businessResult.reason)
    }
    if (contractResult.status === 'rejected') {
      console.error('Contract cases error:', contractResult.reason)
    }

    // ✅ KOMBINERA OCH FORMATTERA ALLA CASES
    const privateCases = privateResult.status === 'fulfilled' ? privateResult.value.data || [] : []
    const businessCases = businessResult.status === 'fulfilled' ? businessResult.value.data || [] : []
    const contractCases = contractResult.status === 'fulfilled' ? contractResult.value.data || [] : []

    const allCases = [
      ...privateCases.map(c => ({
        ...c,
        case_type: 'private' as const,
        created_date: c.start_date,
        case_price: c.pris,
        assignee_name: c.primary_assignee_name,
        email: c.e_post_kontaktperson,
        case_number: `P-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...businessCases.map(c => ({
        ...c,
        case_type: 'business' as const,
        created_date: c.start_date,
        case_price: c.pris,
        assignee_name: c.primary_assignee_name,
        email: c.e_post_kontaktperson,
        case_number: `B-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
      })),
      ...contractCases.map(c => ({
        ...c,
        case_type: 'contract' as const,
        case_price: c.price,
        assignee_name: c.assigned_technician_name,
        case_number: `C-${c.clickup_task_id}`,
        clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`,
        commission_amount: 0 // Avtalskunder har ingen provision
      }))
    ]

    // ✅ SORTERA EFTER DATUM (senaste först)
    allCases.sort((a, b) => new Date(b.created_date || '').getTime() - new Date(a.created_date || '').getTime())

    // ✅ BERÄKNA STATS
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
      private: privateCases.length,
      business: businessCases.length,
      contract: contractCases.length,
      stats
    })

    // ✅ SAMMA RESPONSE-FORMAT SOM ADMIN
    return res.status(200).json({
      success: true,
      cases: allCases,
      stats,
      meta: {
        technician_id,
        total_found: allCases.length,
        sources: {
          private: privateCases.length,
          business: businessCases.length,
          contract: contractCases.length
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
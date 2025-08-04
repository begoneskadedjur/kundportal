// API endpoint to get all cases with commission for technician for specific month
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { technician_id, month } = req.query;

    if (!technician_id || !month) {
      return res.status(400).json({ 
        error: 'Missing required parameters: technician_id and month' 
      });
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month as string)) {
      return res.status(400).json({ 
        error: 'Invalid month format. Use YYYY-MM format' 
      });
    }

    // Calculate date range for the month
    const startDate = `${month}-01`;
    const endDate = new Date(month + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Fetching monthly cases for technician ${technician_id} for month ${month}`);
    console.log(`Date range: ${startDate} to ${endDateStr}`);

    // Query private cases with commission for the month
    const { data: privateCases, error: privateError } = await supabase
      .from('private_cases')
      .select(`
        id,
        clickup_task_id,
        title,
        status,
        completed_date,
        commission_amount,
        case_type,
        billing_status
      `)
      .eq('assigned_technician_id', technician_id)
      .gte('completed_date', startDate)
      .lt('completed_date', endDateStr)
      .not('commission_amount', 'is', null)
      .gt('commission_amount', 0)
      .in('billing_status', ['sent', 'paid']); // Only cases that generate commission

    if (privateError) {
      console.error('Error fetching private cases:', privateError);
      throw privateError;
    }

    // Query business cases with commission for the month
    const { data: businessCases, error: businessError } = await supabase
      .from('business_cases')
      .select(`
        id,
        clickup_task_id,
        title,
        status,
        completed_date,
        commission_amount,
        case_type,
        billing_status
      `)
      .eq('assigned_technician_id', technician_id)
      .gte('completed_date', startDate)
      .lt('completed_date', endDateStr)
      .not('commission_amount', 'is', null)
      .gt('commission_amount', 0)
      .in('billing_status', ['sent', 'paid']); // Only cases that generate commission

    if (businessError) {
      console.error('Error fetching business cases:', businessError);
      throw businessError;
    }

    // Combine and format cases
    const allCases = [
      ...(privateCases || []).map(case_ => ({
        ...case_,
        case_type: 'private'
      })),
      ...(businessCases || []).map(case_ => ({
        ...case_,
        case_type: 'business'
      }))
    ];

    // Sort by completed_date descending
    allCases.sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime());

    // Calculate summary stats
    const totalCommission = allCases.reduce((sum, case_) => sum + (case_.commission_amount || 0), 0);
    const caseCount = allCases.length;
    const avgCommissionPerCase = caseCount > 0 ? totalCommission / caseCount : 0;

    console.log(`Found ${caseCount} cases with total commission: ${totalCommission}`);

    const response = {
      month,
      month_display: new Date(month + '-01').toLocaleDateString('sv-SE', { 
        month: 'long', 
        year: 'numeric' 
      }),
      stats: {
        total_commission: totalCommission,
        case_count: caseCount,
        avg_commission_per_case: avgCommissionPerCase
      },
      cases: allCases
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in monthly-cases API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
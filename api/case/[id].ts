// 📁 api/case/[id].ts
// 🎯 API för att hämta ärendedata för koordinatorer/admins

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Service role client för att kunna läsa data oberoende av RLS
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Regular client för att validera JWT
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Validera JWT och få användardata
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Kontrollera behörighet
    const jwtRole = user.user_metadata?.role;
    const technicianId = user.user_metadata?.technician_id;
    
    let hasPermission = false;
    
    if (jwtRole === 'admin') {
      hasPermission = true;
    } else if (technicianId) {
      // Hämta tekniker-data för att kontrollera roll
      const { data: technician } = await supabaseServiceRole
        .from('technicians')
        .select('role')
        .eq('id', technicianId)
        .single();
        
      if (technician?.role === 'Koordinator' || technician?.role === 'Admin') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Hämta ärendedata med service role
    const { data: privateCase, error: privateError } = await supabaseServiceRole
      .from('private_cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (privateCase && !privateError) {
      return res.status(200).json({ case: privateCase, type: 'private' });
    }
    
    const { data: businessCase, error: businessError } = await supabaseServiceRole
      .from('business_cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (businessCase && !businessError) {
      return res.status(200).json({ case: businessCase, type: 'business' });
    }
    
    return res.status(404).json({ error: 'Case not found' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
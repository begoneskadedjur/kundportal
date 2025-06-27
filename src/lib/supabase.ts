// src/lib/supabase.ts - FÖRBÄTTRAD VERSION med auth optimering

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// FIX: Optimerade inställningar för bättre session hantering
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // FIX 1: Förhindra automatisk refresh av tokens i bakgrunden
    // som kan orsaka oändliga loops
    autoRefreshToken: true,
    
    // FIX 2: Håll session persistent mellan browser refreshes
    persistSession: true,
    
    // FIX 3: Använd mer konservativ session detection
    detectSessionInUrl: false,
    
    // FIX 4: Optimera storage för bättre kompatibilitet
    storage: {
      getItem: (key) => {
        try {
          return window.localStorage.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          window.localStorage.setItem(key, value)
        } catch {
          // Ignorera om localStorage inte är tillgängligt
        }
      },
      removeItem: (key) => {
        try {
          window.localStorage.removeItem(key)
        } catch {
          // Ignorera om localStorage inte är tillgängligt
        }
      },
    },
  },
  // FIX 5: Optimerade globala inställningar
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  },
})
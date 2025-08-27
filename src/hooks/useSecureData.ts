// src/hooks/useSecureData.ts - Säker dataåtkomst via säkra vyer
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export const useSecureData = () => {
  const { user, profile } = useAuth()

  /**
   * Hämta kunder via säker vy med rollbaserad åtkomst
   */
  const getCustomers = async (filters?: {
    is_active?: boolean
    organization_id?: string
    search?: string
  }) => {
    let query = supabase
      .from('customer_secure_view')
      .select('*')
      .order('company_name')
    
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }
    
    if (filters?.organization_id) {
      query = query.eq('organization_id', filters.organization_id)
    }
    
    if (filters?.search) {
      query = query.or(`company_name.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%`)
    }
    
    const { data, error } = await query
    if (error) throw new Error(`Kunde inte hämta kunder: ${error.message}`)
    return data
  }

  /**
   * Hämta ärenden via säker vy
   */
  const getCases = async (filters?: {
    status?: string
    priority?: string
    technician_id?: string
    customer_id?: string
    from_date?: string
    to_date?: string
  }) => {
    let query = supabase
      .from('cases_secure_view')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    
    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }
    
    if (filters?.technician_id) {
      query = query.or(`primary_technician_id.eq.${filters.technician_id},secondary_technician_id.eq.${filters.technician_id},tertiary_technician_id.eq.${filters.technician_id}`)
    }
    
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id)
    }
    
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date)
    }
    
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date)
    }
    
    const { data, error } = await query
    if (error) throw new Error(`Kunde inte hämta ärenden: ${error.message}`)
    return data
  }

  /**
   * Hämta offerter och kontrakt via säker vy
   */
  const getQuotes = async (filters?: {
    customer_id?: string
    status?: string
    type?: 'quote' | 'contract'
  }) => {
    let query = supabase
      .from('quotes_secure_view')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id)
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    
    if (filters?.type) {
      query = query.eq('type', filters.type)
    }
    
    const { data, error } = await query
    if (error) throw new Error(`Kunde inte hämta offerter: ${error.message}`)
    return data
  }

  /**
   * Hämta enskild offert via säker vy
   */
  const getQuote = async (quoteId: string, customerId?: string) => {
    let query = supabase
      .from('quotes_secure_view')
      .select('*')
      .eq('id', quoteId)
    
    // Extra säkerhetskontroll för kunder
    if (customerId && profile?.role === 'customer') {
      query = query.eq('customer_id', customerId)
    }
    
    const { data, error } = await query.maybeSingle()
    if (error) throw new Error(`Kunde inte hämta offert: ${error.message}`)
    
    if (!data) {
      throw new Error('Offerten kunde inte hittas eller du har inte behörighet att se den')
    }
    
    return data
  }

  /**
   * Hämta provisionsdata via säker vy
   */
  const getCommissionData = async (filters?: {
    technician_id?: string
    month?: string
    year?: string
    case_type?: 'private' | 'business'
  }) => {
    let query = supabase
      .from('commission_secure_view')
      .select('*')
      .order('completed_at', { ascending: false })
    
    if (filters?.technician_id) {
      query = query.eq('primary_assignee_id', filters.technician_id)
    }
    
    if (filters?.month && filters?.year) {
      const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`
      const endDate = `${filters.year}-${filters.month.padStart(2, '0')}-31`
      query = query.gte('completed_at', startDate)
                   .lte('completed_at', endDate)
    } else if (filters?.year) {
      query = query.gte('completed_at', `${filters.year}-01-01`)
                   .lte('completed_at', `${filters.year}-12-31`)
    }
    
    if (filters?.case_type) {
      query = query.eq('case_type', filters.case_type)
    }
    
    const { data, error } = await query
    if (error) throw new Error(`Kunde inte hämta provisionsdata: ${error.message}`)
    return data
  }

  /**
   * Hämta tekniker via säker vy
   */
  const getTechnicians = async (filters?: {
    is_active?: boolean
    search?: string
  }) => {
    let query = supabase
      .from('technicians_secure_view')
      .select('*')
      .order('first_name')
    
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }
    
    if (filters?.search) {
      query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }
    
    const { data, error } = await query
    if (error) throw new Error(`Kunde inte hämta tekniker: ${error.message}`)
    return data
  }

  /**
   * Hämta enskild tekniker via säker vy
   */
  const getTechnician = async (technicianId: string) => {
    const { data, error } = await supabase
      .from('technicians_secure_view')
      .select('*')
      .eq('id', technicianId)
      .maybeSingle()
    
    if (error) throw new Error(`Kunde inte hämta tekniker: ${error.message}`)
    
    if (!data) {
      throw new Error('Teknikern kunde inte hittas eller du har inte behörighet att se den')
    }
    
    return data
  }

  /**
   * Räkna antal ärenden per status för dashboard
   */
  const getCaseStatusCounts = async (filters?: {
    technician_id?: string
    customer_id?: string
  }) => {
    let query = supabase
      .from('cases_secure_view')
      .select('status')
    
    if (filters?.technician_id) {
      query = query.or(`primary_technician_id.eq.${filters.technician_id},secondary_technician_id.eq.${filters.technician_id},tertiary_technician_id.eq.${filters.technician_id}`)
    }
    
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id)
    }
    
    const { data, error } = await query
    if (error) throw new Error(`Kunde inte hämta ärendestatistik: ${error.message}`)
    
    // Räkna statuser
    const counts: Record<string, number> = {}
    data?.forEach(item => {
      counts[item.status] = (counts[item.status] || 0) + 1
    })
    
    return counts
  }

  /**
   * Beräkna total provision för en tekniker
   */
  const getTotalCommission = async (technicianId: string, month?: string, year?: string) => {
    const commissionData = await getCommissionData({
      technician_id: technicianId,
      month,
      year
    })
    
    const total = commissionData.reduce((sum, item) => {
      return sum + (item.commission_amount || 0)
    }, 0)
    
    return {
      total_commission: total,
      case_count: commissionData.length,
      breakdown: commissionData
    }
  }

  return {
    // Grundläggande CRUD
    getCustomers,
    getCases,
    getQuotes,
    getQuote,
    getCommissionData,
    getTechnicians,
    getTechnician,
    
    // Dashboard/statistik
    getCaseStatusCounts,
    getTotalCommission
  }
}

export default useSecureData
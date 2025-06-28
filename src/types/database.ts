// src/types/database.ts - Komplett uppdaterad med contract_end_date + all befintlig struktur
export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          company_name: string
          org_number: string
          contact_person: string
          email: string
          phone: string
          address: string
          contract_type_id: string
          clickup_list_id: string
          clickup_list_name: string
          is_active: boolean
          created_at: string
          updated_at: string
          
          // Avtalsfält - UTÖKAD med contract_end_date
          contract_start_date: string | null
          contract_length_months: number | null
          contract_end_date: string | null  // 🆕 NYA FÄLTET
          annual_premium: number | null
          total_contract_value: number | null
          contract_description: string | null
          assigned_account_manager: string | null
          contract_status: 'active' | 'pending' | 'expired' | 'cancelled'
          
          // Verksamhetstyp
          business_type: string | null
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at' | 'contract_status'> & {
          contract_status?: 'active' | 'pending' | 'expired' | 'cancelled'
          contract_end_date?: string | null  // 🆕 Lägg till i Insert-typen
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      contract_types: {
        Row: {
          id: string
          name: string
          clickup_folder_id: string
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contract_types']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contract_types']['Insert']>
      }
      // TEKNIKER-TABELL (behålls oförändrad)
      technicians: {
        Row: {
          id: string
          name: string
          role: string
          email: string
          direct_phone: string | null
          office_phone: string | null
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['technicians']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['technicians']['Insert']>
      }
      cases: {
        Row: {
          id: string
          customer_id: string
          clickup_task_id: string
          case_number: string
          title: string
          status: string
          priority: string
          pest_type: string
          location_details: string
          description: string
          scheduled_date: string | null
          completed_date: string | null
          created_at: string
          updated_at: string
          // Utökade fält
          address_formatted: string | null
          address_lat: number | null
          address_lng: number | null
          case_type: string | null
          price: number | null
          technician_report: string | null
          files: any | null // jsonb
          assigned_technician_name: string | null
          assigned_technician_email: string | null
          // TEKNIKER-RELATIONER
          assigned_technician_id: string | null // FK till technicians
        }
        Insert: Omit<Database['public']['Tables']['cases']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cases']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          customer_id: string | null
          email: string
          is_admin: boolean
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      visits: {
        Row: {
          id: string
          case_id: string
          visit_date: string
          technician_name: string | null
          work_performed: string | null
          findings: string | null
          recommendations: string | null
          next_visit_date: string | null
          photos: string | null
          report_pdf_url: string | null
          status: string | null
          created_at: string
          updated_at: string
          // TEKNIKER-RELATIONER
          technician_id: string | null // FK till technicians
        }
        Insert: Omit<Database['public']['Tables']['visits']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['visits']['Insert']>
      }
      user_invitations: {
        Row: {
          id: string
          email: string
          customer_id: string
          invited_by: string
          accepted_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_invitations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_invitations']['Insert']>
      }
    }
  }
}

// Hjälptyper (behålls alla befintliga)
export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export type ContractType = Database['public']['Tables']['contract_types']['Row']

// TEKNIKER-TYPER (behålls oförändrade)
export type Technician = Database['public']['Tables']['technicians']['Row']
export type TechnicianInsert = Database['public']['Tables']['technicians']['Insert']
export type TechnicianUpdate = Database['public']['Tables']['technicians']['Update']

// Tekniker-roller (behålls oförändrade)
export const TECHNICIAN_ROLES = [
  'Skadedjurstekniker',
  'VD',
  'Marknad & Försäljningschef',
  'Regionchef Dalarna',
  'Koordinator/kundtjänst',
  'Annan'
] as const

export type TechnicianRole = typeof TECHNICIAN_ROLES[number]

// Utökad kunddata - UPPDATERAD med contract_end_date
export type CustomerFormData = {
  // Grundinformation
  company_name: string
  org_number: string
  contact_person: string
  email: string
  phone: string
  address: string
  contract_type_id: string
  business_type: string
  
  // Avtalsinformation - UTÖKAD
  contract_start_date: string
  contract_length_months: string
  contract_end_date: string  // 🆕 NYA FÄLTET i formulär-typen
  annual_premium: string
  total_contract_value: string
  contract_description: string
  assigned_account_manager: string
}

// Tekniker-formulärdata (behålls oförändrad)
export type TechnicianFormData = {
  name: string
  role: TechnicianRole
  email: string
  direct_phone: string
  office_phone: string
  address: string
}

// Avtalsansvariga (behålls oförändrade)
export const ACCOUNT_MANAGERS = [
  { value: 'christian.karlsson@begone.se', label: 'Christian Karlsson' },
  { value: 'kristian.agnevik@begone.se', label: 'Kristian Agnevik' },
  { value: 'sofia.palshagen@begone.se', label: 'Sofia Pålshagen' },
  { value: 'hans.norman@begone.se', label: 'Hans Norman' }
] as const

export type AccountManager = typeof ACCOUNT_MANAGERS[number]['value']

// 🆕 NYA HJÄLPFUNKTIONER för contract_end_date hantering
export const calculateContractEndDate = (startDate: string, lengthInMonths: number): string => {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + lengthInMonths)
  return end.toISOString().split('T')[0] // YYYY-MM-DD format
}

export const getContractTimeRemaining = (endDate: string) => {
  const now = new Date()
  const end = new Date(endDate)
  const diffTime = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const diffMonths = Math.ceil(diffDays / 30)
  
  return {
    days: diffDays,
    months: diffMonths,
    isExpired: diffDays <= 0,
    isExpiringSoon: diffDays <= 90, // Inom 3 månader
    status: diffDays <= 0 ? 'expired' : 
            diffDays <= 30 ? 'critical' :
            diffDays <= 90 ? 'warning' : 'good'
  }
}

export const formatContractPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate).toLocaleDateString('sv-SE')
  const end = new Date(endDate).toLocaleDateString('sv-SE')
  return `${start} - ${end}`
}

export const getContractStatus = (customer: Customer) => {
  if (!customer.contract_end_date) {
    return {
      text: 'Inget slutdatum',
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      daysLeft: null
    }
  }

  const now = new Date()
  const endDate = new Date(customer.contract_end_date)
  const timeDiff = endDate.getTime() - now.getTime()
  const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) {
    return {
      text: `Utgånget ${Math.abs(daysLeft)} dagar sedan`,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      daysLeft: daysLeft
    }
  } else if (daysLeft <= 30) {
    return {
      text: `${daysLeft} dagar kvar`,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      daysLeft: daysLeft
    }
  } else if (daysLeft <= 90) {
    return {
      text: `${daysLeft} dagar kvar`,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      daysLeft: daysLeft
    }
  } else {
    const monthsLeft = Math.ceil(daysLeft / 30)
    return {
      text: `${monthsLeft} månader kvar`,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      daysLeft: daysLeft
    }
  }
}

// 🆕 Avancerade avtalsfunktioner
export const calculateContractProgress = (startDate: string, endDate: string): number => {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const totalDuration = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()
  
  return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
}

export const getContractRenewalUrgency = (endDate: string): {
  urgency: 'low' | 'medium' | 'high' | 'critical'
  message: string
  actionNeeded: boolean
} => {
  const timeRemaining = getContractTimeRemaining(endDate)
  
  if (timeRemaining.isExpired) {
    return {
      urgency: 'critical',
      message: 'Avtalet har gått ut',
      actionNeeded: true
    }
  } else if (timeRemaining.days <= 30) {
    return {
      urgency: 'critical',
      message: 'Avtalet löper ut inom 30 dagar',
      actionNeeded: true
    }
  } else if (timeRemaining.days <= 90) {
    return {
      urgency: 'high',
      message: 'Avtalet löper ut inom 3 månader',
      actionNeeded: true
    }
  } else if (timeRemaining.days <= 180) {
    return {
      urgency: 'medium',
      message: 'Avtalet löper ut inom 6 månader',
      actionNeeded: false
    }
  } else {
    return {
      urgency: 'low',
      message: 'Avtalet är stabilt',
      actionNeeded: false
    }
  }
}

// 🆕 Valideringar för avtalsdatum
export const validateContractDates = (startDate: string, endDate: string): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()
  
  if (start >= end) {
    errors.push('Slutdatum måste vara efter startdatum')
  }
  
  if (start > now) {
    // Varning, inte fel
    console.warn('Avtalet startar i framtiden')
  }
  
  const contractLengthDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (contractLengthDays < 30) {
    errors.push('Avtalet måste vara minst 30 dagar långt')
  }
  
  if (contractLengthDays > 365 * 10) { // 10 år
    errors.push('Avtalet kan inte vara längre än 10 år')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
// src/types/database.ts - Uppdaterad med tekniker-tabell
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
          
          // Avtalsfält
          contract_start_date: string | null
          contract_length_months: number | null
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
      // NYA TEKNIKER-TABELL
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
          // NYA TEKNIKER-RELATIONER
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
          // NYA TEKNIKER-RELATIONER
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

// Hjälptyper
export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export type ContractType = Database['public']['Tables']['contract_types']['Row']

// NYA TEKNIKER-TYPER
export type Technician = Database['public']['Tables']['technicians']['Row']
export type TechnicianInsert = Database['public']['Tables']['technicians']['Insert']
export type TechnicianUpdate = Database['public']['Tables']['technicians']['Update']

// Tekniker-roller
export const TECHNICIAN_ROLES = [
  'Skadedjurstekniker',
  'VD',
  'Marknad & Försäljningschef',
  'Regionchef Dalarna',
  'Koordinator/kundtjänst',
  'Annan'
] as const

export type TechnicianRole = typeof TECHNICIAN_ROLES[number]

// Utökad kunddata
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
  
  // Avtalsinformation
  contract_start_date: string
  contract_length_months: string
  annual_premium: string
  total_contract_value: string
  contract_description: string
  assigned_account_manager: string
}

// Tekniker-formulärdata
export type TechnicianFormData = {
  name: string
  role: TechnicianRole
  email: string
  direct_phone: string
  office_phone: string
  address: string
}

// Avtalsansvariga - uppdaterade med verkliga tekniker
export const ACCOUNT_MANAGERS = [
  { value: 'christian.karlsson@begone.se', label: 'Christian Karlsson' },
  { value: 'kristian.agnevik@begone.se', label: 'Kristian Agnevik' },
  { value: 'sofia.palshagen@begone.se', label: 'Sofia Pålshagen' },
  { value: 'hans.norman@begone.se', label: 'Hans Norman' }
] as const

export type AccountManager = typeof ACCOUNT_MANAGERS[number]['value']
// src/types/database.ts
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
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
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
          // Nya kolumner från din utökade struktur
          address_formatted: string | null
          address_lat: number | null
          address_lng: number | null
          case_type: string | null
          price: number | null
          technician_report: string | null
          files: any | null // jsonb
          assigned_technician_name: string | null
          assigned_technician_email: string | null
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
          photos: string | null // _text array
          report_pdf_url: string | null
          status: string | null
          created_at: string
          updated_at: string
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
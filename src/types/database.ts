export type Database = {
  public: {
    Tables: {
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
        }
        Insert: Omit<Database['public']['Tables']['cases']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cases']['Insert']>
      }
    }
  }
}
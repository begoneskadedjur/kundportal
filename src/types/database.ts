// src/types/database.ts - KOMPLETT UPPDATERAD med alla saknade exports och PestType integration + work_schedule

// 🆕 SCHEMA TYPER FÖR TEKNIKER-SCHEMA
export type DaySchedule = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  active: boolean;
};

export type WorkSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

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
          contract_end_date: string | null
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
          contract_end_date?: string | null
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
      // ✅ KORRIGERAD TEKNIKER-TABELL MED ABAX_VEHICLE_ID + WORK_SCHEDULE
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
          abax_vehicle_id: string | null
          work_schedule: WorkSchedule | null // 🆕 TILLAGD WORK_SCHEDULE JSONB
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
          status: ClickUpStatus  // 🆕 Använd ClickUp status type
          status_id: string | null  // 🆕 ClickUp status ID
          priority: string
          pest_type: string
          location_details: string
          description: string
          created_date: string | null
          scheduled_date: string | null
          completed_date: string | null  // 🆕 När ärendet stängdes
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
          assigned_technician_id: string | null // FK till technicians
        }
        Insert: Omit<Database['public']['Tables']['cases']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cases']['Insert']>
      }
      // 🆕 NYA BEGONE TABELLER
      private_cases: {
        Row: {
          id: string
          clickup_task_id: string
          case_number: string | null
          title: string
          description: string | null
          status: ClickUpStatus  // 🆕 Samma status som ClickUp
          status_id: string | null  // 🆕 ClickUp status ID för exakt mappning
          priority: string | null
          created_at: string
          updated_at: string
          
          // Assignees (upp till 3 tekniker per ärende)
          primary_assignee_id: string | null
          primary_assignee_name: string | null
          primary_assignee_email: string | null
          secondary_assignee_id: string | null
          secondary_assignee_name: string | null
          secondary_assignee_email: string | null
          tertiary_assignee_id: string | null
          tertiary_assignee_name: string | null
          tertiary_assignee_email: string | null
          
          // Svenska datum med tid (YYYY-MM-DD HH:MM:SS)
          start_date: string | null // timestamptz med tid
          due_date: string | null   // timestamptz med tid
          completed_date: string | null  // 🆕 När ärendet stängdes/avslutades
          
          // 20 Custom fields från ClickUp (privatpersoner)
          adress: any | null // JSONB
          r_arbetskostnad: number | null
          avvikelser_tillbud_olyckor: string | null
          r_rot_rut: string | null
          rapport: string | null
          status_saneringsrapport: string | null
          r_fastighetsbeteckning: string | null
          personnummer: string | null
          r_material_utrustning: number | null
          kontaktperson: string | null
          skadedjur: string | null
          skicka_bokningsbekraftelse: string | null
          reklamation: string | null
          e_post_kontaktperson: string | null
          telefon_kontaktperson: string | null
          vaggloss_angade_rum: string | null
          pris: number | null
          filer: any | null // JSONB
          r_servicebil: number | null
          annat_skadedjur: string | null
          
          // ✅ PROVISIONSKOLUMNER TILLAGDA
          commission_amount: number | null
          commission_calculated_at: string | null
          billing_status: 'pending' | 'sent' | 'paid' | 'skip' | null
        }
        Insert: Omit<Database['public']['Tables']['private_cases']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['private_cases']['Insert']>
      }
      business_cases: {
        Row: {
          id: string
          clickup_task_id: string
          case_number: string | null
          title: string
          description: string | null
          status: ClickUpStatus  // 🆕 Samma status som ClickUp
          status_id: string | null  // 🆕 ClickUp status ID för exakt mappning
          priority: string | null
          created_at: string
          updated_at: string
          
          // Assignees (upp till 3 tekniker per ärende)
          primary_assignee_id: string | null
          primary_assignee_name: string | null
          primary_assignee_email: string | null
          secondary_assignee_id: string | null
          secondary_assignee_name: string | null
          secondary_assignee_email: string | null
          tertiary_assignee_id: string | null
          tertiary_assignee_name: string | null
          tertiary_assignee_email: string | null
          
          // Svenska datum med tid (YYYY-MM-DD HH:MM:SS)
          start_date: string | null // timestamptz med tid
          due_date: string | null   // timestamptz med tid
          completed_date: string | null  // 🆕 När ärendet stängdes/avslutades
          
          // 19 Custom fields från ClickUp (företag)
          adress: any | null // JSONB
          avvikelser_tillbud_olyckor: string | null
          rapport: string | null
          status_saneringsrapport: string | null
          markning_faktura: string | null
          kontaktperson: string | null
          e_post_faktura: string | null
          skadedjur: string | null
          skicka_bokningsbekraftelse: string | null
          org_nr: string | null
          reklamation: string | null
          e_post_kontaktperson: string | null
          telefon_kontaktperson: string | null
          skicka_erbjudande: string | null
          vaggloss_angade_rum: string | null
          bestallare: string | null
          pris: number | null
          filer: any | null // JSONB
          annat_skadedjur: string | null
          
          // ✅ PROVISIONSKOLUMNER TILLAGDA
          commission_amount: number | null
          commission_calculated_at: string | null
          billing_status: 'pending' | 'sent' | 'paid' | 'skip' | null
        }
        Insert: Omit<Database['public']['Tables']['business_cases']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['business_cases']['Insert']>
      }
      // ✅ KORRIGERAD PROFILES-TABELL MED TEKNIKER-INTEGRATION
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
          // ✅ TEKNIKER-INTEGRATION TILLAGD
          technician_id: string | null // FK till technicians
          role: string | null // 'admin' | 'customer' | 'technician'
          display_name: string | null // Visningsnamn för tekniker
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      // ✅ BILLING_AUDIT_LOG TABELL TILLAGD
      billing_audit_log: {
        Row: {
          id: string
          case_id: string
          case_type: 'private' | 'business'
          clickup_task_id: string
          old_status: string | null
          new_status: string
          changed_by: string
          changed_at: string
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['billing_audit_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['billing_audit_log']['Insert']>
      }
      products: {
        Row: {
          id: string
          name: string
          description: string
          category: 'pest_control' | 'preventive' | 'specialty' | 'additional'
          
          // Företagspriser (i hela kronor)
          company_base_price: number
          company_vat_rate: number
          company_discount_percent: number
          
          // Privatpriser (i hela kronor)
          individual_base_price: number
          individual_tax_deduction: 'rot' | 'rut' | null
          individual_discount_percent: number
          
          // Kvantitetsinställningar
          quantity_type: 'quantity' | 'single_choice' | 'multiple_choice'
          default_quantity: number
          max_quantity: number
          
          // Egenskaper
          oneflow_compatible: boolean
          is_popular: boolean
          rot_eligible: boolean
          rut_eligible: boolean
          seasonal_available: boolean
          requires_consultation: boolean
          
          // Kontraktsbeskrivning
          contract_description: string
          
          // Metadata
          created_at: string
          updated_at: string
          created_by: string | null
          is_active: boolean
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      contracts: {
        Row: {
          id: string
          oneflow_contract_id: string
          
          source_type: 'private_case' | 'business_case' | 'manual'
          source_id: string | null
          
          type: 'contract' | 'offer'
          status: 'draft' | 'pending' | 'signed' | 'declined' | 'active' | 'ended' | 'overdue'
          template_id: string
          
          begone_employee_name: string | null
          begone_employee_email: string | null
          contract_length: string | null
          start_date: string | null
          
          contact_person: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_address: string | null
          company_name: string | null
          organization_number: string | null
          
          agreement_text: string | null
          total_value: number | null
          
          selected_products: any | null // JSONB
          
          customer_id: string | null
          
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contracts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>
      }
      contract_files: {
        Row: {
          id: string
          contract_id: string
          oneflow_file_id: number
          file_name: string
          file_type: 'contract' | 'verification' | 'attachment' | 'pdf'
          file_extension: string
          file_size: number | null
          file_url: string | null
          supabase_storage_path: string | null
          download_status: 'pending' | 'downloading' | 'completed' | 'failed'
          downloaded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contract_files']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contract_files']['Insert']>
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
      monthly_marketing_spend: {
        Row: {
          id: string
          month: string
          spend: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['monthly_marketing_spend']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['monthly_marketing_spend']['Insert']>
      }
      technician_absences: {
        Row: {
          id: string
          technician_id: string
          start_date: string // YYYY-MM-DD HH:MM:SS+TZ format
          end_date: string   // YYYY-MM-DD HH:MM:SS+TZ format
          reason: string     // 'Föräldraledighet', 'Semester', 'Sjukdom', 'Övrigt', etc.
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['technician_absences']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['technician_absences']['Insert']>
      }
    }
  }
}

// 🎯 CLICKUP STATUS SYSTEM - Med kapitalisering för portal-visning
export type ClickUpStatus = 
  | 'Öppen'
  | 'Bokat'
  | 'Återbesök 1'
  | 'Återbesök 2'
  | 'Återbesök 3'
  | 'Återbesök 4'
  | 'Återbesök 5'
  | 'Privatperson - review'
  | 'Bomkörning'
  | 'Generera saneringsrapport'
  | 'Ombokning'
  | 'Offert skickad'
  | 'Offert signerad - boka in'
  | 'Reklamation'
  | 'Stängt - slasklogg'
  | 'Avslutat'

// 🆔 STATUS ID TILL NAMN MAPPNING - Med kapitalisering
export const STATUS_ID_TO_NAME: { [key: string]: ClickUpStatus } = {
  'c127553498_fwlMbGKH': 'Öppen',
  'c127553498_E9tR4uKl': 'Bokat',
  'c127553498_vUiYm1mz': 'Återbesök 1',
  'c127553498_oWvoXUqP': 'Återbesök 2',
  'c127553498_Pk6EAmNr': 'Återbesök 3',
  'c127553498_navJy7RM': 'Återbesök 4',
  'c127553498_i96gm2m8': 'Återbesök 5',
  'c127553498_aGFV5SBN': 'Privatperson - review',
  'c127553498_LeA7jRkh': 'Bomkörning',
  'c127553498_F7cDxTYZ': 'Generera saneringsrapport',
  'c127553498_f4QLnpo0': 'Ombokning',
  'c127553498_ozSZTPqg': 'Offert skickad',
  'c127553498_u6NXTUe8': 'Offert signerad - boka in',
  'c127553498_V0p3wG0L': 'Reklamation',
  'c127553498_PSuyPIHA': 'Stängt - slasklogg',
  'c127553498_wQT5njhJ': 'Avslutat',
}

// 📝 STATUS NAMN TILL ID MAPPNING
export const STATUS_NAME_TO_ID: { [key in ClickUpStatus]: string } = {
  'Öppen': 'c127553498_fwlMbGKH',
  'Bokat': 'c127553498_E9tR4uKl',
  'Återbesök 1': 'c127553498_vUiYm1mz',
  'Återbesök 2': 'c127553498_oWvoXUqP',
  'Återbesök 3': 'c127553498_Pk6EAmNr',
  'Återbesök 4': 'c127553498_navJy7RM',
  'Återbesök 5': 'c127553498_i96gm2m8',
  'Privatperson - review': 'c127553498_aGFV5SBN',
  'Bomkörning': 'c127553498_LeA7jRkh',
  'Generera saneringsrapport': 'c127553498_F7cDxTYZ',
  'Ombokning': 'c127553498_f4QLnpo0',
  'Offert skickad': 'c127553498_ozSZTPqg',
  'Offert signerad - boka in': 'c127553498_u6NXTUe8',
  'Reklamation': 'c127553498_V0p3wG0L',
  'Stängt - slasklogg': 'c127553498_PSuyPIHA',
  'Avslutat': 'c127553498_wQT5njhJ',
}

// 🎨 STATUS KONFIGURATION med färger och typer
export const STATUS_CONFIG: { [key in ClickUpStatus]: { id: string; color: string; type: string; orderindex: number } } = {
  'Öppen': { id: 'c127553498_fwlMbGKH', color: '#87909e', type: 'open', orderindex: 0 },
  'Bokat': { id: 'c127553498_E9tR4uKl', color: '#f8ae00', type: 'custom', orderindex: 1 },
  'Återbesök 1': { id: 'c127553498_vUiYm1mz', color: '#1090e0', type: 'custom', orderindex: 2 },
  'Återbesök 2': { id: 'c127553498_oWvoXUqP', color: '#1090e0', type: 'custom', orderindex: 3 },
  'Återbesök 3': { id: 'c127553498_Pk6EAmNr', color: '#1090e0', type: 'custom', orderindex: 4 },
  'Återbesök 4': { id: 'c127553498_navJy7RM', color: '#1090e0', type: 'custom', orderindex: 5 },
  'Återbesök 5': { id: 'c127553498_i96gm2m8', color: '#1090e0', type: 'custom', orderindex: 6 },
  'Privatperson - review': { id: 'c127553498_aGFV5SBN', color: '#ee5e99', type: 'custom', orderindex: 7 },
  'Bomkörning': { id: 'c127553498_LeA7jRkh', color: '#d33d44', type: 'custom', orderindex: 8 },
  'Generera saneringsrapport': { id: 'c127553498_F7cDxTYZ', color: '#aa8d80', type: 'custom', orderindex: 9 },
  'Ombokning': { id: 'c127553498_f4QLnpo0', color: '#5f55ee', type: 'custom', orderindex: 10 },
  'Offert skickad': { id: 'c127553498_ozSZTPqg', color: '#3db88b', type: 'custom', orderindex: 11 },
  'Offert signerad - boka in': { id: 'c127553498_u6NXTUe8', color: '#85e7a1', type: 'custom', orderindex: 12 },
  'Reklamation': { id: 'c127553498_V0p3wG0L', color: '#ee5e99', type: 'custom', orderindex: 13 },
  'Stängt - slasklogg': { id: 'c127553498_PSuyPIHA', color: '#d33d44', type: 'done', orderindex: 14 },
  'Avslutat': { id: 'c127553498_wQT5njhJ', color: '#008844', type: 'closed', orderindex: 15 },
}

// 🔧 HJÄLPFUNKTIONER för status-hantering
export const getStatusName = (statusId: string): ClickUpStatus => {
  return STATUS_ID_TO_NAME[statusId] || 'Öppen'
}

export const getStatusId = (statusName: ClickUpStatus): string => {
  return STATUS_NAME_TO_ID[statusName]
}

export const getStatusColor = (status: ClickUpStatus): string => {
  return STATUS_CONFIG[status]?.color || '#87909e'
}

export const getStatusType = (status: ClickUpStatus): string => {
  return STATUS_CONFIG[status]?.type || 'open'
}

// 🎯 IDENTIFIERA STÄNGDA ÄRENDEN baserat på status
export const isCompletedStatus = (status: ClickUpStatus): boolean => {
  return status === 'Avslutat' || status === 'Stängt - slasklogg'
}

// 🆕 PEST TYPE INTEGRATION - Från clickupFieldMapper.ts
export interface DropdownOption {
  id: string
  name: string
  color?: string | null
  orderindex: number
}

export const PEST_TYPE_OPTIONS: Readonly<DropdownOption[]> = [
  { id: "6ba02f78-49e5-4298-aad9-c2051551152b", name: "Råttor", color: "#AF7E2E", orderindex: 0 },
  { id: "1c590bf2-60dd-4494-8805-06ba90f4630f", name: "Möss", color: "#800000", orderindex: 1 },
  { id: "5f9f1088-d2d7-4111-93ab-a2a3e9bda045", name: "Vägglöss", color: "#ff7800", orderindex: 2 },
  { id: "755f063f-ba3c-4d45-a520-935e5d9be210", name: "Pälsänger", color: "#2ecd6f", orderindex: 3 },
  { id: "11adf69f-347e-42c8-825a-c12f897e3428", name: "Silverfisk", color: "#FF7FAB", orderindex: 4 },
  { id: "0d77a899-2948-4e03-8085-14ebfce5693a", name: "Getingar", color: "#f9d900", orderindex: 5 },
  { id: "336cc6d5-f8a4-4fc3-8ec2-fe26b87d1292", name: "Fågelsäkring", color: "#667684", orderindex: 6 },
  { id: "370bf480-2a71-46e2-a7aa-ba3c8fb2ecb8", name: "Kackerlackor", color: "#1bbc9c", orderindex: 7 },
  { id: "45f4dcca-47fb-488e-9818-3783e8f0cb82", name: "Mjölbaggar", color: "#918479", orderindex: 8 },
  { id: "12717b47-6ab7-41f4-8441-a83702527ecf", name: "Klädesmal", color: "#FF4081", orderindex: 9 },
  { id: "a47201a6-a919-4fea-b147-e317cc9f838c", name: "Myror", color: "#9b59b6", orderindex: 10 },
  { id: "8c4d9362-be35-4ad3-b739-b572fd9f084d", name: "Flugor", color: "#EA80FC", orderindex: 11 },
  { id: "636693c7-2125-4974-811d-8e2ef03788a4", name: "Inspektion", color: "#81B1FF", orderindex: 12 },
  { id: "745ac0c4-c3a9-4e7d-80d0-94518ec51681", name: "Loppor", color: "#0231E8", orderindex: 13 },
  { id: "50ba931f-a729-42a4-b29a-b5b4e302c66b", name: "Flygande insekt", color: "#E65100", orderindex: 14 },
  { id: "da228f74-c9ca-495b-8ee4-9af68f7501be", name: "Krypande insekt", color: "#EA80FC", orderindex: 15 },
  { id: "12e16cbe-8cee-4de1-b9aa-9ab0621cec36", name: "Skadedjursavtal", color: "#1bbc9c", orderindex: 16 },
  { id: "f80693cd-25db-4cf4-9346-04b6381d63eb", name: "Hundsök - Vägglöss", color: null, orderindex: 17 },
  { id: "363d9058-a999-43c7-a44c-35a10aadc603", name: "Liksanering", color: "#b5bcc2", orderindex: 18 },
  { id: "6f7a0282-6483-487b-b754-19ba5ffc7073", name: "Övrigt", color: "#b5bcc2", orderindex: 19 }
];

export const PEST_TYPES = PEST_TYPE_OPTIONS.map(option => option.name) as readonly string[];
export type PestType = typeof PEST_TYPES[number];

export const PEST_TYPE_MAPPING: { [key: string]: string } = PEST_TYPE_OPTIONS.reduce((acc, option) => {
  acc[option.orderindex.toString()] = option.name;
  acc[option.id] = option.name;
  return acc;
}, {} as { [key: string]: string });

// 👥 ASSIGNEE & DATUM INTERFACES
export interface CaseAssignee {
  id?: string
  name: string
  email: string
  role?: 'primary' | 'secondary' | 'tertiary'
}

export interface CaseDateInfo {
  start_date?: string        // YYYY-MM-DD HH:MM:SS (timestamptz)
  due_date?: string         // YYYY-MM-DD HH:MM:SS (timestamptz)
  completed_date?: string   // YYYY-MM-DD HH:MM:SS - 🆕 När ärendet stängdes
  // Hjälpfunktioner för svenska format
  start_date_swedish?: string    // DD/MM YYYY HH:MM
  due_date_swedish?: string      // DD/MM YYYY HH:MM
  completed_date_swedish?: string // DD/MM YYYY HH:MM
}

// Helper för att identifiera case-typ
export interface CaseTypeInfo {
  table: 'private_cases' | 'business_cases'
  list_id: string
  display_name: string
}

// 🆕 BEGONE CASE TYPER - ALLA EXPORTS TILLAGDA
export type PrivateCasesRow = Database['public']['Tables']['private_cases']['Row']
export type PrivateCasesInsert = Database['public']['Tables']['private_cases']['Insert']
export type PrivateCasesUpdate = Database['public']['Tables']['private_cases']['Update']

export type BusinessCasesRow = Database['public']['Tables']['business_cases']['Row']
export type BusinessCasesInsert = Database['public']['Tables']['business_cases']['Insert']
export type BusinessCasesUpdate = Database['public']['Tables']['business_cases']['Update']

// Union type för flexibel hantering
export type BeGoneCaseRow = PrivateCasesRow | BusinessCasesRow

// Befintliga hjälptyper
export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export type ContractType = Database['public']['Tables']['contract_types']['Row']

// ✅ UPPDATERAD TECHNICIAN TYPE MED WORK_SCHEDULE + HJÄLPFÄLT
export type Technician = Database['public']['Tables']['technicians']['Row'] & {
  // Autentisering hjälpfält
  has_login?: boolean
  user_id?: string | null
  display_name?: string
  auth_is_active?: boolean
}

export type TechnicianInsert = Database['public']['Tables']['technicians']['Insert']
export type TechnicianUpdate = Database['public']['Tables']['technicians']['Update']

export type Case = Database['public']['Tables']['cases']['Row']
export type CaseInsert = Database['public']['Tables']['cases']['Insert']
export type CaseUpdate = Database['public']['Tables']['cases']['Update']

export type MonthlyMarketingSpend = Database['public']['Tables']['monthly_marketing_spend']['Row']
export type MonthlyMarketingSpendInsert = Database['public']['Tables']['monthly_marketing_spend']['Insert']
export type MonthlyMarketingSpendUpdate = Database['public']['Tables']['monthly_marketing_spend']['Update']

// ✅ BILLING AUDIT LOG TYPE
export type BillingAuditLog = Database['public']['Tables']['billing_audit_log']['Row']
export type BillingAuditLogInsert = Database['public']['Tables']['billing_audit_log']['Insert']
export type BillingAuditLogUpdate = Database['public']['Tables']['billing_audit_log']['Update']

// 🆕 CONTRACTS TYPES
export type Contract = Database['public']['Tables']['contracts']['Row']
export type ContractInsert = Database['public']['Tables']['contracts']['Insert']
export type ContractUpdate = Database['public']['Tables']['contracts']['Update']

// 🆕 CONTRACT FILES TYPES
export type ContractFile = Database['public']['Tables']['contract_files']['Row']
export type ContractFileInsert = Database['public']['Tables']['contract_files']['Insert']
export type ContractFileUpdate = Database['public']['Tables']['contract_files']['Update']

// ✅ TECHNICIAN ABSENCE TYPE  
export type TechnicianAbsence = Database['public']['Tables']['technician_absences']['Row']
export type TechnicianAbsenceInsert = Database['public']['Tables']['technician_absences']['Insert']
export type TechnicianAbsenceUpdate = Database['public']['Tables']['technician_absences']['Update']

// 👨‍🔧 KÄNDA TEKNIKER (uppdaterade från din gamla fil)
export const KNOWN_TECHNICIANS = [
  { name: 'Sofia Pålshagen', email: 'sofia.palshagen@begone.se' },
  { name: 'Benny Linden', email: 'benny.linden@begone.se' },
  { name: 'Kristian Agnevik', email: 'kristian.agnevik@begone.se' },
  { name: 'Christian Karlsson', email: 'christian.karlsson@begone.se' },
  { name: 'Hans Norman', email: 'hans.norman@begone.se' },
  { name: 'Mathias Carlsson', email: 'mathias.carlsson@begone.se' },
  { name: 'Kim Wahlberg', email: 'kim.wahlberg@begone.se' },
  { name: 'Jakob Wahlberg', email: 'jakob.wahlberg@begone.se' }
] as const

export const TECHNICIAN_ROLES = [
  'Skadedjurstekniker',
  'VD',
  'Marknad & Försäljningschef',
  'Regionchef Dalarna',
  'Koordinator/kundtjänst',
  'Annan'
] as const

export type TechnicianRole = typeof TECHNICIAN_ROLES[number]

// Formulärdata-typer (från gamla filen)
export type CustomerFormData = {
  company_name: string
  org_number: string
  contact_person: string
  email: string
  phone: string
  address: string
  contract_type_id: string
  business_type: string
  
  contract_start_date: string
  contract_length_months: string
  contract_end_date: string
  annual_premium: string
  total_contract_value: string
  contract_description: string
  assigned_account_manager: string
}

export type TechnicianFormData = {
  name: string
  role: TechnicianRole
  email: string
  direct_phone: string
  office_phone: string
  address: string
  abax_vehicle_id: string // 🆕 TILLAGD ABAX_VEHICLE_ID
  work_schedule?: WorkSchedule | null // 🆕 TILLAGD WORK_SCHEDULE
}

export type SpendFormData = {
  month: string
  spend: string
  notes: string
}

// Konstanter & Hjälpfunktioner (från gamla filen)
export const ACCOUNT_MANAGERS = [
  { value: 'christian.karlsson@begone.se', label: 'Christian Karlsson' },
  { value: 'kristian.agnevik@begone.se', label: 'Kristian Agnevik' },
  { value: 'sofia.palshagen@begone.se', label: 'Sofia Pålshagen' },
  { value: 'hans.norman@begone.se', label: 'Hans Norman' }
] as const

export type AccountManager = typeof ACCOUNT_MANAGERS[number]['value']

// 🆕 WORK_SCHEDULE HJÄLPFUNKTIONER
export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  monday: { start: "08:00", end: "17:00", active: true },
  tuesday: { start: "08:00", end: "17:00", active: true },
  wednesday: { start: "08:00", end: "17:00", active: true },
  thursday: { start: "08:00", end: "17:00", active: true },
  friday: { start: "08:00", end: "17:00", active: true },
  saturday: { start: "08:00", end: "17:00", active: false },
  sunday: { start: "08:00", end: "17:00", active: false }
}

export const WEEKDAY_NAMES: { [key in keyof WorkSchedule]: string } = {
  monday: 'Måndag',
  tuesday: 'Tisdag',
  wednesday: 'Onsdag',
  thursday: 'Torsdag',
  friday: 'Fredag',
  saturday: 'Lördag',
  sunday: 'Söndag'
}

export const isWorkingDay = (schedule: WorkSchedule | null, dayKey: keyof WorkSchedule): boolean => {
  if (!schedule) return false
  return schedule[dayKey]?.active || false
}

export const getWorkingHours = (schedule: WorkSchedule | null, dayKey: keyof WorkSchedule): { start: string; end: string } | null => {
  if (!schedule || !schedule[dayKey]?.active) return null
  return {
    start: schedule[dayKey].start,
    end: schedule[dayKey].end
  }
}

export const formatWorkingHours = (schedule: WorkSchedule | null, dayKey: keyof WorkSchedule): string => {
  const hours = getWorkingHours(schedule, dayKey)
  if (!hours) return 'Ledig'
  return `${hours.start} - ${hours.end}`
}

export const getTotalWorkingHoursPerWeek = (schedule: WorkSchedule | null): number => {
  if (!schedule) return 0
  
  let totalHours = 0
  Object.keys(schedule).forEach(dayKey => {
    const day = schedule[dayKey as keyof WorkSchedule]
    if (day.active) {
      const startTime = new Date(`2024-01-01T${day.start}:00`)
      const endTime = new Date(`2024-01-01T${day.end}:00`)
      const diffMs = endTime.getTime() - startTime.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      totalHours += diffHours
    }
  })
  
  return totalHours
}

export const validateWorkSchedule = (schedule: WorkSchedule): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  Object.entries(schedule).forEach(([dayKey, daySchedule]) => {
    if (daySchedule.active) {
      const startTime = new Date(`2024-01-01T${daySchedule.start}:00`)
      const endTime = new Date(`2024-01-01T${daySchedule.end}:00`)
      
      if (startTime >= endTime) {
        errors.push(`${WEEKDAY_NAMES[dayKey as keyof WorkSchedule]}: Starttid måste vara före sluttid`)
      }
      
      const diffMs = endTime.getTime() - startTime.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      
      if (diffHours > 16) {
        errors.push(`${WEEKDAY_NAMES[dayKey as keyof WorkSchedule]}: Arbetsdagen kan inte vara längre än 16 timmar`)
      }
      
      if (diffHours < 1) {
        errors.push(`${WEEKDAY_NAMES[dayKey as keyof WorkSchedule]}: Arbetsdagen måste vara minst 1 timme`)
      }
    }
  })
  
  const totalHours = getTotalWorkingHoursPerWeek(schedule)
  if (totalHours > 60) {
    errors.push('Total arbetstid per vecka kan inte överstiga 60 timmar')
  }
  
  return { isValid: errors.length === 0, errors }
}

// 📅 DATUM-HJÄLPFUNKTIONER
export const formatSwedishDate = (dateString?: string): string => {
  if (!dateString) return '-'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    })
  } catch {
    return 'Ogiltigt datum'
  }
}

export const formatSwedishDateTime = (timestamp?: string): string => {
  if (!timestamp) return '-'
  
  try {
    const date = new Date(timestamp)
    return date.toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Ogiltigt datum'
  }
}

// BEFINTLIGA HJÄLPFUNKTIONER (från gamla filen)
export const calculateContractEndDate = (startDate: string, lengthInMonths: number): string => {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + lengthInMonths)
  return end.toISOString().split('T')[0]
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
    isExpiringSoon: diffDays <= 90,
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
    return { text: 'Inget slutdatum', color: 'text-slate-400', bgColor: 'bg-slate-500/10', daysLeft: null }
  }

  const now = new Date()
  const endDate = new Date(customer.contract_end_date)
  const timeDiff = endDate.getTime() - now.getTime()
  const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) {
    return { text: `Utgånget ${Math.abs(daysLeft)} dagar sedan`, color: 'text-red-400', bgColor: 'bg-red-500/10', daysLeft }
  } else if (daysLeft <= 30) {
    return { text: `${daysLeft} dagar kvar`, color: 'text-red-400', bgColor: 'bg-red-500/10', daysLeft }
  } else if (daysLeft <= 90) {
    return { text: `${daysLeft} dagar kvar`, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', daysLeft }
  } else {
    const monthsLeft = Math.ceil(daysLeft / 30)
    return { text: `${monthsLeft} månader kvar`, color: 'text-green-400', bgColor: 'bg-green-500/10', daysLeft }
  }
}

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
    return { urgency: 'critical', message: 'Avtalet har gått ut', actionNeeded: true }
  } else if (timeRemaining.days <= 30) {
    return { urgency: 'critical', message: 'Avtalet löper ut inom 30 dagar', actionNeeded: true }
  } else if (timeRemaining.days <= 90) {
    return { urgency: 'high', message: 'Avtalet löper ut inom 3 månader', actionNeeded: true }
  } else if (timeRemaining.days <= 180) {
    return { urgency: 'medium', message: 'Avtalet löper ut inom 6 månader', actionNeeded: false }
  } else {
    return { urgency: 'low', message: 'Avtalet är stabilt', actionNeeded: false }
  }
}

export const validateContractDates = (startDate: string, endDate: string): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (start >= end) {
    errors.push('Slutdatum måste vara efter startdatum')
  }
  
  const contractLengthDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (contractLengthDays < 30) {
    errors.push('Avtalet måste vara minst 30 dagar långt')
  }
  
  if (contractLengthDays > 365 * 10) {
    errors.push('Avtalet kan inte vara längre än 10 år')
  }
  
  return { isValid: errors.length === 0, errors }
}

export const formatSpendMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-')
  const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

export const getCurrentMonth = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export const validateSpendData = (spend: number, month: string): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  
  if (spend < 0) {
    errors.push('Utgift kan inte vara negativ')
  }
  if (spend > 10000000) {
    errors.push('Utgift verkar orealistiskt hög')
  }
  
  const monthDate = new Date(month)
  const twoYearsFromNow = new Date()
  twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2)
  
  if (monthDate > twoYearsFromNow) {
    errors.push('Datum kan inte vara mer än 2 år i framtiden')
  }
  
  return { isValid: errors.length === 0, errors }
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0
  }).format(amount)
}

export const getMonthRange = (startMonth: string, endMonth: string): string[] => {
  const start = new Date(startMonth)
  const end = new Date(endMonth)
  const months: string[] = []
  
  const current = new Date(start)
  while (current <= end) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    months.push(`${year}-${month}-01`)
    current.setMonth(current.getMonth() + 1)
  }
  
  return months
}

export const getPreviousMonth = (monthStr: string): string => {
  const date = new Date(monthStr)
  date.setMonth(date.getMonth() - 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export const getNextMonth = (monthStr: string): string => {
  const date = new Date(monthStr)
  date.setMonth(date.getMonth() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export const isValidMonthFormat = (monthStr: string): boolean => {
  const regex = /^\d{4}-\d{2}-01$/
  if (!regex.test(monthStr)) return false
  
  const date = new Date(monthStr)
  return !isNaN(date.getTime())
}

// 🆕 HJÄLPFUNKTIONER FÖR KOORDINATOR SCHEMA - MED TIDSSTÄMPLAR
export const formatScheduleDateTime = (timestampStr?: string): string => {
  if (!timestampStr) return '-'
  
  try {
    const date = new Date(timestampStr)
    return date.toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Ogiltigt datum'
  }
}

export const formatScheduleTime = (timestampStr?: string): string => {
  if (!timestampStr) return '-'
  
  try {
    const date = new Date(timestampStr)
    return date.toLocaleDateString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '-'
  }
}

export const parseScheduleTimestamp = (timestampStr: string): Date | null => {
  try {
    return new Date(timestampStr)
  } catch {
    return null
  }
}

// Helper för att konvertera datum till FullCalendar-format
export const toFullCalendarDate = (timestampStr?: string): string | undefined => {
  if (!timestampStr) return undefined
  
  try {
    const date = new Date(timestampStr)
    return date.toISOString()
  } catch {
    return undefined
  }
}

// Helper för att avgöra om ett ärende är schemalagt idag
export const isScheduledToday = (start_date?: string, due_date?: string): boolean => {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD
  
  if (start_date) {
    const startDate = new Date(start_date)
    const startDateStr = startDate.toISOString().split('T')[0]
    if (startDateStr === todayStr) return true
  }
  
  if (due_date) {
    const dueDate = new Date(due_date)
    const dueDateStr = dueDate.toISOString().split('T')[0]
    if (dueDateStr === todayStr) return true
  }
  
  return false
}

// Helper för att filtrera ärenden som inte har någon schemalagd tid (oplanerade)
export const isUnplannedCase = (caseData: BeGoneCaseRow): boolean => {
  return !caseData.start_date && !caseData.due_date
}

// Helper för att filtrera schemalagda ärenden
export const isScheduledCase = (caseData: BeGoneCaseRow): boolean => {
  return !!(caseData.start_date || caseData.due_date)
}
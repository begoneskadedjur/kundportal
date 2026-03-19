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
          // Basic Customer Information
          company_name: string
          organization_number: string | null
          contact_person: string | null
          contact_email: string
          contact_phone: string | null
          contact_address: string | null
          
          // OneFlow Contract Linking
          oneflow_contract_id: string | null
          created_from_contract_id: string | null
          
          // Contract Details
          contract_template_id: string | null
          contract_type: string | null
          contract_status: 'signed' | 'active' | 'terminated' | 'expired'
          contract_length: string | null
          contract_start_date: string | null
          contract_end_date: string | null

          // Termination
          terminated_at: string | null
          termination_reason: string | null
          effective_end_date: string | null

          // Financial Information
          total_contract_value: number | null
          annual_value: number | null
          monthly_value: number | null
          currency: string | null
          
          // Agreement Content
          agreement_text: string | null
          products: any | null // JSONB
          product_summary: string | null
          service_details: string | null
          
          // Billing Information
          billing_email: string | null
          billing_address: string | null
          
          // Account Management
          assigned_account_manager: string | null
          account_manager_email: string | null
          sales_person: string | null
          sales_person_email: string | null
          
          // Business Intelligence
          business_type: string | null
          industry_category: string | null
          customer_size: 'small' | 'medium' | 'large' | null
          service_frequency: string | null
          
          // Metadata
          source_type: 'oneflow' | 'manual' | 'import' | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          
          // 💰 Billing Settings
          price_list_id: string | null  // FK till price_lists
          billing_frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand' | null
          billing_type: 'consolidated' | 'per_site' | null
          billing_reference: string | null
          cost_center: string | null
          billing_recipient: string | null

          // 🏢 Multisite Support
          organization_id: string | null  // FK till multisite_organizations
          is_multisite: boolean
          
          // 🆕 Multisite hierarki
          site_name: string | null  // Namnet på enheten/siten
          site_code: string | null  // Unik kod för enheten
          parent_customer_id: string | null  // FK till huvudorganisationens customer
          region: string | null  // Region för enheten
          site_type: 'huvudkontor' | 'enhet' | null  // Typ av multisite-enhet

          // Kundgrupp & kundnummer
          customer_group_id: string | null
          customer_number: number | null
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          contract_status?: 'signed' | 'active' | 'terminated' | 'expired'
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
          customer_id: string | null  // Koppling till avtalskund
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
          work_report: string | null
          files: any | null // jsonb
          assigned_technician_name: string | null
          assigned_technician_email: string | null
          assigned_technician_id: string | null // FK till technicians
          contact_person: string | null
          contact_email: string | null
          contact_phone: string | null
          // Offert- och rapportfält
          quote_generated_at: string | null
          report_generated_at: string | null
          quote_status: 'pending' | 'sent' | 'signed' | 'rejected' | 'expired' | null
          quote_sent_at: string | null
          quote_signed_at: string | null
          quote_rejected_at: string | null
          oneflow_contract_id: string | null
          // 🚦 Traffic Light System (endast för avtalskunder)
          pest_level: 0 | 1 | 2 | 3 | null  // 0=None, 1=Low, 2=Medium, 3=High
          problem_rating: 1 | 2 | 3 | 4 | 5 | null  // 1=Excellent to 5=Critical
          site_id: string | null  // FK till organization_sites för multisite
          assessment_date: string | null
          assessed_by: string | null
          pest_level_trend: 'improving' | 'stable' | 'worsening' | null
          // Billing fields for contract customers
          billing_status: 'pending' | 'sent' | 'paid' | 'skip' | null
          billing_updated_at: string | null
          billing_updated_by_id: string | null
          // Provision
          is_commission_eligible: boolean
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
          is_commission_eligible: boolean

          // ✅ FÖLJEÄRENDE-FÄLT (för att länka relaterade ärenden)
          parent_case_id: string | null  // Referens till ursprungsärendet
          created_by_technician_id: string | null  // Tekniker som skapade följeärendet
          created_by_technician_name: string | null  // Namn på teknikern

          // Stängningsorsak
          close_reason: string | null
          close_reason_notes: string | null
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
          company_name: string | null
          pris: number | null
          filer: any | null // JSONB
          annat_skadedjur: string | null
          
          // ✅ PROVISIONSKOLUMNER TILLAGDA
          commission_amount: number | null
          commission_calculated_at: string | null
          billing_status: 'pending' | 'sent' | 'paid' | 'skip' | null
          is_commission_eligible: boolean

          // ✅ FÖLJEÄRENDE-FÄLT (för att länka relaterade ärenden)
          parent_case_id: string | null  // Referens till ursprungsärendet
          created_by_technician_id: string | null  // Tekniker som skapade följeärendet
          created_by_technician_name: string | null  // Namn på teknikern

          // Stängningsorsak
          close_reason: string | null
          close_reason_notes: string | null
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
          incident_recipient: boolean
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
          // ✅ TEKNIKER-INTEGRATION TILLAGD
          technician_id: string | null // FK till technicians
          role: string | null // 'admin' | 'customer' | 'technician'
          display_name: string | null // Visningsnamn för tekniker
          
          // 🏢 Multisite Support
          organization_id: string | null  // FK till multisite_organizations
          multisite_role: 'quality_manager' | 'regional_manager' | 'site_manager' | null
          site_access: string[] | null  // Array av site IDs
          region_access: string | null  // För regional managers
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
          status: 'pending' | 'signed' | 'declined' | 'active' | 'ended' | 'overdue'
          template_id: string
          
          begone_employee_name: string | null
          begone_employee_email: string | null
          contract_length: string | null
          start_date: string | null
          
          // Creator tracking (vem skapade kontraktet)
          created_by_email: string | null
          created_by_name: string | null
          created_by_role: string | null
          
          contact_person: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_address: string | null
          company_name: string | null
          organization_number: string | null
          
          agreement_text: string | null
          total_value: number | null
          
          selected_products: any | null // JSONB
          
          billing_email: string | null
          billing_address: string | null
          
          customer_id: string | null

          // Kundgrupp (vald i wizard vid avtal)
          customer_group_id: string | null

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
      // 🆕 ONEFLOW SYNC LOG TABELL
      oneflow_sync_log: {
        Row: {
          id: string
          event_type: string
          oneflow_contract_id: string
          status: 'received' | 'verified' | 'processed' | 'error'
          details: any // JSONB
          error_message: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['oneflow_sync_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['oneflow_sync_log']['Insert']>
      }
      // 🆕 QUOTE RECIPIENTS TABELL - för notifikationsstatus
      quote_recipients: {
        Row: {
          id: string
          quote_id: string
          user_email: string
          recipient_role: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
          organization_id: string | null
          notification_type: 'direct' | 'cascade' | null
          cascade_reason: string | null
          seen_at: string | null
          dismissed_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['quote_recipients']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['quote_recipients']['Insert']>
      }
      // 🆕 LEADS TABELL - för lead pipeline hantering
      leads: {
        Row: {
          id: string
          // Obligatorisk huvudinformation
          company_name: string
          contact_person: string
          phone_number: string
          email: string
          status: 'red_lost' | 'blue_cold' | 'yellow_warm' | 'orange_hot' | 'green_deal'
          
          // Frivillig företagsinformation
          organization_number: string | null
          business_type: string | null
          problem_type: string | null
          address: string | null
          website: string | null
          company_size: 'small' | 'medium' | 'large' | 'enterprise' | null
          business_description: string | null
          sni07_label: string | null
          
          // Lead-hantering & uppföljning
          notes: string | null
          contact_method: 'mail' | 'phone' | 'visit' | null
          contact_date: string | null
          follow_up_date: string | null
          interested_in_quote: boolean
          quote_provided_date: string | null
          procurement: boolean
          contract_status: boolean
          contract_with: string | null
          contract_end_date: string | null
          
          // Tracking & audit
          created_by: string
          updated_by: string
          created_at: string
          updated_at: string
          update_history: any | null // JSONB
          
          // 🆕 Utökade fält för lead-hantering
          priority: 'low' | 'medium' | 'high' | 'urgent' | null
          source: string | null // Var leadet kom ifrån (webb, telefon, referral, etc.)
          assigned_to: string | null // FK till profiles - vem som är ansvarig för leadet
          estimated_value: number | null // Uppskattat affärsvärde
          probability: number | null // Sannolikhet för affär (0-100%)
          closing_date_estimate: string | null // Uppskattat slutdatum för affär
          competitor: string | null // Konkurrent som leadet jämför med
          decision_maker: string | null // Beslutsfattare
          budget_confirmed: boolean
          timeline_confirmed: boolean
          authority_confirmed: boolean
          needs_confirmed: boolean
          tags: string[] | null // Array av tags för kategorisering
        }
        Insert: Omit<Database['public']['Tables']['leads']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
      }
      // 🆕 LEAD CONTACTS TABELL - för kontaktpersoner till leads
      lead_contacts: {
        Row: {
          id: string
          lead_id: string
          name: string
          title: string | null
          phone: string | null
          email: string | null
          is_primary: boolean
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null  // 🔧 TILLAGD: created_by
          updated_by: string | null  // 🔧 TILLAGD: updated_by
        }
        Insert: Omit<Database['public']['Tables']['lead_contacts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['lead_contacts']['Insert']>
      }
      // 🆕 CUSTOMER CONTACTS TABELL - för kontaktpersoner till kunder
      customer_contacts: {
        Row: {
          id: string
          customer_id: string
          name: string
          title: string | null
          responsibility_area: string | null
          phone: string | null
          email: string | null
          is_primary: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['customer_contacts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customer_contacts']['Insert']>
      }
      // 🆕 LEAD COMMENTS TABELL - för kommentarer och anteckningar
      lead_comments: {
        Row: {
          id: string
          lead_id: string
          content: string  // 🔧 KORRIGERAD: content istället för comment
          comment_type: 'note' | 'follow_up' | 'meeting' | 'call' | 'email'
          created_by: string
          is_internal: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lead_comments']['Insert']>
      }
      // 🆕 LEAD EVENTS TABELL - för händelser och aktiviteter
      lead_events: {
        Row: {
          id: string
          lead_id: string
          event_type: 'created' | 'updated' | 'status_changed' | 'contacted' | 'meeting' | 'quote_sent' | 'quote_accepted' | 'quote_rejected' | 'assigned' | 'note_added'  // 🔧 KORRIGERADE event_type värden
          title: string  // 🔧 TILLAGD: title är obligatorisk
          description: string | null
          event_date: string | null  // 🔧 TILLAGD: event_date
          data: any | null // 🔧 KORRIGERAD: data istället för event_data
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lead_events']['Insert']>
      }
      // 🆕 LEAD SNI CODES TABELL - för SNI-kod mappningar
      lead_sni_codes: {
        Row: {
          id: string
          lead_id: string  // 🔧 TILLAGD: lead_id FK
          sni_code: string
          sni_description: string | null  // 🔧 KORRIGERAD: kan vara null
          is_primary: boolean  // 🔧 KORRIGERAD: is_primary istället för category och is_active
          created_at: string
          created_by: string | null  // 🔧 TILLAGD: created_by
        }
        Insert: Omit<Database['public']['Tables']['lead_sni_codes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lead_sni_codes']['Insert']>
      }
      // 🆕 LEAD TECHNICIANS TABELL - många-till-många relation leads <-> technicians
      lead_technicians: {
        Row: {
          id: string
          lead_id: string
          technician_id: string
          is_primary: boolean
          assigned_at: string
          assigned_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_technicians']['Row'], 'id' | 'created_at' | 'assigned_at'>
        Update: Partial<Database['public']['Tables']['lead_technicians']['Insert']>
      }
    }
  }
}

// 🎯 CLICKUP STATUS SYSTEM - EXACT internal statuses (used in database, dropdowns, coordinator/technician views)
export type ClickUpStatus =
  | 'Öppen'
  | 'Bokad'  // Note: "Bokat" variant also exists in some places
  | 'Offert skickad'
  | 'Offert signerad - boka in'
  | 'Återbesök'  // General revisit status (unlimited revisits, local only - not synced to ClickUp)
  | 'Återbesök 1'
  | 'Återbesök 2'
  | 'Återbesök 3'
  | 'Återbesök 4'
  | 'Återbesök 5'
  | 'Privatperson - review'  // NEVER show in dropdowns or to customers
  | 'Stängt - slasklogg'
  | 'Avslutat'
  // Legacy/deprecated statuses that may exist in data:
  | 'Bokat'  // Alternative spelling of Bokad
  | 'Bomkörning'
  | 'Generera saneringsrapport'
  | 'Ombokning'
  | 'Reklamation'

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
  'Bokad': 'c127553498_E9tR4uKl',
  'Återbesök': 'local_revisit',  // Local status - not synced to ClickUp
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
  'Bokad': { id: 'c127553498_E9tR4uKl', color: '#f8ae00', type: 'custom', orderindex: 1 },
  'Återbesök': { id: 'local_revisit', color: '#1090e0', type: 'custom', orderindex: 2 },  // Same color as numbered revisits
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

// 👥 CUSTOMER-FACING STATUS DISPLAY MAPPING
// Maps internal statuses to customer-friendly display names
export const getCustomerStatusDisplay = (status: ClickUpStatus): string => {
  switch (status) {
    case 'Öppen':
      return 'Öppen'
    case 'Bokad':
    case 'Bokat':
      return 'Bokad'
    case 'Offert skickad':
      return 'Offert skickad'
    case 'Offert signerad - boka in':
      return 'Offert Signerad'
    case 'Återbesök':
    case 'Återbesök 1':
    case 'Återbesök 2':
    case 'Återbesök 3':
    case 'Återbesök 4':
    case 'Återbesök 5':
      return 'Pågående'
    case 'Privatperson - review':
      return 'Under granskning' // Should rarely be shown to customers
    case 'Stängt - slasklogg':
      return 'Avslutat utan åtgärd'
    case 'Avslutat':
      return 'Genomfört'
    // Legacy statuses - handle gracefully
    case 'Bomkörning':
    case 'Generera saneringsrapport':
    case 'Ombokning':
    case 'Reklamation':
      return 'Under behandling'
    default:
      return status // Fallback to original status
  }
}

// 📋 DROPDOWN-FRIENDLY STATUSES (excludes customer-hidden statuses)
export const DROPDOWN_STATUSES: ClickUpStatus[] = [
  'Öppen',
  'Bokad',
  'Offert skickad',
  'Offert signerad - boka in',
  'Återbesök',  // General revisit status
  'Återbesök 1',
  'Återbesök 2',
  'Återbesök 3',
  'Återbesök 4',
  'Återbesök 5',
  'Stängt - slasklogg',
  'Avslutat'
  // Note: 'Privatperson - review' is excluded from dropdowns
]

// 📊 ALL VALID STATUSES FOR FILTERING (includes all statuses)
export const ALL_VALID_STATUSES: ClickUpStatus[] = [
  'Öppen',
  'Bokad',
  'Bokat', // Alternative spelling
  'Offert skickad',
  'Offert signerad - boka in',
  'Återbesök',  // General revisit status
  'Återbesök 1',
  'Återbesök 2',
  'Återbesök 3',
  'Återbesök 4',
  'Återbesök 5',
  'Privatperson - review',
  'Stängt - slasklogg',
  'Avslutat',
  // Legacy statuses
  'Bomkörning',
  'Generera saneringsrapport',
  'Ombokning',
  'Reklamation'
]

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

// Union type för flexibel hantering med extra fält för koordinatorvyn
export type BeGoneCaseRow = (PrivateCasesRow | BusinessCasesRow) & {
  parent_customer_id?: string | null  // För multisite-enheter
  oneflow_contract_id?: string | null // Koppling till Oneflow-offert (för contract cases)
  company_name?: string | null // Företagsnamn (business_cases + contract via adaptCaseToBeGoneRow)
}

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

// 🆕 ONEFLOW SYNC LOG TYPES
export type OneflowSyncLog = Database['public']['Tables']['oneflow_sync_log']['Row']
export type OneflowSyncLogInsert = Database['public']['Tables']['oneflow_sync_log']['Insert']
export type OneflowSyncLogUpdate = Database['public']['Tables']['oneflow_sync_log']['Update']

// 🆕 QUOTE RECIPIENTS TYPES
export type QuoteRecipient = Database['public']['Tables']['quote_recipients']['Row']
export type QuoteRecipientInsert = Database['public']['Tables']['quote_recipients']['Insert']
export type QuoteRecipientUpdate = Database['public']['Tables']['quote_recipients']['Update']

// 🆕 LEADS TYPES - för lead pipeline hantering
export type Lead = Database['public']['Tables']['leads']['Row']
export type LeadInsert = Database['public']['Tables']['leads']['Insert']
export type LeadUpdate = Database['public']['Tables']['leads']['Update']

// 🆕 CUSTOMER CONTACTS TYPES
export type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']
export type CustomerContactInsert = Database['public']['Tables']['customer_contacts']['Insert']
export type CustomerContactUpdate = Database['public']['Tables']['customer_contacts']['Update']

// 🆕 LEAD CONTACTS TYPES
export type LeadContact = Database['public']['Tables']['lead_contacts']['Row']
export type LeadContactInsert = Database['public']['Tables']['lead_contacts']['Insert']
export type LeadContactUpdate = Database['public']['Tables']['lead_contacts']['Update']

// 🆕 LEAD COMMENTS TYPES
export type LeadComment = Database['public']['Tables']['lead_comments']['Row']
export type LeadCommentInsert = Database['public']['Tables']['lead_comments']['Insert']
export type LeadCommentUpdate = Database['public']['Tables']['lead_comments']['Update']

// 🆕 LEAD EVENTS TYPES
export type LeadEvent = Database['public']['Tables']['lead_events']['Row']
export type LeadEventInsert = Database['public']['Tables']['lead_events']['Insert']
export type LeadEventUpdate = Database['public']['Tables']['lead_events']['Update']

// 🆕 LEAD SNI CODES TYPES
export type LeadSniCode = Database['public']['Tables']['lead_sni_codes']['Row']
export type LeadSniCodeInsert = Database['public']['Tables']['lead_sni_codes']['Insert']
export type LeadSniCodeUpdate = Database['public']['Tables']['lead_sni_codes']['Update']

// 🆕 LEAD TECHNICIANS TYPES (many-to-many)
export type LeadTechnician = Database['public']['Tables']['lead_technicians']['Row']
export type LeadTechnicianInsert = Database['public']['Tables']['lead_technicians']['Insert']
export type LeadTechnicianUpdate = Database['public']['Tables']['lead_technicians']['Update']

// 🆕 LEAD WITH RELATIONS - inkluderar alla relaterade data
export type LeadWithRelations = Lead & {
  lead_contacts?: LeadContact[]
  lead_comments?: LeadComment[]
  lead_events?: LeadEvent[]
  created_by_profile?: {
    display_name: string | null
    email: string
  }
  updated_by_profile?: {
    display_name: string | null
    email: string
  }
}

export type LeadStatus = 'red_lost' | 'blue_cold' | 'yellow_warm' | 'orange_hot' | 'green_deal'
export type ContactMethod = 'mail' | 'phone' | 'visit'
export type CompanySize = 'small' | 'medium' | 'large' | 'enterprise'
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CommentType = 'note' | 'follow_up' | 'meeting' | 'call' | 'email'

// 🆕 EVENT TYPE ENUM för olika händelsetyper - 🔧 UPPDATERAD
export type EventType = 'created' | 'updated' | 'status_changed' | 'contacted' | 'meeting' | 'quote_sent' | 'quote_accepted' | 'quote_rejected' | 'assigned' | 'note_added'

// Status display mappings för UI
export const LEAD_STATUS_DISPLAY = {
  red_lost: { label: 'Förlorad', color: 'red-500', badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20', dotClass: 'bg-red-500', textClass: 'text-red-500' },
  blue_cold: { label: 'Kall', color: 'blue-500', badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20', dotClass: 'bg-blue-500', textClass: 'text-blue-500' },
  yellow_warm: { label: 'Ljummen', color: 'yellow-500', badgeClass: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', dotClass: 'bg-yellow-500', textClass: 'text-yellow-500' },
  orange_hot: { label: 'Het', color: 'orange-500', badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20', dotClass: 'bg-orange-500', textClass: 'text-orange-500' },
  green_deal: { label: 'Affär', color: 'green-500', badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20', dotClass: 'bg-green-500', textClass: 'text-green-500' }
} as const

export const CONTACT_METHOD_DISPLAY = {
  mail: { label: 'Mail', icon: 'Mail' },
  phone: { label: 'Samtal', icon: 'Phone' },
  visit: { label: 'Besök', icon: 'MapPin' }
} as const

export const COMPANY_SIZE_DISPLAY = {
  small: { label: 'Litet företag (1-10 anställda)' },
  medium: { label: 'Medelstort företag (11-50 anställda)' },
  large: { label: 'Stort företag (51-250 anställda)' },
  enterprise: { label: 'Storföretag (250+ anställda)' }
} as const

// 🆕 EVENT TYPE DISPLAY för händelsetyper - 🔧 UPPDATERAD
export const EVENT_TYPE_DISPLAY = {
  created: { label: 'Skapad', icon: 'Plus', color: 'green-500', badgeClass: 'bg-green-500/20 text-green-500', iconClass: 'bg-green-500/10 border-green-500/30 text-green-500' },
  updated: { label: 'Uppdaterad', icon: 'Edit', color: 'blue-500', badgeClass: 'bg-blue-500/20 text-blue-500', iconClass: 'bg-blue-500/10 border-blue-500/30 text-blue-500' },
  status_changed: { label: 'Statusändring', icon: 'RotateCcw', color: 'blue-500', badgeClass: 'bg-blue-500/20 text-blue-500', iconClass: 'bg-blue-500/10 border-blue-500/30 text-blue-500' },
  contacted: { label: 'Kontaktad', icon: 'Phone', color: 'green-500', badgeClass: 'bg-green-500/20 text-green-500', iconClass: 'bg-green-500/10 border-green-500/30 text-green-500' },
  meeting: { label: 'Möte', icon: 'Calendar', color: 'purple-500', badgeClass: 'bg-purple-500/20 text-purple-500', iconClass: 'bg-purple-500/10 border-purple-500/30 text-purple-500' },
  quote_sent: { label: 'Offert skickad', icon: 'FileText', color: 'orange-500', badgeClass: 'bg-orange-500/20 text-orange-500', iconClass: 'bg-orange-500/10 border-orange-500/30 text-orange-500' },
  quote_accepted: { label: 'Offert accepterad', icon: 'CheckCircle', color: 'green-600', badgeClass: 'bg-green-600/20 text-green-500', iconClass: 'bg-green-600/10 border-green-600/30 text-green-500' },
  quote_rejected: { label: 'Offert avvisad', icon: 'XCircle', color: 'red-500', badgeClass: 'bg-red-500/20 text-red-500', iconClass: 'bg-red-500/10 border-red-500/30 text-red-500' },
  assigned: { label: 'Tilldelad', icon: 'UserCheck', color: 'indigo-500', badgeClass: 'bg-indigo-500/20 text-indigo-500', iconClass: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500' },
  note_added: { label: 'Anteckning tillagd', icon: 'StickyNote', color: 'gray-500', badgeClass: 'bg-gray-500/20 text-gray-500', iconClass: 'bg-gray-500/10 border-gray-500/30 text-gray-500' }
} as const

// 🆕 LEAD PRIORITY DISPLAY
export const LEAD_PRIORITY_DISPLAY = {
  low: { label: 'Låg', color: 'green-500', bgColor: 'bg-green-500/15', badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20' },
  medium: { label: 'Medium', color: 'yellow-500', bgColor: 'bg-yellow-500/15', badgeClass: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  high: { label: 'Hög', color: 'orange-500', bgColor: 'bg-orange-500/15', badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  urgent: { label: 'Brådskande', color: 'red-500', bgColor: 'bg-red-500/15', badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20' }
} as const

// 🆕 COMMENT TYPE DISPLAY
export const COMMENT_TYPE_DISPLAY = {
  note: { label: 'Anteckning', icon: 'StickyNote', color: 'gray-500', badgeClass: 'bg-gray-500/20 text-gray-500', iconBgClass: 'bg-gray-500/10' },
  follow_up: { label: 'Uppföljning', icon: 'Clock', color: 'yellow-500', badgeClass: 'bg-yellow-500/20 text-yellow-500', iconBgClass: 'bg-yellow-500/10' },
  meeting: { label: 'Möte', icon: 'Users', color: 'purple-500', badgeClass: 'bg-purple-500/20 text-purple-500', iconBgClass: 'bg-purple-500/10' },
  call: { label: 'Samtal', icon: 'Phone', color: 'green-500', badgeClass: 'bg-green-500/20 text-green-500', iconBgClass: 'bg-green-500/10' },
  email: { label: 'E-post', icon: 'Mail', color: 'blue-500', badgeClass: 'bg-blue-500/20 text-blue-500', iconBgClass: 'bg-blue-500/10' }
} as const

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
  annual_value: string
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
export const isScheduledCase = (caseData: BeGoneCaseRow | any): boolean => {
  // Hantera ClickUp-ärenden (private_cases/business_cases)
  if (caseData.start_date || caseData.due_date) {
    return true;
  }
  
  // Hantera avtalsärenden (cases-tabellen) med scheduled_date
  if (caseData.scheduled_date || caseData.scheduled_start || caseData.scheduled_end) {
    return true;
  }
  
  return false;
}

// 🆕 CASE IMAGES - Bildhantering för ärenden
export interface CaseImage {
  id: string
  case_id: string
  case_type: 'private' | 'business' | 'contract'
  file_path: string
  file_name: string
  file_size?: number
  mime_type?: string
  tags: CaseImageTag[]  // Ändrat från category till tags (multi-select)
  description?: string
  uploaded_by?: string
  uploaded_at: string
}

export type CaseImageInsert = Omit<CaseImage, 'id' | 'uploaded_at'>
export type CaseImageUpdate = Partial<CaseImageInsert>

// Tagg-visningsnamn för bilder (utökad med PR och Utbildning)
export const CASE_IMAGE_TAG_DISPLAY = {
  before: { label: 'Före', color: 'orange-500', icon: 'Camera' },
  after: { label: 'Efter', color: 'green-500', icon: 'CheckCircle' },
  general: { label: 'Övrigt', color: 'blue-500', icon: 'Image' },
  pr: { label: 'PR', color: 'purple-500', icon: 'Megaphone' },
  education: { label: 'Utbildning', color: 'teal-500', icon: 'GraduationCap' }
} as const

export type CaseImageTag = keyof typeof CASE_IMAGE_TAG_DISPLAY

// Legacy-alias för bakåtkompatibilitet
export const CASE_IMAGE_CATEGORY_DISPLAY = CASE_IMAGE_TAG_DISPLAY
export type CaseImageCategory = CaseImageTag

// 🆕 LEAD SYSTEM HJÄLPFUNKTIONER
export const getLeadStatusColor = (status: LeadStatus): string => {
  return LEAD_STATUS_DISPLAY[status]?.color || 'gray-500'
}

export const getLeadStatusLabel = (status: LeadStatus): string => {
  return LEAD_STATUS_DISPLAY[status]?.label || status
}

export const getPriorityColor = (priority: LeadPriority | null): string => {
  if (!priority) return 'gray-500'
  return LEAD_PRIORITY_DISPLAY[priority]?.color || 'gray-500'
}

export const getPriorityLabel = (priority: LeadPriority | null): string => {
  if (!priority) return 'Ej angiven'
  return LEAD_PRIORITY_DISPLAY[priority]?.label || priority
}

export const getEventTypeDisplay = (eventType: EventType) => {
  return EVENT_TYPE_DISPLAY[eventType] || { label: eventType, icon: 'Circle', color: 'gray-500' }
}

export const getCommentTypeDisplay = (commentType: CommentType) => {
  return COMMENT_TYPE_DISPLAY[commentType] || { label: commentType, icon: 'MessageSquare', color: 'gray-500' }
}

// Hjälpfunktion för att beräkna lead score baserat på status + BANT + sannolikhet
export const calculateLeadScore = (lead: Lead): number => {
  // Automatiska status-scores
  if (lead.status === 'red_lost') return 0      // Förlorad = 0 poäng
  if (lead.status === 'green_deal') return 100  // Affär = 100 poäng
  
  // Bas-score från status (30-50 poäng)
  let baseScore = 30 // Kall = grundnivå
  if (lead.status === 'yellow_warm') baseScore = 40  // Ljummen
  if (lead.status === 'orange_hot') baseScore = 50   // Het
  
  // BANT-poäng (0-30 poäng totalt, 7.5 poäng per faktor)
  let bantScore = 0
  if (lead.budget_confirmed) bantScore += 7.5    // Budget bekräftad
  if (lead.authority_confirmed) bantScore += 7.5 // Befogenhet bekräftad  
  if (lead.needs_confirmed) bantScore += 7.5     // Behov bekräftat
  if (lead.timeline_confirmed) bantScore += 7.5  // Tidslinje bekräftad
  
  // Sannolikhetsmodifierare (-20 till +20 poäng)
  let probabilityModifier = 0
  if (lead.probability !== null && lead.probability !== undefined) {
    if (lead.probability <= 20) probabilityModifier = -20      // 0-20%: -20p
    else if (lead.probability <= 40) probabilityModifier = -10 // 21-40%: -10p  
    else if (lead.probability <= 60) probabilityModifier = 0   // 41-60%: 0p (neutral)
    else if (lead.probability <= 80) probabilityModifier = 10  // 61-80%: +10p
    else probabilityModifier = 20                              // 81-100%: +20p
  }
  
  // Beräkna total score och säkerställ att den är inom 0-100
  const totalScore = baseScore + bantScore + probabilityModifier
  return Math.min(Math.max(totalScore, 0), 100)
}

// Hjälpfunktion för att avgöra lead kvalitet baserat på score
export const getLeadQuality = (score: number): { label: string; color: string; bgColor: string; barColor: string } => {
  if (score >= 80) return { label: 'Utmärkt', color: 'text-green-400', bgColor: 'bg-green-500/15 text-green-400', barColor: 'bg-green-500' }
  if (score >= 60) return { label: 'Bra', color: 'text-blue-400', bgColor: 'bg-blue-500/15 text-blue-400', barColor: 'bg-blue-500' }
  if (score >= 40) return { label: 'Medel', color: 'text-yellow-400', bgColor: 'bg-yellow-500/15 text-yellow-400', barColor: 'bg-yellow-500' }
  if (score >= 20) return { label: 'Svag', color: 'text-orange-400', bgColor: 'bg-orange-500/15 text-orange-400', barColor: 'bg-orange-500' }
  return { label: 'Mycket svag', color: 'text-red-400', bgColor: 'bg-red-500/15 text-red-400', barColor: 'bg-red-500' }
}

// ===== EQUIPMENT PLACEMENT TYPES =====
// System för att spåra utplacerad utrustning med GPS-koordinater

export type EquipmentType = 'mechanical_trap' | 'concrete_station' | 'bait_station'
export type EquipmentStatus = 'active' | 'removed' | 'missing' | 'damaged'

export interface EquipmentPlacement {
  id: string
  serial_number: string | null
  equipment_type: EquipmentType
  customer_id: string
  latitude: number
  longitude: number
  placed_at: string
  placed_by_technician_id: string | null
  status: EquipmentStatus
  status_updated_at: string
  status_updated_by: string | null
  comment: string | null
  photo_path: string | null
  created_at: string
  updated_at: string
}

export type EquipmentPlacementInsert = Omit<EquipmentPlacement, 'id' | 'created_at' | 'updated_at' | 'placed_at' | 'status_updated_at'>
export type EquipmentPlacementUpdate = Partial<EquipmentPlacementInsert>

// Extended type with relations
export interface EquipmentPlacementWithRelations extends EquipmentPlacement {
  customer?: {
    id: string
    company_name: string
    contact_address: string | null
  }
  technician?: {
    id: string
    name: string
  }
  // Dynamisk stationstypdata från station_types-tabellen
  station_type_data?: {
    id: string
    code: string
    name: string
    color: string
    icon: string
    prefix: string
    measurement_unit: string
    measurement_label: string | null
    threshold_warning: number | null
    threshold_critical: number | null
    threshold_direction: 'above' | 'below'
  }
  photo_url?: string // Signed URL from storage
}

// Equipment type configuration for UI
export const EQUIPMENT_TYPE_CONFIG = {
  mechanical_trap: {
    label: 'Mekanisk fälla',
    labelPlural: 'Mekaniska fällor',
    color: '#22c55e', // green-500
    markerColor: 'green',
    requiresSerialNumber: true,
    icon: 'Crosshair'
  },
  concrete_station: {
    label: 'Betongstation',
    labelPlural: 'Betongstationer',
    color: '#6b7280', // gray-500
    markerColor: 'gray',
    requiresSerialNumber: false,
    icon: 'Box'
  },
  bait_station: {
    label: 'Betesstation',
    labelPlural: 'Betesstationer',
    color: '#000000', // black
    markerColor: 'black',
    requiresSerialNumber: false,
    icon: 'Target'
  }
} as const

export const EQUIPMENT_STATUS_CONFIG = {
  active: {
    label: 'Aktiv',
    color: 'green-500',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40'
  },
  removed: {
    label: 'Borttagen',
    color: 'slate-500',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/40'
  },
  missing: {
    label: 'Försvunnen',
    color: 'amber-500',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/40'
  },
  damaged: {
    label: 'Skadad & ur funktion',
    color: 'red-500',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40'
  }
} as const

// Helper functions for equipment
export const getEquipmentTypeLabel = (type: EquipmentType): string => {
  return EQUIPMENT_TYPE_CONFIG[type]?.label || type
}

export const getEquipmentTypePluralLabel = (type: EquipmentType): string => {
  return EQUIPMENT_TYPE_CONFIG[type]?.labelPlural || type
}

export const getEquipmentStatusLabel = (status: EquipmentStatus): string => {
  return EQUIPMENT_STATUS_CONFIG[status]?.label || status
}

export const requiresSerialNumber = (type: EquipmentType): boolean => {
  return EQUIPMENT_TYPE_CONFIG[type]?.requiresSerialNumber || false
}

export const getEquipmentTypeColor = (type: EquipmentType): string => {
  return EQUIPMENT_TYPE_CONFIG[type]?.color || '#6b7280'
}

// Statistics interface for equipment
export interface EquipmentStats {
  total: number
  byType: Record<EquipmentType, number>
  byStatus: Record<EquipmentStatus, number>
  recentPlacements: number // Last 30 days
}
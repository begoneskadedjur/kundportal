import { supabase } from '../lib/supabase'

export interface SanitationReport {
  id?: string
  case_id: string
  case_type: 'private_case' | 'business_case' | 'contract'
  customer_id?: string | null
  file_name: string
  file_path?: string
  file_size?: number
  mime_type?: string
  report_date?: string
  technician_id?: string | null
  technician_name?: string
  pest_type?: string
  address?: string
  report_metadata?: any
  status?: 'generated' | 'sent' | 'archived'
  sent_to_customer?: boolean
  sent_to_customer_at?: string
  sent_to_technician?: boolean
  sent_to_technician_at?: string
  created_by?: string
  created_at?: string
  updated_at?: string
  // Versionshantering
  is_current?: boolean
  version?: number
  replaced_at?: string
  replaced_by?: string
}

class SanitationReportService {
  /**
   * Save a PDF report to Supabase Storage and create a database record
   */
  async saveReport(
    pdfBase64: string,
    reportData: Omit<SanitationReport, 'id' | 'file_path' | 'created_at' | 'updated_at'>
  ): Promise<{ data: SanitationReport | null; error: any }> {
    try {
      // Convert base64 to blob
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })

      // Generate unique file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = reportData.file_name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const year = new Date().getFullYear()
      const month = String(new Date().getMonth() + 1).padStart(2, '0')
      const filePath = `${reportData.customer_id || 'unknown'}/${year}/${month}/${timestamp}_${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sanitation-reports')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading PDF to storage:', uploadError)
        return { data: null, error: uploadError }
      }

      // Save metadata to database
      const { data: dbData, error: dbError } = await supabase
        .from('sanitation_reports')
        .insert({
          ...reportData,
          file_path: uploadData.path,
          file_size: blob.size,
          mime_type: 'application/pdf'
        })
        .select()
        .single()

      if (dbError) {
        // If database insert fails, try to delete the uploaded file
        await supabase.storage
          .from('sanitation-reports')
          .remove([uploadData.path])
        
        console.error('Error saving report metadata:', dbError)
        return { data: null, error: dbError }
      }

      return { data: dbData, error: null }
    } catch (error) {
      console.error('Error in saveReport:', error)
      return { data: null, error }
    }
  }

  /**
   * Get reports with optional filters
   */
  async getReports(filters?: {
    customer_id?: string
    case_id?: string
    case_type?: string
    technician_id?: string
    status?: string
    from_date?: string
    to_date?: string
    include_all_versions?: boolean  // Ny parameter för att hämta alla versioner
  }): Promise<{ data: SanitationReport[] | null; error: any }> {
    try {
      console.log('sanitationReportService.getReports called with filters:', filters)
      
      let query = supabase
        .from('sanitation_reports')
        .select('*')
        .order('created_at', { ascending: false })

      // Som standard, hämta endast aktuella rapporter (om inte include_all_versions är true)
      if (!filters?.include_all_versions) {
        query = query.eq('is_current', true)
        console.log('sanitationReportService.getReports - Adding is_current=true filter')
      } else {
        console.log('sanitationReportService.getReports - Skipping is_current filter (include_all_versions=true)')
      }

      if (filters) {
        if (filters.customer_id) {
          query = query.eq('customer_id', filters.customer_id)
        }
        if (filters.case_id) {
          query = query.eq('case_id', filters.case_id)
        }
        if (filters.case_type) {
          query = query.eq('case_type', filters.case_type)
        }
        if (filters.technician_id) {
          query = query.eq('technician_id', filters.technician_id)
        }
        if (filters.status) {
          query = query.eq('status', filters.status)
        }
        if (filters.from_date) {
          query = query.gte('report_date', filters.from_date)
        }
        if (filters.to_date) {
          query = query.lte('report_date', filters.to_date)
        }
      }

      const { data, error } = await query
      
      console.log('sanitationReportService.getReports result:', {
        customer_id: filters?.customer_id,
        found_reports: data?.length || 0,
        error: error?.message || null
      })

      return { data, error }
    } catch (error) {
      console.error('Error in getReports:', error)
      return { data: null, error }
    }
  }

  /**
   * Get a single report by ID
   */
  async getReport(id: string): Promise<{ data: SanitationReport | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('sanitation_reports')
        .select('*')
        .eq('id', id)
        .single()

      return { data, error }
    } catch (error) {
      console.error('Error in getReport:', error)
      return { data: null, error }
    }
  }

  /**
   * Get report history for a specific case
   */
  async getReportHistory(case_id: string): Promise<{ 
    data: {
      current: SanitationReport | null
      history: SanitationReport[]
      total_versions: number
    } | null
    error: any 
  }> {
    try {
      // Hämta alla versioner för detta case
      const { data: allReports, error } = await supabase
        .from('sanitation_reports')
        .select('*')
        .eq('case_id', case_id)
        .order('version', { ascending: false })

      if (error) {
        return { data: null, error }
      }

      if (!allReports || allReports.length === 0) {
        return { 
          data: {
            current: null,
            history: [],
            total_versions: 0
          }, 
          error: null 
        }
      }

      // Hitta den aktuella versionen
      const current = allReports.find(r => r.is_current) || null
      
      // Alla versioner (sorterade med senaste först)
      const history = allReports

      return {
        data: {
          current,
          history,
          total_versions: allReports.length
        },
        error: null
      }
    } catch (error) {
      console.error('Error in getReportHistory:', error)
      return { data: null, error }
    }
  }

  /**
   * Download a report PDF
   */
  async downloadReport(id: string): Promise<{ data: Blob | null; url: string | null; error: any }> {
    try {
      // Get report metadata
      const { data: report, error: reportError } = await this.getReport(id)
      
      if (reportError || !report) {
        return { data: null, url: null, error: reportError || 'Report not found' }
      }

      if (!report.file_path) {
        return { data: null, url: null, error: 'No file path found for report' }
      }

      // Get signed URL for download (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('sanitation-reports')
        .createSignedUrl(report.file_path, 3600)

      if (urlError || !urlData) {
        return { data: null, url: null, error: urlError || 'Could not generate download URL' }
      }

      // Fetch the blob
      try {
        const response = await fetch(urlData.signedUrl)
        const blob = await response.blob()
        return { data: blob, url: urlData.signedUrl, error: null }
      } catch (fetchError) {
        return { data: null, url: urlData.signedUrl, error: fetchError }
      }
    } catch (error) {
      console.error('Error in downloadReport:', error)
      return { data: null, url: null, error }
    }
  }

  /**
   * Update report status
   */
  async updateReportStatus(
    id: string,
    updates: {
      status?: 'generated' | 'sent' | 'archived'
      sent_to_customer?: boolean
      sent_to_customer_at?: string
      sent_to_technician?: boolean
      sent_to_technician_at?: string
    }
  ): Promise<{ data: SanitationReport | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('sanitation_reports')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      console.error('Error in updateReportStatus:', error)
      return { data: null, error }
    }
  }

  /**
   * Delete a report (admin only)
   */
  async deleteReport(id: string): Promise<{ error: any }> {
    try {
      // Get report to find file path
      const { data: report, error: reportError } = await this.getReport(id)
      
      if (reportError) {
        return { error: reportError }
      }

      // Delete from storage if file exists
      if (report?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('sanitation-reports')
          .remove([report.file_path])

        if (storageError) {
          console.error('Error deleting file from storage:', storageError)
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('sanitation_reports')
        .delete()
        .eq('id', id)

      return { error: dbError }
    } catch (error) {
      console.error('Error in deleteReport:', error)
      return { error }
    }
  }

  /**
   * Get report statistics
   */
  async getReportStatistics(filters?: {
    customer_id?: string
    from_date?: string
    to_date?: string
  }): Promise<{ data: any | null; error: any }> {
    try {
      let query = supabase
        .from('sanitation_reports')
        .select('*')

      if (filters) {
        if (filters.customer_id) {
          query = query.eq('customer_id', filters.customer_id)
        }
        if (filters.from_date) {
          query = query.gte('report_date', filters.from_date)
        }
        if (filters.to_date) {
          query = query.lte('report_date', filters.to_date)
        }
      }

      const { data: reports, error } = await query

      if (error || !reports) {
        return { data: null, error }
      }

      const statistics = {
        total_reports: reports.length,
        reports_sent_to_customer: reports.filter(r => r.sent_to_customer).length,
        reports_sent_to_technician: reports.filter(r => r.sent_to_technician).length,
        reports_by_status: {
          generated: reports.filter(r => r.status === 'generated').length,
          sent: reports.filter(r => r.status === 'sent').length,
          archived: reports.filter(r => r.status === 'archived').length
        },
        reports_by_type: {
          private_case: reports.filter(r => r.case_type === 'private_case').length,
          business_case: reports.filter(r => r.case_type === 'business_case').length,
          contract: reports.filter(r => r.case_type === 'contract').length
        },
        recent_reports: reports.slice(0, 5)
      }

      return { data: statistics, error: null }
    } catch (error) {
      console.error('Error in getReportStatistics:', error)
      return { data: null, error }
    }
  }
}

export const sanitationReportService = new SanitationReportService()
// src/hooks/useWorkReportGeneration.ts - Hook för saneringsrapport generation och email
import { useState } from 'react'
import toast from 'react-hot-toast'
import { generatePDFReport } from '../utils/pdfReportGenerator'
import { supabase } from '../lib/supabase'

interface TechnicianCase {
  id: string;
  case_type: 'private' | 'business' | 'contract';
  title: string;
  description?: string;
  status: string;
  case_price?: number;
  kontaktperson?: string;
  telefon_kontaktperson?: string;
  e_post_kontaktperson?: string;
  skadedjur?: string;
  org_nr?: string;
  personnummer?: string;
  adress?: any;
  foretag?: string;
  clickup_task_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  // Tekniker-tilldelningar
  primary_assignee_id?: string | null;
  primary_assignee_name?: string | null;
  secondary_assignee_id?: string | null;
  secondary_assignee_name?: string | null;
  tertiary_assignee_id?: string | null;
  tertiary_assignee_name?: string | null;
  created_date: string;
  rapport?: string;
}

interface CustomerInfo {
  company_name: string;
  org_number: string;
  contact_person: string;
}

interface TaskDetails {
  task_id: string;
  task_info: {
    name: string;
    status: string;
    description: string;
    created: string;
    updated: string;
  };
  assignees: Array<{
    name: string;
    email: string;
  }>;
  custom_fields: Array<{
    id: string;
    name: string;
    type: string;
    value: any;
    has_value: boolean;
    type_config?: {
      options?: Array<{
        id: string;
        name: string;
        color: string;
        orderindex: number;
      }>;
    };
  }>;
}

export const useWorkReportGeneration = (caseData: TechnicianCase) => {
  const [isGenerating, setIsGenerating] = useState(false)

  // Hämta ClickUp task details och customer info
  const fetchReportData = async () => {
    const clickupTaskId = caseData.clickup_task_id || caseData.id
    
    // Hämta task details från ClickUp
    const taskResponse = await fetch(`/api/test-clickup?task_id=${clickupTaskId}`)
    if (!taskResponse.ok) {
      throw new Error('Kunde inte hämta ärendedetaljer från ClickUp')
    }
    const taskDetails: TaskDetails = await taskResponse.json()

    // Hämta customer information från databasen
    let customerInfo: CustomerInfo | undefined

    if (caseData.case_type === 'business' && caseData.foretag) {
      // För företagskunder, hämta från customers tabellen
      const { data: customer, error } = await supabase
        .from('customers')
        .select('company_name, org_number, contact_person')
        .eq('company_name', caseData.foretag)
        .single()

      if (!error && customer) {
        customerInfo = customer
      }
    } else if (caseData.case_type === 'private') {
      // För privatpersoner, skapa customer info från case data
      customerInfo = {
        company_name: caseData.kontaktperson || 'Privatperson',
        org_number: caseData.personnummer || '',
        contact_person: caseData.kontaktperson || ''
      }
    }

    // Om vi inte har customer info från databasen, skapa från case data
    if (!customerInfo) {
      customerInfo = {
        company_name: caseData.foretag || caseData.kontaktperson || 'Okänd kund',
        org_number: caseData.org_nr || caseData.personnummer || '',
        contact_person: caseData.kontaktperson || ''
      }
    }

    return { taskDetails, customerInfo }
  }

  // Ladda ner PDF-rapport
  const downloadReport = async () => {
    try {
      setIsGenerating(true)
      
      const { taskDetails, customerInfo } = await fetchReportData()
      await generatePDFReport(taskDetails, customerInfo)
      
      toast.success('Rapport nedladdad!')
    } catch (error) {
      console.error('Error downloading report:', error)
      toast.error('Kunde inte generera rapport')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Skicka rapport till ansvarig tekniker
  const sendToTechnician = async () => {
    // Hämta tekniker-email från primary_assignee_id om assignee_email inte finns
    let technicianEmail = caseData.assignee_email
    let technicianName = caseData.assignee_name

    if (!technicianEmail && caseData.primary_assignee_id) {
      try {
        const { data: technician, error } = await supabase
          .from('technicians')
          .select('email, name')
          .eq('id', caseData.primary_assignee_id)
          .single()

        if (!error && technician) {
          technicianEmail = technician.email
          technicianName = technician.name
        }
      } catch (error) {
        console.error('Error fetching technician:', error)
      }
    }

    if (!technicianEmail) {
      toast.error('Ingen tekniker tilldelad detta ärende')
      return
    }

    try {
      setIsGenerating(true)
      
      const { taskDetails, customerInfo } = await fetchReportData()
      
      const response = await fetch('/api/send-work-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskDetails,
          customerInfo,
          recipientType: 'technician',
          recipientEmail: technicianEmail,
          recipientName: technicianName
        })
      })

      if (!response.ok) {
        throw new Error('Kunde inte skicka rapport')
      }

      toast.success(`Rapport skickad till ${technicianName || 'tekniker'}!`)
    } catch (error) {
      console.error('Error sending report to technician:', error)
      toast.error('Kunde inte skicka rapport till tekniker')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Skicka rapport till kontaktperson
  const sendToContact = async () => {
    if (!caseData.e_post_kontaktperson) {
      toast.error('Ingen email-adress för kontaktperson')
      return
    }

    try {
      setIsGenerating(true)
      
      const { taskDetails, customerInfo } = await fetchReportData()
      
      const response = await fetch('/api/send-work-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskDetails,
          customerInfo,
          recipientType: 'contact',
          recipientEmail: caseData.e_post_kontaktperson,
          recipientName: caseData.kontaktperson
        })
      })

      if (!response.ok) {
        throw new Error('Kunde inte skicka rapport')
      }

      toast.success(`Rapport skickad till ${caseData.kontaktperson || 'kontaktperson'}!`)
    } catch (error) {
      console.error('Error sending report to contact:', error)
      toast.error('Kunde inte skicka rapport till kontaktperson')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Kontrollera om rapporten kan genereras
  const canGenerateReport = () => {
    // Kräver ClickUp task ID och grundläggande case data
    return !!(caseData.clickup_task_id || caseData.id) && caseData.title && caseData.title.length > 0
  }

  return {
    downloadReport,
    sendToTechnician,
    sendToContact,
    isGenerating,
    canGenerateReport: canGenerateReport(),
    hasTechnicianEmail: !!(caseData.assignee_email || caseData.primary_assignee_id),
    hasContactEmail: !!caseData.e_post_kontaktperson,
    technicianName: caseData.assignee_name || caseData.primary_assignee_name,
    contactName: caseData.kontaktperson
  }
}
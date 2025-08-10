// src/hooks/useWorkReportGeneration.ts - Hook för saneringsrapport generation och email
import { useState } from 'react'
import toast from 'react-hot-toast'
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
  start_date?: string;
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

  // Skapa rapport-data från befintlig case-data (ingen ClickUp API-anrop)
  const createReportData = async () => {
    // Skapa TaskDetails från befintlig case-data
    const taskDetails: TaskDetails = {
      task_id: caseData.id,
      task_info: {
        name: caseData.title,
        status: caseData.status,
        description: caseData.description || '',
        created: new Date(caseData.created_date).getTime().toString(),
        updated: new Date().getTime().toString()
      },
      assignees: [],
      custom_fields: [
        // Rapport-fält
        {
          id: 'rapport',
          name: 'rapport',
          type: 'text',
          value: caseData.rapport || '',
          has_value: !!(caseData.rapport)
        },
        // Skadedjur-fält
        {
          id: 'skadedjur',
          name: 'skadedjur',
          type: 'text',
          value: caseData.skadedjur || '',
          has_value: !!(caseData.skadedjur)
        },
        // Adress-fält - säkerställ att vi passar rätt adressdata
        {
          id: 'adress',
          name: 'adress',
          type: 'address',
          value: caseData.adress || null,
          has_value: !!(caseData.adress)
        },
        // Pris-fält
        {
          id: 'pris',
          name: 'pris',
          type: 'number',
          value: caseData.case_price || 0,
          has_value: !!(caseData.case_price)
        },
        // Start datum-fält
        {
          id: 'start_date',
          name: 'start_date',
          type: 'date',
          value: caseData.start_date || '',
          has_value: !!(caseData.start_date)
        },
        // Telefon-fält
        {
          id: 'telefon_kontaktperson',
          name: 'telefon_kontaktperson',
          type: 'text',
          value: caseData.telefon_kontaktperson || '',
          has_value: !!(caseData.telefon_kontaktperson)
        },
        // Email-fält
        {
          id: 'e_post_kontaktperson',
          name: 'e_post_kontaktperson',
          type: 'email',
          value: caseData.e_post_kontaktperson || '',
          has_value: !!(caseData.e_post_kontaktperson)
        },
        // Case type för att avgöra privatperson vs företag
        {
          id: 'case_type',
          name: 'case_type',
          type: 'text',
          value: caseData.case_type || 'private',
          has_value: !!(caseData.case_type)
        }
      ]
    }

    // Lägg till tekniker om tilldelad
    if (caseData.primary_assignee_id && caseData.primary_assignee_name) {
      // Hämta tekniker-email om vi behöver det
      try {
        const { data: technician } = await supabase
          .from('technicians')
          .select('email')
          .eq('id', caseData.primary_assignee_id)
          .single()

        if (technician) {
          taskDetails.assignees.push({
            name: caseData.primary_assignee_name,
            email: technician.email
          })
        }
      } catch (error) {
        // Fallback utan email
        taskDetails.assignees.push({
          name: caseData.primary_assignee_name,
          email: ''
        })
      }
    }

    // Skapa customer info från case-data
    let customerInfo: CustomerInfo

    if (caseData.case_type === 'business' && caseData.foretag) {
      // För företagskunder, försök hämta från customers tabellen först
      try {
        const { data: customer, error } = await supabase
          .from('customers')
          .select('company_name, org_number, contact_person')
          .eq('company_name', caseData.foretag)
          .single()

        if (!error && customer) {
          customerInfo = customer
        } else {
          throw new Error('Customer not found')
        }
      } catch (error) {
        // Fallback till case-data
        customerInfo = {
          company_name: caseData.foretag || 'Företag',
          org_number: caseData.org_nr || '',
          contact_person: caseData.kontaktperson || ''
        }
      }
    } else {
      // För privatpersoner eller fallback
      customerInfo = {
        company_name: caseData.kontaktperson || 'Privatperson',
        org_number: caseData.personnummer || caseData.org_nr || '',
        contact_person: caseData.kontaktperson || ''
      }
    }

    return { taskDetails, customerInfo }
  }

  // Ladda ner PDF-rapport
  const downloadReport = async () => {
    try {
      setIsGenerating(true)
      
      const { taskDetails, customerInfo } = await createReportData()
      
      // Anropa Puppeteer-baserad PDF-generator
      const response = await fetch('/api/generate-work-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskDetails,
          customerInfo
        })
      })

      if (!response.ok) {
        throw new Error('Kunde inte generera PDF')
      }

      const data = await response.json()
      
      if (!data.success || !data.pdf) {
        throw new Error('Ogiltig respons från PDF-generator')
      }

      // Konvertera base64 till blob och ladda ner
      const pdfBlob = base64ToBlob(data.pdf, 'application/pdf')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = data.filename || `Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Rapport nedladdad!')
    } catch (error) {
      console.error('Error downloading report:', error)
      toast.error('Kunde inte generera rapport')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Helper function to convert base64 to blob
  const base64ToBlob = (base64: string, contentType: string) => {
    // Check if the data is comma-separated bytes (fallback for server issue)
    if (base64.includes(',') && /^\d+,\d+/.test(base64)) {
      console.warn('Received comma-separated bytes instead of base64, converting...')
      const bytes = base64.split(',').map(b => parseInt(b.trim(), 10))
      const byteArray = new Uint8Array(bytes)
      return new Blob([byteArray], { type: contentType })
    }
    
    // Normal base64 conversion
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: contentType })
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
      
      const { taskDetails, customerInfo } = await createReportData()
      
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
      
      const { taskDetails, customerInfo } = await createReportData()
      
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
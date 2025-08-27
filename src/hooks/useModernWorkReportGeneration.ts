// src/hooks/useModernWorkReportGeneration.ts - Modern hook för saneringsrapport generation med trafikljussystem
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { sanitationReportService, type SanitationReport } from '../services/sanitationReportService'
import { useAuth } from '../contexts/AuthContext'

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
  case_number?: string;
  // Trafikljussystem
  pest_level?: number | null;
  problem_rating?: number | null;
  // Rekommendationer från databasen
  recommendations?: string;
}

export const useModernWorkReportGeneration = (caseData: TechnicianCase) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [existingReports, setExistingReports] = useState<SanitationReport[]>([])
  const [reportHistory, setReportHistory] = useState<{
    current: SanitationReport | null
    history: SanitationReport[]
    total_versions: number
  }>({ current: null, history: [], total_versions: 0 })
  const [hasCheckedReports, setHasCheckedReports] = useState(false)
  const { profile } = useAuth()

  // Hämta befintliga rapporter när komponenten laddas
  useEffect(() => {
    const fetchExistingReports = async () => {
      if (caseData.id && !hasCheckedReports) {
        // Hämta rapporthistorik för detta case
        const { data } = await sanitationReportService.getReportHistory(caseData.id)
        
        if (data) {
          setReportHistory(data)
          setExistingReports(data.history)
        }
        
        setHasCheckedReports(true)
      }
    }
    
    fetchExistingReports()
  }, [caseData.id, hasCheckedReports])

  // Automatisk sparning av rapport till databas och storage - ENDAST för avtalsärenden
  const saveReportToDatabase = async (pdfBase64: string, filename: string) => {
    try {
      // ENDAST spara rapporter för avtalsärenden (contract cases)
      if (caseData.case_type !== 'contract') {
        console.log('Hoppar över sparning av rapport - inte ett avtalsärende')
        return null
      }

      // För contract cases, hämta customer_id direkt från cases tabellen
      let customerId = null
      
      // Först, försök hämta customer_id från cases tabellen
      const { data: caseRecord } = await supabase
        .from('cases')
        .select('customer_id')
        .eq('id', caseData.id)
        .single()
      
      if (caseRecord?.customer_id) {
        customerId = caseRecord.customer_id
        console.log('Customer ID hittad från cases tabellen:', customerId)
      } else {
        // Fallback: försök hitta kund via contact_email
        if (caseData.e_post_kontaktperson) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('contact_email', caseData.e_post_kontaktperson)
            .single()
          
          if (customer) {
            customerId = customer.id
            console.log('Customer ID hittad via email:', customerId)
            
            // Uppdatera cases med customer_id för framtida användning
            await supabase
              .from('cases')
              .update({ customer_id: customer.id })
              .eq('id', caseData.id)
          }
        }
      }

      // Hämta tekniker-id om tilldelad
      let technicianId = null
      if (caseData.primary_assignee_id) {
        technicianId = caseData.primary_assignee_id
      }

      // Spara rapport
      const { data: savedReport, error } = await sanitationReportService.saveReport(pdfBase64, {
        case_id: caseData.id,
        case_type: caseData.case_type === 'private' ? 'private_case' : 
                  caseData.case_type === 'business' ? 'business_case' : 'contract',
        customer_id: customerId,
        file_name: filename,
        technician_id: technicianId,
        technician_name: caseData.primary_assignee_name || caseData.assignee_name,
        pest_type: caseData.skadedjur,
        address: typeof caseData.adress === 'string' ? caseData.adress : 
                 caseData.adress?.formatted_address || 
                 caseData.adress?.line_1,
        report_metadata: {
          contact_person: caseData.kontaktperson,
          contact_email: caseData.e_post_kontaktperson,
          contact_phone: caseData.telefon_kontaktperson,
          price: caseData.case_price,
          status: caseData.status,
          description: caseData.description,
          pest_level: caseData.pest_level,
          problem_rating: caseData.problem_rating
        },
        created_by: profile?.user_id
      })

      if (error) {
        console.error('Error saving report to database:', error)
        toast.error('Kunde inte spara rapport i systemet')
        return null
      }

      toast.success('Rapport sparad i systemet!')
      return savedReport
    } catch (error) {
      console.error('Error in saveReportToDatabase:', error)
      toast.error('Ett fel uppstod vid sparning av rapport')
      return null
    }
  }

  // Skapa modern rapport-data för generate-case-report-pdf API:t
  const createModernReportData = async () => {
    // För customer data, hämta från databas om möjligt
    let customerData = {
      company_name: caseData.foretag || caseData.kontaktperson || 'Okänt företag',
      id: null
    }

    if (caseData.case_type === 'business' && caseData.foretag) {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('company_name', caseData.foretag)
          .single()

        if (customer) {
          customerData = customer
        }
      } catch (error) {
        console.log('Could not find customer in database, using case data')
      }
    }

    // Skapa case data i rätt format för generate-case-report-pdf
    const modernCaseData = {
      id: caseData.id,
      case_number: caseData.case_number || caseData.id.substring(0, 8),
      title: caseData.title,
      description: caseData.description || '',
      status: caseData.status,
      created_at: caseData.created_date,
      start_date: caseData.start_date,
      // Kontaktinformation
      contact_person: caseData.kontaktperson,
      contact_email: caseData.e_post_kontaktperson,
      contact_phone: caseData.telefon_kontaktperson,
      // Adressinformation
      address: typeof caseData.adress === 'string' ? caseData.adress : 
               caseData.adress?.formatted_address || 
               caseData.adress?.line_1,
      // Tekniker
      primary_technician_name: caseData.primary_assignee_name || caseData.assignee_name,
      assignee_name: caseData.assignee_name,
      // Skadedjur och pris
      pest_type: caseData.skadedjur,
      price: caseData.case_price,
      // Trafikljussystem - VIKTIGT för den nya rapporten!
      pest_level: caseData.pest_level,
      problem_rating: caseData.problem_rating,
      // Arbetsrapport - KORREKT fältnamn för PDF-generatorn
      work_report: caseData.rapport,
      // Rekommendationer från databasen 
      recommendations: caseData.recommendations,
      // Företagsinformation
      company_name: caseData.foretag,
      org_number: caseData.org_nr,
      personnummer: caseData.personnummer,
      case_type: caseData.case_type
    }

    return { caseData: modernCaseData, customerData }
  }

  // Kontrollera om rapport nyligen genererats
  const hasRecentReport = () => {
    if (!reportHistory.current) return false
    
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
    const reportDate = new Date(reportHistory.current.created_at || '')
    
    return reportDate > fourHoursAgo
  }

  // Formatera tid sedan rapport skapades
  const getTimeSinceReport = (report: SanitationReport) => {
    if (!report.created_at) return ''
    
    const created = new Date(report.created_at)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays} dag${diffDays > 1 ? 'ar' : ''} sedan`
    if (diffHours > 0) return `${diffHours} tim${diffHours > 1 ? 'mar' : 'me'} sedan`
    if (diffMins > 0) return `${diffMins} minut${diffMins > 1 ? 'er' : ''} sedan`
    return 'Nyss'
  }

  // Helper function to convert base64 to blob
  const base64ToBlob = (base64: string, contentType: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: contentType })
  }

  // Ladda ner modern PDF-rapport med trafikljussystem
  const downloadReport = async (skipWarning = false) => {
    try {
      // Varna om rapport nyligen genererats
      if (!skipWarning && hasRecentReport() && reportHistory.current) {
        const timeSince = getTimeSinceReport(reportHistory.current)
        const confirmMessage = `En rapport genererades för ${timeSince}.\n` +
          `Version ${reportHistory.current.version} av ${reportHistory.total_versions}.\n\n` +
          'Vill du skapa en ny version av rapporten?'
        
        if (!window.confirm(confirmMessage)) {
          return
        }
      }
      
      setIsGenerating(true)
      
      const { caseData: modernCaseData, customerData } = await createModernReportData()
      
      // Anropa modern Puppeteer-baserad PDF-generator med trafikljussystem
      const response = await fetch('/api/generate-case-report-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: 'single',
          caseData: modernCaseData,
          customerData
        })
      })

      if (!response.ok) {
        throw new Error('Kunde inte generera PDF')
      }

      const data = await response.json()
      
      if (!data.success || !data.pdf) {
        throw new Error('Ogiltig respons från PDF-generator')
      }

      const filename = data.filename || `BeGone_Arende_${modernCaseData.case_number}_${new Date().toISOString().split('T')[0]}.pdf`

      // Spara automatiskt till databas och storage
      const savedReport = await saveReportToDatabase(data.pdf, filename)
      
      // Uppdatera lokal rapporthistorik
      if (savedReport) {
        const { data: updatedHistory } = await sanitationReportService.getReportHistory(caseData.id)
        if (updatedHistory) {
          setReportHistory(updatedHistory)
          setExistingReports(updatedHistory.history)
        }
      }

      // Konvertera base64 till blob och ladda ner
      const pdfBlob = base64ToBlob(data.pdf, 'application/pdf')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Modern rapport nedladdad!')
    } catch (error) {
      console.error('Error downloading modern report:', error)
      toast.error('Kunde inte generera modern rapport')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Skicka modern rapport till ansvarig tekniker
  const sendToTechnician = async (skipWarning = false) => {
    // Varna om rapport nyligen skickats
    if (!skipWarning && reportHistory.current?.sent_to_technician) {
      const timeSince = reportHistory.current.sent_to_technician_at 
        ? getTimeSinceReport({ ...reportHistory.current, created_at: reportHistory.current.sent_to_technician_at })
        : ''
      
      const confirmMessage = timeSince 
        ? `En rapport skickades till tekniker för ${timeSince}.\nVill du skicka en ny version?`
        : 'En rapport har redan skickats till tekniker.\nVill du skicka en ny version?'
      
      if (!window.confirm(confirmMessage)) {
        return
      }
    }

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
      
      const { caseData: modernCaseData, customerData } = await createModernReportData()
      
      // Generera PDF först
      const pdfResponse = await fetch('/api/generate-case-report-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: 'single',
          caseData: modernCaseData,
          customerData
        })
      })

      if (!pdfResponse.ok) {
        throw new Error('Kunde inte generera PDF')
      }

      const pdfData = await pdfResponse.json()
      
      if (!pdfData.success || !pdfData.pdf) {
        throw new Error('Ogiltig respons från PDF-generator')
      }

      // Skicka email med PDF
      const emailResponse = await fetch('/api/send-work-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdf: pdfData.pdf,
          filename: pdfData.filename,
          recipientType: 'technician',
          recipientEmail: technicianEmail,
          recipientName: technicianName,
          caseData: modernCaseData,
          customerData
        })
      })

      if (!emailResponse.ok) {
        throw new Error('Kunde inte skicka email')
      }

      // Spara automatiskt till databas när rapport skickas
      const savedReport = await saveReportToDatabase(pdfData.pdf, pdfData.filename)
      
      // Uppdatera status att rapporten har skickats till tekniker
      if (savedReport?.id) {
        await sanitationReportService.updateReportStatus(savedReport.id, {
          sent_to_technician: true,
          sent_to_technician_at: new Date().toISOString()
        })
      }

      toast.success(`Modern rapport skickad till ${technicianName || 'tekniker'}!`)
    } catch (error) {
      console.error('Error sending modern report to technician:', error)
      toast.error('Kunde inte skicka modern rapport till tekniker')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Skicka modern rapport till kontaktperson
  const sendToContact = async (skipWarning = false) => {
    // Varna om rapport nyligen skickats till kund
    if (!skipWarning && reportHistory.current?.sent_to_customer) {
      const timeSince = reportHistory.current.sent_to_customer_at 
        ? getTimeSinceReport({ ...reportHistory.current, created_at: reportHistory.current.sent_to_customer_at })
        : ''
      
      const confirmMessage = timeSince 
        ? `En rapport skickades till kund för ${timeSince}.\nVill du skicka en ny version?`
        : 'En rapport har redan skickats till kund.\nVill du skicka en ny version?'
      
      if (!window.confirm(confirmMessage)) {
        return
      }
    }

    if (!caseData.e_post_kontaktperson) {
      toast.error('Ingen email-adress för kontaktperson')
      return
    }

    try {
      setIsGenerating(true)
      
      const { caseData: modernCaseData, customerData } = await createModernReportData()
      
      // Generera PDF först
      const pdfResponse = await fetch('/api/generate-case-report-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: 'single',
          caseData: modernCaseData,
          customerData
        })
      })

      if (!pdfResponse.ok) {
        throw new Error('Kunde inte generera PDF')
      }

      const pdfData = await pdfResponse.json()
      
      if (!pdfData.success || !pdfData.pdf) {
        throw new Error('Ogiltig respons från PDF-generator')
      }

      // Skicka email med PDF
      const emailResponse = await fetch('/api/send-work-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdf: pdfData.pdf,
          filename: pdfData.filename,
          recipientType: 'contact',
          recipientEmail: caseData.e_post_kontaktperson,
          recipientName: caseData.kontaktperson,
          caseData: modernCaseData,
          customerData
        })
      })

      if (!emailResponse.ok) {
        throw new Error('Kunde inte skicka email')
      }

      // Spara automatiskt till databas när rapport skickas
      const savedReport = await saveReportToDatabase(pdfData.pdf, pdfData.filename)
      
      // Uppdatera status att rapporten har skickats till kund
      if (savedReport?.id) {
        await sanitationReportService.updateReportStatus(savedReport.id, {
          sent_to_customer: true,
          sent_to_customer_at: new Date().toISOString(),
          status: 'sent'
        })
      }

      toast.success(`Modern rapport skickad till ${caseData.kontaktperson || 'kontaktperson'}!`)
    } catch (error) {
      console.error('Error sending modern report to contact:', error)
      toast.error('Kunde inte skicka modern rapport till kontaktperson')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  // Kontrollera om rapporten kan genereras
  const canGenerateReport = () => {
    // Kräver grundläggande case data
    return !!(caseData.id && caseData.title && caseData.title.length > 0)
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
    contactName: caseData.kontaktperson,
    // Rapporthistorik-data
    existingReports,
    reportHistory,
    hasRecentReport: hasRecentReport(),
    totalReports: reportHistory.total_versions,
    currentReport: reportHistory.current,
    getTimeSinceReport
  }
}
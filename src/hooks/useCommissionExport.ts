// 📁 src/hooks/useCommissionExport.ts - Export-funktionalitet och download-hantering
import { useState, useCallback } from 'react'
import type { CommissionCaseDetail } from '../types/commission'
import {
  exportToExcel,
  exportToPdf,
  exportForPayroll,
  generateSummaryReport,
  prepareEmailData,
  printReport,
  validateExportData,
  downloadFile,
  copyToClipboard
} from '../services/commissionExportService'

export interface ExportOptions {
  month: string
  filename?: string
  includeDetails?: boolean
  format?: 'excel' | 'pdf' | 'payroll' | 'summary' | 'email'
}

export interface ExportState {
  isExporting: boolean
  exportProgress: number
  lastExportType: string | null
  error: string | null
}

export const useCommissionExport = () => {
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    exportProgress: 0,
    lastExportType: null,
    error: null
  })

  // Uppdatera export state
  const updateExportState = useCallback((updates: Partial<ExportState>) => {
    setExportState(prev => ({ ...prev, ...updates }))
  }, [])

  // Starta export
  const startExport = useCallback((type: string) => {
    updateExportState({
      isExporting: true,
      exportProgress: 0,
      lastExportType: type,
      error: null
    })
  }, [updateExportState])

  // Avsluta export
  const finishExport = useCallback((error?: string) => {
    updateExportState({
      isExporting: false,
      exportProgress: 100,
      error: error || null
    })
  }, [updateExportState])

  // 1. Excel export
  const exportExcel = useCallback(async (
    cases: CommissionCaseDetail[], 
    options: ExportOptions
  ) => {
    startExport('excel')
    
    try {
      // Validera data först
      const validation = validateExportData(cases)
      if (!validation.isValid) {
        throw new Error(`Export-validering misslyckades: ${validation.errors.join(', ')}`)
      }

      updateExportState({ exportProgress: 25 })
      
      const filename = options.filename || `provisioner_excel_${options.month}_${new Date().toISOString().slice(0, 10)}.csv`
      
      updateExportState({ exportProgress: 50 })
      
      await exportToExcel(cases, options.month, filename)
      
      updateExportState({ exportProgress: 75 })
      
      console.log(`✅ Excel export completed: ${filename}`)
      finishExport()
      
      return { success: true, filename }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Excel export misslyckades'
      console.error('Excel export error:', error)
      finishExport(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [startExport, updateExportState, finishExport])

  // 2. PDF export
  const exportPdf = useCallback(async (
    cases: CommissionCaseDetail[], 
    options: ExportOptions
  ) => {
    startExport('pdf')
    
    try {
      const validation = validateExportData(cases)
      if (!validation.isValid) {
        throw new Error(`Export-validering misslyckades: ${validation.errors.join(', ')}`)
      }

      updateExportState({ exportProgress: 25 })
      
      const filename = options.filename || `provisioner_rapport_${options.month}_${new Date().toISOString().slice(0, 10)}.html`
      
      updateExportState({ exportProgress: 50 })
      
      await exportToPdf(cases, options.month, filename)
      
      updateExportState({ exportProgress: 75 })
      
      console.log(`✅ PDF export completed: ${filename}`)
      finishExport()
      
      return { success: true, filename }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PDF export misslyckades'
      console.error('PDF export error:', error)
      finishExport(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [startExport, updateExportState, finishExport])

  // 3. Payroll export
  const exportPayroll = useCallback(async (
    cases: CommissionCaseDetail[], 
    options: ExportOptions
  ) => {
    startExport('payroll')
    
    try {
      const validation = validateExportData(cases)
      if (!validation.isValid) {
        throw new Error(`Export-validering misslyckades: ${validation.errors.join(', ')}`)
      }

      updateExportState({ exportProgress: 25 })
      
      const { excel: blob, summary } = await exportForPayroll(cases, options.month)
      
      updateExportState({ exportProgress: 50 })
      
      const filename = options.filename || `provisioner_loneunderlag_${options.month}_${new Date().toISOString().slice(0, 10)}.csv`
      
      // Ladda ner CSV
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      updateExportState({ exportProgress: 75 })
      
      console.log(`✅ Payroll export completed: ${filename}`)
      finishExport()
      
      return { success: true, filename, summary }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Löneexport misslyckades'
      console.error('Payroll export error:', error)
      finishExport(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [startExport, updateExportState, finishExport])

  // 4. Summary export
  const exportSummary = useCallback(async (
    cases: CommissionCaseDetail[], 
    options: ExportOptions
  ) => {
    startExport('summary')
    
    try {
      updateExportState({ exportProgress: 25 })
      
      const summary = generateSummaryReport(cases, options.month)
      
      updateExportState({ exportProgress: 50 })
      
      const filename = options.filename || `provisioner_sammanfattning_${options.month}_${new Date().toISOString().slice(0, 10)}.txt`
      
      downloadFile(summary, filename, 'text/plain')
      
      updateExportState({ exportProgress: 75 })
      
      console.log(`✅ Summary export completed: ${filename}`)
      finishExport()
      
      return { success: true, filename, content: summary }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sammanfattningsexport misslyckades'
      console.error('Summary export error:', error)
      finishExport(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [startExport, updateExportState, finishExport])

  // 5. Email preparation
  const prepareEmail = useCallback(async (
    cases: CommissionCaseDetail[], 
    options: ExportOptions
  ) => {
    startExport('email')
    
    try {
      updateExportState({ exportProgress: 25 })
      
      const emailData = prepareEmailData(cases, options.month)
      
      updateExportState({ exportProgress: 50 })
      
      // Kopiera email-innehåll till clipboard
      const emailContent = `Ämne: ${emailData.subject}\n\n${emailData.htmlContent.replace(/<[^>]*>/g, '')}`
      
      const copied = await copyToClipboard(emailContent)
      
      updateExportState({ exportProgress: 75 })
      
      console.log(`✅ Email preparation completed. Copied to clipboard: ${copied}`)
      finishExport()
      
      return { 
        success: true, 
        emailData, 
        copiedToClipboard: copied,
        message: copied ? 'Email-innehåll kopierat till clipboard' : 'Email-data förberett'
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Email-förberedelse misslyckades'
      console.error('Email preparation error:', error)
      finishExport(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [startExport, updateExportState, finishExport])

  // 6. Print report
  const printCommissionReport = useCallback((
    cases: CommissionCaseDetail[], 
    month: string
  ) => {
    try {
      printReport(cases, month)
      console.log(`✅ Print report opened for: ${month}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Utskrift misslyckades'
      console.error('Print error:', error)
      return { success: false, error: errorMessage }
    }
  }, [])

  // 7. Bulk export (alla format)
  const exportAll = useCallback(async (
    cases: CommissionCaseDetail[], 
    options: ExportOptions
  ) => {
    startExport('bulk')
    
    try {
      const results: any[] = []
      let currentProgress = 0
      const totalSteps = 4 // Excel, PDF, Summary, Payroll
      
      // Excel
      updateExportState({ exportProgress: (currentProgress / totalSteps) * 100 })
      const excelResult = await exportExcel(cases, { ...options, filename: undefined })
      results.push({ type: 'excel', ...excelResult })
      currentProgress++
      
      // PDF
      updateExportState({ exportProgress: (currentProgress / totalSteps) * 100 })
      const pdfResult = await exportPdf(cases, { ...options, filename: undefined })
      results.push({ type: 'pdf', ...pdfResult })
      currentProgress++
      
      // Summary
      updateExportState({ exportProgress: (currentProgress / totalSteps) * 100 })
      const summaryResult = await exportSummary(cases, { ...options, filename: undefined })
      results.push({ type: 'summary', ...summaryResult })
      currentProgress++
      
      // Payroll
      updateExportState({ exportProgress: (currentProgress / totalSteps) * 100 })
      const payrollResult = await exportPayroll(cases, { ...options, filename: undefined })
      results.push({ type: 'payroll', ...payrollResult })
      
      finishExport()
      
      const successCount = results.filter(r => r.success).length
      console.log(`✅ Bulk export completed: ${successCount}/${results.length} successful`)
      
      return { 
        success: successCount === results.length, 
        results,
        summary: `${successCount}/${results.length} export lyckades`
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk export misslyckades'
      console.error('Bulk export error:', error)
      finishExport(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [startExport, updateExportState, finishExport, exportExcel, exportPdf, exportSummary, exportPayroll])

  // 8. Validation helper
  const validateCases = useCallback((cases: CommissionCaseDetail[]) => {
    return validateExportData(cases)
  }, [])

  // 9. Quick actions
  const quickActions = {
    // Snabb Excel export med standardnamn
    quickExcel: useCallback(async (cases: CommissionCaseDetail[], month: string) => {
      return exportExcel(cases, { month })
    }, [exportExcel]),
    
    // Snabb summary till clipboard
    quickSummary: useCallback(async (cases: CommissionCaseDetail[], month: string) => {
      try {
        const summary = generateSummaryReport(cases, month)
        const copied = await copyToClipboard(summary)
        return { 
          success: true, 
          copied,
          message: copied ? 'Sammanfattning kopierad till clipboard' : 'Sammanfattning genererad'
        }
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Sammanfattning misslyckades' 
        }
      }
    }, []),
    
    // Snabb print
    quickPrint: useCallback((cases: CommissionCaseDetail[], month: string) => {
      return printCommissionReport(cases, month)
    }, [printCommissionReport])
  }

  // 10. Export history (simple local storage)
  const getExportHistory = useCallback(() => {
    try {
      const history = localStorage.getItem('commission_export_history')
      return history ? JSON.parse(history) : []
    } catch {
      return []
    }
  }, [])

  const addToExportHistory = useCallback((exportInfo: { 
    type: string
    month: string
    timestamp: string
    success: boolean
    filename?: string
  }) => {
    try {
      const history = getExportHistory()
      const newHistory = [exportInfo, ...history].slice(0, 10) // Keep last 10
      localStorage.setItem('commission_export_history', JSON.stringify(newHistory))
    } catch (error) {
      console.warn('Could not save export history:', error)
    }
  }, [getExportHistory])

  // Progress helpers
  const resetProgress = useCallback(() => {
    updateExportState({
      exportProgress: 0,
      error: null,
      lastExportType: null
    })
  }, [updateExportState])

  const isExporting = exportState.isExporting
  const canExport = useCallback((cases: CommissionCaseDetail[]) => {
    if (isExporting) return false
    const validation = validateExportData(cases)
    return validation.isValid
  }, [isExporting])

  // Return hook interface
  return {
    // State
    exportState,
    isExporting,
    exportProgress: exportState.exportProgress,
    exportError: exportState.error,
    lastExportType: exportState.lastExportType,
    
    // Main export functions
    exportExcel,
    exportPdf,
    exportPayroll,
    exportSummary,
    prepareEmail,
    printCommissionReport,
    exportAll,
    
    // Quick actions
    quickActions,
    
    // Validation
    validateCases,
    canExport,
    
    // Utilities
    resetProgress,
    getExportHistory,
    addToExportHistory,
    
    // Progress tracking
    updateProgress: (progress: number) => updateExportState({ exportProgress: progress }),
    setError: (error: string) => updateExportState({ error }),
    clearError: () => updateExportState({ error: null })
  }
}

// Enklare hook för basic export-funktionalitet
export const useQuickExport = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const quickExportExcel = useCallback(async (cases: CommissionCaseDetail[], month: string) => {
    setLoading(true)
    setError(null)
    
    try {
      await exportToExcel(cases, month)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export misslyckades'
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [])
  
  const quickPrint = useCallback((cases: CommissionCaseDetail[], month: string) => {
    try {
      printReport(cases, month)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Utskrift misslyckades'
      setError(errorMessage)
      return false
    }
  }, [])
  
  return {
    loading,
    error,
    quickExportExcel,
    quickPrint,
    clearError: () => setError(null)
  }
}
import React, { useEffect, useState } from 'react'
import { Download, FileText, Send, Eye, Trash2, Calendar, User } from 'lucide-react'
import { sanitationReportService, SanitationReport } from '../../services/sanitationReportService'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'

interface SanitationReportListProps {
  caseId?: string
  customerId?: string
  showActions?: boolean
  maxItems?: number
}

export const SanitationReportList: React.FC<SanitationReportListProps> = ({
  caseId,
  customerId,
  showActions = true,
  maxItems
}) => {
  const [reports, setReports] = useState<SanitationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const { profile } = useAuth()

  useEffect(() => {
    loadReports()
  }, [caseId, customerId])

  const loadReports = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      
      if (caseId) {
        filters.case_id = caseId
      }
      if (customerId) {
        filters.customer_id = customerId
      }

      const { data, error } = await sanitationReportService.getReports(filters)
      
      if (error) {
        console.error('Error loading reports:', error)
        toast.error('Kunde inte ladda rapporter')
        return
      }

      let reportList = data || []
      if (maxItems && reportList.length > maxItems) {
        reportList = reportList.slice(0, maxItems)
      }

      setReports(reportList)
    } catch (error) {
      console.error('Error in loadReports:', error)
      toast.error('Ett fel uppstod vid laddning av rapporter')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (report: SanitationReport) => {
    if (!report.id) return
    
    try {
      setDownloading(report.id)
      const { data: blob, error } = await sanitationReportService.downloadReport(report.id)
      
      if (error || !blob) {
        toast.error('Kunde inte ladda ner rapport')
        return
      }

      // Skapa nedladdningslänk
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = report.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Rapport nedladdad!')
    } catch (error) {
      console.error('Error downloading report:', error)
      toast.error('Ett fel uppstod vid nedladdning')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (report: SanitationReport) => {
    if (!report.id) return
    
    if (!confirm('Är du säker på att du vill ta bort denna rapport?')) {
      return
    }

    try {
      const { error } = await sanitationReportService.deleteReport(report.id)
      
      if (error) {
        toast.error('Kunde inte ta bort rapport')
        return
      }

      toast.success('Rapport borttagen!')
      loadReports() // Ladda om listan
    } catch (error) {
      console.error('Error deleting report:', error)
      toast.error('Ett fel uppstod vid borttagning')
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-'
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`
    }
    return `${kb.toFixed(0)} KB`
  }

  const getStatusBadge = (report: SanitationReport) => {
    if (report.sent_to_customer && report.sent_to_technician) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Skickad till båda
        </span>
      )
    }
    if (report.sent_to_customer) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Skickad till kund
        </span>
      )
    }
    if (report.sent_to_technician) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          Skickad till tekniker
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
        Genererad
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Inga saneringsrapporter finns ännu
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {report.file_name}
                  </h4>
                  {getStatusBadge(report)}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(report.report_date || report.created_at)}</span>
                  </div>
                  
                  {report.technician_name && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{report.technician_name}</span>
                    </div>
                  )}
                  
                  {report.pest_type && (
                    <div>
                      <span className="font-medium">Skadedjur:</span> {report.pest_type}
                    </div>
                  )}
                  
                  <div>
                    <span className="font-medium">Storlek:</span> {formatFileSize(report.file_size)}
                  </div>
                </div>

                {report.address && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Adress:</span> {report.address}
                  </div>
                )}
              </div>

              {showActions && (
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleDownload(report)}
                    disabled={downloading === report.id}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                    title="Ladda ner"
                  >
                    {downloading === report.id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                    ) : (
                      <Download className="h-5 w-5" />
                    )}
                  </button>

                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(report)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Ta bort"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {(report.sent_to_customer_at || report.sent_to_technician_at) && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {report.sent_to_customer_at && (
                    <div className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      <span>Skickad till kund: {formatDate(report.sent_to_customer_at)}</span>
                    </div>
                  )}
                  {report.sent_to_technician_at && (
                    <div className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      <span>Skickad till tekniker: {formatDate(report.sent_to_technician_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {maxItems && reports.length === maxItems && (
        <div className="text-center">
          <button className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
            Visa alla rapporter →
          </button>
        </div>
      )}
    </div>
  )
}
import React, { useEffect, useState } from 'react'
import { FileText, Download, Calendar, Search, Filter } from 'lucide-react'
import { sanitationReportService, SanitationReport } from '../../services/sanitationReportService'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const SanitationReports: React.FC = () => {
  const [reports, setReports] = useState<SanitationReport[]>([])
  const [filteredReports, setFilteredReports] = useState<SanitationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | '30d' | '3m' | '6m' | '1y'>('all')
  const { profile } = useAuth()

  useEffect(() => {
    if (profile?.customer_id) {
      loadReports()
    }
  }, [profile])

  useEffect(() => {
    filterReports()
  }, [reports, searchTerm, dateFilter])

  const loadReports = async () => {
    if (!profile?.customer_id) return
    
    try {
      setLoading(true)
      const { data, error } = await sanitationReportService.getReports({
        customer_id: profile.customer_id
      })
      
      if (error) {
        console.error('Error loading reports:', error)
        toast.error('Kunde inte ladda rapporter')
        return
      }

      setReports(data || [])
    } catch (error) {
      console.error('Error in loadReports:', error)
      toast.error('Ett fel uppstod vid laddning av rapporter')
    } finally {
      setLoading(false)
    }
  }

  const filterReports = () => {
    let filtered = [...reports]

    // Sökfilter
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.pest_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.technician_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Datumfilter
    if (dateFilter !== 'all') {
      const now = new Date()
      let filterDate = new Date()
      
      switch (dateFilter) {
        case '30d':
          filterDate.setDate(now.getDate() - 30)
          break
        case '3m':
          filterDate.setMonth(now.getMonth() - 3)
          break
        case '6m':
          filterDate.setMonth(now.getMonth() - 6)
          break
        case '1y':
          filterDate.setFullYear(now.getFullYear() - 1)
          break
      }

      filtered = filtered.filter(report => {
        const reportDate = new Date(report.created_at || '')
        return reportDate >= filterDate
      })
    }

    setFilteredReports(filtered)
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Saneringsrapporter
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Här hittar du alla dina saneringsrapporter från genomförda behandlingar
          </p>
        </div>

        {/* Statistik-kort */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Totalt antal rapporter
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {reports.length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Senaste rapporten
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                  {reports.length > 0 
                    ? formatDate(reports[0].created_at)
                    : 'Ingen rapport'
                  }
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total storlek
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatFileSize(reports.reduce((sum, r) => sum + (r.file_size || 0), 0))}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Download className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter och sök */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Sök rapporter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">Alla rapporter</option>
                <option value="30d">Senaste 30 dagarna</option>
                <option value="3m">Senaste 3 månaderna</option>
                <option value="6m">Senaste 6 månaderna</option>
                <option value="1y">Senaste året</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rapportlista */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm || dateFilter !== 'all' 
                ? 'Inga rapporter hittades'
                : 'Inga rapporter ännu'
              }
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || dateFilter !== 'all'
                ? 'Prova att ändra dina sökkriterier'
                : 'Dina saneringsrapporter kommer att visas här när de har genererats'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {report.file_name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(report.report_date || report.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      {report.technician_name && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Tekniker:
                          </span>{' '}
                          <span className="text-gray-600 dark:text-gray-400">
                            {report.technician_name}
                          </span>
                        </div>
                      )}
                      
                      {report.pest_type && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Skadedjur:
                          </span>{' '}
                          <span className="text-gray-600 dark:text-gray-400">
                            {report.pest_type}
                          </span>
                        </div>
                      )}
                      
                      {report.address && (
                        <div className="sm:col-span-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Adress:
                          </span>{' '}
                          <span className="text-gray-600 dark:text-gray-400">
                            {report.address}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Storlek:
                        </span>{' '}
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatFileSize(report.file_size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(report)}
                    disabled={downloading === report.id}
                    className="ml-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloading === report.id ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Laddar...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5" />
                        <span>Ladda ner</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SanitationReports
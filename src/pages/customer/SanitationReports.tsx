import React, { useEffect, useState } from 'react'
import { FileText, Download, Calendar, Search, Filter, History, X, TrendingUp, BarChart3 } from 'lucide-react'
import { sanitationReportService, SanitationReport } from '../../services/sanitationReportService'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

const SanitationReports: React.FC = () => {
  const [reports, setReports] = useState<SanitationReport[]>([])
  const [filteredReports, setFilteredReports] = useState<SanitationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | '30d' | '3m' | '6m' | '1y'>('all')
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<{
    current: SanitationReport | null
    history: SanitationReport[]
    total_versions: number
  } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
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

  const handleShowHistory = async (caseId: string) => {
    try {
      setLoadingHistory(true)
      setShowHistory(caseId)
      
      const { data, error } = await sanitationReportService.getReportHistory(caseId)
      
      if (error) {
        console.error('Error loading report history:', error)
        toast.error('Kunde inte ladda rapporthistorik')
        setShowHistory(null)
        return
      }

      setHistoryData(data)
    } catch (error) {
      console.error('Error in handleShowHistory:', error)
      toast.error('Ett fel uppstod vid laddning av historik')
      setShowHistory(null)
    } finally {
      setLoadingHistory(false)
    }
  }

  const closeHistory = () => {
    setShowHistory(null)
    setHistoryData(null)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <FileText className="w-7 h-7 text-blue-400" />
                Saneringsrapporter
              </h1>
              <p className="text-slate-400 mt-1">
                Alla era saneringsrapporter från genomförda behandlingar
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Filter Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
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
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="group relative bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-emerald-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">
                    Totalt antal rapporter
                  </p>
                  <p className="text-2xl font-bold text-white mt-1 font-mono">
                    {reports.length}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <FileText className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="group relative bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">
                    Senaste rapporten
                  </p>
                  <p className="text-lg font-semibold text-white mt-1">
                    {reports.length > 0 
                      ? formatDate(reports[0].created_at)
                      : 'Ingen rapport'
                    }
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="group relative bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">
                    Total storlek
                  </p>
                  <p className="text-2xl font-bold text-white mt-1 font-mono">
                    {formatFileSize(reports.reduce((sum, r) => sum + (r.file_size || 0), 0))}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <Download className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Sök rapporter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LoadingSpinner />
              <p className="text-slate-400 mt-4">Laddar rapporter...</p>
            </div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-12 text-center">
            <FileText className="mx-auto h-16 w-16 text-slate-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm || dateFilter !== 'all' 
                ? 'Inga rapporter hittades'
                : 'Inga rapporter ännu'
              }
            </h3>
            <p className="text-slate-400">
              {searchTerm || dateFilter !== 'all'
                ? 'Prova att ändra dina sökkriterier'
                : 'Era saneringsrapporter kommer att visas här när de har genererats'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="group relative bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-emerald-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <FileText className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">
                            {report.file_name}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {formatDate(report.report_date || report.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        {report.technician_name && (
                          <div>
                            <span className="font-medium text-slate-300">
                              Tekniker:
                            </span>{' '}
                            <span className="text-slate-400">
                              {report.technician_name}
                            </span>
                          </div>
                        )}
                        
                        {report.pest_type && (
                          <div>
                            <span className="font-medium text-slate-300">
                              Skadedjur:
                            </span>{' '}
                            <span className="text-slate-400">
                              {report.pest_type}
                            </span>
                          </div>
                        )}
                        
                        {report.address && (
                          <div className="sm:col-span-2">
                            <span className="font-medium text-slate-300">
                              Adress:
                            </span>{' '}
                            <span className="text-slate-400">
                              {report.address}
                            </span>
                          </div>
                        )}
                        
                        <div>
                          <span className="font-medium text-slate-300">
                            Storlek:
                          </span>{' '}
                          <span className="text-slate-400">
                            {formatFileSize(report.file_size)}
                          </span>
                        </div>
                        
                        {report.version && report.version > 1 && (
                          <div>
                            <span className="font-medium text-slate-300">
                              Version:
                            </span>{' '}
                            <span className="text-slate-400">
                              {report.version}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-6">
                      {/* Show history button if there are multiple versions */}
                      {report.version && report.version > 1 && (
                        <button
                          onClick={() => handleShowHistory(report.case_id)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
                          title="Visa rapporthistorik"
                        >
                          <History className="h-4 w-4" />
                          <span className="hidden sm:inline">Historik</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={downloading === report.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                  <History className="w-6 h-6 text-purple-400" />
                  Rapporthistorik
                </h3>
                <button
                  onClick={closeHistory}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <LoadingSpinner />
                      <span className="block mt-3 text-slate-400">Laddar historik...</span>
                    </div>
                  </div>
                ) : historyData ? (
                  <div className="space-y-4">
                    <div className="mb-6">
                      <p className="text-slate-400 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Totalt {historyData.total_versions} versioner av denna rapport
                      </p>
                    </div>

                    {historyData.history.map((historyReport, index) => (
                      <div
                        key={historyReport.id}
                        className={`group relative p-4 rounded-lg border transition-all duration-200 ${
                          historyReport.is_current
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${
                                historyReport.is_current 
                                  ? 'bg-emerald-500/20 border border-emerald-500/30' 
                                  : 'bg-slate-700 border border-slate-600'
                              }`}>
                                <FileText className={`h-5 w-5 ${
                                  historyReport.is_current ? 'text-emerald-400' : 'text-slate-400'
                                }`} />
                              </div>
                              <div>
                                <h4 className="font-medium text-white">
                                  {historyReport.file_name}
                                </h4>
                                {historyReport.is_current && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium mt-1">
                                    <TrendingUp className="w-3 h-3" />
                                    Aktuell version
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-slate-300">Version:</span>{' '}
                                <span className="text-slate-400 font-mono">{historyReport.version || 1}</span>
                              </div>
                              <div>
                                <span className="font-medium text-slate-300">Skapad:</span>{' '}
                                <span className="text-slate-400">
                                  {formatDate(historyReport.created_at)}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-slate-300">Storlek:</span>{' '}
                                <span className="text-slate-400 font-mono">
                                  {formatFileSize(historyReport.file_size)}
                                </span>
                              </div>
                              {historyReport.replaced_at && (
                                <div>
                                  <span className="font-medium text-slate-300">Ersatt:</span>{' '}
                                  <span className="text-slate-400">
                                    {formatDate(historyReport.replaced_at)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDownload(historyReport)}
                            disabled={downloading === historyReport.id}
                            className="ml-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {downloading === historyReport.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span className="hidden sm:inline">Laddar...</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Ladda ner</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-slate-500 mb-2">
                      <X className="w-8 h-8 mx-auto" />
                    </div>
                    <p className="text-slate-400">Kunde inte ladda historik</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SanitationReports
import React, { useEffect, useState, useMemo } from 'react'
import { FileText, Download, Calendar, Search, History, X, TrendingUp, BarChart3, ClipboardCheck, FileSpreadsheet, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { sanitationReportService, SanitationReport } from '../../services/sanitationReportService'
import { getCompletedSessionsWithSummary } from '../../services/inspectionSessionService'
import { generateInspectionPDF, generateInspectionExcel } from '../../services/inspectionReportService'
import type { InspectionSessionWithRelations } from '../../types/inspectionSession'
import { useAuth } from '../../contexts/AuthContext'
import { useInspectionStatusLabels } from '../../hooks/useInspectionStatusLabels'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

type ReportTab = 'inspections' | 'sanitation'

interface SanitationReportsProps {
  customerId?: string
}

const SanitationReports: React.FC<SanitationReportsProps> = ({ customerId: externalCustomerId }) => {
  const { getLabel: getInspLabel, getColor: getInspColor } = useInspectionStatusLabels()
  const [activeTab, setActiveTab] = useState<ReportTab>('inspections')

  const [reports, setReports] = useState<SanitationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<{
    current: SanitationReport | null
    history: SanitationReport[]
    total_versions: number
  } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [inspectionSessions, setInspectionSessions] = useState<InspectionSessionWithRelations[]>([])
  const [loadingInspections, setLoadingInspections] = useState(true)
  const [downloadingInspection, setDownloadingInspection] = useState<string | null>(null)
  const [sortDesc, setSortDesc] = useState(true)

  const { profile } = useAuth()
  const effectiveCustomerId = externalCustomerId || profile?.customer_id

  useEffect(() => {
    if (effectiveCustomerId) {
      loadReports()
      loadInspectionSessions()
    }
  }, [effectiveCustomerId])

  const loadReports = async () => {
    if (!effectiveCustomerId) return
    try {
      setLoading(true)
      const { data, error } = await sanitationReportService.getReports({ customer_id: effectiveCustomerId })
      if (error) { toast.error('Kunde inte ladda rapporter'); return }
      setReports(data || [])
    } catch { toast.error('Ett fel uppstod vid laddning av rapporter') }
    finally { setLoading(false) }
  }

  const loadInspectionSessions = async () => {
    if (!effectiveCustomerId) return
    try {
      setLoadingInspections(true)
      const sessions = await getCompletedSessionsWithSummary(effectiveCustomerId, 100)
      setInspectionSessions(sessions)
    } catch { toast.error('Kunde inte ladda kontrollrapporter') }
    finally { setLoadingInspections(false) }
  }

  const handleDownload = async (report: SanitationReport) => {
    if (!report.id) return
    try {
      setDownloading(report.id)
      const { data: blob, error } = await sanitationReportService.downloadReport(report.id)
      if (error || !blob) { toast.error('Kunde inte ladda ner rapport'); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = report.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Rapport nedladdad!')
    } catch { toast.error('Ett fel uppstod vid nedladdning') }
    finally { setDownloading(null) }
  }

  const handleDownloadInspection = async (sessionId: string, type: 'pdf' | 'excel') => {
    try {
      setDownloadingInspection(`${sessionId}-${type}`)
      if (type === 'pdf') await generateInspectionPDF(sessionId)
      else await generateInspectionExcel(sessionId)
      toast.success(`${type === 'pdf' ? 'PDF' : 'Excel'}-rapport nedladdad!`)
    } catch { toast.error('Kunde inte generera rapport') }
    finally { setDownloadingInspection(null) }
  }

  const handleShowHistory = async (caseId: string) => {
    try {
      setLoadingHistory(true)
      setShowHistory(caseId)
      const { data, error } = await sanitationReportService.getReportHistory(caseId)
      if (error) { toast.error('Kunde inte ladda rapporthistorik'); setShowHistory(null); return }
      setHistoryData(data)
    } catch { toast.error('Ett fel uppstod vid laddning av historik'); setShowHistory(null) }
    finally { setLoadingHistory(false) }
  }

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-'
    const mb = bytes / 1024 / 1024
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
  }

  // Sorted + filtered inspection sessions
  const sortedSessions = useMemo(() => {
    return [...inspectionSessions].sort((a, b) => {
      const da = new Date(a.completed_at || a.created_at || 0).getTime()
      const db = new Date(b.completed_at || b.created_at || 0).getTime()
      return sortDesc ? db - da : da - db
    })
  }, [inspectionSessions, sortDesc])

  // Sorted + filtered sanitation reports
  const filteredReports = useMemo(() => {
    let filtered = [...reports]
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.file_name.toLowerCase().includes(q) ||
        r.pest_type?.toLowerCase().includes(q) ||
        r.technician_name?.toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => {
      const da = new Date(a.report_date || a.created_at || 0).getTime()
      const db = new Date(b.report_date || b.created_at || 0).getTime()
      return sortDesc ? db - da : da - db
    })
  }, [reports, searchTerm, sortDesc])

  // --- Inspection Reports Tab ---
  const renderInspectionReports = () => {
    if (loadingInspections) {
      return (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      )
    }

    if (inspectionSessions.length === 0) {
      return (
        <div className="rounded-xl border border-slate-700/60 p-10 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-400">Inga kontrollrapporter ännu</p>
          <p className="text-xs text-slate-500 mt-1">Era kontrollrapporter visas här efter genomförda kontroller</p>
        </div>
      )
    }

    const totalStations = inspectionSessions.reduce((sum, s) => sum + (s.inspection_summary?.total || 0), 0)
    const latestDate = inspectionSessions[0]?.completed_at || inspectionSessions[0]?.created_at

    return (
      <div className="space-y-4">
        {/* Compact stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-700/60 p-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Genomförda</p>
            <p className="text-xl font-semibold text-white">{inspectionSessions.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 p-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Senaste</p>
            <p className="text-sm font-medium text-white truncate">{latestDate ? format(new Date(latestDate), 'd MMM yyyy', { locale: sv }) : '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 p-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Stationer totalt</p>
            <p className="text-xl font-semibold text-white">{totalStations}</p>
          </div>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{inspectionSessions.length} rapporter</p>
          <button
            onClick={() => setSortDesc(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {sortDesc ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            {sortDesc ? 'Nyast först' : 'Äldst först'}
          </button>
        </div>

        {/* List */}
        <div className="rounded-xl border border-slate-700/60 overflow-hidden divide-y divide-slate-700/40">
          {sortedSessions.map((session) => {
            const summary = session.inspection_summary
            const sessionDate = session.completed_at || session.created_at
            const isDownloadingPDF = downloadingInspection === `${session.id}-pdf`
            const isDownloadingExcel = downloadingInspection === `${session.id}-excel`

            return (
              <div key={session.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition-colors">
                <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 shrink-0">
                  <ClipboardCheck className="w-4 h-4 text-[#20c58f]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">
                      Inspektion stationer
                    </p>
                    <span className="text-xs text-slate-500">
                      {sessionDate ? format(new Date(sessionDate), 'd MMM yyyy', { locale: sv }) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500">{session.technician?.name || 'Okänd tekniker'}</span>
                    {summary && (
                      <span className="text-xs text-slate-600">·</span>
                    )}
                    {summary && (['none', 'low', 'medium', 'high'] as const).map(lvl => (
                      summary[lvl] > 0 ? (
                        <span key={lvl} className="flex items-center gap-1 text-xs" style={{ color: getInspColor(lvl) }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: getInspColor(lvl) }} />
                          {summary[lvl]} {getInspLabel(lvl)}
                        </span>
                      ) : null
                    ))}
                    {summary && (
                      <span className="text-xs text-slate-600">· {summary.total} st</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDownloadInspection(session.id, 'pdf')}
                    disabled={isDownloadingPDF}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#20c58f] hover:bg-[#1aad7d] text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isDownloadingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                  <button
                    onClick={() => handleDownloadInspection(session.id, 'excel')}
                    disabled={isDownloadingExcel}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isDownloadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    Excel
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // --- Sanitation Reports Tab ---
  const renderSanitationReports = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      )
    }

    if (reports.length === 0) {
      return (
        <div className="rounded-xl border border-slate-700/60 p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-400">Inga saneringsrapporter ännu</p>
          <p className="text-xs text-slate-500 mt-1">Era saneringsrapporter visas här när de genererats</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Search + sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Sök rapporter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800/60 border border-slate-700/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]/50"
            />
          </div>
          <button
            onClick={() => setSortDesc(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors shrink-0"
          >
            {sortDesc ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            {sortDesc ? 'Nyast först' : 'Äldst först'}
          </button>
        </div>

        {filteredReports.length === 0 ? (
          <div className="rounded-xl border border-slate-700/60 p-8 text-center">
            <p className="text-sm text-slate-400">Inga rapporter hittades</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700/60 overflow-hidden divide-y divide-slate-700/40">
            {filteredReports.map((report) => (
              <div key={report.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition-colors">
                <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 shrink-0">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{report.file_name}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-500">
                    <span>{formatDate(report.report_date || report.created_at)}</span>
                    {report.technician_name && <><span>·</span><span>{report.technician_name}</span></>}
                    {report.pest_type && <><span>·</span><span>{report.pest_type}</span></>}
                    <span>·</span><span>{formatFileSize(report.file_size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {report.version && report.version > 1 && (
                    <button
                      onClick={() => handleShowHistory(report.case_id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Historik</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(report)}
                    disabled={downloading === report.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#20c58f] hover:bg-[#1aad7d] text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {downloading === report.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    Ladda ner
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Rapporter
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Kontrollrapporter och saneringsrapporter</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700/60 pb-px">
        <button
          onClick={() => setActiveTab('inspections')}
          className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'inspections'
              ? 'text-white bg-[#20c58f]/10 border border-[#20c58f]/30 border-b-0 -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          Kontrollrapporter
          {!loadingInspections && inspectionSessions.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-700/80 text-slate-400">
              {inspectionSessions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sanitation')}
          className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'sanitation'
              ? 'text-white bg-[#20c58f]/10 border border-[#20c58f]/30 border-b-0 -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Saneringsrapporter
          {!loading && reports.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-700/80 text-slate-400">
              {reports.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'inspections' ? renderInspectionReports() : renderSanitationReports()}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Rapporthistorik
              </h3>
              <button onClick={() => { setShowHistory(null); setHistoryData(null) }} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[65vh]">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : historyData ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 mb-3">{historyData.total_versions} versioner av denna rapport</p>
                  {historyData.history.map((historyReport) => (
                    <div
                      key={historyReport.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        historyReport.is_current
                          ? 'border-[#20c58f]/30 bg-[#20c58f]/5'
                          : 'border-slate-700/60 bg-slate-800/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white truncate">{historyReport.file_name}</p>
                          {historyReport.is_current && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#20c58f]/20 text-[#20c58f] font-medium">Aktuell</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          v{historyReport.version || 1} · {formatDate(historyReport.created_at)} · {formatFileSize(historyReport.file_size)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownload(historyReport)}
                        disabled={downloading === historyReport.id}
                        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#20c58f] hover:bg-[#1aad7d] text-white text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {downloading === historyReport.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        Ladda ner
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-8">Kunde inte ladda historik</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SanitationReports

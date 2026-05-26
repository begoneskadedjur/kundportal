// src/components/organisation/OrganisationSanitationReports.tsx - Saneringsrapporter för organisationer
import React, { useEffect, useState, useCallback } from 'react'
import { FileText, Download, Calendar, Search, History, X, MapPin, Building2, Loader2 } from 'lucide-react'
import { sanitationReportService, SanitationReport } from '../../services/sanitationReportService'
import { useMultisite } from '../../contexts/MultisiteContext'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

interface OrganisationSanitationReportsProps {
  customerId?: string
  siteIds?: string[]
  userRoleType?: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

const OrganisationSanitationReports: React.FC<OrganisationSanitationReportsProps> = ({
  customerId,
  siteIds,
  userRoleType
}) => {
  const { organization, sites, accessibleSites } = useMultisite()
  const [reports, setReports] = useState<SanitationReport[]>([])
  const [filteredReports, setFilteredReports] = useState<SanitationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | '30d' | '3m' | '6m' | '1y'>('all')
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<{
    current: SanitationReport | null
    history: SanitationReport[]
    total_versions: number
  } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [siteInfo, setSiteInfo] = useState<Map<string, { name: string, region: string }>>(new Map())

  const getAvailableSites = () => {
    if (userRoleType === 'verksamhetschef') return sites
    if (userRoleType === 'regionchef' || userRoleType === 'platsansvarig') return accessibleSites
    return []
  }

  const availableSites = getAvailableSites()

  useEffect(() => { loadReports() }, [customerId, siteIds, organization, availableSites])
  useEffect(() => { filterReports() }, [reports, searchTerm, dateFilter, selectedSite])

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      let customerIds: string[] = []

      if (customerId) {
        customerIds = [customerId]
      } else if (siteIds && siteIds.length > 0) {
        customerIds = siteIds
      } else if (organization?.organization_id) {
        const { data: orgSites, error: orgError } = await supabase
          .from('customers')
          .select('id, company_name, site_name, region')
          .eq('organization_id', organization.organization_id)
          .eq('is_multisite', true)

        if (orgError) throw orgError

        if (orgSites && orgSites.length > 0) {
          const siteMap = new Map()
          orgSites.forEach(site => {
            siteMap.set(site.id, {
              name: site.site_name || site.company_name,
              region: site.region || 'Okänd region'
            })
          })
          setSiteInfo(siteMap)

          customerIds = userRoleType === 'verksamhetschef'
            ? orgSites.map(s => s.id)
            : availableSites.map(s => s.id)
        }
      }

      if (customerIds.length === 0) { setReports([]); setLoading(false); return }

      const allReports: SanitationReport[] = []
      for (const custId of customerIds) {
        const { data, error } = await sanitationReportService.getReports({ customer_id: custId })
        if (!error && data) allReports.push(...data)
      }

      allReports.sort((a, b) =>
        new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      )

      setReports(allReports)
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Kunde inte ladda rapporter')
    } finally {
      setLoading(false)
    }
  }, [customerId, siteIds, organization, availableSites, userRoleType])

  const filterReports = () => {
    let filtered = [...reports]

    if (selectedSite !== 'all') {
      filtered = filtered.filter(r => r.customer_id === selectedSite)
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.file_name.toLowerCase().includes(q) ||
        r.pest_type?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q) ||
        r.technician_name?.toLowerCase().includes(q)
      )
    }

    if (dateFilter !== 'all') {
      const filterDate = new Date()
      if (dateFilter === '30d') filterDate.setDate(filterDate.getDate() - 30)
      else if (dateFilter === '3m') filterDate.setMonth(filterDate.getMonth() - 3)
      else if (dateFilter === '6m') filterDate.setMonth(filterDate.getMonth() - 6)
      else if (dateFilter === '1y') filterDate.setFullYear(filterDate.getFullYear() - 1)
      filtered = filtered.filter(r => new Date(r.created_at || '') >= filterDate)
    }

    setFilteredReports(filtered)
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
    } catch {
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
      if (error) { toast.error('Kunde inte ladda rapporthistorik'); setShowHistory(null); return }
      setHistoryData(data)
    } catch {
      toast.error('Ett fel uppstod vid laddning av historik')
      setShowHistory(null)
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-'
    const mb = bytes / 1024 / 1024
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
  }

  const getSiteName = (cid: string | null | undefined) =>
    cid ? (siteInfo.get(cid)?.name || 'Okänd enhet') : 'Okänd enhet'

  const getSiteRegion = (cid: string | null | undefined) =>
    cid ? (siteInfo.get(cid)?.region || '') : ''

  const uniqueSitesWithReports = new Set(reports.map(r => r.customer_id).filter(Boolean))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Saneringsrapporter
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {userRoleType === 'verksamhetschef' && 'Alla saneringsrapporter för organisationen'}
            {userRoleType === 'regionchef' && 'Saneringsrapporter för din region'}
            {userRoleType === 'platsansvarig' && 'Saneringsrapporter för din enhet'}
          </p>
        </div>
        {!loading && reports.length > 0 && (
          <span className="text-xs text-slate-500">{reports.length} rapporter</span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {uniqueSitesWithReports.size > 1 && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800/60 border border-slate-700/60 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]/50"
            >
              <option value="all">Alla enheter</option>
              {Array.from(uniqueSitesWithReports).map(siteId => (
                <option key={siteId} value={siteId ?? ''}>{getSiteName(siteId)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as any)}
            className="px-3 py-1.5 text-sm bg-slate-800/60 border border-slate-700/60 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]/50"
          >
            <option value="all">Alla perioder</option>
            <option value="30d">Senaste 30 dagar</option>
            <option value="3m">Senaste 3 månader</option>
            <option value="6m">Senaste 6 månader</option>
            <option value="1y">Senaste året</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Sök rapporter..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800/60 border border-slate-700/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]/50"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-400">
            {searchTerm || dateFilter !== 'all' || selectedSite !== 'all'
              ? 'Inga rapporter matchar dina filter'
              : 'Inga saneringsrapporter än'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/60 overflow-hidden divide-y divide-slate-700/40">
          {filteredReports.map(report => (
            <div key={report.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition-colors">
              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 shrink-0">
                <FileText className="w-4 h-4 text-slate-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white truncate">{report.file_name}</p>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {getSiteName(report.customer_id)}
                    {getSiteRegion(report.customer_id) && <span>· {getSiteRegion(report.customer_id)}</span>}
                  </span>
                  <span>·</span>
                  <span>{formatDate(report.created_at)}</span>
                  {report.technician_name && <><span>·</span><span>{report.technician_name}</span></>}
                  {report.pest_type && <><span>·</span><span>{report.pest_type}</span></>}
                  <span>·</span>
                  <span>{formatFileSize(report.file_size)}</span>
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

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Rapporthistorik
              </h3>
              <button
                onClick={() => { setShowHistory(null); setHistoryData(null) }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
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
                  {historyData.history.map(historyReport => (
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

export default OrganisationSanitationReports

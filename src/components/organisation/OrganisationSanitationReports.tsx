// src/components/organisation/OrganisationSanitationReports.tsx - Saneringsrapporter för organisationer
import React, { useEffect, useState } from 'react'
import { FileText, Download, Calendar, Search, Filter, History, X, TrendingUp, BarChart3, MapPin, Building2 } from 'lucide-react'
import { sanitationReportService, SanitationReport } from '../../services/sanitationReportService'
import { useMultisite } from '../../contexts/MultisiteContext'
import LoadingSpinner from '../shared/LoadingSpinner'
import Button from '../ui/Button'
import Card from '../ui/Card'
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

  // Bestäm vilka sites användaren har tillgång till
  const getAvailableSites = () => {
    if (userRoleType === 'verksamhetschef') {
      return sites
    } else if (userRoleType === 'regionchef' || userRoleType === 'platsansvarig') {
      return accessibleSites
    }
    return []
  }

  const availableSites = getAvailableSites()

  useEffect(() => {
    loadReports()
  }, [customerId, siteIds, organization])

  useEffect(() => {
    filterReports()
  }, [reports, searchTerm, dateFilter, selectedSite])

  const loadReports = async () => {
    try {
      setLoading(true)
      
      // Bygg lista av customer_ids att hämta rapporter för
      let customerIds: string[] = []
      
      if (customerId) {
        // Om specifik customer_id är angiven
        customerIds = [customerId]
      } else if (siteIds && siteIds.length > 0) {
        // Om site IDs är angivna
        customerIds = siteIds
      } else if (organization?.organization_id) {
        // Hämta alla customer_ids för organisationen
        const { data: orgSites, error: orgError } = await supabase
          .from('customers')
          .select('id, company_name, site_name, region')
          .eq('organization_id', organization.organization_id)
          .eq('is_multisite', true)
        
        if (orgError) throw orgError
        
        if (orgSites && orgSites.length > 0) {
          // Spara site-information för visning
          const siteMap = new Map()
          orgSites.forEach(site => {
            siteMap.set(site.id, {
              name: site.site_name || site.company_name,
              region: site.region || 'Okänd region'
            })
          })
          setSiteInfo(siteMap)
          
          // Filtrera baserat på användarens roll
          if (userRoleType === 'verksamhetschef') {
            customerIds = orgSites.map(s => s.id)
          } else {
            // För region/platsansvarig, använd accessibleSites direkt
            // accessibleSites är redan filtrerat korrekt av MultisiteContext
            customerIds = availableSites.map(s => s.id)
          }
        }
      }
      
      if (customerIds.length === 0) {
        setReports([])
        setLoading(false)
        return
      }

      // Hämta rapporter för alla customer_ids
      const allReports: SanitationReport[] = []
      
      for (const custId of customerIds) {
        const { data, error } = await sanitationReportService.getReports({
          customer_id: custId
        })
        
        if (!error && data) {
          allReports.push(...data)
        }
      }
      
      // Sortera rapporter efter datum (nyaste först)
      allReports.sort((a, b) => {
        const dateA = new Date(a.created_at || '').getTime()
        const dateB = new Date(b.created_at || '').getTime()
        return dateB - dateA
      })
      
      setReports(allReports)
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Kunde inte ladda rapporter')
    } finally {
      setLoading(false)
    }
  }

  const filterReports = () => {
    let filtered = [...reports]

    // Site-filter
    if (selectedSite !== 'all') {
      filtered = filtered.filter(report => report.customer_id === selectedSite)
    }

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

  const getSiteName = (customerId: string | null | undefined) => {
    if (!customerId) return 'Okänd enhet'
    return siteInfo.get(customerId)?.name || 'Okänd enhet'
  }

  const getSiteRegion = (customerId: string | null | undefined) => {
    if (!customerId) return ''
    return siteInfo.get(customerId)?.region || ''
  }

  // Räkna unika sites som har rapporter
  const uniqueSitesWithReports = new Set(reports.map(r => r.customer_id).filter(Boolean))

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-purple-700/50">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <FileText className="w-7 h-7 text-purple-400" />
                Saneringsrapporter
              </h2>
              <p className="text-purple-200 mt-1">
                {userRoleType === 'verksamhetschef' && 'Alla saneringsrapporter för organisationen'}
                {userRoleType === 'regionchef' && 'Saneringsrapporter för din region'}
                {userRoleType === 'platsansvarig' && 'Saneringsrapporter för din enhet'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{reports.length}</div>
                <div className="text-sm text-purple-200">Totalt rapporter</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{uniqueSitesWithReports.size}</div>
                <div className="text-sm text-purple-200">Enheter</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Site filter - visa endast om flera sites */}
            {uniqueSitesWithReports.size > 1 && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="all">Alla enheter</option>
                  {Array.from(uniqueSitesWithReports).map(siteId => (
                    <option key={siteId} value={siteId}>
                      {getSiteName(siteId)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
              >
                <option value="all">Alla perioder</option>
                <option value="30d">Senaste 30 dagar</option>
                <option value="3m">Senaste 3 månader</option>
                <option value="6m">Senaste 6 månader</option>
                <option value="1y">Senaste året</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Sök rapporter..."
                  className="w-full pl-10 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-400"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Reports List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner text="Laddar rapporter..." />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
                {searchTerm || dateFilter !== 'all' || selectedSite !== 'all'
                  ? 'Inga rapporter matchar dina filter'
                  : 'Inga saneringsrapporter än'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-400" />
                            {report.file_name}
                          </h3>
                          {/* Site info */}
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="w-3 h-3 text-purple-400" />
                            <span className="text-sm text-purple-300">
                              {getSiteName(report.customer_id)}
                              {getSiteRegion(report.customer_id) && (
                                <span className="text-slate-400"> • {getSiteRegion(report.customer_id)}</span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatFileSize(report.file_size)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {report.pest_type && (
                          <div>
                            <span className="text-slate-500">Skadedjur:</span>
                            <span className="ml-2 text-slate-300">{report.pest_type}</span>
                          </div>
                        )}
                        {report.technician_name && (
                          <div>
                            <span className="text-slate-500">Tekniker:</span>
                            <span className="ml-2 text-slate-300">{report.technician_name}</span>
                          </div>
                        )}
                        {report.address && (
                          <div>
                            <span className="text-slate-500">Adress:</span>
                            <span className="ml-2 text-slate-300">{report.address}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Datum:</span>
                          <span className="ml-2 text-slate-300">{formatDate(report.created_at)}</span>
                        </div>
                      </div>

                      {/* Status indicators */}
                      <div className="flex items-center gap-4 mt-3">
                        {report.sent_to_customer && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                            Skickad till kund
                          </span>
                        )}
                        {report.sent_to_technician && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            Skickad till tekniker
                          </span>
                        )}
                        {report.version && report.version > 1 && (
                          <button
                            onClick={() => handleShowHistory(report.case_id)}
                            className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                          >
                            <History className="w-3 h-3" />
                            Version {report.version}
                          </button>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(report)}
                      disabled={downloading === report.id}
                      className="flex items-center gap-2"
                    >
                      {downloading === report.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Ladda ner
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* History Modal */}
      {showHistory && historyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  Rapporthistorik
                </h3>
                <button
                  onClick={closeHistory}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingHistory ? (
                <LoadingSpinner text="Laddar historik..." />
              ) : (
                <div className="space-y-4">
                  {historyData.history.map((historyReport, index) => (
                    <div
                      key={historyReport.id}
                      className={`p-4 rounded-lg border ${
                        index === 0
                          ? 'bg-slate-700/50 border-purple-500/50'
                          : 'bg-slate-900/50 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              Version {historyReport.version}
                            </span>
                            {index === 0 && (
                              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                                Aktuell
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatDate(historyReport.created_at)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(historyReport)}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-3 h-3" />
                          Ladda ner
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrganisationSanitationReports
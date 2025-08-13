// src/pages/organisation/verksamhetschef/Rapporter.tsx - Rapporter för verksamhetschef
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import { FileText, MapPin, Download, Calendar, TrendingUp, AlertTriangle } from 'lucide-react'
import Button from '../../../components/ui/Button'

// Återanvänd befintliga rapportkomponenter
import SanitationReports from '../../customer/SanitationReports'

interface ReportSummary {
  siteId: string
  siteName: string
  region: string
  totalReports: number
  lastReportDate: string | null
  pendingReports: number
  completedReports: number
}

const VerksamhetschefRapporter: React.FC = () => {
  const { organization, sites, loading: contextLoading } = useMultisite()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [customer, setCustomer] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [reportSummaries, setReportSummaries] = useState<ReportSummary[]>([])
  
  useEffect(() => {
    if (selectedSiteId !== 'all') {
      fetchCustomerForSite()
    } else {
      fetchReportSummaries()
    }
  }, [selectedSiteId, sites])
  
  const fetchCustomerForSite = async () => {
    const site = sites.find(s => s.id === selectedSiteId)
    if (!site || !site.customer_id) {
      setCustomer(null)
      return
    }
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', site.customer_id)
        .single()
      
      if (error) throw error
      setCustomer(data)
    } catch (error) {
      console.error('Error fetching customer:', error)
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchReportSummaries = async () => {
    try {
      setLoading(true)
      const summaries: ReportSummary[] = []
      
      for (const site of sites) {
        if (!site.customer_id) continue
        
        // Hämta rapportdata för varje site
        const { data: reports, error } = await supabase
          .from('sanitation_reports')
          .select('*')
          .eq('customer_id', site.customer_id)
          .order('created_at', { ascending: false })
        
        if (!error && reports) {
          summaries.push({
            siteId: site.id,
            siteName: site.site_name,
            region: site.region || 'Okänd',
            totalReports: reports.length,
            lastReportDate: reports.length > 0 ? reports[0].created_at : null,
            pendingReports: reports.filter(r => r.status === 'pending').length,
            completedReports: reports.filter(r => r.status === 'completed').length
          })
        }
      }
      
      setReportSummaries(summaries)
    } catch (error) {
      console.error('Error fetching report summaries:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const generateOrganizationReport = async () => {
    // Här kan vi implementera PDF-generering för hela organisationen
    console.log('Generating organization-wide report...')
    // TODO: Implementera PDF-export med jsPDF
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar rapporter..." />
      </div>
    )
  }

  return (
    <OrganisationLayout userRoleType="verksamhetschef">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Rapporter - {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                Saneringsrapporter och dokumentation för alla enheter
              </p>
            </div>
            {selectedSiteId === 'all' && (
              <Button
                onClick={generateOrganizationReport}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportera organisationsrapport
              </Button>
            )}
          </div>
        </div>

        {/* Site selector */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-4 flex items-center gap-4">
            <MapPin className="w-5 h-5 text-purple-400" />
            <label className="text-slate-300">Välj enhet:</label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Alla enheter (översikt)</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.site_name} - {site.region}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Rapporter content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar rapporter..." />
          </div>
        ) : selectedSiteId === 'all' ? (
          // Visa översikt av alla rapporter
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span className="text-slate-400 text-sm">Totala rapporter</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {reportSummaries.reduce((sum, s) => sum + s.totalReports, 0)}
                </p>
              </Card>
              
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-slate-400 text-sm">Färdiga</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {reportSummaries.reduce((sum, s) => sum + s.completedReports, 0)}
                </p>
              </Card>
              
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-slate-400 text-sm">Väntande</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {reportSummaries.reduce((sum, s) => sum + s.pendingReports, 0)}
                </p>
              </Card>
              
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span className="text-slate-400 text-sm">Denna månad</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {reportSummaries.filter(s => {
                    if (!s.lastReportDate) return false
                    const date = new Date(s.lastReportDate)
                    const now = new Date()
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
                  }).length}
                </p>
              </Card>
            </div>
            
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white">Rapporter per enhet</h2>
              </div>
              <div className="p-6">
                {reportSummaries.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Inga rapporter hittades</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportSummaries.map((summary) => (
                      <div key={summary.siteId} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-white">{summary.siteName}</h3>
                            <p className="text-sm text-slate-400">{summary.region}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-xs text-slate-500">
                                Totalt: {summary.totalReports}
                              </span>
                              <span className="text-xs text-green-400">
                                Färdiga: {summary.completedReports}
                              </span>
                              <span className="text-xs text-amber-400">
                                Väntande: {summary.pendingReports}
                              </span>
                            </div>
                          </div>
                          {summary.lastReportDate && (
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Senaste rapport</p>
                              <p className="text-sm text-slate-300">
                                {new Date(summary.lastReportDate).toLocaleDateString('sv-SE')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : customer ? (
          // Visa SanitationReports för vald enhet
          <SanitationReports customer={customer} />
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <p className="text-amber-400">Enheten saknar koppling till kunddata</p>
              <p className="text-slate-500 text-sm mt-2">
                Koppla enheten till en kund för att hantera rapporter
              </p>
            </div>
          </Card>
        )}
      </div>
    </OrganisationLayout>
  )
}

export default VerksamhetschefRapporter
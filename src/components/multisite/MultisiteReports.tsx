// src/components/multisite/MultisiteReports.tsx - Reports view for Multisite Portal
import React, { useState, useEffect } from 'react'
import { FileText, Download, Calendar, Filter, Building2, Eye } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'

interface Report {
  id: string
  site_id: string
  site_name: string
  region: string
  report_type: 'sanitation' | 'inspection' | 'treatment' | 'compliance'
  title: string
  description: string
  generated_date: string
  generated_by: string
  file_url?: string
  status: 'draft' | 'approved' | 'published'
  tags: string[]
}

const MultisiteReports: React.FC = () => {
  const { accessibleSites, userRole } = useMultisite()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  useEffect(() => {
    fetchReports()
  }, [accessibleSites, selectedSite, selectedType])

  const fetchReports = async () => {
    if (accessibleSites.length === 0) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Mock data - in real implementation, this would fetch from database
      const mockReports: Report[] = [
        {
          id: '1',
          site_id: accessibleSites[0]?.id || '',
          site_name: accessibleSites[0]?.site_name || 'Test Site',
          region: accessibleSites[0]?.region || 'Stockholm',
          report_type: 'sanitation',
          title: 'Månatlig saneringsrapport - November 2024',
          description: 'Omfattande rapport över genomförda saneringsåtgärder under november månad',
          generated_date: '2024-12-01T10:00:00Z',
          generated_by: 'Marcus Andersson',
          file_url: '/reports/sanitation_nov_2024.pdf',
          status: 'published',
          tags: ['sanering', 'månatlig', 'fullständig']
        },
        {
          id: '2',
          site_id: accessibleSites[0]?.id || '',
          site_name: accessibleSites[0]?.site_name || 'Test Site',
          region: accessibleSites[0]?.region || 'Stockholm',
          report_type: 'inspection',
          title: 'Kvartalsvis inspektionsrapport Q4 2024',
          description: 'Detaljerad inspektionsrapport för fjärde kvartalet 2024',
          generated_date: '2024-11-28T14:30:00Z',
          generated_by: 'Anna Lindberg',
          status: 'approved',
          tags: ['inspektion', 'kvartal', 'Q4']
        },
        {
          id: '3',
          site_id: accessibleSites[1]?.id || '',
          site_name: accessibleSites[1]?.site_name || 'Test Site 2',
          region: accessibleSites[1]?.region || 'Göteborg',
          report_type: 'treatment',
          title: 'Behandlingsrapport - Råttbekämpning',
          description: 'Rapport över genomförd råttbekämpning i köksmiljöer',
          generated_date: '2024-11-25T09:15:00Z',
          generated_by: 'Erik Johansson',
          status: 'draft',
          tags: ['behandling', 'råtta', 'kök']
        },
        {
          id: '4',
          site_id: accessibleSites[0]?.id || '',
          site_name: accessibleSites[0]?.site_name || 'Test Site',
          region: accessibleSites[0]?.region || 'Stockholm',
          report_type: 'compliance',
          title: 'Efterlevnadsrapport - Livsmedelshantering',
          description: 'Rapport över efterlevnad av regler för livsmedelshantering',
          generated_date: '2024-11-20T16:45:00Z',
          generated_by: 'Sofia Persson',
          status: 'published',
          tags: ['efterlevnad', 'livsmedel', 'regler']
        }
      ]

      // Filter reports based on selections
      let filteredReports = mockReports

      if (selectedSite !== 'all') {
        filteredReports = filteredReports.filter(report => report.site_id === selectedSite)
      }

      if (selectedType !== 'all') {
        filteredReports = filteredReports.filter(report => report.report_type === selectedType)
      }

      setReports(filteredReports)
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'sanitation':
        return 'Sanering'
      case 'inspection':
        return 'Inspektion'
      case 'treatment':
        return 'Behandling'
      case 'compliance':
        return 'Efterlevnad'
      default:
        return type
    }
  }

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'sanitation':
        return 'bg-blue-500/20 text-blue-400'
      case 'inspection':
        return 'bg-green-500/20 text-green-400'
      case 'treatment':
        return 'bg-purple-500/20 text-purple-400'
      case 'compliance':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Utkast'
      case 'approved':
        return 'Godkänd'
      case 'published':
        return 'Publicerad'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'approved':
        return 'bg-blue-500/20 text-blue-400'
      case 'published':
        return 'bg-green-500/20 text-green-400'
      default:
        return 'bg-slate-500/20 text-slate-400'
    }
  }

  const handleDownloadReport = (report: Report) => {
    if (report.file_url) {
      // In real implementation, this would handle file download
      console.log('Downloading report:', report.title)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20 rounded-2xl p-6 border border-slate-700/50 backdrop-blur">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Rapporter</h1>
              <p className="text-slate-300">Omfattande dokumentation och rapportering</p>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Alla enheter</option>
                {accessibleSites.map(site => (
                  <option key={site.id} value={site.id}>
                    {site.site_name} ({site.region})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Alla typer</option>
                <option value="sanitation">Sanering</option>
                <option value="inspection">Inspektion</option>
                <option value="treatment">Behandling</option>
                <option value="compliance">Efterlevnad</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-2">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Rapporter ({reports.length})
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {reports.map(report => (
                <div 
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`
                    p-4 rounded-lg border transition-all cursor-pointer
                    ${selectedReport?.id === report.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-600/50 bg-slate-700/30 hover:border-slate-500'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-white mb-1">{report.title}</h4>
                      <p className="text-sm text-slate-400">{report.site_name} • {report.region}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getReportTypeColor(report.report_type)}`}>
                        {getReportTypeLabel(report.report_type)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-300 mb-3 line-clamp-2">{report.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-4">
                      <span>Av: {report.generated_by}</span>
                      <span>{new Date(report.generated_date).toLocaleDateString('sv-SE')}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {report.tags.map(tag => (
                        <span 
                          key={tag}
                          className="px-2 py-1 bg-slate-600/50 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {reports.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Inga rapporter tillgängliga</p>
                <p className="text-sm">Rapporter kommer att visas här när de är tillgängliga</p>
              </div>
            )}
          </Card>
        </div>

        {/* Selected Report Details */}
        <div>
          {selectedReport ? (
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getReportTypeColor(selectedReport.report_type)}`}>
                    {getReportTypeLabel(selectedReport.report_type)}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(selectedReport.status)}`}>
                    {getStatusLabel(selectedReport.status)}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-lg leading-tight">{selectedReport.title}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedReport.site_name} • {selectedReport.region}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-white mb-2">Beskrivning</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedReport.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-600">
                  <h4 className="font-medium text-white mb-2">Rapportdetaljer</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Skapad av:</span>
                      <span className="text-white">{selectedReport.generated_by}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Skapad datum:</span>
                      <span className="text-white">
                        {new Date(selectedReport.generated_date).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-white">{getStatusLabel(selectedReport.status)}</span>
                    </div>
                  </div>
                </div>

                {selectedReport.tags.length > 0 && (
                  <div className="pt-4 border-t border-slate-600">
                    <h4 className="font-medium text-white mb-2">Taggar</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.tags.map(tag => (
                        <span 
                          key={tag}
                          className="px-2 py-1 bg-slate-600/50 text-slate-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-600 space-y-2">
                  <Button
                    onClick={() => handleDownloadReport(selectedReport)}
                    disabled={!selectedReport.file_url}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {selectedReport.file_url ? 'Ladda ner rapport' : 'Rapport ej tillgänglig'}
                  </Button>
                  
                  <Button
                    variant="secondary"
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border-slate-600"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Visa i ny flik
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Välj en rapport för att se detaljer</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default MultisiteReports
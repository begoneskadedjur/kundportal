// src/pages/organisation/shared/Rapporter.tsx - Rapporter för alla multisite-roller
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { FileText, Download, Calendar, Filter, MapPin, TrendingUp, Users, AlertTriangle } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const OrganisationRapporter: React.FC = () => {
  const { organization, sites, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const location = useLocation()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  
  // Bestäm användarroll baserat på URL
  const getUserRoleType = (): 'verksamhetschef' | 'regionchef' | 'platsansvarig' => {
    if (location.pathname.includes('verksamhetschef')) return 'verksamhetschef'
    if (location.pathname.includes('regionchef')) return 'regionchef'
    if (location.pathname.includes('platsansvarig')) return 'platsansvarig'
    return 'verksamhetschef' // fallback
  }
  
  const userRoleType = getUserRoleType()
  
  // Filtrera sites baserat på roll
  const getAvailableSites = () => {
    if (userRoleType === 'verksamhetschef') {
      // Verksamhetschef ser alla sites
      return sites
    } else if (userRoleType === 'regionchef') {
      // Regionchef ser bara sites i sin region
      return accessibleSites
    } else if (userRoleType === 'platsansvarig') {
      // Platsansvarig ser bara sin site
      return accessibleSites
    }
    return []
  }
  
  const availableSites = getAvailableSites()
  
  useEffect(() => {
    generateReportData()
  }, [selectedSiteId, selectedPeriod, availableSites])
  
  const generateReportData = async () => {
    try {
      setLoading(true)
      
      // Bestäm vilka sites att hämta data för
      let targetSites = availableSites
      if (selectedSiteId !== 'all') {
        targetSites = availableSites.filter(s => s.id === selectedSiteId)
      }
      
      if (targetSites.length === 0) {
        setReportData(null)
        return
      }
      
      const siteIds = targetSites.map(s => s.id)
      
      // Beräkna datumintervall
      const endDate = new Date()
      let startDate = new Date()
      
      switch (selectedPeriod) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }
      
      // Hämta cases
      const { data: cases, error: casesError } = await supabase
        .from('private_cases')
        .select('*')
        .in('customer_id', siteIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
      
      if (casesError) throw casesError
      
      // Generera rapportdata
      const siteReports = targetSites.map(site => {
        const siteCases = cases?.filter(c => c.customer_id === site.id) || []
        const completedCases = siteCases.filter(c => c.status === 'completed')
        const activeCases = siteCases.filter(c => c.status === 'in_progress')
        const pendingCases = siteCases.filter(c => c.status === 'pending')
        
        return {
          siteName: site.site_name,
          region: site.region,
          totalCases: siteCases.length,
          completedCases: completedCases.length,
          activeCases: activeCases.length,
          pendingCases: pendingCases.length,
          completionRate: siteCases.length > 0 
            ? Math.round((completedCases.length / siteCases.length) * 100) 
            : 0,
          avgResolutionTime: calculateAvgResolutionTime(completedCases)
        }
      })
      
      // Sammanfattning
      const totalCases = cases?.length || 0
      const totalCompleted = cases?.filter(c => c.status === 'completed').length || 0
      const totalActive = cases?.filter(c => c.status === 'in_progress').length || 0
      const totalPending = cases?.filter(c => c.status === 'pending').length || 0
      
      setReportData({
        period: getPeriodLabel(selectedPeriod),
        startDate: startDate.toLocaleDateString('sv-SE'),
        endDate: endDate.toLocaleDateString('sv-SE'),
        siteReports,
        summary: {
          totalCases,
          totalCompleted,
          totalActive,
          totalPending,
          overallCompletionRate: totalCases > 0 
            ? Math.round((totalCompleted / totalCases) * 100) 
            : 0
        }
      })
    } catch (error) {
      console.error('Error generating report:', error)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }
  
  const calculateAvgResolutionTime = (completedCases: any[]) => {
    if (completedCases.length === 0) return 'N/A'
    
    const totalDays = completedCases.reduce((sum, caseItem) => {
      if (caseItem.completed_at && caseItem.created_at) {
        const created = new Date(caseItem.created_at)
        const completed = new Date(caseItem.completed_at)
        const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return sum + days
      }
      return sum
    }, 0)
    
    const avgDays = Math.round(totalDays / completedCases.length)
    return `${avgDays} dagar`
  }
  
  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'week':
        return 'Senaste veckan'
      case 'month':
        return 'Senaste månaden'
      case 'quarter':
        return 'Senaste kvartalet'
      case 'year':
        return 'Senaste året'
      default:
        return period
    }
  }
  
  const downloadPDFReport = async () => {
    if (!reportData || !organization) return
    
    try {
      setLoading(true)
      
      // Hämta ärendedata för rapporten
      const targetSites = selectedSiteId === 'all' 
        ? availableSites 
        : availableSites.filter(s => s.id === selectedSiteId)
      
      const siteIds = targetSites.map(s => s.id)
      
      // Beräkna datumintervall
      const endDate = new Date()
      let startDate = new Date()
      
      switch (selectedPeriod) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }
      
      // Hämta ärendedata
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('*')
        .in('customer_id', siteIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
      
      if (casesError) throw casesError
      
      // Beräkna statistik
      const totalCases = cases?.length || 0
      const completedCases = cases?.filter(c => 
        ['Slutförd', 'Stängd', 'Avklarad', 'Genomförd'].includes(c.status)
      ).length || 0
      const activeCases = cases?.filter(c => 
        ['Öppen', 'Pågående', 'Schemalagd'].includes(c.status)
      ).length || 0
      
      // Beräkna genomsnittlig responstid
      let avgResponseTime = 0
      const casesWithScheduledDate = cases?.filter(c => c.scheduled_start) || []
      if (casesWithScheduledDate.length > 0) {
        const totalResponseDays = casesWithScheduledDate.reduce((sum, c) => {
          const created = new Date(c.created_at)
          const scheduled = new Date(c.scheduled_start)
          const days = Math.ceil((scheduled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          return sum + Math.max(0, days)
        }, 0)
        avgResponseTime = Math.round(totalResponseDays / casesWithScheduledDate.length)
      }
      
      // Räkna skadedjurstyper
      const pestTypeCounts: Record<string, number> = {}
      cases?.forEach(c => {
        if (c.pest_type) {
          pestTypeCounts[c.pest_type] = (pestTypeCounts[c.pest_type] || 0) + 1
        }
      })
      const topPestType = Object.entries(pestTypeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
      
      // Beräkna total kostnad
      const totalCost = cases?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
      
      // Förbered data för multisite PDF
      const pdfData = {
        organization: {
          organization_id: organization.organization_id,
          organization_name: organization.organization_name
        },
        sites: targetSites.map(site => {
          const siteCases = cases?.filter(c => c.customer_id === site.id) || []
          const siteActiveCases = siteCases.filter(c => 
            ['Öppen', 'Pågående', 'Schemalagd'].includes(c.status)
          ).length
          const siteCompletedCases = siteCases.filter(c => 
            ['Slutförd', 'Stängd', 'Avklarad', 'Genomförd'].includes(c.status)
          ).length
          const siteTotalCost = siteCases.reduce((sum, c) => sum + (c.price || 0), 0)
          
          return {
            site_name: site.site_name,
            region: site.region,
            activeCases: siteActiveCases,
            completedCases: siteCompletedCases,
            totalCost: siteTotalCost
          }
        }),
        cases: cases?.slice(0, 15).map(c => ({
          title: c.title || 'Ingen titel',
          site_name: targetSites.find(s => s.id === c.customer_id)?.site_name || 'Okänd enhet',
          status: c.status,
          pest_type: c.pest_type,
          scheduled_start: c.scheduled_start,
          price: c.price
        })) || [],
        statistics: {
          totalCases,
          completedCases,
          activeCases,
          completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
          avgResponseTime,
          totalCost,
          topPestType,
          pestTypeCounts,
          totalSites: targetSites.length
        },
        period: selectedPeriod === 'week' ? '30d' : 
                selectedPeriod === 'month' ? '30d' :
                selectedPeriod === 'quarter' ? '3m' :
                selectedPeriod === 'year' ? '1y' : 'all',
        roleType: userRoleType
      }
      
      // Anropa Puppeteer PDF-genererings-endpoint
      const response = await fetch('/api/generate-multisite-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pdfData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }
      
      const result = await response.json()
      
      if (result.success && result.pdf) {
        // Konvertera base64 till blob och ladda ner
        const pdfBlob = await fetch(`data:application/pdf;base64,${result.pdf}`)
          .then(res => res.blob())
        
        const url = URL.createObjectURL(pdfBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename || `BeGone_Organisationsrapport_${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        throw new Error('PDF generation failed')
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Kunde inte generera PDF-rapport. Försök igen senare.')
    } finally {
      setLoading(false)
    }
  }
  
  const downloadCSVReport = () => {
    if (!reportData) return
    
    // Skapa CSV-innehåll
    let csv = 'Rapport för ' + organization?.organization_name + '\n'
    csv += 'Period:,' + reportData.period + '\n'
    csv += 'Från:,' + reportData.startDate + '\n'
    csv += 'Till:,' + reportData.endDate + '\n\n'
    
    csv += 'SAMMANFATTNING\n'
    csv += 'Totalt antal ärenden:,' + reportData.summary.totalCases + '\n'
    csv += 'Avklarade:,' + reportData.summary.totalCompleted + '\n'
    csv += 'Pågående:,' + reportData.summary.totalActive + '\n'
    csv += 'Väntande:,' + reportData.summary.totalPending + '\n'
    csv += 'Avklaringsgrad:,' + reportData.summary.overallCompletionRate + '%\n\n'
    
    if (reportData.siteReports.length > 0) {
      csv += 'ENHETSRAPPORTER\n'
      csv += 'Enhet,Region,Totalt,Avklarat,Pågående,Väntande,Avklaringsgrad,Snitt lösningstid\n'
      
      reportData.siteReports.forEach((site: any) => {
        csv += `${site.siteName},${site.region || '-'},${site.totalCases},${site.completedCases},${site.activeCases},${site.pendingCases},${site.completionRate}%,${site.avgResolutionTime}\n`
      })
    }
    
    // Skapa blob och ladda ner
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rapport-${organization?.organization_name}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar rapporter..." />
      </div>
    )
  }

  // Om platsansvarig och har bara en site, visa inte väljaren
  const showSiteSelector = userRoleType !== 'platsansvarig' || availableSites.length > 1

  return (
    <OrganisationLayout userRoleType={userRoleType}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Rapporter - {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                {userRoleType === 'verksamhetschef' && 'Generera och ladda ner rapporter för hela organisationen'}
                {userRoleType === 'regionchef' && 'Generera och ladda ner rapporter för din region'}
                {userRoleType === 'platsansvarig' && 'Generera och ladda ner rapporter för din enhet'}
              </p>
            </div>
            <FileText className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-white mb-2">
              <Filter className="w-5 h-5 text-purple-400" />
              <span className="font-medium">Rapportfilter</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Site selector - visa bara om relevant */}
              {showSiteSelector && (
                <div className="flex items-center gap-4">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  <label className="text-slate-300">Enhet:</label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">
                      {userRoleType === 'verksamhetschef' && 'Alla enheter'}
                      {userRoleType === 'regionchef' && 'Alla enheter i regionen'}
                      {userRoleType === 'platsansvarig' && 'Min enhet'}
                    </option>
                    {availableSites.map(site => (
                      <option key={site.id} value={site.id}>
                        {site.site_name} {site.region && `- ${site.region}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-purple-400" />
                <label className="text-slate-300">Period:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="week">Senaste veckan</option>
                  <option value="month">Senaste månaden</option>
                  <option value="quarter">Senaste kvartalet</option>
                  <option value="year">Senaste året</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Report Preview */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Genererar rapport..." />
          </div>
        ) : reportData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-4">
                  <p className="text-slate-400 text-xs">Totalt</p>
                  <p className="text-2xl font-bold text-white">{reportData.summary.totalCases}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-4">
                  <p className="text-slate-400 text-xs">Avklarade</p>
                  <p className="text-2xl font-bold text-green-400">{reportData.summary.totalCompleted}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-4">
                  <p className="text-slate-400 text-xs">Pågående</p>
                  <p className="text-2xl font-bold text-amber-400">{reportData.summary.totalActive}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-4">
                  <p className="text-slate-400 text-xs">Väntande</p>
                  <p className="text-2xl font-bold text-slate-400">{reportData.summary.totalPending}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-4">
                  <p className="text-slate-400 text-xs">Avklaringsgrad</p>
                  <p className="text-2xl font-bold text-blue-400">{reportData.summary.overallCompletionRate}%</p>
                </div>
              </Card>
            </div>

            {/* Site Reports Table */}
            {reportData.siteReports.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <div className="p-6 border-b border-slate-700">
                  <h2 className="text-xl font-semibold text-white">Enhetsrapporter</h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-slate-300">Enhet</th>
                          <th className="text-left py-3 px-4 text-slate-300">Region</th>
                          <th className="text-center py-3 px-4 text-slate-300">Totalt</th>
                          <th className="text-center py-3 px-4 text-slate-300">Avklarat</th>
                          <th className="text-center py-3 px-4 text-slate-300">Pågående</th>
                          <th className="text-center py-3 px-4 text-slate-300">Väntande</th>
                          <th className="text-center py-3 px-4 text-slate-300">Avklaringsgrad</th>
                          <th className="text-center py-3 px-4 text-slate-300">Snitt lösningstid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.siteReports.map((site: any, index: number) => (
                          <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                            <td className="py-3 px-4 text-white">{site.siteName}</td>
                            <td className="py-3 px-4 text-slate-400">{site.region || '-'}</td>
                            <td className="py-3 px-4 text-center text-white">{site.totalCases}</td>
                            <td className="py-3 px-4 text-center text-green-400">{site.completedCases}</td>
                            <td className="py-3 px-4 text-center text-amber-400">{site.activeCases}</td>
                            <td className="py-3 px-4 text-center text-slate-400">{site.pendingCases}</td>
                            <td className="py-3 px-4 text-center text-blue-400">{site.completionRate}%</td>
                            <td className="py-3 px-4 text-center text-slate-400">{site.avgResolutionTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}

            {/* Download Actions */}
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Ladda ner rapport</h3>
                <div className="flex gap-4">
                  <Button
                    onClick={downloadPDFReport}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Ladda ner som PDF
                  </Button>
                  <Button
                    onClick={downloadCSVReport}
                    className="bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Ladda ner som CSV
                  </Button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Ingen rapportdata tillgänglig</p>
              <p className="text-slate-500 text-sm mt-2">
                Välj filter för att generera en rapport
              </p>
            </div>
          </Card>
        )}
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationRapporter
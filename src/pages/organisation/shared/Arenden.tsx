// src/pages/organisation/shared/Arenden.tsx - Ärenden för alla multisite-roller
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import { AlertTriangle, MapPin, CheckCircle, Clock, Edit3 } from 'lucide-react'
import { useLocation } from 'react-router-dom'

// Återanvänd befintliga komponenter
import OrganisationActiveCasesList from '../../../components/organisation/OrganisationActiveCasesList'
import OrganisationServiceActivityTimeline from '../../../components/organisation/OrganisationServiceActivityTimeline'
import CustomerCaseDetailsModal from '../../../components/organisation/CustomerCaseDetailsModal'
import CompactCasesList from '../../../components/organisation/CompactCasesList'
import ServiceRequestModal from '../../../components/organisation/ServiceRequestModal'
import Button from '../../../components/ui/Button'
import PDFExportButton from '../../../components/shared/PDFExportButton'

const OrganisationArenden: React.FC = () => {
  const { organization, sites, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const location = useLocation()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [customer, setCustomer] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCase, setSelectedCase] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [allCases, setAllCases] = useState<any[]>([])
  
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
    if (selectedSiteId !== 'all') {
      fetchCustomerForSite()
    } else {
      fetchAllCases()
    }
  }, [selectedSiteId, availableSites])
  
  const fetchCustomerForSite = async () => {
    const site = availableSites.find(s => s.id === selectedSiteId)
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
  
  const fetchAllCases = async () => {
    try {
      setLoading(true)
      const siteIds = availableSites.map(s => s.id)
      
      const { data: cases, error } = await supabase
        .from('cases')
        .select('*, customers!inner(company_name, site_name, region)')
        .in('customer_id', siteIds)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setAllCases(cases || [])
    } catch (error) {
      console.error('Error fetching all cases:', error)
      setAllCases([])
    } finally {
      setLoading(false)
    }
  }
  
  const handleEditCase = (caseData: any) => {
    setSelectedCase(caseData)
    setShowEditModal(true)
  }

  // PDF Export functionality för alla ärenden
  const handlePDFExportAll = async () => {
    try {
      const casesToExport = selectedSiteId === 'all' ? allCases : []
      if (casesToExport.length === 0) {
        alert('Inga ärenden att exportera')
        return
      }

      const response = await fetch('/api/generate-case-report-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportType: 'multiple',
          cases: casesToExport,
          customerData: {
            company_name: organization?.organization_name || 'Organisation',
            id: organization?.id
          },
          userRole: userRoleType,
          period: 'alla ärenden'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.pdf) {
        // Create blob and download
        const pdfBlob = new Blob([
          Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))
        ], { type: 'application/pdf' })
        
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || 'BeGone_Alla_Arenden.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        throw new Error(data.error || 'PDF generation failed')
      }
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Misslyckades med att exportera PDF. Försök igen.')
    }
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar ärenden..." />
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
                Ärenden - {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                {userRoleType === 'verksamhetschef' && 'Hantera och översee alla ärenden för organisationen'}
                {userRoleType === 'regionchef' && 'Hantera ärenden för din region'}
                {userRoleType === 'platsansvarig' && 'Hantera ärenden för din enhet'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowServiceRequestModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Begär service
              </Button>
            </div>
          </div>
        </div>

        {/* Site selector - visa bara om relevant */}
        {showSiteSelector && (
          <Card className="bg-slate-800/50 border-slate-700">
            <div className="p-4 flex items-center gap-4">
              <MapPin className="w-5 h-5 text-purple-400" />
              <label className="text-slate-300">Välj enhet:</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">
                  {userRoleType === 'verksamhetschef' && 'Alla enheter (översikt)'}
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
          </Card>
        )}

        {/* Ärenden content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar ärenden..." />
          </div>
        ) : selectedSiteId === 'all' ? (
          // Visa skalbar lista av alla ärenden
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Kompakt ärendelista */}
            <div className="xl:col-span-2">
              <CompactCasesList 
                cases={allCases}
                onCaseClick={handleEditCase}
                loading={loading}
                userRole={userRoleType}
                customerData={{
                  company_name: organization?.organization_name || 'Organisation',
                  id: organization?.id
                }}
                showPDFExport={true}
              />
            </div>
            
            {/* Ärendestatistik sidebar */}
            <div>
              <Card className="bg-slate-800/50 border-slate-700">
                <div className="p-6 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-white">Ärendestatistik</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    {userRoleType === 'verksamhetschef' ? 'Alla enheter' : 
                     userRoleType === 'regionchef' ? 'Din region' : 'Din enhet'}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Totalt antal</span>
                    <span className="text-xl font-bold text-white">{allCases.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pågående</span>
                    <span className="text-lg font-bold text-amber-400">
                      {allCases.filter(c => c.status === 'Bokad' || c.status === 'Bokat' || c.status.startsWith('Återbesök')).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Avklarade</span>
                    <span className="text-lg font-bold text-green-400">
                      {allCases.filter(c => c.status === 'Slutförd' || c.status === 'Stängd').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Öppna</span>
                    <span className="text-lg font-bold text-blue-400">
                      {allCases.filter(c => c.status === 'Öppen').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                    <span className="text-slate-400">Kritiska</span>
                    <span className="text-lg font-bold text-red-400">
                      {allCases.filter(c => c.pest_level >= 3 || c.problem_rating >= 4).length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : customer ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OrganisationActiveCasesList customerId={customer.id} />
            <OrganisationServiceActivityTimeline customerId={customer.id} />
          </div>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <p className="text-amber-400">Enheten saknar koppling till kunddata</p>
              <p className="text-slate-500 text-sm mt-2">
                Koppla enheten till en kund för att se ärenden
              </p>
            </div>
          </Card>
        )}
        
        {/* Customer Case Details Modal */}
        {showEditModal && selectedCase && (
          <CustomerCaseDetailsModal
            caseData={selectedCase}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false)
              setSelectedCase(null)
              if (selectedSiteId === 'all') {
                fetchAllCases()
              }
            }}
            userRole={userRoleType}
          />
        )}
        
        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <ServiceRequestModal
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            selectedSiteId={selectedSiteId !== 'all' ? selectedSiteId : null}
            onSuccess={() => {
              if (selectedSiteId === 'all') {
                fetchAllCases()
              } else {
                fetchCustomerForSite() // Refresh the current site's data
              }
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationArenden
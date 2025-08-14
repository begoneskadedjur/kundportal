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
import EditContractCaseModal from '../../../components/coordinator/EditContractCaseModal'
import ServiceRequestModal from '../../../components/organisation/ServiceRequestModal'
import Button from '../../../components/ui/Button'

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
            <Button
              onClick={() => setShowServiceRequestModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Begär service
            </Button>
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
          // Visa översikt av alla ärenden
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Senaste ärenden - {userRoleType === 'verksamhetschef' ? 'Alla enheter' : 
                                     userRoleType === 'regionchef' ? 'Din region' : 'Din enhet'}
                </h2>
              </div>
              <div className="p-6">
                {allCases.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-slate-400">Inga aktiva ärenden</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {allCases.slice(0, 10).map((caseItem) => (
                      <div key={caseItem.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{caseItem.title || 'Ingen titel'}</h4>
                            <p className="text-xs text-purple-400 mt-1">
                              {caseItem.customers?.site_name || caseItem.customers?.company_name || 'Okänd enhet'}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                caseItem.status === 'Slutförd' || caseItem.status === 'Stängd' ? 'bg-green-500/20 text-green-400' :
                                caseItem.status === 'Pågående' || caseItem.status === 'Schemalagd' ? 'bg-amber-500/20 text-amber-400' :
                                caseItem.status === 'Öppen' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-slate-500/20 text-slate-400'
                              }`}>
                                {caseItem.status}
                              </span>
                              <span className="text-slate-400 text-xs">
                                {new Date(caseItem.created_at).toLocaleDateString('sv-SE')}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleEditCase(caseItem)}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white">Ärendestatistik</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Totalt antal ärenden</span>
                  <span className="text-xl font-bold text-white">{allCases.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Pågående</span>
                  <span className="text-xl font-bold text-amber-400">
                    {allCases.filter(c => c.status === 'Pågående' || c.status === 'Schemalagd').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Avklarade</span>
                  <span className="text-xl font-bold text-green-400">
                    {allCases.filter(c => c.status === 'Slutförd' || c.status === 'Stängd').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Öppna</span>
                  <span className="text-xl font-bold text-blue-400">
                    {allCases.filter(c => c.status === 'Öppen').length}
                  </span>
                </div>
              </div>
            </Card>
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
        
        {/* Edit Modal */}
        {showEditModal && selectedCase && (
          <EditContractCaseModal
            caseData={selectedCase}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false)
              setSelectedCase(null)
              if (selectedSiteId === 'all') {
                fetchAllCases()
              }
            }}
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
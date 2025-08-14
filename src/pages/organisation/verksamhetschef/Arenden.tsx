// src/pages/organisation/verksamhetschef/Arenden.tsx - Ärenden för verksamhetschef
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import { AlertTriangle, MapPin, CheckCircle, Clock, Edit3 } from 'lucide-react'

// Återanvänd befintliga customer-komponenter
import ActiveCasesList from '../../../components/customer/ActiveCasesList'
import ServiceActivityTimeline from '../../../components/customer/ServiceActivityTimeline'
import EditContractCaseModal from '../../../components/coordinator/EditContractCaseModal'
import OrganizationServiceRequest from '../../../components/organisation/OrganizationServiceRequest'
import Button from '../../../components/ui/Button'

const VerksamhetschefArenden: React.FC = () => {
  const { organization, sites, loading: contextLoading } = useMultisite()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [customer, setCustomer] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCase, setSelectedCase] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [allCases, setAllCases] = useState<any[]>([])
  
  useEffect(() => {
    if (selectedSiteId !== 'all') {
      fetchCustomerForSite()
    } else {
      fetchAllCases()
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
  
  const fetchAllCases = async () => {
    try {
      setLoading(true)
      const siteIds = sites.map(s => s.id)
      
      const { data: cases, error } = await supabase
        .from('private_cases')
        .select('*')
        .in('customer_id', siteIds) // Använd customer_id istället för site_id
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

  return (
    <OrganisationLayout userRoleType="verksamhetschef">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Ärenden - {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                Hantera och översee alla ärenden för organisationen
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
                  Senaste ärenden - Alla enheter
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
                              {caseItem.site?.site_name || 'Okänd enhet'}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                caseItem.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                caseItem.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
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
                    {allCases.filter(c => c.status === 'in_progress').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Avklarade</span>
                  <span className="text-xl font-bold text-green-400">
                    {allCases.filter(c => c.status === 'completed').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Väntande</span>
                  <span className="text-xl font-bold text-slate-400">
                    {allCases.filter(c => c.status === 'pending').length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        ) : customer ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActiveCasesList customerId={customer.id} />
            <ServiceActivityTimeline customerId={customer.id} />
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
          <OrganizationServiceRequest
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            selectedSiteId={selectedSiteId !== 'all' ? selectedSiteId : null}
            onSuccess={() => {
              if (selectedSiteId === 'all') {
                fetchAllCases()
              } else {
                // Refresh the current site's data if needed
              }
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default VerksamhetschefArenden
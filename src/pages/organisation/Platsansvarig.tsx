// src/pages/organisation/Platsansvarig.tsx - Dashboard för platsansvariga
import React, { useState, useEffect } from 'react'
import { Building2, Calendar, AlertTriangle, CheckCircle, Clock, Phone } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getCustomerDisplayName, isMultisiteCustomer } from '../../utils/multisiteHelpers'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import OrganisationLayout from '../../components/organisation/OrganisationLayout'
import OrganizationServiceRequest from '../../components/organisation/OrganizationServiceRequest'
import OrganisationActiveCasesList from '../../components/organisation/OrganisationActiveCasesList'
import OrganisationServiceActivityTimeline from '../../components/organisation/OrganisationServiceActivityTimeline'

const PlatsansvarigDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const [loading, setLoading] = useState(true)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<any | null>(null)
  const [caseStats, setCaseStats] = useState({
    activeCases: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
    upcomingVisits: 0
  })
  
  // Platsansvarig har bara tillgång till en enhet
  const currentSite = accessibleSites[0]

  useEffect(() => {
    if (organization && currentSite) {
      fetchCustomerAndStats()
    } else {
      setLoading(false)
    }
  }, [organization, userRole, currentSite])

  const fetchCustomerAndStats = async () => {
    if (!organization || !currentSite) return
    
    try {
      setLoading(true)
      
      // Hämta customer för platsansvarig baserat på tillgängliga sites
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', currentSite.id)
        .eq('is_multisite', true)
        .single()
      
      if (customerError || !customerData) {
        console.error('Error fetching customer:', customerError)
        setLoading(false)
        return
      }
      
      // Verifiera att det är en multisite-kund
      if (!isMultisiteCustomer(customerData)) {
        console.error('Customer is not a multisite customer')
        setLoading(false)
        return
      }
      
      setCurrentCustomer(customerData)
      
      // Hämta statistik för cases
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      
      // Hämta alla cases för statistik
      const { data: allCases } = await supabase
        .from('cases')
        .select('id, status, updated_at, scheduled_start')
        .eq('customer_id', customerData.id)
      
      if (allCases) {
        const stats = {
          activeCases: allCases.filter(c => 
            ['Öppen', 'Pågående', 'Schemalagd'].includes(c.status)
          ).length,
          completedToday: allCases.filter(c => 
            ['Avslutat', 'Stängt - slasklogg'].includes(c.status) &&
            new Date(c.updated_at) >= today
          ).length,
          completedThisWeek: allCases.filter(c => 
            ['Avslutat', 'Stängt - slasklogg'].includes(c.status) &&
            new Date(c.updated_at) >= weekStart
          ).length,
          completedThisMonth: allCases.filter(c => 
            ['Avslutat', 'Stängt - slasklogg'].includes(c.status) &&
            new Date(c.updated_at) >= monthStart
          ).length,
          upcomingVisits: allCases.filter(c => 
            c.status === 'Schemalagd' &&
            c.scheduled_start &&
            new Date(c.scheduled_start) >= now
          ).length
        }
        setCaseStats(stats)
      }
    } catch (error) {
      console.error('Error fetching customer and stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar enhetsdata..." />
      </div>
    )
  }

  if (!currentCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="p-8 bg-slate-800/50 border-slate-700 max-w-md">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white text-center mb-2">Ingen enhet tilldelad</h2>
          <p className="text-slate-400 text-center">
            Kontakta verksamhetschefen för att få tillgång till en enhet.
          </p>
        </Card>
      </div>
    )
  }

  // Beräkna trafikljusstatus för enheten
  const getTrafficLightStatus = () => {
    const activeCount = caseStats.activeCases
    if (activeCount > 10) return 'red'
    if (activeCount > 5) return 'yellow'
    return 'green'
  }

  const trafficLight = getTrafficLightStatus()

  return (
    <OrganisationLayout userRoleType="platsansvarig">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-2xl p-6 border border-green-700/50">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {currentCustomer.company_name}
              </h1>
              <p className="text-green-200">
                {organization?.organization_name} - Platsansvarig
              </p>
              <p className="text-slate-400 text-sm mt-2">
                {currentCustomer.address}, {currentCustomer.postal_code} {currentCustomer.city}
              </p>
            </div>
            <div className="text-right space-y-3">
              {currentCustomer.contact_person && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Kontaktperson</p>
                  <p className="text-white font-medium">{currentCustomer.contact_person}</p>
                  {currentCustomer.contact_phone && (
                    <p className="text-slate-300 text-sm mt-1 flex items-center justify-end gap-1">
                      <Phone className="w-3 h-3" />
                      {currentCustomer.contact_phone}
                    </p>
                  )}
                </div>
              )}
              
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

        {/* Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Aktiva ärenden</p>
                <p className="text-2xl font-bold text-white">{caseStats.activeCases}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Avklarade idag</p>
                <p className="text-2xl font-bold text-white">{caseStats.completedToday}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Denna vecka</p>
                <p className="text-2xl font-bold text-white">{caseStats.completedThisWeek}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Kommande besök</p>
                <p className="text-2xl font-bold text-white">{caseStats.upcomingVisits}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-4 h-4 rounded-full ${
                trafficLight === 'green' ? 'bg-green-500' :
                trafficLight === 'yellow' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <div>
                <p className="text-slate-400 text-sm">Trafikljus</p>
                <p className={`text-lg font-bold ${
                  trafficLight === 'green' ? 'text-green-400' :
                  trafficLight === 'yellow' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {trafficLight === 'green' ? 'Grönt' :
                   trafficLight === 'yellow' ? 'Gult' : 'Rött'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Använd de nya komponenterna för ärenden */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrganisationActiveCasesList customerId={currentCustomer.id} />
          <OrganisationServiceActivityTimeline customerId={currentCustomer.id} />
        </div>
        
        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <OrganizationServiceRequest
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            selectedSiteId={currentCustomer?.id}
            onSuccess={() => {
              fetchCustomerAndStats() // Refresh data
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default PlatsansvarigDashboard
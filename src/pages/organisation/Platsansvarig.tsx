// src/pages/organisation/Platsansvarig.tsx - Dashboard för platsansvariga
import React, { useState, useEffect } from 'react'
import { Building2, Calendar, AlertTriangle, CheckCircle, Clock, Phone } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import OrganisationLayout from '../../components/organisation/OrganisationLayout'
import OrganizationServiceRequest from '../../components/organisation/OrganizationServiceRequest'

interface CaseDetails {
  id: string
  title: string
  status: string
  priority: string
  scheduled_date?: string
  technician_name?: string
}

interface SiteDetails {
  activeCases: CaseDetails[]
  completedToday: number
  completedThisWeek: number
  completedThisMonth: number
  upcomingVisits: CaseDetails[]
  contactInfo: {
    contact_person?: string
    contact_email?: string
    contact_phone?: string
  }
}

const PlatsansvarigDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const [siteDetails, setSiteDetails] = useState<SiteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<any | null>(null)
  
  // Platsansvarig har bara tillgång till en enhet
  const currentSite = accessibleSites[0]

  useEffect(() => {
    if (organization) {
      fetchCustomerAndDetails()
    } else {
      setLoading(false)
    }
  }, [organization, userRole])

  const fetchCustomerAndDetails = async () => {
    if (!organization) return
    
    try {
      setLoading(true)
      
      // Hämta customer för platsansvarig baserat på tillgängliga sites
      if (!currentSite) {
        console.error('No accessible site for platsansvarig')
        setLoading(false)
        return
      }
      
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', currentSite.id)
        .single()
      
      if (customerError || !customerData) {
        console.error('Error fetching customer:', customerError)
        setLoading(false)
        return
      }
      
      setCurrentCustomer(customerData)
      
      // Hämta aktiva ärenden
      const { data: activeCases } = await supabase
        .from('cases')
        .select('id, title, status, priority, scheduled_date, technician_name')
        .eq('customer_id', customerData.id)
        .in('status', ['Öppen', 'Pågående', 'Schemalagd'])
        .order('priority', { ascending: false })
        .limit(10)

      // Hämta avklarade idag
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data: completedToday } = await supabase
        .from('cases')
        .select('id')
        .eq('customer_id', customerData.id)
        .in('status', ['Avklarad', 'Stängd'])
        .gte('updated_at', today.toISOString())

      // Hämta avklarade denna vecka
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const { data: completedWeek } = await supabase
        .from('cases')
        .select('id')
        .eq('customer_id', customerData.id)
        .in('status', ['Avklarad', 'Stängd'])
        .gte('updated_at', weekStart.toISOString())

      // Hämta avklarade denna månad
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      const { data: completedMonth } = await supabase
        .from('cases')
        .select('id')
        .eq('customer_id', customerData.id)
        .in('status', ['Avklarad', 'Stängd'])
        .gte('updated_at', monthStart.toISOString())

      // Hämta kommande besök
      const { data: upcomingVisits } = await supabase
        .from('cases')
        .select('id, title, status, priority, scheduled_date, technician_name')
        .eq('customer_id', customerData.id)
        .eq('status', 'Schemalagd')
        .gte('scheduled_date', new Date().toISOString())
        .order('scheduled_date', { ascending: true })
        .limit(5)

      setSiteDetails({
        activeCases: activeCases || [],
        completedToday: completedToday?.length || 0,
        completedThisWeek: completedWeek?.length || 0,
        completedThisMonth: completedMonth?.length || 0,
        upcomingVisits: upcomingVisits || [],
        contactInfo: {
          contact_person: customerData.contact_person,
          contact_email: customerData.contact_email,
          contact_phone: customerData.contact_phone
        }
      })
    } catch (error) {
      console.error('Error fetching site details:', error)
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
    if (!siteDetails) return 'green'
    const activeCount = siteDetails.activeCases.length
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
              {siteDetails?.contactInfo.contact_person && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Kontaktperson</p>
                  <p className="text-white font-medium">{siteDetails.contactInfo.contact_person}</p>
                  {siteDetails.contactInfo.contact_phone && (
                    <p className="text-slate-300 text-sm mt-1 flex items-center justify-end gap-1">
                      <Phone className="w-3 h-3" />
                      {siteDetails.contactInfo.contact_phone}
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
              <p className="text-2xl font-bold text-white">{siteDetails?.activeCases.length || 0}</p>
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
              <p className="text-2xl font-bold text-white">{siteDetails?.completedToday || 0}</p>
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
              <p className="text-2xl font-bold text-white">{siteDetails?.completedThisWeek || 0}</p>
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
              <p className="text-2xl font-bold text-white">{siteDetails?.upcomingVisits.length || 0}</p>
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
                <p className="text-lg font-bold ${
                  trafficLight === 'green' ? 'text-green-400' :
                  trafficLight === 'yellow' ? 'text-yellow-400' :
                  'text-red-400'
                }">
                  {trafficLight === 'green' ? 'Grönt' :
                   trafficLight === 'yellow' ? 'Gult' : 'Rött'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aktiva ärenden */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Aktiva ärenden
            </h2>
          </div>
          <div className="p-6">
            {siteDetails?.activeCases.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-slate-400">Inga aktiva ärenden just nu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {siteDetails?.activeCases.map((caseItem) => (
                  <div key={caseItem.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">{caseItem.title || 'Ingen titel'}</h4>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            caseItem.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            caseItem.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {caseItem.priority === 'high' ? 'Hög prio' :
                             caseItem.priority === 'medium' ? 'Medium' : 'Låg prio'}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {caseItem.status === 'Schemalagd' ? 'Schemalagd' :
                             caseItem.status === 'Pågående' ? 'Pågående' : caseItem.status}
                          </span>
                        </div>
                      </div>
                      {caseItem.technician_name && (
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Tekniker</p>
                          <p className="text-sm text-white">{caseItem.technician_name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Kommande besök */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Kommande besök
            </h2>
          </div>
          <div className="p-6">
            {siteDetails?.upcomingVisits.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Inga schemalagda besök</p>
              </div>
            ) : (
              <div className="space-y-3">
                {siteDetails?.upcomingVisits.map((visit) => (
                  <div key={visit.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <h4 className="font-medium text-white mb-2">{visit.title || 'Ingen titel'}</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-300">
                          {visit.scheduled_date ? 
                            new Date(visit.scheduled_date).toLocaleDateString('sv-SE', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Datum ej satt'}
                        </span>
                      </div>
                      {visit.technician_name && (
                        <span className="text-sm text-slate-400">
                          {visit.technician_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        </div>
        
        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <OrganizationServiceRequest
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            selectedSiteId={currentCustomer?.id}
            onSuccess={() => {
              fetchCustomerAndDetails() // Refresh data
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default PlatsansvarigDashboard
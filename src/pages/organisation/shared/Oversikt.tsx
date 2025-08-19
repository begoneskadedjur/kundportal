// src/pages/organisation/shared/Oversikt.tsx - Översikt för alla multisite-roller
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { Home, Users, MapPin, TrendingUp, AlertTriangle, Calendar, CheckCircle, Clock, Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import OrganisationActiveCasesList from '../../../components/organisation/OrganisationActiveCasesList'
import OrganisationServiceActivityTimeline from '../../../components/organisation/OrganisationServiceActivityTimeline'
import ServiceRequestModal from '../../../components/organisation/ServiceRequestModal'
import TrafficLightAggregatedView from '../../../components/organisation/TrafficLightAggregatedView'

const OrganisationOversikt: React.FC = () => {
  const { organization, sites, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [statistics, setStatistics] = useState<any>(null)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  
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
    fetchStatistics()
  }, [availableSites])
  
  const fetchStatistics = async () => {
    try {
      setLoading(true)
      
      if (availableSites.length === 0) {
        setStatistics(null)
        return
      }
      
      const siteIds = availableSites.map(s => s.id)
      
      // Hämta cases statistik
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('status')
        .in('customer_id', siteIds)
      
      if (casesError) throw casesError
      
      // Beräkna statistik
      const totalCases = cases?.length || 0
      const openCases = cases?.filter(c => c.status === 'Öppen').length || 0
      const inProgressCases = cases?.filter(c => 
        c.status === 'Bokad' || c.status === 'Bokat' || c.status.startsWith('Återbesök')
      ).length || 0
      const completedCases = cases?.filter(c => 
        c.status === 'Slutförd' || c.status === 'Stängd'
      ).length || 0
      
      setStatistics({
        totalCases,
        openCases,
        inProgressCases,
        completedCases,
        totalSites: availableSites.length
      })
    } catch (error) {
      console.error('Error fetching statistics:', error)
      setStatistics(null)
    } finally {
      setLoading(false)
    }
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar översikt..." />
      </div>
    )
  }

  // Get customer IDs for case components
  const getCustomerIds = () => {
    return availableSites.map(s => s.customer_id).filter(Boolean) as string[]
  }

  return (
    <OrganisationLayout userRoleType={userRoleType}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Välkommen till {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                {userRoleType === 'verksamhetschef' && 'Översikt över hela organisationen'}
                {userRoleType === 'regionchef' && 'Översikt över din region'}
                {userRoleType === 'platsansvarig' && 'Översikt över din enhet'}
              </p>
            </div>
            <Home className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowServiceRequestModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Begär service
          </Button>
        </div>

        {/* Statistics Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar statistik..." />
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Enheter</p>
                    <p className="text-3xl font-bold text-white mt-2">{statistics.totalSites}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Totalt ärenden</p>
                    <p className="text-3xl font-bold text-white mt-2">{statistics.totalCases}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Öppna</p>
                    <p className="text-3xl font-bold text-amber-400 mt-2">{statistics.openCases}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Pågående</p>
                    <p className="text-3xl font-bold text-blue-400 mt-2">{statistics.inProgressCases}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Avklarade</p>
                    <p className="text-3xl font-bold text-green-400 mt-2">{statistics.completedCases}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {/* Traffic Light Aggregated View */}
        <TrafficLightAggregatedView
          organizationId={organization?.organization_id}
          siteIds={getCustomerIds()}
          userRole={userRoleType}
        />

        {/* Cases Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Cases */}
          <div>
            <OrganisationActiveCasesList 
              siteIds={getCustomerIds()}
            />
          </div>
          
          {/* Service Activity Timeline */}
          <div>
            <OrganisationServiceActivityTimeline 
              siteIds={getCustomerIds()}
            />
          </div>
        </div>

        {/* Sites Overview */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              {userRoleType === 'verksamhetschef' && 'Alla enheter'}
              {userRoleType === 'regionchef' && 'Enheter i din region'}
              {userRoleType === 'platsansvarig' && 'Din enhet'}
            </h2>
          </div>
          <div className="p-6">
            {availableSites.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Inga enheter tillgängliga</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableSites.map(site => (
                  <div key={site.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">{site.site_name}</h4>
                        {site.region && (
                          <p className="text-sm text-purple-400 mt-1">Region: {site.region}</p>
                        )}
                        {site.address && (
                          <p className="text-xs text-slate-500 mt-2">{site.address}</p>
                        )}
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${
                        site.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {site.is_active ? 'Aktiv' : 'Inaktiv'}
                      </div>
                    </div>
                    {site.contact_person && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-400">Kontakt: {site.contact_person}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <ServiceRequestModal
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            onSuccess={() => {
              fetchStatistics()
              // Force refresh of case components
              window.location.reload()
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationOversikt
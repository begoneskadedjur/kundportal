// src/pages/organisation/shared/Oversikt.tsx - Översikt för alla multisite-roller
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { Home, Users, MapPin, TrendingUp, AlertTriangle, Calendar, CheckCircle, Clock, Plus, Phone } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import OrganisationActiveCasesList from '../../../components/organisation/OrganisationActiveCasesList'
import OrganisationServiceActivityTimeline from '../../../components/organisation/OrganisationServiceActivityTimeline'
import ServiceRequestModal from '../../../components/organisation/ServiceRequestModal'
import TrafficLightAggregatedView from '../../../components/organisation/TrafficLightAggregatedView'
import TrafficLightCaseList from '../../../components/organisation/TrafficLightCaseList'
import SiteCardWithTrafficLight from '../../../components/organisation/SiteCardWithTrafficLight'
import SiteOverviewModal from '../../../components/organisation/SiteOverviewModal'
import { getCustomerDisplayName } from '../../../utils/multisiteHelpers'

const OrganisationOversikt: React.FC = () => {
  const { organization, sites, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const { profile } = useAuth()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [statistics, setStatistics] = useState<any>(null)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [detailedStats, setDetailedStats] = useState<any>(null)
  const [currentSite, setCurrentSite] = useState<any>(null)
  const [selectedSite, setSelectedSite] = useState<any>(null)
  const [showSiteOverviewModal, setShowSiteOverviewModal] = useState(false)
  
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
    if (userRoleType === 'platsansvarig' && availableSites.length > 0) {
      setCurrentSite(availableSites[0])
      fetchDetailedStats()
    }
  }, [availableSites, userRoleType])
  
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

  const fetchDetailedStats = async () => {
    if (!currentSite && availableSites.length === 0) return
    
    try {
      const site = currentSite || availableSites[0]
      if (!site) return

      // Hämta detaljerad statistik för platsansvarig
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const { data: allCases } = await supabase
        .from('cases')
        .select('id, status, updated_at, scheduled_start')
        .eq('customer_id', site.id)

      if (allCases) {
        const stats = {
          activeCases: allCases.filter(c => 
            ['Öppen', 'Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'].includes(c.status)
          ).length,
          completedToday: allCases.filter(c => 
            ['Slutförd', 'Stängd'].includes(c.status) &&
            new Date(c.updated_at) >= today
          ).length,
          completedThisWeek: allCases.filter(c => 
            ['Slutförd', 'Stängd'].includes(c.status) &&
            new Date(c.updated_at) >= weekStart
          ).length,
          completedThisMonth: allCases.filter(c => 
            ['Slutförd', 'Stängd'].includes(c.status) &&
            new Date(c.updated_at) >= monthStart
          ).length,
          upcomingVisits: allCases.filter(c => 
            (c.status === 'Bokad' || c.status === 'Bokat') &&
            c.scheduled_start &&
            new Date(c.scheduled_start) >= now
          ).length
        }
        setDetailedStats(stats)
      }
    } catch (error) {
      console.error('Error fetching detailed stats:', error)
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
    return availableSites.map(s => s.id).filter(Boolean) as string[]
  }

  return (
    <OrganisationLayout userRoleType={userRoleType}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {userRoleType === 'platsansvarig' && currentSite ? (
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {getCustomerDisplayName(currentSite)}
                  </h1>
                  <p className="text-purple-200">
                    {organization?.organization_name} - Platsansvarig
                  </p>
                  {currentSite.address && (
                    <p className="text-slate-400 text-sm mt-2">
                      {currentSite.address}
                      {/* Note: postal_code och city finns inte i OrganizationSite struktur än */}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {organization?.organization_name}
                  </h1>
                  <p className="text-purple-200">
                    {userRoleType === 'verksamhetschef' && `Verksamhetschef${profile?.display_name ? ` - ${profile.display_name}` : ''}`}
                    {userRoleType === 'regionchef' && `Regionchef${profile?.display_name ? ` - ${profile.display_name}` : ''}`}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {userRoleType === 'verksamhetschef' && 'Översikt över hela organisationen'}
                    {userRoleType === 'regionchef' && `Översikt över ${availableSites.length} enheter i din region`}
                  </p>
                </div>
              )}
            </div>
            <div className="text-right space-y-3 ml-6">
              {/* Kontaktinfo för alla roller */}
              {userRoleType === 'platsansvarig' && currentSite?.contact_person ? (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Kontaktperson</p>
                  <p className="text-white font-medium">{currentSite.contact_person}</p>
                  {currentSite.contact_phone && (
                    <p className="text-slate-300 text-sm mt-1 flex items-center justify-end gap-1">
                      <Phone className="w-3 h-3" />
                      {currentSite.contact_phone}
                    </p>
                  )}
                </div>
              ) : (userRoleType === 'verksamhetschef' || userRoleType === 'regionchef') && profile ? (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Inloggad som</p>
                  <p className="text-white font-medium">{profile.display_name || 'Användare'}</p>
                  {profile.email && (
                    <p className="text-slate-300 text-sm mt-1 flex items-center justify-end gap-1">
                      <Phone className="w-3 h-3" />
                      {profile.email}
                    </p>
                  )}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Home className="w-6 h-6 text-purple-400" />
                <Button
                  onClick={() => setShowServiceRequestModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Begär service
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sites Overview med trafikljus - Flyttad till toppen för bättre överblick */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-purple-400" />
                {userRoleType === 'verksamhetschef' && 'Alla enheter med trafikljusstatus'}
                {userRoleType === 'regionchef' && 'Enheter i din region med trafikljusstatus'}
                {userRoleType === 'platsansvarig' && 'Din enhet med trafikljusstatus'}
              </h2>
              <p className="text-sm text-slate-400">
                Klicka på en enhet för att se detaljerad information om tekniska bedömningar och kritiska situationer
              </p>
            </div>
          </div>
          <div className="p-6">
            {availableSites.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Inga enheter tillgängliga</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {availableSites.map(site => (
                  <SiteCardWithTrafficLight
                    key={site.id}
                    site={site}
                    onClick={() => {
                      setSelectedSite(site)
                      setShowSiteOverviewModal(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Statistics Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar statistik..." />
          </div>
        ) : (
          <div>
            {userRoleType === 'platsansvarig' && detailedStats ? (
              // Detaljerad statistik för platsansvarig
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 bg-slate-800/50 border-slate-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Aktiva ärenden</p>
                      <p className="text-2xl font-bold text-white">{detailedStats.activeCases}</p>
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
                      <p className="text-2xl font-bold text-white">{detailedStats.completedToday}</p>
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
                      <p className="text-2xl font-bold text-white">{detailedStats.completedThisWeek}</p>
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
                      <p className="text-2xl font-bold text-white">{detailedStats.upcomingVisits}</p>
                    </div>
                  </div>
                </Card>
              </div>
            ) : statistics ? (
              // Aggregerad statistik för regionchef/verksamhetschef
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">
                          {userRoleType === 'verksamhetschef' && 'Enheter'}
                          {userRoleType === 'regionchef' && 'Enheter i region'}
                          {userRoleType === 'platsansvarig' && 'Din enhet'}
                        </p>
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
          </div>
        )}

        {/* Huvudfokus: Trafikljus och kritiska situationer */}
        <div className="space-y-6">
          {userRoleType === 'platsansvarig' && currentSite ? (
            /* Detaljerad trafikljusvy för platsansvarig */
            <TrafficLightCaseList 
              customerId={currentSite.id} 
              onCaseUpdate={() => {
                fetchStatistics()
                fetchDetailedStats()
              }}
            />
          ) : (
            /* Traffic Light Aggregated View för regionchef/verksamhetschef */
            <TrafficLightAggregatedView
              organizationId={organization?.organization_id}
              siteIds={getCustomerIds()}
              userRole={userRoleType}
            />
          )}

          {/* Cases Overview - Rollspecifik */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Cases med trafikljusfilter */}
            <div>
              {userRoleType === 'platsansvarig' && currentSite ? (
                <OrganisationActiveCasesList 
                  customerId={currentSite.id}
                />
              ) : (
                <OrganisationActiveCasesList 
                  siteIds={getCustomerIds()}
                />
              )}
            </div>
            
            {/* Service Activity Timeline */}
            <div>
              {userRoleType === 'platsansvarig' && currentSite ? (
                <OrganisationServiceActivityTimeline 
                  customerId={currentSite.id}
                />
              ) : (
                <OrganisationServiceActivityTimeline 
                  siteIds={getCustomerIds()}
                />
              )}
            </div>
          </div>
        </div>

        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <ServiceRequestModal
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            selectedSiteId={userRoleType === 'platsansvarig' && currentSite ? currentSite.id : undefined}
            onSuccess={() => {
              fetchStatistics()
              if (userRoleType === 'platsansvarig') {
                fetchDetailedStats()
              }
            }}
          />
        )}

        {/* Site Overview Modal */}
        {showSiteOverviewModal && selectedSite && (
          <SiteOverviewModal
            site={selectedSite}
            isOpen={showSiteOverviewModal}
            onClose={() => {
              setShowSiteOverviewModal(false)
              setSelectedSite(null)
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationOversikt
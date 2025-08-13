// src/pages/multisite/Portal.tsx - Multisite Organization Portal
import React, { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, Building2 } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

// Import multisite components
import MultisitePortalNavigation from '../../components/multisite/MultisitePortalNavigation'
import MultisiteDashboard from '../../components/multisite/MultisiteDashboard'
import MultisiteStatistics from '../../components/multisite/MultisiteStatistics'
import MultisiteReports from '../../components/multisite/MultisiteReports'
import TrafficLightSystem from '../../components/multisite/TrafficLightSystem'

// Import customer components to reuse
import ServiceExcellenceDashboard from '../../components/customer/ServiceExcellenceDashboard'
import CustomerStatistics from '../../components/customer/CustomerStatistics'
import ServiceActivityTimeline from '../../components/customer/ServiceActivityTimeline'
import ActiveCasesList from '../../components/customer/ActiveCasesList'

const MultisitePortal: React.FC = () => {
  const { profile } = useAuth()
  const { 
    organization, 
    userRole, 
    loading, 
    error, 
    refreshData,
    currentSite,
    setCurrentSite,
    currentCustomer,
    accessibleSites 
  } = useMultisite()
  const [currentView, setCurrentView] = useState<'dashboard' | 'statistics' | 'reports' | 'traffic-light'>('dashboard')
  const [refreshing, setRefreshing] = useState(false)

  // Set default current site when accessible sites load
  useEffect(() => {
    if (!currentSite && accessibleSites.length > 0) {
      // Set the first accessible site as current
      setCurrentSite(accessibleSites[0])
    }
  }, [accessibleSites, currentSite, setCurrentSite])

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshData()
    setRefreshing(false)
  }
  
  // Debug function to create test sites
  const createTestSites = async () => {
    try {
      const response = await fetch('/api/debug-sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      console.log('Test sites response:', data)
      
      if (response.ok) {
        await refreshData()
      }
    } catch (error) {
      console.error('Error creating test sites:', error)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar multisite-portal...</p>
        </div>
      </div>
    )
  }

  // Error state or no organization access
  if (error || !organization || !userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="text-center p-8 max-w-md bg-slate-800/50 backdrop-blur border-slate-700">
          <div className="text-amber-500 mb-4">
            <AlertTriangle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Ingen multisite-åtkomst</h2>
          <p className="text-slate-400 mb-4">
            {error || 'Du har inte tillgång till någon multisite-organisation'}
          </p>
          <Button onClick={handleRefresh} className="bg-emerald-500 hover:bg-emerald-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  // Render view based on current selection
  const renderView = () => {
    // Om vi har valt en site och den har customer-data, visa customer-komponenter
    if (currentSite && currentCustomer) {
      switch (currentView) {
        case 'statistics':
          return <CustomerStatistics customer={currentCustomer} />
        case 'reports':
          return <MultisiteReports />
        case 'traffic-light':
          return <TrafficLightSystem />
        default:
          return (
            <div className="space-y-6">
              <ServiceExcellenceDashboard customer={currentCustomer} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActiveCasesList customerId={currentCustomer.id} />
                <ServiceActivityTimeline customerId={currentCustomer.id} />
              </div>
            </div>
          )
      }
    }
    
    // Om ingen site är vald, visa översikt
    return <MultisiteDashboard />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <MultisitePortalNavigation
        currentView={currentView}
        onViewChange={setCurrentView}
        organizationName={organization.organization_name}
        userRole={userRole.role_type}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Site Selector */}
      <div className="container mx-auto px-4 pt-4">
        {/* Debug button - remove this in production */}
        {accessibleSites.length === 0 && (
          <Card className="bg-amber-900/20 border-amber-700 mb-4">
            <div className="p-4 flex items-center justify-between">
              <p className="text-amber-300">Inga enheter hittades. Vill du skapa testdata?</p>
              <Button 
                onClick={createTestSites}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Skapa testenheter
              </Button>
            </div>
          </Card>
        )}
        
        {accessibleSites.length > 0 && (
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700 mb-6">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <label className="text-sm font-medium text-slate-300">Välj enhet:</label>
                  <select
                    value={currentSite?.id || ''}
                    onChange={(e) => {
                      const site = accessibleSites.find(s => s.id === e.target.value)
                      setCurrentSite(site || null)
                    }}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Välj en enhet...</option>
                    {accessibleSites.map(site => (
                      <option key={site.id} value={site.id}>
                        {site.site_name} {site.region ? `(${site.region})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {currentSite && (
                  <div className="text-sm text-slate-400">
                    {currentSite.address}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4">
        {renderView()}
      </div>
    </div>
  )
}

export default MultisitePortal
// src/pages/organisation/RegionalPortal.tsx - Portal för regionalkunder med kartvy
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useImpersonation } from '../../contexts/ImpersonationContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

// Layout
import MultisitePortalLayout, { MultisitePortalView } from '../../components/organisation/MultisitePortalLayout'

// Views
import MultisiteDashboardView from '../../components/organisation/MultisiteDashboardView'
import RegionalMapView from '../../components/organisation/RegionalMapView'
import MultisiteInspectionsView from '../../components/organisation/MultisiteInspectionsView'
import MultisiteEgenkontrollView from '../../components/organisation/MultisiteEgenkontrollView'
import MultisiteCasesView from '../../components/organisation/MultisiteCasesView'
import MultisiteReportsView from '../../components/organisation/MultisiteReportsView'
import MultisiteQuotesView from '../../components/organisation/MultisiteQuotesView'

const ROLE_LABELS: Record<string, string> = {
  verksamhetschef: 'Verksamhetschef',
  regionchef: 'Regionchef',
  platsansvarig: 'Platsansvarig'
}

const RegionalPortal: React.FC = () => {
  const {
    organization,
    userRole,
    sites,
    accessibleSites,
    loading,
    error
  } = useMultisite()
  const { isImpersonating, impersonatedDisplayName, impersonatedRoleType, stopImpersonation } = useImpersonation()

  const [currentView, setCurrentView] = useState<MultisitePortalView>('dashboard')
  const [selectedSiteId, setSelectedSiteId] = useState<string | 'all'>('all')

  // Navigering från inspektioner → stationer (bara outdoor för regionalkunder)
  const [highlightedStationId, setHighlightedStationId] = useState<string | null>(null)

  const availableSites = userRole?.role_type === 'verksamhetschef'
    ? sites
    : accessibleSites

  useEffect(() => {
    if (!userRole || availableSites.length === 0) return
    if (userRole.role_type === 'platsansvarig' && availableSites.length === 1) {
      setSelectedSiteId(availableSites[0].id)
    }
  }, [userRole, availableSites])

  const getRoleLabel = () => {
    switch (userRole?.role_type) {
      case 'verksamhetschef': return 'Verksamhetschef'
      case 'regionchef': return 'Regionchef'
      case 'platsansvarig': return 'Platsansvarig'
      default: return 'Organisation'
    }
  }

  const showSiteSelector = !(userRole?.role_type === 'platsansvarig' && availableSites.length <= 1)

  const handleNavigateToStation = (stationId: string, _type: 'outdoor' | 'indoor', _floorPlanId?: string, siteId?: string) => {
    if (siteId) setSelectedSiteId(siteId)
    setHighlightedStationId(stationId)
    setCurrentView('stations')
    setTimeout(() => setHighlightedStationId(null), 5000)
  }

  const siteOptions = availableSites.map(s => ({
    id: s.id,
    site_name: s.site_name || s.company_name || 'Okänd region',
    region: s.region
  }))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar regionalportal...</p>
        </div>
      </div>
    )
  }

  if (error || !organization || !userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="bg-slate-800 rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-semibold text-white mb-4">Ingen organisationsåtkomst</h2>
          <p className="text-slate-400">
            Du har inte tillgång till någon organisation. Kontakta din administratör.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {isImpersonating && impersonatedDisplayName && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 py-2 bg-amber-500/15 border-b border-amber-500/40 backdrop-blur-sm">
          <p className="text-sm text-amber-300 font-medium">
            Admin-vy: Du ser portalen som{' '}
            <span className="font-semibold text-amber-200">{impersonatedDisplayName}</span>
            {impersonatedRoleType && (
              <span className="text-amber-400 font-normal"> ({ROLE_LABELS[impersonatedRoleType] || impersonatedRoleType})</span>
            )}
          </p>
          <button
            onClick={stopImpersonation}
            className="text-xs text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1 rounded-lg transition-colors"
          >
            Avsluta
          </button>
        </div>
      )}
      <MultisitePortalLayout
        currentView={currentView}
        onViewChange={setCurrentView}
        organizationName={organization.organization_name || organization.company_name || 'Organisation'}
        sites={siteOptions}
        selectedSiteId={selectedSiteId}
        onSiteChange={setSelectedSiteId}
        showSiteSelector={showSiteSelector}
        userRoleLabel={getRoleLabel()}
        isImpersonating={isImpersonating}
      >
        {currentView === 'dashboard' && (
          <MultisiteDashboardView
            selectedSiteId={selectedSiteId}
            sites={siteOptions}
            userRoleType={userRole.role_type}
            isRegional={organization?.is_regional ?? false}
          />
        )}

        {currentView === 'stations' && (
          <RegionalMapView
            sites={siteOptions}
            organizationName={organization.organization_name}
            highlightedStationId={highlightedStationId}
          />
        )}

        {currentView === 'inspections' && (
          <MultisiteInspectionsView
            selectedSiteId={selectedSiteId}
            sites={siteOptions}
            organizationName={organization.organization_name}
            userRoleType={userRole.role_type}
            onNavigateToStation={handleNavigateToStation}
          />
        )}

        {currentView === 'egenkontroll' && (
          <MultisiteEgenkontrollView
            selectedSiteId={selectedSiteId}
            sites={siteOptions}
            organizationName={organization.organization_name}
          />
        )}

        {currentView === 'cases' && (
          <MultisiteCasesView
            selectedSiteId={selectedSiteId}
            sites={siteOptions}
            organizationName={organization.organization_name}
            userRoleType={userRole.role_type}
          />
        )}

        {currentView === 'reports' && (
          <MultisiteReportsView
            selectedSiteId={selectedSiteId}
            sites={siteOptions}
            userRoleType={userRole.role_type}
            organizationName={organization.organization_name}
          />
        )}

        {currentView === 'quotes' && (
          <MultisiteQuotesView
            selectedSiteId={selectedSiteId}
            userRoleType={userRole.role_type}
          />
        )}
      </MultisitePortalLayout>
    </>
  )
}

export default RegionalPortal

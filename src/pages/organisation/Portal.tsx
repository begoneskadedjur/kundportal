// src/pages/organisation/Portal.tsx - Unified multisite portal (kundportal-stil)
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../contexts/MultisiteContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

// Layout
import MultisitePortalLayout, { MultisitePortalView } from '../../components/organisation/MultisitePortalLayout'

// Views
import MultisiteDashboardView from '../../components/organisation/MultisiteDashboardView'
import MultisiteStationsView from '../../components/organisation/MultisiteStationsView'
import MultisiteInspectionsView from '../../components/organisation/MultisiteInspectionsView'
import MultisiteCasesView from '../../components/organisation/MultisiteCasesView'
import MultisiteReportsView from '../../components/organisation/MultisiteReportsView'
import MultisiteQuotesView from '../../components/organisation/MultisiteQuotesView'

const OrganisationPortal: React.FC = () => {
  const {
    organization,
    userRole,
    sites,
    accessibleSites,
    loading,
    error
  } = useMultisite()

  const [currentView, setCurrentView] = useState<MultisitePortalView>('dashboard')
  const [selectedSiteId, setSelectedSiteId] = useState<string | 'all'>('all')

  // Navigering från inspektioner → stationer
  const [highlightedStationId, setHighlightedStationId] = useState<string | null>(null)
  const [highlightedStationType, setHighlightedStationType] = useState<'outdoor' | 'indoor' | null>(null)
  const [highlightedFloorPlanId, setHighlightedFloorPlanId] = useState<string | null>(null)

  // MultisiteContext fetchar data automatiskt — ingen extra refresh behövs

  // Bestäm tillgängliga enheter baserat på roll
  const availableSites = userRole?.role_type === 'verksamhetschef'
    ? sites
    : accessibleSites

  // Sätt default selectedSiteId baserat på roll
  useEffect(() => {
    if (!userRole || availableSites.length === 0) return

    if (userRole.role_type === 'platsansvarig' && availableSites.length === 1) {
      setSelectedSiteId(availableSites[0].id)
    }
  }, [userRole, availableSites])

  // Roll-label
  const getRoleLabel = () => {
    switch (userRole?.role_type) {
      case 'verksamhetschef': return 'Verksamhetschef'
      case 'regionchef': return 'Regionchef'
      case 'platsansvarig': return 'Platsansvarig'
      default: return 'Organisation'
    }
  }

  // Visa enhetsväljare?
  const showSiteSelector = !(userRole?.role_type === 'platsansvarig' && availableSites.length <= 1)

  // Navigera till station från inspektions-vy
  const handleNavigateToStation = (stationId: string, type: 'outdoor' | 'indoor', floorPlanId?: string, siteId?: string) => {
    if (siteId) {
      setSelectedSiteId(siteId)
    }
    setHighlightedStationId(stationId)
    setHighlightedStationType(type)
    setHighlightedFloorPlanId(floorPlanId || null)
    setCurrentView('stations')
    setTimeout(() => {
      setHighlightedStationId(null)
      setHighlightedStationType(null)
      setHighlightedFloorPlanId(null)
    }, 5000)
  }

  // Konvertera sites till enkel SiteOption-typ
  const siteOptions = availableSites.map(s => ({
    id: s.id,
    site_name: s.site_name || s.company_name || 'Okänd enhet',
    region: s.region
  }))

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar organisationsdata...</p>
        </div>
      </div>
    )
  }

  // Error
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
    <MultisitePortalLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      organizationName={organization.organization_name || organization.company_name || 'Organisation'}
      sites={siteOptions}
      selectedSiteId={selectedSiteId}
      onSiteChange={setSelectedSiteId}
      showSiteSelector={showSiteSelector}
      userRoleLabel={getRoleLabel()}
    >
      {currentView === 'dashboard' && (
        <MultisiteDashboardView
          selectedSiteId={selectedSiteId}
          sites={siteOptions}
          userRoleType={userRole.role_type}
        />
      )}

      {currentView === 'stations' && (
        <MultisiteStationsView
          selectedSiteId={selectedSiteId}
          sites={siteOptions}
          highlightedStationId={highlightedStationId}
          highlightedStationType={highlightedStationType}
          highlightedFloorPlanId={highlightedFloorPlanId}
        />
      )}

      {currentView === 'inspections' && (
        <MultisiteInspectionsView
          selectedSiteId={selectedSiteId}
          sites={siteOptions}
          onNavigateToStation={handleNavigateToStation}
        />
      )}

      {currentView === 'cases' && (
        <MultisiteCasesView
          selectedSiteId={selectedSiteId}
          sites={siteOptions}
        />
      )}

      {currentView === 'reports' && (
        <MultisiteReportsView
          selectedSiteId={selectedSiteId}
          sites={siteOptions}
          userRoleType={userRole.role_type}
        />
      )}

      {currentView === 'quotes' && (
        <MultisiteQuotesView
          selectedSiteId={selectedSiteId}
          userRoleType={userRole.role_type}
        />
      )}
    </MultisitePortalLayout>
  )
}

export default OrganisationPortal

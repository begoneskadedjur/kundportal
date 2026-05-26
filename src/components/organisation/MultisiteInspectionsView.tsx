// src/components/organisation/MultisiteInspectionsView.tsx
// Wrapper för InspectionSessionsView med site-tabs

import React, { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import InspectionSessionsView from '../customer/InspectionSessionsView'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface MultisiteInspectionsViewProps {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
  organizationName?: string
  userRoleType?: string
  onNavigateToStation?: (stationId: string, type: 'outdoor' | 'indoor', floorPlanId?: string, siteId?: string) => void
}

export default function MultisiteInspectionsView({
  selectedSiteId,
  sites,
  organizationName,
  userRoleType,
  onNavigateToStation
}: MultisiteInspectionsViewProps) {
  const [activeSiteTab, setActiveSiteTab] = useState(sites[0]?.id || '')

  // Skapa en callback som inkluderar siteId för navigering
  const handleNavigateToStation = (stationId: string, type: 'outdoor' | 'indoor', floorPlanId?: string) => {
    const siteId = selectedSiteId !== 'all' ? selectedSiteId : activeSiteTab
    onNavigateToStation?.(stationId, type, floorPlanId, siteId)
  }

  // En enhet vald → rendera direkt
  if (selectedSiteId !== 'all') {
    const site = sites.find(s => s.id === selectedSiteId)
    return (
      <InspectionSessionsView
        customerId={selectedSiteId}
        companyName={site?.site_name || 'Enhet'}
        onNavigateToStation={handleNavigateToStation}
      />
    )
  }

  // Alla enheter → site-tabs
  const currentSite = sites.find(s => s.id === activeSiteTab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Org-header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5">
          <h1 className="text-2xl font-bold text-white">{organizationName || 'Organisation'}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {userRoleType === 'verksamhetschef' ? 'Översikt över hela organisationen' : `Översikt över ${sites.length} enheter`}
          </p>
        </div>
        {/* Site tabs */}
        <div className="flex border-b border-slate-700 overflow-x-auto mb-6">
          {sites.map(site => (
            <button
              key={site.id}
              onClick={() => setActiveSiteTab(site.id)}
              className={`relative text-sm px-4 py-2.5 font-medium whitespace-nowrap transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-colors ${
                activeSiteTab === site.id
                  ? 'text-[#20c58f] after:bg-[#20c58f]'
                  : 'text-slate-400 hover:text-white after:bg-transparent'
              }`}
            >
              {site.site_name}
              {site.region && <span className="text-xs ml-1 opacity-60">({site.region})</span>}
            </button>
          ))}
        </div>

        {currentSite && (
          <InspectionSessionsView
            key={activeSiteTab}
            customerId={activeSiteTab}
            companyName={currentSite.site_name}
            onNavigateToStation={handleNavigateToStation}
          />
        )}
      </div>
    </div>
  )
}

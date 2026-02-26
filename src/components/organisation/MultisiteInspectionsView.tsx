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
  onNavigateToStation?: (stationId: string, type: 'outdoor' | 'indoor', floorPlanId?: string, siteId?: string) => void
}

export default function MultisiteInspectionsView({
  selectedSiteId,
  sites,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Site tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">Välj enhet</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {sites.map(site => (
              <button
                key={site.id}
                onClick={() => setActiveSiteTab(site.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSiteTab === site.id
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {site.site_name}
                {site.region && <span className="text-xs ml-1 opacity-60">({site.region})</span>}
              </button>
            ))}
          </div>
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

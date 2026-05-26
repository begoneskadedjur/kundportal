// src/components/organisation/MultisiteStationsView.tsx
// Wrapper för CustomerEquipmentView med site-tabs för "alla enheter"-läge

import React, { useState } from 'react'
import { MapPin } from 'lucide-react'
import CustomerEquipmentView from '../customer/CustomerEquipmentView'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface MultisiteStationsViewProps {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
  highlightedStationId?: string | null
  highlightedStationType?: 'outdoor' | 'indoor' | null
  highlightedFloorPlanId?: string | null
}

export default function MultisiteStationsView({
  selectedSiteId,
  sites,
  highlightedStationId,
  highlightedStationType,
  highlightedFloorPlanId
}: MultisiteStationsViewProps) {
  const [activeSiteTab, setActiveSiteTab] = useState(sites[0]?.id || '')

  // En enhet vald → rendera direkt
  if (selectedSiteId !== 'all') {
    const site = sites.find(s => s.id === selectedSiteId)
    return (
      <CustomerEquipmentView
        customerId={selectedSiteId}
        companyName={site?.site_name || 'Enhet'}
        highlightedStationId={highlightedStationId}
        highlightedStationType={highlightedStationType}
        highlightedFloorPlanId={highlightedFloorPlanId}
      />
    )
  }

  // Alla enheter → site-tabs
  const currentSite = sites.find(s => s.id === activeSiteTab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

        {/* Equipment view för aktiv tab */}
        {currentSite && (
          <CustomerEquipmentView
            key={activeSiteTab}
            customerId={activeSiteTab}
            companyName={currentSite.site_name}
            highlightedStationId={highlightedStationId}
            highlightedStationType={highlightedStationType}
            highlightedFloorPlanId={highlightedFloorPlanId}
          />
        )}
      </div>
    </div>
  )
}

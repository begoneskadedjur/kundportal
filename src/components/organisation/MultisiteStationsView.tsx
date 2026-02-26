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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Välj enhet</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {sites.map(site => (
              <button
                key={site.id}
                onClick={() => setActiveSiteTab(site.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSiteTab === site.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {site.site_name}
                {site.region && <span className="text-xs ml-1 opacity-60">({site.region})</span>}
              </button>
            ))}
          </div>
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

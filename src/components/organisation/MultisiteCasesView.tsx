// src/components/organisation/MultisiteCasesView.tsx
// Wrapper för CompletedCasesView med site-tabs

import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import CompletedCasesView from '../customer/CompletedCasesView'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface MultisiteCasesViewProps {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
}

export default function MultisiteCasesView({
  selectedSiteId,
  sites
}: MultisiteCasesViewProps) {
  const [activeSiteTab, setActiveSiteTab] = useState(sites[0]?.id || '')

  // En enhet vald → rendera direkt
  if (selectedSiteId !== 'all') {
    const site = sites.find(s => s.id === selectedSiteId)
    return (
      <CompletedCasesView
        customerId={selectedSiteId}
        companyName={site?.site_name || 'Enhet'}
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
            <FileText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Välj enhet</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {sites.map(site => (
              <button
                key={site.id}
                onClick={() => setActiveSiteTab(site.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSiteTab === site.id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
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
          <CompletedCasesView
            key={activeSiteTab}
            customerId={activeSiteTab}
            companyName={currentSite.site_name}
          />
        )}
      </div>
    </div>
  )
}

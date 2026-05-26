// src/components/organisation/MultisiteReportsView.tsx
// Wrapper för rapporter: per enhet eller samlad organisationsvy

import React, { useState } from 'react'
import SanitationReports from '../../pages/customer/SanitationReports'
import OrganisationSanitationReports from './OrganisationSanitationReports'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface MultisiteReportsViewProps {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
  organizationName?: string
}

export default function MultisiteReportsView({
  selectedSiteId,
  sites,
  userRoleType,
  organizationName
}: MultisiteReportsViewProps) {
  const [activeSiteTab, setActiveSiteTab] = useState<'all' | string>('all')

  // En enhet vald → rendera direkt
  if (selectedSiteId !== 'all') {
    return (
      <SanitationReports customerId={selectedSiteId} />
    )
  }

  // Alla enheter → org-header + site-tabs + innehåll
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
        <div className="flex border-b border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveSiteTab('all')}
            className={`relative text-sm px-4 py-2.5 font-medium whitespace-nowrap transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-colors ${
              activeSiteTab === 'all'
                ? 'text-[#20c58f] after:bg-[#20c58f]'
                : 'text-slate-400 hover:text-white after:bg-transparent'
            }`}
          >
            Alla enheter
          </button>
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

        {/* Innehåll */}
        {activeSiteTab === 'all' ? (
          <OrganisationSanitationReports
            siteIds={sites.map(s => s.id)}
            userRoleType={userRoleType}
          />
        ) : (
          <SanitationReports key={activeSiteTab} customerId={activeSiteTab} />
        )}
      </div>
    </div>
  )
}

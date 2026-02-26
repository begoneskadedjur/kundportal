// src/components/organisation/MultisiteReportsView.tsx
// Wrapper för rapporter: per enhet eller ackumulerat

import React from 'react'
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
}

export default function MultisiteReportsView({
  selectedSiteId,
  sites,
  userRoleType
}: MultisiteReportsViewProps) {
  // En enhet vald → använd SanitationReports med customerId
  if (selectedSiteId !== 'all') {
    return (
      <SanitationReports customerId={selectedSiteId} />
    )
  }

  // Alla enheter → använd befintlig OrganisationSanitationReports
  const siteIds = sites.map(s => s.id)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <OrganisationSanitationReports
          siteIds={siteIds}
          userRoleType={userRoleType}
        />
      </div>
    </div>
  )
}

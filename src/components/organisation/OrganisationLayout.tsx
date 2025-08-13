// src/components/organisation/OrganisationLayout.tsx - Layout wrapper för organisationssidor
import React from 'react'
import OrganisationNavigation from './OrganisationNavigation'

interface OrganisationLayoutProps {
  children: React.ReactNode
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

const OrganisationLayout: React.FC<OrganisationLayoutProps> = ({ children, userRoleType }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <OrganisationNavigation userRoleType={userRoleType} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

export default OrganisationLayout
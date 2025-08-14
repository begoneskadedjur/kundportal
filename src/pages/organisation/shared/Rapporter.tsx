// src/pages/organisation/shared/Rapporter.tsx - Saneringsrapporter för alla multisite-roller
import React from 'react'
import { useLocation } from 'react-router-dom'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import OrganisationSanitationReports from '../../../components/organisation/OrganisationSanitationReports'

const OrganisationRapporter: React.FC = () => {
  const location = useLocation()
  
  // Bestäm användarroll baserat på URL
  const getUserRoleType = (): 'verksamhetschef' | 'regionchef' | 'platsansvarig' => {
    if (location.pathname.includes('verksamhetschef')) return 'verksamhetschef'
    if (location.pathname.includes('regionchef')) return 'regionchef'
    if (location.pathname.includes('platsansvarig')) return 'platsansvarig'
    return 'verksamhetschef' // fallback
  }
  
  const userRoleType = getUserRoleType()

  return (
    <OrganisationLayout userRoleType={userRoleType}>
      <div className="space-y-6">
        {/* Endast Saneringsrapporter */}
        <OrganisationSanitationReports userRoleType={userRoleType} />
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationRapporter
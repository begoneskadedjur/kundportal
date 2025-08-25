// src/pages/organisation/shared/Statistik.tsx - Förbättrad multisite-statistik med skadedjursfokus
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { BarChart3 } from 'lucide-react'
import { useLocation } from 'react-router-dom'

// Import nya komponenter
import MultisiteServiceExcellenceDashboard from '../../../components/organisation/MultisiteServiceExcellenceDashboard'
import MultisiteCustomerStatistics from '../../../components/organisation/MultisiteCustomerStatistics'
import SiteSelector from '../../../components/organisation/SiteSelector'

const OrganisationStatistik: React.FC = () => {
  const { organization, sites, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const location = useLocation()
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(['all'])
  
  // Bestäm användarroll baserat på URL
  const getUserRoleType = (): 'verksamhetschef' | 'regionchef' | 'platsansvarig' => {
    if (location.pathname.includes('verksamhetschef')) return 'verksamhetschef'
    if (location.pathname.includes('regionchef')) return 'regionchef'
    if (location.pathname.includes('platsansvarig')) return 'platsansvarig'
    return 'verksamhetschef' // fallback
  }
  
  const userRoleType = getUserRoleType()
  
  // Filtrera sites baserat på roll
  const getAvailableSites = () => {
    if (userRoleType === 'verksamhetschef') {
      // Verksamhetschef ser alla sites
      return sites
    } else if (userRoleType === 'regionchef') {
      // Regionchef ser bara sites i sin region
      return accessibleSites
    } else if (userRoleType === 'platsansvarig') {
      // Platsansvarig ser bara sin site
      return accessibleSites
    }
    return []
  }
  
  const availableSites = getAvailableSites()

  // Auto-select all sites initially if platsansvarig has only one site
  useEffect(() => {
    if (userRoleType === 'platsansvarig' && availableSites.length === 1) {
      setSelectedSiteIds([availableSites[0].id])
    }
  }, [availableSites, userRoleType])

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar statistik..." />
      </div>
    )
  }

  // Om inga sites är tillgängliga, visa felmeddelande
  if (!availableSites || availableSites.length === 0) {
    return (
      <OrganisationLayout userRoleType={userRoleType}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Inga enheter tillgängliga</p>
            <p className="text-slate-500 text-sm mt-2">
              Kontakta administratör för att få tillgång till enheter
            </p>
          </div>
        </div>
      </OrganisationLayout>
    )
  }

  return (
    <OrganisationLayout userRoleType={userRoleType}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Statistik & Analys - {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                {userRoleType === 'verksamhetschef' && 'Omfattande skadedjursstatistik för hela organisationen'}
                {userRoleType === 'regionchef' && 'Omfattande skadedjursstatistik för din region'}
                {userRoleType === 'platsansvarig' && 'Omfattande skadedjursstatistik för din enhet'}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        {/* Site Selector */}
        <SiteSelector
          sites={availableSites}
          selectedSiteIds={selectedSiteIds}
          onSelectionChange={setSelectedSiteIds}
          userRoleType={userRoleType}
          organizationName={organization?.organization_name || 'Organization'}
        />

        {/* Service Excellence Dashboard */}
        <MultisiteServiceExcellenceDashboard
          sites={availableSites}
          selectedSiteIds={selectedSiteIds}
          organizationName={organization?.organization_name || 'Organization'}
          userRoleType={userRoleType}
        />

        {/* Detailed Statistics */}
        <MultisiteCustomerStatistics
          sites={availableSites}
          selectedSiteIds={selectedSiteIds}
          organizationName={organization?.organization_name || 'Organization'}
          userRoleType={userRoleType}
        />
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationStatistik
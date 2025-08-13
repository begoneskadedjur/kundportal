// src/pages/organisation/Portal.tsx - Organisationsportal med roll-baserad vy
import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMultisite } from '../../contexts/MultisiteContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

// Roll-specifika vyer
import VerksamhetschefView from '../../components/organisation/VerksamhetschefView'
import RegionchefView from '../../components/organisation/RegionchefView'
import PlatsansvarigView from '../../components/organisation/PlatsansvarigView'

const OrganisationPortal: React.FC = () => {
  const { profile } = useAuth()
  const { 
    organization, 
    userRole, 
    sites,
    accessibleSites,
    loading, 
    error,
    refreshData 
  } = useMultisite()

  // Automatisk refresh vid mount
  useEffect(() => {
    refreshData()
  }, [])

  // Laddningsstatus
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar organisationsdata...</p>
        </div>
      </div>
    )
  }

  // Fel eller ingen åtkomst
  if (error || !organization || !userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="bg-slate-800 rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-semibold text-white mb-4">Ingen organisationsåtkomst</h2>
          <p className="text-slate-400">
            Du har inte tillgång till någon organisation. Kontakta din administratör.
          </p>
        </div>
      </div>
    )
  }

  // Rendera vy baserat på användarens roll
  const renderRoleBasedView = () => {
    switch (userRole.role_type) {
      case 'verksamhetschef':
        return <VerksamhetschefView 
          organization={organization} 
          sites={sites} 
          userRole={userRole}
        />
      
      case 'regionchef':
        return <RegionchefView 
          organization={organization} 
          sites={accessibleSites} 
          userRole={userRole}
          region={userRole.region}
        />
      
      case 'platsansvarig':
        return <PlatsansvarigView 
          organization={organization} 
          sites={accessibleSites} 
          userRole={userRole}
        />
      
      default:
        return <Navigate to="/login" replace />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {renderRoleBasedView()}
    </div>
  )
}

export default OrganisationPortal
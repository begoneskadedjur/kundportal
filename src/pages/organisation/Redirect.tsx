// src/pages/organisation/Redirect.tsx - Redirect användare till rätt organisationssida baserat på roll
import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useMultisite } from '../../contexts/MultisiteContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const OrganisationRedirect: React.FC = () => {
  const { userRole, loading } = useMultisite()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Omdirigerar till din organisationssida...</p>
        </div>
      </div>
    )
  }

  // Redirect baserat på användarens roll
  if (userRole) {
    switch (userRole.role_type) {
      case 'verksamhetschef':
        return <Navigate to="/organisation/verksamhetschef" replace />
      case 'regionchef':
        return <Navigate to="/organisation/regionchef" replace />
      case 'platsansvarig':
        return <Navigate to="/organisation/platsansvarig" replace />
      default:
        return <Navigate to="/login" replace />
    }
  }

  // Om ingen roll finns, redirect till login
  return <Navigate to="/login" replace />
}

export default OrganisationRedirect
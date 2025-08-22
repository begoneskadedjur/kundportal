// src/pages/organisation/shared/Offerter.tsx - Shared quote management page for all organization roles
import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMultisite } from '../../../contexts/MultisiteContext'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import MultisiteQuoteListView from '../../../components/organisation/MultisiteQuoteListView'

const Offerter: React.FC = () => {
  const { role } = useParams<{ role: string }>()
  const navigate = useNavigate()
  const { userRole } = useMultisite()
  
  // Validate role
  const validRoles = ['verksamhetschef', 'regionchef', 'platsansvarig']
  const urlRole = validRoles.includes(role || '') 
    ? role as 'verksamhetschef' | 'regionchef' | 'platsansvarig'
    : 'platsansvarig'

  // Konsistenskontroll mellan URL-parameter och faktisk användarroll
  // Not: OrganisationNavigation hanterar nu URL-korrigeringar, men vi behåller detta som backup
  useEffect(() => {
    if (userRole && urlRole !== userRole.role_type) {
      // Minska log-nivån från warn till info eftersom detta nu är en fallback-funktion
      console.info(`Offerter: Fallback URL-korrigering - URL säger '${urlRole}' men användarens faktiska roll är '${userRole.role_type}'`)
      
      // Omdirigera till korrekt roll-URL endast om OrganisationNavigation missat det
      const correctPath = `/organisation/${userRole.role_type}/offerter`
      console.info(`Offerter: Korrigerar URL från /organisation/${urlRole}/offerter till ${correctPath}`)
      navigate(correctPath, { replace: true })
    }
  }, [userRole, urlRole, navigate])

  // Använd faktisk användarroll om tillgänglig, annars fallback till URL-parameter
  const actualRole = userRole?.role_type || urlRole

  return (
    <OrganisationLayout userRoleType={actualRole}>
      <div className="space-y-6">
        <MultisiteQuoteListView userRole={actualRole} />
      </div>
    </OrganisationLayout>
  )
}

export default Offerter
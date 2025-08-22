// src/pages/organisation/shared/Offerter.tsx - Shared quote management page for all organization roles
import React from 'react'
import { useParams } from 'react-router-dom'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import MultisiteQuoteListView from '../../../components/organisation/MultisiteQuoteListView'

const Offerter: React.FC = () => {
  const { role } = useParams<{ role: string }>()
  
  // Validate role
  const validRoles = ['verksamhetschef', 'regionchef', 'platsansvarig']
  const userRole = validRoles.includes(role || '') 
    ? role as 'verksamhetschef' | 'regionchef' | 'platsansvarig'
    : 'platsansvarig'

  return (
    <OrganisationLayout userRoleType={userRole}>
      <div className="space-y-6">
        <MultisiteQuoteListView userRole={userRole} />
      </div>
    </OrganisationLayout>
  )
}

export default Offerter
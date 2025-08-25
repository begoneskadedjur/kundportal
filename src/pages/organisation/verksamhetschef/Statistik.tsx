// src/pages/organisation/verksamhetschef/Statistik.tsx - Delegerar till shared statistik
import React from 'react'
import OrganisationStatistik from '../shared/Statistik'

// Denna komponent delegerar nu till shared/Statistik.tsx som hanterar
// rollbaserad funktionalitet baserat på URL-path
const VerksamhetschefStatistik: React.FC = () => {
  return <OrganisationStatistik />
}

export default VerksamhetschefStatistik
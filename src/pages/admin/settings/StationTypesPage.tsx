// src/pages/admin/settings/StationTypesPage.tsx
// Admin-sida för hantering av stationstyper

import { useEffect } from 'react'
import { StationTypesSettings } from '../../../components/admin/settings/StationTypesSettings'

export default function StationTypesPage() {
  useEffect(() => {
    document.title = 'Stationstyper - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <StationTypesSettings />
    </div>
  )
}

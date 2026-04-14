// src/pages/admin/settings/ServiceCatalogPage.tsx

import { useEffect } from 'react'
import ServiceCatalogSettings from '../../../components/admin/settings/ServiceCatalogSettings'

export default function ServiceCatalogPage() {
  useEffect(() => {
    document.title = 'Tjänsteutbud | BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <ServiceCatalogSettings />
    </div>
  )
}

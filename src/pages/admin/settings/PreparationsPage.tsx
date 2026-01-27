// src/pages/admin/settings/PreparationsPage.tsx
// Admin-sida för hantering av preparat/bekämpningsmedel

import { useEffect } from 'react'
import { PreparationsSettings } from '../../../components/admin/settings/PreparationsSettings'

export default function PreparationsPage() {
  useEffect(() => {
    document.title = 'Preparat - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <PreparationsSettings />
    </div>
  )
}

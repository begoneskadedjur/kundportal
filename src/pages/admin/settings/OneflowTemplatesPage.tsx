// src/pages/admin/settings/OneflowTemplatesPage.tsx
// Admin-sida för dynamiska Oneflow-avtalsmallar

import { useEffect } from 'react'
import OneflowTemplatesSettings from '../../../components/admin/settings/OneflowTemplatesSettings'

export default function OneflowTemplatesPage() {
  useEffect(() => {
    document.title = 'Avtalsmallar - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <OneflowTemplatesSettings />
    </div>
  )
}

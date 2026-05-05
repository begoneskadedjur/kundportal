// src/pages/admin/settings/PaymentTermsPage.tsx
// Admin-sida för dynamiska betalningsvillkor

import { useEffect } from 'react'
import PaymentTermsSettings from '../../../components/admin/settings/PaymentTermsSettings'

export default function PaymentTermsPage() {
  useEffect(() => {
    document.title = 'Betalningsvillkor - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <PaymentTermsSettings />
    </div>
  )
}

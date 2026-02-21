import { useEffect } from 'react'
import { CustomerGroupsSettings } from '../../../components/admin/settings/CustomerGroupsSettings'

export default function CustomerGroupsPage() {
  useEffect(() => {
    document.title = 'Kundgrupper - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <CustomerGroupsSettings />
    </div>
  )
}

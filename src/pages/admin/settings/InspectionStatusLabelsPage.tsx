import { useEffect } from 'react'
import { InspectionStatusLabelsSettings } from '../../../components/admin/settings/InspectionStatusLabelsSettings'

export default function InspectionStatusLabelsPage() {
  useEffect(() => {
    document.title = 'Inspektionsstatus - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <InspectionStatusLabelsSettings />
    </div>
  )
}

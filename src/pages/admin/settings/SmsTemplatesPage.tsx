import { useEffect } from 'react'
import { SmsTemplatesSettings } from '../../../components/admin/settings/SmsTemplatesSettings'

export default function SmsTemplatesPage() {
  useEffect(() => {
    document.title = 'SMS Mallar - BeGone Admin'
  }, [])

  return (
    <div className="container mx-auto px-4 py-6">
      <SmsTemplatesSettings />
    </div>
  )
}

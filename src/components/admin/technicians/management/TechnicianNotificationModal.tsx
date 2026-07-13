// src/components/admin/technicians/management/TechnicianNotificationModal.tsx
// Mailnotis-inställningar per tekniker (bokad/ombokad/avbokad).
// Notiserna skickas av api/cron/send-booking-notifications var 5:e minut —
// bokningar som skapas i batch (återkommande scheman) grupperas till ETT samlingsmail.

import { useState, useEffect } from 'react'
import { Bell, CalendarClock, UserX, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../../ui/Modal'
import Button from '../../../ui/Button'
import { supabase } from '../../../../lib/supabase'
import type { Technician } from '../../../../services/technicianManagementService'

interface TechnicianNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician: Technician
}

type NotificationSettings = {
  notify_on_booking: boolean
  notify_on_reschedule: boolean
  notify_on_unassignment: boolean
}

const SETTINGS: Array<{
  key: keyof NotificationSettings
  label: string
  description: string
  icon: typeof Bell
}> = [
  {
    key: 'notify_on_booking',
    label: 'Ny bokning',
    description: 'Mail när teknikern bokas in på ett ärende (som primär, sekundär eller tertiär). Ärenden från återkommande scheman samlas i ett mail.',
    icon: Bell
  },
  {
    key: 'notify_on_reschedule',
    label: 'Ombokning',
    description: 'Mail när ett tilldelat ärende byter tid',
    icon: CalendarClock
  },
  {
    key: 'notify_on_unassignment',
    label: 'Avbokning',
    description: 'Mail när teknikern tas bort från ett ärende',
    icon: UserX
  }
]

export default function TechnicianNotificationModal({
  isOpen,
  onClose,
  onSuccess,
  technician
}: TechnicianNotificationModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>({
    notify_on_booking: false,
    notify_on_reschedule: false,
    notify_on_unassignment: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !technician?.id) return
    setLoading(true)
    supabase
      .from('technicians')
      .select('notify_on_booking, notify_on_reschedule, notify_on_unassignment')
      .eq('id', technician.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setSettings({
            notify_on_booking: data.notify_on_booking ?? false,
            notify_on_reschedule: data.notify_on_reschedule ?? false,
            notify_on_unassignment: data.notify_on_unassignment ?? false
          })
        }
        setLoading(false)
      })
  }, [isOpen, technician?.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('technicians')
        .update(settings)
        .eq('id', technician.id)

      if (error) throw error

      toast.success('Notisinställningar sparade')
      onSuccess()
    } catch (err) {
      console.error('Kunde inte spara notisinställningar:', err)
      toast.error('Kunde inte spara notisinställningar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mailnotiser — ${technician?.name || ''}`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 px-4 py-2.5">
          <Button onClick={onClose} variant="secondary" size="sm" disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSave} variant="primary" size="sm" loading={saving} disabled={loading}>
            Spara
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          Mail skickas till <span className="text-slate-300">{technician?.email}</span> inom ~5 minuter
          efter händelsen. Flera bokningar i samma svep (t.ex. ett återkommande schema) samlas i ett mail.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#20c58f]" />
          </div>
        ) : (
          <div className="space-y-2">
            {SETTINGS.map(({ key, label, description, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-[#20c58f] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    settings[key] ? 'bg-[#20c58f]' : 'bg-slate-600'
                  }`}
                  title={settings[key] ? `Avaktivera ${label.toLowerCase()}` : `Aktivera ${label.toLowerCase()}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings[key] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

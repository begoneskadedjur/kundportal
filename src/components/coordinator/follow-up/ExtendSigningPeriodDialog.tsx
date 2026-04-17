// src/components/coordinator/follow-up/ExtendSigningPeriodDialog.tsx
// Dialog för att förlänga signeringsperioden på en offert/avtal i Oneflow

import { useState, useEffect, useMemo } from 'react'
import { Clock, Loader2, CalendarDays } from 'lucide-react'
import DatePicker, { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import 'react-datepicker/dist/react-datepicker.css'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import { useAuth } from '../../../contexts/AuthContext'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import { createSystemComment } from '../../../services/communicationService'
import toast from 'react-hot-toast'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'

registerLocale('sv', sv)

interface ExtendSigningPeriodDialogProps {
  isOpen: boolean
  onClose: () => void
  onExtended: () => void
  offer: FollowUpOffer | null
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDateSv(date: Date): string {
  return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ExtendSigningPeriodDialog({
  isOpen,
  onClose,
  onExtended,
  offer,
}: ExtendSigningPeriodDialogProps) {
  const { profile, user } = useAuth()

  const defaults = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const defaultDate = new Date(today)
    defaultDate.setDate(defaultDate.getDate() + 14)
    return {
      min: tomorrow,
      default: defaultDate,
    }
  }, [])

  const [expireDate, setExpireDate] = useState<Date | null>(defaults.default)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setExpireDate(defaults.default)
      setError(null)
    }
  }, [isOpen, defaults.default])

  const handleClose = () => {
    if (!saving) {
      setError(null)
      onClose()
    }
  }

  const isDateValid = expireDate !== null && expireDate >= defaults.min

  const handleSubmit = async () => {
    if (!offer || !isDateValid || !expireDate) return

    const isoDate = toISODate(expireDate)
    setSaving(true)
    setError(null)

    try {
      await OfferFollowUpService.extendSigningPeriod(offer.id, isoDate)

      // Logga systemkommentar till offerten
      const userName = profile?.full_name || profile?.email || 'Okänd användare'
      if (user) {
        try {
          await createSystemComment(
            offer.id,
            'contract',
            'status_change',
            `Signeringsperiod förlängd till ${formatDateSv(expireDate)} av ${userName}`,
            user.id,
            userName
          )
        } catch (commentErr) {
          console.error('Kunde inte logga systemkommentar:', commentErr)
        }
      }

      toast.success(`Signeringsperioden förlängd till ${formatDateSv(expireDate)}`)
      onExtended()
      handleClose()
    } catch (err: any) {
      const errorMessage = err.message || 'Kunde inte förlänga signeringsperioden'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (!offer) return null

  const customerName = offer.company_name || offer.contact_person || 'Okänd kund'
  const isOverdue = offer.status === 'overdue'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Förläng signeringsperiod"
      size="sm"
      preventClose={saving}
    >
      <div className="p-4">
        <div className="space-y-3">
          {/* Ikon + förklaring */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#20c58f]/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#20c58f]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Ge kunden mer tid att signera
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Uppdaterar deadline i Oneflow. Dokumentet blir signerbart igen om det löpt ut.
              </p>
            </div>
          </div>

          {/* Offert-info */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="text-white font-medium text-sm truncate">{customerName}</p>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                  isOverdue
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {isOverdue ? 'Har löpt ut' : 'Aktiv'}
              </span>
            </div>
            {offer.oneflow_contract_id && (
              <p className="text-xs text-slate-500 mt-0.5">
                Oneflow #{offer.oneflow_contract_id}
              </p>
            )}
          </div>

          {/* Datum-input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nytt utgångsdatum
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
              <DatePicker
                selected={expireDate}
                onChange={(date) => setExpireDate(date)}
                locale="sv"
                dateFormat="yyyy-MM-dd"
                minDate={defaults.min}
                placeholderText="Välj utgångsdatum..."
                disabled={saving}
                wrapperClassName="w-full"
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/20 transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Minst {formatDateSv(defaults.min)} · Kunden kan signera till och med valt datum.
            </p>
          </div>

          {/* Felmeddelande */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-2 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Knappar */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={saving}
              className="flex-1"
              size="sm"
            >
              Avbryt
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isDateValid || saving}
              className="flex-1 flex items-center justify-center gap-2"
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Förlänger...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  Förläng
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

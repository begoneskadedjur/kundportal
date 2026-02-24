// src/components/coordinator/follow-up/DeleteOfferConfirmDialog.tsx
// Bekräftelsedialog för att radera offert/avtal från Oneflow

import { useState } from 'react'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import { useAuth } from '../../../contexts/AuthContext'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import { createSystemComment } from '../../../services/communicationService'
import { createEventLogEntry } from '../../../services/caseDeleteService'
import toast from 'react-hot-toast'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'

interface DeleteOfferConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onDeleted: () => void
  offer: FollowUpOffer | null
}

export default function DeleteOfferConfirmDialog({
  isOpen,
  onClose,
  onDeleted,
  offer
}: DeleteOfferConfirmDialogProps) {
  const { profile, user } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (!deleting) {
      setConfirmText('')
      setError(null)
      onClose()
    }
  }

  const handleDelete = async () => {
    if (!profile || !user || !offer) return

    setDeleting(true)
    setError(null)

    try {
      // 1. Radera via API (Oneflow + DB)
      const result = await OfferFollowUpService.deleteOffer(offer.id)

      const userName = profile.full_name || profile.email || 'Okänd användare'
      const offerName = offer.company_name || offer.contact_person || 'Okänd offert'

      // 2. Logga systemkommentar till offertens kommunikationstab
      try {
        await createSystemComment(
          offer.id,
          'contract',
          'status_change',
          `Offert/avtal raderat av ${userName}`,
          user.id,
          userName
        )
      } catch (commentErr) {
        console.error('Kunde inte logga systemkommentar:', commentErr)
      }

      // 3. Logga till det ursprungliga ärendet om kopplat
      if (result.source_id) {
        try {
          await createSystemComment(
            result.source_id,
            'contract',
            'status_change',
            `Offert "${offerName}" raderad av ${userName}`,
            user.id,
            userName
          )
        } catch (sourceCommentErr) {
          console.error('Kunde inte logga till ursprungligt ärende:', sourceCommentErr)
        }
      }

      // 4. Event log (system-wide audit)
      try {
        await createEventLogEntry({
          event_type: 'offer_deleted',
          description: `Raderade offert/avtal "${offerName}"`,
          case_id: offer.id,
          case_type: 'contract',
          case_title: offerName,
          metadata: {
            oneflow_contract_id: offer.oneflow_contract_id,
            source_id: result.source_id,
            technician_email: offer.begone_employee_email,
            technician_name: offer.begone_employee_name,
          },
          performed_by_id: user.id,
          performed_by_name: userName,
        })
      } catch (logErr) {
        console.error('Kunde inte logga händelse:', logErr)
      }

      toast.success('Offert/avtal raderat')
      onDeleted()
      handleClose()
    } catch (err: any) {
      const errorMessage = err.message || 'Kunde inte radera offert'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  const isConfirmValid = confirmText.toUpperCase() === 'RADERA'

  if (!offer) return null

  const customerName = offer.company_name || offer.contact_person || 'Okänd kund'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Radera offert/avtal"
      size="sm"
      preventClose={deleting}
    >
      <div className="p-4">
        <div className="space-y-4">
          {/* Varningsikon och rubrik */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Radera denna offert/avtal?
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Offerten raderas permanent från Oneflow och databasen.
              </p>
            </div>
          </div>

          {/* Offert-info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-white font-medium text-sm">{customerName}</p>
            <div className="flex items-center gap-2 mt-1">
              {offer.contact_email && (
                <span className="text-xs text-slate-500">{offer.contact_email}</span>
              )}
              {offer.oneflow_contract_id && (
                <span className="text-xs text-slate-500">Oneflow #{offer.oneflow_contract_id}</span>
              )}
            </div>
          </div>

          {/* Bekräftelse-input */}
          <div className="space-y-1.5">
            <label className="block text-sm text-slate-400">
              Skriv <span className="font-mono font-bold text-red-400">RADERA</span> för att bekräfta:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RADERA"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-sm"
              disabled={deleting}
              autoComplete="off"
            />
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
              disabled={deleting}
              className="flex-1"
              size="sm"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!isConfirmValid || deleting}
              className={`flex-1 flex items-center justify-center gap-2 ${
                isConfirmValid && !deleting
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
              size="sm"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Raderar...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Radera
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

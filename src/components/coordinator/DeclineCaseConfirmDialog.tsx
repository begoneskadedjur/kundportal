// src/components/coordinator/DeclineCaseConfirmDialog.tsx
// Bekräftelsedialog för att avvisa väntande ärenden

import { useState } from 'react'
import { AlertTriangle, XCircle, FileText, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Case } from '../../types/cases'
import { createEventLogEntry, EventLogEntry } from '../../services/caseDeleteService'
import toast from 'react-hot-toast'

interface DeclineCaseConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onDeclined: () => void
  caseItem: Case | null
}

export default function DeclineCaseConfirmDialog({
  isOpen,
  onClose,
  onDeclined,
  caseItem
}: DeclineCaseConfirmDialogProps) {
  const { profile } = useAuth()
  const [declining, setDeclining] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  const handleClose = () => {
    if (!declining) {
      setConfirmText('')
      setError(null)
      onClose()
    }
  }

  // Hantera avvisning
  const handleDecline = async () => {
    if (!profile || !caseItem) return

    setDeclining(true)
    setError(null)

    try {
      // Uppdatera ärendets status till "Stängt - slasklogg"
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          status: 'Stängt - slasklogg',
          updated_at: new Date().toISOString()
        })
        .eq('id', caseItem.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Logga händelsen
      const entry: EventLogEntry = {
        event_type: 'status_changed',
        description: `Avvisade väntande förfrågan "${caseItem.title}"`,
        case_id: caseItem.id,
        case_type: 'contract',
        case_title: caseItem.title,
        metadata: {
          old_status: 'Öppen',
          new_status: 'Stängt - slasklogg',
          action: 'declined',
          customer_name: (caseItem as any).customer_name || caseItem.contact_person
        },
        performed_by_id: profile.id,
        performed_by_name: profile.full_name || profile.email || 'Okänd användare'
      }

      await createEventLogEntry(entry)

      toast.success('Förfrågan har avvisats')
      onDeclined()
      handleClose()
    } catch (err: any) {
      const errorMessage = err.message || 'Kunde inte avvisa förfrågan'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setDeclining(false)
    }
  }

  // Kontrollera om "AVVISA" är korrekt skrivet
  const isConfirmValid = confirmText.toUpperCase() === 'AVVISA'

  if (!caseItem) return null

  const customerName = (caseItem as any).customer_name || caseItem.contact_person || 'Okänd kund'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Avvisa förfrågan"
      size="md"
      preventClose={declining}
    >
      <div className="p-6">
        <div className="space-y-6">
          {/* Varningsikon och rubrik */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Är du säker på att du vill avvisa denna förfrågan?
              </h3>
              <p className="text-slate-400 mt-1">
                Ärendet kommer att markeras som &quot;Avslutat utan åtgärd&quot; och försvinna från kundens aktiva ärenden.
              </p>
            </div>
          </div>

          {/* Ärende-info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Förfrågan:</span>
            </div>
            <p className="text-white font-medium">{caseItem.title}</p>
            <p className="text-sm text-slate-500 mt-1">
              {customerName}
              {caseItem.case_number && ` • #${caseItem.case_number}`}
            </p>
            {caseItem.description && (
              <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                {caseItem.description}
              </p>
            )}
          </div>

          {/* Bekräftelse-input */}
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">
              Skriv <span className="font-mono font-bold text-amber-400">AVVISA</span> för att bekräfta:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="AVVISA"
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              disabled={declining}
              autoComplete="off"
            />
          </div>

          {/* Felmeddelande */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-3 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Knappar */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={declining}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleDecline}
              disabled={!isConfirmValid || declining}
              className={`flex-1 flex items-center justify-center gap-2 ${
                isConfirmValid && !declining
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {declining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Avvisar...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Avvisa förfrågan
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import { deleteCase, type DeleteableCaseType } from '../../../services/caseDeleteService'
import toast from 'react-hot-toast'
import type { TechnicianCase } from '../../../pages/technician/TechnicianCases'

const CLOSE_REASONS = [
  { value: 'kund_accepterade_inte_pris', label: 'Kund accepterade inte kostnadsförslaget' },
  { value: 'kund_aterkopplade_aldrig', label: 'Kund återkopplade aldrig' },
  { value: 'lost_vid_inspektion', label: 'Löst vid inspektion' },
  { value: 'kund_avbokade', label: 'Kund avbokade' },
  { value: 'kund_ej_narbar', label: 'Kund ej nåbar' },
  { value: 'dublett', label: 'Dublett' },
  { value: 'ovrigt', label: 'Övrigt' },
]

interface CloseCaseModalProps {
  isOpen: boolean
  onClose: () => void
  cases: TechnicianCase[]
  onSuccess: (deletedIds: string[]) => void
  technicianId: string
  technicianName: string
}

export default function CloseCaseModal({
  isOpen, onClose, cases, onSuccess, technicianId, technicianName,
}: CloseCaseModalProps) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isBatch = cases.length > 1
  const needsNotes = reason === 'ovrigt'
  const canSave = reason && (!needsNotes || notes.trim())

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    try {
      // Samma mjuka borttagning som Radera i ärendemodalen (status Borttaget),
      // med anledningen sparad för statistiken över stängda ärenden.
      const closeReason = {
        reason,
        notes: notes.trim() || null,
        technicianId: technicianId || null,
        technicianName: technicianName || null,
      }

      const results = await Promise.allSettled(
        cases.map(c =>
          deleteCase(c.id, c.case_type as DeleteableCaseType, technicianId, technicianName, closeReason)
        )
      )

      const succeeded = results
        .map((r, i) => r.status === 'fulfilled' && r.value.success ? cases[i].id : null)
        .filter(Boolean) as string[]

      const failed = cases.length - succeeded.length

      if (succeeded.length > 0) {
        onSuccess(succeeded)
        toast.success(`${succeeded.length} ärende${succeeded.length > 1 ? 'n' : ''} borttaget`)
      }
      if (failed > 0) {
        toast.error(`${failed} ärende${failed > 1 ? 'n' : ''} kunde inte tas bort`)
      }

      setReason('')
      setNotes('')
      onClose()
    } catch {
      toast.error('Ett oväntat fel uppstod')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setNotes('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isBatch ? `Ta bort ${cases.length} ärenden` : 'Ta bort ärende'}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-2.5">
          <Button variant="outline" onClick={handleClose}>Avbryt</Button>
          <Button
            variant="danger"
            onClick={handleSave}
            disabled={!canSave || saving}
            loading={saving}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {isBatch ? `Ta bort ${cases.length} ärenden` : 'Ta bort'}
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {!isBatch && cases[0] && (
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-sm font-medium text-white">{cases[0].title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{cases[0].kontaktperson || 'Okänd kund'}</p>
          </div>
        )}

        {isBatch && (
          <p className="text-sm text-slate-400">
            Alla {cases.length} markerade ärenden kommer att tas bort med samma anledning.
          </p>
        )}

        <p className="text-xs text-slate-500">
          Ärendet markeras som borttaget och döljs från alla vyer. All data behålls.
        </p>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">
            Anledning <span className="text-red-400">*</span>
          </label>
          <Select
            value={reason}
            onChange={setReason}
            placeholder="Välj anledning..."
            options={CLOSE_REASONS.map(r => ({ value: r.value, label: r.label }))}
          />
        </div>

        {needsNotes && (
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Anteckningar <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Beskriv varför ärendet tas bort..."
              className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-none"
            />
          </div>
        )}

        {reason && !needsNotes && (
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Anteckningar (valfritt)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Valfria anteckningar..."
              className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-none"
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

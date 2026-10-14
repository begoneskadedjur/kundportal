// src/components/shared/specialReports/AddSectionModal.tsx
// "Lägg till del": fyra val med ikon och förklaring (Område öppnar kartan och
// startar ritningen, Besök, Underleverantör, Fritt). Har ärendet besök som inte
// finns i rapporten än erbjuds "Skapa en del per besök".

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import { Icon, type IconName } from '../../icons/Icon'
import { SpecialReportService } from '../../../services/specialReportService'
import type { SpecialReportSectionLabel } from '../../../types/specialReport'

interface AddSectionModalProps {
  isOpen: boolean
  onClose: () => void
  reportId: string
  /** Valt en typ. Område: föräldern öppnar kartan och startar ritningen */
  onChoose: (label: SpecialReportSectionLabel) => Promise<void> | void
  /** "Skapa en del per besök" */
  onCreatePerVisit: () => Promise<void>
}

const VAL: { label: SpecialReportSectionLabel; ikon: IconName; rubrik: string; text: string; ton: string; extra?: string }[] = [
  { label: 'omrade', ikon: 'rapport.omrade', rubrik: 'Område', text: 'En plats du ritar på kartan, till exempel ett hus, en källare eller en del av tomten.', ton: 'bg-[#20c58f]/15 text-[#20c58f]', extra: 'Öppnar kartan' },
  { label: 'besok', ikon: 'rapport.besok', rubrik: 'Besök', text: 'Vad som gjordes en viss dag, oavsett var.', ton: 'bg-blue-500/15 text-blue-400' },
  { label: 'underlev', ikon: 'rapport.underlev', rubrik: 'Underleverantör', text: 'Arbete som någon annan utförde på vårt uppdrag, till exempel tätning.', ton: 'bg-orange-500/15 text-orange-400' },
  { label: 'fritt', ikon: 'rapport.text', rubrik: 'Fritt', text: 'Valfri rubrik med text och bilder.', ton: 'bg-slate-700/60 text-slate-300' },
]

export default function AddSectionModal({ isOpen, onClose, reportId, onChoose, onCreatePerVisit }: AddSectionModalProps) {
  const [besok, setBesok] = useState<number | null>(null)
  const [arbetar, setArbetar] = useState<string | null>(null)

  // Besök i ärendet som inte finns i rapporten än
  useEffect(() => {
    if (!isOpen) return
    let aktuell = true
    setBesok(null)
    SpecialReportService.getImportCandidates(reportId)
      .then(lista => {
        if (aktuell) setBesok(lista.filter(c => c.source === 'visit' && !c.already_imported).length)
      })
      .catch(() => { if (aktuell) setBesok(0) })
    return () => { aktuell = false }
  }, [isOpen, reportId])

  const valj = async (label: SpecialReportSectionLabel) => {
    setArbetar(label)
    try { await onChoose(label) } finally { setArbetar(null) }
  }

  const perBesok = async () => {
    setArbetar('per-besok')
    try { await onCreatePerVisit() } finally { setArbetar(null) }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lägg till del"
      subtitle="Vad ska delen handla om? Du kan ändra det senare."
      size="md"
      mobilHelskarm
      preventClose={arbetar !== null}
    >
      <div className="p-4 space-y-2">
        {VAL.map(v => (
          <button
            key={v.label}
            type="button"
            onClick={() => valj(v.label)}
            disabled={arbetar !== null}
            className="flex w-full items-center gap-3.5 rounded-xl border-[1.5px] border-slate-700 bg-slate-800/30 p-3.5 text-left transition-colors hover:border-[#20c58f]/70 disabled:opacity-60"
          >
            <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${v.ton}`}>
              {arbetar === v.label ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon name={v.ikon} size={24} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-white">{v.rubrik}</span>
              <span className="block text-sm text-slate-400">{v.text}</span>
            </span>
            {v.extra && <span className="hidden whitespace-nowrap text-xs text-[#20c58f] sm:inline">{v.extra}</span>}
          </button>
        ))}

        {besok !== null && besok > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3">
            <Icon name="rapport.hamta" size={20} className="text-[#20c58f]" />
            <span className="min-w-0 flex-1 text-sm text-slate-300">
              Ärendet har <b className="text-white">{besok} besök</b> som inte finns i rapporten än.
            </span>
            <button
              type="button"
              onClick={perBesok}
              disabled={arbetar !== null}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#20c58f]/60 px-3 text-sm font-semibold text-[#20c58f] hover:bg-[#20c58f]/10 disabled:opacity-60"
            >
              {arbetar === 'per-besok' && <Loader2 className="w-4 h-4 animate-spin" />}
              Skapa en del per besök
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

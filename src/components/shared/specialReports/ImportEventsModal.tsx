// src/components/shared/specialReports/ImportEventsModal.tsx
// Hämta händelser från ärendet (besök och, för avtalsärenden, kontrollrundor)
// till en del. Det som redan finns i rapporten visas gråat.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import { Icon } from '../../icons/Icon'
import { SpecialReportService } from '../../../services/specialReportService'
import { EVENT_TYPES, type SpecialReportEvent, type SpecialReportImportCandidate } from '../../../types/specialReport'
import { EVENT_ICON, PRIMAR_KNAPP, SEKUNDAR_KNAPP } from './specialReportUtils'

interface ImportEventsModalProps {
  isOpen: boolean
  onClose: () => void
  reportId: string
  sectionId: string
  sectionTitle: string
  onImported: (events: SpecialReportEvent[]) => void
}

const nyckel = (c: SpecialReportImportCandidate) => `${c.source}:${c.source_id}`

export default function ImportEventsModal({ isOpen, onClose, reportId, sectionId, sectionTitle, onImported }: ImportEventsModalProps) {
  const [kandidater, setKandidater] = useState<SpecialReportImportCandidate[] | null>(null)
  const [valda, setValda] = useState<Set<string>>(new Set())
  const [hamtar, setHamtar] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setKandidater(null)
    setValda(new Set())
    SpecialReportService.getImportCandidates(reportId)
      .then(res => setKandidater([...res].sort((a, b) => a.event_date.localeCompare(b.event_date))))
      .catch(e => {
        toast.error(e instanceof Error ? e.message : 'Kunde inte hämta ärendets händelser')
        setKandidater([])
      })
  }, [isOpen, reportId])

  const vaxla = (c: SpecialReportImportCandidate) => {
    if (c.already_imported) return
    setValda(prev => {
      const n = new Set(prev)
      const k = nyckel(c)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const hamta = async () => {
    const urval = (kandidater ?? []).filter(c => valda.has(nyckel(c)))
    if (!urval.length) return
    setHamtar(true)
    try {
      const events = await SpecialReportService.importEvents(sectionId, urval)
      toast.success(events.length === 1 ? 'En händelse hämtades' : `${events.length} händelser hämtades`)
      onImported(events)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta händelserna')
    } finally {
      setHamtar(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hämta från ärendet"
      subtitle={`Till delen ${sectionTitle.trim() || 'Utan rubrik'}`}
      size="md"
      usePortal
      mobilHelskarm
      footer={
        <div className="flex justify-end gap-2 px-4 py-2.5">
          <button type="button" className={SEKUNDAR_KNAPP} onClick={onClose}>Avbryt</button>
          <button type="button" className={PRIMAR_KNAPP} onClick={hamta} disabled={valda.size === 0 || hamtar}>
            {hamtar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.hamta" size={20} />}
            {valda.size ? `Hämta ${valda.size}` : 'Hämta'}
          </button>
        </div>
      }
    >
      <div className="p-4">
        {kandidater === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : kandidater.length === 0 ? (
          <div className="py-6 text-center">
            <Icon name="rapport.handelser" size={32} className="mx-auto mb-2 text-slate-500" />
            <p className="text-sm text-slate-400">Ärendet har inga besök eller kontrollrundor att hämta.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {kandidater.map(c => {
              const k = nyckel(c)
              const vald = valda.has(k)
              const typ = EVENT_TYPES[c.type]
              return (
                <li key={k}>
                  <label
                    className={`flex min-h-[52px] items-start gap-3 rounded-xl border px-3 py-2 ${
                      c.already_imported
                        ? 'cursor-not-allowed border-slate-700/40 opacity-50'
                        : vald
                          ? 'cursor-pointer border-[#20c58f] bg-[#20c58f]/5'
                          : 'cursor-pointer border-slate-700/60 bg-slate-800/20 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={vald || c.already_imported}
                      disabled={c.already_imported}
                      onChange={() => vaxla(c)}
                      className="mt-1 h-[18px] w-[18px] rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs">
                        <span className="tabular-nums text-white">{c.event_date}</span>
                        <span className="flex items-center gap-1" style={{ color: typ.color }}>
                          <Icon name={EVENT_ICON[c.type]} size={16} />
                          {typ.label}
                        </span>
                        {c.already_imported && <span className="text-slate-400">Finns redan i rapporten</span>}
                      </span>
                      <span className="block text-sm font-medium text-slate-100">{c.title}</span>
                      {c.description && <span className="block text-xs text-slate-400 line-clamp-2">{c.description}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

// src/components/technician/inspection/KlarmarkeraKnapp.tsx
// Förloppet i stationskontrollen som klarmarkeringsknapp. Fylls i takt med
// kontrollerade stationer (ute och inne tillsammans) och går att trycka först
// när alla är klara. Före det visar ett tryck vad som är kvar per område.
// Används av StationInspectionPanel (inbäddad i ärendet) och
// StationInspectionModule (/technician/inspection/:caseId).

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'

interface Props {
  progress: {
    totalStations: number
    inspectedStations: number
    percentComplete: number
    outdoorProgress: { total: number; inspected: number }
    indoorProgress: { total: number; inspected: number }
  }
  sessionStatus: string
  isSubmitting: boolean
  onKlarmarkera: () => void
  onVisaOmrade: (omrade: 'outdoor' | 'indoor') => void
}

export default function KlarmarkeraKnapp({ progress, sessionStatus, isSubmitting, onKlarmarkera, onVisaOmrade }: Props) {
  const [visaKvar, setVisaKvar] = useState(false)

  const total = progress.totalStations
  const klar = total > 0 && progress.inspectedStations >= total && sessionStatus === 'in_progress'
  const kvarUte = progress.outdoorProgress.total - progress.outdoorProgress.inspected
  const kvarInne = progress.indoorProgress.total - progress.indoorProgress.inspected
  const kvar = Math.max(total - progress.inspectedStations, 0)
  const harBada = progress.outdoorProgress.total > 0 && progress.indoorProgress.total > 0

  if (total === 0) {
    return <p className="text-sm text-slate-400">Inga stationer att kontrollera</p>
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { if (klar) onKlarmarkera(); else setVisaKvar(v => !v) }}
        disabled={isSubmitting}
        aria-label={klar ? 'Klarmarkera kontrollen' : `${progress.inspectedStations} av ${total} stationer kontrollerade, ${kvar} kvar`}
        aria-expanded={klar ? undefined : visaKvar}
        className={`relative w-full min-h-[56px] px-4 rounded-xl border overflow-hidden flex items-center transition-colors disabled:opacity-60 ${
          klar
            ? 'bg-[#20c58f] hover:bg-[#1bb07f] border-[#20c58f] text-[#04140d] shadow-[0_6px_16px_-8px_rgba(32,197,143,0.8)]'
            : 'bg-slate-800 border-slate-700 text-white'
        }`}
      >
        {!klar && (
          <motion.span
            aria-hidden
            initial={false}
            animate={{ width: `${progress.percentComplete}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 bg-[#20c58f]/30"
          />
        )}
        <span className="relative flex w-full items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold">
            {klar && (isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon name="station.klar" size={20} />)}
            {klar
              ? 'Klarmarkera kontrollen'
              : <span><span className="tabular-nums">{progress.inspectedStations} av {total}</span> kontrollerade</span>}
          </span>
          <span className={`text-[13px] font-medium tabular-nums ${klar ? 'opacity-75' : 'text-slate-300'}`}>
            {klar ? `${total} av ${total}` : `${kvar} kvar`}
          </span>
        </span>
      </button>

      {/* Vad som är kvar, per område. Trycket på området byter flik. */}
      {!klar && visaKvar && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-300" role="status">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
            Kontrollera alla stationer för att klarmarkera.
          </span>
          {kvarUte > 0 && (
            <button type="button" onClick={() => onVisaOmrade('outdoor')} className="flex items-center gap-1 font-semibold text-[#20c58f] underline underline-offset-2">
              <Icon name="station.ute" size={16} />
              {kvarUte} kvar ute
            </button>
          )}
          {kvarInne > 0 && (
            <button type="button" onClick={() => onVisaOmrade('indoor')} className="flex items-center gap-1 font-semibold text-[#20c58f] underline underline-offset-2">
              <Icon name="station.inne" size={16} />
              {kvarInne} kvar inne
            </button>
          )}
          {harBada && kvarUte === 0 && <span className="text-slate-400">Ute klart</span>}
          {harBada && kvarInne === 0 && <span className="text-slate-400">Inne klart</span>}
        </div>
      )}
    </div>
  )
}

/** Avslutad kontroll: förloppet som vanlig rad */
export function AvslutatForlopp({ progress }: { progress: Props['progress'] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-300">
        <span>{progress.inspectedStations} av {progress.totalStations} stationer</span>
        <span className="tabular-nums">{progress.percentComplete} %</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div className="bg-[#20c58f] h-1.5 rounded-full" style={{ width: `${progress.percentComplete}%` }} />
      </div>
    </div>
  )
}

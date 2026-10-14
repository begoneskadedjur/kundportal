// src/components/shared/stations/RelocateBar.tsx
// Flyttläget på kartan och planritningen (skissen "Efter: flytta station").
// Övre rad: flyttikon, "Flytta station N" och hjälptext. Nedre panel:
// avståndet (bara utomhus), avbryt som ikonknapp och "Spara position".
// Ritas absolut i förälderns hörn, så föräldern måste vara relative
// (och gärna isolate, så att lagren stannar inom kartan).

import { X, Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'

export interface RelocateBarProps {
  /** Rubriken, t.ex. "Flytta station 2" */
  title: string
  /** Hjälptexten under rubriken */
  hint?: string
  /** Avstånd i meter mellan gammal och ny plats. null/undefined = raden visas inte (inomhus). */
  distanceMeters?: number | null
  /** Sant när en ny position är vald */
  canSave: boolean
  saving?: boolean
  onSave: () => void
  onCancel: () => void
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`
  return `${Math.round(m)} m`
}

export default function RelocateBar({
  title,
  hint = 'Dra stationen till rätt plats',
  distanceMeters,
  canSave,
  saving = false,
  onSave,
  onCancel,
}: RelocateBarProps) {
  return (
    <>
      <div className="absolute left-3 right-3 top-3 z-40 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 pl-3.5 backdrop-blur-sm">
        <span className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#20c58f]/10 text-[#20c58f] flex items-center justify-center">
          <Icon name="station.flytta" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-[#fff] truncate">{title}</p>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
      </div>

      <div className="absolute left-3 right-3 bottom-3 z-40 flex flex-col gap-2.5 rounded-2xl border border-slate-700 bg-slate-900/95 p-3.5 backdrop-blur-sm">
        {distanceMeters != null && (
          <div className="flex items-center justify-between text-xs text-slate-400" aria-live="polite">
            <span>Flyttad</span>
            <span className="text-[15px] font-bold text-[#fff] tabular-nums">{formatDistance(distanceMeters)}</span>
          </div>
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Avbryt flytten"
            className="w-[52px] h-[52px] flex-shrink-0 rounded-2xl border border-slate-600 text-slate-200 flex items-center justify-center hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className="flex-1 h-[52px] rounded-2xl bg-[#20c58f] hover:bg-[#1bb07f] text-[#04140d] text-[15px] font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Icon name="station.ok" size={20} />}
            Spara position
          </button>
        </div>
      </div>
    </>
  )
}

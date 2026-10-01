// src/components/shared/StationIconPicker.tsx
// Ikonval för stationstyper och produkter. Dagens fem snabbknappar ligger
// kvar som förut; "Alla ikoner" fäller ned en lista med alla ikoner i
// registret, grupperade och med vad de är ritade efter.

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  STATION_ICONS,
  STATION_ICON_GROUP_LABEL,
  StationIcon,
  stationIconLabel,
  type StationIconGroup,
} from './stationIcons'

const QUICK = ['target', 'box', 'package', 'crosshair', 'circle']
const GROUPS: StationIconGroup[] = ['typ', 'produkt', 'form']

interface ListProps {
  value: string | null
  onSelect: (key: string | null) => void
  /** Visa raden "Stationstypens ikon" (null) överst, för produkter */
  allowInherit?: boolean
}

/** Den nedfällda listan. Används av båda väljarna. */
function IconList({ value, onSelect, allowInherit }: ListProps) {
  return (
    <div className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label="Ikoner">
      {allowInherit && (
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left text-sm ${
            value === null ? 'bg-emerald-500/10 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
        >
          <span className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center text-[10px] text-slate-400 flex-shrink-0">Typ</span>
          <span className="flex-1">Stationstypens ikon</span>
          {value === null && <Check className="w-4 h-4 text-emerald-400" />}
        </button>
      )}
      {GROUPS.map((g) => (
        <div key={g} className="mt-1 first:mt-0">
          <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            {STATION_ICON_GROUP_LABEL[g]}
          </p>
          {STATION_ICONS.filter((i) => i.group === g).map((i) => {
            const on = value === i.key
            return (
              <button
                key={i.key}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onSelect(i.key)}
                className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left ${
                  on ? 'bg-emerald-500/10' : 'hover:bg-slate-700/60'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  on ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-200'
                }`}>
                  <StationIcon name={i.key} className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${on ? 'text-white' : 'text-slate-200'}`}>{i.label}</span>
                  {i.hint && <span className="block text-xs text-slate-500 truncate">{i.hint}</span>}
                </span>
                {on && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Stäng när man klickar utanför eller trycker Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

/** Stationstypens ikon: snabbknapparna som idag plus listan med alla. */
export function StationIconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const buttons = QUICK.includes(value) ? QUICK : [...QUICK, value]

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {buttons.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              value === key
                ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                : 'bg-slate-700 border border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
            title={stationIconLabel(key)}
          >
            <StationIcon name={key} className="w-5 h-5" />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600"
      >
        <span>Alla ikoner <span className="text-slate-500">· vald: {stationIconLabel(value)}</span></span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
          <IconList value={value} onSelect={(k) => { if (k) onChange(k); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

/**
 * Produktens ikon: en liten knapp som fäller ned listan. null = produkten
 * använder stationstypens ikon.
 */
export function ProductIconPicker({
  value,
  typeIcon,
  onChange,
}: {
  value: string | null
  typeIcon: string
  onChange: (key: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
          value
            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
        }`}
        title={value ? `Produktens ikon: ${stationIconLabel(value)}` : 'Använder stationstypens ikon. Tryck för att välja en egen.'}
      >
        <StationIcon name={value || typeIcon} className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
          <IconList value={value} allowInherit onSelect={(k) => { onChange(k); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

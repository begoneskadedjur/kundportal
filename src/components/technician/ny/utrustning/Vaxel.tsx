// src/components/technician/ny/utrustning/Vaxel.tsx
// Segmentväxel för Utrustning (Kunder, Karta, Kontroller och Karta, Lista,
// Planritning, Schema). Flikar med ikon, 44 px höga, valt läge i brandfärg.

import { Icon, type IconName } from '../../../icons/Icon'

export interface VaxelVal<T extends string> {
  varde: T
  text: string
  /** Kortare text på telefon, till exempel Ritning för Planritning */
  kort?: string
  ikon: IconName
  antal?: number
}

interface Props<T extends string> {
  val: VaxelVal<T>[]
  valt: T
  onVal: (v: T) => void
  etikett: string
  className?: string
}

export function Vaxel<T extends string>({ val, valt, onVal, etikett, className = '' }: Props<T>) {
  return (
    <div role="tablist" aria-label={etikett} className={`flex gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-700/60 ${className}`}>
      {val.map(v => {
        const aktiv = v.varde === valt
        return (
          <button
            key={v.varde}
            type="button"
            role="tab"
            aria-selected={aktiv}
            onClick={() => onVal(v.varde)}
            className={`flex-1 min-w-0 h-11 px-2 flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              aktiv ? 'bg-[#20c58f] text-[#04281c]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon name={v.ikon} size={20} className="flex-shrink-0" />
            {v.kort ? (
              <>
                <span className="truncate sm:hidden">{v.kort}</span>
                <span className="truncate hidden sm:inline">{v.text}</span>
              </>
            ) : <span className="truncate">{v.text}</span>}
            {v.antal !== undefined && (
              <span className={`tabular-nums text-[13px] ${aktiv ? 'text-[#04281c]/70' : 'text-slate-500'}`}>{v.antal}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default Vaxel

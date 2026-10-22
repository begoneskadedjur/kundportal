// src/components/technician/ny/steg/ArendeVerktygArk.tsx
// Ärendets verktyg i nya arbetsvyn (skissen ArendeVerktyg.dc.html): allt som
// sitter i ärendemodalens huvud, menyer och sidfot i dag, samlat i ett ark.
// Bottenark på telefon, panel uppe till höger på dator.
//
// Arket har ingen egen logik. Värden skickar in sina befintliga handlers och
// samma villkor som i dag; ett val som inte gäller ärendet skickas inte med
// (eller skickas med disabled och villkorText).
//
// Användning:
//   <ArendeVerktygArk
//     oppen={visa}
//     onStang={() => setVisa(false)}
//     underrubrik="Extrabesök, Storgatan 12"
//     grupper={[
//       { id: 'rapport', rubrik: 'Rapporter', val: [
//         { id: 'ladda', ikon: 'rapport.ladda', text: 'Ladda ned rapporten', onClick: () => downloadReport() },
//       ] },
//       { id: 'ta-bort', rubrik: 'Ta bort', val: [
//         { id: 'radera', ikon: 'allman.radera', text: 'Radera ärende', fara: true, onClick: () => setShowDeleteDialog(true) },
//       ] },
//     ]}
//   />
//
// Regler:
//  - Arket stängs innan valets onClick körs, så att dialogen som valet öppnar
//    hamnar överst. Sätt behallOppen: true på val som ska låta arket vara kvar.
//  - Renderas via portal till #modal-root (där portalens Modal ligger, z-index 9999)
//    ovanför modalen.
//    Klick och tangenter stoppas så att de inte bubblar genom React-trädet till
//    värdmodalen. Escape stänger arket.
//  - extra: valfritt innehåll under ett val, till exempel mottagarvalet för offert.

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../../../icons/Icon'

export interface ArendeVerktygVal {
  id: string
  ikon: IconName
  text: string
  beskrivning?: string
  /** Villkoret, visas under valet (till exempel "Bara stationskontroll") */
  villkorText?: string
  onClick: () => void
  disabled?: boolean
  /** Rött, för Radera */
  fara?: boolean
  /** Låt arket vara öppet efter klick */
  behallOppen?: boolean
  /** Innehåll under valet, till exempel ett mottagarval */
  extra?: ReactNode
}

export interface ArendeVerktygGrupp {
  id: string
  rubrik: string
  val: ArendeVerktygVal[]
  /** Rad under gruppen, till exempel rapportversionen */
  not?: ReactNode
}

interface Props {
  oppen: boolean
  onStang: () => void
  grupper: ArendeVerktygGrupp[]
  rubrik?: string
  underrubrik?: string
}

export function ArendeVerktygArk({ oppen, onStang, grupper, rubrik = 'Ärendets verktyg', underrubrik }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onStangRef = useRef(onStang)
  onStangRef.current = onStang

  // Escape stänger arket (värdmodalen har preventClose och stängs inte av Escape)
  useEffect(() => {
    if (!oppen) return
    const tangent = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onStangRef.current()
      }
    }
    document.addEventListener('keydown', tangent, true)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', tangent, true)
  }, [oppen])

  if (!oppen || typeof document === 'undefined') return null

  const synligaGrupper = grupper.filter(g => g.val.length > 0)

  // Värdmodalen (Modal med usePortal) ligger i #modal-root, en fast container
  // med z-index 2147483647 direkt under body. Ett ark i body hamnar därför
  // alltid bakom modalen oavsett eget z-index. Arket renderas i samma container
  // så att z-[10020] jämförs med modalens 9999. Containern ägs av Portal och
  // rensas inte här (samma mönster som DuplicateCaseDialog).
  const mal = document.getElementById('modal-root') ?? document.body

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] flex items-end sm:items-start sm:justify-end bg-black/60 sm:bg-black/30 sm:p-4"
      style={{ pointerEvents: 'auto' }}
      onClick={e => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onStang()
      }}
      onKeyDown={e => e.stopPropagation()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arende-verktyg-rubrik"
        tabIndex={-1}
        className="w-full sm:w-[400px] max-h-[85dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl focus:outline-none"
      >
        <div className="flex items-start gap-2 px-4 pt-3 pb-3 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex-1 min-w-0 pt-1.5">
            <h2 id="arende-verktyg-rubrik" className="text-lg font-bold text-white leading-tight">{rubrik}</h2>
            {underrubrik && <p className="text-sm text-slate-400 truncate">{underrubrik}</p>}
          </div>
          <button
            type="button"
            onClick={onStang}
            aria-label="Stäng ärendets verktyg"
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <Icon name="allman.stang" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {synligaGrupper.map(grupp => (
            <section key={grupp.id} aria-labelledby={`verktyg-${grupp.id}`} className="pt-3">
              <h3 id={`verktyg-${grupp.id}`} className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {grupp.rubrik}
              </h3>
              <ul className="list-none m-0 p-0">
                {grupp.val.map(val => (
                  <li key={val.id}>
                    <button
                      type="button"
                      disabled={val.disabled}
                      onClick={() => {
                        if (!val.behallOppen) onStang()
                        val.onClick()
                      }}
                      className={`w-full min-h-[52px] flex items-start gap-3 px-2 py-2.5 rounded-xl text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                        val.fara ? 'text-red-400 hover:bg-red-500/10' : 'text-white hover:bg-slate-800'
                      }`}
                    >
                      <span className={`w-6 h-6 mt-0.5 flex-shrink-0 flex items-center justify-center ${val.fara ? 'text-red-400' : 'text-slate-300'}`}>
                        <Icon name={val.ikon} size={20} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-medium leading-snug">{val.text}</span>
                        {val.beskrivning && <span className="block text-sm text-slate-400 leading-snug mt-0.5">{val.beskrivning}</span>}
                        {val.villkorText && <span className="block text-xs text-slate-500 leading-snug mt-0.5">{val.villkorText}</span>}
                      </span>
                    </button>
                    {val.extra && <div className="px-2 pb-2 pl-11">{val.extra}</div>}
                  </li>
                ))}
              </ul>
              {grupp.not && <div className="px-2 pt-1 text-xs text-slate-400">{grupp.not}</div>}
            </section>
          ))}
        </div>
      </div>
    </div>,
    mal
  )
}

export default ArendeVerktygArk

// src/components/technician/ny/rapporter/SkickaTillKundArk.tsx
// Bekräftelse innan en rapport skickas till kunden i nya arbetsvyn.
// Bottenark i telefonen, ruta på datorn (samma mönster som SkapaArk).
// Ligger i <Portal> med z-index över ärendemodalen (Modal.tsx använder 9999); yttersta
// overlayn har pointer-events-auto eftersom #modal-root släpper igenom klick.
//
//   <SkickaTillKundArk oppen rapportNamn="Saneringsrapport" arendenummer="BE-1"
//     epost="kund@exempel.se" onAvbryt={...} onSkicka={...} skickar={false} />

import { useEffect, useRef } from 'react'
import Portal from '../../../ui/Portal'
import { Icon } from '../../../icons/Icon'
import { bestamdForm } from './rapportLogik'

interface Props {
  oppen: boolean
  rapportNamn: string
  arendenummer: string | null
  epost: string
  /** Text om ett tidigare utskick, till exempel "Rapporten skickades till kunden 2 dagar sedan." */
  tidigare?: string | null
  /** Text under adressen. Utelämnad: hänvisning till ärendets kunduppgifter. */
  adressHjalp?: string
  skickar: boolean
  onAvbryt: () => void
  onSkicka: () => void
}

export function SkickaTillKundArk({ oppen, rapportNamn, arendenummer, epost, tidigare, adressHjalp, skickar, onAvbryt, onSkicka }: Props) {
  const avbrytRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (oppen) avbrytRef.current?.focus()
  }, [oppen])

  useEffect(() => {
    if (!oppen) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !skickar) onAvbryt() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [oppen, skickar, onAvbryt])

  if (!oppen) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[10000] pointer-events-auto flex items-end lg:items-center justify-center">
        <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" onClick={() => { if (!skickar) onAvbryt() }} />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="skicka-kund-rubrik"
          aria-describedby="skicka-kund-text"
          className="relative w-full lg:max-w-md bg-slate-900 border-t lg:border border-slate-700 rounded-t-3xl lg:rounded-2xl shadow-2xl px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:p-5 flex flex-col gap-3"
        >
          <span aria-hidden="true" className="lg:hidden block mx-auto mb-1 w-10 h-1 rounded-full bg-slate-600" />
          <h2 id="skicka-kund-rubrik" className="text-lg font-semibold text-white">Skicka till kund?</h2>
          <p id="skicka-kund-text" className="text-sm text-slate-300 leading-relaxed">
            {`${bestamdForm(rapportNamn).charAt(0).toUpperCase()}${bestamdForm(rapportNamn).slice(1)}`}
            {arendenummer ? <> för <span className="font-mono">{arendenummer}</span></> : null} skickas till:
          </p>
          <p className="rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-3 text-[15px] font-semibold text-white break-all">{epost}</p>
          <p className="text-[13px] text-slate-400">{adressHjalp ?? 'Fel adress? Ändra den i ärendets kunduppgifter först.'}</p>
          {tidigare && (
            <p className="flex items-start gap-2 text-[13px] text-amber-300">
              <Icon name="kund.info" size={16} className="mt-0.5 flex-shrink-0" />
              {tidigare} Skickar du nu får kunden en ny version.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              ref={avbrytRef}
              type="button"
              onClick={onAvbryt}
              disabled={skickar}
              className="h-12 rounded-xl border border-slate-600 text-[15px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={onSkicka}
              disabled={skickar}
              className="h-12 flex items-center justify-center gap-2 rounded-xl bg-[#20c58f] text-[#04281c] text-[15px] font-semibold hover:bg-[#1bb07f] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]"
            >
              {skickar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="rapport.skicka" size={20} />}
              {skickar ? 'Skickar...' : 'Skicka'}
            </button>
          </div>
        </section>
      </div>
    </Portal>
  )
}

export default SkickaTillKundArk

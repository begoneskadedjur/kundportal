// src/components/technician/ny/utrustning/AvslutaEtablering.tsx
// Bekräftelsen innan en pågående etablering avslutas från Stationer
// (Att göra och rutan Pågående etablering på kundsidan).
//
// Dialogen avgör ingenting själv. Efter Avsluta anropas onFardig, som i
// sidorna är useEtableringsflode.finishEstablishmentFor: samma avslutsväg som
// förut med spärren vid 0 placerade stationer och faktureringssammanfattningen.
//
//   Alla stationer ute   Avsluta etablering är förvald (primär)
//   Stationer saknas     Avbryt är förvald, knappen heter Avsluta ändå
//   Antalet saknas       som när stationer saknas

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../icons/Icon'
import type { PagaendeEtableringRad } from './usePagaendeEtableringar'
import { KNAPP_PRIMAR, KNAPP_SEKUNDAR } from './utrustningUi'

export interface AvslutsLage {
  /** Avtalets antal, null när det saknas */
  avtalat: number | null
  /** Placerade avtalsstationer, eller placerade sedan start när avtalets antal saknas */
  placerade: number | null
  /** Alla stationer enligt avtalet är ute */
  klar: boolean
}

export function avslutsLage(rad: PagaendeEtableringRad): AvslutsLage {
  const a = rad.avtal
  if (a && a.avtalat !== null) {
    return { avtalat: a.avtalat, placerade: a.placerade, klar: a.placerade >= a.avtalat }
  }
  return { avtalat: null, placerade: rad.placerade, klar: false }
}

function stationer(n: number): string {
  return n === 1 ? 'station' : 'stationer'
}

function Dialog({ rad, onAvbryt, onAvsluta }: { rad: PagaendeEtableringRad; onAvbryt: () => void; onAvsluta: () => void }) {
  const lage = avslutsLage(rad)
  const forvald = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    forvald.current?.focus()
    const tangent = (e: KeyboardEvent) => { if (e.key === 'Escape') onAvbryt() }
    window.addEventListener('keydown', tangent)
    return () => window.removeEventListener('keydown', tangent)
  }, [onAvbryt])

  let text: ReactNode
  if (lage.avtalat !== null && lage.klar) {
    text = <>Alla {lage.avtalat} {stationer(lage.avtalat)} är placerade.</>
  } else if (lage.avtalat !== null) {
    const x = lage.placerade ?? 0
    text = <>{x} av {lage.avtalat} stationer är placerade, {lage.avtalat - x} saknas.</>
  } else {
    text = (
      <>
        Avtalets antal saknas, så det går inte att se om alla stationer är ute.
        {lage.placerade !== null && <> {lage.placerade} {stationer(lage.placerade)} placerade sedan start.</>}
      </>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onAvbryt}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="avsluta-etablering-rubrik"
        aria-describedby="avsluta-etablering-text"
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${lage.klar ? 'bg-[#20c58f]/15 text-[#20c58f]' : 'bg-amber-500/15 text-amber-400'}`}
          >
            <Icon name="station.klar" size={20} />
          </span>
          <div className="min-w-0 flex flex-col gap-1">
            <h2 id="avsluta-etablering-rubrik" className="text-[17px] font-semibold text-white leading-snug">
              Avsluta etableringen hos {rad.kund}?
            </h2>
            <p id="avsluta-etablering-text" className="text-[15px] leading-relaxed text-slate-300">
              {text} Ärendet stängs och tilläggsstationer faktureras.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            ref={lage.klar ? undefined : forvald}
            type="button"
            onClick={onAvbryt}
            className={KNAPP_SEKUNDAR}
          >
            Avbryt
          </button>
          <button
            ref={lage.klar ? forvald : undefined}
            type="button"
            onClick={onAvsluta}
            className={lage.klar ? KNAPP_PRIMAR : `${KNAPP_SEKUNDAR} border-amber-500/60`}
          >
            {lage.klar ? 'Avsluta etablering' : 'Avsluta ändå'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Frågan före avslutet. fraga(rad) öppnar dialogen, dialog renderas en gång
 * i komponenten. Avsluta stänger dialogen och anropar onFardig oförändrat.
 */
export function useAvslutaEtablering(onFardig: (customerId: string, kund: string) => void | Promise<void>) {
  const [rad, setRad] = useState<PagaendeEtableringRad | null>(null)
  const avbryt = useCallback(() => setRad(null), [])
  const dialog = rad ? (
    <Dialog
      rad={rad}
      onAvbryt={avbryt}
      onAvsluta={() => {
        const r = rad
        setRad(null)
        void onFardig(r.customerId, r.kund)
      }}
    />
  ) : null
  return { fraga: setRad, dialog }
}

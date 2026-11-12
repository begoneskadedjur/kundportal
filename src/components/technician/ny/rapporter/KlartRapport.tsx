// src/components/technician/ny/rapporter/KlartRapport.tsx
// Rutan "Rapporten är klar" i Klart-steget när ärendet är avslutat (nya arbetsvyn).
// Skicka till kund (adressen utskriven, bekräftas i ett ark), Ladda ned PDF
// (kontrollrapporten även Excel), Skicka till mig och Skicka inte nu.
// Skicka inte nu fäller ihop rutan till "Rapporten skickades inte" med Visa val.
// Inget skickas av sig självt, se hjälptexten.

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import { StatusPunkt } from '../besokUi'
import { SkickaTillKundArk } from './SkickaTillKundArk'
import { bestamdForm } from './rapportLogik'
import type { RapportHandlingar } from './rapportHandlingar'

const SEKUNDAR = 'min-h-[48px] w-full px-3.5 rounded-xl border border-slate-600 bg-slate-900 text-white text-[15px] font-medium flex items-center gap-3 text-left hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'

type Lage = 'val' | 'inte-nu' | 'skickad'

export function KlartRapport({ rapport }: { rapport: RapportHandlingar }) {
  const [lage, setLage] = useState<Lage>('val')
  const [skickadTill, setSkickadTill] = useState<string | null>(null)
  const [visaArk, setVisaArk] = useState(false)
  const [skickar, setSkickar] = useState(false)

  const r = rapport
  const stangArk = useCallback(() => setVisaArk(false), [])
  const avstangd = r.upptagen || !r.kanSkapas || skickar

  const skickaKund = async () => {
    if (!r.kundEpost) return
    setSkickar(true)
    try {
      const ok = await r.skickaTillKund(r.kundEpost)
      if (ok) {
        setSkickadTill(r.kundEpost)
        setLage('skickad')
        setVisaArk(false)
      }
    } finally {
      setSkickar(false)
    }
  }

  const hjalp = (
    <HjalpText id="klart-rapport" rubrik="Rapporten skickas inte av sig själv" niva="h3">
      {lage === 'inte-nu'
        ? 'Du hittar rapporten under Rapporter. Där kan du skicka den till kunden eller ladda ned den när du vill. '
        : 'Väljer du Skicka inte nu finns rapporten kvar under Rapporter, där du kan skicka eller ladda ned den senare. '}
      <Link to="/technician/rapporter" className="font-medium text-[#20c58f] underline underline-offset-2 hover:text-[#5fe0b4]">Gå till Rapporter</Link>
    </HjalpText>
  )

  if (lage !== 'val') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3.5 flex items-center gap-3">
          <Icon name="rapport.rapport" size={24} className="text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {lage === 'skickad' ? `${bestamdForm(r.rapportNamn).charAt(0).toUpperCase()}${bestamdForm(r.rapportNamn).slice(1)} är skickad` : 'Rapporten skickades inte'}
            </p>
            {lage === 'skickad'
              ? <StatusPunkt ton="gron"><span className="truncate">Skickad till {skickadTill}</span></StatusPunkt>
              : <StatusPunkt ton="gra">Inte skickad</StatusPunkt>}
          </div>
          <button
            type="button"
            onClick={() => setLage('val')}
            className="min-h-[44px] px-3 rounded-xl border border-slate-600 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            Visa val
          </button>
        </div>
        {hjalp}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="klart-rapport-rubrik" className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Icon name="rapport.rapport" size={24} className="text-slate-300" />
          <h3 id="klart-rapport-rubrik" className="text-[15px] font-semibold text-white">Rapporten är klar</h3>
        </div>
        <p className="text-sm text-slate-400">{r.rapportNamn}. Vad vill du göra med den?</p>

        {r.kundEpost ? (
          <button
            type="button"
            onClick={() => setVisaArk(true)}
            disabled={avstangd}
            className="min-h-[56px] w-full px-3.5 py-2 rounded-xl bg-[#20c58f] text-[#04281c] text-[15px] font-semibold flex items-center gap-3 text-left hover:bg-[#1bb07f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]"
          >
            <Icon name="rapport.skicka" size={20} className="flex-shrink-0" />
            <span className="flex flex-col min-w-0">
              <span>Skicka till kund</span>
              <span className="text-[13px] font-medium opacity-80 truncate">{r.kundEpost}</span>
            </span>
          </button>
        ) : (
          <p className="text-sm text-amber-300">Kunden saknar e-post i ärendet, så rapporten kan inte skickas till kunden härifrån. Ladda ned den eller be kontoret lägga in adressen.</p>
        )}

        <button type="button" onClick={() => { void r.laddaNed() }} disabled={avstangd} className={SEKUNDAR}>
          {r.upptagen ? <Icon name="allman.laddar" size={20} className="animate-spin flex-shrink-0" /> : <Icon name="rapport.ladda" size={20} className="flex-shrink-0" />}
          Ladda ned PDF
        </button>
        {r.laddaNedExcel && (
          <button type="button" onClick={() => { void r.laddaNedExcel?.() }} disabled={avstangd} className={SEKUNDAR}>
            <Icon name="upphandling.excel" size={20} className="flex-shrink-0" />
            Ladda ned Excel
          </button>
        )}
        <button
          type="button"
          onClick={() => { void r.skickaTillMig() }}
          disabled={avstangd || !r.minEpost}
          className={SEKUNDAR}
        >
          <Icon name="rapport.person" size={20} className="flex-shrink-0" />
          <span className="flex flex-col min-w-0">
            <span>Skicka till mig</span>
            {r.minEpost
              ? <span className="text-[13px] text-slate-400 truncate">{r.minEpost}</span>
              : <span className="text-[13px] text-slate-400">Ditt konto saknar e-post</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLage('inte-nu')}
          disabled={skickar}
          className="min-h-[48px] rounded-xl text-[15px] font-medium text-slate-300 underline underline-offset-4 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
        >
          Skicka inte nu
        </button>
        {r.kanInteText && !r.kanSkapas && <p className="text-sm text-slate-400">{r.kanInteText}</p>}
        {r.sort === 'kontroll' && r.upptagen && (
          <p className="text-[13px] text-slate-400">Kontrollrapporten skapas med karta och planritningar, det kan ta upp till en halv minut.</p>
        )}
      </section>
      {hjalp}

      <SkickaTillKundArk
        oppen={visaArk}
        rapportNamn={r.rapportNamn}
        arendenummer={r.arendenummer}
        epost={r.kundEpost ?? ''}
        tidigare={r.tidigareTillKund}
        skickar={skickar}
        onAvbryt={stangArk}
        onSkicka={() => { void skickaKund() }}
      />
    </div>
  )
}

export default KlartRapport

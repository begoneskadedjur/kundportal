// src/pages/shared/intranet/interactive/nyvy/StationerEtablering.tsx
// Guiden Gör en etablering: räknaren "X av Y stationer placerade". Läsaren placerar
// avtalsstationer och tilläggsstationer och ser raden i Pågående etablering, vad
// avslutsfrågan säger (Avsluta etablering eller Avsluta ändå, AvslutaEtablering.tsx)
// och vad som faktureras: avtalets stationer och etableringen ingår, tillägg faktureras.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'

const AVTALAT = 6
const KUND = 'Exempel AB'

export default function StationerEtablering() {
  const [avtal, setAvtal] = useState(0)
  const [tillagg, setTillagg] = useState(0)
  const klar = avtal >= AVTALAT
  const punkt = klar ? 'bg-[#20c58f]' : avtal === 0 ? 'bg-amber-500' : 'bg-slate-500'
  const knapp = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 text-sm font-semibold text-white disabled:opacity-40'

  return (
    <div className="my-5 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <p className="text-sm font-semibold text-white">Prova räknaren</p>
      <p className="mt-0.5 text-sm text-slate-400">Avtalet hos {KUND} har {AVTALAT} betongstationer. Placera stationer och se vad portalen visar.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={knapp} onClick={() => setAvtal(a => Math.min(AVTALAT + 2, a + 1))}><Icon name="utrustning.placera" size={20} />Placera avtalsstation</button>
        <button type="button" className={knapp} onClick={() => setTillagg(t => t + 1)}><Icon name="allman.plus" size={20} />Placera tilläggsstation</button>
        <button type="button" className={knapp} onClick={() => { setAvtal(0); setTillagg(0) }} disabled={!avtal && !tillagg}><Icon name="allman.aterstall" size={20} />Börja om</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#20c58f]/40 bg-slate-900/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pågående etablering</p>
          <p className="mt-1 text-base font-semibold text-white">{KUND}</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-300"><span className={`h-2 w-2 rounded-full ${punkt}`} />{Math.min(avtal, AVTALAT)} av {AVTALAT} stationer placerade</p>
          {tillagg > 0 && <p className="text-sm text-slate-400">{tillagg} {tillagg === 1 ? 'tilläggsstation' : 'tilläggsstationer'} utöver avtalet</p>}
          <p className="mt-2 text-sm text-slate-400">Knappen som är grön: <span className="font-semibold text-white">{klar ? 'Avsluta etablering' : 'Placera station'}</span></p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avsluta etablering frågar</p>
          <p className="mt-1 text-sm text-slate-200">
            {klar ? `Alla ${AVTALAT} stationer är placerade.` : `${Math.min(avtal, AVTALAT)} av ${AVTALAT} stationer är placerade, ${AVTALAT - Math.min(avtal, AVTALAT)} saknas.`} Ärendet stängs och tilläggsstationer faktureras.
          </p>
          <p className="mt-2 text-sm text-slate-400">Knappen heter <span className="font-semibold text-white">{klar ? 'Avsluta etablering' : 'Avsluta ändå'}</span>{klar ? ' och är förvald.' : ', och Avbryt är förvald.'}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-900/60 p-3 text-sm" role="status" aria-live="polite">
        <p className="mb-1 font-semibold text-white">Vad faktureras?</p>
        <p className="flex justify-between gap-3"><span className="text-slate-300">Etableringen och avtalets stationer</span><span className="text-[#20c58f]">Ingår i avtalet</span></p>
        <p className="flex justify-between gap-3"><span className="text-slate-300">Tilläggsstationer</span><span className={tillagg ? 'font-semibold text-violet-300' : 'text-slate-500'}>{tillagg ? `${tillagg} st faktureras` : 'Inga'}</span></p>
        {avtal > AVTALAT && <p className="mt-1 text-xs text-amber-300">Du har placerat fler än avtalet utan att markera dem som tillägg. Stationer utöver avtalet ska ha Tillägg utöver avtal ibockat, annars faktureras de inte.</p>}
      </div>
    </div>
  )
}

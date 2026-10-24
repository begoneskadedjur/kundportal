// src/pages/shared/intranet/interactive/nyvy/TicketMottagare.tsx
// Prova vem som får en ticket: En kollega, En roll eller Alla, och var tråden hamnar
// hos mottagaren och hos dig. Texterna ur NyFragaDialog (knappen och raden längst ner),
// fragorLogik.analysMin (grupperna och statusraderna) och useTicketsBadge (klockan
// räknar bara Frågor till dig och Svar till dig). Påhittade namn.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../../components/icons/Icon'

type Val = 'kollega' | 'roll' | 'alla'

interface Utfall {
  knapp: string
  fot: string
  vem: string
  hosDem: { grupp: string; status: string }
  klocka: string
  hosDig: string
  extra?: string
}

const UTFALL: Record<Val, Utfall> = {
  kollega: {
    knapp: 'Skicka till Anna',
    fot: 'Anna får en notis direkt.',
    vem: 'Anna Exempel',
    hosDem: { grupp: 'Väntar på dig › Frågor till dig', status: 'Ditt förnamn väntar på ditt svar sedan 10:12' },
    klocka: 'Siffran på Annas klocka ökar med 1 tills hon svarar.',
    hosDig: 'Väntar på Anna sedan 10:12',
  },
  roll: {
    knapp: 'Skicka till koordinatorerna',
    fot: 'Koordinatorerna får en notis direkt.',
    vem: 'Varje koordinator',
    hosDem: { grupp: 'Omnämnd, för kännedom', status: 'För kännedom, till koordinatorerna' },
    klocka: 'Klockan räknar inte frågor till en roll. Kontoret ser frågan överst under Alla tills någon svarar eller trycker Jag tar den.',
    hosDig: 'Ingen koordinator har svarat än',
    extra: 'Trycker Anna Jag tar den väntar tråden på henne, och de andra ser att hon har den.',
  },
  alla: {
    knapp: 'Skicka till alla',
    fot: 'Alla får en notis direkt.',
    vem: 'Alla i portalen',
    hosDem: { grupp: 'Omnämnd, för kännedom', status: 'För kännedom, till alla' },
    klocka: 'Klockan räknar inte frågor till alla. Använd Alla för sådant alla ska känna till.',
    hosDig: 'Ingen har svarat än',
  },
}

const KNAPPAR: { val: Val; ikon: IconName; titel: string; text: string }[] = [
  { val: 'kollega', ikon: 'rapport.person', titel: 'En kollega', text: 'Anna Exempel' },
  { val: 'roll', ikon: 'dok.omnamnd', titel: 'En roll', text: 'Koordinator' },
  { val: 'alla', ikon: 'allman.foretag', titel: 'Alla', text: 'För kännedom' },
]

export default function TicketMottagare({ variant }: { variant?: string }) {
  void variant
  const [val, setVal] = useState<Val>('kollega')
  const u = UTFALL[val]
  return (
    <div className="my-6 grid gap-4 rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-base font-semibold text-white">Vem får frågan, och var hamnar den?</p>
        <p className="text-sm text-slate-400">Välj under Till vem? som i rutan Ny ticket.</p>
      </div>
      <div role="radiogroup" aria-label="Till vem?" className="grid gap-2 sm:grid-cols-3">
        {KNAPPAR.map(k => (
          <button key={k.val} type="button" role="radio" aria-checked={val === k.val} onClick={() => setVal(k.val)}
            className={`flex min-h-[56px] items-center gap-3 rounded-xl border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${val === k.val ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
            <Icon name={k.ikon} size={20} className="flex-none text-slate-300" />
            <span><span className="block text-[15px] font-semibold text-white">{k.titel}</span><span className="block text-sm text-slate-400">{k.text}</span></span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">I rutan Ny ticket</p>
          <p className="text-sm text-slate-300">Längst ner står: <span className="text-white">{u.fot}</span></p>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#20c58f] px-3 py-1.5 text-sm font-semibold text-[#04281c]">
            <Icon name="rapport.skicka" size={16} />{u.knapp}
          </span>
        </section>
        <section className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hos dig, i Tickets</p>
          <p className="text-sm text-white">Du väntar på svar</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-400"><span aria-hidden className="h-2 w-2 rounded-full bg-slate-500" />{u.hosDig}</p>
          <p className="text-sm text-slate-400">När någon svarar flyttas tråden till Väntar på dig › Svar till dig, och din klocka visar 1.</p>
        </section>
        <section className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hos mottagaren: {u.vem}</p>
          <p className="text-sm text-white">{u.hosDem.grupp}</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-400"><span aria-hidden className={`h-2 w-2 rounded-full ${val === 'kollega' ? 'bg-sky-500' : 'bg-slate-500'}`} />{u.hosDem.status}</p>
          <p className="text-sm text-slate-300">{u.klocka}</p>
          {u.extra && <p className="text-sm text-slate-300">{u.extra}</p>}
        </section>
      </div>
      <p className="text-sm text-slate-400">Vill du ha svar från en viss person: välj personen. Kunden ser aldrig trådarna.</p>
    </div>
  )
}

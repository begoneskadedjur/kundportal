// src/pages/shared/intranet/interactive/nyvy/NastaUppdrag.tsx
// Prova själv: vilket besök står som Nästa uppdrag på Idag? Använder portalens egna
// funktioner nastaBesok och tidTill (teknikerDagService), så svaret blir detsamma som i
// portalen. Påhittad dag 2026-10-26 med tre besök.

import { useMemo, useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { nastaBesok, tidTill, type DagBesok } from '../../../../../services/teknikerDagService'

interface Ex { id: string; kund: string; start: [number, number]; slut: [number, number] }

const BESOK: Ex[] = [
  { id: 'fam', kund: 'Familjen Exempel', start: [8, 0], slut: [9, 30] },
  { id: 'ab', kund: 'Exempel AB', start: [10, 30], slut: [12, 0] },
  { id: 'brf', kund: 'Brf Exempelgården', start: [13, 0], slut: [15, 0] },
]

const tid = (h: number, m: number) => new Date(2026, 9, 26, h, m)
const klock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export default function NastaUppdrag() {
  const [minuter, setMinuter] = useState(7 * 60 + 35)
  const [klara, setKlara] = useState<Set<string>>(new Set())
  const nu = tid(Math.floor(minuter / 60), minuter % 60)

  const lista = useMemo(() => BESOK.map(b => ({
    nyckel: b.id, kund: b.kund, avslutad: klara.has(b.id), start: tid(...b.start), slut: tid(...b.slut),
  })), [klara])

  // Portalens regel: första besöket som inte är klart och inte slutade för mer än en timme sedan
  const nasta = nastaBesok(lista as unknown as DagBesok[], nu) as unknown as (typeof lista)[number] | null
  const om = nasta ? tidTill(nasta.start, nu) : ''

  const vaxla = (id: string) => setKlara(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  return (
    <div className="my-5 grid gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex items-center gap-2">
        <Icon name="falt.framme" size={20} className="text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova: vilket besök är Nästa uppdrag?</p>
      </div>
      <p className="text-sm text-slate-300">Dra i klockan och bocka i det som är klart. Rutan visar vad Idag skulle visa överst.</p>
      <label className="grid gap-1">
        <span className="flex items-center justify-between text-xs text-slate-400"><span>Klockan</span><span className="font-mono text-base font-bold text-white">{klock(nu)}</span></span>
        <input type="range" min={7 * 60} max={17 * 60} step={5} value={minuter} onChange={e => setMinuter(Number(e.target.value))}
          className="w-full accent-[#20c58f]" aria-label="Klockan" />
      </label>
      <ul className="grid gap-1.5">
        {lista.map(b => (
          <li key={b.nyckel}>
            <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 ${nasta?.nyckel === b.nyckel ? 'border-[#20c58f]/60 bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900/40'}`}>
              <input type="checkbox" checked={b.avslutad} onChange={() => vaxla(b.nyckel)} className="h-5 w-5 accent-[#20c58f]" />
              <span className="font-mono text-sm text-slate-300">{klock(b.start)} till {klock(b.slut)}</span>
              <span className="flex-1 text-sm text-white">{b.kund}</span>
              <span className="text-xs text-slate-400">{b.avslutad ? 'Klart' : nasta?.nyckel === b.nyckel ? 'Nästa' : ''}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-[#20c58f]/30 bg-slate-900 p-3" role="status" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#20c58f]">Nästa uppdrag</p>
        {nasta
          ? <p className="text-sm text-white"><span className="font-mono font-bold">{klock(nasta.start)}</span>{om ? <span className="text-slate-400"> {om}</span> : null}, {nasta.kund}</p>
          : <p className="text-sm text-slate-300">Alla dagens besök är klara.</p>}
      </div>
      <p className="text-xs text-slate-500">Ett besök som slutade för mer än en timme sedan hoppas över när det finns ett senare besök kvar, även om det inte är klart. Är det inte avslutat dagen efter står det under Att göra, som Besök att avsluta.</p>
    </div>
  )
}

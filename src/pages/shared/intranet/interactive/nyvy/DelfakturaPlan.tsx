// src/pages/shared/intranet/interactive/nyvy/DelfakturaPlan.tsx
// Interaktiv del i guiden Delfakturera ett ärende: tre besök i samma ärende. Kryssa i
// Skapa delfaktura för nuvarande tjänster vid återbesöken och se vilken faktura varje
// rad hamnar på. Samma regel som RevisitModal: en delfaktura tar alla ofakturerade rader,
// raderna försvinner från ärendet, och det som är kvar blir slutfakturan när du stänger
// hela ärendet. Belopp exkl. moms, påhittad kund.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'

const BESOK: { datum: string; rad: string; belopp: number; sista?: boolean }[] = [
  { datum: '2026-10-06', rad: 'Råttbekämpning, första besöket', belopp: 1800 },
  { datum: '2026-10-13', rad: 'Uppföljning och tätning av ventil', belopp: 950 },
  { datum: '2026-10-27', rad: 'Slutkontroll', belopp: 700, sista: true },
]

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

export default function DelfakturaPlan() {
  const [kryss, setKryss] = useState<boolean[]>([false, true])

  // Räkna fram fakturorna: ofakturerade rader samlas tills en delfaktura eller slutfakturan tar dem
  const fakturor: { namn: string; datum: string; rader: typeof BESOK }[] = []
  let kvar: typeof BESOK = []
  BESOK.forEach((b, i) => {
    kvar = [...kvar, b]
    if (b.sista) {
      fakturor.push({ namn: 'Slutfaktura', datum: b.datum, rader: kvar })
      kvar = []
    } else if (kryss[i]) {
      fakturor.push({ namn: 'Delfaktura', datum: b.datum, rader: kvar })
      kvar = []
    }
  })

  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Prova: tre besök hos Brf Exempelgården</p>
        <p className="text-sm text-slate-400">Kryssa i eller ur delfakturan vid återbesöken och se vilka fakturor som blir av.</p>
      </div>
      <ol className="m-0 grid list-none gap-2 p-0">
        {BESOK.map((b, i) => (
          <li key={b.datum} className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-semibold text-white">{b.datum}: {b.rad}</p>
              <p className="text-sm text-slate-400">{kr(b.belopp)} exkl. moms läggs på ärendet</p>
            </div>
            {b.sista ? (
              <p className="flex items-center gap-1.5 text-sm text-slate-300"><Icon name="falt.klart" size={20} className="text-[#20c58f]" />Stäng hela ärendet</p>
            ) : (
              <button type="button" role="checkbox" aria-checked={!!kryss[i]} onClick={() => setKryss(k => k.map((v, j) => (j === i ? !v : v)))}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-600 px-3 text-left text-sm text-slate-200 hover:bg-slate-800">
                <span className={`flex h-5 w-5 flex-none items-center justify-center rounded border-[1.5px] ${kryss[i] ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>
                  {kryss[i] && <Icon name="allman.bock" size={16} />}
                </span>
                Skapa delfaktura för nuvarande tjänster
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="grid gap-2" aria-live="polite">
        <p className="text-sm font-semibold text-white">{fakturor.length === 1 ? 'Det blir 1 faktura' : `Det blir ${fakturor.length} fakturor`}</p>
        {fakturor.map(f => (
          <div key={f.datum} className="grid gap-1 rounded-xl border border-[#20c58f]/30 bg-[#20c58f]/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-white"><Icon name="sok.faktura" size={20} className="text-[#20c58f]" />{f.namn} {f.datum}</p>
            {f.rader.map(r => <p key={r.rad} className="flex justify-between text-slate-300"><span>{r.rad}</span><span className="tabular-nums">{kr(r.belopp)}</span></p>)}
            <p className="flex justify-between border-t border-slate-700/60 pt-1 font-semibold text-white"><span>Totalt (exkl. moms)</span><span className="tabular-nums">{kr(f.rader.reduce((s, r) => s + r.belopp, 0))}</span></p>
          </div>
        ))}
        <p className="text-xs text-slate-500">Alla fakturor går vidare till godkännande och Fortnox. Kunden får inget direkt från dig.</p>
      </div>
    </div>
  )
}

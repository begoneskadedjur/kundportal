// src/pages/shared/intranet/interactive/delfakturering/DelfakturaManadOvning.tsx
// Delfaktureringsguiden: övning i att fakturera ett ärende med många besök en
// gång per månad. Varje besök lägger en rad på ärendet. Efter varje besök utom
// det sista bokas ett återbesök, och då kan man kryssa i Skapa delfaktura. Det
// sista besöket avslutar ärendet och resten blir slutfakturan.
//
// Samma regel som RevisitModal + InvoiceService.createInvoiceFromCase: en
// delfaktura tar ALLA ofakturerade rader på ärendet, oavsett vilket besök de
// kommer från. Ingenting sparas.

import { useMemo, useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { Aterkoppling, Knapp, Ram } from '../leads/leadsShared'

interface Besok {
  id: string
  datum: string
  manad: 'okt' | 'nov'
  belopp: number
}

const BESOK: Besok[] = [
  { id: 'b1', datum: '2026-10-06', manad: 'okt', belopp: 1800 },
  { id: 'b2', datum: '2026-10-13', manad: 'okt', belopp: 1200 },
  { id: 'b3', datum: '2026-10-27', manad: 'okt', belopp: 1200 },
  { id: 'b4', datum: '2026-11-03', manad: 'nov', belopp: 1200 },
  { id: 'b5', datum: '2026-11-17', manad: 'nov', belopp: 1200 },
  { id: 'b6', datum: '2026-11-24', manad: 'nov', belopp: 900 },
]

const SISTA = BESOK[BESOK.length - 1].id

interface Faktura {
  slag: 'Delfaktura' | 'Slutfaktura'
  besok: Besok[]
}

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

function bygg(kryss: Set<string>): Faktura[] {
  const fakturor: Faktura[] = []
  let vantar: Besok[] = []
  for (const b of BESOK) {
    vantar.push(b)
    if (b.id === SISTA) {
      fakturor.push({ slag: 'Slutfaktura', besok: vantar })
    } else if (kryss.has(b.id)) {
      fakturor.push({ slag: 'Delfaktura', besok: vantar })
      vantar = []
    }
  }
  return fakturor
}

export default function DelfakturaManadOvning() {
  const [kryss, setKryss] = useState<Set<string>>(new Set())
  const [visa, setVisa] = useState(false)

  const fakturor = useMemo(() => bygg(kryss), [kryss])

  const vaxla = (id: string) => {
    setVisa(false)
    setKryss(k => {
      const ny = new Set(k)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  const blandar = fakturor.some(f => new Set(f.besok.map(b => b.manad)).size > 1)
  const okt = fakturor.filter(f => f.besok.some(b => b.manad === 'okt')).length
  const nov = fakturor.filter(f => f.besok.some(b => b.manad === 'nov')).length
  const ratt = !blandar && okt === 1 && nov === 1

  return (
    <Ram where="Företagsärende · Råttbekämpning, Brf Exempelgården" caption="Beloppen är exklusive moms.">
      <p className="mb-3 text-sm text-slate-300">
        <span className="font-semibold text-white">Uppdrag:</span> kunden vill ha en faktura för oktober och en för november. Kryssa i Skapa delfaktura på rätt besök och tryck Visa fakturorna.
      </p>

      <ol className="space-y-1.5">
        {BESOK.map((b, n) => {
          const forstaINov = b.manad === 'nov' && BESOK[n - 1]?.manad === 'okt'
          const sista = b.id === SISTA
          return (
            <li key={b.id}>
              {(n === 0 || forstaINov) && (
                <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400 first:mt-0">
                  {b.manad === 'okt' ? 'Oktober' : 'November'}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-2">
                <span className="flex min-w-[150px] items-center gap-2 text-sm text-white">
                  <Icon name="allman.kalender" className="text-slate-400" />
                  Besök {b.datum}
                </span>
                <span className="text-xs text-slate-400">+ {kr(b.belopp)} på ärendet</span>
                <span className="ml-auto">
                  {sista ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Icon name="allman.bock" className="text-[#20c58f]" />
                      Jobbet klart, ärendet avslutas
                    </span>
                  ) : (
                    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-200">
                      <span className="text-xs text-slate-500">Boka återbesök</span>
                      <input
                        type="checkbox"
                        checked={kryss.has(b.id)}
                        onChange={() => vaxla(b.id)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
                      />
                      Skapa delfaktura
                    </label>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Knapp primar onClick={() => setVisa(true)}>
          <Icon name="sok.faktura" />
          Visa fakturorna
        </Knapp>
        <Knapp onClick={() => { setKryss(new Set()); setVisa(false) }}>Börja om</Knapp>
      </div>

      {visa && (
        <div className="mt-3 space-y-2">
          <div className="space-y-1.5">
            {fakturor.map((f, i) => (
              <div key={i} className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className={`h-2 w-2 flex-none rounded-full ${f.slag === 'Delfaktura' ? 'bg-teal-400' : 'bg-[#20c58f]'}`} aria-hidden />
                    {f.slag} {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-[#20c58f]">{kr(f.besok.reduce((s, b) => s + b.belopp, 0))}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {f.besok.length === 1 ? 'Besöket' : `${f.besok.length} besök`}: {f.besok.map(b => b.datum).join(', ')}
                </p>
              </div>
            ))}
          </div>

          {ratt ? (
            <Aterkoppling ok titel="Rätt, en faktura per månad">
              Du kryssade bara i på oktobers sista besök. Delfakturan tog med allt som samlats sedan ärendet startade, alltså alla tre besöken i oktober. Novembers besök blev kvar på ärendet och kom med på slutfakturan när ärendet avslutades.
            </Aterkoppling>
          ) : blandar ? (
            <Aterkoppling ok={false} titel="En faktura blandar oktober och november">
              Raderna ligger kvar tills någon kryssar i Skapa delfaktura. Kryssa i på månadens sista besök, så stannar fakturan vid månadsskiftet.
            </Aterkoppling>
          ) : (
            <Aterkoppling ok={false} titel="En månad blev uppdelad på flera fakturor">
              Varje kryss blir en egen faktura. Låt besöken mitt i månaden vara utan kryss och kryssa bara i på månadens sista besök. Det sista besöket i november behöver inget kryss: det som är kvar blir slutfakturan när ärendet avslutas.
            </Aterkoppling>
          )}
        </div>
      )}
    </Ram>
  )
}

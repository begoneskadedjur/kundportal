// Kundens val på sajten mot tjänsten som bokades i ärendet, som matris: en rad per val, en kolumn
// per bokad tjänst, cellens ton efter andel av raden. Visar till exempel hur ofta Vet inte blev möss.
// Bara förfrågningar med ett skapat ärende räknas.

import { useMemo } from 'react'
import type { StatRad } from '../../../../services/webLeadStatistikService'
import { tjanstLabel } from '../../../../types/webInquiry'
import { tal } from '../../marknad/marknadFormat'
import { TjanstIcon } from '../WebLeadIcons'
import { andelText, tjanstIkon } from './statistikData'

interface Rad {
  val: string
  nyckel: string
  totalt: number
  celler: Map<string, number>
}

const MAX_KOLUMNER = 10

export default function StatistikMatris({ rader }: { rader: StatRad[] }) {
  const { lista, kolumner, total } = useMemo(() => {
    const m = new Map<string, Rad>()
    const kol = new Map<string, number>()
    for (const r of rader) {
      if (r.g !== 'matris') continue
      const i = r.k.indexOf('|')
      const pest = r.k.slice(0, i)
      const bokad = r.k.slice(i + 1)
      const val = tjanstLabel(pest || null)
      const rad = m.get(val) ?? { val, nyckel: pest, totalt: 0, celler: new Map<string, number>() }
      rad.totalt += r.n
      rad.celler.set(bokad, (rad.celler.get(bokad) ?? 0) + r.n)
      m.set(val, rad)
      kol.set(bokad, (kol.get(bokad) ?? 0) + r.n)
    }
    const sorterade = [...kol.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv')).map(([k]) => k)
    const synliga = sorterade.slice(0, MAX_KOLUMNER)
    const resten = new Set(sorterade.slice(MAX_KOLUMNER))
    const lista = [...m.values()]
      .map((r) => {
        if (!resten.size) return r
        const celler = new Map<string, number>()
        let ovr = 0
        for (const [k, n] of r.celler) {
          if (resten.has(k)) ovr += n
          else celler.set(k, n)
        }
        if (ovr) celler.set('Övriga', ovr)
        return { ...r, celler }
      })
      .sort((a, b) => b.totalt - a.totalt || a.val.localeCompare(b.val, 'sv'))
    return {
      lista,
      kolumner: resten.size ? [...synliga, 'Övriga'] : synliga,
      total: [...kol.values()].reduce((a, b) => a + b, 0),
    }
  }, [rader])

  if (!total) {
    return (
      <p className="py-4 text-sm text-slate-500">
        Inga bokade förfrågningar under perioden. Matrisen fylls när ett ärende skapas från en förfrågan och visar då om tjänsten
        kunden valde på sajten stämde med den som bokades.
      </p>
    )
  }

  const traff = lista.reduce((s, r) => s + (r.celler.get(r.val) ?? 0), 0)

  return (
    <div>
      <p className="text-xs text-slate-400 mb-3">
        {tal(total)} bokade förfrågningar. {andelText(traff, total)} bokades som samma tjänst som kunden valde.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr className="text-xs text-slate-400">
              <th scope="col" className="text-left font-medium px-2 pb-1 align-bottom">
                Kundens val
              </th>
              {kolumner.map((k) => (
                <th key={k} scope="col" className="font-medium px-1 pb-1 align-bottom text-center min-w-[64px]">
                  <span className="block leading-tight">{k}</span>
                </th>
              ))}
              <th scope="col" className="font-medium px-2 pb-1 align-bottom text-right">
                Bokade
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.val}>
                <th scope="row" className="text-left font-normal px-2 py-1 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 text-slate-200">
                    <TjanstIcon name={tjanstIkon(r.nyckel)} className="w-4 h-4 text-slate-400" />
                    {r.val}
                  </span>
                </th>
                {kolumner.map((k) => {
                  const n = r.celler.get(k) ?? 0
                  const andel = r.totalt ? n / r.totalt : 0
                  const samma = k === r.val
                  return (
                    <td
                      key={k}
                      title={n ? `${r.val} bokades som ${k}: ${tal(n)} av ${tal(r.totalt)} (${andelText(n, r.totalt)})` : undefined}
                      className={`text-center rounded-[4px] py-1.5 tabular-nums ${n ? 'text-white' : 'text-slate-600 bg-slate-700/15'} ${
                        samma && n ? 'ring-1 ring-inset ring-[#20c58f]/70' : ''
                      }`}
                      style={n ? { backgroundColor: `rgba(32, 197, 143, ${0.14 + 0.6 * andel})` } : undefined}
                    >
                      {n ? (
                        <>
                          {tal(n)}
                          <span className="block text-[10px] leading-none text-slate-300">{andelText(n, r.totalt)}</span>
                        </>
                      ) : (
                        '·'
                      )}
                    </td>
                  )
                })}
                <td className="text-right px-2 text-white font-medium tabular-nums">{tal(r.totalt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">Ton efter andel av raden. Inramad cell: samma tjänst som kunden valde.</p>
    </div>
  )
}

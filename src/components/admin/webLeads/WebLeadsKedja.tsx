// src/components/admin/webLeads/WebLeadsKedja.tsx
// Statistik i Leads (Webb): kedjan förfrågan, bokad, vunnen, förlorad efter bokning och förlorad
// utan bokning, grupperad per tjänst, källa, kundgrupp, vecka, kampanj eller sökord.
// Bokad = ett ärende har skapats eller kopplats (bokad_at), oavsett vad som hänt sedan.
// Gäller bara nyförsäljning: förfrågningar med status Befintlig kund filtreras bort i WebLeadsStats.

import { useMemo, useState } from 'react'
import { KUNDGRUPP_LABEL, kallaLabel, tjanstLabel, type WebInquiry } from '../../../types/webInquiry'
import { isoVecka, svDatum } from './format'

type Dimension = 'tjanst' | 'kalla' | 'kundgrupp' | 'vecka' | 'kampanj' | 'sokord'

const DIMENSIONER: { id: Dimension; label: string; nyckel: (i: WebInquiry) => string }[] = [
  { id: 'tjanst', label: 'Tjänst', nyckel: (i) => tjanstLabel(i.pest_type) },
  { id: 'kalla', label: 'Källa', nyckel: (i) => kallaLabel(i) },
  { id: 'kundgrupp', label: 'Kundgrupp', nyckel: (i) => KUNDGRUPP_LABEL[i.kundgrupp] },
  { id: 'vecka', label: 'Vecka', nyckel: (i) => isoVecka(svDatum(i.created_at)) },
  { id: 'kampanj', label: 'Kampanj', nyckel: (i) => i.utm_campaign || (i.gclid ? 'Google Ads, okänd kampanj' : 'Ingen kampanj') },
  { id: 'sokord', label: 'Sökord', nyckel: (i) => i.utm_term || 'Inget sökord' },
]

interface Rad {
  namn: string
  forfragningar: number
  bokade: number
  vunna: number
  forloradeEfterBokning: number
  forloradeUtanBokning: number
  pagaende: number
}

function tomRad(namn: string): Rad {
  return { namn, forfragningar: 0, bokade: 0, vunna: 0, forloradeEfterBokning: 0, forloradeUtanBokning: 0, pagaende: 0 }
}

function lagg(rad: Rad, i: WebInquiry) {
  rad.forfragningar += 1
  if (i.bokad_at) rad.bokade += 1
  if (i.status === 'vunnen') rad.vunna += 1
  if (i.status === 'forlorad' && i.bokad_at) rad.forloradeEfterBokning += 1
  if (i.status === 'forlorad' && !i.bokad_at) rad.forloradeUtanBokning += 1
  if (i.status === 'bokad') rad.pagaende += 1
}

function procent(del: number, hel: number): string {
  if (!hel) return ''
  return `${Math.round((del / hel) * 100)} %`
}

export default function WebLeadsKedja({ urval }: { urval: WebInquiry[] }) {
  const [dim, setDim] = useState<Dimension>('tjanst')

  const { rader, summa } = useMemo(() => {
    const def = DIMENSIONER.find((d) => d.id === dim) ?? DIMENSIONER[0]
    const m = new Map<string, Rad>()
    const total = tomRad('Totalt')
    for (const i of urval) {
      const k = def.nyckel(i)
      const rad = m.get(k) ?? tomRad(k)
      lagg(rad, i)
      lagg(total, i)
      m.set(k, rad)
    }
    const lista = [...m.values()].sort((a, b) =>
      dim === 'vecka' ? b.namn.localeCompare(a.namn) : b.forfragningar - a.forfragningar || a.namn.localeCompare(b.namn, 'sv'),
    )
    return { rader: lista, summa: total }
  }, [urval, dim])

  const cell = 'px-3 py-2 text-right font-mono whitespace-nowrap'

  const radCeller = (r: Rad) => (
    <>
      <td className={`${cell} text-white`}>{r.forfragningar}</td>
      <td className={`${cell} text-slate-300`}>
        {r.bokade}
        <span className="block text-xs text-slate-500">{procent(r.bokade, r.forfragningar)}</span>
      </td>
      <td className={`${cell} text-[#20c58f]`}>
        {r.vunna}
        <span className="block text-xs text-slate-500">{procent(r.vunna, r.bokade)}</span>
      </td>
      <td className={`${cell} text-slate-300`}>
        {r.forloradeEfterBokning}
        <span className="block text-xs text-slate-500">{procent(r.forloradeEfterBokning, r.bokade)}</span>
      </td>
      <td className={`${cell} text-slate-400`}>{r.forloradeUtanBokning}</td>
      <td className={`${cell} text-slate-400`}>{r.pagaende}</td>
    </>
  )

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-white">Från förfrågan till affär</h3>
        <div className="flex flex-wrap border-b border-slate-700/50">
          {DIMENSIONER.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDim(d.id)}
              className={`px-3 py-1.5 text-sm -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                dim === d.id ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      {rader.length === 0 ? (
        <p className="text-sm text-slate-500">Inga förfrågningar i perioden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2 font-medium text-left">{DIMENSIONER.find((d) => d.id === dim)?.label}</th>
                <th className="px-3 py-2 font-medium text-right">Förfrågningar</th>
                <th className="px-3 py-2 font-medium text-right">Bokade</th>
                <th className="px-3 py-2 font-medium text-right">Vunna</th>
                <th className="px-3 py-2 font-medium text-right">Förlorade efter bokning</th>
                <th className="px-3 py-2 font-medium text-right">Förlorade utan bokning</th>
                <th className="px-3 py-2 font-medium text-right">Väntar på utfall</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((r) => (
                <tr key={r.namn} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 text-slate-300 break-all">{r.namn}</td>
                  {radCeller(r)}
                </tr>
              ))}
              <tr className="border-t border-slate-600">
                <td className="px-3 py-2 text-white font-medium">{summa.namn}</td>
                {radCeller(summa)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-2">
        Andelen under Bokade räknas på förfrågningarna, andelarna under Vunna och Förlorade efter bokning på de bokade.
      </p>
    </div>
  )
}

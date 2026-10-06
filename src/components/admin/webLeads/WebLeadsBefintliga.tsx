// src/components/admin/webLeads/WebLeadsBefintliga.tsx
// Statistik i Leads (Webb): förfrågningar från befintliga avtalskunder (status Befintlig kund),
// skilda från nyförsäljningen. Antal per vecka, tjänst och källa och hur många av deras ärenden
// (avtalsärende, stationskontroll eller etablering) som genomförts, det vill säga har status Avslutat.

import { useEffect, useMemo, useState } from 'react'
import { WebInquiryService } from '../../../services/webInquiryService'
import { kallaLabel, tjanstLabel, type WebInquiry } from '../../../types/webInquiry'
import { isoVecka, svDatum } from './format'

type Dimension = 'vecka' | 'tjanst' | 'kalla'

const DIMENSIONER: { id: Dimension; label: string; nyckel: (i: WebInquiry) => string }[] = [
  { id: 'vecka', label: 'Vecka', nyckel: (i) => isoVecka(svDatum(i.created_at)) },
  { id: 'tjanst', label: 'Tjänst', nyckel: (i) => tjanstLabel(i.pest_type) },
  { id: 'kalla', label: 'Källa', nyckel: (i) => kallaLabel(i) },
]

const GENOMFORD = 'Avslutat'

export default function WebLeadsBefintliga({ befintliga }: { befintliga: WebInquiry[] }) {
  const [dim, setDim] = useState<Dimension>('vecka')
  const [statusar, setStatusar] = useState<Record<string, string> | null>(null)

  const ids = useMemo(
    () => befintliga.filter((i) => i.arende_tabell === 'cases' && i.arende_id).map((i) => i.arende_id as string).sort(),
    [befintliga],
  )
  const idNyckel = ids.join(',')

  useEffect(() => {
    let avbruten = false
    if (!ids.length) {
      setStatusar({})
      return
    }
    setStatusar(null)
    WebInquiryService.contractCaseStatuses(ids)
      .then((s) => {
        if (!avbruten) setStatusar(s)
      })
      .catch(() => {
        if (!avbruten) setStatusar({})
      })
    return () => {
      avbruten = true
    }
    // idNyckel bär samma innehåll som ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNyckel])

  const genomford = (i: WebInquiry) => !!statusar && !!i.arende_id && statusar[i.arende_id] === GENOMFORD

  const rader = useMemo(() => {
    const def = DIMENSIONER.find((d) => d.id === dim) ?? DIMENSIONER[0]
    const m = new Map<string, { namn: string; antal: number; genomforda: number }>()
    for (const i of befintliga) {
      const k = def.nyckel(i)
      const rad = m.get(k) ?? { namn: k, antal: 0, genomforda: 0 }
      rad.antal += 1
      if (genomford(i)) rad.genomforda += 1
      m.set(k, rad)
    }
    return [...m.values()].sort((a, b) =>
      dim === 'vecka' ? b.namn.localeCompare(a.namn) : b.antal - a.antal || a.namn.localeCompare(b.namn, 'sv'),
    )
    // genomford läser statusar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [befintliga, dim, statusar])

  const totalGenomforda = befintliga.filter(genomford).length

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Befintliga avtalskunder</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {befintliga.length} förfrågningar, {statusar ? `${totalGenomforda} ärenden genomförda` : 'hämtar ärendenas status...'}
          </p>
        </div>
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
      {befintliga.length === 0 ? (
        <p className="text-sm text-slate-500">Inga förfrågningar från befintliga avtalskunder i perioden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2 font-medium text-left">{DIMENSIONER.find((d) => d.id === dim)?.label}</th>
                <th className="px-3 py-2 font-medium text-right">Förfrågningar</th>
                <th className="px-3 py-2 font-medium text-right">Genomförda ärenden</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((r) => (
                <tr key={r.namn} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 text-slate-300 break-all">{r.namn}</td>
                  <td className="px-3 py-2 text-right font-mono text-white">{r.antal}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{statusar ? r.genomforda : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-2">
        Förfrågningar där ett avtalsärende, en stationskontroll eller en etablering skapats eller kopplats för en befintlig
        avtalskund. De räknas inte som nyförsäljning och ingår inte i kedjan ovan. Genomförd betyder att ärendet är avslutat.
      </p>
    </div>
  )
}

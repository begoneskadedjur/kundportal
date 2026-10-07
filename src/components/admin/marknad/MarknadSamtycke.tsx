// Cookiesamtycke från begone.se (tabellen cookie_consents) i samma uppställning som CookieYes:
// cirkel godkänt/nekat/delvis för de senaste 7 eller 30 dagarna och logg över de senaste 50 valen.
// Ingen IP-adress sparas; samtyckes-id är ett anonymt slumpat id per webbläsare.

import { useEffect, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { marknadService, type MarknadSamtycke } from '../../../services/marknadService'
import { datumNyckel, datumTid, kvot, plusDagar, procent, tal } from './marknadFormat'
import { useDiagramFarger } from './useDiagramFarger'
import { Punkt, Tomt } from './MarknadUi'

type Spann = '7' | '30' | 'period'

const HANDELSE: Record<string, string> = { first_choice: 'Första val', changed: 'Ändrat', withdrawn: 'Återkallat' }
const STATUS: Record<string, { text: string; farg: string }> = {
  accepted: { text: 'Godkänt', farg: 'bg-[#20c58f]' },
  rejected: { text: 'Nekat', farg: 'bg-red-400' },
  partial: { text: 'Delvis', farg: 'bg-amber-400' },
}

export function SamtyckeSektion({ fran, till }: { fran: string; till: string }) {
  const [spann, setSpann] = useState<Spann>('7')
  const [data, setData] = useState<MarknadSamtycke | null>(null)
  const [fel, setFel] = useState<string | null>(null)
  const f = useDiagramFarger()

  useEffect(() => {
    let aktiv = true
    // Samtycken räknas till och med i dag (de loggas direkt, till skillnad från Ads)
    const idag = datumNyckel(new Date())
    const p = spann === 'period' ? { fran, till } : { fran: plusDagar(idag, -(Number(spann) - 1)), till: idag }
    marknadService
      .samtycke(p.fran, p.till)
      .then((d) => {
        if (!aktiv) return
        setData(d)
        setFel(null)
      })
      .catch((e: Error) => {
        if (aktiv) setFel(e.message)
      })
    return () => {
      aktiv = false
    }
  }, [spann, fran, till])

  const delar = data
    ? [
        { namn: 'Godkänt', antal: data.godkant, farg: f.brand },
        { namn: 'Nekat', antal: data.nekat, farg: f.rod },
        { namn: 'Delvis', antal: data.delvis, farg: f.gul },
      ]
    : []

  return (
    <div>
      <div role="tablist" aria-label="Period för samtycken" className="flex gap-4 border-b border-slate-700 mb-4 text-sm">
        {(
          [
            ['7', 'Senaste 7 dagarna'],
            ['30', 'Senaste 30 dagarna'],
            ['period', 'Vald period'],
          ] as Array<[Spann, string]>
        ).map(([v, t]) => (
          <button
            key={v}
            role="tab"
            aria-selected={spann === v}
            onClick={() => setSpann(v)}
            className={`pb-2 -mb-px border-b-2 ${spann === v ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {fel && <p className="text-sm text-red-400">{fel}</p>}
      {data && !data.totalt && <Tomt>Inga samtyckesval under perioden.</Tomt>}
      {data && data.totalt > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={delar} dataKey="antal" nameKey="namn" innerRadius={58} outerRadius={84} paddingAngle={1} stroke={f.yta} strokeWidth={2} isAnimationActive={false}>
                    {delar.map((d) => (
                      <Cell key={d.namn} fill={d.farg} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white shadow-lg">
                          {String(payload[0]!.name)}: {tal(Number(payload[0]!.value))} ({procent(kvot(Number(payload[0]!.value), data.totalt), 0)})
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-semibold text-white tabular-nums">{tal(data.totalt)}</span>
                <span className="text-xs text-slate-400">samtyckesval</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {delar.map((d) => (
                <li key={d.namn} className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.farg }} aria-hidden="true" />
                  <span className="text-slate-300">{d.namn}</span>
                  <span className="ml-auto tabular-nums text-white">{tal(d.antal)}</span>
                  <span className="w-12 text-right tabular-nums text-slate-400">{procent(kvot(d.antal, data.totalt), 0)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              {tal(data.unika)} unika besökare (samtyckes-id).{' '}
              {data.per_land.length > 0 && `Land: ${data.per_land.slice(0, 4).map((l) => `${l.land} ${tal(l.antal)}`).join(', ')}.`}
            </p>
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-medium text-slate-300 mb-2">Samtyckeslogg, senaste {Math.min(50, data.senaste.length)}</h3>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-xs text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-800">
                  <tr>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Tid</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Samtyckes-id</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Land</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Status</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Händelse</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Kategorier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {data.senaste.map((r, i) => {
                    const st = STATUS[r.status] ?? { text: r.status, farg: 'bg-slate-500' }
                    const kat = [r.statistik && 'statistik', r.marknadsforing && 'marknadsföring'].filter(Boolean).join(', ')
                    return (
                      <tr key={`${r.samtyckes_id}-${r.tid}-${i}`}>
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap text-slate-300">{datumTid(r.tid)}</td>
                        <td className="px-2 py-1.5 font-mono text-xs text-slate-400" title={r.samtyckes_id}>{r.samtyckes_id.slice(0, 8)}</td>
                        <td className="px-2 py-1.5 text-slate-300">{r.land ?? '–'}</td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1.5 text-slate-200"><Punkt farg={st.farg} />{st.text}</span>
                        </td>
                        <td className="px-2 py-1.5 text-slate-300">{HANDELSE[r.action] ?? r.action}</td>
                        <td className="px-2 py-1.5 text-xs text-slate-400">{kat ? `nödvändiga, ${kat}` : 'bara nödvändiga'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

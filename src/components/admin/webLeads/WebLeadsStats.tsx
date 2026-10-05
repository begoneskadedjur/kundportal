// src/components/admin/webLeads/WebLeadsStats.tsx
// Fliken Statistik i Leads (Webb): efterfrågan per ISO-vecka (staplat per kundgrupp), per tjänst,
// per källa och sida, andel med kontakt samma dag och andel vunna. Aggregeras i klienten på periodens
// rader (cirka 70 till 80 förfrågningar i månaden).

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { KUNDGRUPP_LABEL, kallaLabel, tjanstLabel, type WebInquiry, type WebInquiryKundgrupp } from '../../../types/webInquiry'
import { isoVecka, svDatum } from './format'

const PERIODER = [
  { dagar: 30, label: '30 dagar' },
  { dagar: 90, label: '90 dagar' },
  { dagar: 365, label: '12 månader' },
]

const KUNDGRUPP_FARG: Record<WebInquiryKundgrupp, string> = {
  privat: '#20c58f',
  brf_fastighet: '#38bdf8',
  verksamhet: '#a78bfa',
}

const AXEL = { fill: '#94a3b8', fontSize: 12 }
const TOOLTIP = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#e2e8f0' },
}

function andel(del: number, hel: number): string {
  if (!hel) return '0 %'
  return `${Math.round((del / hel) * 100)} %`
}

function Topplista({ titel, rader }: { titel: string; rader: [string, number][] }) {
  const max = rader[0]?.[1] ?? 0
  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-3">{titel}</h3>
      {rader.length === 0 ? (
        <p className="text-sm text-slate-500">Inga förfrågningar i perioden.</p>
      ) : (
        <ul className="space-y-1.5">
          {rader.slice(0, 12).map(([namn, antal]) => (
            <li key={namn} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-300 truncate">{namn}</span>
                <span className="text-white font-mono">{antal}</span>
              </div>
              <div className="h-1 mt-1 bg-slate-800 rounded">
                <div className="h-1 bg-[#20c58f] rounded" style={{ width: `${max ? (antal / max) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function rakna(lista: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const k of lista) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
}

export default function WebLeadsStats({ inquiries }: { inquiries: WebInquiry[] }) {
  const [dagar, setDagar] = useState(90)

  const urval = useMemo(() => {
    const gans = Date.now() - dagar * 86400000
    return inquiries.filter((i) => new Date(i.created_at).getTime() >= gans && i.status !== 'skrap')
  }, [inquiries, dagar])

  const perVecka = useMemo(() => {
    const m = new Map<string, Record<WebInquiryKundgrupp, number>>()
    for (const i of urval) {
      const v = isoVecka(svDatum(i.created_at))
      const rad = m.get(v) ?? { privat: 0, brf_fastighet: 0, verksamhet: 0 }
      rad[i.kundgrupp] += 1
      m.set(v, rad)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([vecka, r]) => ({ vecka: vecka.slice(5), ...r }))
  }, [urval])

  const nyckeltal = useMemo(() => {
    const kontaktSammaDag = urval.filter(
      (i) => i.forsta_kontakt_at && svDatum(i.forsta_kontakt_at) === svDatum(i.created_at),
    ).length
    const avgjorda = urval.filter((i) => i.status === 'vunnen' || i.status === 'forlorad').length
    const vunna = urval.filter((i) => i.status === 'vunnen').length
    return {
      totalt: urval.length,
      akuta: urval.filter((i) => i.akut).length,
      kontaktSammaDag: andel(kontaktSammaDag, urval.length),
      vunna: andel(vunna, urval.length),
      vunnaAvAvgjorda: andel(vunna, avgjorda),
    }
  }, [urval])

  const perTjanst = useMemo(() => rakna(urval.map((i) => tjanstLabel(i.pest_type))), [urval])
  const perKalla = useMemo(() => rakna(urval.map((i) => kallaLabel(i))), [urval])
  const perSida = useMemo(() => rakna(urval.map((i) => i.sida || 'Okänd')), [urval])

  return (
    <div className="space-y-4">
      <div className="flex border-b border-slate-700/50">
        {PERIODER.map((p) => (
          <button
            key={p.dagar}
            type="button"
            onClick={() => setDagar(p.dagar)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              dagar === p.dagar ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Förfrågningar', varde: String(nyckeltal.totalt) },
          { label: 'Varav akuta', varde: String(nyckeltal.akuta) },
          { label: 'Kontakt samma dag', varde: nyckeltal.kontaktSammaDag },
          { label: 'Vunna av alla', varde: nyckeltal.vunna },
          { label: 'Vunna av avgjorda', varde: nyckeltal.vunnaAvAvgjorda },
        ].map((k) => (
          <div key={k.label} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className="text-xl font-semibold text-white font-mono mt-0.5">{k.varde}</p>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <h3 className="text-sm font-semibold text-white mb-3">Förfrågningar per vecka</h3>
        {perVecka.length === 0 ? (
          <p className="text-sm text-slate-500">Inga förfrågningar i perioden.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perVecka} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="vecka" tick={AXEL} stroke="#334155" />
                <YAxis allowDecimals={false} tick={AXEL} stroke="#334155" />
                <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {(Object.keys(KUNDGRUPP_LABEL) as WebInquiryKundgrupp[]).map((k) => (
                  <Bar key={k} dataKey={k} name={KUNDGRUPP_LABEL[k]} stackId="a" fill={KUNDGRUPP_FARG[k]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Topplista titel="Per tjänst" rader={perTjanst} />
        <Topplista titel="Per källa" rader={perKalla} />
        <Topplista titel="Per sida" rader={perSida} />
      </div>
      <p className="text-xs text-slate-500">Förfrågningar markerade som skräp räknas inte. Veckor enligt ISO, måndag först, i svensk tid.</p>
    </div>
  )
}

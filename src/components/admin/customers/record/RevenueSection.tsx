// src/components/admin/customers/record/RevenueSection.tsx
//
// Intäktsfliken: vad kunden faktiskt betalat oss, uppdelat på intäktsslag.
//
// Källan är INVOICES, aldrig case_billing_items. Underlagsraderna innehåller
// 233 offertutkast utan verkligt ärende (~5 Mkr) som ser ut som intäkter men
// aldrig fakturerats — summeras de rakt av visar Maserfrakt en kvartsmiljon i
// merförsäljning som inte finns.
//
// Uppdelningen speglar hur verksamheten tänker:
//   Avtalsintäkt   årspremien — den förutsägbara basen (invoice_type='contract')
//   Merförsäljning arbete utanför avtalet, mätt PER KUND (adhoc/case/private)
//   Avtalstillägg  höjer premien framåt — eget block, aldrig hopsummerat
//
// Alla belopp ex moms (subtotal).

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  customerRowName,
  formatDateSv,
  formatKr,
  type RecordAddition,
  type RecordCase,
  type RecordCustomer,
  type RecordInvoice,
} from '../../../../hooks/useCustomerRecord'
import { buildRevenueEntries, sumPipeline, sumRevenue } from '../../../../utils/customerRevenue'

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  invoices: RecordInvoice[]
  additions: RecordAddition[]
  /** Ärenden — historiska företagsärenden är intäkt som aldrig fakturerats i portalen */
  cases: RecordCase[]
}

const SLAG = [
  { id: 'contract', label: 'Avtalsintäkt', hint: 'årspremie', dot: 'bg-[#20c58f]' },
  { id: 'extra', label: 'Merförsäljning', hint: 'arbete utanför avtalet', dot: 'bg-[#20c58f]/50' },
] as const

export default function RevenueSection({ root, units, invoices, additions, cases }: Props) {
  const [showHistorical, setShowHistorical] = useState(true)

  const model = useMemo(() => {
    // Båda världarna i en ström: portalens fakturor, Fortnox-importen och
    // ClickUp-erans utförda ärenden. De överlappar aldrig.
    const all = buildRevenueEntries(invoices, cases, root.id)
    const entries = showHistorical ? all : all.filter((e) => !e.historical)
    const totals = sumRevenue(entries)
    const pipeline = sumPipeline(cases)

    // Per år — bara år med data. Ett enda år ger ingen kurva värd namnet.
    const yearMap = new Map<string, { year: string; avtal: number; mer: number }>()
    for (const e of entries) {
      const y = (e.date ?? '').slice(0, 4)
      if (!y) continue
      const row = yearMap.get(y) ?? { year: y, avtal: 0, mer: 0 }
      if (e.kind === 'contract') row.avtal += e.amount
      else row.mer += e.amount
      yearMap.set(y, row)
    }
    const perYear = Array.from(yearMap.values()).sort((a, b) => a.year.localeCompare(b.year))

    // Per enhet — bara meningsfullt för multisite
    const nameById = new Map([root, ...units].map((c) => [c.id, customerRowName(c)]))
    const unitMap = new Map<string, number>()
    for (const e of entries) {
      unitMap.set(e.customerId, (unitMap.get(e.customerId) ?? 0) + e.amount)
    }
    const perUnit = Array.from(unitMap.entries())
      .map(([id, value]) => ({ id, name: nameById.get(id) ?? 'Okänd', value }))
      .sort((a, b) => b.value - a.value)

    return {
      total: totals.total,
      contractSum: totals.contract,
      extraSum: totals.extra,
      historicalSum: totals.historical,
      count: totals.count,
      perYear,
      perUnit,
      pipeline,
      fromCases: entries.filter((e) => e.source === 'case').length,
    }
  }, [invoices, cases, showHistorical, root, units])

  const pct = (v: number) => (model.total > 0 ? Math.round((v / model.total) * 100) : 0)

  if (model.count === 0 && model.pipeline.count === 0) {
    return <p className="text-sm text-slate-500">Inga intäkter registrerade för kunden.</p>
  }

  return (
    <div className="space-y-5">
      {/* Totalsumma och fördelning */}
      <section className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-baseline justify-between gap-4 pb-3 mb-3 border-b border-slate-700/60">
          <div>
            <span className="text-xs uppercase tracking-wide text-slate-500">Total intäkt</span>
            <span className="block text-[11px] text-slate-600 mt-0.5">
              {model.count} fakturor · exklusive moms
            </span>
          </div>
          <span className="text-2xl font-semibold text-[#20c58f] tabular-nums">{formatKr(model.total)}</span>
        </div>

        {/* Proportionsstapel — ingen chartlib behövs för två segment */}
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-800 mb-3">
          <div className="bg-[#20c58f]" style={{ width: `${pct(model.contractSum)}%` }} />
          <div className="bg-[#20c58f]/50" style={{ width: `${pct(model.extraSum)}%` }} />
        </div>

        <dl className="space-y-1.5">
          {SLAG.map((s) => {
            const value = s.id === 'contract' ? model.contractSum : model.extraSum
            return (
              <div key={s.id} className="flex items-baseline gap-2 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} aria-hidden />
                <dt className="text-slate-300">
                  {s.label} <span className="text-slate-600 text-xs">{s.hint}</span>
                </dt>
                <dd className="ml-auto flex items-baseline gap-3 tabular-nums shrink-0">
                  <span className="text-xs text-slate-500 w-12 text-right">{pct(value)} %</span>
                  <span className="text-slate-100 w-28 text-right">{formatKr(value)}</span>
                </dd>
              </div>
            )
          })}
        </dl>

        {model.historicalSum > 0 && (
          <label className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/60 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showHistorical}
              onChange={(e) => setShowHistorical(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
            />
            Inkludera historik
            <span className="text-slate-600 tabular-nums">({formatKr(model.historicalSum)})</span>
            {model.fromCases > 0 && (
              <span className="text-slate-600">
                · varav {model.fromCases} ärende{model.fromCases === 1 ? '' : 'n'} före portalen
              </span>
            )}
          </label>
        )}
      </section>

      {/* Sålt men inte utfört — pipeline, aldrig intäkt. Hålls medvetet
          utanför totalen: offerter och bokningar är inte levererat arbete. */}
      {model.pipeline.count > 0 && (
        <section className="p-3 bg-slate-800/20 border border-slate-700/60 rounded-xl">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Sålt, ej utfört</span>
            <span className="text-xs text-slate-600">
              {model.pipeline.count} ärende{model.pipeline.count === 1 ? '' : 'n'}
            </span>
            <span className="ml-auto text-sm text-slate-300 tabular-nums">
              {formatKr(model.pipeline.amount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Bokade besök och signerade offerter. Räknas som intäkt först när arbetet är utfört.
          </p>
        </section>
      )}

      {/* Utveckling per år — bara när det finns mer än ett år att jämföra */}
      {model.perYear.length > 1 && (
        <section className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3">Utveckling per år</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={model.perYear} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000).toLocaleString('sv-SE')}k`}
                width={48}
              />
              <Tooltip
                cursor={{ fill: '#1e293b66' }}
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number, name: string) => [formatKr(v), name]}
              />
              <Bar dataKey="avtal" name="Avtalsintäkt" stackId="a" fill="#20c58f" />
              <Bar dataKey="mer" name="Merförsäljning" stackId="a" fill="#20c58f" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="w-full mt-3 text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left font-medium py-1.5">År</th>
                <th className="text-right font-medium py-1.5">Avtal</th>
                <th className="text-right font-medium py-1.5">Merförsäljning</th>
                <th className="text-right font-medium py-1.5">Totalt</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...model.perYear].reverse().map((r) => (
                <tr key={r.year} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-1.5 text-slate-300">{r.year}</td>
                  <td className="py-1.5 text-right text-slate-400">{formatKr(r.avtal)}</td>
                  <td className="py-1.5 text-right text-slate-400">{formatKr(r.mer)}</td>
                  <td className="py-1.5 text-right text-slate-200">{formatKr(r.avtal + r.mer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Per enhet — bara för multisite */}
      {units.length > 0 && model.perUnit.length > 1 && (
        <section className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3">Per enhet</h3>
          <ul className="space-y-2">
            {model.perUnit.map((u) => (
              <li key={u.id}>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-slate-300 truncate">{u.name}</span>
                  <span className="ml-auto text-slate-200 tabular-nums shrink-0">{formatKr(u.value)}</span>
                </div>
                <div className="h-1 mt-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#20c58f]/60"
                    style={{ width: `${model.total > 0 ? (u.value / model.total) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Avtalstillägg — eget block. Pro rata-delen ingår redan i
          merförsäljningen ovan och får aldrig summeras dit igen. */}
      {additions.length > 0 && (
        <section className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3">Avtalstillägg</h3>
          <ul className="space-y-2">
            {additions.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 text-sm">
                <span className="text-xs text-slate-500 tabular-nums w-[76px] shrink-0">
                  {formatDateSv(a.effective_from)}
                </span>
                <span className="text-slate-300 truncate min-w-0 flex-1">
                  {a.description ?? 'Avtalstillägg'}
                </span>
                {a.prorated_amount != null && Number(a.prorated_amount) > 0 && (
                  <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    pro rata {formatKr(Number(a.prorated_amount))}
                  </span>
                )}
                <span className="text-slate-200 tabular-nums shrink-0">
                  +{formatKr(Number(a.annual_amount ?? 0))}/år
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Pro rata-beloppet ingår redan i merförsäljningen ovan. Årsbeloppet höjer premien från
            och med angivet datum och syns i kommande avtalsintäkter.
          </p>
        </section>
      )}
    </div>
  )
}

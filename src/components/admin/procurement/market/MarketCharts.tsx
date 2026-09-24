// src/components/admin/procurement/market/MarketCharts.tsx
// Marknadens storlek (avtalat tak och antal upphandlingar per år) och
// marknadsandel per leverantör och år. En färg per serie, fast per
// leverantör. Varje diagram har en tabell bredvid eller under så att värdena
// går att läsa utan färg.

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SERIES_COLORS, fmtKr, fmtKrShort, fmtNum, fmtPct, tableCls } from '../uiFormat'
import { ChartTooltipBox } from './shared'
import { AXIS_TICK, GRID_STROKE } from './format'
import { SUPPLIER_CLASSES, SUPPLIER_CLASS_COLOR, SUPPLIER_CLASS_LABEL, shareTotals, type YearMarket, type YearShare } from './marketStats'

interface TooltipProps<T> {
  active?: boolean
  payload?: Array<{ payload: T }>
}

function mkr(v: number): string {
  return v >= 1_000_000 ? `${fmtNum(v / 1_000_000, 0)} M` : v >= 1000 ? `${fmtNum(v / 1000, 0)} t` : fmtNum(v)
}

// ---------------------------------------------------------------------------

function ValueTooltip({ active, payload }: TooltipProps<YearMarket>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <ChartTooltipBox
      title={d.year}
      rows={[
        { label: 'Avtalat tak och priser', value: fmtKr(d.value), color: SERIES_COLORS[0] },
        { label: 'varav ramtak', value: fmtKrShort(d.ceilingValue) },
        { label: 'varav verkligt pris', value: fmtKrShort(d.actualValue) },
        { label: 'Med känt värde', value: `${d.valued} av ${d.procurements}` },
      ]}
    />
  )
}

function CountTooltip({ active, payload }: TooltipProps<YearMarket>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return <ChartTooltipBox title={d.year} rows={[{ label: 'Upphandlingar', value: fmtNum(d.procurements), color: SERIES_COLORS[1] }]} />
}

export function MarketSizeCharts({ rows }: { rows: YearMarket[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
      <div className="p-4">
        <div className="text-[11px] text-slate-500 mb-2">Avtalat tak per år (ramtak plus kända verkliga priser)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={mkr} />
            <Tooltip content={<ValueTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="value" fill={SERIES_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="p-4">
        <div className="text-[11px] text-slate-500 mb-2">Antal upphandlingar per år</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="procurements" fill={SERIES_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ShareTooltip({ active, payload }: TooltipProps<YearShare>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <ChartTooltipBox
      title={d.year}
      rows={SUPPLIER_CLASSES.map((c) => ({
        label: SUPPLIER_CLASS_LABEL[c],
        value: `${fmtKrShort(d[c])} · ${fmtPct(d.total ? d[c] / d.total : null)}`,
        color: SUPPLIER_CLASS_COLOR[c],
      }))}
    />
  )
}

/** Staplat per år i kronor, med andelstabell under */
export function MarketShareChart({ rows }: { rows: YearShare[] }) {
  const totals = shareTotals(rows)
  // Staplingsordning nerifrån: Anticimex, Nomor, BeGone, Övriga
  const order = SUPPLIER_CLASSES
  return (
    <div>
      <div className="p-4 pb-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[11px] text-slate-400">
          {order.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: SUPPLIER_CLASS_COLOR[c] }} />
              {SUPPLIER_CLASS_LABEL[c]}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={mkr} />
            <Tooltip content={<ShareTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            {order.map((c, i) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="share"
                fill={SUPPLIER_CLASS_COLOR[c]}
                radius={i === order.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto border-t border-slate-800">
        <table className={tableCls.table}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>År</th>
              {order.map((c) => (
                <th key={c} className={tableCls.thRight}>{SUPPLIER_CLASS_LABEL[c]}</th>
              ))}
              <th className={tableCls.thRight}>Summa per vinnare</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.year} className={tableCls.tr}>
                <td className={tableCls.td}>{r.year}</td>
                {order.map((c) => (
                  <td key={c} className={`${tableCls.tdRight} ${c === 'begone' && r.begone > 0 ? 'text-[#20c58f]' : ''}`}>
                    {fmtPct(r.total ? r[c] / r.total : null)}
                  </td>
                ))}
                <td className={tableCls.tdRight}>{fmtKrShort(r.total)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-700">
              <td className={`${tableCls.td} text-slate-200 font-medium`}>Alla år</td>
              {order.map((c) => (
                <td key={c} className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtPct(totals.total ? totals[c] / totals.total : null)}</td>
              ))}
              <td className={`${tableCls.tdRight} text-slate-200 font-medium`}>{fmtKrShort(totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

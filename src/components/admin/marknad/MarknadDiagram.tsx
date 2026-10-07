// Trend per dag: kostnad och konverteringar i två diagram (aldrig två y-axlar i samma diagram).
// Färger enligt dataviz-paletten: kostnad i brandfärgen (en serie), konverteringar i kategoriplats 1 och 2.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDiagramFarger } from './useDiagramFarger'
import type { MarknadDag } from '../../../services/marknadService'
import { kortDatum, kr, tal } from './marknadFormat'

function Tips({ active, payload, label, formatera }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; formatera: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-slate-300 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-white">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}</span>
          <span className="ml-auto tabular-nums">{formatera(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendDiagram({ dagar }: { dagar: MarknadDag[] }) {
  const f = useDiagramFarger()
  const data = dagar.map((d) => ({ ...d, etikett: kortDatum(d.datum) }))
  const axel = { fontSize: 11, fill: f.axel }
  const glesa = data.length > 45 ? Math.ceil(data.length / 12) - 1 : data.length > 16 ? 'preserveStartEnd' : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <figure className="min-w-0">
        <figcaption className="text-xs font-medium text-slate-300 mb-2">Kostnad per dag</figcaption>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke={f.rutnat} strokeDasharray="2 4" />
              <XAxis dataKey="etikett" tick={axel} tickLine={false} axisLine={{ stroke: f.rutnat }} interval={glesa as never} />
              <YAxis tick={axel} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => tal(v)} />
              <Tooltip cursor={{ fill: f.rutnat, opacity: 0.4 }} content={<Tips formatera={(n) => kr(n)} />} />
              <Bar dataKey="kostnad" name="Kostnad" fill={f.brand} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure className="min-w-0">
        <figcaption className="text-xs font-medium text-slate-300 mb-2">Konverteringar per dag (klickdag)</figcaption>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke={f.rutnat} strokeDasharray="2 4" />
              <XAxis dataKey="etikett" tick={axel} tickLine={false} axisLine={{ stroke: f.rutnat }} interval={glesa as never} />
              <YAxis tick={axel} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip cursor={{ fill: f.rutnat, opacity: 0.4 }} content={<Tips formatera={(n) => tal(n, n % 1 ? 1 : 0)} />} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="formular" name="Formulär" stackId="k" fill={f.serie1} stroke={f.yta} strokeWidth={1} maxBarSize={28} />
              <Bar dataKey="samtal" name="Samtal" stackId="k" fill={f.serie2} stroke={f.yta} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  )
}

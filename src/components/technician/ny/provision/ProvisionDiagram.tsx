// src/components/technician/ny/provision/ProvisionDiagram.tsx
// Stapeldiagram över 12 månader på provisionssidan i nya arbetsvyn.
//
// Enligt dataviz: en serie, ingen förklaringsruta (rubriken säger vad som visas),
// smala staplar (högst 24 px) med 4 px rundad topp, hårfint rutnät, vald månad i
// brandfärgen och övriga i dämpad grå, värdet bara på vald stapel, tooltip per
// stapel. Hela bandet är klickyta och väljer månaden. Listan under diagrammet är
// tabellvyn, så inget värde finns bara i diagrammet.

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NBSP, kr } from './provisionData'

export interface DiagramPunkt {
  nyckel: string
  /** Kort etikett på axeln, till exempel 'okt' */
  etikett: string
  /** Hel etikett i tooltip, till exempel 'Oktober 2026' */
  hel: string
  varde: number
}

interface Props {
  data: DiagramPunkt[]
  vald: string
  onValj: (nyckel: string) => void
  /** Beskrivning för skärmläsare */
  beskrivning: string
}

function axelKr(v: number): string {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tips({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as DiagramPunkt
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-white tabular-nums">{kr(p.varde)}</p>
      <p className="text-xs text-slate-400">{p.hel}</p>
    </div>
  )
}

export function ProvisionDiagram({ data, vald, onValj, beskrivning }: Props) {
  const valdIndex = data.findIndex(d => d.nyckel === vald)
  return (
    <div role="img" aria-label={beskrivning} className="h-44 w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 22, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="20%"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(s: any) => {
            const i = s?.activeTooltipIndex
            if (typeof i === 'number' && data[i]) onValj(data[i].nyckel)
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid vertical={false} stroke="#334155" strokeWidth={1} />
          <XAxis
            dataKey="etikett"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickCount={3}
            allowDecimals={false}
            tickFormatter={axelKr}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip content={<Tips />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} isAnimationActive={false} />
          <Bar dataKey="varde" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map(d => (
              <Cell
                key={d.nyckel}
                fill={d.nyckel === vald ? '#20c58f' : '#475569'}
                className={d.nyckel === vald ? '' : 'fill-slate-600'}
              />
            ))}
            <LabelList
              dataKey="varde"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={(p: any) => {
                if (p.index !== valdIndex || !p.value) return null
                const x = Number(p.x) + Number(p.width) / 2
                return (
                  <text x={x} y={Number(p.y) - 6} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-slate-200" fill="#e2e8f0">
                    {kr(Number(p.value))}
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ProvisionDiagram

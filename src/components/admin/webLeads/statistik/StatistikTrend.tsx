// Förfrågningar över tid, staplat per kundgrupp eller per källa (kanal). Tunna staplar (max 24 px)
// även när perioden har få hinkar, heldragna hårfina rutlinjer, en y-axel, legend med summa per serie
// och tooltip som visar alla serier i hinken. Färgerna följer entiteten (fast plats per kundgrupp och
// kanal), aldrig rangordningen.

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StatGran, StatRad } from '../../../../services/webLeadStatistikService'
import { KUNDGRUPP_LABEL, type WebInquiryKundgrupp } from '../../../../types/webInquiry'
import { tal } from '../../marknad/marknadFormat'
import { useDiagramFarger } from '../../marknad/useDiagramFarger'
import { KANAL_LABEL, KANAL_ORDNING, type Kanal } from '../leadKlassning'
import { hinkEtikett, hinkTitel, kanalFranNyckel } from './statistikData'
import { Vaxel } from './StatistikUi'

type Uppdelning = 'kundgrupp' | 'kanal'

const KUNDGRUPPER = Object.keys(KUNDGRUPP_LABEL) as WebInquiryKundgrupp[]

interface Serie {
  id: string
  namn: string
  farg: string
  summa: number
}

interface TipsProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: string
  serier: Serie[]
  titel: (b: string) => string
}

function Tips({ active, payload, label, serier, titel }: TipsProps) {
  if (!active || !payload?.length || !label) return null
  const varden = new Map(payload.map((p) => [p.dataKey, p.value]))
  const summa = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs min-w-[180px]">
      <div className="text-slate-300 mb-1.5">{titel(label)}</div>
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <span className="text-slate-400">Totalt</span>
        <span className="text-white font-semibold tabular-nums text-sm">{tal(summa)}</span>
      </div>
      {[...serier].reverse().map((s) => {
        const v = varden.get(s.id) ?? 0
        return (
          <div key={s.id} className={`flex items-center gap-2 ${v ? '' : 'opacity-50'}`}>
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.farg }} aria-hidden="true" />
            <span className="text-slate-400">{s.namn}</span>
            <span className="ml-auto text-white tabular-nums">{tal(v)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function StatistikTrend({
  rader,
  alla,
  gran,
  fran,
  till,
}: {
  rader: StatRad[]
  alla: string[]
  gran: StatGran
  fran: string
  till: string
}) {
  const f = useDiagramFarger()
  const [upp, setUpp] = useState<Uppdelning>('kundgrupp')

  const { data, serier } = useMemo(() => {
    const perHink = new Map<string, Record<string, number>>(alla.map((b) => [b, {}]))
    const summor = new Map<string, number>()
    const g = upp === 'kundgrupp' ? 'tid_kundgrupp' : 'tid_kanal'
    for (const r of rader) {
      if (r.g !== g || !r.b) continue
      const id = upp === 'kundgrupp' ? r.k : kanalFranNyckel(r.k)
      const rad = perHink.get(r.b)
      if (!rad) continue
      rad[id] = (rad[id] ?? 0) + r.n
      summor.set(id, (summor.get(id) ?? 0) + r.n)
    }
    // Fast färgplats per entitet: kundgrupperna 1 till 3, kanalerna i KANAL_ORDNING
    const lista: Serie[] =
      upp === 'kundgrupp'
        ? KUNDGRUPPER.map((k, i) => ({ id: k, namn: KUNDGRUPP_LABEL[k], farg: f.kategori[i]!, summa: summor.get(k) ?? 0 }))
        : KANAL_ORDNING.map((k: Kanal, i) => ({ id: k, namn: KANAL_LABEL[k], farg: f.kategori[i]!, summa: summor.get(k) ?? 0 }))
    return {
      data: alla.map((b) => ({ b, ...perHink.get(b) })),
      serier: lista.filter((s) => s.summa > 0),
    }
  }, [rader, alla, upp, f.kategori])

  const axel = { fontSize: 11, fill: f.axel }
  const glesa = data.length > 16 ? 'preserveStartEnd' : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Förklaring">
          {serier.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: s.farg }} aria-hidden="true" />
              {s.namn}
              <span className="text-slate-500 tabular-nums">{tal(s.summa)}</span>
            </li>
          ))}
        </ul>
        <Vaxel
          etikett="Dela upp på"
          val={[
            ['kundgrupp', 'Kundgrupp'],
            ['kanal', 'Källa'],
          ]}
          varde={upp}
          onVal={setUpp}
        />
      </div>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={f.rutnat} />
            <XAxis
              dataKey="b"
              tick={axel}
              tickLine={false}
              axisLine={{ stroke: f.rutnat }}
              interval={glesa as never}
              minTickGap={8}
              tickFormatter={(b: string) => hinkEtikett(b, gran)}
            />
            <YAxis tick={axel} tickLine={false} axisLine={false} width={32} allowDecimals={false} tickFormatter={(v: number) => tal(v)} />
            <Tooltip
              cursor={{ fill: f.rutnat, opacity: 0.35 }}
              content={<Tips serier={serier} titel={(b) => hinkTitel(b, gran, fran, till)} />}
            />
            {serier.map((s, i) => (
              <Bar
                key={s.id}
                dataKey={s.id}
                name={s.namn}
                stackId="t"
                fill={s.farg}
                stroke={f.yta}
                strokeWidth={1}
                maxBarSize={24}
                radius={i === serier.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

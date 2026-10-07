// Byggstenar för statistiken i Leads (Webb): nyckeltalsruta med sparkline och förändring, växlar
// som understrukna flikar, laddningsskelett. Samma ytor som sidan Marknad (MarknadUi). Inga piller.

import { useId, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { tal } from '../../marknad/marknadFormat'
import { NB } from './statistikData'

/** Förändring mot föregående period. relativ: procent, pe: procentenheter. omvand: lägre är bättre. */
export function Delta({
  nu,
  fore,
  satt = 'relativ',
  omvand = false,
}: {
  nu: number | null | undefined
  fore: number | null | undefined
  satt?: 'relativ' | 'pe'
  omvand?: boolean
}) {
  if (nu == null || fore == null || !Number.isFinite(nu) || !Number.isFinite(fore)) {
    return <span className="text-xs text-slate-500">ingen jämförelse</span>
  }
  let skillnad: number
  let text: string
  if (satt === 'pe') {
    skillnad = (nu - fore) * 100
    text = `${tal(Math.abs(skillnad), Math.abs(skillnad) < 10 && skillnad % 1 ? 1 : 0)}${NB}p.e.`
  } else {
    if (fore === 0) {
      return <span className="text-xs text-slate-500">{nu === 0 ? 'oförändrat' : 'ny mot noll'}</span>
    }
    skillnad = (nu - fore) / fore
    text = `${tal(Math.abs(skillnad) * 100, 0)}${NB}%`
  }
  const lika = Math.abs(skillnad) < (satt === 'pe' ? 0.5 : 0.005)
  const upp = skillnad > 0
  const bra = omvand ? !upp : upp
  const farg = lika ? 'text-slate-400' : bra ? 'text-[#20c58f]' : 'text-red-400'
  const Ikon = lika ? Minus : upp ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${farg}`}>
      <Ikon className="w-3 h-3" aria-hidden="true" />
      {lika ? 'oförändrat' : text}
      <span className="sr-only">{lika ? '' : upp ? ' upp' : ' ner'} mot föregående period</span>
    </span>
  )
}

/** Liten trendlinje: dämpad linje, sista punkten i accentfärg. Värden null hoppas över. */
export function Sparkline({ varden, accent = '#20c58f', titel }: { varden: Array<number | null>; accent?: string; titel?: string }) {
  const id = useId()
  const B = 120
  const H = 28
  const giltiga = varden.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null && Number.isFinite(p[1]))
  if (varden.length < 2 || giltiga.length === 0) return <div className="h-7" aria-hidden="true" />
  const max = Math.max(...giltiga.map((p) => p[1]))
  // En platt nollinje säger inget: visa ingen trend
  if (max === 0 && Math.min(...giltiga.map((p) => p[1])) === 0) return <div className="h-7" aria-hidden="true" />
  const min = Math.min(0, ...giltiga.map((p) => p[1]))
  const sp = max - min || 1
  const x = (i: number) => 2 + (i / (varden.length - 1)) * (B - 4)
  const y = (v: number) => H - 3 - ((v - min) / sp) * (H - 6)
  const linje = giltiga.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const sista = giltiga[giltiga.length - 1]!
  return (
    <svg viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" className="w-full h-7 overflow-visible" role="img" aria-labelledby={id}>
      <title id={id}>{titel ?? 'Trend under perioden'}</title>
      <polyline points={`${x(giltiga[0]![0])},${H - 1} ${linje} ${x(sista[0])},${H - 1}`} fill={accent} fillOpacity={0.1} stroke="none" />
      <polyline points={linje} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="text-slate-500" />
      <circle cx={x(sista[0])} cy={y(sista[1])} r={2.5} fill={accent} />
    </svg>
  )
}

export function KpiRuta({
  etikett,
  varde,
  under,
  delta,
  trend,
  dampad,
}: {
  etikett: string
  varde: ReactNode
  under?: ReactNode
  delta?: ReactNode
  trend?: ReactNode
  dampad?: boolean
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-700/70 rounded-lg p-3 min-w-0 flex flex-col">
      <div className="text-xs text-slate-400 truncate">{etikett}</div>
      <div className={`mt-1 text-2xl font-semibold leading-tight truncate ${dampad ? 'text-slate-500' : 'text-white'}`}>{varde}</div>
      <div className="mt-0.5 min-h-[1rem] flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
        {delta}
        {under}
      </div>
      {trend && <div className="mt-auto pt-2">{trend}</div>}
    </div>
  )
}

/** Understrukna växlar (aldrig piller). */
export function Vaxel<T extends string>({
  val,
  varde,
  onVal,
  etikett,
}: {
  val: Array<[T, string]>
  varde: T
  onVal: (v: T) => void
  etikett: string
}) {
  return (
    <div role="tablist" aria-label={etikett} className="flex flex-wrap gap-x-3 border-b border-slate-700/60 text-xs">
      {val.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={varde === v}
          onClick={() => onVal(v)}
          className={`pb-1.5 -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded-t ${
            varde === v ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** Tunn stapel för andelar i tabeller och listor. */
export function Andelsstapel({ andel, farg = 'bg-[#20c58f]' }: { andel: number; farg?: string }) {
  const p = Math.max(0, Math.min(1, andel))
  return (
    <div className="h-1 w-full bg-slate-700/40 rounded-full overflow-hidden" aria-hidden="true">
      <div className={`h-full rounded-full ${farg}`} style={{ width: `${p * 100}%` }} />
    </div>
  )
}

function Block({ className }: { className: string }) {
  return <div className={`bg-slate-700/30 rounded-lg animate-pulse ${className}`} />
}

/** Laddningsskelett med samma form som fliken. */
export function Skelett() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Laddar statistik">
      <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Block key={i} className="h-[118px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Block className="h-80" />
        <Block className="h-80 lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Block className="h-64" />
        <Block className="h-64" />
        <Block className="h-64" />
      </div>
    </div>
  )
}

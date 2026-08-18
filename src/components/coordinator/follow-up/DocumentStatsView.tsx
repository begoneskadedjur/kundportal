// src/components/coordinator/follow-up/DocumentStatsView.tsx
// Statistikvyn för dokumentsignering: stat-rad (ingen kortgrid), flödesfunnel,
// fördelningar, tidsserier, topplistor, marginaler, ledtider och
// teknikertabell med jämförelseläge. Diagram: tunna staplar i en accent,
// direkta etiketter, ärliga täckningsnoter där historiken är tunn.
import { useState, useEffect, useMemo } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus, Users, Info } from 'lucide-react'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import type { StatsContractRow, StatsAggregates } from '../../../services/offerFollowUpService'

interface DocumentStatsViewProps {
  isCoordinator: boolean
  ownDocsEmail?: string
}

type Period = '30' | '90' | '365' | 'all'
type TypeFilter = 'all' | 'offer' | 'contract'

// Privatpersonsmallarna i Oneflow (offert inkl. moms / ROT / RUT)
const PRIVATE_TEMPLATES = new Set(['8919037', '8919012', '8919059'])
// Öppnad-spårningen (first_visit-webhooken) driftsattes 2026-08-18
const TRACKING_START = '2026-08-18'

const fmtKr = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')} mkr`
  : v >= 1_000 ? `${Math.round(v / 1_000)} tkr`
  : `${Math.round(v)} kr`

const fmtD = (v: number) => `${v.toFixed(1).replace('.', ',')} d`

function isPrivatperson(row: StatsContractRow): boolean {
  if (row.template_id && PRIVATE_TEMPLATES.has(row.template_id)) return true
  const digits = (row.organization_number || '').replace(/\D/g, '')
  if (digits.length === 10) {
    // Personnummer har månad 01-12 i position 3-4; orgnr har ≥ 20
    const mm = parseInt(digits.substring(2, 4), 10)
    return mm >= 1 && mm <= 12
  }
  if (digits.length === 12) {
    const mm = parseInt(digits.substring(4, 6), 10)
    return mm >= 1 && mm <= 12
  }
  return false
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

const techName = (row: StatsContractRow) =>
  row.begone_employee_name || row.created_by_name || 'Okänd'
const techEmail = (row: StatsContractRow) =>
  (row.begone_employee_email || row.created_by_email || '').toLowerCase()

// ─── Små byggstenar ───────────────────────────────────────────

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const diff = Math.round(((current - previous) / previous) * 100)
  if (Math.abs(diff) < 1) return <span className="flex items-center gap-0.5 text-[10px] text-slate-500"><Minus className="w-2.5 h-2.5" />±0 %</span>
  const up = diff > 0
  return (
    <span className={`flex items-center gap-0.5 text-[10px] ${up ? 'text-[#20c58f]' : 'text-red-400'}`}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{diff} %
    </span>
  )
}

function Stat({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 first:pl-0 border-r border-slate-800 last:border-r-0 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">{label}</span>
      <span className="text-xl font-semibold text-white font-mono tabular-nums leading-tight whitespace-nowrap">{value}</span>
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500 whitespace-nowrap">{sub}{trend}</span>
    </div>
  )
}

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
      {note && (
        <span className="flex items-center gap-1 text-[10px] text-slate-600">
          <Info className="w-2.5 h-2.5" />{note}
        </span>
      )}
    </div>
  )
}

/** Horisontell stapelrad — en accent, direkt etikett + värde */
function BarRow({ label, value, max, display, sub }: {
  label: string; value: number; max: number; display: string; sub?: string
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1.5) : 0
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-40 shrink-0 text-xs text-slate-300 truncate" title={label}>{label}</span>
      <div className="flex-1 h-3.5 rounded-[3px] bg-slate-800/60 overflow-hidden">
        <div className="h-full rounded-[3px] bg-[#20c58f]/80" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-mono tabular-nums text-slate-300">{display}</span>
      {sub !== undefined && <span className="w-16 shrink-0 text-right text-[10px] font-mono tabular-nums text-slate-500">{sub}</span>}
    </div>
  )
}

/** 100 %-fördelning i två segment — grönt + blått, alltid etiketterat */
function SplitBar({ label, a, b, aLabel, bLabel, aValue, bValue }: {
  label: string; a: number; b: number; aLabel: string; bLabel: string; aValue?: string; bValue?: string
}) {
  const total = a + b
  const aPct = total > 0 ? (a / total) * 100 : 50
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="flex h-4 rounded-[3px] overflow-hidden gap-px">
        <div className="bg-[#20c58f]/80 min-w-[2px]" style={{ width: `${aPct}%` }} />
        <div className="bg-blue-500/70 min-w-[2px]" style={{ width: `${100 - aPct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1 text-[11px]">
        <span className="text-slate-300">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#20c58f]/80 mr-1" />
          {aLabel} <span className="font-mono tabular-nums">{total > 0 ? Math.round(aPct) : 0} %</span>
          {aValue && <span className="text-slate-500"> · {aValue}</span>}
        </span>
        <span className="text-slate-300">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-500/70 mr-1" />
          {bLabel} <span className="font-mono tabular-nums">{total > 0 ? 100 - Math.round(aPct) : 0} %</span>
          {bValue && <span className="text-slate-500"> · {bValue}</span>}
        </span>
      </div>
    </div>
  )
}

/** Vertikal mini-stapelserie (per vecka/månad) med hover-titlar */
function ColumnChart({ buckets, title }: {
  buckets: Array<{ label: string; value: number }>
  title: string
}) {
  const max = Math.max(...buckets.map(b => b.value), 1)
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{title}</p>
      <div className="flex items-end gap-[3px] h-16">
        {buckets.map((b, i) => (
          <div
            key={i}
            title={`${b.label}: ${b.value}`}
            className="flex-1 min-w-[3px] rounded-t-[3px] bg-[#20c58f]/70 hover:bg-[#20c58f] transition-colors"
            style={{ height: `${Math.max((b.value / max) * 100, b.value > 0 ? 6 : 2)}%`, opacity: b.value > 0 ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-slate-600 font-mono">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  )
}

// ─── Huvudkomponent ───────────────────────────────────────────

export default function DocumentStatsView({ isCoordinator, ownDocsEmail }: DocumentStatsViewProps) {
  const [rows, setRows] = useState<StatsContractRow[]>([])
  const [aggregates, setAggregates] = useState<StatsAggregates | null>(null)
  const [loading, setLoading] = useState(true)
  const [aggLoading, setAggLoading] = useState(false)

  const [period, setPeriod] = useState<Period>('90')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [techFilter, setTechFilter] = useState<string>('all')
  const [compare, setCompare] = useState<string[]>([])

  useEffect(() => {
    setLoading(true)
    OfferFollowUpService.getStatsContracts(ownDocsEmail)
      .then(setRows)
      .catch(err => console.error('Stats fetch:', err))
      .finally(() => setLoading(false))
  }, [ownDocsEmail])

  // Periodgränser
  const { fromISO, toISO, prevFromISO } = useMemo(() => {
    const now = new Date()
    const to = now.toISOString()
    if (period === 'all') {
      return { fromISO: '2020-01-01T00:00:00Z', toISO: to, prevFromISO: null as string | null }
    }
    const days = parseInt(period, 10)
    const from = new Date(now.getTime() - days * 86_400_000)
    const prevFrom = new Date(now.getTime() - days * 2 * 86_400_000)
    return { fromISO: from.toISOString(), toISO: to, prevFromISO: prevFrom.toISOString() }
  }, [period])

  // Aggregat via RPC (produkter/tjänster/marginaler)
  useEffect(() => {
    setAggLoading(true)
    const tech = ownDocsEmail || (techFilter !== 'all' ? techFilter : null)
    OfferFollowUpService.getStatsAggregates(fromISO, toISO, tech)
      .then(setAggregates)
      .catch(err => console.error('Aggregates fetch:', err))
      .finally(() => setAggLoading(false))
  }, [fromISO, toISO, techFilter, ownDocsEmail])

  // Filtrerade dokument i period + föregående period (för trend)
  const docs = useMemo(() =>
    rows.filter(r =>
      r.created_at >= fromISO && r.created_at < toISO &&
      (typeFilter === 'all' || r.type === typeFilter) &&
      (techFilter === 'all' || techEmail(r) === techFilter)
    ), [rows, fromISO, toISO, typeFilter, techFilter])

  const prevDocs = useMemo(() =>
    prevFromISO
      ? rows.filter(r =>
          r.created_at >= prevFromISO && r.created_at < fromISO &&
          (typeFilter === 'all' || r.type === typeFilter) &&
          (techFilter === 'all' || techEmail(r) === techFilter)
        )
      : [], [rows, prevFromISO, fromISO, typeFilter, techFilter])

  // Nyckeltal
  const stats = useMemo(() => {
    const calc = (set: StatsContractRow[]) => {
      const signed = set.filter(r => r.status === 'signed')
      const total = set.length
      const signDays = signed
        .filter(r => r.status_updated_at)
        .map(r => daysBetween(r.created_at, r.status_updated_at!))
        .filter(d => d >= 0 && d < 365)
      return {
        sent: total,
        signed: signed.length,
        rate: total > 0 ? Math.round((signed.length / total) * 100) : 0,
        pipelineValue: set.filter(r => r.status === 'pending' || r.status === 'overdue')
          .reduce((s, r) => s + (Number(r.total_value) || 0), 0),
        signedValue: signed.reduce((s, r) => s + (Number(r.total_value) || 0), 0),
        avgDays: avg(signDays),
        medianDays: median(signDays),
      }
    }
    return { now: calc(docs), prev: calc(prevDocs) }
  }, [docs, prevDocs])

  // Flödesfunnel (öppnad bara mätbar för dokument skapade efter spårningsstart)
  const funnel = useMemo(() => {
    const trackable = docs.filter(r => r.created_at >= TRACKING_START)
    const opened = trackable.filter(r => r.customer_first_viewed_at).length
    const signed = docs.filter(r => r.status === 'signed')
    const booked = signed.filter(r => r.booked_case_id).length
    return {
      sent: docs.length,
      trackableCount: trackable.length,
      opened,
      signed: signed.length,
      booked,
    }
  }, [docs])

  // Fördelningar
  const splits = useMemo(() => {
    const offers = docs.filter(r => r.type === 'offer')
    const contracts = docs.filter(r => r.type === 'contract')
    const privat = docs.filter(isPrivatperson)
    const foretag = docs.filter(r => !isPrivatperson(r))
    const val = (set: StatsContractRow[]) => set.reduce((s, r) => s + (Number(r.total_value) || 0), 0)
    return {
      offers: offers.length, contracts: contracts.length,
      offersValue: val(offers), contractsValue: val(contracts),
      privat: privat.length, foretag: foretag.length,
      privatValue: val(privat), foretagValue: val(foretag),
    }
  }, [docs])

  // Tidsserier: skickade + signerade per bucket
  const series = useMemo(() => {
    const bucketCount = period === '30' ? 10 : 12
    const start = new Date(fromISO).getTime()
    const end = new Date(toISO).getTime()
    const span = (end - start) / bucketCount
    const label = (t: number) => new Date(t).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    const sent = Array.from({ length: bucketCount }, (_, i) => ({ label: label(start + i * span), value: 0 }))
    const signed = Array.from({ length: bucketCount }, (_, i) => ({ label: label(start + i * span), value: 0 }))
    for (const r of docs) {
      const i = Math.min(Math.floor((new Date(r.created_at).getTime() - start) / span), bucketCount - 1)
      if (i >= 0) sent[i].value++
    }
    for (const r of docs.filter(d => d.status === 'signed' && d.status_updated_at)) {
      const t = new Date(r.status_updated_at!).getTime()
      if (t >= start && t < end) {
        const i = Math.min(Math.floor((t - start) / span), bucketCount - 1)
        signed[i].value++
      }
    }
    return { sent, signed }
  }, [docs, fromISO, toISO, period])

  // Marginaler
  const margins = useMemo(() => {
    const all = aggregates?.marginaler || []
    const values = all.map(m => m.marginal_pct)
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      label: i === 0 ? '<0 %' : `${(i - 1) * 15}-${i * 15} %`,
      value: 0,
    }))
    for (const v of values) {
      const idx = v < 0 ? 0 : Math.min(Math.floor(v / 15) + 1, 7)
      buckets[idx].value++
    }
    return { n: values.length, avg: avg(values), median: median(values), buckets, all }
  }, [aggregates])

  // Ledtider
  const leadTimes = useMemo(() => {
    const signDays = docs
      .filter(r => r.status === 'signed' && r.status_updated_at)
      .map(r => daysBetween(r.created_at, r.status_updated_at!))
      .filter(d => d >= 0 && d < 365)
    // Signerad → bokad mäts via booked_case_id (nya flödet)
    const bookedDocs = docs.filter(r => r.status === 'signed' && r.booked_case_id && r.status_updated_at)
    return {
      toSign: { avg: avg(signDays), median: median(signDays), n: signDays.length },
      bookedN: bookedDocs.length,
      sourceN: docs.filter(r => r.source_id).length,
    }
  }, [docs])

  // Per tekniker
  const techRows = useMemo(() => {
    const map = new Map<string, { name: string; docs: StatsContractRow[] }>()
    for (const r of docs) {
      const email = techEmail(r)
      if (!email) continue
      const entry = map.get(email) || { name: techName(r), docs: [] }
      entry.docs.push(r)
      map.set(email, entry)
    }
    const marginByTech = new Map<string, number[]>()
    for (const m of aggregates?.marginaler || []) {
      if (!m.tech_email) continue
      const arr = marginByTech.get(m.tech_email) || []
      arr.push(m.marginal_pct)
      marginByTech.set(m.tech_email, arr)
    }
    return [...map.entries()].map(([email, { name, docs: d }]) => {
      const signed = d.filter(r => r.status === 'signed')
      const signDays = signed
        .filter(r => r.status_updated_at)
        .map(r => daysBetween(r.created_at, r.status_updated_at!))
        .filter(x => x >= 0 && x < 365)
      const techMargins = marginByTech.get(email) || []
      return {
        email,
        name,
        sent: d.length,
        signed: signed.length,
        rate: d.length > 0 ? Math.round((signed.length / d.length) * 100) : 0,
        avgDays: avg(signDays),
        pipeline: d.filter(r => r.status === 'pending' || r.status === 'overdue')
          .reduce((s, r) => s + (Number(r.total_value) || 0), 0),
        signedValue: signed.reduce((s, r) => s + (Number(r.total_value) || 0), 0),
        avgValue: d.length > 0 ? d.reduce((s, r) => s + (Number(r.total_value) || 0), 0) / d.length : 0,
        margin: avg(techMargins),
        marginN: techMargins.length,
      }
    }).sort((a, b) => b.sent - a.sent)
  }, [docs, aggregates])

  const compareRows = techRows.filter(t => compare.includes(t.email))
  const allTechs = useMemo(() => {
    const set = new Map<string, string>()
    for (const r of rows) {
      const e = techEmail(r)
      if (e) set.set(e, techName(r))
    }
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sv'))
  }, [rows])

  const toggleCompare = (email: string) => {
    setCompare(prev => prev.includes(email)
      ? prev.filter(e => e !== email)
      : prev.length >= 3 ? prev : [...prev, email])
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#20c58f]" />
      </div>
    )
  }

  const s = stats.now
  const maxTjanst = Math.max(...(aggregates?.tjanster || []).map(t => t.dokument), 1)
  const maxProdukt = Math.max(...(aggregates?.produkter || []).map(p => p.antal), 1)
  const maxMarginBucket = Math.max(...margins.buckets.map(b => b.value), 1)

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* ── Filterrad ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-wrap sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
        <div className="flex bg-slate-800/50 rounded-lg p-0.5">
          {([['30', '30 d'], ['90', '90 d'], ['365', '1 år'], ['all', 'Allt']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                period === key ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-800/50 rounded-lg p-0.5">
          {([['all', 'Båda'], ['offer', 'Offerter'], ['contract', 'Avtal']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                typeFilter === key ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {isCoordinator && (
          <select
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="px-2 py-1.5 text-[11px] bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          >
            <option value="all">Alla tekniker</option>
            {allTechs.map(([email, name]) => (
              <option key={email} value={email}>{name}</option>
            ))}
          </select>
        )}
        {prevFromISO && (
          <span className="ml-auto text-[10px] text-slate-600">Trender jämförs mot föregående {period === '365' ? 'år' : `${period} dagar`}</span>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* ── Stat-rad ── */}
        <div className="flex items-stretch overflow-x-auto pb-1">
          <Stat label="Skickade" value={String(s.sent)} trend={<Trend current={s.sent} previous={stats.prev.sent} />} />
          <Stat label="Signerade" value={String(s.signed)} trend={<Trend current={s.signed} previous={stats.prev.signed} />} />
          <Stat label="Signeringsgrad" value={`${s.rate} %`} sub={stats.prev.sent > 0 ? `fg period ${stats.prev.rate} %` : undefined} />
          <Stat label="Pipeline" value={fmtKr(s.pipelineValue)} sub="pågående + förfallna" />
          <Stat label="Signerat värde" value={fmtKr(s.signedValue)} trend={<Trend current={s.signedValue} previous={stats.prev.signedValue} />} />
          <Stat
            label="Till signering"
            value={s.avgDays != null ? fmtD(s.avgDays) : '–'}
            sub={s.medianDays != null ? `median ${fmtD(s.medianDays)}` : undefined}
          />
        </div>

        {/* ── Flödet + fördelningar ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <SectionTitle>Flödet</SectionTitle>
            <div className="space-y-1">
              <BarRow label="Skickade" value={funnel.sent} max={funnel.sent} display={String(funnel.sent)} />
              <BarRow
                label="Öppnade av kund"
                value={funnel.opened}
                max={funnel.trackableCount || 1}
                display={String(funnel.opened)}
                sub={funnel.trackableCount > 0 ? `${Math.round((funnel.opened / funnel.trackableCount) * 100)} %` : '–'}
              />
              <BarRow
                label="Signerade"
                value={funnel.signed}
                max={funnel.sent || 1}
                display={String(funnel.signed)}
                sub={funnel.sent > 0 ? `${Math.round((funnel.signed / funnel.sent) * 100)} %` : ''}
              />
              <BarRow
                label="Bokade"
                value={funnel.booked}
                max={funnel.signed || 1}
                display={String(funnel.booked)}
                sub={funnel.signed > 0 ? `${Math.round((funnel.booked / funnel.signed) * 100)} %` : ''}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
              Öppnad mäts från {TRACKING_START} ({funnel.trackableCount} dokument i perioden) · Bokad via nya Boka in-flödet
            </p>
          </div>
          <div>
            <SectionTitle>Fördelning</SectionTitle>
            <SplitBar
              label="Dokumenttyp"
              a={splits.offers} b={splits.contracts}
              aLabel={`Offerter (${splits.offers})`} bLabel={`Avtal (${splits.contracts})`}
              aValue={fmtKr(splits.offersValue)} bValue={fmtKr(splits.contractsValue)}
            />
            <SplitBar
              label="Kundtyp"
              a={splits.privat} b={splits.foretag}
              aLabel={`Privatperson (${splits.privat})`} bLabel={`Företag (${splits.foretag})`}
              aValue={fmtKr(splits.privatValue)} bValue={fmtKr(splits.foretagValue)}
            />
          </div>
        </div>

        {/* ── Tidsserier ── */}
        <div className="grid sm:grid-cols-2 gap-6">
          <ColumnChart buckets={series.sent} title="Skickade över perioden" />
          <ColumnChart buckets={series.signed} title="Signerade över perioden" />
        </div>

        {/* ── Topplistor ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <SectionTitle note={aggLoading ? 'laddar…' : `${aggregates?.tjanster.length || 0} tjänster med fakturarader`}>
              Tjänster vi säljer
            </SectionTitle>
            {(aggregates?.tjanster || []).length === 0 ? (
              <p className="text-xs text-slate-600 py-2">Inga strukturerade tjänsterader i perioden — nya dokument från systemet fyller på här.</p>
            ) : (
              <div className="space-y-0.5">
                {(aggregates?.tjanster || []).slice(0, 10).map(t => (
                  <BarRow
                    key={t.name}
                    label={t.name}
                    value={t.dokument}
                    max={maxTjanst}
                    display={`${t.dokument} st`}
                    sub={fmtKr(Number(t.varde))}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <SectionTitle note="ur dokumentens produktrader">Produkter i dokumenten</SectionTitle>
            <div className="space-y-0.5">
              {(aggregates?.produkter || []).slice(0, 10).map(p => (
                <BarRow
                  key={p.name}
                  label={p.name}
                  value={p.antal}
                  max={maxProdukt}
                  display={`${p.antal} st`}
                  sub={fmtKr(Number(p.varde))}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Marginaler + ledtider ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <SectionTitle note={`baserat på ${margins.n} dokument med intern kalkyl`}>Marginaler</SectionTitle>
            {margins.n === 0 ? (
              <p className="text-xs text-slate-600 py-2">Inga dokument med interna kostnader i perioden.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-4 mb-2">
                  <span className="text-lg font-semibold text-white font-mono tabular-nums">
                    {margins.avg != null ? `${margins.avg.toFixed(0)} %` : '–'}
                  </span>
                  <span className="text-[11px] text-slate-500">snitt · median {margins.median != null ? `${margins.median.toFixed(0)} %` : '–'}</span>
                </div>
                <div className="flex items-end gap-[3px] h-12">
                  {margins.buckets.map((b, i) => (
                    <div key={i} title={`${b.label}: ${b.value} dokument`} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-t-[3px] ${i === 0 ? 'bg-red-500/60' : 'bg-[#20c58f]/70'}`}
                        style={{ height: `${Math.max((b.value / maxMarginBucket) * 40, b.value > 0 ? 4 : 1)}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-0.5">
                  <span>&lt;0 %</span><span>105 %+</span>
                </div>
              </>
            )}
          </div>
          <div>
            <SectionTitle>Ledtider</SectionTitle>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs text-slate-300">Skickad → signerad</span>
                <span className="text-sm font-mono tabular-nums text-white">
                  {leadTimes.toSign.avg != null ? fmtD(leadTimes.toSign.avg) : '–'}
                  <span className="text-[10px] text-slate-500"> snitt · median {leadTimes.toSign.median != null ? fmtD(leadTimes.toSign.median) : '–'} · n={leadTimes.toSign.n}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs text-slate-300">Utförande → skickad</span>
                <span className="text-[10px] text-slate-500">mäts från aug 2026 · n={leadTimes.sourceN} med ärendekoppling</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs text-slate-300">Signerad → bokad</span>
                <span className="text-[10px] text-slate-500">mäts från aug 2026 · n={leadTimes.bookedN} bokade via flödet</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Per tekniker ── */}
        {isCoordinator && techRows.length > 0 && (
          <div>
            <SectionTitle note="klicka på rader för att jämföra (max 3)">
              <span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" /> Per tekniker</span>
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="text-left py-1.5 pr-3 font-semibold">Tekniker</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Skickade</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Signerade</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Grad</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Snittid</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Pipeline</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Signerat</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Snitt/dok</th>
                    <th className="text-right py-1.5 pl-2 font-semibold">Marginal</th>
                  </tr>
                </thead>
                <tbody>
                  {techRows.map(t => (
                    <tr
                      key={t.email}
                      onClick={() => toggleCompare(t.email)}
                      className={`border-b border-slate-800/60 cursor-pointer transition-colors ${
                        compare.includes(t.email) ? 'bg-[#20c58f]/10' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-1.5 pr-3 text-slate-200 whitespace-nowrap">
                        {compare.includes(t.email) && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#20c58f] mr-1.5" />}
                        {t.name}
                      </td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-300">{t.sent}</td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-300">{t.signed}</td>
                      <td className={`text-right py-1.5 px-2 font-mono tabular-nums ${t.rate >= 60 ? 'text-[#20c58f]' : t.rate >= 40 ? 'text-slate-300' : 'text-amber-400'}`}>{t.rate} %</td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-300">{t.avgDays != null ? fmtD(t.avgDays) : '–'}</td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-300">{fmtKr(t.pipeline)}</td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-300">{fmtKr(t.signedValue)}</td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-400">{fmtKr(t.avgValue)}</td>
                      <td className="text-right py-1.5 pl-2 font-mono tabular-nums text-slate-300">
                        {t.margin != null ? `${t.margin.toFixed(0)} %` : '–'}
                        {t.marginN > 0 && <span className="text-slate-600 text-[9px]"> ({t.marginN})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Jämförelse sida vid sida */}
            {compareRows.length >= 2 && (
              <div className="mt-4 p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Jämförelse · {compareRows.map(t => t.name.split(' ')[0]).join(' vs ')}
                </p>
                <div className={`grid gap-3 ${compareRows.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {compareRows.map(t => (
                    <div key={t.email} className="space-y-1">
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      {([
                        ['Skickade', String(t.sent)],
                        ['Signeringsgrad', `${t.rate} %`],
                        ['Snittid till signering', t.avgDays != null ? fmtD(t.avgDays) : '–'],
                        ['Signerat värde', fmtKr(t.signedValue)],
                        ['Snittvärde per dokument', fmtKr(t.avgValue)],
                        ['Snittmarginal', t.margin != null ? `${t.margin.toFixed(0)} % (${t.marginN} dok)` : '–'],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between border-b border-slate-800/60 py-0.5">
                          <span className="text-[10px] text-slate-500">{label}</span>
                          <span className="text-xs font-mono tabular-nums text-slate-200">{value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// src/pages/admin/MonthlyReport.tsx
// Månadsrapport för avtalskunder + cron-aktivitet
// Styrelse-presentation: trendgrafer, tabeller, professionell layout

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  Receipt,
  AlertTriangle,
  CheckCircle,
  Clock,
  PauseCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  RefreshCw,
  Activity,
  Download,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { MonthlyReportService } from '../../services/monthlyReportService'
import type {
  MonthlyReportData,
  MonthlyCustomerSnapshot,
  CronRun,
} from '../../types/monthlyReport'

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const fmtSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtSEKShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mkr`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} tkr`
  return `${n} kr`
}

const fmtNumber = (n: number) => new Intl.NumberFormat('sv-SE').format(n)

const fmtMonth = (key: string) => {
  const d = new Date(key)
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
}

const fmtMonthShort = (key: string) => {
  const d = new Date(key)
  return d.toLocaleDateString('sv-SE', { year: '2-digit', month: 'short' })
}

const BRAND = '#20c58f'
const COLOR_PIE = ['#20c58f', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6']

// ─────────────────────────────────────────────────────────────────────
// Tooltip för Recharts
// ─────────────────────────────────────────────────────────────────────

interface TipProps {
  active?: boolean
  payload?: any[]
  label?: string
  format?: (n: number) => string
}

function ChartTooltip({ active, payload, label, format = fmtNumber }: TipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl px-3 py-2 text-xs">
      {label && <div className="text-slate-400 mb-1.5">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-medium">{format(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// KPI med trend (kompakt rad)
// ─────────────────────────────────────────────────────────────────────

interface KpiRowProps {
  label: string
  value: string
  current: number
  previous?: number
  format?: (n: number) => string
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  inverse?: boolean
}

function KpiRow({ label, value, current, previous, format = fmtNumber, icon: Icon, iconColor = 'text-[#20c58f]', inverse = false }: KpiRowProps) {
  const delta = previous !== undefined && previous !== null ? current - previous : null
  const pct = previous && previous !== 0 ? (delta! / previous) * 100 : null
  const positive = delta !== null && (inverse ? delta < 0 : delta > 0)
  const negative = delta !== null && delta !== 0 && (inverse ? delta > 0 : delta < 0)
  const TrendIcon = delta && delta > 0 ? TrendingUp : TrendingDown

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {delta !== null && delta !== 0 && (
        <div className={`flex items-center gap-1 text-xs ${positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-slate-500'}`}>
          <TrendIcon className="w-3 h-3" />
          <span>{delta > 0 ? '+' : ''}{format(delta)}</span>
          {pct !== null && Math.abs(pct) < 1000 && (
            <span className="text-slate-500">({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
          )}
        </div>
      )}
      {delta === 0 && <div className="text-xs text-slate-500">Oförändrat</div>}
      {delta === null && <div className="text-xs text-slate-600">Ingen jämförelse</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Cron-körnings-rad
// ─────────────────────────────────────────────────────────────────────

function CronRunCard({ run }: { run: CronRun }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = {
    success: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Lyckad' },
    partial: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Delvis' },
    failed: { dot: 'bg-red-400', text: 'text-red-400', label: 'Misslyckad' },
    running: { dot: 'bg-slate-400 animate-pulse', text: 'text-slate-400', label: 'Pågår' },
  }[run.status]

  const started = new Date(run.started_at)
  const finished = run.finished_at ? new Date(run.finished_at) : null
  const ms = finished ? finished.getTime() - started.getTime() : null
  const duration = ms !== null ? (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`) : 'pågår'

  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden bg-slate-800/20">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{run.job_name}</div>
            <div className="text-xs text-slate-500">
              {started.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              <span className="mx-1.5">·</span>
              {duration}
              <span className="mx-1.5">·</span>
              <span className={cfg.text}>{cfg.label}</span>
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 ml-2" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-700/50">
          {run.error_message && (
            <div className="text-xs text-red-400 mb-2">
              <span className="font-semibold">Fel:</span> {run.error_message}
            </div>
          )}
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all bg-slate-900/50 p-3 rounded-lg overflow-x-auto font-mono">
            {JSON.stringify(run.summary, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sidan
// ─────────────────────────────────────────────────────────────────────

export default function MonthlyReport() {
  const navigate = useNavigate()
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [data, setData] = useState<MonthlyReportData | null>(null)
  const [trend, setTrend] = useState<MonthlyCustomerSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Månadsrapport - BeGone Admin'
    Promise.all([
      MonthlyReportService.listAvailableMonths(),
      MonthlyReportService.getTrend(),
    ])
      .then(([list, trendData]) => {
        setMonths(list)
        setTrend(trendData)
        if (list.length > 0) setSelectedMonth(list[0])
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedMonth) return
    setLoading(true)
    MonthlyReportService.getReport(selectedMonth)
      .then(setData)
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [selectedMonth])

  const snapshot = data?.snapshot
  const prev = data?.previous

  // Trenddata begränsat till vald månad och bakåt (12 mån)
  const trendChartData = useMemo(() => {
    if (!selectedMonth) return []
    const idx = trend.findIndex(t => t.snapshot_month === selectedMonth)
    if (idx < 0) return trend.slice(-12)
    const start = Math.max(0, idx - 11)
    return trend.slice(start, idx + 1)
  }, [trend, selectedMonth])

  const arrTrend = useMemo(() =>
    trendChartData.map(t => ({
      month: fmtMonthShort(t.snapshot_month),
      ARR: t.arr_sek,
    })),
  [trendChartData])

  const customerTrend = useMemo(() =>
    trendChartData.map(t => ({
      month: fmtMonthShort(t.snapshot_month),
      Aktiva: t.total_active_customers,
      Pausade: t.total_paused_customers,
      Utgångna: t.total_expired_customers,
    })),
  [trendChartData])

  const movementTrend = useMemo(() =>
    trendChartData.map(t => ({
      month: fmtMonthShort(t.snapshot_month),
      Tillkomna: t.customers_added,
      Förlorade: -t.customers_terminated,
    })),
  [trendChartData])

  const invoicedTrend = useMemo(() =>
    trendChartData.map(t => ({
      month: fmtMonthShort(t.snapshot_month),
      Fakturerat: t.invoiced_sek,
      Betalt: t.paid_sek,
    })),
  [trendChartData])

  const contractTypeRows = useMemo(() => {
    if (!snapshot?.by_contract_type) return []
    return Object.entries(snapshot.by_contract_type)
      .map(([type, v]) => ({ name: type, count: v.count, arr: v.arr }))
      .sort((a, b) => b.arr - a.arr)
  }, [snapshot])

  const freqRows = useMemo(() => {
    if (!snapshot?.by_billing_frequency) return []
    const labels: Record<string, string> = {
      monthly: 'Månadsvis',
      quarterly: 'Kvartalsvis',
      annual: 'Årsvis',
      on_demand: 'Vid behov',
    }
    return Object.entries(snapshot.by_billing_frequency)
      .map(([key, count]) => ({ name: labels[key] ?? key, count }))
      .sort((a, b) => b.count - a.count)
  }, [snapshot])

  const netRetention = useMemo(() => {
    if (!prev || prev.arr_sek === 0) return null
    return (snapshot!.arr_sek / prev.arr_sek) * 100
  }, [snapshot, prev])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/befintliga-kunder')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#20c58f]" />
              Månadsrapport
            </h1>
            <p className="text-sm text-slate-400">Kundbas, intäkter och systemaktivitet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedMonth ?? ''}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          >
            {months.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      )}

      {!loading && !snapshot && (
        <div className="p-8 bg-slate-800/30 border border-slate-700 rounded-xl text-center">
          <p className="text-slate-400">Ingen rapport finns för vald månad ännu.</p>
        </div>
      )}

      {!loading && snapshot && (
        <div className="space-y-8">
          {snapshot.is_estimated && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Denna månad är historiskt uppskattad — exakta siffror finns från och med första körningen av snapshot-cronet.</span>
            </div>
          )}

          {/* ─── Sektion 1: Nyckeltal ─── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Nyckeltal</h2>
              <span className="text-xs text-slate-500">{fmtMonth(snapshot.snapshot_month)}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiRow
                label="Återkommande intäkter (ARR)"
                value={fmtSEK(snapshot.arr_sek)}
                current={snapshot.arr_sek}
                previous={prev?.arr_sek}
                format={fmtSEK}
                icon={Wallet}
              />
              <KpiRow
                label="MRR"
                value={fmtSEK(snapshot.mrr_sek)}
                current={snapshot.mrr_sek}
                previous={prev?.mrr_sek}
                format={fmtSEK}
                icon={Wallet}
              />
              <KpiRow
                label="Aktiva avtalskunder"
                value={fmtNumber(snapshot.total_active_customers)}
                current={snapshot.total_active_customers}
                previous={prev?.total_active_customers}
                icon={Users}
              />
              <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Net Retention</span>
                  <Activity className={`w-4 h-4 ${netRetention !== null && netRetention >= 100 ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {netRetention !== null ? `${netRetention.toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {netRetention !== null && netRetention >= 100 ? 'Tillväxt' : netRetention !== null ? 'Krympning' : 'Ingen jämförelse'}
                </div>
              </div>
            </div>
          </section>

          {/* ─── Sektion 2: ARR-trend (12 mån) ─── */}
          <section className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">ARR-utveckling</h2>
              <span className="text-xs text-slate-500">Senaste 12 månaderna</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={arrTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="arrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtSEKShort} />
                  <Tooltip content={<ChartTooltip format={fmtSEK} />} />
                  <Area type="monotone" dataKey="ARR" stroke={BRAND} strokeWidth={2} fill="url(#arrGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ─── Sektion 3: Kundbas-utveckling ─── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Kundstatus över tid</h3>
                <span className="text-xs text-slate-500">12 mån</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={customerTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Line type="monotone" dataKey="Aktiva" stroke="#20c58f" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Pausade" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Utgångna" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Tillkomna vs förlorade</h3>
                <span className="text-xs text-slate-500">12 mån</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={movementTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Bar dataKey="Tillkomna" fill="#20c58f" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Förlorade" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ─── Sektion 4: Status-fördelning + portföljmix ─── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <h3 className="text-base font-semibold text-white mb-4">Kundstatus just nu</h3>
              <div className="space-y-3">
                {[
                  { label: 'Aktiva', value: snapshot.total_active_customers, color: 'text-emerald-400', bg: 'bg-emerald-500', icon: CheckCircle },
                  { label: 'Pausade', value: snapshot.total_paused_customers, color: 'text-amber-400', bg: 'bg-amber-500', icon: PauseCircle },
                  { label: 'Utgångna', value: snapshot.total_expired_customers, color: 'text-slate-400', bg: 'bg-slate-500', icon: Clock },
                  { label: 'Uppsagda (totalt)', value: snapshot.total_terminated_customers, color: 'text-red-400', bg: 'bg-red-500', icon: XCircle },
                ].map(s => {
                  const total = snapshot.total_active_customers + snapshot.total_paused_customers + snapshot.total_expired_customers + snapshot.total_terminated_customers
                  const pct = total > 0 ? (s.value / total) * 100 : 0
                  const Icon = s.icon
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`flex items-center gap-1.5 text-sm ${s.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {s.label}
                        </span>
                        <span className="text-sm font-semibold text-white">{s.value}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${s.bg}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <h3 className="text-base font-semibold text-white mb-4">Avtalstyp</h3>
              {contractTypeRows.length > 0 ? (
                <>
                  <div className="h-40 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={contractTypeRows}
                          dataKey="arr"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {contractTypeRows.map((_, idx) => (
                            <Cell key={idx} fill={COLOR_PIE[idx % COLOR_PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip format={fmtSEK} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {contractTypeRows.slice(0, 5).map((row, idx) => (
                      <div key={row.name} className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5 text-slate-300 truncate min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR_PIE[idx % COLOR_PIE.length] }} />
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="text-white font-medium ml-2 whitespace-nowrap">{row.count} st</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Ingen data</p>
              )}
            </div>

            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <h3 className="text-base font-semibold text-white mb-4">Faktureringsfrekvens</h3>
              {freqRows.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={freqRows} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={80} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Ingen data</p>
              )}
            </div>
          </section>

          {/* ─── Sektion 5: Tillkomna och uppsagda ─── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Tillkomna avtalskunder</h3>
                <span className="text-sm text-emerald-400 font-semibold">{snapshot.customers_added} st</span>
              </div>
              {snapshot.added_customers && snapshot.added_customers.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2 font-medium">Kund</th>
                        <th className="px-3 py-2 font-medium">Avtalstyp</th>
                        <th className="px-3 py-2 font-medium text-right">ARR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {snapshot.added_customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-white">{c.company_name}</td>
                          <td className="px-3 py-2 text-slate-400">{c.contract_type ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-emerald-400 font-medium">{fmtSEK(c.annual_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">Inga nya kunder denna månad</p>
              )}
            </div>

            <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Uppsagda avtal</h3>
                <span className="text-sm text-red-400 font-semibold">{snapshot.customers_terminated} st</span>
              </div>
              {snapshot.terminated_customers && snapshot.terminated_customers.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2 font-medium">Kund</th>
                        <th className="px-3 py-2 font-medium">Avtalstyp</th>
                        <th className="px-3 py-2 font-medium text-right">Bortfall ARR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {snapshot.terminated_customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-white">{c.company_name}</td>
                          <td className="px-3 py-2 text-slate-400">{c.contract_type ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-red-400 font-medium">−{fmtSEK(c.annual_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">Inga uppsägningar denna månad</p>
              )}
            </div>
          </section>

          {/* ─── Sektion 6: Top kunder ─── */}
          {snapshot.top_customers_by_arr && snapshot.top_customers_by_arr.length > 0 && (
            <section className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Topp 10 kunder efter ARR</h3>
                <span className="text-xs text-slate-500">
                  Totalt: {fmtSEK(snapshot.top_customers_by_arr.reduce((s, c) => s + c.annual_value, 0))}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium w-10">#</th>
                      <th className="px-3 py-2 font-medium">Kund</th>
                      <th className="px-3 py-2 font-medium">Avtalstyp</th>
                      <th className="px-3 py-2 font-medium text-right">ARR</th>
                      <th className="px-3 py-2 font-medium text-right w-24">Andel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {snapshot.top_customers_by_arr.map((c, idx) => {
                      const totalArr = snapshot.arr_sek
                      const pct = totalArr > 0 ? (c.annual_value / totalArr) * 100 : 0
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 text-white">{c.company_name}</td>
                          <td className="px-3 py-2 text-slate-400">{c.contract_type ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-white font-medium">{fmtSEK(c.annual_value)}</td>
                          <td className="px-3 py-2 text-right text-slate-400 text-xs">{pct.toFixed(1)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ─── Sektion 7: Fakturering ─── */}
          <section className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Fakturering</h3>
              <span className="text-xs text-slate-500">12 mån trend</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoicedTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtSEKShort} />
                    <Tooltip content={<ChartTooltip format={fmtSEK} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Bar dataKey="Fakturerat" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Betalt" fill="#20c58f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="p-3 bg-slate-900/40 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    Fakturerat
                  </div>
                  <div className="text-lg font-bold text-white">{fmtSEK(snapshot.invoiced_sek)}</div>
                </div>
                <div className="p-3 bg-slate-900/40 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Betalt
                  </div>
                  <div className="text-lg font-bold text-emerald-400">{fmtSEK(snapshot.paid_sek)}</div>
                </div>
                <div className="p-3 bg-slate-900/40 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Utestående
                  </div>
                  <div className="text-lg font-bold text-amber-400">{fmtSEK(snapshot.outstanding_sek)}</div>
                </div>
                <div className="p-3 bg-slate-900/40 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    Förfallna
                  </div>
                  <div className="text-lg font-bold text-red-400">{fmtSEK(snapshot.overdue_sek)}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Sektion 8: Cron-aktivitet ─── */}
          <section className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-400" />
                Systemaktivitet
              </h3>
              <span className="text-xs text-slate-500">{data!.cronRuns.length} körningar</span>
            </div>
            {data!.cronRuns.length > 0 ? (
              <div className="space-y-2">
                {data!.cronRuns.map(run => <CronRunCard key={run.id} run={run} />)}
              </div>
            ) : (
              <div className="text-sm text-slate-500 py-4 text-center">
                Inga cron-körningar loggade för denna månad. Loggning aktiverades nyligen — historik byggs upp framöver.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

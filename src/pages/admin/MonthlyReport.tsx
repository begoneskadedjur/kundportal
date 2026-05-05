// src/pages/admin/MonthlyReport.tsx
// Månadsrapport för avtalskunder + cron-aktivitet
// Chefsekonom-perspektiv: KPI:er, kundförändringar, portföljmix, cron-körningar, fakturering

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
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
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { MonthlyReportService } from '../../services/monthlyReportService'
import type {
  MonthlyReportData,
  MonthlyCustomerSnapshot,
  CronRun,
} from '../../types/monthlyReport'

const fmtSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtMonth = (key: string) => {
  const d = new Date(key)
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
}

interface DiffProps {
  current: number
  previous?: number
  format?: (n: number) => string
  inverse?: boolean // röd om uppåt (t.ex. uppsagda)
}

function Diff({ current, previous, format = (n) => n.toString(), inverse = false }: DiffProps) {
  if (previous === undefined || previous === null) return null
  const delta = current - previous
  if (delta === 0) return <span className="text-xs text-slate-500">±0</span>
  const isUp = delta > 0
  const positive = inverse ? !isUp : isUp
  const Icon = isUp ? TrendingUp : TrendingDown
  const color = positive ? 'text-emerald-400' : 'text-red-400'
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {delta > 0 ? '+' : ''}{format(delta)}
    </span>
  )
}

interface KPICardProps {
  label: string
  value: string
  diff?: { current: number; previous?: number; format?: (n: number) => string; inverse?: boolean }
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
}

function KPICard({ label, value, diff, icon: Icon, iconColor = 'text-[#20c58f]' }: KPICardProps) {
  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {diff && (
        <div className="mt-1">
          <Diff {...diff} />
          <span className="text-xs text-slate-500 ml-1">vs förra månaden</span>
        </div>
      )}
    </div>
  )
}

function CronRunCard({ run }: { run: CronRun }) {
  const [expanded, setExpanded] = useState(false)
  const statusConfig = {
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle, label: 'Lyckad' },
    partial: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertTriangle, label: 'Delvis' },
    failed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle, label: 'Misslyckad' },
    running: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', icon: RefreshCw, label: 'Pågår' },
  }[run.status]
  const Icon = statusConfig.icon
  const started = new Date(run.started_at)
  const finished = run.finished_at ? new Date(run.finished_at) : null
  const durationMs = finished ? finished.getTime() - started.getTime() : null
  const duration = durationMs !== null
    ? durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`
    : 'pågår'

  return (
    <div className={`${statusConfig.bg} ${statusConfig.border} border rounded-xl overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${statusConfig.text}`} />
          <div>
            <div className="text-sm font-medium text-white">{run.job_name}</div>
            <div className="text-xs text-slate-500">
              {started.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}{duration}
              {' · '}<span className={statusConfig.text}>{statusConfig.label}</span>
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/50">
          {run.error_message && (
            <div className="text-xs text-red-400 mb-2">
              <span className="font-semibold">Fel:</span> {run.error_message}
            </div>
          )}
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all bg-slate-900/50 p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(run.summary, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function MonthlyReport() {
  const navigate = useNavigate()
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [data, setData] = useState<MonthlyReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Månadsrapport - BeGone Admin'
    MonthlyReportService.listAvailableMonths()
      .then(list => {
        setMonths(list)
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

  const netRetention = useMemo(() => {
    if (!prev || prev.arr_sek === 0) return null
    return (snapshot!.arr_sek / prev.arr_sek) * 100
  }, [snapshot, prev])

  const contractTypeRows = useMemo(() => {
    if (!snapshot?.by_contract_type) return []
    return Object.entries(snapshot.by_contract_type)
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.arr - a.arr)
  }, [snapshot])

  const freqRows = useMemo(() => {
    if (!snapshot?.by_billing_frequency) return []
    return Object.entries(snapshot.by_billing_frequency).sort((a, b) => b[1] - a[1])
  }, [snapshot])

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
        <div className="space-y-6">
          {snapshot.is_estimated && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Denna månad är historiskt uppskattad — exakta siffror finns från och med första körningen av snapshot-cronet.</span>
            </div>
          )}

          {/* Sektion 1: Exekutiv översikt */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Exekutiv översikt</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard
                label="ARR (Annual Recurring Revenue)"
                value={fmtSEK(snapshot.arr_sek)}
                icon={TrendingUp}
                diff={{ current: snapshot.arr_sek, previous: prev?.arr_sek, format: fmtSEK }}
              />
              <KPICard
                label="MRR (Monthly Recurring Revenue)"
                value={fmtSEK(snapshot.mrr_sek)}
                icon={DollarSign}
                diff={{ current: snapshot.mrr_sek, previous: prev?.mrr_sek, format: fmtSEK }}
              />
              <KPICard
                label="Aktiva avtalskunder"
                value={String(snapshot.total_active_customers)}
                icon={Users}
                diff={{ current: snapshot.total_active_customers, previous: prev?.total_active_customers }}
              />
              <KPICard
                label="Net Retention"
                value={netRetention !== null ? `${netRetention.toFixed(1)}%` : '—'}
                icon={netRetention !== null && netRetention >= 100 ? TrendingUp : TrendingDown}
                iconColor={netRetention !== null && netRetention >= 100 ? 'text-emerald-400' : 'text-amber-400'}
              />
              <KPICard
                label="Tillkommit denna månad"
                value={String(snapshot.customers_added)}
                icon={CheckCircle}
                iconColor="text-emerald-400"
              />
              <KPICard
                label="Uppsagt denna månad"
                value={String(snapshot.customers_terminated)}
                icon={XCircle}
                iconColor="text-red-400"
              />
              <KPICard
                label="Fakturerat"
                value={fmtSEK(snapshot.invoiced_sek)}
                icon={Receipt}
                diff={{ current: snapshot.invoiced_sek, previous: prev?.invoiced_sek, format: fmtSEK }}
              />
              <KPICard
                label="Betalt"
                value={fmtSEK(snapshot.paid_sek)}
                icon={DollarSign}
                iconColor="text-emerald-400"
                diff={{ current: snapshot.paid_sek, previous: prev?.paid_sek, format: fmtSEK }}
              />
            </div>
          </section>

          {/* Sektion 2: Kundförändringar */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Kundförändringar</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Tillkommit */}
              <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Tillkommit ({snapshot.customers_added})
                  </h3>
                </div>
                {snapshot.added_customers && snapshot.added_customers.length > 0 ? (
                  <div className="space-y-1.5">
                    {snapshot.added_customers.map((c) => (
                      <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-slate-700/30 last:border-0 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="text-white truncate">{c.company_name}</div>
                          <div className="text-xs text-slate-500">{c.contract_type ?? 'Ej angivet'}</div>
                        </div>
                        <div className="text-emerald-400 font-medium ml-3 whitespace-nowrap">{fmtSEK(c.annual_value)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2">Inga nya kunder denna månad</p>
                )}
              </div>

              {/* Uppsagt */}
              <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Uppsagt ({snapshot.customers_terminated})
                  </h3>
                </div>
                {snapshot.terminated_customers && snapshot.terminated_customers.length > 0 ? (
                  <div className="space-y-1.5">
                    {snapshot.terminated_customers.map((c) => (
                      <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-slate-700/30 last:border-0 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="text-white truncate">{c.company_name}</div>
                          <div className="text-xs text-slate-500">{c.contract_type ?? 'Ej angivet'}</div>
                        </div>
                        <div className="text-red-400 font-medium ml-3 whitespace-nowrap">-{fmtSEK(c.annual_value)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2">Inga uppsägningar denna månad</p>
                )}
              </div>
            </div>

            {/* Status-fördelning */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Aktiva
                </div>
                <div className="text-xl font-bold text-white">{snapshot.total_active_customers}</div>
                <Diff current={snapshot.total_active_customers} previous={prev?.total_active_customers} />
              </div>
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                  <PauseCircle className="w-3.5 h-3.5" />
                  Pausade
                </div>
                <div className="text-xl font-bold text-white">{snapshot.total_paused_customers}</div>
                <Diff current={snapshot.total_paused_customers} previous={prev?.total_paused_customers} inverse />
              </div>
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Utgångna
                </div>
                <div className="text-xl font-bold text-white">{snapshot.total_expired_customers}</div>
                <Diff current={snapshot.total_expired_customers} previous={prev?.total_expired_customers} inverse />
              </div>
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-red-400 mb-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Uppsagda (totalt)
                </div>
                <div className="text-xl font-bold text-white">{snapshot.total_terminated_customers}</div>
                <Diff current={snapshot.total_terminated_customers} previous={prev?.total_terminated_customers} inverse />
              </div>
            </div>
          </section>

          {/* Sektion 3: Portföljmix */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Portföljmix</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Avtalstyp */}
              <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Per avtalstyp</h3>
                {contractTypeRows.length > 0 ? (
                  <div className="space-y-2">
                    {contractTypeRows.map((row) => {
                      const totalArr = contractTypeRows.reduce((s, r) => s + r.arr, 0)
                      const pct = totalArr > 0 ? (row.arr / totalArr) * 100 : 0
                      return (
                        <div key={row.type}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-white truncate mr-3">{row.type}</span>
                            <span className="text-slate-300 whitespace-nowrap">
                              {row.count} st · {fmtSEK(row.arr)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#20c58f]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Ingen data</p>
                )}
              </div>

              {/* Faktureringsfrekvens */}
              <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Per faktureringsfrekvens</h3>
                {freqRows.length > 0 ? (
                  <div className="space-y-2">
                    {freqRows.map(([freq, count]) => {
                      const total = freqRows.reduce((s, [, c]) => s + c, 0)
                      const pct = total > 0 ? (count / total) * 100 : 0
                      const labels: Record<string, string> = {
                        monthly: 'Månadsvis',
                        quarterly: 'Kvartalsvis',
                        annual: 'Årsvis',
                        on_demand: 'Vid behov',
                      }
                      return (
                        <div key={freq}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-white">{labels[freq] ?? freq}</span>
                            <span className="text-slate-300">{count} st</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Ingen data</p>
                )}
              </div>
            </div>

            {/* Top 10 */}
            {snapshot.top_customers_by_arr && snapshot.top_customers_by_arr.length > 0 && (
              <div className="mt-3 p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Top kunder efter ARR</h3>
                <div className="space-y-1">
                  {snapshot.top_customers_by_arr.map((c, idx) => (
                    <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-slate-700/30 last:border-0 text-sm">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-slate-500 text-xs w-5 text-right">{idx + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-white truncate">{c.company_name}</div>
                          <div className="text-xs text-slate-500">{c.contract_type ?? '—'}</div>
                        </div>
                      </div>
                      <div className="text-[#20c58f] font-medium ml-3 whitespace-nowrap">{fmtSEK(c.annual_value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Sektion 4: Cron-aktivitet */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Systemaktivitet (cron-körningar)
            </h2>
            {data!.cronRuns.length > 0 ? (
              <div className="space-y-2">
                {data!.cronRuns.map(run => <CronRunCard key={run.id} run={run} />)}
              </div>
            ) : (
              <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl text-sm text-slate-500">
                Inga cron-körningar loggade för denna månad. Loggning aktiverades nyligen — historik byggs upp framöver.
              </div>
            )}
          </section>

          {/* Sektion 5: Fakturering */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Fakturering</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPICard
                label="Fakturerat"
                value={fmtSEK(snapshot.invoiced_sek)}
                icon={Receipt}
              />
              <KPICard
                label="Betalt"
                value={fmtSEK(snapshot.paid_sek)}
                icon={DollarSign}
                iconColor="text-emerald-400"
              />
              <KPICard
                label="Utestående"
                value={fmtSEK(snapshot.outstanding_sek)}
                icon={Clock}
                iconColor="text-amber-400"
              />
              <KPICard
                label="Förfallna"
                value={fmtSEK(snapshot.overdue_sek)}
                icon={AlertTriangle}
                iconColor="text-red-400"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

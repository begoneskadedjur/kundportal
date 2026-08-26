// src/pages/technician/TechnicianCommissions.tsx — Min provision (Provisioner 2.0)
//
// Grupperar på payout_month via SAMMA groupPostsByPayoutMonth som adminvyn —
// poängen är att teknikern ser exakt den summa som kommer på lönen. Status i
// klartext, inga piller, bara egna poster.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Wallet, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProvisionService } from '../../services/provisionService'
import type { CommissionPost, CommissionStatus } from '../../types/provision'
import {
  DEFAULT_PAYOUT_CUTOFF_DAY,
  UNPAID_AGE_WARNING_DAYS,
  daysSince,
  formatPayoutMonthLower,
  groupPostsByPayoutMonth,
  monthlyEarnedSeries,
  payoutSalaryLabel
} from '../../utils/provisionPayout'
import { FlowBand, Sparkline } from '../../components/shared/ProvisionCharts'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Button from '../../components/ui/Button'

/** Samma statusfärger som adminvyn. */
const STATUS_DOT: Record<CommissionStatus, string> = {
  pending_invoice: '#64748b',
  ready_for_payout: '#60a5fa',
  approved: '#20c58f',
  paid_out: '#475569'
}

/** Klartext: teknikern ska aldrig behöva tolka "pending_invoice". */
function statusText(post: CommissionPost, monthKey: string, now: Date): { text: string; age: boolean } {
  switch (post.status) {
    case 'pending_invoice': {
      const age = daysSince(post.created_at, now)
      return {
        text: `Kunden har inte betalat fakturan än (${age} dgr)`,
        age: age > UNPAID_AGE_WARNING_DAYS
      }
    }
    case 'ready_for_payout':
      return {
        text: post.invoice_paid_date
          ? `Betald ${post.invoice_paid_date.slice(0, 10)} → utbetalas med ${payoutSalaryLabel(monthKey)}`
          : `Klar för utbetalning → utbetalas med ${payoutSalaryLabel(monthKey)}`,
        age: false
      }
    case 'approved':
      return { text: `Godkänd → utbetalas med ${payoutSalaryLabel(monthKey)}`, age: false }
    case 'paid_out':
      return { text: `Utbetald med ${payoutSalaryLabel(post.payout_month || monthKey)} ✓`, age: false }
  }
}

function shareLabel(share: number): string {
  if (share >= 100) return ''
  if (Math.abs(share - 50) < 0.01) return ', ½ andel'
  if (Math.abs(share - 33.33) < 0.5) return ', ⅓ andel'
  return `, ${share} % andel`
}

export default function TechnicianCommissions() {
  const { profile, technician, availableViews } = useAuth()
  const hasTechnicianView = availableViews.includes('technician')
  const navigate = useNavigate()

  const technicianId = profile?.technician_id || technician?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allPosts, setAllPosts] = useState<CommissionPost[]>([])
  const [cutoffDay, setCutoffDay] = useState<number>(DEFAULT_PAYOUT_CUTOFF_DAY)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  const now = useMemo(() => new Date(), [])

  // Auth guard
  useEffect(() => {
    if (!hasTechnicianView || !technicianId) {
      navigate('/login', { replace: true })
    }
  }, [hasTechnicianView, technicianId, navigate])

  const loadData = useCallback(async () => {
    if (!technicianId) return
    try {
      setLoading(true)
      setError(null)
      const [posts, settings] = await Promise.all([
        ProvisionService.getPostsForTechnician(technicianId),
        ProvisionService.getSettings()
      ])
      // Egna poster, alltid (RLS-skuld finns kvar — filtrera även klientsidan)
      setAllPosts(posts.filter(p => p.technician_id === technicianId))
      setCutoffDay(settings.payout_cutoff_day || DEFAULT_PAYOUT_CUTOFF_DAY)
    } catch (err) {
      console.error('Fel vid laddning av provisioner:', err)
      setError(err instanceof Error ? err.message : 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }, [technicianId])

  useEffect(() => {
    if (technicianId) loadData()
  }, [technicianId, loadData])

  // ─── Månadsgrupper: SAMMA logik som adminvyn ────────────────
  const payoutMonths = useMemo(
    () => groupPostsByPayoutMonth(allPosts, cutoffDay, now),
    [allPosts, cutoffDay, now]
  )

  // ─── Årsöversikt ────────────────────────────────────────────
  const overview = useMemo(() => {
    const year = now.getFullYear()
    let earned = 0, earnedCount = 0
    let pending = 0, pendingCount = 0, oldest = 0
    let ready = 0, readyCount = 0
    let approved = 0, approvedCount = 0
    let paid = 0
    let lastPaidAt: string | null = null

    for (const p of allPosts) {
      const createdYear = new Date(p.created_at).getFullYear()
      if (createdYear === year) {
        earned += p.commission_amount
        earnedCount++
      }
      switch (p.status) {
        case 'pending_invoice': {
          pending += p.commission_amount
          pendingCount++
          const age = daysSince(p.created_at, now)
          if (age > oldest) oldest = age
          break
        }
        case 'ready_for_payout':
          ready += p.commission_amount
          readyCount++
          break
        case 'approved':
          approved += p.commission_amount
          approvedCount++
          break
        case 'paid_out':
          if (p.payout_month?.startsWith(String(year)) || createdYear === year) {
            paid += p.commission_amount
          }
          if (p.paid_out_at && (!lastPaidAt || p.paid_out_at > lastPaidAt)) lastPaidAt = p.paid_out_at
          break
      }
    }

    return {
      earned, earnedCount,
      avgPerCase: earnedCount > 0 ? earned / earnedCount : 0,
      pending, pendingCount, oldest, pendingWarn: oldest > UNPAID_AGE_WARNING_DAYS,
      ready, readyCount,
      approved, approvedCount,
      forPayout: ready + approved,
      forPayoutCount: readyCount + approvedCount,
      paid, lastPaidAt
    }
  }, [allPosts, now])

  // 12-månaders sparkline på egna poster
  const yearSeries = useMemo(() => monthlyEarnedSeries(allPosts, 12, now), [allPosts, now])

  // Nästa utbetalning = tidigaste payout-månad som inte är färdigutbetald
  const nextPayout = useMemo(() => {
    const open = payoutMonths
      .filter(g => g.statuses.ready > 0 || g.statuses.approved > 0)
      .sort((a, b) => a.month_key.localeCompare(b.month_key))
    return open[0] || null
  }, [payoutMonths])

  // Auto-expandera nästa utbetalningsmånad (annars första gruppen)
  useEffect(() => {
    if (payoutMonths.length === 0) return
    setExpandedMonths(prev => {
      if (prev.size > 0) return prev
      return new Set([(nextPayout || payoutMonths[0]).month_key])
    })
  }, [payoutMonths, nextPayout])

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="p-8 max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Problem med att ladda provisioner</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={loadData} className="w-full">Försök igen</Button>
              <Button variant="outline" onClick={() => navigate('/technician/dashboard')} className="w-full">
                Tillbaka till dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* ═══ SIDHUVUD ═══ */}
      <div className="flex items-start gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">Min provision</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dina provisionsposter · samma siffror som lönen
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end flex-shrink-0">
          <Sparkline
            values={yearSeries}
            width={200}
            height={36}
            title="Min provision per månad, 12 månader"
          />
          <div className="flex justify-between w-[200px] text-[8px] text-slate-500 -mt-1">
            <span>{formatPayoutMonthLower(monthKeyOffset(now, -11)).split(' ')[0].slice(0, 3)}</span>
            <span>{formatPayoutMonthLower(monthKeyOffset(now, 0)).split(' ')[0].slice(0, 3)}</span>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
          title="Uppdatera"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ═══ ÅRSÖVERSIKT — en yta, hårfina avdelare ═══ */}
      <div className="flex flex-wrap bg-slate-800/40 border-y border-slate-700">
        <OverviewCell
          label="Intjänat i år"
          value={formatCurrency(overview.earned)}
          hint={`${overview.earnedCount} ärenden · snitt ${formatCurrency(overview.avgPerCase)}`}
        />
        <OverviewCell
          label="Väntar på kundbetalning"
          value={formatCurrency(overview.pending)}
          suffix={`· ${overview.pendingCount} post${overview.pendingCount !== 1 ? 'er' : ''}`}
          hint={overview.pendingCount > 0 ? `äldsta ${overview.oldest} dgr` : 'inget väntar'}
          hintWarn={overview.pendingWarn}
        />
        <OverviewCell
          label="Klart för utbetalning"
          value={formatCurrency(overview.forPayout)}
          valueTone="brand"
          suffix={`· ${overview.forPayoutCount} post${overview.forPayoutCount !== 1 ? 'er' : ''}`}
          hint={nextPayout ? `utbetalas med ${payoutSalaryLabel(nextPayout.month_key)}` : undefined}
        />
        <OverviewCell
          label="Utbetalt i år"
          value={formatCurrency(overview.paid)}
          hint={overview.lastPaidAt ? `senast ${overview.lastPaidAt.slice(0, 10)}` : undefined}
          calm
        />
      </div>

      {/* ═══ NÄSTA UTBETALNING ═══ */}
      {nextPayout && (
        <div className="flex items-center gap-5 px-4 py-3 bg-[#20c58f]/[0.04] border-b border-slate-700/50">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              Nästa utbetalning
            </div>
            <div className="text-[15px] font-bold text-white tabular-nums">
              Med {payoutSalaryLabel(nextPayout.month_key)}:{' '}
              <span className="text-[#20c58f]">{formatCurrency(nextPayout.total_commission)}</span>
              {' · '}{nextPayout.post_count} post{nextPayout.post_count !== 1 ? 'er' : ''}
            </div>
            <div className="text-[11.5px] text-slate-400 mt-px tabular-nums">
              {formatCurrency(nextPayout.status_totals.approved)} godkänt av löneadmin ·{' '}
              {formatCurrency(nextPayout.status_totals.ready)} klart, väntar på godkännande
            </div>
          </div>

          <FlowBand
            segments={[
              { label: 'Väntar', value: overview.pending, tone: 'slate' },
              { label: 'Redo', value: overview.ready, tone: 'dim' },
              { label: 'Klart', value: overview.approved, tone: 'brand' }
            ]}
            width={180}
            height={11}
            showLabels
            title="Mina pengar: väntar, redo, klart"
            className="hidden sm:block flex-shrink-0"
          />
        </div>
      )}

      {/* ═══ MÅNADSGRUPPER (payout_month) ═══ */}
      {payoutMonths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Wallet className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Inga provisionsposter hittades.</p>
        </div>
      ) : (
        <div>
          {payoutMonths.map(month => {
            const expanded = expandedMonths.has(month.month_key)
            const isNext = nextPayout?.month_key === month.month_key
            const allPaid = month.paid_out_date !== null

            return (
              <div key={month.month_key} className="border-b border-slate-700/50">
                <button
                  onClick={() => toggleMonth(month.month_key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 hover:bg-slate-700/30 transition-colors border-l-2 ${
                    isNext ? 'border-l-[#20c58f]' : 'border-l-transparent'
                  }`}
                >
                  {expanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}

                  <span className="text-[13.5px] font-bold text-white">
                    {formatPayoutMonthLower(month.month_key)}
                  </span>

                  <div className="flex-1" />

                  <span className="text-xs text-slate-400 tabular-nums">
                    {month.post_count} post{month.post_count !== 1 ? 'er' : ''} ·{' '}
                    <span className="text-white font-semibold">{formatCurrency(month.total_commission)}</span>
                    {month.preliminary
                      ? <span className="text-slate-500"> · preliminärt – flyttas när fakturan betalas</span>
                      : allPaid
                        ? <span className="text-slate-500"> · utbetald {month.paid_out_date?.slice(0, 10)}</span>
                        : <span className="text-slate-500"> · utbetalas med {payoutSalaryLabel(month.month_key)}</span>}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-slate-700/50"
                    >
                      {month.posts.map(post => (
                        <TechPostRow
                          key={post.id}
                          post={post}
                          monthKey={month.month_key}
                          now={now}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          <div className="flex justify-between px-3 py-2 text-xs text-slate-500">
            <span>
              {payoutMonths.length} utbetalningsmånad{payoutMonths.length !== 1 ? 'er' : ''} · {allPosts.length} poster
            </span>
            <span className="text-slate-300 font-semibold tabular-nums">
              Intjänat i år: {formatCurrency(overview.earned)}
            </span>
          </div>
        </div>
      )}

      {/* ═══ SÅ FUNKAR FLÖDET ═══ */}
      <div className="mt-4 px-4 py-3 bg-slate-800/40 border-t border-slate-700">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          Så funkar flödet
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <FlowStep color={STATUS_DOT.pending_invoice} text="Ärende avslutat → provision registreras" />
          <span className="text-[11px] text-slate-500">→</span>
          <FlowStep color={STATUS_DOT.ready_for_payout} text="Kundfaktura betald → klar för utbetalning (automatiskt)" />
          <span className="text-[11px] text-slate-500">→</span>
          <FlowStep color={STATUS_DOT.approved} text="Godkänd av löneadmin" />
          <span className="text-[11px] text-slate-500">→</span>
          <FlowStep color={STATUS_DOT.paid_out} text="Utbetald med lönen" dim />
        </div>
      </div>
    </div>
  )
}

// ─── Årsöversiktscell ────────────────────────────────────────────

function OverviewCell({ label, value, suffix, hint, hintWarn, valueTone, calm }: {
  label: string
  value: string
  suffix?: string
  hint?: string
  hintWarn?: boolean
  valueTone?: 'brand'
  calm?: boolean
}) {
  return (
    <div className="flex-1 min-w-[170px] px-4 py-2.5 border-l border-slate-700/50 first:border-l-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className={`tabular-nums ${calm ? 'text-sm font-semibold text-slate-300' : 'text-[15px] font-bold'} ${
        valueTone === 'brand' ? 'text-[#20c58f]' : calm ? '' : 'text-white'
      }`}>
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-slate-400">{suffix}</span>}
      </div>
      {hint && (
        <div className={`text-[10px] mt-px ${hintWarn ? 'text-amber-400' : 'text-slate-500'}`}>{hint}</div>
      )}
    </div>
  )
}

// ─── Postrad (read-only, klartext) ───────────────────────────────

function TechPostRow({ post, monthKey, now }: {
  post: CommissionPost
  monthKey: string
  now: Date
}) {
  const status = statusText(post, monthKey, now)
  const dim = post.status === 'paid_out'

  return (
    <div className={`flex items-center gap-2.5 pl-5 pr-3 py-2 text-[12.5px] bg-slate-950/25 border-b border-slate-700/50 last:border-b-0`}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: STATUS_DOT[post.status] }}
      />

      <span className={`font-mono text-[11.5px] font-semibold w-[104px] flex-shrink-0 truncate ${dim ? 'text-slate-500' : 'text-white'}`}>
        {post.case_number || '—'}
      </span>

      <span className={`truncate min-w-0 flex-1 ${dim ? 'text-slate-500' : 'text-slate-300'}`}>
        {post.case_title || '—'}
      </span>

      <span className="tabular-nums whitespace-nowrap flex-shrink-0 w-[220px] text-right">
        <span className="text-slate-500">{post.base_amount.toLocaleString('sv-SE')} kr</span>
        <span className="text-slate-500"> → </span>
        <span className={dim ? 'text-slate-500' : 'text-white font-semibold'}>
          {formatCurrency(post.commission_amount)}
        </span>
        <span className="text-slate-500 text-[11px]">
          {' '}({post.commission_percentage} %{shareLabel(post.share_percentage)}{post.is_rot_rut ? ' · ROT' : ''})
        </span>
      </span>

      <span className={`w-[280px] flex-shrink-0 truncate ${
        status.age ? 'text-amber-400' : dim ? 'text-slate-500' : 'text-slate-300'
      }`}>
        {status.text}
      </span>
    </div>
  )
}

function FlowStep({ color, text, dim }: { color: string; text: string; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] whitespace-nowrap ${dim ? 'text-slate-500' : 'text-slate-300'}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {text}
    </span>
  )
}

/** 'YYYY-MM' för now + offset månader (etiketter på 12-månaderskurvan). */
function monthKeyOffset(now: Date, offset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

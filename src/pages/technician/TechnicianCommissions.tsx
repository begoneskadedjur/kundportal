// src/pages/technician/TechnicianCommissions.tsx — Teknikerns provisionsvy (nya systemet)
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, RefreshCw, DollarSign, Calendar, FileText, TrendingUp,
  ChevronDown, ChevronRight, AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProvisionService } from '../../services/provisionService'
import {
  COMMISSION_STATUS_CONFIG,
  formatSwedishMonth,
  type CommissionPost
} from '../../types/provision'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

// ─── Lokala typer ─────────────────────────────────────────

interface MonthSummary {
  month_key: string
  month_label: string
  posts: CommissionPost[]
  total_commission: number
  post_count: number
  statuses: { pending: number; ready: number; approved: number; paid: number }
}

const caseTypeBadge: Record<string, { label: string; cls: string }> = {
  private: { label: 'Privat', cls: 'bg-blue-500/20 text-blue-400' },
  business: { label: 'Företag', cls: 'bg-purple-500/20 text-purple-400' },
  contract: { label: 'Avtal', cls: 'bg-teal-500/20 text-teal-400' },
}

// ─── Komponent ────────────────────────────────────────────

export default function TechnicianCommissions() {
  const { profile, technician, isTechnician } = useAuth()
  const navigate = useNavigate()

  const technicianId = profile?.technician_id || technician?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allPosts, setAllPosts] = useState<CommissionPost[]>([])
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  // Auth guard
  useEffect(() => {
    if (!isTechnician || !technicianId) {
      navigate('/login', { replace: true })
    }
  }, [isTechnician, technicianId, navigate])

  // Data loading
  const loadData = useCallback(async () => {
    if (!technicianId) return
    try {
      setLoading(true)
      setError(null)
      const posts = await ProvisionService.getPostsForTechnician(technicianId)
      setAllPosts(posts)
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

  // Gruppera poster per månad
  const monthlySummaries: MonthSummary[] = useMemo(() => {
    const byMonth = new Map<string, CommissionPost[]>()

    for (const post of allPosts) {
      const date = new Date(post.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(post)
    }

    return Array.from(byMonth.entries())
      .map(([key, posts]) => {
        const statuses = { pending: 0, ready: 0, approved: 0, paid: 0 }
        for (const p of posts) {
          if (p.status === 'pending_invoice') statuses.pending++
          else if (p.status === 'ready_for_payout') statuses.ready++
          else if (p.status === 'approved') statuses.approved++
          else if (p.status === 'paid_out') statuses.paid++
        }
        return {
          month_key: key,
          month_label: formatSwedishMonth(key),
          posts,
          total_commission: posts.reduce((s, p) => s + p.commission_amount, 0),
          post_count: posts.length,
          statuses,
        }
      })
      .sort((a, b) => b.month_key.localeCompare(a.month_key))
  }, [allPosts])

  // KPI:er
  const yearKpis = useMemo(() => {
    const now = new Date()
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentMonthPosts = allPosts.filter(p => {
      const d = new Date(p.created_at)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentKey
    })

    const totalYtd = allPosts.reduce((s, p) => s + p.commission_amount, 0)
    const currentMonthTotal = currentMonthPosts.reduce((s, p) => s + p.commission_amount, 0)

    return {
      total_ytd: totalYtd,
      current_month_total: currentMonthTotal,
      total_cases_ytd: allPosts.length,
      avg_per_case: allPosts.length > 0 ? totalYtd / allPosts.length : 0,
    }
  }, [allPosts])

  // Auto-expand aktuell månad
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (monthlySummaries.length > 0 && expandedMonths.size === 0) {
      const match = monthlySummaries.find(m => m.month_key === currentMonthKey)
      if (match) {
        setExpandedMonths(new Set([match.month_key]))
      } else if (monthlySummaries[0]) {
        setExpandedMonths(new Set([monthlySummaries[0].month_key]))
      }
    }
  }, [monthlySummaries, currentMonthKey])

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ─── Loading / Error ───────────────────────────────────

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

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Mina Provisioner</h1>
                <p className="text-slate-400 text-sm">Provisionsposter med brytdatum och villkor</p>
              </div>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>
        </div>

        {/* ═══ KPI-kort ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Total i år</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(yearKpis.total_ytd)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-[#20c58f]/20 to-emerald-600/20 border-[#20c58f]/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#20c58f] text-sm font-medium">Denna månad</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(yearKpis.current_month_total)}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-[#20c58f]" />
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm font-medium">Antal ärenden</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {yearKpis.total_cases_ytd}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm font-medium">Snitt per ärende</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(yearKpis.avg_per_case)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </Card>
        </div>

        {/* ═══ Månadsaccordion ═══ */}
        {monthlySummaries.length === 0 ? (
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col items-center justify-center py-12 text-slate-500">
            <Wallet className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Inga provisionsposter hittades.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {monthlySummaries.map(month => {
              const isExpanded = expandedMonths.has(month.month_key)
              const isCurrent = month.month_key === currentMonthKey

              return (
                <div
                  key={month.month_key}
                  className={`bg-slate-800/50 rounded-lg border overflow-hidden ${
                    isCurrent ? 'border-emerald-500/40' : 'border-slate-700'
                  }`}
                >
                  {/* Månads-header */}
                  <button
                    onClick={() => toggleMonth(month.month_key)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}

                    <span className="text-white font-medium text-sm">
                      {month.month_label}
                    </span>

                    {isCurrent && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-[#20c58f]/20 text-[#20c58f]">
                        Nu
                      </span>
                    )}

                    {/* Statusbadges */}
                    <div className="flex items-center gap-1.5">
                      {month.statuses.pending > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/10 text-yellow-400">
                          {month.statuses.pending} väntar
                        </span>
                      )}
                      {month.statuses.ready > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400">
                          {month.statuses.ready} redo
                        </span>
                      )}
                      {month.statuses.approved > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/10 text-blue-400">
                          {month.statuses.approved} godkänd
                        </span>
                      )}
                      {month.statuses.paid > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-slate-500/10 text-slate-400">
                          {month.statuses.paid} utbetald
                        </span>
                      )}
                    </div>

                    <div className="flex-1" />

                    <span className="text-xs text-slate-400">
                      {month.post_count} poster
                    </span>

                    <span className="text-white font-medium text-sm">
                      {formatCurrency(month.total_commission)}
                    </span>
                  </button>

                  {/* Expanderbar body */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-700/50">
                          {month.posts.map(post => (
                            <PostRow key={post.id} post={post} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
              <span>
                {monthlySummaries.length} månader · {allPosts.length} poster
              </span>
              <span className="text-slate-300 font-medium">
                Totalt: {formatCurrency(yearKpis.total_ytd)}
              </span>
            </div>
          </div>
        )}
      </div>
  )
}

// ─── Post-rad (read-only) ─────────────────────────────────

function PostRow({ post }: { post: CommissionPost }) {
  const typeBadge = caseTypeBadge[post.case_type] || caseTypeBadge.private
  const statusCfg = COMMISSION_STATUS_CONFIG[post.status]

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/20 transition-colors border-b border-slate-800/50 ml-6">
      <span className="font-mono text-xs text-slate-400 w-24 flex-shrink-0">
        {post.case_number || '—'}
      </span>

      <span className="text-sm text-white truncate max-w-[200px]">
        {post.case_title || '—'}
      </span>

      <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${typeBadge.cls}`}>
        {typeBadge.label}
      </span>

      {post.is_rot_rut && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-[#20c58f]/20 text-[#20c58f] font-medium flex-shrink-0">
          ROT
        </span>
      )}

      <div className="flex-1" />

      <span className="text-xs text-slate-400 flex-shrink-0">
        {post.base_amount.toLocaleString('sv-SE')} kr
      </span>

      <span className="text-xs text-slate-500 flex-shrink-0">→</span>

      <span className="text-sm font-medium text-emerald-400 flex-shrink-0">
        {formatCurrency(post.commission_amount)}
      </span>

      {post.share_percentage < 100 && (
        <span className="text-xs text-slate-500 flex-shrink-0">
          ({post.share_percentage}%)
        </span>
      )}

      <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${statusCfg.bgClass} ${statusCfg.textClass}`}>
        {statusCfg.label}
      </span>
    </div>
  )
}

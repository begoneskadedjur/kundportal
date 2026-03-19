import React, { useState, useEffect } from 'react'
import { FileText, ChevronRight, AlertCircle, Clock, CheckCircle, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'

const APPROACHING_DAYS = 5

interface OfferInsights {
  overdue: number
  atRisk: number
  recentlySigned: number
  avgDaysToSign: number
}

interface Props {
  technicianEmail: string | null | undefined
}

export default function OfferSummaryCard({ technicianEmail }: Props) {
  const [insights, setInsights] = useState<OfferInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (technicianEmail) fetchOfferInsights()
    else setLoading(false)
  }, [technicianEmail])

  const fetchOfferInsights = async () => {
    try {
      const { offers, kpis } = await OfferFollowUpService.getDashboardData(technicianEmail!)

      const now = Date.now()
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

      let overdue = 0
      let atRisk = 0
      let recentlySigned = 0

      for (const o of offers) {
        if (o.status === 'overdue') {
          overdue++
        } else if (o.status === 'pending' && o.age_days >= APPROACHING_DAYS) {
          atRisk++
        } else if (o.status === 'signed' && new Date(o.updated_at).getTime() >= thirtyDaysAgo) {
          recentlySigned++
        }
      }

      const total = overdue + atRisk + recentlySigned
      setInsights(total > 0 ? {
        overdue,
        atRisk,
        recentlySigned,
        avgDaysToSign: kpis.avg_days_to_sign,
      } : null)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Offerter & Avtal</h3>
        </div>
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-8 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!insights) return null

  const hasUrgent = insights.overdue > 0

  return (
    <div className={`bg-slate-800/30 border rounded-xl p-3 ${hasUrgent ? 'border-red-500/40' : 'border-slate-700'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className={`w-4 h-4 ${hasUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          <h3 className="text-sm font-semibold text-white">Offerter & Avtal</h3>
        </div>
        <Link to="/technician/offer-follow-up" className="text-xs text-[#20c58f] font-medium hover:underline">
          Visa alla
        </Link>
      </div>

      <div className="space-y-1">
        {/* Overdue — must contact */}
        {insights.overdue > 0 && (
          <Link
            to="/technician/offer-follow-up"
            className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <span className="text-sm text-slate-300">
                <span className="text-white font-semibold">{insights.overdue}</span>
                {' '}förfallen{insights.overdue > 1 ? 'a' : ''} — <span className="text-red-400">kontakta kund</span>
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </Link>
        )}

        {/* At risk — needs follow-up */}
        {insights.atRisk > 0 && (
          <Link
            to="/technician/offer-follow-up"
            className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-sm text-slate-300">
                <span className="text-white font-semibold">{insights.atRisk}</span>
                {' '}pågående &gt;{APPROACHING_DAYS}d — <span className="text-amber-400">behöver uppföljning</span>
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </Link>
        )}

        {/* Recently signed */}
        {insights.recentlySigned > 0 && (
          <Link
            to="/technician/offer-follow-up"
            className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-sm text-slate-300">
                <span className="text-white font-semibold">{insights.recentlySigned}</span>
                {' '}nyligen signerade
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </Link>
        )}
      </div>

      {/* Average days to sign */}
      {insights.avgDaysToSign > 0 && (
        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-700/50">
          <Timer className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            Snitt till signering: <span className="text-slate-300 font-medium">{insights.avgDaysToSign} dagar</span>
          </span>
        </div>
      )}
    </div>
  )
}

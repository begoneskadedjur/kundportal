import React, { useState, useEffect } from 'react'
import { FileText, ChevronRight, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'

const APPROACHING_DEADLINE_DAYS = 10

interface OfferCounts {
  overdue: number
  atRisk: number
  recentlySigned: number
  declined: number
}

interface Props {
  technicianEmail: string | null | undefined
}

export default function OfferSummaryCard({ technicianEmail }: Props) {
  const [counts, setCounts] = useState<OfferCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (technicianEmail) fetchOfferData()
    else setLoading(false)
  }, [technicianEmail])

  const fetchOfferData = async () => {
    try {
      const { data: contracts } = await supabase
        .from('contracts')
        .select('id, status, total_value, created_at, updated_at')
        .eq('begone_employee_email', technicianEmail!)
        .in('status', ['pending', 'overdue', 'signed', 'declined'])

      if (!contracts || contracts.length === 0) {
        setCounts(null)
        setLoading(false)
        return
      }

      const now = Date.now()
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

      let overdue = 0
      let atRisk = 0
      let recentlySigned = 0
      let declined = 0

      for (const c of contracts) {
        const ageDays = Math.floor((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
        const updatedAt = new Date(c.updated_at).getTime()

        if (c.status === 'overdue') {
          overdue++
        } else if (c.status === 'pending' && ageDays >= APPROACHING_DEADLINE_DAYS) {
          atRisk++
        } else if (c.status === 'signed' && updatedAt >= thirtyDaysAgo) {
          recentlySigned++
        } else if (c.status === 'declined' && updatedAt >= thirtyDaysAgo) {
          declined++
        }
      }

      const total = overdue + atRisk + recentlySigned + declined
      setCounts(total > 0 ? { overdue, atRisk, recentlySigned, declined } : null)
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

  if (!counts) return null

  const rows = [
    { label: 'Förfallen', count: counts.overdue, icon: AlertCircle, color: 'text-red-400', bgClass: 'bg-red-500/20' },
    { label: 'Förfaller snart', count: counts.atRisk, icon: Clock, color: 'text-amber-400', bgClass: 'bg-amber-500/20' },
    { label: 'Nyligen signerade', count: counts.recentlySigned, icon: CheckCircle, color: 'text-emerald-400', bgClass: 'bg-emerald-500/20' },
    { label: 'Avfärdade', count: counts.declined, icon: XCircle, color: 'text-slate-400', bgClass: 'bg-slate-500/20' },
  ]

  const hasUrgent = counts.overdue > 0

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
        {rows.map(({ label, count, icon: Icon, color, bgClass }) => {
          if (count === 0) return null
          return (
            <Link
              key={label}
              to="/technician/offer-follow-up"
              className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded-md ${bgClass} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <span className="text-sm text-slate-300">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{count}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

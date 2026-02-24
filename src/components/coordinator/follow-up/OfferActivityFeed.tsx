// src/components/coordinator/follow-up/OfferActivityFeed.tsx
// Kompakt aktivitetsflöde för offerthändelser (skickade, signerade, nekade, förfallna, raderade)

import { useState, useEffect } from 'react'
import {
  Activity, ChevronDown, ChevronUp, FileSignature, CheckCircle,
  XCircle, Clock, Trash2, Loader2,
} from 'lucide-react'
import { getOfferEventLog } from '../../../services/caseDeleteService'
import { formatDistanceToNow } from '../../../utils/dateUtils'

interface OfferActivityFeedProps {
  technicianEmail?: string
  maxEntries?: number
}

const EVENT_CONFIG: Record<string, {
  icon: typeof FileSignature
  color: string
  bgColor: string
  label: string
}> = {
  offer_sent: { icon: FileSignature, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Skickad' },
  offer_signed: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Signerad' },
  offer_declined: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Nekad' },
  offer_expired: { icon: Clock, color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'Förfallen' },
  offer_deleted: { icon: Trash2, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Raderad' },
}

export default function OfferActivityFeed({
  technicianEmail,
  maxEntries = 8,
}: OfferActivityFeedProps) {
  const [entries, setEntries] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const result = await getOfferEventLog({ limit: maxEntries, technicianEmail })
        setEntries(result.entries)
        setTotalCount(result.totalCount)
      } catch (err) {
        console.error('OfferActivityFeed fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [maxEntries, technicianEmail])

  if (loading) {
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Laddar händelser...
        </div>
      </div>
    )
  }

  if (entries.length === 0) return null

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
      {/* Rubrik — klickbar för att expandera/kollapsa */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#20c58f]" />
          <span className="text-sm font-medium text-slate-300">Senaste händelser</span>
          <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded-full">
            {totalCount}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Expanderat innehåll */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {entries.map((entry) => {
            const config = EVENT_CONFIG[entry.event_type] || EVENT_CONFIG.offer_sent
            const Icon = config.icon

            return (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/30 transition-colors"
              >
                {/* Ikon */}
                <div className={`flex-shrink-0 p-1 rounded ${config.bgColor} mt-0.5`}>
                  <Icon className={`w-3 h-3 ${config.color}`} />
                </div>

                {/* Innehåll */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-tight">{entry.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {entry.performed_by_name && entry.performed_by_name !== 'Oneflow' && (
                      <>
                        <span className="text-[10px] text-slate-500">{entry.performed_by_name}</span>
                        <span className="text-[10px] text-slate-600">·</span>
                      </>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {formatDistanceToNow(new Date(entry.created_at))}
                    </span>
                    {entry.case_title && (
                      <>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] text-slate-500 truncate">{entry.case_title}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status-badge */}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bgColor} ${config.color} flex-shrink-0`}>
                  {config.label}
                </span>
              </div>
            )
          })}

          {totalCount > maxEntries && (
            <div className="text-center pt-1">
              <span className="text-[10px] text-slate-500">
                +{totalCount - maxEntries} fler händelser
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

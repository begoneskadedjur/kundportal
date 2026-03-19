import React, { useState, useEffect } from 'react'
import {
  ClipboardList, AlertTriangle, CalendarPlus, CalendarCheck,
  FileText, RotateCcw, FileCheck, ChevronRight, Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { isCompletedStatus } from '../../../types/database'
import type { WorkflowGroup } from '../../../pages/technician/TechnicianCases'

// Same mapping as TechnicianCases
const STATUS_TO_WORKFLOW: Record<string, WorkflowGroup> = {
  'Öppen': 'needs_booking',
  'Offert signerad - boka in': 'needs_booking',
  'Bokad': 'booked',
  'Bokat': 'booked',
  'Offert skickad': 'offer_sent',
  'Återbesök': 'revisit',
  'Återbesök 1': 'revisit',
  'Återbesök 2': 'revisit',
  'Återbesök 3': 'revisit',
  'Återbesök 4': 'revisit',
  'Återbesök 5': 'revisit',
  'Bomkörning': 'needs_action',
  'Ombokning': 'needs_action',
  'Reklamation': 'needs_action',
  'Privatperson - review': 'needs_action',
  'Generera saneringsrapport': 'report',
}

const WORKFLOW_GROUPS: { key: WorkflowGroup; label: string; icon: React.ElementType; color: string; bgClass: string }[] = [
  { key: 'needs_action',  label: 'Kräver åtgärd',  icon: AlertTriangle, color: 'text-red-400',    bgClass: 'bg-red-500/20' },
  { key: 'needs_booking', label: 'Behöver bokas',   icon: CalendarPlus,  color: 'text-yellow-400', bgClass: 'bg-yellow-500/20' },
  { key: 'booked',        label: 'Inbokade',        icon: CalendarCheck, color: 'text-blue-400',   bgClass: 'bg-blue-500/20' },
  { key: 'offer_sent',    label: 'Offert skickad',  icon: FileText,      color: 'text-amber-400',  bgClass: 'bg-amber-500/20' },
  { key: 'revisit',       label: 'Återbesök',       icon: RotateCcw,     color: 'text-cyan-400',   bgClass: 'bg-cyan-500/20' },
  { key: 'report',        label: 'Rapport',         icon: FileCheck,     color: 'text-purple-400', bgClass: 'bg-purple-500/20' },
]

const STALE_THRESHOLD_DAYS = 30

interface Props {
  technicianId: string
}

interface CaseCounts {
  groups: Record<WorkflowGroup, number>
  stale: number
  total: number
}

export default function CaseSummaryCard({ technicianId }: Props) {
  const [counts, setCounts] = useState<CaseCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCounts()
  }, [technicianId])

  const fetchCounts = async () => {
    try {
      const selectFields = 'id, status, created_date'

      const [privRes, bizRes] = await Promise.allSettled([
        supabase.from('private_cases').select(selectFields)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .is('deleted_at', null),
        supabase.from('business_cases').select(selectFields)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .is('deleted_at', null),
      ])

      const allCases = [
        ...(privRes.status === 'fulfilled' ? privRes.value.data || [] : []),
        ...(bizRes.status === 'fulfilled' ? bizRes.value.data || [] : []),
      ]

      // Only count active (non-completed) cases
      const activeCases = allCases.filter(c => !isCompletedStatus(c.status))

      const groups: Record<WorkflowGroup, number> = {
        needs_action: 0, needs_booking: 0, booked: 0,
        offer_sent: 0, revisit: 0, report: 0,
      }

      const now = Date.now()
      let stale = 0

      for (const c of activeCases) {
        const wf = STATUS_TO_WORKFLOW[c.status]
        if (wf) {
          groups[wf]++
        }
        // Count stale cases (>30 days old)
        if (c.created_date) {
          const age = Math.floor((now - new Date(c.created_date).getTime()) / (1000 * 60 * 60 * 24))
          if (age > STALE_THRESHOLD_DAYS) stale++
        }
      }

      const total = Object.values(groups).reduce((a, b) => a + b, 0)
      setCounts({ groups, stale, total })
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
          <ClipboardList className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Mina ärenden</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!counts || counts.total === 0) return null

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Mina ärenden</h3>
        </div>
        <Link to="/technician/cases" className="text-xs text-[#20c58f] font-medium hover:underline">
          Visa alla
        </Link>
      </div>

      <div className="space-y-1">
        {WORKFLOW_GROUPS.map(({ key, label, icon: Icon, color, bgClass }) => {
          const count = counts.groups[key]
          if (count === 0) return null
          return (
            <Link
              key={key}
              to="/technician/cases"
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

        {/* Stale cases row */}
        {counts.stale > 0 && (
          <Link
            to="/technician/cases"
            className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group border-t border-slate-700/50 mt-1 pt-2"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-slate-500/20 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-sm text-slate-400">Gamla &gt;30d</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-400">{counts.stale}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

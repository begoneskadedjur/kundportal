import React from 'react'
import { AlertCircle, ChevronRight, CalendarX, BookOpen, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

interface PendingCase {
  id: string
  title: string
  status: string
  case_type: 'private' | 'business'
  created_at: string
  kontaktperson?: string
  start_date?: string | null
}

interface Props {
  cases: PendingCase[]
  onCaseClick: (c: PendingCase) => void
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

type ActionGroup = 'needs_booking' | 'needs_action' | 'stale'

function classifyCase(c: PendingCase): ActionGroup {
  const age = daysAgo(c.created_at)
  const s = c.status?.toLowerCase() || ''

  // No start_date or status implies needs booking
  if (!c.start_date || s.includes('öppen') || s === 'open') return 'needs_booking'
  // Old cases without progress
  if (age > 30) return 'stale'
  return 'needs_action'
}

const GROUP_CONFIG: Record<ActionGroup, { label: string; icon: React.ElementType; dotColor: string }> = {
  needs_booking: { label: 'Behöver bokas', icon: CalendarX, dotColor: 'bg-amber-400' },
  needs_action: { label: 'Behöver åtgärd', icon: BookOpen, dotColor: 'bg-blue-400' },
  stale: { label: 'Inaktuella (>30d)', icon: Clock, dotColor: 'bg-red-400' },
}

const MAX_ITEMS = 8

export default function ActionRequiredList({ cases, onCaseClick }: Props) {
  if (cases.length === 0) return null

  // Group and sort
  const grouped: Record<ActionGroup, PendingCase[]> = { needs_booking: [], needs_action: [], stale: [] }
  for (const c of cases) {
    grouped[classifyCase(c)].push(c)
  }

  // Flatten in priority order, limit total
  const orderedGroups: ActionGroup[] = ['needs_booking', 'needs_action', 'stale']
  const items: { group: ActionGroup; c: PendingCase }[] = []
  for (const g of orderedGroups) {
    for (const c of grouped[g]) {
      if (items.length >= MAX_ITEMS) break
      items.push({ group: g, c })
    }
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Att hantera</h3>
        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
          {cases.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map(({ group, c }, i) => {
          const config = GROUP_CONFIG[group]
          const age = daysAgo(c.created_at)

          return (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onCaseClick(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-900/30 border border-slate-700/30 rounded-lg hover:bg-slate-800/50 transition-colors text-left group"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotColor}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white truncate block">{c.title}</span>
                <span className="text-xs text-slate-500">
                  {c.kontaktperson || 'Okänd'} &middot; {age}d sedan
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
            </motion.button>
          )
        })}
      </div>

      {cases.length > MAX_ITEMS && (
        <p className="text-xs text-slate-500 text-center mt-2">
          +{cases.length - MAX_ITEMS} fler ärenden
        </p>
      )}
    </div>
  )
}

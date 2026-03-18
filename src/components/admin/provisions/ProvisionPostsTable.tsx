import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ProvisionStatusBadge from './ProvisionStatusBadge'
import type { ProvisionTechnicianSummary, CommissionPost } from '../../../types/provision'

interface ProvisionPostsTableProps {
  summaries: ProvisionTechnicianSummary[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
  loading?: boolean
}

const formatCurrency = (amount: number) =>
  amount.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr'

const caseTypeLabel: Record<string, string> = {
  private: 'Privat',
  business: 'Företag',
  contract: 'Avtal'
}

export default function ProvisionPostsTable({
  summaries,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  loading
}: ProvisionPostsTableProps) {
  const [expandedTechnicians, setExpandedTechnicians] = useState<Set<string>>(
    new Set(summaries.map(s => s.technician_id))
  )

  const toggleExpand = (techId: string) => {
    setExpandedTechnicians(prev => {
      const next = new Set(prev)
      if (next.has(techId)) next.delete(techId)
      else next.add(techId)
      return next
    })
  }

  const allPostIds = summaries.flatMap(s => s.posts.map(p => p.id))
  const allSelected = allPostIds.length > 0 && allPostIds.every(id => selectedIds.has(id))

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 animate-pulse">
            <div className="h-5 w-48 bg-slate-700 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-700/50 rounded" />
              <div className="h-4 w-3/4 bg-slate-700/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (summaries.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500 text-sm">Inga provisionsposter för denna period.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Markera alla */}
      <div className="flex items-center gap-2 px-3">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
        />
        <span className="text-xs text-slate-400">Markera alla</span>
      </div>

      {summaries.map(summary => {
        const expanded = expandedTechnicians.has(summary.technician_id)
        return (
          <div key={summary.technician_id} className="rounded-xl border border-slate-700 overflow-hidden">
            {/* Tekniker-header */}
            <button
              onClick={() => toggleExpand(summary.technician_id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-semibold text-white">{summary.technician_name}</span>
                <span className="text-xs text-slate-400">
                  {summary.post_count} post{summary.post_count !== 1 ? 'er' : ''}
                </span>
              </div>
              <span className="text-sm font-bold text-emerald-400">
                {formatCurrency(summary.total_commission)}
              </span>
            </button>

            {/* Poster */}
            {expanded && (
              <div className="divide-y divide-slate-700/50">
                {summary.posts.map(post => (
                  <PostRow
                    key={post.id}
                    post={post}
                    selected={selectedIds.has(post.id)}
                    onToggle={() => onToggleSelect(post.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PostRow({
  post,
  selected,
  onToggle
}: {
  post: CommissionPost
  selected: boolean
  onToggle: () => void
}) {
  const isDimmed = post.status === 'pending_invoice' || post.status === 'paid_out'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${isDimmed ? 'opacity-60' : ''} hover:bg-slate-800/30 transition-colors`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">{post.case_number || '—'}</span>
          <span className="text-sm text-slate-200 truncate">{post.case_title || 'Utan titel'}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{caseTypeLabel[post.case_type]}</span>
          {post.share_percentage < 100 && (
            <span className="text-xs text-slate-500">· {post.share_percentage}% andel</span>
          )}
          <span className="text-xs text-slate-500">
            · {new Date(post.created_at).toLocaleDateString('sv-SE')}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-3">
        <div>
          <div className="text-sm font-medium text-slate-200">
            {post.commission_percentage}%
          </div>
          <div className="text-xs text-slate-500">
            av {post.base_amount.toLocaleString('sv-SE')} kr
          </div>
        </div>
        <div className="text-right min-w-[80px]">
          <div className="text-sm font-bold text-emerald-400">
            {formatCurrency(post.commission_amount)}
          </div>
        </div>
        <ProvisionStatusBadge status={post.status} />
      </div>
    </div>
  )
}

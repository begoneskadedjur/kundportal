import React, { useState, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../../utils/formatters'
import type { JourneyStage, JourneyCaseRow } from '../../../pages/admin/CustomerJourney'

interface Props {
  stage: JourneyStage
  onClose: () => void
}

const PAGE_SIZE = 20

const STATUS_COLORS: Record<string, string> = {
  'Öppen': 'bg-yellow-500/20 text-yellow-400',
  'Bokad': 'bg-blue-500/20 text-blue-400',
  'Bokat': 'bg-blue-500/20 text-blue-400',
  'Offert skickad': 'bg-teal-500/20 text-teal-400',
  'Offert signerad - boka in': 'bg-green-500/20 text-green-400',
  'Avslutat': 'bg-emerald-500/20 text-emerald-400',
  'Stängt - slasklogg': 'bg-red-500/20 text-red-400',
}

const CONTRACT_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Offert skickad', cls: 'text-amber-400' },
  signed: { label: 'Signerat', cls: 'text-green-400' },
  declined: { label: 'Avböjt', cls: 'text-red-400' },
  overdue: { label: 'Utgången', cls: 'text-red-400' },
  active: { label: 'Aktivt', cls: 'text-green-400' },
}

const INVOICE_LABELS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Betald', cls: 'text-emerald-400' },
  sent: { label: 'Skickad', cls: 'text-blue-400' },
  ready: { label: 'Redo', cls: 'text-amber-400' },
  draft: { label: 'Utkast', cls: 'text-slate-400' },
  pending_approval: { label: 'Väntar', cls: 'text-yellow-400' },
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  private: { label: 'Privat', cls: 'bg-blue-500/20 text-blue-400' },
  business: { label: 'Företag', cls: 'bg-purple-500/20 text-purple-400' },
}

export default function FunnelStageDetail({ stage, onClose }: Props) {
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<'title' | 'pris' | 'created_at'>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const arr = [...stage.cases]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortField === 'pris') {
        cmp = (a.pris || 0) - (b.pris || 0)
      } else if (sortField === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '')
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [stage.cases, sortField, sortAsc])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  const Icon = stage.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${stage.bgColor}`}>
            <Icon className={`w-4 h-4 ${stage.textColor}`} />
          </div>
          <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stage.bgColor} ${stage.textColor}`}>
            {stage.count}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {stage.cases.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">Inga ärenden i detta steg</p>
      ) : (
        <>
          {/* Sort controls */}
          <div className="flex gap-2 mb-2 text-xs">
            {([
              { field: 'created_at' as const, label: 'Datum' },
              { field: 'title' as const, label: 'Titel' },
              { field: 'pris' as const, label: 'Pris' },
            ]).map(s => (
              <button
                key={s.field}
                onClick={() => toggleSort(s.field)}
                className={`px-2 py-1 rounded transition-colors ${
                  sortField === s.field ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s.label} {sortField === s.field && (sortAsc ? '↑' : '↓')}
              </button>
            ))}
          </div>

          {/* Case list */}
          <div className="space-y-1.5">
            {paged.map(c => (
              <CaseRow key={c.id} case_={c} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/50">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500">
                Sida {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── Case row ────────────────────────────────────────────

function CaseRow({ case_: c }: { case_: JourneyCaseRow }) {
  const statusColor = STATUS_COLORS[c.status] || 'bg-slate-500/20 text-slate-400'
  const typeBadge = TYPE_BADGE[c.case_type] || TYPE_BADGE.private
  const contractLabel = c.contractStatus ? CONTRACT_LABELS[c.contractStatus] : null
  const invoiceLabel = c.invoiceStatus ? INVOICE_LABELS[c.invoiceStatus] : null
  const dateStr = c.start_date || c.created_at
  const date = dateStr ? new Date(dateStr).toLocaleDateString('sv-SE') : '-'

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/20 border border-slate-700/30 rounded-lg hover:bg-slate-800/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{c.title}</span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge.cls}`}>
            {typeBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-400">{c.kontaktperson || 'Okänd'}</span>
          {c.skadedjur && (
            <span className="text-xs text-slate-500">{c.skadedjur}</span>
          )}
          <span className="text-xs text-slate-600">{date}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {contractLabel && (
          <span className={`text-[10px] font-medium ${contractLabel.cls}`}>{contractLabel.label}</span>
        )}
        {invoiceLabel && (
          <span className={`text-[10px] font-medium ${invoiceLabel.cls}`}>{invoiceLabel.label}</span>
        )}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>
          {c.status}
        </span>
        {c.pris != null && c.pris > 0 && (
          <span className="text-xs font-medium text-slate-300 tabular-nums">{formatCurrency(c.pris)}</span>
        )}
      </div>
    </div>
  )
}

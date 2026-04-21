import React from 'react'
import { FileText } from 'lucide-react'
import { useInvoicePipeline } from '../../../hooks/useEconomicsV2'
import { formatCurrency } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'
import type { PipelineStatus } from '../../../services/economicsServiceV2'

const STATUS_META: Record<PipelineStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Väntar',   color: 'text-amber-300',  bg: 'bg-amber-500/20' },
  sent:    { label: 'Skickade', color: 'text-sky-300',    bg: 'bg-sky-500/20' },
  paid:    { label: 'Betalda',  color: 'text-[#20c58f]',  bg: 'bg-[#20c58f]/20' },
}

const InvoicePipelineFunnel: React.FC = () => {
  const { data, loading } = useInvoicePipeline()
  const rows = data || []
  const max = Math.max(1, ...rows.map(r => r.total))

  return (
    <SectionCard
      title="Fakturapipeline"
      subtitle="Status över hela fakturaflödet"
      icon={<FileText className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : rows.every(r => r.count === 0) ? (
        <EmptyChartState height="h-48" />
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const meta = STATUS_META[r.status]
            const widthPct = (r.total / max) * 100
            return (
              <div key={r.status}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${meta.bg}`} />
                    <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-slate-500">{r.count} st</span>
                  </div>
                  <span className="text-slate-200 font-medium">{formatCurrency(r.total)}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.bg.replace('/20', '/60')}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

export default InvoicePipelineFunnel

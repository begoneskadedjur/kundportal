// src/components/admin/customers/analytics/RenewalPipeline.tsx

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Clock, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import sv from 'date-fns/locale/sv'
import type { RenewalBucket } from '../../../../hooks/useContractInsights'

interface Props {
  pipeline: RenewalBucket[]
  onCustomerClick?: (id: string) => void
}

const BUCKET_CONFIG = {
  '0-3m': { label: '0–3 månader', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  '3-6m': { label: '3–6 månader', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  '6-12m': { label: '6–12 månader', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  '12m+': { label: '12+ månader', icon: Calendar, color: 'text-slate-400', bg: 'bg-slate-800/30', border: 'border-slate-700/50' },
}

export default function RenewalPipeline({ pipeline, onCustomerClick }: Props) {
  const [expanded, setExpanded] = useState<string | null>('0-3m')

  const visible = pipeline.filter(b => b.bucket !== '12m+')

  return (
    <div className="space-y-2">
      {visible.map(bucket => {
        const cfg = BUCKET_CONFIG[bucket.bucket]
        const Icon = cfg.icon
        const isOpen = expanded === bucket.bucket

        return (
          <div key={bucket.bucket} className={`border rounded-xl overflow-hidden ${cfg.border}`}>
            <button
              onClick={() => setExpanded(isOpen ? null : bucket.bucket)}
              className={`w-full flex items-center justify-between px-4 py-3 ${cfg.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-slate-500">
                  {bucket.count} avtal · {bucket.arr.toLocaleString('sv-SE')} kr ARR
                </span>
              </div>
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-slate-500" />
                : <ChevronRight className="w-4 h-4 text-slate-500" />
              }
            </button>

            {isOpen && bucket.customers.length > 0 && (
              <div className="divide-y divide-slate-800">
                {bucket.customers
                  .sort((a, b) => a.endDate.localeCompare(b.endDate))
                  .map(c => (
                    <div
                      key={c.id}
                      onClick={() => onCustomerClick?.(c.id)}
                      className={`flex items-center justify-between px-4 py-2.5 bg-slate-900/50 ${onCustomerClick ? 'cursor-pointer hover:bg-slate-800/60' : ''} transition-colors`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.salesPerson}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0 ml-3">
                        {format(new Date(c.endDate), 'd MMM yyyy', { locale: sv })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

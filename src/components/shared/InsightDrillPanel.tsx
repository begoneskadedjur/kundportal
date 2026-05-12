// src/components/shared/InsightDrillPanel.tsx
// Slideout-panel för drill-down i Affärsinsikt (avtalstyper, produkter)

import React, { useEffect, useRef } from 'react'
import { X, Users, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import sv from 'date-fns/locale/sv'

export interface DrillCustomer {
  id: string
  company_name: string
  annual_value: number | null
  sales_person: string | null
  contract_end_date?: string | null
  extra?: string
}

interface InsightDrillPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  customers: DrillCustomer[]
  onCustomerClick?: (id: string) => void
  loading?: boolean
}

export default function InsightDrillPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  customers,
  onCustomerClick,
  loading = false,
}: InsightDrillPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    if (isOpen) {
      const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100)
      return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClickOutside) }
    }
  }, [isOpen, onClose])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const sorted = [...customers].sort((a, b) => (b.annual_value ?? 0) - (a.annual_value ?? 0))

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[100] transition-all duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`
          fixed z-[101] bg-slate-900 shadow-2xl flex flex-col
          sm:top-0 sm:right-0 sm:h-full sm:w-[420px]
          sm:border-l sm:border-slate-800
          sm:transform sm:transition-transform sm:duration-300 sm:ease-out
          ${isOpen ? 'sm:translate-x-0' : 'sm:translate-x-full'}
          max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[85vh]
          max-sm:rounded-t-2xl max-sm:border-t max-sm:border-slate-700
          max-sm:transform max-sm:transition-transform max-sm:duration-300 max-sm:ease-out
          ${isOpen ? 'max-sm:translate-y-0' : 'max-sm:translate-y-full'}
        `}
      >
        {/* Drag handle mobil */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-3 py-2.5 max-sm:pt-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-[#20c58f]/15 rounded-md">
              <Users className="w-4 h-4 text-[#20c58f]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-medium text-slate-100 truncate max-w-[260px]">{title}</h2>
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">Laddar...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              <p className="text-sm text-slate-500">Inga kunder hittades</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {sorted.map(c => (
                <div
                  key={c.id}
                  onClick={() => onCustomerClick?.(c.id)}
                  className={`flex items-center justify-between px-4 py-3 ${
                    onCustomerClick ? 'cursor-pointer hover:bg-slate-800/50' : ''
                  } transition-colors group`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-slate-200 font-medium truncate">{c.company_name}</p>
                      {onCustomerClick && (
                        <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.sales_person && (
                        <span className="text-[11px] text-slate-500">{c.sales_person}</span>
                      )}
                      {c.contract_end_date && (
                        <span className="text-[11px] text-slate-600">
                          · slutar {format(new Date(c.contract_end_date), 'd MMM yyyy', { locale: sv })}
                        </span>
                      )}
                    </div>
                    {c.extra && (
                      <p className="text-[11px] text-[#20c58f]/70 mt-0.5">{c.extra}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {c.annual_value != null && c.annual_value > 0 ? (
                      <span className="text-sm text-white font-semibold">
                        {c.annual_value.toLocaleString('sv-SE')} kr
                      </span>
                    ) : (
                      <span className="text-sm text-slate-600">–</span>
                    )}
                    <p className="text-[10px] text-slate-600 mt-0.5">ARR/år</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

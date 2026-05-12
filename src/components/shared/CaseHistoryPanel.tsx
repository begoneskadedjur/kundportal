// src/components/shared/CaseHistoryPanel.tsx
// Read-only slide-panel med ärendehistorik: återbesök + delfakturor

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, History, Calendar, Receipt, ArrowRight, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import sv from 'date-fns/locale/sv'

interface HistoryEntry {
  id: string
  type: 'revisit' | 'partial_invoice'
  created_at: string
  updated_by_name: string
  data: any
}

interface CaseHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  caseTitle: string
  onCountChange?: (count: number) => void
}

const INVOICE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Utkast', color: 'text-slate-400' },
  pending_approval: { label: 'Godkänns', color: 'text-amber-400' },
  ready: { label: 'Redo', color: 'text-blue-400' },
  sent: { label: 'Skickad', color: 'text-purple-400' },
  booked: { label: 'Bokförd', color: 'text-teal-400' },
  paid: { label: 'Betald', color: 'text-[#20c58f]' },
  cancelled: { label: 'Makulerad', color: 'text-red-400' },
}

export default function CaseHistoryPanel({
  isOpen,
  onClose,
  caseId,
  caseTitle,
  onCountChange,
}: CaseHistoryPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!caseId) return
    setLoading(true)
    try {
      const [logsResult, invoicesResult] = await Promise.all([
        supabase
          .from('case_updates_log')
          .select('id, update_type, new_value, previous_value, updated_by_name, created_at')
          .eq('case_id', caseId)
          .in('update_type', ['revisit_scheduled', 'partial_invoice_created'])
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, invoice_type, status, total_amount, created_at')
          .eq('case_id', caseId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
      ])

      const logEntries: HistoryEntry[] = (logsResult.data || []).map((row: any) => {
        let parsed: any = {}
        try { parsed = JSON.parse(row.new_value) } catch (_) {}
        return {
          id: row.id,
          type: row.update_type === 'revisit_scheduled' ? 'revisit' : 'partial_invoice',
          created_at: row.created_at,
          updated_by_name: row.updated_by_name || 'Okänd',
          data: { ...parsed, previous_value: row.previous_value },
        }
      })

      // Fakturor som INTE redan finns som partial_invoice_created-loggar (undvik dubletter)
      const loggedInvoiceNumbers = new Set(
        logEntries.filter(e => e.type === 'partial_invoice').map(e => e.data.invoice_number)
      )
      const invoiceEntries: HistoryEntry[] = (invoicesResult.data || [])
        .filter((inv: any) => !loggedInvoiceNumbers.has(inv.invoice_number))
        .map((inv: any) => ({
          id: inv.id,
          type: 'partial_invoice' as const,
          created_at: inv.created_at,
          updated_by_name: '',
          data: {
            invoice_number: inv.invoice_number,
            amount: inv.total_amount,
            status: inv.status,
          },
        }))

      const all = [...logEntries, ...invoiceEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setEntries(all)
      onCountChange?.(all.length)
    } catch (e) {
      console.error('[CaseHistoryPanel] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [caseId, onCountChange])

  useEffect(() => {
    if (isOpen) fetchHistory()
  }, [isOpen, fetchHistory])

  // Stäng vid klick utanför
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
          sm:top-0 sm:right-0 sm:h-full sm:w-[400px]
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
            <div className="p-1.5 bg-amber-500/15 rounded-md">
              <History className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-medium text-slate-100">Ärendehistorik</h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Laddar historik...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              <p className="text-sm text-slate-500">Ingen historik än</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                {entry.type === 'revisit' ? (
                  <RevisitEntry entry={entry} />
                ) : (
                  <InvoiceEntry entry={entry} />
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
                  <span className="text-[11px] text-slate-500">
                    {format(new Date(entry.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                  </span>
                  {entry.updated_by_name && (
                    <span className="text-[11px] text-slate-500">av {entry.updated_by_name}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

function RevisitEntry({ entry }: { entry: HistoryEntry }) {
  const d = entry.data
  let prevStart: string | null = null
  try {
    const prev = JSON.parse(d.previous_value || '{}')
    prevStart = prev.start_date || null
  } catch (_) {}

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        <span className="text-xs font-semibold text-teal-300">Återbesök bokat</span>
      </div>
      {prevStart && d.start_date && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
          <span>{format(new Date(prevStart), 'd MMM HH:mm', { locale: sv })}</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className="text-white">{format(new Date(d.start_date), 'd MMM yyyy HH:mm', { locale: sv })}</span>
        </div>
      )}
      {d.note && (
        <p className="text-xs text-slate-400 mt-1 italic">"{d.note}"</p>
      )}
    </div>
  )
}

function InvoiceEntry({ entry }: { entry: HistoryEntry }) {
  const d = entry.data
  const statusInfo = INVOICE_STATUS_LABELS[d.status] || { label: d.status, color: 'text-slate-400' }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Receipt className="w-3.5 h-3.5 text-[#20c58f] shrink-0" />
        <span className="text-xs font-semibold text-[#20c58f]">Delfaktura skapad</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{d.invoice_number}</span>
        {d.amount && (
          <span className="text-white font-semibold">{Number(d.amount).toLocaleString('sv-SE')} kr</span>
        )}
      </div>
      {d.status && (
        <span className={`text-[11px] ${statusInfo.color}`}>{statusInfo.label}</span>
      )}
      {d.items && d.items.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {d.items.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{item.name}</span>
              <span>{Number(item.amount).toLocaleString('sv-SE')} kr</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

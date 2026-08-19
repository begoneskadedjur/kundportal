// src/components/admin/customers/CustomerPeekPanel.tsx
// Peek-panel (etapp 3): högerpanel som öppnas vid radklick i Befintliga kunder
// (?peek=<customerId> i URL:en). Renderar en kompakt version av record-innehållet
// via CustomerRecordContent (density='peek') — samma kod som kundsidan.
// Esc eller klick utanför stänger. "Öppna som sida ↗" går till record-sidan.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { useCustomerRecord } from '../../../hooks/useCustomerRecord'
import CustomerRecordContent from './record/CustomerRecordContent'

interface Props {
  /** customers.id (org- eller enhetsrad). null = stängd. */
  customerId: string | null
  /** T.ex. "/admin/befintliga-kunder" */
  basePath: string
  onClose: () => void
}

export default function CustomerPeekPanel({ customerId, basePath, onClose }: Props) {
  const navigate = useNavigate()
  const open = customerId !== null
  const { data, loading, error } = useCustomerRecord(customerId ?? undefined)

  // Esc stänger panelen
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop — klick stänger */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

      {/* Panel */}
      <aside className="absolute inset-y-0 right-0 w-full sm:w-[560px] bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col">
        {/* Panelhuvud */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 shrink-0">
          <button
            onClick={() => customerId && navigate(`${basePath}/${customerId}`)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
          >
            Öppna som sida
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-200 transition-colors"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          )}
          {!loading && (error || !data) && (
            <div className="flex items-center gap-3 text-slate-300 py-8">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">Kunde inte hämta kunden</p>
                {error && <p className="text-xs text-slate-500 mt-0.5">{error}</p>}
              </div>
            </div>
          )}
          {!loading && data && (
            <CustomerRecordContent data={data} basePath={basePath} density="peek" />
          )}
        </div>
      </aside>
    </div>
  )
}

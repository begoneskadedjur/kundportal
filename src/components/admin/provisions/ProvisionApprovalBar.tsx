import { CheckCircle, Wallet, Download, X } from 'lucide-react'

interface ProvisionApprovalBarProps {
  selectedCount: number
  onApprove: () => void
  onMarkPaidOut: () => void
  onExport: () => void
  onClearSelection: () => void
  loading?: boolean
}

export default function ProvisionApprovalBar({
  selectedCount,
  onApprove,
  onMarkPaidOut,
  onExport,
  onClearSelection,
  loading
}: ProvisionApprovalBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 bg-slate-800 border border-slate-600 rounded-xl shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200">
          {selectedCount} post{selectedCount !== 1 ? 'er' : ''} markerad{selectedCount !== 1 ? 'e' : ''}
        </span>
        <button
          onClick={onClearSelection}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          title="Avmarkera alla"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg text-blue-300 hover:text-blue-200 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          Godkänn
        </button>
        <button
          onClick={onMarkPaidOut}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg text-emerald-300 hover:text-emerald-200 transition-colors disabled:opacity-50"
        >
          <Wallet className="w-4 h-4" />
          Markera utbetald
        </button>
        <button
          onClick={onExport}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/40 rounded-lg text-slate-300 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Exportera
        </button>
      </div>
    </div>
  )
}

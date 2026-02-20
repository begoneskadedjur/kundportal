// ActionableCasesDrawer.tsx — Expanderbar panel för ärenden att boka in
import { motion } from 'framer-motion'
import { CalendarPlus, User, MapPin, Phone, Bug, Clock, ChevronUp, X } from 'lucide-react'
import { BeGoneCaseRow } from '../../../types/database'
import { formatAddress } from './scheduleUtils'

interface ActionableCasesDrawerProps {
  cases: BeGoneCaseRow[]
  onScheduleCase: (caseData: BeGoneCaseRow) => void
  onClose: () => void
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days === 0) return 'idag'
  if (days === 1) return 'igår'
  if (days < 7) return `${days} dagar sedan`
  if (days < 30) return `${Math.floor(days / 7)} veckor sedan`
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export function ActionableCasesDrawer({ cases, onScheduleCase, onClose }: ActionableCasesDrawerProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 overflow-hidden flex-shrink-0"
    >
      <div className="px-4 py-2.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Ärenden att boka in
              <span className="ml-1.5 text-xs font-normal text-slate-400">({cases.length})</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

        {/* Lista */}
        {cases.length === 0 ? (
          <div className="text-center py-6">
            <CalendarPlus className="mx-auto w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Alla signerade offerter är schemalagda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {cases.map(c => (
              <ActionableCaseCard
                key={c.id}
                caseData={c}
                onSchedule={() => onScheduleCase(c)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ActionableCaseCard({ caseData, onSchedule }: { caseData: BeGoneCaseRow; onSchedule: () => void }) {
  const addr = formatAddress(caseData.adress)
  const isScheduled = !!(caseData.start_date && caseData.due_date)

  return (
    <div className="group p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:border-amber-500/30 hover:bg-slate-800/60 transition-all">
      {/* Titel + typ */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-xs font-semibold text-white truncate">{caseData.title || 'Utan titel'}</h4>
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${
          caseData.case_type === 'private'
            ? 'bg-blue-500/15 text-blue-400'
            : 'bg-purple-500/15 text-purple-400'
        }`}>
          {caseData.case_type === 'private' ? 'Privat' : 'Företag'}
        </span>
      </div>

      {/* Detaljer */}
      <div className="space-y-1 mb-2">
        {caseData.kontaktperson && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{caseData.kontaktperson}</span>
          </div>
        )}
        {caseData.telefon && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">{caseData.telefon}</span>
          </div>
        )}
        {addr && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{addr}</span>
          </div>
        )}
        {caseData.skadedjur && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Bug className="w-3 h-3 shrink-0" />
            <span className="truncate">{caseData.skadedjur}</span>
          </div>
        )}
        {caseData.created_at && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Signerad {formatRelativeDate(caseData.created_at)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/30">
        {isScheduled ? (
          <span className="text-[9px] text-emerald-400 font-medium">Inbokad</span>
        ) : (
          <span className="text-[9px] text-amber-400 font-medium">Ej inbokad</span>
        )}
        <button
          onClick={onSchedule}
          className="px-2.5 py-1 text-[10px] font-medium rounded-md bg-[#20c58f]/15 text-[#20c58f] hover:bg-[#20c58f]/25 transition-colors"
        >
          Boka in
        </button>
      </div>
    </div>
  )
}

// ActionableCasesDrawer.tsx — Expanderbar panel för ärenden att boka in (radvy)
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, ChevronUp, ExternalLink } from 'lucide-react'
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
  if (days < 7) return `${days}d sedan`
  if (days < 30) return `${Math.floor(days / 7)}v sedan`
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export function ActionableCasesDrawer({ cases, onScheduleCase, onClose }: ActionableCasesDrawerProps) {
  const navigate = useNavigate()

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/koordinator/offerthantering')}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-[#20c58f] transition-colors"
            >
              Visa offertpipeline <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lista */}
        {cases.length === 0 ? (
          <div className="text-center py-6">
            <CalendarPlus className="mx-auto w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Alla signerade offerter är schemalagda</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="sticky top-0 bg-slate-900/95">
                <tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="px-2 py-1.5 font-medium">Ärende</th>
                  <th className="px-2 py-1.5 font-medium">Typ</th>
                  <th className="px-2 py-1.5 font-medium">Kontaktperson</th>
                  <th className="px-2 py-1.5 font-medium hidden md:table-cell">Telefon</th>
                  <th className="px-2 py-1.5 font-medium hidden lg:table-cell">Adress</th>
                  <th className="px-2 py-1.5 font-medium hidden lg:table-cell">Skadedjur</th>
                  <th className="px-2 py-1.5 font-medium">Tekniker</th>
                  <th className="px-2 py-1.5 font-medium hidden md:table-cell">Signerad</th>
                  <th className="px-2 py-1.5 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
                  const addr = formatAddress(c.adress)
                  const isScheduled = !!(c.start_date && c.due_date)
                  return (
                    <tr key={c.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                      <td className="px-2 py-1.5">
                        <span className="text-white font-medium truncate block max-w-[160px]">{c.title || 'Utan titel'}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          c.case_type === 'private' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
                        }`}>
                          {c.case_type === 'private' ? 'Privat' : 'Företag'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-300">{c.kontaktperson || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-400 hidden md:table-cell">{c.telefon_kontaktperson || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-400 hidden lg:table-cell">
                        <span className="truncate block max-w-[140px]">{addr || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-400 hidden lg:table-cell">{c.skadedjur || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-300 font-medium">{c.primary_assignee_name || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-500 hidden md:table-cell">{formatRelativeDate(c.created_at)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {isScheduled ? (
                          <span className="text-[9px] text-emerald-400 font-medium">Inbokad</span>
                        ) : (
                          <button
                            onClick={() => onScheduleCase(c)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[#20c58f]/15 text-[#20c58f] hover:bg-[#20c58f]/25 transition-colors"
                          >
                            Boka in
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}

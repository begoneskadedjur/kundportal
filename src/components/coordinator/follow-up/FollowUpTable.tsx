// src/components/coordinator/follow-up/FollowUpTable.tsx
// Expanderbar tabell för offertuppföljning med åldersindikator och kommentarer
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, MessageSquare, ExternalLink,
  Clock, AlertTriangle, User, Building2, Mail, Phone,
  FileSignature,
} from 'lucide-react'
import { OFFER_STATUS_CONFIG } from '../../../types/casePipeline'
import { CommentThread } from './CommentThread'
import type { FollowUpOffer, FollowUpSortBy, FollowUpStatusFilter } from '../../../services/offerFollowUpService'

interface FollowUpTableProps {
  offers: FollowUpOffer[]
  sortBy: FollowUpSortBy
  statusFilter: FollowUpStatusFilter
  onSortChange: (sort: FollowUpSortBy) => void
  onStatusFilterChange: (filter: FollowUpStatusFilter) => void
  isCoordinator: boolean
  senderEmail?: string
}

const STATUS_FILTERS: { key: FollowUpStatusFilter; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'pending', label: 'Pågående' },
  { key: 'overdue', label: 'Förfallna' },
  { key: 'signed', label: 'Signerade' },
  { key: 'declined', label: 'Avfärdade' },
]

const SORT_OPTIONS: { key: FollowUpSortBy; label: string }[] = [
  { key: 'oldest', label: 'Äldst först' },
  { key: 'newest', label: 'Nyast först' },
  { key: 'value_desc', label: 'Värde (högst)' },
  { key: 'technician', label: 'Tekniker' },
]

function getAgeBadge(days: number): { label: string; className: string } {
  if (days < 7) return { label: `${days}d`, className: 'bg-green-500/15 text-green-400' }
  if (days < 14) return { label: `${days}d`, className: 'bg-yellow-500/15 text-yellow-400' }
  if (days < 30) return { label: `${days}d`, className: 'bg-orange-500/15 text-orange-400' }
  return { label: `${days}d`, className: 'bg-red-500/15 text-red-400' }
}

function getAgeBorderColor(days: number): string {
  if (days < 7) return 'border-l-green-500'
  if (days < 14) return 'border-l-yellow-400'
  if (days < 30) return 'border-l-orange-500'
  return 'border-l-red-500'
}

function formatPrice(price: number | null): string {
  if (!price) return '—'
  return `${price.toLocaleString('sv-SE')} kr`
}

export function FollowUpTable({
  offers,
  sortBy,
  statusFilter,
  onSortChange,
  onStatusFilterChange,
  isCoordinator,
  senderEmail,
}: FollowUpTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter
  const filtered = offers.filter(o => {
    if (statusFilter === 'all') return true
    return o.status === statusFilter
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'value_desc': return (b.total_value || 0) - (a.total_value || 0)
      case 'technician': return (a.technician_name || '').localeCompare(b.technician_name || '')
      default: return 0
    }
  })

  return (
    <div className="space-y-3">
      {/* Filter + sortering */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status-filter */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => onStatusFilterChange(f.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-[#20c58f] text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 border border-slate-700/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Sortering */}
        <select
          value={sortBy}
          onChange={e => onSortChange(e.target.value as FollowUpSortBy)}
          className="px-2.5 py-1 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
        >
          {SORT_OPTIONS.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <span className="text-xs text-slate-500">{sorted.length} st</span>
      </div>

      {/* Tabell */}
      {sorted.length === 0 ? (
        <div className="text-center py-8">
          <FileSignature className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Inga offerter matchar filtret</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map(offer => {
            const isExpanded = expandedId === offer.id
            const ageBadge = getAgeBadge(offer.age_days)
            const borderColor = getAgeBorderColor(offer.age_days)
            const statusConfig = OFFER_STATUS_CONFIG[offer.status] || { label: offer.status, color: 'text-slate-400', bgColor: 'bg-slate-500/15' }

            return (
              <div key={offer.id} className="rounded-xl overflow-hidden">
                {/* Rad */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : offer.id)}
                  className={`w-full text-left p-3 border-l-4 ${borderColor} bg-slate-800/30 border border-slate-700/50 border-l-4 rounded-xl hover:bg-slate-800/50 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {/* Åldersbadge */}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ageBadge.className}`}>
                      {ageBadge.label}
                    </span>

                    {/* Kund + kontakt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {offer.company_name || offer.contact_person || 'Okänd kund'}
                        </span>
                        {offer.has_comments && (
                          <MessageSquare className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {offer.contact_person && offer.company_name && (
                          <span className="text-[10px] text-slate-500 truncate">{offer.contact_person}</span>
                        )}
                        {isCoordinator && offer.technician_name && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                            <User className="w-2.5 h-2.5" /> {offer.technician_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Värde */}
                    <span className="text-sm font-medium text-white whitespace-nowrap">
                      {formatPrice(offer.total_value)}
                    </span>

                    {/* Status */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>

                    {/* Expand */}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanderad vy */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 bg-slate-800/20 border border-slate-700/30 border-t-0 rounded-b-xl space-y-3">
                        {/* Detaljer */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {offer.contact_email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${offer.contact_email}`} className="hover:text-white transition-colors truncate">
                                {offer.contact_email}
                              </a>
                            </div>
                          )}
                          {offer.contact_phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${offer.contact_phone}`} className="hover:text-white transition-colors">
                                {offer.contact_phone}
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>Skickad {new Date(offer.created_at).toLocaleDateString('sv-SE')}</span>
                          </div>
                          {offer.oneflow_contract_id && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                              <a
                                href={`https://app.oneflow.com/contracts/${offer.oneflow_contract_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#20c58f] hover:underline"
                              >
                                Öppna i Oneflow
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Kommentarer */}
                        {offer.oneflow_contract_id && (
                          <div className="pt-2 border-t border-slate-700/50">
                            <div className="flex items-center gap-1.5 mb-2">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-medium text-slate-300">Kommentarer</span>
                            </div>
                            <CommentThread
                              contractId={offer.oneflow_contract_id}
                              senderEmail={senderEmail}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

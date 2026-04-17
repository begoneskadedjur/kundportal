// src/components/coordinator/follow-up/FollowUpTable.tsx
// Expanderbar tabell för offertuppföljning med prioritetsgrupper, dölj-funktion och intern kommunikation
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, MessageSquare, ExternalLink,
  Clock, AlertTriangle, User, Mail, Phone,
  FileSignature, Archive, EyeOff, Eye, Search, X, Trash2,
  MoreVertical, FileText,
} from 'lucide-react'
import ReactDOM from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { OFFER_STATUS_CONFIG } from '../../../types/casePipeline'
import { CommentThread } from './CommentThread'
import CommentSection from '../../communication/CommentSection'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import type { FollowUpOffer, FollowUpSortBy, FollowUpStatusFilter } from '../../../services/offerFollowUpService'
import type { CaseBillingItemWithRelations } from '../../../types/caseBilling'
import OfferItemsSection from './OfferItemsSection'
import Select from '../../ui/Select'

interface FollowUpTableProps {
  offers: FollowUpOffer[]
  sortBy: FollowUpSortBy
  statusFilter: FollowUpStatusFilter
  onSortChange: (sort: FollowUpSortBy) => void
  onStatusFilterChange: (filter: FollowUpStatusFilter) => void
  isCoordinator: boolean
  senderEmail?: string
  showArchived: boolean
  onToggleArchived: () => void
  // Sökfunktion
  searchQuery?: string
  onSearchChange?: (query: string) => void
  // Dölj-funktion
  onHide?: (contractId: string) => void
  onUnhide?: (contractId: string) => void
  userId?: string
  showHidden?: boolean
  onToggleHidden?: () => void
  hiddenCount?: number
  // Radera-funktion
  onDelete?: (contractId: string) => void
}

const STATUS_FILTERS: { key: FollowUpStatusFilter; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'pending', label: 'Pågående' },
  { key: 'overdue', label: 'Förfallna' },
  { key: 'signed', label: 'Signerade' },
  { key: 'declined', label: 'Avfärdade' },
]

const SORT_OPTIONS: { key: FollowUpSortBy; label: string }[] = [
  { key: 'priority', label: 'Prioritet' },
  { key: 'oldest', label: 'Äldst först' },
  { key: 'newest', label: 'Nyast först' },
  { key: 'value_desc', label: 'Värde (högst)' },
  { key: 'technician', label: 'Tekniker' },
]

const PRIORITY_ORDER = { critical: 0, warning: 1, normal: 2, archived: 3 } as const

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

// === Rad-komponent ===
function OfferRow({
  offer,
  isExpanded,
  onToggle,
  isCoordinator,
  senderEmail,
  onHide,
  onUnhide,
  isHiddenByMe,
  onDelete,
}: {
  offer: FollowUpOffer
  isExpanded: boolean
  onToggle: () => void
  isCoordinator: boolean
  senderEmail?: string
  onHide?: (contractId: string) => void
  onUnhide?: (contractId: string) => void
  isHiddenByMe: boolean
  onDelete?: (contractId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal')
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  // Lazy-load tjänster + artiklar vid första expand
  const [itemsData, setItemsData] = useState<{
    services: CaseBillingItemWithRelations[]
    articles: CaseBillingItemWithRelations[]
  } | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!isExpanded || hasFetchedRef.current) return
    hasFetchedRef.current = true
    let cancelled = false
    setItemsLoading(true)
    setItemsError(null)
    OfferFollowUpService.getContractItems(offer.id)
      .then(data => {
        if (!cancelled) setItemsData(data)
      })
      .catch(err => {
        if (!cancelled) {
          setItemsError(err instanceof Error ? err.message : 'Okänt fel')
          hasFetchedRef.current = false // tillåt retry vid fel
        }
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false)
      })
    return () => { cancelled = true }
  }, [isExpanded, offer.id])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const ageBadge = getAgeBadge(offer.age_days)
  const borderColor = getAgeBorderColor(offer.age_days)
  const statusConfig = OFFER_STATUS_CONFIG[offer.status] || { label: offer.status, color: 'text-slate-400', bgColor: 'bg-slate-500/15' }
  const isArchived = offer.priority === 'archived'

  return (
    <div className={`rounded-xl overflow-hidden ${isArchived ? 'opacity-60' : ''} ${isHiddenByMe ? 'opacity-40' : ''}`}>
      {/* Rad */}
      <button
        onClick={onToggle}
        className={`w-full text-left p-3 border-l-4 ${borderColor} bg-slate-800/30 border border-slate-700/50 border-l-4 rounded-xl hover:bg-slate-800/50 transition-colors`}
      >
        <div className="flex items-center gap-3">
          {/* Pulserande prick för nyligen förfallna */}
          {offer.is_recently_overdue && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}

          {/* Åldersbadge + prioritetstaggar */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ageBadge.className}`}>
              {ageBadge.label}
            </span>
            {offer.is_recently_overdue && (
              <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400">
                Ny!
              </span>
            )}
            {offer.priority === 'warning' && (
              <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400">
                Snart förfallen
              </span>
            )}
          </div>

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

          {/* Dölj-knapp */}
          {(onHide || onUnhide) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isHiddenByMe) {
                  onUnhide?.(offer.id)
                } else {
                  onHide?.(offer.id)
                }
              }}
              className={`p-1 rounded transition-colors flex-shrink-0 ${
                isHiddenByMe
                  ? 'text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700/30'
              }`}
              title={isHiddenByMe ? 'Visa igen' : 'Dölj offert'}
            >
              {isHiddenByMe ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Radera-knapp */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(offer.id)
              }}
              className="p-1 rounded transition-colors flex-shrink-0 text-slate-600 hover:text-red-400 hover:bg-red-500/10"
              title="Radera offert"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Snabbåtgärder-meny */}
          {(offer.source_id || offer.contact_email || offer.contact_phone) && (
            <div className="flex-shrink-0">
              <button
                ref={triggerRef}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!menuOpen && triggerRef.current) {
                    const rect = triggerRef.current.getBoundingClientRect()
                    setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 })
                  }
                  setMenuOpen(!menuOpen)
                }}
                className="p-1 rounded transition-colors text-slate-600 hover:text-slate-300 hover:bg-slate-700/30"
                title="Snabbåtgärder"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {menuOpen && ReactDOM.createPortal(
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
              className="w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {offer.source_id && (
                <button
                  onClick={() => {
                    const caseType = offer.source_type === 'business_case' ? 'business' : 'private'
                    const path = isCoordinator
                      ? `/coordinator/case-search?openCase=${offer.source_id}&caseType=${caseType}`
                      : `/technician/schedule?openCase=${offer.source_id}&caseType=${caseType}`
                    navigate(path)
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#20c58f]" />
                  Gå till ärende
                </button>
              )}
              {offer.contact_email && (
                <a
                  href={`mailto:${offer.contact_email}`}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  Skicka e-post
                </a>
              )}
              {offer.contact_phone && (
                <a
                  href={`tel:${offer.contact_phone}`}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Phone className="w-3.5 h-3.5 text-purple-400" />
                  Ring kund
                </a>
              )}
            </div>,
            document.body
          )}

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

              {/* Innehåll i offerten: tjänster + interna artiklar */}
              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-300">Innehåll i offerten</span>
                </div>
                <OfferItemsSection
                  services={itemsData?.services || []}
                  articles={itemsData?.articles || []}
                  loading={itemsLoading}
                  error={itemsError}
                />
              </div>

              {/* Kommunikation — intern/extern flikar */}
              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-1 mb-2">
                  <button
                    onClick={() => setActiveTab('internal')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'internal'
                        ? 'bg-[#20c58f] text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 border border-slate-700/50'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Intern
                  </button>
                  {offer.oneflow_contract_id && (
                    <button
                      onClick={() => setActiveTab('external')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === 'external'
                          ? 'bg-[#20c58f] text-white'
                          : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 border border-slate-700/50'
                      }`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Oneflow
                    </button>
                  )}
                </div>

                {activeTab === 'internal' ? (
                  <CommentSection
                    caseId={offer.id}
                    caseType="contract"
                    caseTitle={offer.company_name || offer.contact_person || ''}
                    compact={true}
                  />
                ) : offer.oneflow_contract_id ? (
                  <CommentThread
                    contractId={offer.oneflow_contract_id}
                    senderEmail={senderEmail}
                  />
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// === Sektionsheader ===
function SectionHeader({ icon: Icon, label, count, className }: {
  icon: React.ElementType
  label: string
  count: number
  className: string
}) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] opacity-60">{count} st</span>
    </div>
  )
}

// === Huvudkomponent ===
export function FollowUpTable({
  offers,
  sortBy,
  statusFilter,
  onSortChange,
  onStatusFilterChange,
  isCoordinator,
  senderEmail,
  showArchived,
  onToggleArchived,
  searchQuery = '',
  onSearchChange,
  onHide,
  onUnhide,
  userId,
  showHidden,
  onToggleHidden,
  hiddenCount = 0,
  onDelete,
}: FollowUpTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Sök-filtrering
  const searchFiltered = searchQuery.trim()
    ? offers.filter(o => {
        const q = searchQuery.toLowerCase()
        return (
          o.company_name?.toLowerCase().includes(q) ||
          o.contact_person?.toLowerCase().includes(q) ||
          o.contact_email?.toLowerCase().includes(q) ||
          o.technician_name?.toLowerCase().includes(q)
        )
      })
    : offers

  // Räkna arkiverade (innan filtrering)
  const archivedCount = searchFiltered.filter(o => o.priority === 'archived').length

  // Filter
  const filtered = searchFiltered.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (!showArchived && o.priority === 'archived') return false
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const pa = PRIORITY_ORDER[a.priority] ?? 2
        const pb = PRIORITY_ORDER[b.priority] ?? 2
        if (pa !== pb) return pa - pb
        return a.age_days - b.age_days
      case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'value_desc': return (b.total_value || 0) - (a.total_value || 0)
      case 'technician': return (a.technician_name || '').localeCompare(b.technician_name || '')
      default: return 0
    }
  })

  // Prioritetsgrupper (bara vid prioritetssort)
  const usePriorityGroups = sortBy === 'priority'
  const critical = usePriorityGroups ? sorted.filter(o => o.priority === 'critical') : []
  const warning = usePriorityGroups ? sorted.filter(o => o.priority === 'warning') : []
  const normal = usePriorityGroups ? sorted.filter(o => o.priority === 'normal') : []
  const archived = usePriorityGroups ? sorted.filter(o => o.priority === 'archived') : []

  const renderRow = (offer: FollowUpOffer) => (
    <OfferRow
      key={offer.id}
      offer={offer}
      isExpanded={expandedId === offer.id}
      onToggle={() => setExpandedId(expandedId === offer.id ? null : offer.id)}
      isCoordinator={isCoordinator}
      senderEmail={senderEmail}
      onHide={onHide}
      onUnhide={onUnhide}
      isHiddenByMe={userId ? (offer.hidden_by || []).includes(userId) : false}
      onDelete={onDelete}
    />
  )

  return (
    <div className="space-y-3" id="follow-up-table">
      {/* Sökfält */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Sök kund, kontaktperson, tekniker..."
            className="w-full pl-8 pr-8 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

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
        <Select
          value={sortBy}
          onChange={v => onSortChange(v as FollowUpSortBy)}
          options={SORT_OPTIONS.map(s => ({ value: s.key, label: s.label }))}
          className="w-36"
        />

        <span className="text-xs text-slate-500">{sorted.length} st</span>

        {/* Dolda-toggle */}
        {hiddenCount > 0 && onToggleHidden && (
          <button
            onClick={onToggleHidden}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              showHidden
                ? 'bg-slate-700/50 text-slate-300'
                : 'bg-slate-800/30 text-slate-500 hover:text-slate-400'
            }`}
          >
            <EyeOff className="w-3 h-3" />
            {showHidden ? 'Dölj gömda' : `${hiddenCount} dolda`}
          </button>
        )}

        {/* Arkiv-toggle */}
        {archivedCount > 0 && (
          <button
            onClick={onToggleArchived}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              showArchived
                ? 'bg-slate-700/50 text-slate-300'
                : 'bg-slate-800/30 text-slate-500 hover:text-slate-400'
            }`}
          >
            <Archive className="w-3 h-3" />
            {showArchived ? 'Dölj gamla' : `+${archivedCount} gamla (90d+)`}
          </button>
        )}
      </div>

      {/* Tabell */}
      {sorted.length === 0 ? (
        <div className="text-center py-8">
          <FileSignature className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Inga offerter matchar filtret</p>
        </div>
      ) : usePriorityGroups ? (
        /* Grupperad vy */
        <div className="space-y-4">
          {critical.length > 0 && (
            <div className="space-y-1.5">
              <SectionHeader
                icon={AlertTriangle}
                label="Kräver omedelbar åtgärd"
                count={critical.length}
                className="bg-red-500/10 border border-red-500/20 text-red-400"
              />
              {critical.map(renderRow)}
            </div>
          )}

          {warning.length > 0 && (
            <div className="space-y-1.5">
              <SectionHeader
                icon={Clock}
                label="Närmar sig deadline"
                count={warning.length}
                className="bg-amber-500/10 border border-amber-500/20 text-amber-400"
              />
              {warning.map(renderRow)}
            </div>
          )}

          {normal.length > 0 && (
            <div className="space-y-1.5">
              {(critical.length > 0 || warning.length > 0) && (
                <div className="px-2 py-1">
                  <span className="text-xs text-slate-500">Övriga offerter</span>
                </div>
              )}
              {normal.map(renderRow)}
            </div>
          )}

          {archived.length > 0 && (
            <div className="space-y-1.5">
              <SectionHeader
                icon={Archive}
                label="Gamla offerter (90+ dagar)"
                count={archived.length}
                className="bg-slate-800/30 border border-slate-700/30 text-slate-500"
              />
              {archived.map(renderRow)}
            </div>
          )}
        </div>
      ) : (
        /* Platt vy (andra sorteringar) */
        <div className="space-y-1.5">
          {sorted.map(renderRow)}
        </div>
      )}
    </div>
  )
}

// ActionableCasesDrawer.tsx — Expanderbar panel med actions för ärenden att boka in
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  CalendarPlus, ChevronUp, ChevronRight, ChevronDown, ExternalLink,
  Eye, Phone, CalendarCheck, PhoneCall, MailIcon, MessageCircle, MessageSquare, Loader2,
  ArrowUpDown, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { BeGoneCaseRow } from '../../../types/database'
import { CasePipelineService } from '../../../services/casePipelineService'
import { COORDINATOR_STATUS_CONFIG } from '../../../types/casePipeline'
import type { CoordinatorCaseAction, CoordinatorCaseStatus, ContactMethod } from '../../../types/casePipeline'
import CommentInput from '../../communication/CommentInput'
import { useCaseComments } from '../../../hooks/useCaseComments'
import type { TrackedMention } from '../../../hooks/useMentions'
import { formatAddress } from './scheduleUtils'

interface ActionableCasesDrawerProps {
  cases: BeGoneCaseRow[]
  actionMap: Record<string, CoordinatorCaseAction>
  onScheduleCase: (caseData: BeGoneCaseRow) => void
  onActionUpdate: (caseId: string, action: CoordinatorCaseAction) => void
  onOpenHistory?: (caseData: BeGoneCaseRow) => void
  onOpenCase?: (caseData: BeGoneCaseRow) => void
  onClose: () => void
}

type DrawerSort = 'default' | 'status' | 'attempts'

const STATUS_ORDER: Record<string, number> = {
  new: 0, acknowledged: 1, in_progress: 2, contacted: 3, booked: 4, completed: 5,
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

export function ActionableCasesDrawer({ cases, actionMap, onScheduleCase, onActionUpdate, onOpenHistory, onOpenCase, onClose }: ActionableCasesDrawerProps) {
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<DrawerSort>('default')

  const toggleSort = (col: DrawerSort) => {
    setSortBy(prev => prev === col ? 'default' : col)
  }

  const sorted = useMemo(() => {
    return [...cases].sort((a, b) => {
      if (sortBy === 'default') {
        const aNew = !actionMap[a.id] || actionMap[a.id].coordinator_status === 'new' ? 0 : 1
        const bNew = !actionMap[b.id] || actionMap[b.id].coordinator_status === 'new' ? 0 : 1
        if (aNew !== bNew) return aNew - bNew
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
      if (sortBy === 'status') {
        const aStatus = actionMap[a.id]?.coordinator_status || 'new'
        const bStatus = actionMap[b.id]?.coordinator_status || 'new'
        return (STATUS_ORDER[aStatus] ?? 99) - (STATUS_ORDER[bStatus] ?? 99)
      }
      if (sortBy === 'attempts') {
        return (actionMap[b.id]?.contact_attempts || 0) - (actionMap[a.id]?.contact_attempts || 0)
      }
      return 0
    })
  }, [cases, actionMap, sortBy])

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
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="sticky top-0 bg-slate-900/95 z-10">
                <tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="px-1 py-1.5 font-medium w-5"></th>
                  <th className="px-2 py-1.5 font-medium">Ärende</th>
                  <th className="px-2 py-1.5 font-medium">Typ</th>
                  <th className="px-2 py-1.5 font-medium">Tekniker</th>
                  <th
                    className={`px-2 py-1.5 font-medium cursor-pointer select-none hover:text-slate-300 transition-colors ${sortBy === 'status' ? 'text-[#20c58f]' : ''}`}
                    onClick={() => toggleSort('status')}
                  >
                    <span className="flex items-center gap-1">Status <ArrowUpDown className="w-2.5 h-2.5" /></span>
                  </th>
                  <th
                    className={`px-2 py-1.5 font-medium cursor-pointer select-none hover:text-slate-300 transition-colors ${sortBy === 'attempts' ? 'text-[#20c58f]' : ''}`}
                    onClick={() => toggleSort('attempts')}
                  >
                    <span className="flex items-center gap-1">Försök <ArrowUpDown className="w-2.5 h-2.5" /></span>
                  </th>
                  <th className="px-2 py-1.5 font-medium hidden md:table-cell">Signerad</th>
                  <th className="px-2 py-1.5 font-medium hidden lg:table-cell">Anteckning</th>
                  <th className="px-2 py-1.5 font-medium text-right">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => (
                  <DrawerRow
                    key={c.id}
                    caseRow={c}
                    action={actionMap[c.id] || null}
                    onScheduleCase={onScheduleCase}
                    onActionUpdate={onActionUpdate}
                    onOpenHistory={onOpenHistory}
                    onOpenCase={onOpenCase}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Expanderbar rad ───

interface DrawerRowProps {
  caseRow: BeGoneCaseRow
  action: CoordinatorCaseAction | null
  onScheduleCase: (caseData: BeGoneCaseRow) => void
  onActionUpdate: (caseId: string, action: CoordinatorCaseAction) => void
  onOpenHistory?: (caseData: BeGoneCaseRow) => void
  onOpenCase?: (caseData: BeGoneCaseRow) => void
}

function DrawerRow({ caseRow: c, action, onScheduleCase, onActionUpdate, onOpenHistory, onOpenCase }: DrawerRowProps) {
  const { user, profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const contactBtnRef = useRef<HTMLButtonElement>(null)

  const isNew = !action || action.coordinator_status === 'new'
  const status = action?.coordinator_status || 'new'
  const cfg = COORDINATOR_STATUS_CONFIG[status]
  const isScheduled = !!(c.start_date && c.due_date)
  const notePreview = action?.coordinator_notes || ''

  const { addComment, isSubmitting: commentSubmitting } = useCaseComments({
    caseId: c.id,
    caseType: c.case_type as 'private' | 'business' | 'contract',
    caseTitle: c.title,
  })

  const handleAddComment = useCallback(async (
    content: string,
    attachments?: File[],
    mentions?: TrackedMention[],
    parentCommentId?: string
  ) => {
    await addComment(content, attachments, mentions, parentCommentId)
    toast.success('Kommentar sparad')
  }, [addComment])

  const handleAcknowledge = useCallback(async () => {
    if (!user?.id || !profile?.display_name) return
    setActionLoading('acknowledge')
    try {
      const updated = await CasePipelineService.acknowledgeCase(c.id, c.case_type as 'private' | 'business' | 'contract', user.id, profile.display_name)
      onActionUpdate(c.id, updated)
      toast.success('Kvitterat')
    } catch { toast.error('Kunde inte kvittera') }
    finally { setActionLoading(null) }
  }, [c.id, c.case_type, user, profile, onActionUpdate])

  const handleLogContact = useCallback(async (method: ContactMethod, note?: string) => {
    if (!user?.id || !profile?.display_name) return
    setActionLoading('contact')
    try {
      const updated = await CasePipelineService.logContactAttempt(c.id, c.case_type as 'private' | 'business' | 'contract', user.id, profile.display_name, method, note)
      onActionUpdate(c.id, updated)
      // Logga som intern kommentar i case_comments
      const methodLabel = method === 'phone' ? 'Telefon' : method === 'email' ? 'E-post' : 'SMS'
      const commentText = note
        ? `Kontaktförsök via ${methodLabel}: ${note}`
        : `Kontaktförsök via ${methodLabel}`
      await addComment(commentText)
      setContactOpen(false)
      toast.success('Kontaktförsök loggat')
    } catch { toast.error('Kunde inte logga') }
    finally { setActionLoading(null) }
  }, [c.id, c.case_type, user, profile, onActionUpdate, addComment])


  const handleStatusChange = useCallback(async (newStatus: CoordinatorCaseStatus) => {
    try {
      const updated = await CasePipelineService.updateStatus(c.id, c.case_type as 'private' | 'business' | 'contract', newStatus)
      onActionUpdate(c.id, updated)
    } catch { toast.error('Kunde inte byta status') }
  }, [c.id, c.case_type, onActionUpdate])

  const addr = formatAddress(c.adress)

  return (
    <>
      {/* Kompakt rad */}
      <tr
        className={`border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors cursor-pointer ${isNew ? 'bg-amber-500/[0.03]' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-1 py-1.5 text-slate-500">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />
          }
        </td>
        <td className="px-2 py-1.5">
          <span className="text-white font-medium truncate block max-w-[160px]" title={c.title || 'Utan titel'}>{c.title || 'Utan titel'}</span>
          {c.case_number && (
            <span className="text-[10px] text-slate-500 font-mono block">{c.case_number}</span>
          )}
        </td>
        <td className="px-2 py-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
            c.case_type === 'private' ? 'bg-blue-500/15 text-blue-400'
            : c.case_type === 'contract' ? 'bg-[#20c58f]/15 text-[#20c58f]'
            : 'bg-purple-500/15 text-purple-400'
          }`}>
            {c.case_type === 'private' ? 'Privat' : c.case_type === 'contract' ? 'Offert' : 'Företag'}
          </span>
          {(c as any).oneflow_contract_id && c.case_type !== 'contract' && (
            <span className="ml-1 px-1 py-0.5 rounded text-[8px] font-medium bg-[#20c58f]/10 text-[#20c58f]">Offert</span>
          )}
        </td>
        <td className="px-2 py-1.5 text-slate-300 font-medium">{c.primary_assignee_name || '—'}</td>
        <td className="px-2 py-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${cfg.bgColor} ${cfg.color}`}>
            {cfg.label}
          </span>
        </td>
        <td className="px-2 py-1.5">
          <span className={`text-[11px] font-medium ${(action?.contact_attempts || 0) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
            {action?.contact_attempts || 0}
          </span>
        </td>
        <td className="px-2 py-1.5 text-slate-500 hidden md:table-cell">{formatRelativeDate(c.updated_at)}</td>
        <td className="px-2 py-1.5 hidden lg:table-cell">
          <span
            className="text-slate-500 text-[10px] truncate block max-w-[120px]"
            title={notePreview || undefined}
          >
            {notePreview ? (notePreview.length > 18 ? notePreview.slice(0, 18) + '...' : notePreview) : '—'}
          </span>
        </td>
        <td className="px-2 py-1.5 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {/* Kvittera (bara om ny) */}
            {isNew && (
              <button
                onClick={handleAcknowledge}
                disabled={actionLoading === 'acknowledge'}
                className="p-1 rounded text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                title="Kvittera"
              >
                {actionLoading === 'acknowledge' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Logga kontakt */}
            <button
              ref={contactBtnRef}
              onClick={() => setContactOpen(!contactOpen)}
              disabled={actionLoading === 'contact'}
              className="p-1 rounded text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              title="Logga kontaktförsök"
            >
              {actionLoading === 'contact' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
            </button>
            {contactOpen && (
              <ContactPopover
                anchorRef={contactBtnRef}
                onConfirm={handleLogContact}
                onClose={() => setContactOpen(false)}
              />
            )}

            {/* Öppna ärende */}
            {onOpenCase && (
              <button
                onClick={() => onOpenCase(c)}
                className="p-1 rounded text-slate-400 hover:bg-slate-700/50 transition-colors"
                title="Öppna ärende"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Historik */}
            {onOpenHistory && (
              <button
                onClick={() => onOpenHistory(c)}
                className="p-1 rounded text-purple-400 hover:bg-purple-500/20 transition-colors"
                title="Visa historik"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Boka in */}
            {!isScheduled && (
              <button
                onClick={() => onScheduleCase(c)}
                className="p-1 rounded text-[#20c58f] hover:bg-[#20c58f]/20 transition-colors"
                title="Boka in i schemat"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
              </button>
            )}
            {isScheduled && (
              <span className="text-[9px] text-emerald-400 font-medium px-1">Inbokad</span>
            )}
          </div>
        </td>
      </tr>

      {/* Expanderad detalj */}
      {expanded && (
        <tr>
          <td colSpan={9} className="px-0 py-0">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-800/20 border-b border-slate-700/30"
            >
              <div className="px-6 py-3 space-y-2">
                {/* Kontaktinfo */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-slate-400">Kontakt: <span className="text-slate-200">{c.kontaktperson || '—'}</span></span>
                  <span className="text-slate-400">Tel: <span className="text-slate-200">{c.telefon_kontaktperson || '—'}</span></span>
                  {c.e_post_kontaktperson && (
                    <span className="text-slate-400">E-post: <span className="text-slate-200">{c.e_post_kontaktperson}</span></span>
                  )}
                </div>

                {/* Ärende-info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-slate-400">Adress: <span className="text-slate-200">{addr || '—'}</span></span>
                  <span className="text-slate-400">Skadedjur: <span className="text-slate-200">{c.skadedjur || '—'}</span></span>
                  <span className="text-slate-400">Pris: <span className="text-slate-200">{c.pris ? `${c.pris.toLocaleString('sv-SE')} kr` : '—'}</span></span>
                  <span className="text-slate-400">Signerad: <span className="text-slate-200">{formatRelativeDate(c.updated_at)}</span></span>
                </div>

                {/* Koord.status dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-slate-500">Status:</label>
                  <select
                    value={status}
                    onChange={e => handleStatusChange(e.target.value as CoordinatorCaseStatus)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer focus:ring-1 focus:ring-[#20c58f] ${cfg.bgColor} ${cfg.color}`}
                  >
                    {Object.entries(COORDINATOR_STATUS_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                {/* Kommentar med @mention-stöd */}
                <div className="relative">
                  <CommentInput
                    onSubmit={handleAddComment}
                    isSubmitting={commentSubmitting}
                    placeholder="Skriv kommentar... (@namn för att nämna)"
                    autoFocus={false}
                  />
                </div>
              </div>
            </motion.div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Kontaktförsök-popover (tvåstegs: välj metod → bekräfta) ───

function ContactPopover({ anchorRef, onConfirm, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onConfirm: (method: ContactMethod, note?: string) => void
  onClose: () => void
}) {
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod | null>(null)
  const [note, setNote] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useLayoutEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
  }, [anchorRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleConfirm = () => {
    if (!selectedMethod) return
    onConfirm(selectedMethod, note || undefined)
  }

  return (
    <div ref={ref} className="fixed z-[100] w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2.5" style={{ top: pos.top, right: pos.right }}>
      <p className="text-[10px] text-slate-400 mb-2 font-medium">Logga kontaktförsök</p>
      <div className="flex gap-1.5 mb-2">
        {([
          { method: 'phone' as ContactMethod, label: 'Telefon', icon: PhoneCall },
          { method: 'email' as ContactMethod, label: 'E-post', icon: MailIcon },
          { method: 'sms' as ContactMethod, label: 'SMS', icon: MessageCircle },
        ]).map(({ method, label, icon: Icon }) => (
          <button
            key={method}
            onClick={() => setSelectedMethod(method)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              selectedMethod === method
                ? 'bg-[#20c58f]/20 text-[#20c58f] ring-1 ring-[#20c58f]'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          placeholder="Valfri anteckning..."
          className="flex-1 px-2 py-1 text-[10px] bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
        />
        <button
          onClick={handleConfirm}
          disabled={!selectedMethod}
          className="p-1.5 rounded bg-[#20c58f] text-white hover:bg-[#1ab07e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Bekräfta"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

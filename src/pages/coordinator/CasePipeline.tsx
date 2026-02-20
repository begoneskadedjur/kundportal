// src/pages/coordinator/CasePipeline.tsx — Offerthantering: koordinatorns pipeline
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Search, Phone, Mail, MessageSquare, Eye,
  CalendarCheck, ArrowUpDown, ChevronDown, X, Loader2,
  PhoneCall, MailIcon, MessageCircle, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { CasePipelineService } from '../../services/casePipelineService'
import { formatAddress } from '../../components/coordinator/schedule-v2/scheduleUtils'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import type { PipelineCaseRow, PipelineTab, CoordinatorCaseStatus, ContactMethod } from '../../types/casePipeline'
import { COORDINATOR_STATUS_CONFIG, PIPELINE_TABS } from '../../types/casePipeline'

// ─── Hjälpfunktioner ───

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

function formatPrice(price: number | null): string {
  if (!price) return '—'
  return `${price.toLocaleString('sv-SE')} kr`
}

type SortOption = 'oldest' | 'newest' | 'price_desc' | 'contact_attempts'

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'oldest', label: 'Äldst först' },
  { key: 'newest', label: 'Nyast först' },
  { key: 'price_desc', label: 'Pris (högst)' },
  { key: 'contact_attempts', label: 'Flest kontaktförsök' },
]

// ─── Huvudkomponent ───

export default function CasePipeline() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [cases, setCases] = useState<PipelineCaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PipelineTab>('alla')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('oldest')

  // Modal-state
  const [selectedCase, setSelectedCase] = useState<PipelineCaseRow | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Kontaktförsök-popover
  const [contactPopoverCaseId, setContactPopoverCaseId] = useState<string | null>(null)

  // Inline note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const fetchCases = useCallback(async () => {
    try {
      const data = await CasePipelineService.getPipelineCases()
      setCases(data)
    } catch (err) {
      console.error('Fel vid hämtning av pipeline-ärenden:', err)
      toast.error('Kunde inte ladda ärenden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCases() }, [fetchCases])

  // ─── Filtrering + sökning + sortering ───

  const filtered = useMemo(() => {
    const tab = PIPELINE_TABS.find(t => t.key === activeTab)!
    let result = cases.filter(c => tab.statuses.includes(c.status))

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.kontaktperson || '').toLowerCase().includes(q) ||
        (c.primary_assignee_name || '').toLowerCase().includes(q) ||
        (c.bestallare || '').toLowerCase().includes(q) ||
        (c.skadedjur || '').toLowerCase().includes(q)
      )
    }

    // Sortering: okvitterade bubblar alltid överst
    result.sort((a, b) => {
      const aNew = !a.action || a.action.coordinator_status === 'new' ? 0 : 1
      const bNew = !b.action || b.action.coordinator_status === 'new' ? 0 : 1
      if (aNew !== bNew) return aNew - bNew

      switch (sortBy) {
        case 'oldest': return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        case 'newest': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'price_desc': return (b.pris || 0) - (a.pris || 0)
        case 'contact_attempts': return (b.action?.contact_attempts || 0) - (a.action?.contact_attempts || 0)
        default: return 0
      }
    })

    return result
  }, [cases, activeTab, searchQuery, sortBy])

  // ─── KPI ───

  const stats = useMemo(() => {
    const offertSkickad = cases.filter(c => c.status === 'Offert skickad').length
    const signerad = cases.filter(c => c.status === 'Offert signerad - boka in').length
    const ejKvitterat = cases.filter(c => !c.action || c.action.coordinator_status === 'new').length
    return { offertSkickad, signerad, ejKvitterat }
  }, [cases])

  // ─── Actions ───

  const handleAcknowledge = useCallback(async (c: PipelineCaseRow) => {
    if (!user?.id || !profile?.display_name) return
    try {
      const updated = await CasePipelineService.acknowledgeCase(c.case_id || c.id, c.case_type, user.id, profile.display_name)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
      toast.success('Ärende kvitterat')
    } catch (err) {
      toast.error('Kunde inte kvittera')
    }
  }, [user, profile])

  const handleLogContact = useCallback(async (c: PipelineCaseRow, method: ContactMethod, note?: string) => {
    if (!user?.id || !profile?.display_name) return
    try {
      const updated = await CasePipelineService.logContactAttempt(c.id, c.case_type, user.id, profile.display_name, method, note)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
      setContactPopoverCaseId(null)
      toast.success('Kontaktförsök loggat')
    } catch (err) {
      toast.error('Kunde inte logga kontaktförsök')
    }
  }, [user, profile])

  const handleSaveNote = useCallback(async (c: PipelineCaseRow) => {
    if (!user?.id || !profile?.display_name) return
    try {
      const updated = await CasePipelineService.updateNotes(c.id, c.case_type, noteText, user.id, profile.display_name)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
      setEditingNoteId(null)
      setNoteText('')
      toast.success('Anteckning sparad')
    } catch (err) {
      toast.error('Kunde inte spara')
    }
  }, [user, profile, noteText])

  const handleStatusChange = useCallback(async (c: PipelineCaseRow, status: CoordinatorCaseStatus) => {
    try {
      const updated = await CasePipelineService.updateStatus(c.id, c.case_type, status)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
    } catch (err) {
      toast.error('Kunde inte byta status')
    }
  }, [])

  const handleBookCase = useCallback((c: PipelineCaseRow) => {
    navigate(`/koordinator/schema-v2?openCase=${c.id}`)
  }, [navigate])

  const handleOpenCase = useCallback((c: PipelineCaseRow) => {
    setSelectedCase(c)
    setIsEditModalOpen(true)
  }, [])

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false)
    setSelectedCase(null)
    fetchCases()
  }, [fetchCases])

  // ─── Render ───

  return (
    <>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-[#20c58f]" />
          <h1 className="text-xl font-bold text-white">Offerthantering</h1>
        </div>

        {/* KPI-strip */}
        <div className="flex flex-wrap gap-3">
          <KpiChip label="Offert skickad" value={stats.offertSkickad} color="text-emerald-400" bg="bg-emerald-500/10" />
          <KpiChip label="Signerad" value={stats.signerad} color="text-green-400" bg="bg-green-500/10" />
          <KpiChip label="Ej kvitterat" value={stats.ejKvitterat} color="text-amber-400" bg="bg-amber-500/10" />
        </div>

        {/* Flikar + sök + sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-800/50 rounded-lg p-0.5">
            {PIPELINE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#20c58f] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Sök ärende, kund, tekniker..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            />
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Tabell */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar ärenden...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="mx-auto w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Inga ärenden matchar filtret</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-700/50">
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Ärende</th>
                  <th className="px-3 py-2.5 font-medium">Typ</th>
                  <th className="px-3 py-2.5 font-medium">Kund / Kontakt</th>
                  <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Adress</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Skadedjur</th>
                  <th className="px-3 py-2.5 font-medium">Tekniker</th>
                  <th className="px-3 py-2.5 font-medium">Pris</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Skickat</th>
                  <th className="px-3 py-2.5 font-medium">Koord. status</th>
                  <th className="px-3 py-2.5 font-medium">Försök</th>
                  <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Anteckning</th>
                  <th className="px-3 py-2.5 font-medium">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <PipelineRow
                    key={c.id}
                    caseRow={c}
                    onAcknowledge={handleAcknowledge}
                    onOpenContactPopover={setContactPopoverCaseId}
                    contactPopoverOpen={contactPopoverCaseId === c.id}
                    onLogContact={handleLogContact}
                    onStartEditNote={(id, currentNote) => { setEditingNoteId(id); setNoteText(currentNote || '') }}
                    editingNoteId={editingNoteId}
                    noteText={noteText}
                    onNoteTextChange={setNoteText}
                    onSaveNote={handleSaveNote}
                    onCancelNote={() => { setEditingNoteId(null); setNoteText('') }}
                    onStatusChange={handleStatusChange}
                    onBook={handleBookCase}
                    onOpenCase={handleOpenCase}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EditCaseModal */}
      {selectedCase && (
        <EditCaseModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setSelectedCase(null) }}
          onSuccess={handleEditSuccess}
          caseData={selectedCase as any}
          technicians={[]}
        />
      )}
    </>
  )
}

// ─── KPI-chip ───

function KpiChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg} border border-slate-700/30`}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  )
}

// ─── Tabellrad ───

interface PipelineRowProps {
  caseRow: PipelineCaseRow
  onAcknowledge: (c: PipelineCaseRow) => void
  onOpenContactPopover: (id: string | null) => void
  contactPopoverOpen: boolean
  onLogContact: (c: PipelineCaseRow, method: ContactMethod, note?: string) => void
  onStartEditNote: (id: string, currentNote: string | null) => void
  editingNoteId: string | null
  noteText: string
  onNoteTextChange: (text: string) => void
  onSaveNote: (c: PipelineCaseRow) => void
  onCancelNote: () => void
  onStatusChange: (c: PipelineCaseRow, status: CoordinatorCaseStatus) => void
  onBook: (c: PipelineCaseRow) => void
  onOpenCase: (c: PipelineCaseRow) => void
}

function PipelineRow({
  caseRow: c, onAcknowledge, onOpenContactPopover, contactPopoverOpen,
  onLogContact, onStartEditNote, editingNoteId, noteText, onNoteTextChange,
  onSaveNote, onCancelNote, onStatusChange, onBook, onOpenCase,
}: PipelineRowProps) {
  const addr = formatAddress(c.adress)
  const isNew = !c.action || c.action.coordinator_status === 'new'
  const status = c.action?.coordinator_status || 'new'
  const cfg = COORDINATOR_STATUS_CONFIG[status]
  const isSignerad = c.status === 'Offert signerad - boka in'
  const contactNoteRef = useRef<HTMLInputElement>(null)

  return (
    <tr className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${isNew ? 'bg-amber-500/[0.03]' : ''}`}>
      {/* ClickUp-status */}
      <td className="px-3 py-2.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
          isSignerad ? 'bg-green-500/15 text-green-400' : 'bg-emerald-500/15 text-emerald-400'
        }`}>
          {isSignerad ? 'Signerad' : 'Offert'}
        </span>
      </td>

      {/* Ärende (klickbar) */}
      <td className="px-3 py-2.5">
        <button
          onClick={() => onOpenCase(c)}
          className="text-white font-medium hover:text-[#20c58f] transition-colors text-left truncate max-w-[180px] block"
          title={c.title}
        >
          {c.title || 'Utan titel'}
        </button>
      </td>

      {/* Typ */}
      <td className="px-3 py-2.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          c.case_type === 'private' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
        }`}>
          {c.case_type === 'private' ? 'Privat' : 'Företag'}
        </span>
      </td>

      {/* Kund/Kontakt */}
      <td className="px-3 py-2.5">
        <div className="max-w-[160px]">
          <p className="text-white truncate text-[11px]">{c.kontaktperson || c.bestallare || '—'}</p>
          {c.telefon_kontaktperson && (
            <p className="text-slate-500 truncate text-[10px]">{c.telefon_kontaktperson}</p>
          )}
        </div>
      </td>

      {/* Adress */}
      <td className="px-3 py-2.5 hidden xl:table-cell">
        <span className="text-slate-400 truncate block max-w-[140px]" title={addr}>{addr || '—'}</span>
      </td>

      {/* Skadedjur */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <span className="text-slate-400">{c.skadedjur || '—'}</span>
      </td>

      {/* Tekniker */}
      <td className="px-3 py-2.5">
        <span className="text-slate-300 font-medium">{c.primary_assignee_name || '—'}</span>
      </td>

      {/* Pris */}
      <td className="px-3 py-2.5">
        <span className="text-white font-medium">{formatPrice(c.pris)}</span>
      </td>

      {/* Skickat */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <span className="text-slate-500">{formatRelativeDate(c.updated_at)}</span>
      </td>

      {/* Koord.status */}
      <td className="px-3 py-2.5">
        <select
          value={status}
          onChange={e => onStatusChange(c, e.target.value as CoordinatorCaseStatus)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer focus:ring-1 focus:ring-[#20c58f] ${cfg.bgColor} ${cfg.color}`}
        >
          {Object.entries(COORDINATOR_STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </td>

      {/* Försök */}
      <td className="px-3 py-2.5">
        <span className={`text-[11px] font-medium ${(c.action?.contact_attempts || 0) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
          {c.action?.contact_attempts || 0}
        </span>
      </td>

      {/* Anteckning (inline edit) */}
      <td className="px-3 py-2.5 hidden xl:table-cell">
        {editingNoteId === c.id ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={noteText}
              onChange={e => onNoteTextChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onSaveNote(c)
                if (e.key === 'Escape') onCancelNote()
              }}
              autoFocus
              className="w-full px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-600 rounded text-white focus:ring-1 focus:ring-[#20c58f] focus:outline-none"
              placeholder="Skriv anteckning..."
            />
            <button onClick={() => onSaveNote(c)} className="text-[#20c58f] hover:text-white text-[10px] shrink-0">Spara</button>
          </div>
        ) : (
          <button
            onClick={() => onStartEditNote(c.id, c.action?.coordinator_notes || null)}
            className="text-slate-500 hover:text-white text-[10px] text-left truncate max-w-[120px] block transition-colors"
            title={c.action?.coordinator_notes || 'Klicka för att lägga till'}
          >
            {c.action?.coordinator_notes || '+ Anteckning'}
          </button>
        )}
      </td>

      {/* Åtgärder */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 relative">
          {/* Kvittera */}
          {isNew && (
            <button
              onClick={() => onAcknowledge(c)}
              className="p-1 rounded text-blue-400 hover:bg-blue-500/20 transition-colors"
              title="Kvittera"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Logga kontakt */}
          <div className="relative">
            <button
              onClick={() => onOpenContactPopover(contactPopoverOpen ? null : c.id)}
              className="p-1 rounded text-purple-400 hover:bg-purple-500/20 transition-colors"
              title="Logga kontaktförsök"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
            {contactPopoverOpen && (
              <ContactPopover
                onSelect={(method, note) => onLogContact(c, method, note)}
                onClose={() => onOpenContactPopover(null)}
              />
            )}
          </div>

          {/* Boka in (bara signerade) */}
          {isSignerad && (
            <button
              onClick={() => onBook(c)}
              className="p-1 rounded text-[#20c58f] hover:bg-[#20c58f]/20 transition-colors"
              title="Boka in i schemat"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Kontaktförsök-popover ───

function ContactPopover({ onSelect, onClose }: {
  onSelect: (method: ContactMethod, note?: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2.5">
      <p className="text-[10px] text-slate-400 mb-2 font-medium">Logga kontaktförsök</p>
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => onSelect('phone', note || undefined)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <PhoneCall className="w-3 h-3" /> Telefon
        </button>
        <button
          onClick={() => onSelect('email', note || undefined)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <MailIcon className="w-3 h-3" /> E-post
        </button>
        <button
          onClick={() => onSelect('sms', note || undefined)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <MessageCircle className="w-3 h-3" /> SMS
        </button>
      </div>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && note) onSelect('phone', note) }}
        placeholder="Valfri anteckning..."
        className="w-full px-2 py-1 text-[10px] bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
      />
    </div>
  )
}

// src/components/coordinator/follow-up/DocumentQueueList.tsx
// Arbetskön: dokument grupperade i kategorier sorterade efter väntekostnad.
// Kompakta rader (avdelare, inte kort) med deadline-pill, öppnad-indikator
// och oläst-badge. Sektionsrubrikerna bär räknarna — inga KPI-kort.
import { useState } from 'react'
import { ChevronRight, ChevronDown, Eye, EyeOff, MailX, MessageSquare, Phone, FileSignature } from 'lucide-react'
import type { FollowUpOffer, QueueCategory } from '../../../services/offerFollowUpService'
import { QUEUE_SECTIONS } from '../../../services/offerFollowUpService'

interface DocumentQueueListProps {
  offers: FollowUpOffer[]
  selectedId: string | null
  onSelect: (offer: FollowUpOffer) => void
}

// Kort veckodag/datum för uppföljnings-pillen
function fmtFollowUp(dateStr: string): string {
  const today = new Date().toISOString().substring(0, 10)
  if (dateStr <= today) return 'idag'
  const d = new Date(dateStr + 'T12:00:00')
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000)
  if (diff <= 6) return d.toLocaleDateString('sv-SE', { weekday: 'short' })
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

/** Deadline/status-pill — radens primära larm */
export function DeadlinePill({ offer }: { offer: FollowUpOffer }) {
  const followUpAt = offer.action?.follow_up_at
  const today = new Date().toISOString().substring(0, 10)

  if (followUpAt && offer.status !== 'signed' && offer.status !== 'declined') {
    const late = followUpAt < today
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
        late ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/60 text-slate-300'
      }`}>
        <Phone className="w-2.5 h-2.5" />
        {late ? 'försenad' : fmtFollowUp(followUpAt)}
      </span>
    )
  }

  if (offer.status === 'signed') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-[#20c58f]/15 text-[#20c58f]">
        ✓ Signerad
      </span>
    )
  }
  if (offer.status === 'declined') {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-slate-700/60 text-slate-500">Avfärdad</span>
  }
  if (offer.status === 'overdue') {
    const d = offer.days_since_overdue
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-red-500/20 text-red-400">
        Förföll {d != null && d > 0 ? `${d}d sen` : 'idag'}
      </span>
    )
  }

  const days = offer.days_until_deadline
  if (days === null) return null
  const color = days <= 0 ? 'bg-red-500/20 text-red-400'
    : days <= 2 ? 'bg-orange-500/20 text-orange-400'
    : days <= 7 ? 'bg-amber-500/20 text-amber-400'
    : 'bg-slate-700/60 text-slate-400'
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${color}`}>
      ⏳ {days <= 0 ? 'löper ut idag' : `${days}d kvar`}
    </span>
  )
}

/** Öppnad/studs-indikator — visar avvikelsen, inte normalfallet */
export function ViewedIndicator({ offer }: { offer: FollowUpOffer }) {
  if (offer.email_delivery_failed_at) {
    return <MailX className="w-3 h-3 text-red-400 shrink-0" aria-label="E-posten levererades inte" />
  }
  if (offer.customer_first_viewed_at) {
    const at = new Date(offer.customer_first_viewed_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    return <Eye className="w-3 h-3 text-slate-500 shrink-0" aria-label={`Öppnad ${at}`} />
  }
  if (offer.status === 'pending' && offer.created_at >= '2026-08-18' && offer.age_days >= 2) {
    return <EyeOff className="w-3 h-3 text-amber-400 shrink-0" aria-label="Ej öppnad av kunden" />
  }
  return null
}

function QueueRow({ offer, selected, onSelect }: {
  offer: FollowUpOffer
  selected: boolean
  onSelect: () => void
}) {
  const unread = offer.unread_customer_comments
  const sender = (offer.created_by_name || offer.begone_employee_name || '').split(' ')[0]
  // Ärendenumret (BE-xxx) är den identifierare som säger något — BG-referensen är bara fallback
  const refShort = offer.source_case_number
    || offer.quote_reference_number?.replace(/^BG-/, '').split('-').slice(0, 2).join('-')

  return (
    <button
      onClick={onSelect}
      data-queue-row={offer.id}
      className={`group w-full text-left px-3 py-2 border-b border-slate-800 transition-colors ${
        selected
          ? 'bg-slate-800/60 border-l-2 border-l-[#20c58f] pl-[10px]'
          : 'hover:bg-slate-800/40 border-l-2 border-l-transparent pl-[10px]'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {unread > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] shrink-0" />}
        <span className={`text-sm truncate flex-1 min-w-0 ${unread > 0 ? 'font-semibold text-white' : 'font-medium text-slate-200'}`}>
          {offer.company_name || offer.contact_person || 'Namnlös'}
        </span>
        <ViewedIndicator offer={offer} />
        {unread > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold shrink-0">
            <MessageSquare className="w-2.5 h-2.5" />
            {unread}
          </span>
        )}
        <DeadlinePill offer={offer} />
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 min-w-0">
        {refShort && <span className="font-mono">{refShort}</span>}
        <span>{offer.type === 'offer' ? 'Offert' : 'Avtal'}</span>
        {sender && <span className="truncate">· {sender}</span>}
        {offer.total_value != null && offer.total_value > 0 && (
          <span className="ml-auto font-mono tabular-nums text-slate-400 shrink-0">
            {Math.round(Number(offer.total_value)).toLocaleString('sv-SE')} kr
          </span>
        )}
      </div>
    </button>
  )
}

export default function DocumentQueueList({ offers, selectedId, onSelect }: DocumentQueueListProps) {
  const [collapsed, setCollapsed] = useState<Set<QueueCategory>>(
    () => new Set(QUEUE_SECTIONS.filter(s => s.collapsedByDefault).map(s => s.key))
  )

  const byCategory = new Map<QueueCategory, FollowUpOffer[]>()
  for (const o of offers) {
    const arr = byCategory.get(o.queue_category) || []
    arr.push(o)
    byCategory.set(o.queue_category, arr)
  }

  const toggle = (key: QueueCategory) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const total = offers.length

  return (
    <div className="flex-1 overflow-y-auto">
      {QUEUE_SECTIONS.map(section => {
        const items = byCategory.get(section.key) || []
        if (items.length === 0) return null
        const isCollapsed = collapsed.has(section.key)
        return (
          <div key={section.key}>
            <button
              onClick={() => toggle(section.key)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 z-10"
            >
              {isCollapsed
                ? <ChevronRight className="w-3 h-3 text-slate-600" />
                : <ChevronDown className="w-3 h-3 text-slate-600" />}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </span>
              <span className={`text-[10px] font-bold font-mono tabular-nums ${section.accent}`}>
                {items.length}
              </span>
            </button>
            {!isCollapsed && items.map(o => (
              <QueueRow key={o.id} offer={o} selected={o.id === selectedId} onSelect={() => onSelect(o)} />
            ))}
          </div>
        )
      })}

      {total === 0 && (
        <div className="flex flex-col items-center py-16 text-center px-4">
          <FileSignature className="w-8 h-8 text-slate-700 mb-2" />
          <p className="text-sm text-slate-500">Inga dokument matchar</p>
        </div>
      )}
    </div>
  )
}

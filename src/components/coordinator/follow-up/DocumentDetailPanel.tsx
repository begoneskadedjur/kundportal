// src/components/coordinator/follow-up/DocumentDetailPanel.tsx
// Fast detaljpanel i master-detail-vyn: dokumenthuvud, livscykel-tidslinje,
// "Väntar på"-rad, sammanflätad konversation (Oneflow + internt) och åtgärdsfot.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, Mail, ExternalLink, Loader2, Send, MoreHorizontal,
  EyeOff as EyeOffIcon, Trash2, CalendarClock, MessageSquare, Activity, Package, Lock,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'
import { useCaseComments } from '../../../hooks/useCaseComments'
import LifecycleTimeline from './LifecycleTimeline'
import CallLogPopover from './CallLogPopover'
import CoordinatorStatusDropdown from './CoordinatorStatusDropdown'
import OfferItemsSection from './OfferItemsSection'
import { DeadlinePill } from './DocumentQueueList'
import { OFFER_STATUS_CONFIG, type CoordinatorCaseStatus } from '../../../types/casePipeline'
import type { CaseBillingItemWithRelations } from '../../../types/caseBilling'

interface DocumentDetailPanelProps {
  offer: FollowUpOffer | null
  isCoordinator: boolean
  userId?: string
  userName?: string | null
  userEmail?: string | null
  onChanged: () => void
  onExtend: (offer: FollowUpOffer) => void
  onDelete: (offer: FollowUpOffer) => void
  onHide: (contractId: string) => void
  onStatusChange: (contractId: string, status: CoordinatorCaseStatus) => void
  onBookIn: (offer: FollowUpOffer) => void
}

type PanelTab = 'conversation' | 'activity' | 'content'

interface ConversationEntry {
  key: string
  channel: 'oneflow' | 'internal'
  authorName: string
  isCustomer: boolean
  isPrivate: boolean
  body: string
  at: string
  unread?: boolean
  dbId?: string
}

function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

const OUTCOME_LABELS: Record<string, string> = {
  reached: 'Nådde kunden',
  voicemail: 'Röstbrevlåda',
  no_answer: 'Inget svar',
}

export default function DocumentDetailPanel({
  offer, isCoordinator, userId, userName, userEmail,
  onChanged, onExtend, onDelete, onHide, onStatusChange, onBookIn,
}: DocumentDetailPanelProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<PanelTab>('conversation')
  const [oneflowComments, setOneflowComments] = useState<Awaited<ReturnType<typeof OfferFollowUpService.getOneflowConversation>>>([])
  const [callLogs, setCallLogs] = useState<Awaited<ReturnType<typeof OfferFollowUpService.getCallLogs>>>([])
  const [items, setItems] = useState<{ services: CaseBillingItemWithRelations[]; articles: CaseBillingItemWithRelations[] } | null>(null)
  const [fallbackContent, setFallbackContent] = useState<{ products: Array<{ name: string; price: string | null }>; agreementText: string | null } | null>(null)
  const [composer, setComposer] = useState('')
  const [channel, setChannel] = useState<'internal' | 'oneflow'>('internal')
  const [sending, setSending] = useState(false)
  const [showCallLog, setShowCallLog] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Intern chatt (realtid via befintlig hook)
  const { comments: internalComments, addComment, isLoading: internalLoading } = useCaseComments({
    caseId: offer?.id || '',
    caseType: 'contract',
    caseTitle: offer?.company_name || undefined,
  })

  // Ladda Oneflow-konversation + samtalslogg + innehåll vid dokumentbyte
  useEffect(() => {
    if (!offer) return
    let cancelled = false
    setTab('conversation')
    setComposer('')
    setShowCallLog(false)
    setShowMenu(false)
    setItems(null)
    setFallbackContent(null)

    OfferFollowUpService.getOneflowConversation(offer.oneflow_contract_id)
      .then(data => { if (!cancelled) setOneflowComments(data) })
      .catch(() => { if (!cancelled) setOneflowComments([]) })
    // Synka ikapp från Oneflow i bakgrunden (retroaktiv historik + inlägg
    // som saknar webhook) och uppdatera vyn om något nytt kom in
    OfferFollowUpService.syncConversationFromOneflow(offer.oneflow_contract_id)
      .then(gotAny => {
        if (cancelled || !gotAny) return
        return OfferFollowUpService.getOneflowConversation(offer.oneflow_contract_id)
          .then(data => { if (!cancelled) setOneflowComments(data) })
      })
      .catch(() => {})
    OfferFollowUpService.getCallLogs(offer.id)
      .then(data => { if (!cancelled) setCallLogs(data) })
      .catch(() => { if (!cancelled) setCallLogs([]) })

    return () => { cancelled = true }
  }, [offer?.id])

  // Markera kundkommentarer som lästa efter 2 s i vy (Front-mönstret)
  useEffect(() => {
    if (!offer || !userId || tab !== 'conversation') return
    if (offer.unread_customer_comments === 0) return
    const timer = setTimeout(async () => {
      const unreadIds = oneflowComments.filter(c => c.author_type === 'customer').map(c => c.id)
      if (unreadIds.length > 0) {
        await OfferFollowUpService.markCommentsRead(unreadIds, userId)
        onChanged()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [offer?.id, tab, oneflowComments, userId])

  // Innehållsfliken: case_billing_items med fallback till selected_products/agreement_text
  useEffect(() => {
    if (!offer || tab !== 'content' || items !== null) return
    let cancelled = false
    OfferFollowUpService.getContractItems(offer.id).then(async result => {
      if (cancelled) return
      setItems(result)
      if (result.services.length === 0 && result.articles.length === 0) {
        // Fallback: produktrader ur Oneflow-datat (finns för ALLA dokument)
        const { data } = await supabase
          .from('contracts')
          .select('selected_products, agreement_text')
          .eq('id', offer.id)
          .single()
        if (cancelled || !data) return
        const products: Array<{ name: string; price: string | null }> = []
        for (const group of (data.selected_products as any[]) || []) {
          for (const p of group?.products || []) {
            products.push({
              name: p.name || 'Produkt',
              price: p.price_2?.amount?.amount || p.price_1?.amount?.amount || null,
            })
          }
        }
        setFallbackContent({ products, agreementText: data.agreement_text || null })
      }
    }).catch(() => { if (!cancelled) setItems({ services: [], articles: [] }) })
    return () => { cancelled = true }
  }, [offer?.id, tab, items])

  // Sammanflätad konversation
  const conversation = useMemo<ConversationEntry[]>(() => {
    const entries: ConversationEntry[] = []
    for (const c of oneflowComments) {
      entries.push({
        key: `of-${c.id}`,
        channel: 'oneflow',
        authorName: c.author_name || 'Okänd',
        isCustomer: c.author_type === 'customer',
        isPrivate: c.is_private,
        body: c.body,
        at: c.commented_at,
        dbId: c.id,
      })
    }
    for (const c of internalComments) {
      if (c.is_system_comment) continue
      entries.push({
        key: `int-${c.id}`,
        channel: 'internal',
        authorName: c.author_name,
        isCustomer: false,
        isPrivate: true,
        body: c.content,
        at: c.created_at,
      })
    }
    return entries.sort((a, b) => a.at.localeCompare(b.at))
  }, [oneflowComments, internalComments])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [conversation.length, offer?.id])

  const handleSend = useCallback(async () => {
    if (!offer || !composer.trim() || sending) return
    setSending(true)
    try {
      if (channel === 'internal') {
        await addComment(composer.trim())
      } else {
        const result = await OfferFollowUpService.postComment(offer.oneflow_contract_id, composer.trim())
        await OfferFollowUpService.mirrorPostedComment(
          offer.oneflow_contract_id,
          { id: result?.id ?? result?.data?.id, body: composer.trim() },
          { name: userName || null }
        )
        // Säkerhetsnät om POST-svaret saknade id: hämta tråden från Oneflow
        await OfferFollowUpService.syncConversationFromOneflow(offer.oneflow_contract_id)
        const refreshed = await OfferFollowUpService.getOneflowConversation(offer.oneflow_contract_id)
        setOneflowComments(refreshed)
        toast.success('Svar skickat i Oneflow')
      }
      setComposer('')
    } catch (err) {
      console.error('Kunde inte skicka:', err)
      toast.error('Kunde inte skicka meddelandet')
    } finally {
      setSending(false)
    }
  }, [offer, composer, channel, sending, addComment, userName])

  if (!offer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <MessageSquare className="w-10 h-10 text-slate-700 mb-3" />
        <p className="text-sm text-slate-500">Välj ett dokument i kön</p>
        <p className="text-xs text-slate-600 mt-1">Pil upp/ned bläddrar · Enter öppnar</p>
      </div>
    )
  }

  const statusCfg = OFFER_STATUS_CONFIG[offer.status]
  const sentBy = offer.created_by_name || offer.begone_employee_name
  const sentAt = new Date(offer.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

  // "Väntar på"-raden
  const waitingRow = (() => {
    switch (offer.queue_category) {
      case 'boka':
        return isCoordinator
          ? { text: offer.customer_id ? 'Väntar: boka in utförande/etablering' : 'Väntar: kundregistrering + bokning', action: 'Boka in', onClick: () => onBookIn(offer) }
          : { text: 'Signerad — koordinator bokar in', action: null, onClick: null }
      case 'svar':
        return { text: 'Väntar: svar på kundens meddelande', action: null, onClick: null }
      case 'loper_ut':
        return { text: offer.days_until_deadline !== null ? `Väntar: kundens signatur — fristen löper ut om ${Math.max(offer.days_until_deadline, 0)} d` : 'Väntar: kundens signatur — lång väntetid', action: 'Förläng frist', onClick: () => onExtend(offer) }
      case 'aldrig_fram':
        return { text: offer.email_delivery_failed_at ? 'Utskicket studsade — kontrollera e-postadressen' : 'Kunden har inte öppnat dokumentet', action: null, onClick: null }
      case 'ringlista':
        return { text: `Uppföljning planerad${offer.action?.follow_up_note ? `: ${offer.action.follow_up_note}` : ''}`, action: null, onClick: null }
      case 'forfallna':
        return { text: 'Fristen har löpt ut — förläng eller avskriv', action: 'Förläng frist', onClick: () => onExtend(offer) }
      default:
        return null
    }
  })()

  const primaryIsCall = ['ringlista', 'loper_ut', 'aldrig_fram', 'forfallna'].includes(offer.queue_category)

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* ── Dokumenthuvud ── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-white truncate">{offer.company_name || offer.contact_person || 'Namnlös'}</h2>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusCfg?.bgColor || 'bg-slate-700'} ${statusCfg?.color || 'text-slate-300'}`}>
                {statusCfg?.label || offer.status}
              </span>
              <DeadlinePill offer={offer} />
            </div>
            <div className="flex items-center gap-1 flex-wrap text-[11px] text-slate-500 mt-0.5">
              {offer.source_case_number && offer.source_id && (
                <>
                  {isCoordinator ? (
                    <button
                      onClick={() => navigate(`/koordinator/schema?openCase=${offer.source_id}`)}
                      title="Öppna ursprungsärendet i schemat"
                      className="inline-flex items-center gap-1 font-mono text-[#20c58f] hover:underline"
                    >
                      <FileText className="w-3 h-3" />
                      {offer.source_case_number}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-slate-300">
                      <FileText className="w-3 h-3" />
                      {offer.source_case_number}
                    </span>
                  )}
                  <span>·</span>
                </>
              )}
              <span>{offer.type === 'offer' ? 'Offert' : 'Avtal'}</span>
              {offer.total_value != null && Number(offer.total_value) > 0 && (
                <span>· {Math.round(Number(offer.total_value)).toLocaleString('sv-SE')} kr</span>
              )}
              <span className="font-mono text-slate-600">· {offer.quote_reference_number}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Skickad {sentAt}{sentBy ? ` av ${sentBy}` : ''}
            </p>
          </div>
          <a
            href={`https://app.oneflow.com/contracts/${offer.oneflow_contract_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            Oneflow
          </a>
        </div>

        {/* Kontaktrad */}
        <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
          {offer.contact_person && <span className="text-slate-300">{offer.contact_person}</span>}
          {offer.contact_phone && (
            <a href={`tel:${offer.contact_phone.replace(/[\s-]/g, '')}`} className="flex items-center gap-1 text-[#20c58f] hover:underline font-mono">
              <Phone className="w-3 h-3" />
              {offer.contact_phone}
            </a>
          )}
          {offer.contact_email && (
            <a href={`mailto:${offer.contact_email}`} className="flex items-center gap-1 text-slate-400 hover:text-white">
              <Mail className="w-3 h-3" />
              {offer.contact_email}
            </a>
          )}
        </div>
      </div>

      {/* ── Livscykel ── */}
      <div className="px-4 py-3 border-b border-slate-800">
        <LifecycleTimeline offer={offer} />
        {waitingRow && (
          <div className="flex items-center justify-between gap-2 mt-2.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <span className="text-[11px] text-amber-300">⚡ {waitingRow.text}</span>
            {waitingRow.action && waitingRow.onClick && (
              <button
                onClick={waitingRow.onClick}
                className="px-2 py-1 text-[11px] font-medium bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-md transition-colors shrink-0"
              >
                {waitingRow.action}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Flikar ── */}
      <div className="flex items-center gap-0.5 px-3 pt-2 border-b border-slate-800">
        {([
          { key: 'conversation', label: 'Konversation', icon: MessageSquare, badge: offer.unread_customer_comments },
          { key: 'activity', label: 'Aktivitet', icon: Activity, badge: 0 },
          { key: 'content', label: 'Innehåll', icon: Package, badge: 0 },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-t-lg border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[#20c58f] text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
            {t.badge > 0 && (
              <span className="px-1 py-0 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Flikinnehåll ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Konversation — sammanflätad tidslinje, kund "på scen", internt "bakom scen" */}
        <div className={tab === 'conversation' ? 'p-3 space-y-2' : 'hidden'}>
          {internalLoading && conversation.length === 0 ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" /></div>
          ) : conversation.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Ingen konversation ännu</p>
          ) : (
            conversation.map(entry => (
              <div
                key={entry.key}
                className={`px-3 py-2 rounded-lg text-sm border-l-2 ${
                  entry.channel === 'oneflow'
                    ? entry.isCustomer
                      ? 'bg-slate-800/50 border-l-cyan-400'
                      : 'bg-slate-800/40 border-l-blue-500/60'
                    : 'bg-slate-800/20 border-l-slate-600 border-dashed'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-semibold text-white">{entry.authorName}</span>
                  <span className={`text-[9px] px-1 py-0 rounded uppercase tracking-wide font-semibold ${
                    entry.channel === 'oneflow'
                      ? entry.isCustomer ? 'bg-cyan-500/15 text-cyan-400' : 'bg-blue-500/15 text-blue-400'
                      : 'bg-slate-700/60 text-slate-400'
                  }`}>
                    {entry.channel === 'oneflow' ? (entry.isCustomer ? 'Kund · Oneflow' : 'Oneflow') : 'Internt'}
                  </span>
                  {entry.channel === 'internal' && <Lock className="w-2.5 h-2.5 text-slate-500" />}
                  <span className="text-[10px] text-slate-500 ml-auto">{fmtDateTime(entry.at)}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.body}</p>
              </div>
            ))
          )}
          <div ref={conversationEndRef} />
        </div>

        {/* Aktivitet & anteckningar */}
        <div className={tab === 'activity' ? 'p-3 space-y-2' : 'hidden'}>
          {offer.action && (offer.action.contact_attempts > 0 || offer.action.follow_up_at) && (
            <div className="px-3 py-2 bg-slate-800/30 border border-slate-700/50 rounded-lg text-xs text-slate-400">
              {offer.action.contact_attempts > 0 && (
                <p>{offer.action.contact_attempts} kontaktförsök{offer.action.last_contact_attempt_at ? ` · senast ${fmtDateTime(offer.action.last_contact_attempt_at)}` : ''}</p>
              )}
              {offer.action.follow_up_at && (
                <p className="text-[#20c58f]">☎ Ring åter {offer.action.follow_up_at}{offer.action.follow_up_note ? ` — ${offer.action.follow_up_note}` : ''}</p>
              )}
            </div>
          )}
          {callLogs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Inga loggade samtal</p>
          ) : (
            callLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2 px-3 py-2 border-b border-slate-800/60">
                <Phone className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-300">
                    <span className="font-medium text-white">{OUTCOME_LABELS[log.outcome] || log.outcome}</span>
                    {log.note && <span className="text-slate-400"> — {log.note}</span>}
                  </p>
                  <p className="text-[10px] text-slate-500">{log.called_by_name || 'Okänd'} · {fmtDateTime(log.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Innehåll */}
        <div className={tab === 'content' ? 'p-3' : 'hidden'}>
          {items === null ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" /></div>
          ) : items.services.length > 0 || items.articles.length > 0 ? (
            <OfferItemsSection services={items.services} articles={items.articles} loading={false} error={null} />
          ) : fallbackContent ? (
            <div className="space-y-3">
              {fallbackContent.products.length > 0 && (
                <div className="space-y-1">
                  {fallbackContent.products.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-800/30 border border-slate-700/50 rounded-lg text-xs">
                      <span className="text-slate-300">{p.name}</span>
                      {p.price && <span className="font-mono tabular-nums text-slate-400">{Math.round(Number(p.price)).toLocaleString('sv-SE')} kr</span>}
                    </div>
                  ))}
                </div>
              )}
              {fallbackContent.agreementText && (
                <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">{fallbackContent.agreementText}</p>
              )}
              {fallbackContent.products.length === 0 && !fallbackContent.agreementText && (
                <p className="text-xs text-slate-500 text-center py-4">Inget innehåll att visa</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">Inget innehåll att visa</p>
          )}
        </div>
      </div>

      {/* ── Composer (bara i konversationsfliken) ── */}
      {tab === 'conversation' && (
        <div className={`px-3 py-2 border-t border-slate-800 ${channel === 'oneflow' ? 'bg-cyan-500/5' : ''}`}>
          <div className="flex items-end gap-2">
            <select
              value={channel}
              onChange={e => setChannel(e.target.value as 'internal' | 'oneflow')}
              className={`px-2 py-1.5 text-[11px] rounded-lg border focus:outline-none shrink-0 ${
                channel === 'oneflow'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <option value="internal">Internt</option>
              <option value="oneflow">Svar i Oneflow</option>
            </select>
            <textarea
              value={composer}
              onChange={e => setComposer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
              placeholder={channel === 'oneflow' ? 'Svara kunden i Oneflow… (syns för kunden)' : 'Intern anteckning…'}
              rows={1}
              className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            />
            <button
              onClick={handleSend}
              disabled={!composer.trim() || sending}
              className="p-2 bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-lg transition-colors disabled:opacity-40 shrink-0"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Åtgärdsfot ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-800 bg-slate-900/60 relative">
        {offer.queue_category === 'boka' && isCoordinator ? (
          <button
            onClick={() => onBookIn(offer)}
            className="px-3 py-1.5 text-xs font-medium bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-lg transition-colors"
          >
            ✓ Boka in
          </button>
        ) : offer.queue_category === 'boka' ? (
          <span className="px-2.5 py-1.5 text-xs text-[#20c58f] bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg">
            {offer.booked_case_id ? 'Bokad ✓' : 'Koordinator bokar in'}
          </span>
        ) : (
          <a
            href={offer.contact_phone ? `tel:${offer.contact_phone.replace(/[\s-]/g, '')}` : undefined}
            onClick={() => setShowCallLog(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              primaryIsCall
                ? 'bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            } ${!offer.contact_phone ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
          >
            <Phone className="w-3 h-3" />
            Ring upp
          </a>
        )}
        <button
          onClick={() => setShowCallLog(v => !v)}
          className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
        >
          Logga samtal
        </button>
        {(offer.status === 'pending' || offer.status === 'overdue') && (
          <button
            onClick={() => onExtend(offer)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
          >
            <CalendarClock className="w-3 h-3" />
            Förläng frist
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isCoordinator && (
            <CoordinatorStatusDropdown
              value={offer.action?.coordinator_status || 'new'}
              onChange={(status) => onStatusChange(offer.id, status)}
              size="sm"
              direction="up"
            />
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
                {offer.customer_id && (
                  <a
                    href={`/admin/customers/${offer.customer_id}`}
                    className="block px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    Gå till kund
                  </a>
                )}
                <button
                  onClick={() => { setShowMenu(false); onHide(offer.id) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white text-left"
                >
                  <EyeOffIcon className="w-3 h-3" />
                  Dölj för mig
                </button>
                <button
                  onClick={() => { setShowMenu(false); onDelete(offer) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-800 text-left"
                >
                  <Trash2 className="w-3 h-3" />
                  Radera
                </button>
              </div>
            )}
          </div>
        </div>

        {showCallLog && (
          <CallLogPopover
            contractId={offer.id}
            companyName={offer.company_name || offer.contact_person || 'kunden'}
            byName={userName}
            byEmail={userEmail}
            onClose={() => setShowCallLog(false)}
            onSaved={() => { setShowCallLog(false); OfferFollowUpService.getCallLogs(offer.id).then(setCallLogs); onChanged() }}
          />
        )}
      </div>
    </div>
  )
}

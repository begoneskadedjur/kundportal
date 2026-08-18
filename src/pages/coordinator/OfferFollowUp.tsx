// src/pages/coordinator/OfferFollowUp.tsx — Dokumentsignering som arbetsyta
// Master-detail: prioriterad kö till vänster, fast detaljpanel till höger.
// Kategorirubrikerna bär räknarna (inga KPI-kort); signeringsgraden är en
// diskret textrad. Tekniker/säljare ser samma vy filtrerad server-side
// till sina egna dokument.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { FileSignature, Loader2, RefreshCw, Search, TrendingUp, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { OfferFollowUpService, QUEUE_SECTIONS } from '../../services/offerFollowUpService'
import DocumentQueueList from '../../components/coordinator/follow-up/DocumentQueueList'
import DocumentDetailPanel from '../../components/coordinator/follow-up/DocumentDetailPanel'
import DocumentStatsView from '../../components/coordinator/follow-up/DocumentStatsView'
import BookInModal from '../../components/coordinator/follow-up/BookInModal'
import DeleteOfferConfirmDialog from '../../components/coordinator/follow-up/DeleteOfferConfirmDialog'
import ExtendSigningPeriodDialog from '../../components/coordinator/follow-up/ExtendSigningPeriodDialog'
import toast from 'react-hot-toast'
import type { FollowUpOffer, FollowUpKPIs } from '../../services/offerFollowUpService'
import type { CoordinatorCaseStatus } from '../../types/casePipeline'

export default function OfferFollowUp() {
  const { profile, user } = useAuth()
  const userId = user?.id
  const isCoordinator = profile?.role === 'koordinator' || profile?.role === 'admin'
  // Tekniker & säljare ser bara sina egna dokument (avsändare eller skapare)
  const ownDocsEmail = isCoordinator ? undefined : (profile?.technicians?.email || profile?.email || undefined)
  const userName = profile?.display_name || profile?.technicians?.name || null
  const userEmail = profile?.email || profile?.technicians?.email || null

  const [offers, setOffers] = useState<FollowUpOffer[]>([])
  const [kpis, setKpis] = useState<FollowUpKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'offer' | 'contract'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'queue' | 'stats'>('queue')

  const [deleteTarget, setDeleteTarget] = useState<FollowUpOffer | null>(null)
  const [extendTarget, setExtendTarget] = useState<FollowUpOffer | null>(null)
  const [bookInTarget, setBookInTarget] = useState<FollowUpOffer | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const data = await OfferFollowUpService.getDashboardData(ownDocsEmail, userId)
      setOffers(data.offers)
      setKpis(data.kpis)
    } catch (err) {
      console.error('OfferFollowUp fetch error:', err)
      toast.error('Kunde inte ladda dokumenten')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [ownDocsEmail, userId])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtrering: typ + sök + dolda
  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return offers.filter(o => {
      if (docTypeFilter !== 'all' && o.type !== docTypeFilter) return false
      if (!showHidden && userId && (o.hidden_by || []).includes(userId)) return false
      if (q) {
        const haystack = [
          o.company_name, o.contact_person, o.contact_email,
          o.quote_reference_number, o.technician_name, o.begone_employee_name, o.created_by_name,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [offers, docTypeFilter, searchQuery, showHidden, userId])

  // Plattad ordning (samma som kön renderas i) för tangentbordsnavigering
  const orderedOffers = useMemo(() => {
    const byCat = new Map<string, FollowUpOffer[]>()
    for (const o of filteredOffers) {
      const arr = byCat.get(o.queue_category) || []
      arr.push(o)
      byCat.set(o.queue_category, arr)
    }
    return QUEUE_SECTIONS.flatMap(s => byCat.get(s.key) || [])
  }, [filteredOffers])

  const selectedOffer = useMemo(
    () => orderedOffers.find(o => o.id === selectedId) || null,
    [orderedOffers, selectedId]
  )

  // Tangentbord: ↑/↓ bläddrar i kön, Esc stänger panelen (mobil-drawern)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (orderedOffers.length === 0) return
        const idx = orderedOffers.findIndex(o => o.id === selectedId)
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(idx + 1, orderedOffers.length - 1)
          : Math.max(idx - 1, 0)
        const next = orderedOffers[idx === -1 ? 0 : nextIdx]
        if (next) {
          setSelectedId(next.id)
          document.querySelector(`[data-queue-row="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      } else if (e.key === '/') {
        e.preventDefault()
        document.getElementById('doc-search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [orderedOffers, selectedId])

  const hiddenCount = useMemo(() => {
    if (!userId) return 0
    return offers.filter(o => (o.hidden_by || []).includes(userId)).length
  }, [offers, userId])

  const handleHide = useCallback(async (contractId: string) => {
    if (!userId) return
    try {
      await OfferFollowUpService.hideOffer(contractId, userId)
      setOffers(prev => prev.map(o =>
        o.id === contractId ? { ...o, hidden_by: [...(o.hidden_by || []), userId] } : o
      ))
      if (selectedId === contractId) setSelectedId(null)
      toast.success('Dokument dolt')
    } catch {
      toast.error('Kunde inte dölja dokumentet')
    }
  }, [userId, selectedId])

  const handleStatusChange = useCallback(async (contractId: string, status: CoordinatorCaseStatus) => {
    try {
      const { CasePipelineService } = await import('../../services/casePipelineService')
      await CasePipelineService.updateOfferStatus(contractId, status, userId ?? null)
      fetchData(true)
    } catch {
      toast.error('Kunde inte uppdatera status')
    }
  }, [userId, fetchData])

  // Antal i "att agera"-kategorierna (för teknikerns kompakta sidhuvud)
  const actionCount = useMemo(
    () => filteredOffers.filter(o => ['ringlista', 'boka', 'svar', 'loper_ut', 'aldrig_fram', 'forfallna'].includes(o.queue_category)).length,
    [filteredOffers]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
        <span className="ml-2 text-slate-400">Laddar dokument...</span>
      </div>
    )
  }

  return (
    <div className="max-w-[1500px] mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[560px]">
      {/* ── Sidhuvud ── */}
      <div className="flex items-center gap-3 pb-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileSignature className="w-5 h-5 text-[#20c58f] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight">Dokumentsignering</h1>
            <p className="text-[11px] text-slate-500">
              {isCoordinator
                ? `${filteredOffers.length} dokument`
                : `Dina dokument · ${actionCount > 0 ? `${actionCount} att agera på` : 'inget kräver åtgärd'}`}
            </p>
          </div>
          {/* Vyväxlare: arbetskön eller statistiken */}
          <div className="flex bg-slate-800/50 rounded-lg p-0.5 ml-2">
            {([['queue', 'Arbetskö'], ['stats', 'Statistik']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  view === key ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Signeringsgrad som textrad — statistik är metadata, inte möbler */}
          {kpis && (
            <span
              className="hidden sm:flex items-center gap-1 text-xs text-slate-400 cursor-default"
              title={`${kpis.sign_rate} % signerade av alla hanterade · snitt ${kpis.avg_days_to_sign} dagar till signering · ${kpis.total_pending} pågående (${Math.round(kpis.total_pending_value / 1000)} tkr) · ${kpis.total_overdue} förfallna`}
            >
              <TrendingUp className="w-3 h-3" />
              Signeringsgrad · <span className="font-mono tabular-nums font-semibold text-[#20c58f]">{kpis.sign_rate} %</span>
            </span>
          )}

          {view === 'queue' && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  id="doc-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Sök kund, offertnr…"
                  className="w-52 pl-8 pr-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                />
              </div>

              <div className="flex bg-slate-800/50 rounded-lg p-0.5">
                {([
                  { key: 'all', label: 'Båda' },
                  { key: 'offer', label: 'Offerter' },
                  { key: 'contract', label: 'Avtal' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setDocTypeFilter(f.key)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      docTypeFilter === f.key ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                title="Uppdatera"
                className="p-1.5 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Statistikvyn ── */}
      {view === 'stats' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40 border border-slate-800 rounded-xl">
          <DocumentStatsView isCoordinator={isCoordinator} ownDocsEmail={ownDocsEmail} />
        </div>
      )}

      {/* ── Master-detail (arbetskön) ── */}
      <div className={`flex-1 min-h-0 bg-slate-900/40 border border-slate-800 rounded-xl ${view === 'queue' ? 'flex' : 'hidden'}`}>
        {/* Kön */}
        <div className={`w-full lg:w-[400px] lg:shrink-0 lg:border-r border-slate-800 flex-col min-h-0 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
          <DocumentQueueList
            offers={filteredOffers}
            selectedId={selectedId}
            onSelect={o => setSelectedId(o.id)}
          />
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(v => !v)}
              className="px-3 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 border-t border-slate-800 text-left transition-colors"
            >
              {showHidden ? 'Dölj mina dolda dokument' : `Visa ${hiddenCount} dolda`}
            </button>
          )}
        </div>

        {/* Detaljpanel — fast på desktop, fullskärm ovanpå listan på smal skärm */}
        <div className={`flex-1 flex-col min-w-0 min-h-0 ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="lg:hidden flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 border-b border-slate-800"
            >
              <X className="w-3 h-3" /> Tillbaka till kön
            </button>
          )}
          <DocumentDetailPanel
            offer={selectedOffer}
            isCoordinator={isCoordinator}
            userId={userId}
            userName={userName}
            userEmail={userEmail}
            onChanged={() => fetchData(true)}
            onExtend={setExtendTarget}
            onDelete={setDeleteTarget}
            onHide={handleHide}
            onStatusChange={handleStatusChange}
            onBookIn={setBookInTarget}
          />
        </div>
      </div>

      {/* Dialoger */}
      <DeleteOfferConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          if (deleteTarget) {
            setOffers(prev => prev.filter(o => o.id !== deleteTarget.id))
            if (selectedId === deleteTarget.id) setSelectedId(null)
            setDeleteTarget(null)
          }
        }}
        offer={deleteTarget}
      />
      <ExtendSigningPeriodDialog
        isOpen={!!extendTarget}
        onClose={() => setExtendTarget(null)}
        onExtended={() => { fetchData(true); setExtendTarget(null) }}
        offer={extendTarget}
      />
      {bookInTarget && (
        <BookInModal
          offer={bookInTarget}
          userId={userId}
          onClose={() => setBookInTarget(null)}
          onDone={() => { setBookInTarget(null); fetchData(true) }}
        />
      )}
    </div>
  )
}

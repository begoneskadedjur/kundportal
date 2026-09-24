// src/pages/admin/procurement/NoticeDetailPage.tsx
// Upphandlingens detaljsida (planens avsnitt 9 punkt 3) i tio block plus
// anbudsverkstaden efter kalkylen: identitet, källor och dokument, tidslinje,
// affären, utvärdering, vår kalkyl (och verkstaden), köparhistorik,
// konkurrens, utfall och handlingar, hantering. En lång sida med
// ankarnavigering överst, ingen flikrad. Öppnad upphandling markeras som läst.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import {
  ProcurementService,
  type AwardWithRelations,
  type NoticeWithRelations,
  type ProcurementManagerProfile,
} from '../../../services/procurementService'
import { PricingSettingsService } from '../../../services/pricingSettingsService'
import { refreshProcurementBadge } from '../../../hooks/useProcurementBadge'
import type { PricingSettings } from '../../../types/pricingSettings'
import {
  OUR_STATUS_DOT,
  OUR_STATUS_LABEL,
  type ProcurementBid,
  type ProcurementDocument,
  type ProcurementEvent,
  type ProcurementNotice,
  type ProcurementPriceLine,
  type ProcurementQuestion,
  type ProcurementRequirement,
} from '../../../types/procurement'
import { EmptyState, StatusDot } from '../../../components/admin/procurement/ui'
import { daysUntil, fmtDateTime, fmtRelativeDays } from '../../../components/admin/procurement/uiFormat'
import { Block, type SaveNotice } from '../../../components/admin/procurement/detail/fields'
import { errMsg } from '../../../components/admin/procurement/detail/helpers'
import IdentityBlock from '../../../components/admin/procurement/detail/IdentityBlock'
import DocumentsBlock from '../../../components/admin/procurement/detail/DocumentsBlock'
import TimelineBlock from '../../../components/admin/procurement/detail/TimelineBlock'
import DealBlock from '../../../components/admin/procurement/detail/DealBlock'
import EvaluationBlock from '../../../components/admin/procurement/detail/EvaluationBlock'
import BuyerHistoryBlock from '../../../components/admin/procurement/detail/BuyerHistoryBlock'
import CompetitionBlock from '../../../components/admin/procurement/detail/CompetitionBlock'
import OutcomeBlock from '../../../components/admin/procurement/detail/OutcomeBlock'
import ManagementBlock from '../../../components/admin/procurement/detail/ManagementBlock'
import BidCalculator from '../../../components/admin/procurement/BidCalculator'
import BidWorkshop from '../../../components/admin/procurement/workshop/BidWorkshop'
import { procurementPath } from '../../../lib/procurementPortal'

const NAV: Array<{ id: string; label: string }> = [
  { id: 'identitet', label: 'Identitet' },
  { id: 'kallor', label: 'Källor' },
  { id: 'tidslinje', label: 'Tidslinje' },
  { id: 'affaren', label: 'Affären' },
  { id: 'utvardering', label: 'Utvärdering' },
  { id: 'kalkyl', label: 'Kalkyl' },
  { id: 'verkstad', label: 'Verkstad' },
  { id: 'koparhistorik', label: 'Köparhistorik' },
  { id: 'konkurrens', label: 'Konkurrens' },
  { id: 'utfall', label: 'Utfall' },
  { id: 'hantering', label: 'Hantering' },
]

/** Hämtar och sätter en resurs; fel visas som toast men stoppar inte sidan */
function quiet<T>(p: Promise<T>, set: (v: T) => void, what: string): Promise<void> {
  return p.then(set).catch((e) => {
    console.error(what, e)
    toast.error(errMsg(e, `Kunde inte hämta ${what}`))
  })
}

export default function NoticeDetailPage() {
  const { noticeId } = useParams<{ noticeId: string }>()
  const [notice, setNotice] = useState<NoticeWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const [events, setEvents] = useState<ProcurementEvent[]>([])
  const [documents, setDocuments] = useState<ProcurementDocument[]>([])
  const [bids, setBids] = useState<ProcurementBid[]>([])
  const [buyerAwards, setBuyerAwards] = useState<AwardWithRelations[]>([])
  const [noticeAwards, setNoticeAwards] = useState<AwardWithRelations[]>([])
  const [buyerNotices, setBuyerNotices] = useState<ProcurementNotice[]>([])
  const [requirements, setRequirements] = useState<ProcurementRequirement[]>([])
  const [questions, setQuestions] = useState<ProcurementQuestion[]>([])
  const [priceLines, setPriceLines] = useState<ProcurementPriceLine[]>([])

  // ---------------------------------------------------------------------------
  // Laddning per resurs, så att ett block kan hämta om bara sitt

  const reloadNotice = useCallback(async () => {
    if (!noticeId) return
    try {
      const n = await ProcurementService.getNotice(noticeId)
      if (n) setNotice(n)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte hämta upphandlingen'))
    }
  }, [noticeId])

  const loadEvents = useCallback(() => (noticeId ? quiet(ProcurementService.listEvents(noticeId), setEvents, 'händelser') : Promise.resolve()), [noticeId])
  const loadDocuments = useCallback(() => (noticeId ? quiet(ProcurementService.listDocuments(noticeId), setDocuments, 'dokument') : Promise.resolve()), [noticeId])
  const loadBids = useCallback(() => (noticeId ? quiet(ProcurementService.listBids(noticeId), setBids, 'kalkyler') : Promise.resolve()), [noticeId])
  const loadRequirements = useCallback(() => (noticeId ? quiet(ProcurementService.listRequirements(noticeId), setRequirements, 'kravlistan') : Promise.resolve()), [noticeId])
  const loadQuestions = useCallback(() => (noticeId ? quiet(ProcurementService.listQuestions(noticeId), setQuestions, 'frågorna') : Promise.resolve()), [noticeId])
  const loadPriceLines = useCallback(() => (noticeId ? quiet(ProcurementService.listPriceLines(noticeId), setPriceLines, 'prisbilagan') : Promise.resolve()), [noticeId])

  // Första laddningen
  useEffect(() => {
    if (!noticeId) return
    let alive = true
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      try {
        const n = await ProcurementService.getNotice(noticeId)
        if (!alive) return
        setNotice(n)
        if (!n) return
        void ProcurementService.markSeen(n.id)
          .then(() => refreshProcurementBadge())
          .catch(() => undefined)
        await Promise.all([
          loadEvents(),
          loadDocuments(),
          loadBids(),
          loadRequirements(),
          loadQuestions(),
          loadPriceLines(),
          quiet(ProcurementService.listManagers(), setManagers, 'upphandlingsansvariga'),
          PricingSettingsService.get()
            .then(setSettings)
            .catch(() => setSettings(null)),
          quiet(ProcurementService.listAwards({ noticeId: n.id }), setNoticeAwards, 'tilldelningar'),
          n.buyer_id ? quiet(ProcurementService.listAwards({ buyerId: n.buyer_id }), setBuyerAwards, 'köparens tilldelningar') : Promise.resolve(),
          n.buyer_id ? quiet(ProcurementService.listNoticesForBuyer(n.buyer_id), setBuyerNotices, 'köparens upphandlingar') : Promise.resolve(),
        ])
      } catch (e) {
        if (alive) {
          const msg = errMsg(e, 'Kunde inte hämta upphandlingen')
          setLoadError(msg)
          toast.error(msg)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // Laddarna är stabila per noticeId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId])

  // Polla dokumenten medan AI läser, och hämta om det AI fyllt i när det är klart
  const docsBusy = documents.some((d) => d.ai_status === 'pending' || d.ai_status === 'running')
  const prevBusy = useRef(false)
  useEffect(() => {
    if (!docsBusy) return
    const t = setInterval(() => void loadDocuments(), 5000)
    return () => clearInterval(t)
  }, [docsBusy, loadDocuments])
  useEffect(() => {
    if (prevBusy.current && !docsBusy) {
      void reloadNotice()
      void loadRequirements()
      void loadQuestions()
      void loadEvents()
    }
    prevBusy.current = docsBusy
  }, [docsBusy, reloadNotice, loadRequirements, loadQuestions, loadEvents])

  const onDocumentsChanged = useCallback(() => {
    void loadDocuments()
    void reloadNotice()
    void loadRequirements()
    void loadQuestions()
    void loadEvents()
  }, [loadDocuments, reloadNotice, loadRequirements, loadQuestions, loadEvents])

  /** Sparar användarfält, uppdaterar sidan direkt och loggar händelsen. Kastar vid fel. */
  const saveNotice: SaveNotice = useCallback(
    async (patch, eventTitle) => {
      if (!notice) return
      await ProcurementService.updateNotice(notice.id, patch, eventTitle)
      setNotice((prev) => (prev ? { ...prev, ...patch } : prev))
      void loadEvents()
    },
    [notice, loadEvents]
  )

  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!notice) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState title={loadError ? 'Kunde inte hämta upphandlingen' : 'Upphandlingen finns inte'} hint={loadError ?? 'Den kan ha slagits ihop med en annan post eller tagits bort.'} />
      </div>
    )
  }

  const d = daysUntil(notice.tender_deadline)

  return (
    <div className="space-y-6">
      <div>
        <BackLink />
        <h2 className="mt-3 text-base sm:text-lg font-semibold text-slate-100 leading-snug">{notice.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500">
          <span>{notice.buyer?.name ?? notice.buyer_name ?? 'Okänd köpare'}</span>
          <span className="tabular-nums">BGU-{notice.bgu_number}</span>
          <StatusDot dotClass={OUR_STATUS_DOT[notice.our_status]}>{OUR_STATUS_LABEL[notice.our_status]}</StatusDot>
          {notice.tender_deadline && (
            <span className="tabular-nums">
              Sista anbudsdag {fmtDateTime(notice.tender_deadline)}{' '}
              <span className={d != null && d >= 0 && d <= 7 ? 'text-amber-400' : ''}>{fmtRelativeDays(notice.tender_deadline)}</span>
            </span>
          )}
        </div>
      </div>

      <nav className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-950/95 backdrop-blur border-b border-slate-800 flex gap-4 overflow-x-auto" aria-label="Block på sidan">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => document.getElementById(n.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="text-[12px] text-slate-400 hover:text-[#20c58f] whitespace-nowrap"
          >
            {n.label}
          </button>
        ))}
      </nav>

      <IdentityBlock notice={notice} />
      <DocumentsBlock notice={notice} documents={documents} onDocumentsChanged={onDocumentsChanged} />
      <TimelineBlock notice={notice} noticeAwards={noticeAwards} events={events} onSave={saveNotice} />
      <DealBlock notice={notice} onSave={saveNotice} />
      <EvaluationBlock notice={notice} onSave={saveNotice} />

      <Block id="kalkyl" num="6" title="Vår kalkyl" hint="Årspris exkl. moms. Marginalen räknas med samma motor som avtalen, inklusive arbetstidsspärren.">
        <BidCalculator
          notice={notice}
          buyerAwards={buyerAwards}
          bids={bids}
          settings={settings}
          onSaved={() => {
            void loadBids()
            void reloadNotice()
            void loadEvents()
          }}
        />
      </Block>

      <BidWorkshop
        notice={notice}
        documents={documents}
        requirements={requirements}
        questions={questions}
        priceLines={priceLines}
        bids={bids}
        events={events}
        managers={managers}
        settings={settings}
        onRequirementsChanged={() => void loadRequirements()}
        onQuestionsChanged={() => void loadQuestions()}
        onPriceLinesChanged={() => void loadPriceLines()}
        onEventsChanged={() => void loadEvents()}
      />

      <BuyerHistoryBlock notice={notice} awards={buyerAwards} buyerNotices={buyerNotices} />
      <CompetitionBlock notice={notice} awards={buyerAwards} />
      <OutcomeBlock notice={notice} noticeAwards={noticeAwards} bids={bids} onBidsChanged={() => void loadBids()} onEventsChanged={() => void loadEvents()} />
      <ManagementBlock notice={notice} managers={managers} onSave={saveNotice} />
    </div>
  )
}

function BackLink() {
  return (
    <Link to={procurementPath('/bevakning')} className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-[#20c58f]">
      <ArrowLeft className="w-3.5 h-3.5" />
      Bevakning
    </Link>
  )
}

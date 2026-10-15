// src/pages/admin/procurement/NoticeDetailPage.tsx
// Upphandlingens detaljsida i fem steg plus Logg (docs/upphandlingsportal-ux-plan.md
// avsnitt 3, etapp 5, sedan 3.64.0).
//
// Sidhuvudet bär det som styr allt: titel, köpare (länk), BGU-nummer, status
// som statusmeny, ansvarig, sista anbudsdag med dagar kvar, ikonknapp till
// originalannonsen, Avstå och stegets primära handling (Ta upp för en ny
// träff, Markera som lämnat när vi räknar på den). Under sidhuvudet en
// stegrad med understrukna flikar och en statuspunkt per steg (grå ej
// påbörjat, gul pågår, grön klart, härledd ur data i detail/steps.ts).
//
// Steget står i adressen: /upphandling/:id är Översikt, /upphandling/:id/underlag
// och så vidare. Alla steg är monterade hela tiden och döljs med hidden, så
// att osparad text i kalkylen, kriterierna och kvalitetssvaren finns kvar när
// man byter steg. På mobil ligger de primära knapparna i en fast rad längst
// ned ovanför bottenmenyn. Öppnad upphandling markeras som läst.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { useAuth } from '../../../contexts/AuthContext'
import {
  ProcurementService,
  type AwardWithRelations,
  type NoticeWithRelations,
  type ProcurementManagerProfile,
} from '../../../services/procurementService'
import type { RequirementWithDraft } from '../../../services/procurementAnswerService'
import { PricingSettingsService } from '../../../services/pricingSettingsService'
import { refreshProcurementBadge } from '../../../hooks/useProcurementBadge'
import type { PricingSettings } from '../../../types/pricingSettings'
import {
  OUR_STATUS_CHOICES,
  OUR_STATUS_DOT,
  OUR_STATUS_LABEL,
  ourStatusChoice,
  type ProcurementBid,
  type ProcurementDocument,
  type ProcurementEvent,
  type ProcurementNotice,
  type ProcurementOurStatus,
  type ProcurementPriceLine,
  type ProcurementQuestion,
  type ProcurementRequirement,
} from '../../../types/procurement'
import { originalNoticeUrl } from '../../../shared/procurementPlatform'
import { EmptyState, IconButton, PrimaryButton, SecondaryButton } from '../../../components/admin/procurement/ui'
import StatusMenu from '../../../components/admin/procurement/StatusMenu'
import { daysUntil, fmtDateTime, fmtRelativeDays } from '../../../components/admin/procurement/uiFormat'
import { Block, type SaveNotice } from '../../../components/admin/procurement/detail/fields'
import { errMsg, personName, useConfirm } from '../../../components/admin/procurement/detail/helpers'
import { STEPS, STEP_DOT, STEP_STATE_LABEL, stepOf, stepStates, type StepKey } from '../../../components/admin/procurement/detail/steps'
import OverviewStep from '../../../components/admin/procurement/detail/OverviewStep'
import DocumentsBlock from '../../../components/admin/procurement/detail/DocumentsBlock'
import DealBlock from '../../../components/admin/procurement/detail/DealBlock'
import EvaluationBlock from '../../../components/admin/procurement/detail/EvaluationBlock'
import OutcomeBlock, { OwnBidPrice } from '../../../components/admin/procurement/detail/OutcomeBlock'
import InboundEmailSection from '../../../components/admin/procurement/detail/InboundEmailSection'
import BidCalculator from '../../../components/admin/procurement/BidCalculator'
import RequirementsList from '../../../components/admin/procurement/workshop/RequirementsList'
import QualityAnswers from '../../../components/admin/procurement/workshop/QualityAnswers'
import PriceAppendix from '../../../components/admin/procurement/workshop/PriceAppendix'
import BuyerQuestions from '../../../components/admin/procurement/workshop/BuyerQuestions'
import SubmissionCheck from '../../../components/admin/procurement/workshop/SubmissionCheck'
import { DECLINE_TOAST, TAKE_TOAST, takeOrDecline } from '../../../components/admin/procurement/watch/sortNotice'
import { isProcurementStandalone, noticePath, procurementPath } from '../../../lib/procurementPortal'

/** Statusar där Avstå och Markera som lämnat är meningsfulla */
const WORKING: ProcurementOurStatus[] = ['watching', 'analyzing', 'bidding']

/** Hämtar och sätter en resurs; fel visas som toast men stoppar inte sidan */
function quiet<T>(p: Promise<T>, set: (v: T) => void, what: string): Promise<void> {
  return p.then(set).catch((e) => {
    console.error(what, e)
    toast.error(errMsg(e, `Kunde inte hämta ${what}`))
  })
}

function daysTone(days: number | null): string {
  if (days == null) return 'text-slate-500'
  if (days < 4) return 'text-red-400'
  if (days < 8) return 'text-amber-400'
  return 'text-slate-500'
}

export default function NoticeDetailPage() {
  const { noticeId, steg } = useParams<{ noticeId: string; steg?: string }>()
  const step = stepOf(steg)
  const { user } = useAuth()
  const [notice, setNotice] = useState<NoticeWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()

  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const [events, setEvents] = useState<ProcurementEvent[]>([])
  const [documents, setDocuments] = useState<ProcurementDocument[]>([])
  const [bids, setBids] = useState<ProcurementBid[]>([])
  const [buyerAwards, setBuyerAwards] = useState<AwardWithRelations[]>([])
  const [noticeAwards, setNoticeAwards] = useState<AwardWithRelations[]>([])
  const [requirements, setRequirements] = useState<ProcurementRequirement[]>([])
  const [questions, setQuestions] = useState<ProcurementQuestion[]>([])
  const [priceLines, setPriceLines] = useState<ProcurementPriceLine[]>([])
  const [bidderCount, setBidderCount] = useState(0)

  // ---------------------------------------------------------------------------
  // Laddning per resurs, så att ett steg kan hämta om bara sitt

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
      void loadPriceLines()
    }
    prevBusy.current = docsBusy
  }, [docsBusy, reloadNotice, loadRequirements, loadQuestions, loadEvents, loadPriceLines])

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

  // Steget i adressen: börja högst upp på sidan när man byter steg
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  const currentBid = bids.find((b) => b.is_current) ?? bids[0] ?? null
  const signed = useMemo(() => {
    const e = events.find((x) => x.event_type === 'signing_done' || x.event_type === 'signing_undone')
    return e?.event_type === 'signing_done'
  }, [events])
  const submittedAt = useMemo(
    () => events.find((e) => (e.metadata as { our_status?: string } | null)?.our_status === 'submitted')?.created_at ?? null,
    [events]
  )

  const states = useMemo(() => {
    if (!notice) return null
    const quality = (requirements as RequirementWithDraft[]).filter((r) => r.req_type === 'kvalitet')
    return stepStates({
      status: notice.our_status,
      documents: documents.length,
      documentsRead: documents.filter((d) => d.ai_status === 'done').length,
      requirements: requirements.length,
      requirementsDone: requirements.filter((r) => r.done).length,
      hasBid: !!currentBid,
      priceLines: priceLines.length,
      priceLinesPriced: priceLines.filter((l) => l.unit_price != null).length,
      qualityTotal: quality.length,
      qualityDrafted: quality.filter((r) => (r.draft_answer ?? '').trim()).length,
      signed,
      bidOutcomeSet: !!currentBid && currentBid.outcome !== 'pending',
      lesson: !!currentBid?.lesson?.trim(),
      bidders: bidderCount,
    })
  }, [notice, documents, requirements, currentBid, priceLines, signed, bidderCount])

  // ---------------------------------------------------------------------------
  // Sidhuvudets handlingar

  const setStatus = async (status: ProcurementOurStatus, title?: string) => {
    if (!notice) return
    setActing(true)
    try {
      await saveNotice({ our_status: status }, title ?? `Status: ${OUR_STATUS_LABEL[status]}`)
      toast.success(`Status: ${OUR_STATUS_LABEL[status]}`)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte byta status'))
    } finally {
      setActing(false)
    }
  }

  const setOwner = async (ownerId: string) => {
    if (!notice) return
    try {
      await saveNotice({ owner_id: ownerId || null }, ownerId ? `Ansvarig: ${personName(managers, ownerId)}` : 'Ansvarig borttagen')
      toast.success(ownerId ? `Ansvarig: ${personName(managers, ownerId)}` : 'Ingen ansvarig')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte byta ansvarig'))
    }
  }

  const take = async () => {
    if (!notice) return
    setActing(true)
    try {
      const patch = await takeOrDecline(notice, true, user?.id)
      setNotice((prev) => (prev ? { ...prev, ...patch } : prev))
      void loadEvents()
      toast.success(TAKE_TOAST)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara'))
    } finally {
      setActing(false)
    }
  }

  const decline = () => {
    if (!notice) return
    confirm(
      'Avstå från upphandlingen',
      `Avstå från "${notice.title}"? Den försvinner från Annonser och tavlan. Statusen kan ändras tillbaka i statusmenyn.`,
      async () => {
        try {
          const patch = await takeOrDecline(notice, false, user?.id)
          setNotice((prev) => (prev ? { ...prev, ...patch } : prev))
          void loadEvents()
          toast.success(DECLINE_TOAST)
        } catch (e) {
          toast.error(errMsg(e, 'Kunde inte spara'))
        }
      },
      { confirmLabel: 'Avstå', variant: 'warning' }
    )
  }

  const markSubmitted = () => {
    if (!notice) return
    confirm(
      'Markera som lämnat',
      'Har anbudet lämnats på köparens plattform? Statusen blir Lämnat och dagens datum sparas som lämnat datum.',
      async () => {
        await setStatus('submitted', 'Anbudet lämnat')
      },
      { confirmLabel: 'Markera som lämnat', variant: 'warning' }
    )
  }

  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!notice || !states) {
    return (
      <div className="space-y-4">
        <BackLink status={null} />
        <EmptyState title={loadError ? 'Kunde inte hämta upphandlingen' : 'Upphandlingen finns inte'} hint={loadError ?? 'Den kan ha slagits ihop med en annan post eller tagits bort.'} />
      </div>
    )
  }

  const d = daysUntil(notice.tender_deadline)
  const original = originalNoticeUrl(notice)
  const isNew = notice.our_status === 'new'
  const working = WORKING.includes(notice.our_status)
  const canDecline = isNew || working
  const statusOptions = OUR_STATUS_CHOICES.map((s) => ({ value: s, label: OUR_STATUS_LABEL[s], dot: OUR_STATUS_DOT[s] }))
  const ownerOptions = [
    { value: '', label: 'Ingen ansvarig', dot: 'bg-slate-600' },
    ...managers.map((m) => ({ value: m.user_id, label: m.display_name || m.email, dot: 'bg-slate-400' })),
    ...(notice.owner_id && !managers.some((m) => m.user_id === notice.owner_id) ? [{ value: notice.owner_id, label: 'Tidigare ansvarig', dot: 'bg-slate-400' }] : []),
  ]
  const ownerLabel = notice.owner_id ? `Ansvarig ${personName(managers, notice.owner_id)}` : 'Ingen ansvarig'

  const primary = isNew ? (
    <PrimaryButton onClick={() => void take()} disabled={acting}>
      <Icon name="upphandling.ta-upp" size={20} />
      Ta upp
    </PrimaryButton>
  ) : working ? (
    <PrimaryButton onClick={markSubmitted} disabled={acting}>
      <Icon name="upphandling.inlamning" size={20} />
      Markera som lämnat
    </PrimaryButton>
  ) : null
  const declineBtn = canDecline ? (
    <SecondaryButton onClick={decline} disabled={acting}>
      <Icon name="allman.hand" size={20} />
      Avstå
    </SecondaryButton>
  ) : null

  const panel = (key: StepKey) => (step === key ? '' : 'hidden')
  const standalone = isProcurementStandalone()

  return (
    <div className={primary || declineBtn ? 'pb-20 lg:pb-0' : ''}>
      <BackLink status={notice.our_status} />

      {/* Sidhuvud */}
      <div className="mt-1 flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold leading-snug text-slate-100">{notice.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-0 text-[12.5px] text-slate-400">
            {notice.buyer_id ? (
              <Link to={procurementPath(`/kopare/${notice.buyer_id}`)} className="inline-flex items-center gap-1.5 min-h-[44px] text-slate-200 hover:text-[#20c58f]">
                <Icon name="upphandling.kopare" size={16} />
                {notice.buyer?.name ?? notice.buyer_name ?? 'Okänd köpare'}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 min-h-[44px] text-slate-200">
                <Icon name="upphandling.kopare" size={16} />
                {notice.buyer_name ?? 'Okänd köpare'}
              </span>
            )}
            <span className="tabular-nums">BGU-{notice.bgu_number}</span>
            <StatusMenu
              value={ourStatusChoice(notice.our_status)}
              label={OUR_STATUS_LABEL[notice.our_status]}
              dot={OUR_STATUS_DOT[notice.our_status]}
              options={statusOptions}
              onChange={(s) => void setStatus(s)}
              disabled={acting}
              ariaLabel="Byt status"
            />
            <StatusMenu
              value={notice.owner_id ?? ''}
              label={ownerLabel}
              dot={notice.owner_id ? 'bg-slate-400' : 'bg-slate-600'}
              options={ownerOptions}
              onChange={(v) => void setOwner(v)}
              ariaLabel="Byt ansvarig"
            />
            {notice.tender_deadline && (
              <span className="tabular-nums">
                Sista anbudsdag {fmtDateTime(notice.tender_deadline)} <span className={daysTone(d)}>{fmtRelativeDays(notice.tender_deadline)}</span>
              </span>
            )}
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {original && <IconButton icon={<Icon name="rapport.lank" size={20} />} label="Öppna originalannonsen" href={original} />}
          {declineBtn}
          {primary}
        </div>
        {original && (
          <div className="lg:hidden -mt-2">
            <a href={original} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-[44px] text-[13px] text-slate-400 hover:text-[#20c58f]">
              <Icon name="rapport.lank" size={16} />
              Originalannonsen
            </a>
          </div>
        )}
      </div>

      {/* Stegrad: skrollar i sin egen behållare på mobil */}
      <nav className="mt-4 mb-6 border-b border-slate-800 overflow-x-auto" aria-label="Steg">
        <div className="flex items-stretch gap-5 min-w-max">
          {STEPS.map((s) => {
            const st = states[s.key]
            const active = step === s.key
            return (
              <Link
                key={s.key}
                to={noticePath(notice.id, s.key === 'oversikt' ? undefined : s.key)}
                aria-current={active ? 'page' : undefined}
                title={`${s.label}, ${STEP_STATE_LABEL[st]}`}
                className={`-mb-px inline-flex items-center gap-2 pb-2.5 pt-1 min-h-[44px] text-[14px] whitespace-nowrap border-b-2 transition-colors ${
                  active ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STEP_DOT[st]}`} aria-label={STEP_STATE_LABEL[st]} />
                {s.num} {s.label}
              </Link>
            )
          })}
          <span className="flex-1 min-w-4" />
          <Link
            to={noticePath(notice.id, 'logg')}
            aria-current={step === 'logg' ? 'page' : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 pb-2.5 pt-1 min-h-[44px] text-[14px] whitespace-nowrap border-b-2 transition-colors ${
              step === 'logg' ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon name="allman.historik" size={16} />
            Logg
          </Link>
        </div>
      </nav>

      {/* Steg 1 Översikt */}
      <div className={panel('oversikt')}>
        <OverviewStep notice={notice} buyerAwards={buyerAwards} noticeAwards={noticeAwards} onSave={saveNotice} />
      </div>

      {/* Steg 2 Underlag */}
      <div className={`${panel('underlag')} space-y-8`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <DocumentsBlock notice={notice} documents={documents} onDocumentsChanged={onDocumentsChanged} />
          <div className="space-y-8 min-w-0">
            <EvaluationBlock notice={notice} onSave={saveNotice} />
            <DealBlock notice={notice} onSave={saveNotice} />
          </div>
        </div>
        <Block icon="upphandling.krav" title="Kravlista">
          <div className="p-4">
            <RequirementsList noticeId={notice.id} requirements={requirements} documents={documents} managers={managers} onChanged={() => void loadRequirements()} />
          </div>
        </Block>
        <Block icon="upphandling.fraga" title="Frågor till köparen">
          <div className="p-4">
            <BuyerQuestions notice={notice} questions={questions} onChanged={() => void loadQuestions()} />
          </div>
        </Block>
      </div>

      {/* Steg 3 Kalkyl */}
      <div className={`${panel('kalkyl')} space-y-8`}>
        <Block icon="allman.kalkyl" title="Vår kalkyl" hint="Årspris exkl. moms. Marginalen räknas med samma motor som avtalen, inklusive arbetstidsspärren." framed={false}>
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
        <Block icon="upphandling.prisbilaga" title="Prisbilaga" framed={false}>
          <PriceAppendix notice={notice} lines={priceLines} documents={documents} settings={settings} currentBid={currentBid} onChanged={() => void loadPriceLines()} />
        </Block>
      </div>

      {/* Steg 4 Anbud */}
      <div className={`${panel('anbud')} space-y-8`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Block icon="upphandling.kvalitet" title="Kvalitetssvar">
            <div className="p-4">
              <QualityAnswers notice={notice} requirements={requirements} onChanged={() => void loadRequirements()} />
            </div>
          </Block>
          <Block icon="upphandling.inlamning" title="Inlämningskontroll">
            <div className="p-4">
              <SubmissionCheck
                notice={notice}
                requirements={requirements}
                documents={documents}
                priceLines={priceLines}
                currentBid={currentBid}
                events={events}
                onEventsChanged={() => void loadEvents()}
              />
            </div>
          </Block>
        </div>
        <Block icon="upphandling.anbud" title="Vårt anbud" framed={false}>
          <OwnBidPrice bids={bids} submittedAt={submittedAt} onChanged={() => void loadBids()} />
          {working && (
            <div className="mt-4 hidden lg:block">
              <PrimaryButton onClick={markSubmitted} disabled={acting}>
                <Icon name="upphandling.inlamning" size={20} />
                Markera som lämnat
              </PrimaryButton>
            </div>
          )}
        </Block>
      </div>

      {/* Steg 5 Utfall */}
      <div className={panel('utfall')}>
        <OutcomeBlock
          notice={notice}
          noticeAwards={noticeAwards}
          bids={bids}
          onBidsChanged={() => void loadBids()}
          onEventsChanged={() => void loadEvents()}
          onBiddersLoaded={setBidderCount}
        />
      </div>

      {/* Logg */}
      <div className={`${panel('logg')} space-y-8`}>
        <Block icon="kontakt.mejl" title="Inkommen e-post">
          <div className="p-4">
            <InboundEmailSection noticeId={notice.id} documents={documents} onMoved={onDocumentsChanged} />
          </div>
        </Block>
        <EventLog events={events} />
      </div>

      {/* Mobil: primära knappar i fast rad ovanför bottenmenyn */}
      {(primary || declineBtn) && (
        <div
          className="lg:hidden fixed inset-x-0 z-20 border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-2 flex gap-2 [&>*]:flex-1"
          style={{ bottom: standalone ? 'calc(56px + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)' }}
        >
          {declineBtn}
          {primary}
        </div>
      )}
      {confirmNode}
    </div>
  )
}

/** Händelser i tidsföljd, nyast först */
function EventLog({ events }: { events: ProcurementEvent[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? events : events.slice(0, 30)
  return (
    <Block
      icon="allman.historik"
      title={`Händelser (${events.length})`}
      action={
        events.length > 30 ? (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="min-h-[44px] text-[12px] text-slate-400 hover:text-slate-200">
            {showAll ? 'Visa färre' : `Visa alla ${events.length}`}
          </button>
        ) : undefined
      }
    >
      {events.length === 0 ? (
        <EmptyState title="Inga händelser ännu" />
      ) : (
        <ul className="divide-y divide-slate-800">
          {visible.map((e) => (
            <li key={e.id} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 text-[13px]">
              <span className="text-[12px] text-slate-500 tabular-nums">{fmtDateTime(e.created_at)}</span>
              <div className="min-w-0">
                <div className="text-slate-200">{e.title}</div>
                {(e.detail || e.actor_name) && <div className="text-[12px] text-slate-500">{[e.detail, e.actor_name].filter(Boolean).join(' · ')}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

/** Tillbaka till Annonser för nya träffar, annars till Anbud */
function BackLink({ status }: { status: ProcurementNotice['our_status'] | null }) {
  const toBids = status != null && status !== 'new'
  return (
    <Link to={procurementPath(toBids ? '/anbud' : '/annonser')} className="inline-flex items-center gap-1.5 min-h-[44px] text-[12.5px] text-slate-400 hover:text-[#20c58f]">
      <Icon name="rapport.tillbaka" size={16} />
      {toBids ? 'Anbud' : 'Annonser'}
    </Link>
  )
}

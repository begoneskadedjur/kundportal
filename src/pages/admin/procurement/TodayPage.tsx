// src/pages/admin/procurement/TodayPage.tsx
// Idag, upphandlingsportalens startsida (docs/upphandlingsportal-ux-plan.md
// avsnitt 2, etapp 3): det som kräver handling, i ordning efter hur bråttom
// det är. Sista anbudsdag inom 14 dagar, nya annonser att sortera (Ta upp
// eller Avstå), avtal som nyss gått in i bearbetningsfönstret, mina uppgifter
// (kravrader, kvalitetssvar och frågor till köparen, försenade först), nya
// signaler och en varning om en källa är tyst. Läser befintliga tabeller via
// ProcurementService; inga nya tabeller.
//
// Marknadens analys, som tidigare var startsidan, ligger under Marknad > Översikt.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { Icon, type IconName } from '../../../components/icons/Icon'
import { useAuth } from '../../../contexts/AuthContext'
import {
  ProcurementService,
  type AwardWithRelations,
  type MyQuestionTask,
  type MyRequirementTask,
  type NoticeWithRelations,
  type TaskNotice,
} from '../../../services/procurementService'
import { refreshProcurementBadge } from '../../../hooks/useProcurementBadge'
import { DIRECT_NOTIFY_SCORE, NOTIFY_SCORE, addDaysIso, annualValueOf, swedishDate, todaySwedish } from '../../../shared/procurementRules'
import {
  AWARD_STATUS_DOT,
  AWARD_STATUS_LABEL,
  OUR_STATUS_DOT,
  OUR_STATUS_LABEL,
  RELIABILITY_LABEL,
  SIGNAL_TYPE_LABEL,
  type ProcurementReliability,
  type ProcurementSignal,
  type ProcurementSourceHealth,
} from '../../../types/procurement'
import { StatusDot } from '../../../components/admin/procurement/ui'
import { daysUntil, fmtDate, fmtKrShort, fmtNum, fmtRelativeDays } from '../../../components/admin/procurement/uiFormat'
import { buildProcurements, windowStateOf, type ProcurementGroup } from '../../../components/admin/procurement/market/marketStats'
import { SourceHealthWarning } from '../../../components/admin/procurement/market/shared'
import { errMsg } from '../../../components/admin/procurement/detail/helpers'
import { noticePath, procurementPath } from '../../../lib/procurementPortal'

const DEADLINE_DAYS = 14
/** Avtal som gått in i fönstret de senaste så här många dagarna räknas som nya */
const NEW_IN_WINDOW_DAYS = 60
const LIST_LIMIT = 6
/** Raden om var sakerna flyttat visas den första veckan (planens avsnitt 8) */
const MOVED_HINT_UNTIL = '2026-10-22'

const RELIABILITY_DOT: Record<ProcurementReliability, string> = { high: 'bg-[#20c58f]', medium: 'bg-amber-400', low: 'bg-slate-500' }

/** Dagar kvar i röd text under 4 dagar, gul under 8, annars nedtonad */
function daysTone(days: number | null): string {
  if (days == null) return 'text-slate-500'
  if (days < 0) return 'text-red-400'
  if (days < 4) return 'text-red-400'
  if (days < 8) return 'text-amber-400'
  return 'text-slate-500'
}

function annualOf(n: Pick<NoticeWithRelations, 'annual_value' | 'estimated_value' | 'duration_months'>): number | null {
  return n.annual_value ?? annualValueOf(n.estimated_value, n.duration_months)
}

/** "Torsdag 2026-10-15" i svensk tid */
function todayHeading(today: string): string {
  const weekday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long' }).format(new Date())
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${today}`
}

// ---------------------------------------------------------------------------
// Byggstenar i Idags lätta stil: luft mellan sektionerna, liten versal rubrik,
// ram bara runt listorna

function Sect({ icon, title, more, children }: { icon: IconName; title: string; more?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">
          <Icon name={icon} size={16} />
          {title}
        </h2>
        {more && (
          <Link to={more.to} className="inline-flex items-center min-h-[44px] -my-3 text-[12px] text-slate-400 hover:text-[#20c58f]">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="rounded-[10px] border border-slate-800 bg-slate-900/40 divide-y divide-slate-800 overflow-hidden">{children}</ul>
}

const rowCls = 'flex items-center gap-3 px-4 py-2.5 min-h-[52px] text-[13px] hover:bg-slate-800/30 transition-colors'

/** Tomt läge: ikon, vad som saknas och vad som fyller listan */
function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="rounded-[10px] border border-slate-800 px-4 py-6 flex flex-col items-center text-center gap-2">
      <Icon name={icon} size={32} className="text-slate-600" />
      <p className="text-[13px] text-slate-500 max-w-md">{text}</p>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 truncate">{label}</div>
      <div className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-slate-500 truncate">{hint}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mina uppgifter: kravrader och frågor grupperade per upphandling

interface Task {
  key: string
  icon: IconName
  title: string
  sub: string
  deadline: string | null
  overdue: boolean
  step: string
  stepLabel: string
  noticeId: string
}

function deadlineDate(v: string | null | undefined): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : swedishDate(v)
}

function buildTasks(reqs: MyRequirementTask[], questions: MyQuestionTask[], today: string): Task[] {
  const out: Task[] = []
  const byNotice = new Map<string, { notice: TaskNotice; quality: number; other: number }>()
  for (const r of reqs) {
    const e = byNotice.get(r.notice_id) ?? { notice: r.notice, quality: 0, other: 0 }
    if (r.req_type === 'kvalitet') e.quality += 1
    else e.other += 1
    byNotice.set(r.notice_id, e)
  }
  for (const [id, e] of byNotice) {
    const deadline = deadlineDate(e.notice.tender_deadline)
    const who = e.notice.buyer_name ?? e.notice.title
    if (e.quality > 0) {
      out.push({
        key: `q:${id}`,
        icon: 'upphandling.kvalitet',
        title: e.quality === 1 ? 'Skriv ett kvalitetssvar' : `Skriv ${e.quality} kvalitetssvar`,
        sub: `${who}, BGU-${e.notice.bgu_number}`,
        deadline,
        overdue: !!deadline && deadline < today,
        step: 'anbud',
        stepLabel: 'Anbud',
        noticeId: id,
      })
    }
    if (e.other > 0) {
      out.push({
        key: `r:${id}`,
        icon: 'upphandling.krav',
        title: e.other === 1 ? 'En kravrad att klara' : `${e.other} kravrader att klara`,
        sub: `${who}, BGU-${e.notice.bgu_number}`,
        deadline,
        overdue: !!deadline && deadline < today,
        step: 'anbud',
        stepLabel: 'Anbud',
        noticeId: id,
      })
    }
  }
  const qByNotice = new Map<string, { notice: TaskNotice; count: number }>()
  for (const q of questions) {
    const e = qByNotice.get(q.notice_id) ?? { notice: q.notice, count: 0 }
    e.count += 1
    qByNotice.set(q.notice_id, e)
  }
  for (const [id, e] of qByNotice) {
    const deadline = deadlineDate(e.notice.questions_deadline) ?? deadlineDate(e.notice.tender_deadline)
    out.push({
      key: `f:${id}`,
      icon: 'upphandling.fraga',
      title: `Skicka ${e.count === 1 ? 'en fråga' : `${e.count} frågor`} till ${e.notice.buyer_name ?? 'köparen'}`,
      sub: `${e.notice.title}, BGU-${e.notice.bgu_number}`,
      deadline,
      overdue: !!deadline && deadline < today,
      step: 'underlag',
      stepLabel: 'Underlag',
      noticeId: id,
    })
  }
  // Försenade först, sedan närmast i tid, uppgifter utan datum sist
  return out.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
  })
}

// ---------------------------------------------------------------------------

export default function TodayPage() {
  const { user } = useAuth()
  const today = todaySwedish()

  const [loading, setLoading] = useState(true)
  const [notices, setNotices] = useState<NoticeWithRelations[]>([])
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [signals, setSignals] = useState<ProcurementSignal[]>([])
  const [health, setHealth] = useState<ProcurementSourceHealth[]>([])
  const [reqs, setReqs] = useState<MyRequirementTask[]>([])
  const [questions, setQuestions] = useState<MyQuestionTask[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const uid = user?.id
    const results = await Promise.allSettled([
      ProcurementService.listNotices({ statuses: ['new', 'watching', 'analyzing', 'bidding'], openOnly: true, limit: 1000 }),
      ProcurementService.getSeenIds(),
      ProcurementService.listMarketDataset(),
      ProcurementService.listSignals(['new']),
      ProcurementService.listSourceHealth(),
      uid ? ProcurementService.listMyOpenRequirements(uid) : Promise.resolve([] as MyRequirementTask[]),
      uid ? ProcurementService.listMyDraftQuestions(uid) : Promise.resolve([] as MyQuestionTask[]),
    ])
    const [n, s, d, sig, h, r, q] = results
    if (n.status === 'fulfilled') setNotices(n.value)
    if (s.status === 'fulfilled') setSeen(s.value)
    if (d.status === 'fulfilled') setAwards(d.value.awards)
    if (sig.status === 'fulfilled') setSignals(sig.value)
    if (h.status === 'fulfilled') setHealth(h.value)
    if (r.status === 'fulfilled') setReqs(r.value)
    if (q.status === 'fulfilled') setQuestions(q.value)
    if (results.some((x) => x.status === 'rejected')) toast.error('Delar av dagens lista kunde inte hämtas')
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  // Sista anbudsdag inom 14 dagar: det vi arbetar med, och nya träffar över tröskeln
  const deadlines = useMemo(
    () =>
      notices
        .filter((n) => {
          const days = daysUntil(n.tender_deadline)
          if (days == null || days < 0 || days > DEADLINE_DAYS) return false
          return n.our_status !== 'new' || n.match_score >= NOTIFY_SCORE
        })
        .sort((a, b) => String(a.tender_deadline).localeCompare(String(b.tender_deadline))),
    [notices]
  )

  // Nya annonser att sortera: status Ny från tröskeln, starkast först
  const inbox = useMemo(() => notices.filter((n) => n.our_status === 'new' && n.match_score >= NOTIFY_SCORE), [notices])

  // Avtalsklockan: avtal i bearbetningsfönstret, nyss inkomna först
  const windowGroups = useMemo(() => {
    const all = buildProcurements(awards).filter((g) => g.status !== 'done' && g.status !== 'ignored' && windowStateOf(g, today) === 'in')
    const since = addDaysIso(today, -NEW_IN_WINDOW_DAYS)
    const fresh = all.filter((g) => !!g.windowStart && g.windowStart >= since).sort((a, b) => String(b.windowStart).localeCompare(String(a.windowStart)))
    return { all, fresh }
  }, [awards, today])

  const tasks = useMemo(() => buildTasks(reqs, questions, today), [reqs, questions, today])

  const newSignals = useMemo(() => [...signals].sort((a, b) => b.created_at.localeCompare(a.created_at)), [signals])

  const sort = async (n: NoticeWithRelations, take: boolean) => {
    setBusy(n.id)
    try {
      const patch = take ? { our_status: 'analyzing' as const, ...(n.owner_id || !user?.id ? {} : { owner_id: user.id }) } : { our_status: 'declined' as const }
      await ProcurementService.updateNotice(n.id, patch, take ? 'Upptagen: Bedöms' : 'Avstår')
      void ProcurementService.markSeen(n.id).then(() => refreshProcurementBadge()).catch(() => undefined)
      setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, ...patch } : x)))
      setSeen((prev) => new Set([...prev, n.id]))
      toast.success(take ? 'Upptagen. Den ligger nu under Anbud som Bedöms.' : 'Avstår. Annonsen är flyttad ur listan.')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara'))
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const direct = inbox.filter((n) => n.match_score >= DIRECT_NOTIFY_SCORE).length
  const overdue = tasks.filter((t) => t.overdue).length
  const nearest = deadlines[0] ? daysUntil(deadlines[0].tender_deadline) : null
  const nothing = deadlines.length === 0 && inbox.length === 0 && windowGroups.fresh.length === 0 && tasks.length === 0 && newSignals.length === 0

  return (
    <div>
      <div>
        <h1 className="text-[20px] font-semibold text-slate-100">Idag</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{todayHeading(today)}. Det här kräver handling, i ordning efter hur bråttom det är.</p>
      </div>

      {today <= MOVED_HINT_UNTIL && (
        <p className="mt-4 flex items-start gap-2 text-[12.5px] text-slate-400">
          <Icon name="upphandling.idag" size={16} className="mt-0.5 shrink-0 text-[#20c58f]" />
          <span>
            Ny ordning: marknadens siffror ligger under <Link to={procurementPath('/marknad')} className="text-slate-200 hover:text-[#20c58f] underline-offset-2 hover:underline">Marknad</Link>, Bevakning heter{' '}
            <Link to={procurementPath('/annonser')} className="text-slate-200 hover:text-[#20c58f] underline-offset-2 hover:underline">Annonser</Link>, avtalsklockan och signalerna finns under Framförhållning och Inställningar i kontomenyn.
          </span>
        </p>
      )}

      <div className="mt-4">
        <SourceHealthWarning health={health} />
      </div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        <Kpi label={`Sista anbudsdag inom ${DEADLINE_DAYS} dagar`} value={fmtNum(deadlines.length)} hint={nearest != null ? `närmast ${fmtRelativeDays(deadlines[0].tender_deadline)}` : null} />
        <Kpi label="Nya annonser att sortera" value={fmtNum(inbox.length)} hint={direct > 0 ? `${fmtNum(direct)} direktträffar` : null} />
        <Kpi label="Nya i bearbetningsfönstret" value={fmtNum(windowGroups.fresh.length)} hint={`${fmtNum(windowGroups.all.length)} totalt i fönstret`} />
        <Kpi label="Mina uppgifter" value={fmtNum(tasks.length)} hint={overdue > 0 ? `${fmtNum(overdue)} försenade` : null} />
      </div>

      {nothing && (
        <div className="mt-8 rounded-[10px] border border-slate-800 px-4 py-8 flex flex-col items-center text-center gap-2">
          <Icon name="upphandling.idag" size={32} className="text-slate-600" />
          <p className="text-[14px] text-slate-300">Inget kräver handling i dag.</p>
          <Link to={procurementPath('/avtalsklocka')} className="inline-flex items-center min-h-[44px] text-[13px] text-[#20c58f] hover:underline">
            Se vad som kommer under Framförhållning
          </Link>
        </div>
      )}

      {!nothing && (
      <>
      {/* Sista anbudsdag snart */}
      <Sect icon="allman.klocka" title="Sista anbudsdag snart" more={{ to: procurementPath('/anbud'), label: 'Anbud' }}>
        {deadlines.length === 0 ? (
          <Empty icon="allman.klocka" text={`Ingen sista anbudsdag inom ${DEADLINE_DAYS} dagar. Upphandlingar vi bedömer eller räknar på hamnar här när dagen närmar sig.`} />
        ) : (
          <List>
            {deadlines.slice(0, LIST_LIMIT).map((n) => {
              const days = daysUntil(n.tender_deadline)
              const annual = annualOf(n)
              return (
                <li key={n.id}>
                  <Link to={noticePath(n.id)} className={rowCls}>
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-100 font-medium truncate">{n.title}</div>
                      <div className="text-[12px] text-slate-500 truncate">
                        {n.buyer?.name ?? n.buyer_name ?? 'Okänd köpare'} · BGU-{n.bgu_number}
                      </div>
                    </div>
                    <div className="hidden sm:block w-32 shrink-0">
                      <StatusDot dotClass={OUR_STATUS_DOT[n.our_status]}>{OUR_STATUS_LABEL[n.our_status]}</StatusDot>
                    </div>
                    <div className="hidden md:block w-28 shrink-0 text-right tabular-nums text-slate-300">{annual != null ? `${fmtKrShort(annual)}/år` : '–'}</div>
                    <div className="w-28 shrink-0 text-right tabular-nums">
                      <div className="text-slate-300">{fmtDate(n.tender_deadline)}</div>
                      <div className={`text-[12px] ${daysTone(days)}`}>{fmtRelativeDays(n.tender_deadline)}</div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </List>
        )}
      </Sect>

      {/* Nya annonser att sortera */}
      <Sect icon="upphandling.annons" title="Nya annonser att sortera" more={inbox.length > 0 ? { to: procurementPath('/annonser'), label: `Alla ${fmtNum(inbox.length)}` } : undefined}>
        {inbox.length === 0 ? (
          <Empty icon="upphandling.annons" text="Inga nya annonser att sortera. Synken hämtar nya annonser varje timme." />
        ) : (
          <List>
            {inbox.slice(0, LIST_LIMIT).map((n) => {
              const days = daysUntil(n.tender_deadline)
              const unread = !seen.has(n.id)
              const annual = annualOf(n)
              const sources = [...new Set(n.sources.map((s) => (s.source === 'ted' ? 'TED' : s.source === 'mercell' ? 'Mercell' : s.source === 'email' ? 'e-post' : s.source)))]
              return (
                <li key={n.id} className={rowCls}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${unread ? 'bg-sky-400' : 'bg-transparent'}`} aria-label={unread ? 'Oläst' : undefined} />
                  <Link to={noticePath(n.id)} className="min-w-0 flex-1 group">
                    <div className={`truncate group-hover:text-[#20c58f] ${unread ? 'text-slate-100 font-semibold' : 'text-slate-200'}`}>{n.title}</div>
                    <div className="text-[12px] text-slate-500 truncate">
                      {[n.buyer?.name ?? n.buyer_name ?? 'Okänd köpare', sources.join(' och ')].filter(Boolean).join(' · ')}
                    </div>
                  </Link>
                  <div className="hidden md:block w-20 shrink-0 text-right text-[12px] text-slate-500 tabular-nums">
                    Poäng <span className={n.match_score >= DIRECT_NOTIFY_SCORE ? 'text-[#20c58f] font-semibold' : 'text-slate-300'}>{n.match_score}</span>
                  </div>
                  <div className="hidden md:block w-28 shrink-0 text-right tabular-nums">
                    <div className="text-slate-300">{fmtDate(n.tender_deadline)}</div>
                    <div className={`text-[12px] ${daysTone(days)}`}>{fmtRelativeDays(n.tender_deadline)}</div>
                  </div>
                  <div className="hidden lg:block w-24 shrink-0 text-right tabular-nums text-slate-300">{annual != null ? fmtKrShort(annual) : '–'}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={busy === n.id}
                      onClick={() => void sort(n, true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-700 text-[13px] text-slate-200 hover:border-[#20c58f] hover:text-[#20c58f] disabled:opacity-50 transition-colors"
                    >
                      <Icon name="upphandling.ta-upp" size={16} />
                      Ta upp
                    </button>
                    <button
                      type="button"
                      disabled={busy === n.id}
                      onClick={() => void sort(n, false)}
                      className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-50 transition-colors"
                      aria-label={`Avstå från ${n.title}`}
                      title="Avstå"
                    >
                      <Icon name="allman.hand" size={20} />
                    </button>
                  </div>
                </li>
              )
            })}
          </List>
        )}
      </Sect>

      {/* Har gått in i bearbetningsfönstret */}
      <Sect icon="upphandling.fonster" title="Har gått in i bearbetningsfönstret" more={{ to: procurementPath('/avtalsklocka'), label: 'Avtalsklockan' }}>
        {windowGroups.fresh.length === 0 ? (
          <Empty
            icon="upphandling.fonster"
            text={`Inget avtal har gått in i bearbetningsfönstret de senaste ${NEW_IN_WINDOW_DAYS} dagarna. ${fmtNum(windowGroups.all.length)} avtal ligger i fönstret just nu, se Avtalsklockan.`}
          />
        ) : (
          <List>
            {windowGroups.fresh.slice(0, LIST_LIMIT).map((g) => (
              <WindowRow key={g.key} g={g} />
            ))}
          </List>
        )}
      </Sect>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        {/* Mina uppgifter */}
        <Sect icon="upphandling.krav" title="Mina uppgifter">
          {tasks.length === 0 ? (
            <Empty icon="upphandling.krav" text="Inga uppgifter på dig. Kravrader, kvalitetssvar och frågor till köparen där du är ansvarig hamnar här." />
          ) : (
            <List>
              {tasks.slice(0, 8).map((t) => (
                <li key={t.key}>
                  <Link to={noticePath(t.noticeId, t.step)} className={rowCls}>
                    <Icon name={t.icon} size={20} className={`shrink-0 ${t.overdue ? 'text-red-400' : 'text-slate-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-100 truncate">{t.title}</div>
                      <div className={`text-[12px] truncate ${t.overdue ? 'text-red-400' : 'text-slate-500'}`}>
                        {t.sub}
                        {t.deadline ? `, ${t.overdue ? 'försenad sedan' : 'senast'} ${t.deadline}` : ''}
                      </div>
                    </div>
                    <span className="hidden sm:block shrink-0 text-[12px] text-slate-500">{t.stepLabel}</span>
                  </Link>
                </li>
              ))}
            </List>
          )}
        </Sect>

        {/* Nya signaler */}
        <Sect icon="upphandling.signal" title="Nya signaler" more={{ to: procurementPath('/signaler'), label: 'Alla signaler' }}>
          {newSignals.length === 0 ? (
            <Empty icon="upphandling.signal" text="Inga nya signaler. Signalkällorna och annonsdatabaserna läses varje dag." />
          ) : (
            <List>
              {newSignals.slice(0, LIST_LIMIT).map((s) => (
                <li key={s.id}>
                  <Link to={procurementPath('/signaler')} className={rowCls}>
                    <Icon name="upphandling.signal" size={20} className="shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-100 truncate">{s.buyer_name ?? 'Okänd köpare'}</div>
                      <div className="text-[12px] text-slate-500 truncate" title={s.text}>
                        {SIGNAL_TYPE_LABEL[s.signal_type] ?? s.signal_type}
                        {s.expected_quarter ? `, väntas ${s.expected_quarter.replace('-', ' ')}` : ''} · {s.text}
                      </div>
                    </div>
                    <span className="shrink-0">
                      <StatusDot dotClass={RELIABILITY_DOT[s.reliability]}>{RELIABILITY_LABEL[s.reliability] ?? s.reliability}</StatusDot>
                    </span>
                  </Link>
                </li>
              ))}
            </List>
          )}
        </Sect>
      </div>
      </>
      )}
    </div>
  )
}

function WindowRow({ g }: { g: ProcurementGroup }) {
  const suppliers = g.winners.map((w) => w.name).filter(Boolean)
  const to = g.buyerId ? procurementPath(`/kopare/${g.buyerId}`) : procurementPath('/avtalsklocka')
  return (
    <li>
      <Link to={to} className={rowCls}>
        <div className="min-w-0 flex-1">
          <div className="text-slate-100 font-medium truncate">{g.buyerName ?? 'Okänd köpare'}</div>
          <div className="text-[12px] text-slate-500 truncate" title={g.title ?? ''}>
            {g.title ?? 'Avtal'}
            {g.year ? `, avtal sedan ${g.year}` : ''}
          </div>
        </div>
        <div className="hidden md:block w-40 shrink-0 text-[12px] text-slate-300 truncate">{suppliers.length ? suppliers.join(', ') : '–'}</div>
        <div className="hidden sm:block w-32 shrink-0 text-right tabular-nums">
          <div className="text-slate-300">Slut {fmtDate(g.endDate)}</div>
          <div className="text-[12px] text-slate-500">fönster sedan {fmtDate(g.windowStart)}</div>
        </div>
        <span className="w-28 shrink-0 flex justify-end">
          <StatusDot dotClass={AWARD_STATUS_DOT[g.status]}>{AWARD_STATUS_LABEL[g.status]}</StatusDot>
        </span>
      </Link>
    </li>
  )
}

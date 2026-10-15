// src/pages/admin/procurement/AdsPage.tsx
// Annonser (docs/upphandlingsportal-ux-plan.md avsnitt 2, etapp 4): inkorgen
// för nya träffar. Undertabbar Nya, Alla öppna, Under tröskeln och Osorterad
// e-post (?vy=alla | under | epost). Sök, områdesval (Hela Sverige, landsdel
// eller län), sortering, Ta upp eller Avstå per rad (samma beteende som på
// Idag), markera alla lästa och Excel-export av listan som visas.
//
// Ersätter Bevakning (WatchPage) under /annonser sedan 3.64.0.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { Icon, type IconName } from '../../../components/icons/Icon'
import { useAuth } from '../../../contexts/AuthContext'
import { ProcurementService, type NoticeWithRelations } from '../../../services/procurementService'
import { refreshProcurementBadge } from '../../../hooks/useProcurementBadge'
import { DIRECT_NOTIFY_SCORE, NOTIFY_SCORE, SE_COUNTIES, annualValueOf } from '../../../shared/procurementRules'
import { OUR_STATUS_DOT, OUR_STATUS_LABEL, type ProcurementInboundEmail, type ProcurementOurStatus } from '../../../types/procurement'
import { IconButton, StatusDot } from '../../../components/admin/procurement/ui'
import { daysUntil, fmtDate, fmtKrShort, fmtNum, fmtRelativeDays } from '../../../components/admin/procurement/uiFormat'
import { CountySelect } from '../../../components/admin/procurement/market/shared'
import { matchesCounty, type CountyFilter } from '../../../components/admin/procurement/market/marketStats'
import { areaLabel } from '../../../components/admin/procurement/market/format'
import { inputCls, selectCls } from '../../../components/admin/procurement/detail/fields'
import { errMsg } from '../../../components/admin/procurement/detail/helpers'
import UnsortedEmailSection from '../../../components/admin/procurement/watch/UnsortedEmailSection'
import { DECLINE_TOAST, TAKE_TOAST, takeOrDecline } from '../../../components/admin/procurement/watch/sortNotice'
import { exportXlsx } from '../../../components/admin/procurement/excelExport'
import { noticePath } from '../../../lib/procurementPortal'

type View = 'nya' | 'alla' | 'under' | 'epost'
type SortKey = 'deadline' | 'score' | 'value'

/** Alla öppna: allt som inte avgjorts eller lagts undan */
const OPEN_STATUSES: ProcurementOurStatus[] = ['new', 'watching', 'analyzing', 'bidding', 'submitted']

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'deadline', label: 'Sista anbudsdag först' },
  { value: 'score', label: 'Högst poäng först' },
  { value: 'value', label: 'Störst årsvärde först' },
]

function viewOf(v: string | null): View {
  return v === 'alla' || v === 'under' || v === 'epost' ? v : 'nya'
}

function annualOf(n: NoticeWithRelations): number | null {
  return n.annual_value ?? annualValueOf(n.estimated_value, n.duration_months)
}

/** Dagar kvar i röd text under 4 dagar, gul under 8, annars nedtonad */
function daysTone(days: number | null): string {
  if (days == null) return 'text-slate-500'
  if (days < 4) return 'text-red-400'
  if (days < 8) return 'text-amber-400'
  return 'text-slate-500'
}

function sourceNames(n: NoticeWithRelations): string {
  return [...new Set(n.sources.map((s) => (s.source === 'ted' ? 'TED' : s.source === 'mercell' ? 'Mercell' : s.source === 'kommers' ? 'Kommers' : s.source === 'email' ? 'e-post' : s.source)))].join(' och ')
}

function countyNames(n: NoticeWithRelations): string {
  const names = n.county_codes.map((c) => (SE_COUNTIES[c] ?? c).replace(' län', ''))
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} med flera` : names.join(', ')
}

function inArea(n: NoticeWithRelations, area: CountyFilter): boolean {
  if (area === 'all') return true
  return n.county_codes.some((c) => matchesCounty(c, area))
}

export default function AdsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const view = viewOf(params.get('vy'))

  const [notices, setNotices] = useState<NoticeWithRelations[]>([])
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [emails, setEmails] = useState<ProcurementInboundEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [area, setArea] = useState<CountyFilter>('all')
  const [sort, setSort] = useState<SortKey>('deadline')

  const load = useCallback(async () => {
    try {
      const [list, seenIds] = await Promise.all([
        ProcurementService.listNotices({ statuses: OPEN_STATUSES, openOnly: true, limit: 1000 }),
        ProcurementService.getSeenIds(),
      ])
      setNotices(list)
      setSeen(seenIds)
      setError(null)
    } catch (e) {
      const msg = errMsg(e, 'Kunde inte hämta annonserna')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEmails = useCallback(async () => {
    try {
      setEmails(await ProcurementService.listInboundEmails('unsorted'))
    } catch {
      // E-posten är sekundär; tom lista om tabellen saknar data eller rättighet
      setEmails([])
    }
  }, [])

  useEffect(() => {
    void load()
    void loadEmails()
  }, [load, loadEmails])

  // Sök och område gäller alla undertabbar, så att räknarna stämmer med listan
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notices.filter((n) => {
      if (!inArea(n, area)) return false
      if (!q) return true
      return [n.title, n.buyer?.name ?? n.buyer_name ?? '', n.description ?? ''].some((s) => s.toLowerCase().includes(q))
    })
  }, [notices, search, area])

  const groups = useMemo(
    () => ({
      nya: filtered.filter((n) => n.our_status === 'new' && n.match_score >= NOTIFY_SCORE),
      alla: filtered.filter((n) => n.match_score >= NOTIFY_SCORE),
      under: filtered.filter((n) => n.match_score < NOTIFY_SCORE && n.our_status === 'new'),
    }),
    [filtered]
  )

  const rows = useMemo(() => {
    const list = view === 'epost' ? [] : [...groups[view]]
    const dl = (n: NoticeWithRelations) => n.tender_deadline ?? '9999'
    list.sort((a, b) => {
      if (sort === 'score') return b.match_score - a.match_score || dl(a).localeCompare(dl(b))
      if (sort === 'value') return (annualOf(b) ?? -1) - (annualOf(a) ?? -1) || dl(a).localeCompare(dl(b))
      return dl(a).localeCompare(dl(b)) || b.match_score - a.match_score
    })
    return list
  }, [groups, view, sort])

  const unread = rows.filter((n) => !seen.has(n.id))

  const setView = (v: View) => {
    const next = new URLSearchParams(params)
    if (v === 'nya') next.delete('vy')
    else next.set('vy', v)
    setParams(next, { replace: true })
  }

  const decide = async (n: NoticeWithRelations, take: boolean) => {
    setBusy(n.id)
    try {
      const patch = await takeOrDecline(n, take, user?.id)
      setNotices((prev) => (take ? prev.map((x) => (x.id === n.id ? { ...x, ...patch } : x)) : prev.filter((x) => x.id !== n.id)))
      setSeen((prev) => new Set([...prev, n.id]))
      toast.success(take ? TAKE_TOAST : DECLINE_TOAST)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara'))
    } finally {
      setBusy(null)
    }
  }

  const markAllRead = async () => {
    if (unread.length === 0) {
      toast('Inga olästa i listan')
      return
    }
    try {
      await ProcurementService.markManySeen(unread.map((n) => n.id))
      setSeen((prev) => new Set([...prev, ...unread.map((n) => n.id)]))
      refreshProcurementBadge()
      toast.success(`${fmtNum(unread.length)} markerade som lästa`)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte markera som lästa'))
    }
  }

  const exportList = async () => {
    if (rows.length === 0) {
      toast.error('Listan är tom')
      return
    }
    setExporting(true)
    try {
      const tab = view === 'alla' ? 'Alla öppna' : view === 'under' ? 'Under tröskeln' : 'Nya'
      await exportXlsx({
        fileBase: `Annonser_${tab.replace(/\s/g, '_')}`,
        sheetName: 'Annonser',
        title: `Annonser, ${tab.toLowerCase()}, ${areaLabel(area)}`,
        columns: [
          { header: 'BGU', width: 10 },
          { header: 'Upphandling', width: 56 },
          { header: 'Köpare', width: 32 },
          { header: 'Län', width: 22 },
          { header: 'Poäng', width: 8 },
          { header: 'Sista anbudsdag', width: 16 },
          { header: 'Årsvärde (kr)', width: 14, numFmt: '# ##0' },
          { header: 'Status', width: 14 },
          { header: 'Källor', width: 16 },
        ],
        rows: rows.map((n) => [
          `BGU-${n.bgu_number}`,
          n.title,
          n.buyer?.name ?? n.buyer_name ?? '',
          countyNames(n),
          n.match_score,
          n.tender_deadline ? fmtDate(n.tender_deadline) : '',
          annualOf(n),
          OUR_STATUS_LABEL[n.our_status],
          sourceNames(n),
        ]),
      })
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte skapa Excel-filen'))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const tabs: Array<{ key: View; label: string; count: number; icon?: IconName }> = [
    { key: 'nya', label: 'Nya', count: groups.nya.length },
    { key: 'alla', label: 'Alla öppna', count: groups.alla.length },
    { key: 'under', label: 'Under tröskeln', count: groups.under.length },
    { key: 'epost', label: 'Osorterad e-post', count: emails.length, icon: 'kontakt.mejl' },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-3 border-b border-slate-800">
        <nav className="flex gap-5 overflow-x-auto -mb-px" aria-label="Annonser">
          {tabs.map((t) => {
            const active = t.key === view
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 pb-2.5 pt-1 min-h-[44px] text-[14px] whitespace-nowrap border-b-2 transition-colors ${
                  active ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.icon && <Icon name={t.icon} size={16} />}
                {t.label}
                <span className="text-[12px] tabular-nums text-slate-500">{fmtNum(t.count)}</span>
              </button>
            )
          })}
        </nav>
        {view !== 'epost' && (
          <div className="hidden sm:flex items-center pb-1">
            <IconButton icon={<Icon name="allman.bock" size={20} />} label="Markera alla som lästa" onClick={() => void markAllRead()} />
            <IconButton icon={<Icon name="upphandling.excel" size={20} />} label="Exportera till Excel" onClick={() => void exportList()} disabled={exporting} />
          </div>
        )}
      </div>

      {view === 'epost' ? (
        <div className="mt-6">
          {emails.length === 0 ? (
            <EmptyInbox icon="kontakt.mejl" text="Ingen osorterad e-post. Svar som inte kan kopplas till en upphandling automatiskt hamnar här." />
          ) : (
            <UnsortedEmailSection emails={emails} notices={notices} onChanged={() => void loadEmails()} />
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Icon name="allman.sok" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                className={`${inputCls} h-10 pl-9 text-[14px]`}
                placeholder="Sök titel, köpare eller beskrivning"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Sök annonser"
              />
            </div>
            <CountySelect value={area} onChange={setArea} className="sm:w-52" />
            <select className={`${selectCls} h-10 sm:w-52`} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sortering">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex sm:hidden items-center justify-end -my-1">
              <IconButton icon={<Icon name="allman.bock" size={20} />} label="Markera alla som lästa" onClick={() => void markAllRead()} />
              <IconButton icon={<Icon name="upphandling.excel" size={20} />} label="Exportera till Excel" onClick={() => void exportList()} disabled={exporting} />
            </div>
          </div>

          {error ? (
            <EmptyInbox icon="upphandling.annons" text={`Kunde inte hämta annonserna. ${error}`} />
          ) : rows.length === 0 ? (
            <EmptyInbox
              icon="upphandling.annons"
              text={
                search.trim() || area !== 'all'
                  ? `Inga annonser matchar sökningen i ${areaLabel(area)}. Ändra sökordet eller välj Hela Sverige.`
                  : view === 'nya'
                    ? 'Inga nya annonser att sortera. Synken hämtar nya annonser varje timme.'
                    : view === 'under'
                      ? 'Inga öppna annonser under tröskeln. Svagare träffar under 60 poäng hamnar här.'
                      : 'Inga öppna annonser. Synken hämtar nya annonser varje timme.'
              }
            />
          ) : (
            <ul className="rounded-[10px] border border-slate-800 bg-slate-900/40 divide-y divide-slate-800 overflow-hidden">
              <li className="hidden md:grid grid-cols-[minmax(0,1fr)_60px_130px_100px_150px] gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <span>Upphandling</span>
                <span className="text-right">Poäng</span>
                <span className="text-right">Sista dag</span>
                <span className="text-right">Årsvärde</span>
                <span className="text-right">Beslut</span>
              </li>
              {rows.map((n) => (
                <AdRow key={n.id} n={n} unread={!seen.has(n.id)} busy={busy === n.id} onDecide={(take) => void decide(n, take)} />
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <p className="mt-2 text-[12px] text-slate-500">
              {fmtNum(rows.length)} annonser i {areaLabel(area)}. Ta upp lägger annonsen under Anbud som Bedöms, Avstå tar bort den ur listan.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function AdRow({ n, unread, busy, onDecide }: { n: NoticeWithRelations; unread: boolean; busy: boolean; onDecide: (take: boolean) => void }) {
  const days = daysUntil(n.tender_deadline)
  const annual = annualOf(n)
  const meta = [n.buyer?.name ?? n.buyer_name ?? 'Okänd köpare', countyNames(n), sourceNames(n)].filter(Boolean).join(' · ')
  return (
    <li className="px-4 py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_60px_130px_100px_150px] md:gap-3 md:items-center text-[13px] hover:bg-slate-800/30 transition-colors">
      <div className="flex items-start gap-2 min-w-0">
        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${unread ? 'bg-sky-400' : 'bg-transparent'}`} aria-label={unread ? 'Oläst' : undefined} />
        <Link to={noticePath(n.id)} className="min-w-0 flex-1 group">
          <div className={`leading-snug group-hover:text-[#20c58f] ${unread ? 'text-slate-100 font-semibold' : 'text-slate-200'}`}>{n.title}</div>
          <div className="text-[12px] text-slate-500 truncate">BGU-{n.bgu_number} · {meta}</div>
        </Link>
      </div>
      <div className={`hidden md:block text-right tabular-nums ${n.match_score >= DIRECT_NOTIFY_SCORE ? 'text-[#20c58f] font-semibold' : n.match_score < NOTIFY_SCORE ? 'text-slate-500' : 'text-slate-300'}`}>
        {n.match_score}
      </div>
      <div className="hidden md:block text-right tabular-nums">
        <div className="text-slate-300">{fmtDate(n.tender_deadline)}</div>
        <div className={`text-[12px] ${daysTone(days)}`}>{fmtRelativeDays(n.tender_deadline)}</div>
      </div>
      <div className="hidden md:block text-right tabular-nums text-slate-300">{annual != null ? fmtKrShort(annual) : '–'}</div>
      <div className="mt-2 md:mt-0 flex items-center justify-between md:justify-end gap-2">
        {/* Mobil: andra raden med datum, poäng och årsvärde */}
        <div className="md:hidden text-[12px] tabular-nums text-slate-400 min-w-0 truncate">
          <span className={daysTone(days)}>{n.tender_deadline ? fmtRelativeDays(n.tender_deadline) : 'Sista dag okänd'}</span>
          {' · '}
          {n.match_score} p{annual != null ? ` · ${fmtKrShort(annual)}/år` : ''}
        </div>
        {n.our_status === 'new' ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(true)}
              className="inline-flex items-center gap-1.5 h-11 md:h-9 px-3 rounded-lg border border-slate-700 text-[13px] text-slate-200 hover:border-[#20c58f] hover:text-[#20c58f] disabled:opacity-50 transition-colors"
            >
              <Icon name="upphandling.ta-upp" size={16} />
              Ta upp
            </button>
            <IconButton icon={<Icon name="allman.hand" size={20} />} label={`Avstå från ${n.title}`} onClick={() => onDecide(false)} disabled={busy} />
          </div>
        ) : (
          <span className="shrink-0">
            <StatusDot dotClass={OUR_STATUS_DOT[n.our_status]}>{OUR_STATUS_LABEL[n.our_status]}</StatusDot>
          </span>
        )}
      </div>
    </li>
  )
}

function EmptyInbox({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="rounded-[10px] border border-slate-800 px-4 py-8 flex flex-col items-center text-center gap-2">
      <Icon name={icon} size={32} className="text-slate-600" />
      <p className="text-[13px] text-slate-500 max-w-md">{text}</p>
    </div>
  )
}

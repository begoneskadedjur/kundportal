// src/pages/admin/procurement/WatchPage.tsx
// Bevakning (planens avsnitt 9 punkt 2): matchade upphandlingar med poäng,
// sista anbudsdag, förväntat antal anbud, kriterietyp, årsvärde, sannolikhet,
// förväntat täckningsbidrag, status, ansvarig och källor. Olästa markeras.
// Osorterad inkommande e-post visas överst när sådan finns.
//
// Sedan 3.64.0 är sidan bara listan under Anbud (/anbud/lista): upphandlingar
// vi bedömer, räknar på eller lämnat, utan poänggräns, med Excel-export.
// Inkorgen ligger i AdsPage (/annonser) och tavlan i BidsBoardPage (/anbud).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import {
  ProcurementService,
  type NoticeWithRelations,
  type ProcurementManagerProfile,
} from '../../../services/procurementService'
import { refreshProcurementBadge } from '../../../hooks/useProcurementBadge'
import {
  CRITERIA_TYPE_LABEL,
  OUR_STATUS_DOT,
  OUR_STATUS_CHOICES,
  OUR_STATUS_LABEL,
  ourStatusValues,
  type ProcurementOurStatus,
} from '../../../types/procurement'
import { annualValueOf, estimateWinProbability } from '../../../shared/procurementRules'
import { EmptyState, IconButton, LinkButton, Section, StatusDot } from '../../../components/admin/procurement/ui'
import { daysUntil, fmtDate, fmtKrShort, fmtPct, fmtRelativeDays, tableCls } from '../../../components/admin/procurement/uiFormat'
import { checkboxCls, inputCls, selectCls } from '../../../components/admin/procurement/detail/fields'
import { errMsg, personName } from '../../../components/admin/procurement/detail/helpers'
import { exportXlsx } from '../../../components/admin/procurement/excelExport'
import { noticePath } from '../../../lib/procurementPortal'
import { Icon } from '../../../components/icons/Icon'

const ACTIVE_STATUSES: ProcurementOurStatus[] = ['new', 'watching', 'analyzing', 'bidding', 'submitted']
/** Anbud: det vi bedömer, räknar på eller har lämnat */
const WORK_STATUSES: ProcurementOurStatus[] = ['watching', 'analyzing', 'bidding', 'submitted']
const DIRECT_SCORE = 100
const NOTIFY_SCORE = 60

type StatusFilter = 'active' | 'work' | 'all' | ProcurementOurStatus

function deadlineTone(days: number | null): string {
  if (days == null) return 'text-slate-500'
  if (days < 0) return 'text-slate-600'
  if (days <= 3) return 'text-red-400'
  if (days <= 7) return 'text-amber-400'
  return 'text-slate-500'
}

function SourceLinks({ notice }: { notice: NoticeWithRelations }) {
  const seen = new Set<string>()
  const links = notice.sources.filter((s) => {
    if (seen.has(s.source)) return false
    seen.add(s.source)
    return true
  })
  if (links.length === 0 && !notice.platform_url) return null
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {links.map((s) =>
        s.url ? (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="text-[11px] text-slate-500 hover:text-[#20c58f]" onClick={(e) => e.stopPropagation()}>
            {s.source === 'ted' ? 'TED' : s.source === 'mercell' ? 'Mercell' : s.source.charAt(0).toUpperCase() + s.source.slice(1)}
          </a>
        ) : (
          <span key={s.id} className="text-[11px] text-slate-600">{s.source === 'ted' ? 'TED' : s.source}</span>
        )
      )}
      {notice.platform_url && (
        <a href={notice.platform_url} target="_blank" rel="noreferrer" className="text-[11px] text-slate-500 hover:text-[#20c58f]">
          Plattform
        </a>
      )}
    </span>
  )
}

/** Årsvärde och sannolikhet: sparat värde, annars beräknat (visas dämpat) */
function derived(n: NoticeWithRelations) {
  const annual = n.annual_value ?? annualValueOf(n.estimated_value, n.duration_months)
  const prob =
    n.win_probability ??
    estimateWinProbability({ expectedOtherBids: n.expected_bids && n.expected_bids > 1 ? n.expected_bids - 1 : null, criteriaType: n.criteria_type }).probability
  return { annual, annualComputed: n.annual_value == null && annual != null, prob, probComputed: n.win_probability == null }
}

export default function WatchPage() {
  const bids = true
  const [notices, setNotices] = useState<NoticeWithRelations[]>([])
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<StatusFilter>(bids ? 'work' : 'active')
  const [openOnly, setOpenOnly] = useState(!bids)
  const [showBelow, setShowBelow] = useState(bids)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    try {
      const statuses = status === 'all' ? undefined : status === 'active' ? ACTIVE_STATUSES : status === 'work' ? WORK_STATUSES : ourStatusValues(status)
      const [list, seenIds] = await Promise.all([
        ProcurementService.listNotices({ minScore: showBelow ? undefined : NOTIFY_SCORE, statuses, openOnly, search }),
        ProcurementService.getSeenIds(),
      ])
      setNotices(list)
      setSeen(seenIds)
      setError(null)
    } catch (e) {
      const msg = errMsg(e, 'Kunde inte hämta upphandlingar')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [status, openOnly, showBelow, search])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    ProcurementService.listManagers()
      .then(setManagers)
      .catch(() => setManagers([]))
  }, [])

  const unread = useMemo(() => notices.filter((n) => !seen.has(n.id)), [notices, seen])

  const exportList = async () => {
    if (notices.length === 0) {
      toast.error('Listan är tom')
      return
    }
    setExporting(true)
    try {
      await exportXlsx({
        fileBase: 'Anbudslista',
        sheetName: 'Anbud',
        title: 'Anbud, listan',
        columns: [
          { header: 'BGU', width: 10 },
          { header: 'Upphandling', width: 56 },
          { header: 'Köpare', width: 32 },
          { header: 'Status', width: 14 },
          { header: 'Ansvarig', width: 22 },
          { header: 'Sista anbudsdag', width: 16 },
          { header: 'Poäng', width: 8 },
          { header: 'Årsvärde (kr)', width: 14, numFmt: '# ##0' },
          { header: 'Sannolikhet', width: 12, numFmt: '0%' },
          { header: 'Förväntat TB (kr)', width: 16, numFmt: '# ##0' },
        ],
        rows: notices.map((n) => {
          const der = derived(n)
          return [
            `BGU-${n.bgu_number}`,
            n.title,
            n.buyer?.name ?? n.buyer_name ?? '',
            OUR_STATUS_LABEL[n.our_status],
            n.owner_id ? personName(managers, n.owner_id) : '',
            n.tender_deadline ? fmtDate(n.tender_deadline) : '',
            n.match_score,
            der.annual,
            der.prob,
            n.expected_contribution,
          ]
        }),
      })
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte skapa Excel-filen'))
    } finally {
      setExporting(false)
    }
  }

  const markAllRead = async () => {
    if (unread.length === 0) return
    try {
      await ProcurementService.markManySeen(unread.map((n) => n.id))
      setSeen(new Set([...seen, ...unread.map((n) => n.id)]))
      refreshProcurementBadge()
      toast.success('Alla markerade som lästa')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte markera som lästa'))
    }
  }

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'active', label: 'Aktiva' },
    { value: 'work', label: 'Bedöms, pågår och lämnat' },
    { value: 'all', label: 'Alla statusar' },
    ...OUR_STATUS_CHOICES.map((s) => ({ value: s as StatusFilter, label: OUR_STATUS_LABEL[s] })),
  ]

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Icon name="allman.sok" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="Sök titel, köpare eller beskrivning"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Sök"
          />
        </div>
        <select className={`${selectCls} sm:w-44`} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status">
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-slate-400 whitespace-nowrap">
          <input type="checkbox" className={checkboxCls} checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Bara öppna
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-slate-400 whitespace-nowrap">
          <input type="checkbox" className={checkboxCls} checked={showBelow} onChange={(e) => setShowBelow(e.target.checked)} />
          Visa under tröskeln
        </label>
        <IconButton icon={<Icon name="upphandling.excel" size={20} />} label="Exportera till Excel" onClick={() => void exportList()} disabled={exporting} />
      </div>

      <Section
        title={`Upphandlingar (${notices.length})`}
        action={unread.length > 0 ? <LinkButton onClick={() => void markAllRead()}>Markera alla som lästa</LinkButton> : undefined}
      >
        {error ? (
          <EmptyState title="Kunde inte hämta upphandlingar" hint={error} />
        ) : notices.length === 0 ? (
          <EmptyState
            title="Inga upphandlingar matchar"
            hint={showBelow ? 'Ändra filtren eller vänta på nästa synk.' : 'Synken hämtar nya annonser varje timme. Kryssa i Visa under tröskeln för att se svagare träffar.'}
          />
        ) : (
          <>
            {/* Bred skärm: tabell */}
            <div className="hidden md:block overflow-x-auto">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>Upphandling</th>
                    <th className={tableCls.thRight}>Poäng</th>
                    <th className={tableCls.th}>Sista dag</th>
                    <th className={tableCls.th}>Anbud och kriterier</th>
                    <th className={tableCls.thRight}>Årsvärde</th>
                    <th className={tableCls.thRight}>Sannolikhet</th>
                    <th className={tableCls.thRight}>Förv. TB</th>
                    <th className={tableCls.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((n) => {
                    const isUnread = !seen.has(n.id)
                    const d = daysUntil(n.tender_deadline)
                    const der = derived(n)
                    return (
                      <tr key={n.id} className={tableCls.tr}>
                        <td className={`${tableCls.td} max-w-[320px]`}>
                          <div className="flex items-start gap-1.5">
                            {isUnread && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" title="Oläst" />}
                            <div className="min-w-0">
                              <Link
                                to={noticePath(n.id)}
                                className={`block leading-snug hover:text-[#20c58f] ${isUnread ? 'font-semibold text-slate-100' : 'text-slate-200'}`}
                              >
                                {n.title}
                              </Link>
                              <div className="text-[11px] text-slate-500 truncate">{n.buyer?.name ?? n.buyer_name ?? 'Okänd köpare'}</div>
                              <SourceLinks notice={n} />
                            </div>
                          </div>
                        </td>
                        <td className={`${tableCls.tdRight} ${n.match_score >= DIRECT_SCORE ? 'text-[#20c58f] font-medium' : n.match_score < NOTIFY_SCORE ? 'text-slate-500' : ''}`}>
                          {n.match_score}
                        </td>
                        <td className={`${tableCls.td} whitespace-nowrap`}>
                          <div>{fmtDate(n.tender_deadline)}</div>
                          <div className={`text-[11px] ${deadlineTone(d)}`}>{fmtRelativeDays(n.tender_deadline)}</div>
                        </td>
                        <td className={tableCls.td}>
                          <div>{n.expected_bids != null ? `${n.expected_bids} anbud` : '–'}</div>
                          <div className="text-[11px] text-slate-500">{n.criteria_type ? CRITERIA_TYPE_LABEL[n.criteria_type] : 'Kriterier okända'}</div>
                        </td>
                        <td className={`${tableCls.tdRight} ${der.annualComputed ? 'text-slate-500' : ''}`} title={der.annualComputed ? 'Beräknat ur uppskattat värde och avtalstid' : undefined}>
                          {fmtKrShort(der.annual)}
                        </td>
                        <td className={`${tableCls.tdRight} ${der.probComputed ? 'text-slate-500' : ''}`} title={der.probComputed ? 'Grov bas: 1 delat med förväntat antal anbud' : undefined}>
                          {fmtPct(der.prob)}
                        </td>
                        <td className={tableCls.tdRight}>{fmtKrShort(n.expected_contribution)}</td>
                        <td className={`${tableCls.td} whitespace-nowrap`}>
                          <StatusDot dotClass={OUR_STATUS_DOT[n.our_status]}>{OUR_STATUS_LABEL[n.our_status]}</StatusDot>
                          <div className="text-[11px] text-slate-500 mt-0.5">{personName(managers, n.owner_id)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Smal skärm: lista */}
            <ul className="md:hidden divide-y divide-slate-800">
              {notices.map((n) => {
                const isUnread = !seen.has(n.id)
                const d = daysUntil(n.tender_deadline)
                const der = derived(n)
                return (
                  <li key={n.id} className="px-3 py-3">
                    <div className="flex items-start gap-1.5">
                      {isUnread && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <Link to={noticePath(n.id)} className={`block text-[13px] leading-snug ${isUnread ? 'font-semibold text-slate-100' : 'text-slate-200'}`}>
                          {n.title}
                        </Link>
                        <div className="text-[11px] text-slate-500 truncate">{n.buyer?.name ?? n.buyer_name ?? 'Okänd köpare'}</div>
                        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] tabular-nums text-slate-300">
                          <span>
                            Sista dag {fmtDate(n.tender_deadline)} <span className={deadlineTone(d)}>{fmtRelativeDays(n.tender_deadline)}</span>
                          </span>
                          <span className="text-right">Poäng {n.match_score}</span>
                          <span>Årsvärde {fmtKrShort(der.annual)}</span>
                          <span className="text-right">Sannolikhet {fmtPct(der.prob)}</span>
                          <span>Förv. TB {fmtKrShort(n.expected_contribution)}</span>
                          <span className="text-right">{n.criteria_type ? CRITERIA_TYPE_LABEL[n.criteria_type] : ''}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <StatusDot dotClass={OUR_STATUS_DOT[n.our_status]}>
                            {OUR_STATUS_LABEL[n.our_status]}
                            {n.owner_id ? `, ${personName(managers, n.owner_id)}` : ''}
                          </StatusDot>
                          <SourceLinks notice={n} />
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Section>
    </div>
  )
}

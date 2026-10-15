// src/pages/admin/procurement/ContractClockPage.tsx
// Framförhållning > Avtalsklocka (docs/upphandlingsportal-ux-plan.md etapp 6
// och 7): kända avtal med nuvarande leverantör, kontaktperson hos köparen,
// tidslinje med bearbetningsfönster 18 till 12 månader före slut och
// förlängningsoptioner, status och ansvarig i menyer. En rad per upphandling:
// ramavtal med flera leverantörer grupperas på source_ref och samma
// upphandling i TED och UHM slås ihop. Ändringar skrivs till alla ingående
// tilldelningsrader.
//
// Sökruta, område (Hela Sverige, landsdel, län), tidshorisont, sortering,
// status och filtret "Bara två anbudsgivare brukar svara" (ersätter
// Utmanarläget, ?tva=1). Felträffar nås via statusfiltret. Prognosen per
// kvartal ligger under Prognos sedan 3.65.0. Excel-export av urvalet.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Select from '../../../components/ui/Select'
import { Icon } from '../../../components/icons/Icon'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier, type ProcurementManagerProfile } from '../../../services/procurementService'
import { todaySwedish } from '../../../shared/procurementRules'
import { END_SOURCE_LABEL, WINDOW_STATE_LABEL, type ProcurementAward, type ProcurementAwardStatus, type ProcurementContact } from '../../../types/procurement'
import { EmptyState, IconButton, LinkButton } from '../../../components/admin/procurement/ui'
import { fmtNum } from '../../../components/admin/procurement/uiFormat'
import {
  AWARD_STATUS_LABEL,
  CLOCK_SORT_LABEL,
  annualValueOfGroup,
  buildProcurements,
  buyerKeyOf,
  expectedAnnouncementQuarter,
  followupOf,
  indexBidders,
  matchesCounty,
  matchesHorizon,
  sortClock,
  twoBidderBuyerKeys,
  windowStateOf,
  type ClockSort,
  type CountyFilter,
  type HorizonFilter,
  type ProcurementGroup,
} from '../../../components/admin/procurement/market/marketStats'
import { CountySelect, HistoryEmpty } from '../../../components/admin/procurement/market/shared'
import { countyLabel } from '../../../components/admin/procurement/market/format'
import { ClockTable } from '../../../components/admin/procurement/clock/ClockTable'
import { exportXlsx } from '../../../components/admin/procurement/excelExport'
import { personName } from '../../../components/admin/procurement/detail/helpers'

const HORIZON_OPTIONS: Array<{ value: HorizonFilter; label: string }> = [
  { value: '18', label: 'Slut inom 18 månader' },
  { value: 'window', label: 'I fönstret nu' },
  { value: '12', label: 'Slut inom 12 månader' },
  { value: '24', label: 'Slut inom 24 månader' },
  { value: 'upcoming', label: 'Alla kommande' },
  { value: 'passed', label: 'Slut passerat, ingen ny annons' },
  { value: 'reannounced', label: 'Ny upphandling annonserad eller tilldelad' },
  { value: 'all', label: 'Alla, även utgångna' },
]

type StatusFilter = 'active' | 'all' | 'excluded' | ProcurementAwardStatus

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Ej klara' },
  { value: 'all', label: 'Alla statusar' },
  ...(Object.keys(AWARD_STATUS_LABEL) as ProcurementAwardStatus[]).map((s) => ({ value: s as StatusFilter, label: AWARD_STATUS_LABEL[s] })),
  { value: 'excluded', label: 'Felträffar' },
]

const SORT_OPTIONS = (Object.keys(CLOCK_SORT_LABEL) as ClockSort[]).map((s) => ({ value: s, label: `Sortera: ${CLOCK_SORT_LABEL[s].toLowerCase()}` }))

type ExcludedRow = Pick<ProcurementAward, 'id' | 'title' | 'buyer_name' | 'source' | 'source_ref' | 'excluded_reason' | 'excluded_at'>

function contactRank(c: ProcurementContact): string {
  return `${c.last_contacted_at ?? '0000'}|${c.source === 'manual' ? 1 : 0}|${c.last_seen_at}`
}

export default function ContractClockPage() {
  const [params, setParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [contacts, setContacts] = useState<ProcurementContact[]>([])
  const [excluded, setExcluded] = useState<ExcludedRow[]>([])
  const [horizon, setHorizon] = useState<HorizonFilter>('18')
  const [county, setCounty] = useState<CountyFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<ClockSort>('window')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const twoOnly = params.get('tva') === '1'

  const setTwoOnly = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('tva', '1')
    else next.delete('tva')
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, m, x, c] = await Promise.all([
        ProcurementService.listMarketDataset(),
        ProcurementService.listManagers().catch(() => []),
        ProcurementService.listExcludedAwards().catch(() => []),
        ProcurementService.listContacts().catch(() => [] as ProcurementContact[]),
      ])
      setAwards(d.awards)
      setBidders(d.bidders)
      setManagers(m)
      setExcluded(x)
      setContacts(c)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta avtalsklockan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const groups = useMemo(() => buildProcurements(awards), [awards])
  const biddersByRef = useMemo(() => indexBidders(bidders), [bidders])
  const twoBidder = useMemo(() => twoBidderBuyerKeys(groups, biddersByRef), [groups, biddersByRef])

  // Kontaktperson per köpare: senast kontaktad, manuellt tillagd, senast sedd i en annons
  const contactByBuyer = useMemo(() => {
    const map = new Map<string, ProcurementContact>()
    for (const c of contacts) {
      const cur = map.get(c.buyer_id)
      if (!cur || contactRank(c) > contactRank(cur)) map.set(c.buyer_id, c)
    }
    return map
  }, [contacts])
  const contactFor = useCallback((g: ProcurementGroup) => (g.buyerId ? contactByBuyer.get(g.buyerId) ?? null : null), [contactByBuyer])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = groups
      .filter((g) => matchesCounty(g.countyCode, county))
      .filter((g) => matchesHorizon(g, horizon, today))
      .filter((g) => (status === 'all' ? true : status === 'active' ? g.status !== 'done' && g.status !== 'ignored' : g.status === status))
      .filter((g) => !twoOnly || twoBidder.has(buyerKeyOf(g)))
      .filter((g) => {
        if (!q) return true
        const c = contactFor(g)
        const hay = [g.buyerName, g.title, countyLabel(g.countyCode), ...g.winners.map((w) => w.name), c?.name, c?.email].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    return sortClock(filtered, sort, (code) => countyLabel(code))
  }, [groups, county, horizon, status, today, twoOnly, twoBidder, search, sort, contactFor])

  const patchAwards = (ids: string[], patch: Partial<AwardWithRelations>) =>
    setAwards((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, ...patch } : a)))

  const onStatus = async (g: ProcurementGroup, next: ProcurementAwardStatus) => {
    try {
      await Promise.all(g.awardIds.map((id) => ProcurementService.updateAward(id, { status: next })))
      patchAwards(g.awardIds, { status: next })
      toast.success(`Status: ${AWARD_STATUS_LABEL[next]}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara statusen')
    }
  }

  const onOwner = async (g: ProcurementGroup, ownerId: string | null) => {
    try {
      await Promise.all(g.awardIds.map((id) => ProcurementService.updateAward(id, { owner_id: ownerId })))
      patchAwards(g.awardIds, { owner_id: ownerId })
      toast.success(ownerId ? `Ansvarig: ${personName(managers, ownerId)}` : 'Ingen ansvarig')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara ansvarig')
    }
  }

  const onCorrectEnd = async (g: ProcurementGroup, date: string | null) => {
    try {
      await Promise.all(g.awardIds.map((id) => ProcurementService.correctAwardEnd(id, date)))
      patchAwards(g.awardIds, { corrected_end_date: date })
      toast.success(date ? `Slutdatum rättat till ${date}` : 'Rättningen är borttagen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte rätta slutdatumet')
      throw e
    }
  }

  const onExclude = async (g: ProcurementGroup) => {
    try {
      await ProcurementService.setAwardsExcluded(g.awardIds, 'felträff, gäller inte skadedjur')
      toast.success('Markerad som felträff. Den finns under Status, Felträffar.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte markera felträffen')
    }
  }

  const onRestore = async (ids: string[]) => {
    try {
      await ProcurementService.setAwardsExcluded(ids, null)
      toast.success('Återställd till avtalsklockan')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte återställa')
    }
  }

  // Felträffar grupperade per upphandling (källa plus referens)
  const excludedGroups = useMemo(() => {
    const map = new Map<string, { ids: string[]; title: string | null; buyer: string | null; reason: string | null; source: string }>()
    for (const x of excluded) {
      const k = `${x.source}:${x.source_ref ?? x.id}`
      const e = map.get(k) ?? { ids: [], title: x.title, buyer: x.buyer_name, reason: x.excluded_reason ?? null, source: x.source }
      e.ids.push(x.id)
      map.set(k, e)
    }
    const q = search.trim().toLowerCase()
    return [...map.values()]
      .filter((x) => !q || `${x.buyer ?? ''} ${x.title ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.buyer).localeCompare(String(b.buyer), 'sv'))
  }, [excluded, search])

  const exportClock = async () => {
    if (rows.length === 0) {
      toast.error('Inga avtal i urvalet')
      return
    }
    setExporting(true)
    try {
      await exportXlsx({
        fileBase: 'Avtalsklocka',
        sheetName: 'Avtalsklocka',
        title: 'Avtalsklocka',
        columns: [
          { header: 'Köpare', width: 32 },
          { header: 'Län', width: 16 },
          { header: 'Upphandling', width: 48 },
          { header: 'Nuvarande leverantör', width: 30 },
          { header: 'Avtalsslut', width: 12 },
          { header: 'Basavtal slut', width: 12 },
          { header: 'Optioner (mån)', width: 10 },
          { header: 'Optioner ur annonsen', width: 10 },
          { header: 'Slutdatumets källa', width: 28 },
          { header: 'Beräkning', width: 50 },
          { header: 'Fönster från', width: 12 },
          { header: 'Fönster till', width: 12 },
          { header: 'Läge', width: 16 },
          { header: 'Annons väntas', width: 12 },
          { header: 'Årsvärde (kr)', width: 14, numFmt: '# ##0' },
          { header: 'Status', width: 14 },
          { header: 'Ansvarig', width: 20 },
          { header: 'Kontaktperson', width: 24 },
          { header: 'Telefon', width: 16 },
          { header: 'E-post', width: 28 },
        ],
        rows: rows.map((g) => {
          const c = contactFor(g)
          const w = windowStateOf(g, today)
          const f = followupOf(g, today)
          return [
            g.buyerName ?? '',
            countyLabel(g.countyCode),
            g.title ?? '',
            g.winners.map((x) => x.name).join(', '),
            g.endDate ?? '',
            g.correctedEndDate ? '' : g.baseEndDate ?? '',
            g.correctedEndDate ? null : g.optionMonths,
            g.optionsKnown ? 'ja' : 'nej',
            g.endSource ? END_SOURCE_LABEL[g.endSource] : '',
            g.correctedEndDate ? 'Rättat manuellt' : g.calcBasis ?? '',
            g.windowStart ?? '',
            g.windowEnd ?? '',
            w ? WINDOW_STATE_LABEL[w] : f === 'new_notice' || f === 'new_award' ? 'Annonserad' : '',
            f === 'passed_no_notice' ? 'nu' : expectedAnnouncementQuarter(g, today) ?? '',
            annualValueOfGroup(g),
            AWARD_STATUS_LABEL[g.status],
            g.ownerId ? personName(managers, g.ownerId) : '',
            c?.name ?? '',
            c?.phone ?? '',
            c?.email ?? '',
          ]
        }),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte skapa Excel-filen')
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

  const showingExcluded = status === 'excluded'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-64">
          <Icon name="allman.sok" className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök köpare, län, leverantör eller kontakt"
            aria-label="Sök i avtalsklockan"
            className="w-full h-10 pl-9 pr-3 text-[13px] bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </div>
        <CountySelect value={county} onChange={setCounty} />
        {!showingExcluded && <div className="w-52"><Select options={HORIZON_OPTIONS} value={horizon} onChange={(v) => setHorizon(v as HorizonFilter)} /></div>}
        {!showingExcluded && <div className="w-56"><Select options={SORT_OPTIONS} value={sort} onChange={(v) => setSort(v as ClockSort)} /></div>}
        <div className="w-44"><Select options={STATUS_FILTER_OPTIONS} value={status} onChange={(v) => setStatus(v as StatusFilter)} /></div>
        {!showingExcluded && (
          <label className="inline-flex items-center gap-2 min-h-[44px] text-[13px] text-slate-300" title="Köpare där medianen av antalet anbud är högst två. Där har ett tredje anbud stor chans.">
            <input type="checkbox" checked={twoOnly} onChange={(e) => setTwoOnly(e.target.checked)} className="w-4 h-4 accent-[#20c58f]" />
            Bara två anbudsgivare brukar svara
          </label>
        )}
        <span className="text-xs text-slate-500 tabular-nums">{fmtNum(showingExcluded ? excludedGroups.length : rows.length)} {showingExcluded ? 'felträffar' : 'avtal'}</span>
        {!showingExcluded && (
          <IconButton icon={<Icon name="upphandling.excel" size={20} />} label="Exportera till Excel" onClick={() => void exportClock()} disabled={exporting} className="ml-auto" />
        )}
      </div>

      {!showingExcluded && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-[#20c58f]/15 border border-[#20c58f]" />Bearbetningsfönster 18 till 12 månader före slut</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm text-slate-500" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 2px, currentColor 2px 3px)' }} />
            Förlängningsoption
          </span>
          <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3 bg-slate-100" />Avtalsslut</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3 bg-amber-400" />Idag</span>
        </div>
      )}

      {showingExcluded ? (
        excludedGroups.length === 0 ? (
          <EmptyState title="Inga felträffar" hint="Tilldelningar som inte gäller skadedjur flaggas av synken eller med ikonen i avtalsklockans rader." icon={<Icon name="allman.arkiv" size={32} />} />
        ) : (
          <div className="rounded-[10px] border border-slate-800 bg-slate-900/40">
            <p className="px-4 py-2.5 border-b border-slate-800 text-[12px] text-slate-500">
              Tilldelningar som inte gäller skadedjur (lokalvård, hissar, vassklippning ...). De räknas inte i marknad eller avtalsklocka. Rådatan finns kvar.
            </p>
            <ul className="divide-y divide-slate-800">
              {excludedGroups.map((x) => (
                <li key={x.ids[0]} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-[12.5px]">
                  <div className="min-w-0">
                    <div className="text-slate-200">{x.buyer ?? 'Okänd köpare'}</div>
                    <div className="text-[11.5px] text-slate-500 truncate max-w-[560px]" title={x.title ?? ''}>{x.title}</div>
                    <div className="text-[11px] text-slate-600">{x.reason}</div>
                  </div>
                  <LinkButton onClick={() => void onRestore(x.ids)}>Återställ</LinkButton>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : awards.length === 0 ? (
        <HistoryEmpty title="Inga kända avtal ännu" />
      ) : rows.length === 0 ? (
        <EmptyState title="Inga avtal matchar filtret" hint="Byt tidshorisont eller område, eller töm sökrutan." icon={<Icon name="upphandling.avtalsklocka" size={32} />} />
      ) : (
        <ClockTable rows={rows} today={today} managers={managers} contactFor={contactFor} onStatus={onStatus} onOwner={onOwner} onCorrectEnd={onCorrectEnd} onExclude={onExclude} />
      )}

      {!showingExcluded && (
        <p className="text-[11.5px] text-slate-500">
          Slutdatum i ordningen TED slutdatum plus förlängningar, Mercell, avtalsstart plus avtalstid, antagandet två plus två år. Förlängningsoptioner läses ur annonsen när de finns
          (antal, längd eller sista möjliga slut), annars antas ett år per förlängning. Rätta per rad när det verkliga datumet är känt.
        </p>
      )}
    </div>
  )
}

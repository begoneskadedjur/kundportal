// src/pages/admin/procurement/MarketPage.tsx
// Marknad, upphandlingsportalens startsida (planens avsnitt 9.1): marknadens
// storlek och trend, marknadsandel per leverantör och år, antal anbud,
// pipeline per kvartal, utmanarläge, kvalitetsviktade köpare och källhälsa.
// BeGones län är förvalt. Aggregaten räknas i market/marketStats.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier, type NoticeWithRelations } from '../../../services/procurementService'
import { NOTIFY_SCORE, todaySwedish } from '../../../shared/procurementRules'
import type { ProcurementSourceHealth } from '../../../types/procurement'
import { PulseRow, Section } from '../../../components/admin/procurement/ui'
import { fmtKrShort, fmtNum, fmtPct } from '../../../components/admin/procurement/uiFormat'
import {
  bidsByYear,
  buildProcurements,
  challengerBuyers,
  indexBidders,
  isInWindow,
  marketByYear,
  matchesCounty,
  overallBidsMedian,
  pipelineByQuarter,
  qualityBuyers,
  shareTotals,
  sharesByYear,
  type CountyFilter,
} from '../../../components/admin/procurement/market/marketStats'
import { CountySelect, HistoryEmpty, SourceHealthTable, SourceHealthWarning } from '../../../components/admin/procurement/market/shared'
import { MarketShareChart, MarketSizeCharts } from '../../../components/admin/procurement/market/MarketCharts'
import { BidsTable, ChallengerTable, PipelineTable, QualityBuyersTable } from '../../../components/admin/procurement/market/MarketTables'

export default function MarketPage() {
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [notices, setNotices] = useState<NoticeWithRelations[]>([])
  const [health, setHealth] = useState<ProcurementSourceHealth[]>([])
  const [county, setCounty] = useState<CountyFilter>('begone')

  const load = useCallback(async () => {
    setLoading(true)
    // Tilldelningar och anbudsgivare i ett RPC-anrop (procurement_market_dataset):
    // ingen klientberäkning över kapade svar, felträffar är redan bortfiltrerade
    const [d, n, h] = await Promise.allSettled([
      ProcurementService.listMarketDataset(),
      ProcurementService.listNotices({ minScore: NOTIFY_SCORE, openOnly: true, limit: 1000 }),
      ProcurementService.listSourceHealth(),
    ])
    if (d.status === 'fulfilled') {
      setAwards(d.value.awards)
      setBidders(d.value.bidders)
    }
    if (n.status === 'fulfilled') setNotices(n.value)
    if (h.status === 'fulfilled') setHealth(h.value)
    const failed = [d, n, h].filter((r) => r.status === 'rejected')
    if (failed.length > 0) toast.error('Delar av marknadsdatan kunde inte hämtas')
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = todaySwedish()
  const allGroups = useMemo(() => buildProcurements(awards), [awards])
  const groups = useMemo(() => allGroups.filter((g) => matchesCounty(g.countyCode, county)), [allGroups, county])
  const biddersByRef = useMemo(() => indexBidders(bidders), [bidders])

  const market = useMemo(() => marketByYear(groups), [groups])
  const shares = useMemo(() => sharesByYear(groups), [groups])
  const bids = useMemo(() => bidsByYear(groups), [groups])
  const bidsMedian = useMemo(() => overallBidsMedian(groups), [groups])
  const noticesInCounty = useMemo(
    () => notices.filter((n) => county === 'all' || (n.county_codes ?? []).some((c) => matchesCounty(c, county))),
    [notices, county]
  )
  const pipeline = useMemo(() => pipelineByQuarter(noticesInCounty, groups, today, 8), [noticesInCounty, groups, today])
  const challengers = useMemo(() => challengerBuyers(groups, biddersByRef, today, 18), [groups, biddersByRef, today])
  const quality = useMemo(() => qualityBuyers(groups, today), [groups, today])

  const currentYear = Number(today.slice(0, 4))
  const pastYears = market.filter((m) => m.year <= currentYear)
  const latest = pastYears[pastYears.length - 1] ?? null
  const firstYear = market[0]?.year ?? null
  const latestBids = bids.filter((b) => b.year <= currentYear).slice(-1)[0] ?? null
  const totals = shareTotals(shares)
  const inWindow = groups.filter((g) => isInWindow(g, today) && g.status !== 'ignored' && g.status !== 'done').length

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const noHistory = awards.length === 0
  const countyText = county === 'begone' ? 'BeGones län' : county === 'all' ? 'alla län' : 'valt län'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Tilldelningar i {countyText}. Värden är ramtak (avtalat tak) om inget annat anges, inte vinnande pris.
        </p>
        <CountySelect value={county} onChange={setCounty} />
      </div>

      <SourceHealthWarning health={health} />

      <PulseRow
        stats={[
          {
            label: latest ? `Marknad ${latest.year}` : 'Marknad',
            value: latest ? fmtKrShort(latest.value) : '–',
            hint: latest ? `ramtak, ${latest.valued} av ${latest.procurements} med värde` : 'ingen historik',
          },
          {
            label: latest ? `Upphandlingar ${latest.year}` : 'Upphandlingar',
            value: latest ? fmtNum(latest.procurements) : '–',
            hint: firstYear ? `${fmtNum(groups.length)} sedan ${firstYear}` : null,
          },
          {
            label: 'Median anbud',
            value: fmtNum(latestBids?.median ?? bidsMedian, 1),
            hint: latestBids ? `${latestBids.year}, alla år ${fmtNum(bidsMedian, 1)}` : null,
          },
          {
            label: 'Vår andel',
            value: totals.total ? fmtPct(totals.begone / totals.total, 1) : '–',
            hint: firstYear ? `av avtalat tak sedan ${firstYear}` : null,
            tone: totals.begone > 0 ? 'good' : 'neutral',
          },
          {
            label: 'I bearbetningsfönster',
            value: fmtNum(inWindow),
            hint: '12 till 18 månader före slut',
            tone: inWindow > 0 ? 'warn' : 'neutral',
          },
        ]}
      />

      <Section title="Marknadens storlek och trend" hint="Kontrakterat värde i öppna källor är avtalets ramtak. Samma upphandling i TED och UHM räknas en gång.">
        {market.length === 0 ? <HistoryEmpty /> : <MarketSizeCharts rows={market} />}
      </Section>

      <Section title="Marknadsandel per leverantör och år" hint="Andel av avtalat tak per vinnare. Leverantörer matchas på organisationsnummer.">
        {shares.length === 0 ? <HistoryEmpty title="Inga tilldelningar med ramtak eller verkligt pris" /> : <MarketShareChart rows={shares} />}
      </Section>

      <Section title="Antal anbud per upphandling" hint="Fördelning och median per år.">
        {noHistory ? <HistoryEmpty /> : <BidsTable rows={bids} overall={bidsMedian} />}
      </Section>

      <Section
        title="Pipeline per kvartal"
        hint="Förväntat täckningsbidrag i bevakningen per kvartal för sista anbudsdag, och avtalsklockans avtal per kvartal för förväntad annons med årsvärde."
      >
        <PipelineTable rows={pipeline} />
      </Section>

      <Section
        title="Utmanarläge"
        hint="Köpare där bara Anticimex och Nomor/Rentokil lämnade anbud senast och avtalet löper ut inom 18 månader. Ett tredje anbud har ofta stor chans."
      >
        {noHistory ? <HistoryEmpty /> : <ChallengerTable rows={challengers} />}
      </Section>

      <Section title="Kvalitetsviktade köpare" hint="Köpare som utvärderar på pris och kvalitet, där rapportering, egenkontroll och stationskartor väger.">
        {noHistory ? <HistoryEmpty /> : <QualityBuyersTable rows={quality} />}
      </Section>

      <Section title="Källhälsa" hint="Varning när en källa varit tyst i över 24 timmar. TED och Kommers bär bevakningen om Mercell faller bort.">
        <SourceHealthTable health={health} />
      </Section>
    </div>
  )
}

// src/pages/admin/procurement/MarketPage.tsx
// Marknad > Översikt (/marknad, planens avsnitt 9.1): marknadens storlek och
// trend, marknadsandel per leverantör och år, antal anbud, köpare där bara två
// anbudsgivare brukar svara (länk till avtalsklockans filter, ersätter
// Utmanarläget sedan 3.65.0) och kvalitetsviktade köpare. Hela Sverige är förvalt (beslut 2026-10-15).
// Aggregaten räknas i market/marketStats.ts.
//
// Sedan 3.63.0 är Idag startsidan. Pipeline per kvartal ligger under
// Framförhållning > Prognos, lärdomarna under Marknad > Lärdomar och
// källhälsan under Inställningar (varningen om en tyst källa visas på Idag).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { ProcurementService, type AwardWithRelations, type BidderWithSupplier } from '../../../services/procurementService'
import { addMonthsIso, todaySwedish } from '../../../shared/procurementRules'
import { PulseRow, Section } from '../../../components/admin/procurement/ui'
import { fmtKrShort, fmtNum, fmtPct } from '../../../components/admin/procurement/uiFormat'
import {
  bidsByYear,
  buildProcurements,
  buyerKeyOf,
  followupOf,
  indexBidders,
  marketByYear,
  matchesCounty,
  overallBidsMedian,
  qualityBuyers,
  shareTotals,
  sharesByYear,
  twoBidderBuyerKeys,
  type CountyFilter,
} from '../../../components/admin/procurement/market/marketStats'
import { CountySelect, HistoryEmpty } from '../../../components/admin/procurement/market/shared'
import { areaLabel } from '../../../components/admin/procurement/market/format'
import { MarketShareChart, MarketSizeCharts } from '../../../components/admin/procurement/market/MarketCharts'
import { procurementPath } from '../../../lib/procurementPortal'
import { BidsTable, QualityBuyersTable } from '../../../components/admin/procurement/market/MarketTables'

export default function MarketPage() {
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<AwardWithRelations[]>([])
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [county, setCounty] = useState<CountyFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    // Tilldelningar och anbudsgivare i ett RPC-anrop (procurement_market_dataset):
    // ingen klientberäkning över kapade svar, felträffar är redan bortfiltrerade
    try {
      const d = await ProcurementService.listMarketDataset()
      setAwards(d.awards)
      setBidders(d.bidders)
    } catch {
      toast.error('Marknadsdatan kunde inte hämtas')
    }
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
  // Avtal hos köpare där bara två anbudsgivare brukar svara och som slutar inom 18 månader
  const twoBidderEnding = useMemo(() => {
    const keys = twoBidderBuyerKeys(groups, biddersByRef)
    const limit = addMonthsIso(today, 18)
    return groups.filter((g) => keys.has(buyerKeyOf(g)) && !!g.endDate && g.endDate >= today && g.endDate <= limit && !followupOf(g, today))
  }, [groups, biddersByRef, today])
  const quality = useMemo(() => qualityBuyers(groups, today), [groups, today])

  const currentYear = Number(today.slice(0, 4))
  const pastYears = market.filter((m) => m.year <= currentYear)
  const latest = pastYears[pastYears.length - 1] ?? null
  const firstYear = market[0]?.year ?? null
  const latestBids = bids.filter((b) => b.year <= currentYear).slice(-1)[0] ?? null
  const totals = shareTotals(shares)

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const noHistory = awards.length === 0
  const countyText = areaLabel(county)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Tilldelningar i {countyText}. Värden är ramtak (avtalat tak) om inget annat anges, inte vinnande pris.
        </p>
        <CountySelect value={county} onChange={setCounty} />
      </div>

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

      <Section title="Två anbudsgivare, slut inom 18 mån" hint="Köpare där medianen av antalet anbud är högst två. Där har ett tredje anbud stor chans.">
        {noHistory ? (
          <HistoryEmpty />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-[22px] font-semibold tabular-nums text-slate-100 leading-none">{fmtNum(twoBidderEnding.length)}</div>
              <div className="text-[12px] text-slate-500 mt-1">avtal i {countyText} hos köpare där bara två anbudsgivare brukar svara</div>
            </div>
            <Link to={`${procurementPath('/avtalsklocka')}?tva=1`} className="inline-flex items-center gap-1.5 min-h-[44px] text-[13px] text-[#20c58f] hover:underline">
              <Icon name="upphandling.avtalsklocka" size={16} />
              Visa i avtalsklockan
            </Link>
          </div>
        )}
      </Section>

      <Section title="Kvalitetsviktade köpare" hint="Köpare som utvärderar på pris och kvalitet, där rapportering, egenkontroll och stationskartor väger.">
        {noHistory ? <HistoryEmpty /> : <QualityBuyersTable rows={quality} />}
      </Section>
    </div>
  )
}

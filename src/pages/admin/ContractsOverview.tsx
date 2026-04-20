// src/pages/admin/ContractsOverview.tsx
// Försäljningspipeline — strategisk insikts-vy för ägare/marknadschefer.
// Komplement till /admin/dokumentsignering (CasePipeline) som hanterar själva signeringen.
//
// Innehåll:
//  - 3 tabbar: Allt / Offerter / Avtal (varje tab har egna KPI:er + grafer)
//  - KPI-rad kontextuell till aktiv tab
//  - 4 tidsserie-grafer: Volym, Marginal, Säljar-momentum, Tjänste-mix
//  - Tabell med expanderbara rader (tjänster + interna artiklar, via OfferItemsSection)
//  - "Öppna i Dokumentsignering"-knapp för operativ hantering
//
// All filhantering, OneFlow-länkar och uppladdning finns i Dokumentsignering.

import { useState, useMemo, useEffect, useRef } from 'react'
import { BarChart3, ChevronDown, ChevronRight, Loader2, Search, Percent, Banknote, TrendingUp, FileText, FileSignature } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useContracts } from '../../hooks/useContracts'
import {
  ContractService,
  formatContractValue,
  type ContractWithSourceData,
  type ContractBillingAggregate,
  type PipelineTimeSeries,
} from '../../services/contractService'

import PipelineTabs, { type PipelineTabKey } from '../../components/admin/sales-pipeline/PipelineTabs'
import PeriodSelector, { type PeriodOption } from '../../components/admin/sales-pipeline/PeriodSelector'
import PipelineExpandedRow from '../../components/admin/sales-pipeline/PipelineExpandedRow'
import SignedVolumeChart from '../../components/admin/sales-pipeline/SignedVolumeChart'
import MarginTrendChart from '../../components/admin/sales-pipeline/MarginTrendChart'
import SellerMomentumGrid from '../../components/admin/sales-pipeline/SellerMomentumGrid'
import ServiceMixStream from '../../components/admin/sales-pipeline/ServiceMixStream'
import DeepDiveTabs from '../../components/admin/sales-pipeline/DeepDiveTabs'
import TopServicesBreakdown from '../../components/admin/sales-pipeline/TopServicesBreakdown'
import PurchaseArticleBreakdown from '../../components/admin/sales-pipeline/PurchaseArticleBreakdown'
import TechnicianDeliveryGrid from '../../components/admin/sales-pipeline/TechnicianDeliveryGrid'

// ═══ Hjälpfunktioner ═══

function formatKr(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '0 kr'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} mkr`
  if (v >= 1_000) return `${Math.round(v / 1_000)} tkr`
  return `${Math.round(v)} kr`
}

function contractTotalValue(c: ContractWithSourceData): number {
  let val = Number(c.total_value) || 0
  if (c.type === 'contract' && c.contract_length) {
    const years = parseInt(c.contract_length) || 1
    val = val * years
  }
  return val
}

// ═══ KPI-kort ═══

interface KpiProps {
  label: string
  value: string
  subtext?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'green' | 'amber' | 'red' | 'blue'
}

function KpiCard({ label, value, subtext, icon: Icon, tone = 'default' }: KpiProps) {
  const toneMap: Record<string, { icon: string; accent: string }> = {
    default: { icon: 'text-slate-400', accent: 'text-white' },
    green: { icon: 'text-[#20c58f]', accent: 'text-[#20c58f]' },
    amber: { icon: 'text-amber-400', accent: 'text-amber-400' },
    red: { icon: 'text-red-400', accent: 'text-red-400' },
    blue: { icon: 'text-blue-400', accent: 'text-blue-400' },
  }
  const t = toneMap[tone]
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 transition-colors hover:border-slate-600">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${t.icon}`} />
      </div>
      <div className={`text-xl font-bold ${t.accent}`}>{value}</div>
      {subtext && <div className="text-[11px] text-slate-500 mt-0.5">{subtext}</div>}
    </div>
  )
}

// ═══ Huvudkomponent ═══

export default function ContractsOverview() {
  const { profile } = useAuth()
  const { contracts, loading: contractsLoading } = useContracts()

  const basePath =
    profile?.role === 'säljare'
      ? '/saljare'
      : profile?.role === 'koordinator'
        ? '/koordinator'
        : '/admin'

  const [activeTab, setActiveTab] = useState<PipelineTabKey>('all')
  const [period, setPeriod] = useState<PeriodOption>(12)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Globala filter som flödar mellan grafer + tabell
  const [sellerFilter, setSellerFilter] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [technicianFilter, setTechnicianFilter] = useState<{ id: string; name: string } | null>(null)

  // Tidsserie-data
  const [timeSeries, setTimeSeries] = useState<PipelineTimeSeries | null>(null)
  const [tsLoading, setTsLoading] = useState(true)

  // Aggregerad billing-data per kontrakt för tabell-marginalvisning
  const [billingAgg, setBillingAgg] = useState<Map<string, ContractBillingAggregate>>(new Map())

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const marginChartRef = useRef<HTMLDivElement>(null)
  const deepDiveRef = useRef<HTMLDivElement>(null)

  // Ladda tidsserie-data när period ändras
  useEffect(() => {
    let cancelled = false
    setTsLoading(true)
    ContractService.getPipelineTimeSeries(period)
      .then(data => {
        if (!cancelled) setTimeSeries(data)
      })
      .catch(err => {
        console.error('Kunde inte hämta tidsserie:', err)
      })
      .finally(() => {
        if (!cancelled) setTsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  // Hämta billing-aggregate för synliga kontrakt (för tabell-marginal)
  useEffect(() => {
    const relevantIds = contracts
      .filter(c => c.status === 'signed' || c.status === 'active')
      .map(c => c.id)
    if (relevantIds.length === 0) return

    let cancelled = false
    ContractService.getContractBillingAggregate(relevantIds)
      .then(agg => {
        if (!cancelled) setBillingAgg(agg)
      })
      .catch(err => console.warn('billing agg fel:', err))
    return () => {
      cancelled = true
    }
  }, [contracts])

  // Tab-räknare
  const tabCounts = useMemo(() => {
    return {
      all: contracts.length,
      offer: contracts.filter(c => c.type === 'offer').length,
      contract: contracts.filter(c => c.type === 'contract').length,
    }
  }, [contracts])

  // Technician-filter: vilka contract_ids har teknikern jobbat på?
  const technicianContractIds = useMemo(() => {
    if (!technicianFilter || !timeSeries) return null
    const row = timeSeries.technician_delivery.find(t => t.id === technicianFilter.id)
    return row ? new Set(row.contract_ids) : new Set<string>()
  }, [technicianFilter, timeSeries])

  // Dominerande tjänstegrupp per avtal hämtas från timeSeries.margin (redan beräknad där)
  const contractTopGroupMap = useMemo(() => {
    const m = new Map<string, string>()
    if (!timeSeries) return m
    timeSeries.margin.forEach(p => {
      if (p.top_service_group) m.set(p.contract_id, p.top_service_group)
    })
    return m
  }, [timeSeries])

  // Filtrerade kontrakt baserat på tab + sök + globala filter
  const filteredContracts = useMemo(() => {
    let list = contracts
    if (activeTab === 'offer') list = list.filter(c => c.type === 'offer')
    if (activeTab === 'contract') list = list.filter(c => c.type === 'contract')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        c =>
          (c.company_name || '').toLowerCase().includes(q) ||
          (c.contact_person || '').toLowerCase().includes(q) ||
          (c.contact_email || '').toLowerCase().includes(q) ||
          (c.begone_employee_name || '').toLowerCase().includes(q)
      )
    }
    if (sellerFilter) {
      const sf = sellerFilter.toLowerCase().trim()
      list = list.filter(c => (c.begone_employee_email || '').toLowerCase().trim() === sf)
    }
    if (groupFilter) {
      list = list.filter(c => contractTopGroupMap.get(c.id) === groupFilter)
    }
    if (technicianContractIds) {
      list = list.filter(c => technicianContractIds.has(c.id))
    }
    // Nyast först
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [contracts, activeTab, searchQuery, sellerFilter, groupFilter, technicianContractIds, contractTopGroupMap])

  // ═══ KPI:er per tab ═══

  const kpis = useMemo(() => {
    const relevant =
      activeTab === 'offer'
        ? contracts.filter(c => c.type === 'offer')
        : activeTab === 'contract'
          ? contracts.filter(c => c.type === 'contract')
          : contracts

    const signed = relevant.filter(c => c.status === 'signed' || c.status === 'active')
    const pending = relevant.filter(c => c.status === 'pending')
    const declined = relevant.filter(c => c.status === 'declined')

    const pendingValue = pending.reduce((s, c) => s + contractTotalValue(c), 0)
    const declinedValue = declined.reduce((s, c) => s + contractTotalValue(c), 0)

    // Marginal (från billing-aggregate för signerade)
    const marginVals: number[] = []
    signed.forEach(c => {
      const agg = billingAgg.get(c.id)
      if (agg?.margin_pct !== null && agg?.margin_pct !== undefined) {
        marginVals.push(agg.margin_pct)
      }
    })
    const avgMargin =
      marginVals.length > 0
        ? marginVals.reduce((s, v) => s + v, 0) / marginVals.length
        : null

    // Konverteringsgrad (signed / (signed + pending + declined))
    const base = signed.length + pending.length + declined.length
    const conv = base > 0 ? Math.round((signed.length / base) * 100) : 0

    // ARR (endast avtal, signed/active)
    const activeContracts = signed.filter(c => c.type === 'contract')
    const arr = activeContracts.reduce((s, c) => s + (Number(c.total_value) || 0), 0)
    const mrr = arr / 12

    // Snittavtalslängd (år)
    const lengths = activeContracts
      .map(c => parseInt(c.contract_length || '0'))
      .filter(n => n > 0)
    const avgLength =
      lengths.length > 0 ? Math.round(lengths.reduce((s, v) => s + v, 0) / lengths.length) : 0

    // Snittvärde per offert
    const offerList = relevant.filter(c => c.type === 'offer')
    const offerValues = offerList.map(c => c.total_value || 0).filter(v => v > 0)
    const avgOffer =
      offerValues.length > 0 ? offerValues.reduce((s, v) => s + v, 0) / offerValues.length : 0

    return {
      pipelineValue: pendingValue,
      declinedValue,
      avgMargin,
      conversion: conv,
      arr,
      mrr,
      avgLength,
      avgOffer,
      sentCount: relevant.length,
      pendingCount: pending.length,
      signedCount: signed.length,
    }
  }, [contracts, billingAgg, activeTab])

  // Scroll + expand vid klick på scatter-punkt
  const handlePointClick = (contractId: string) => {
    const row = rowRefs.current.get(contractId)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setExpandedId(contractId)
    }
  }

  // Scrolla upp till marginalgrafen när användaren filtrerar via djupdyk-widget
  const scrollToMarginChart = () => {
    marginChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleServiceGroupClick = (group: string) => {
    setGroupFilter(prev => (prev === group ? null : group))
    scrollToMarginChart()
  }

  const handleSellerRowClick = (email: string) => {
    setSellerFilter(prev => (prev === email ? null : email))
    scrollToMarginChart()
  }

  const handleTechnicianClick = (tech: { id: string; name: string }) => {
    setTechnicianFilter(prev => (prev?.id === tech.id ? null : tech))
  }

  const hasActiveGlobalFilter = !!(sellerFilter || groupFilter || technicianFilter)

  const volumeMode = activeTab

  // ═══ Render ═══

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-[#20c58f]" />
          <div>
            <h1 className="text-xl font-bold text-white">Försäljningspipeline</h1>
            <p className="text-xs text-slate-500">
              Strategisk översikt — signering hanteras i Dokumentsignering
            </p>
          </div>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Tab-rad */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PipelineTabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Sök företag, kontakt, säljare..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700 text-sm text-white pl-9 pr-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
          />
        </div>
      </div>

      {/* KPI-rad (kontextuell till tab) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {activeTab === 'all' && (
          <>
            <KpiCard
              label="Pipelinevärde"
              value={formatKr(kpis.pipelineValue)}
              subtext={`${kpis.pendingCount} pågående`}
              icon={Banknote}
              tone="blue"
            />
            <KpiCard
              label="ARR aktiva avtal"
              value={formatKr(kpis.arr)}
              subtext={`${formatKr(kpis.mrr)} MRR`}
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              label="Snittmarginal"
              value={kpis.avgMargin !== null ? `${kpis.avgMargin.toFixed(1)}%` : '—'}
              subtext="Signerade med kalkyl"
              icon={Percent}
              tone={
                kpis.avgMargin === null
                  ? 'default'
                  : kpis.avgMargin >= 40
                    ? 'green'
                    : kpis.avgMargin >= 20
                      ? 'amber'
                      : 'red'
              }
            />
            <KpiCard
              label="Konverteringsgrad"
              value={`${kpis.conversion}%`}
              subtext={`${kpis.signedCount} signerade`}
              icon={TrendingUp}
              tone={kpis.conversion >= 25 ? 'green' : 'amber'}
            />
          </>
        )}

        {activeTab === 'offer' && (
          <>
            <KpiCard
              label="Skickade offerter"
              value={String(kpis.sentCount)}
              subtext={`${kpis.pendingCount} pågående`}
              icon={FileText}
              tone="blue"
            />
            <KpiCard
              label="Konverteringsgrad"
              value={`${kpis.conversion}%`}
              subtext={`${kpis.signedCount} signerade`}
              icon={TrendingUp}
              tone={kpis.conversion >= 25 ? 'green' : 'amber'}
            />
            <KpiCard
              label="Snittvärde per offert"
              value={formatKr(kpis.avgOffer)}
              subtext="Alla offerter"
              icon={Banknote}
            />
            <KpiCard
              label="Förlorat värde"
              value={formatKr(kpis.declinedValue)}
              subtext="Avvisade offerter"
              icon={TrendingUp}
              tone="red"
            />
          </>
        )}

        {activeTab === 'contract' && (
          <>
            <KpiCard
              label="ARR"
              value={formatKr(kpis.arr)}
              subtext={`${kpis.signedCount} aktiva avtal`}
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              label="MRR"
              value={formatKr(kpis.mrr)}
              subtext="Månatligt återkommande"
              icon={Banknote}
              tone="green"
            />
            <KpiCard
              label="Snittmarginal"
              value={kpis.avgMargin !== null ? `${kpis.avgMargin.toFixed(1)}%` : '—'}
              subtext="Per avtal med kalkyl"
              icon={Percent}
              tone={
                kpis.avgMargin === null
                  ? 'default'
                  : kpis.avgMargin >= 40
                    ? 'green'
                    : kpis.avgMargin >= 20
                      ? 'amber'
                      : 'red'
              }
            />
            <KpiCard
              label="Snittavtalslängd"
              value={kpis.avgLength > 0 ? `${kpis.avgLength} år` : '—'}
              subtext="Nya avtal"
              icon={FileSignature}
            />
          </>
        )}
      </div>

      {/* Grafer */}
      {tsLoading ? (
        <div className="flex items-center justify-center py-16 bg-slate-800/20 rounded-xl border border-slate-700/50">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin mr-2" />
          <span className="text-sm text-slate-400">Laddar trenddata...</span>
        </div>
      ) : timeSeries ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SignedVolumeChart data={timeSeries.volume} mode={volumeMode} />
            <div ref={marginChartRef}>
              <MarginTrendChart
                data={timeSeries.margin}
                availableSellers={timeSeries.available_sellers}
                availableGroups={timeSeries.available_service_groups}
                onPointClick={handlePointClick}
                externalSellerFilter={sellerFilter}
                externalGroupFilter={groupFilter}
                onFilterChange={({ seller, group }) => {
                  setSellerFilter(seller)
                  setGroupFilter(group)
                }}
              />
            </div>
            <SellerMomentumGrid
              data={timeSeries.sellers}
              onSellerClick={s => handleSellerRowClick(s.email)}
              activeSellerEmail={sellerFilter}
            />
            <ServiceMixStream
              data={timeSeries.service_mix}
              onGroupClick={g => setGroupFilter(g || null)}
              activeGroup={groupFilter}
            />
          </div>

          {/* Djupdykning — tjänster / inköp / tekniker */}
          <div ref={deepDiveRef}>
            <DeepDiveTabs
              counts={{
                services: timeSeries.top_services.length,
                articles: timeSeries.top_articles.length,
                technicians: timeSeries.technician_delivery.length,
              }}
              services={
                <TopServicesBreakdown
                  data={timeSeries.top_services}
                  onServiceGroupClick={handleServiceGroupClick}
                />
              }
              articles={
                <PurchaseArticleBreakdown
                  data={timeSeries.top_articles}
                  onOpenContract={handlePointClick}
                />
              }
              technicians={
                <TechnicianDeliveryGrid
                  data={timeSeries.technician_delivery}
                  onTechnicianClick={t => handleTechnicianClick({ id: t.id, name: t.name })}
                  activeTechnicianId={technicianFilter?.id || null}
                />
              }
            />
          </div>
        </>
      ) : null}

      {/* Aktivt filter-banner */}
      {hasActiveGlobalFilter && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#20c58f]/5 border border-[#20c58f]/30 rounded-xl text-xs">
          <span className="text-slate-400">Filter aktivt:</span>
          {sellerFilter && (
            <button
              onClick={() => setSellerFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800/60 border border-slate-700 rounded-md text-slate-200 hover:text-white hover:border-[#20c58f]/60 transition-colors"
              title="Rensa säljarfilter"
            >
              Säljare: {timeSeries?.available_sellers.find(s => s.email === sellerFilter)?.name || sellerFilter} ×
            </button>
          )}
          {groupFilter && (
            <button
              onClick={() => setGroupFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800/60 border border-slate-700 rounded-md text-slate-200 hover:text-white hover:border-[#20c58f]/60 transition-colors"
              title="Rensa tjänstegrupp-filter"
            >
              Tjänstegrupp: {groupFilter} ×
            </button>
          )}
          {technicianFilter && (
            <button
              onClick={() => setTechnicianFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800/60 border border-slate-700 rounded-md text-slate-200 hover:text-white hover:border-[#20c58f]/60 transition-colors"
              title="Rensa teknikerfilter"
            >
              Tekniker: {technicianFilter.name} ×
            </button>
          )}
          <button
            onClick={() => {
              setSellerFilter(null)
              setGroupFilter(null)
              setTechnicianFilter(null)
            }}
            className="ml-auto text-[#20c58f] hover:text-white text-[11px]"
          >
            Rensa alla
          </button>
        </div>
      )}

      {/* Tabell */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            {activeTab === 'offer'
              ? 'Offerter'
              : activeTab === 'contract'
                ? 'Avtal'
                : 'Alla dokument'}
          </h3>
          <span className="text-xs text-slate-500">
            {filteredContracts.length} {filteredContracts.length === 1 ? 'post' : 'poster'}
          </span>
        </div>

        {contractsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin mr-2" />
            <span className="text-sm text-slate-400">Laddar...</span>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-500">
            Inga poster matchar filtret
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-700/50">
                  <th className="px-2 py-2.5 font-medium w-8" />
                  <th className="px-3 py-2.5 font-medium">Företag</th>
                  <th className="px-3 py-2.5 font-medium">Typ</th>
                  <th className="px-3 py-2.5 font-medium">Säljare</th>
                  <th className="px-3 py-2.5 font-medium text-right">Värde</th>
                  <th className="px-3 py-2.5 font-medium text-right">Marginal</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Datum</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map(c => {
                  const agg = billingAgg.get(c.id)
                  const isExpanded = expandedId === c.id
                  return (
                    <ContractTableRow
                      key={c.id}
                      contract={c}
                      billing={agg}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : c.id)}
                      basePath={basePath}
                      rowRef={el => {
                        if (el) rowRefs.current.set(c.id, el)
                        else rowRefs.current.delete(c.id)
                      }}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Tabellrad ═══

interface ContractTableRowProps {
  contract: ContractWithSourceData
  billing: ContractBillingAggregate | undefined
  isExpanded: boolean
  onToggle: () => void
  basePath: string
  rowRef: (el: HTMLTableRowElement | null) => void
}

function ContractTableRow({
  contract,
  billing,
  isExpanded,
  onToggle,
  basePath,
  rowRef,
}: ContractTableRowProps) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pågående', color: 'text-blue-400', bg: 'bg-blue-500/15' },
    signed: { label: 'Signerat', color: 'text-[#20c58f]', bg: 'bg-[#20c58f]/15' },
    active: { label: 'Aktivt', color: 'text-[#20c58f]', bg: 'bg-[#20c58f]/15' },
    declined: { label: 'Avvisat', color: 'text-red-400', bg: 'bg-red-500/15' },
    overdue: { label: 'Förfallet', color: 'text-amber-400', bg: 'bg-amber-500/15' },
    ended: { label: 'Avslutat', color: 'text-slate-400', bg: 'bg-slate-500/15' },
  }
  const sc = statusConfig[contract.status] || statusConfig.pending

  const margin = billing?.margin_pct
  const totalValue = contractTotalValue(contract)

  const date = new Date(contract.created_at).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })

  return (
    <>
      <tr
        ref={rowRef}
        className={`border-b border-slate-800/40 transition-colors ${
          isExpanded ? 'bg-slate-800/30' : 'hover:bg-slate-800/20'
        }`}
      >
        <td className="px-2 py-2.5">
          <button
            onClick={onToggle}
            className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/50"
            title={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </td>
        <td className="px-3 py-2.5">
          <div className="font-medium text-white truncate max-w-[220px]">
            {contract.company_name || contract.contact_person || '—'}
          </div>
          {contract.contact_person && contract.company_name && (
            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
              {contract.contact_person}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5">
          {contract.type === 'contract' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
              <FileSignature className="w-3 h-3" /> Avtal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400">
              <FileText className="w-3 h-3" /> Offert
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-slate-300 truncate max-w-[160px]">
          {contract.begone_employee_name || '—'}
        </td>
        <td className="px-3 py-2.5 text-right font-medium text-white tabular-nums">
          {formatContractValue(totalValue)}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {margin !== null && margin !== undefined ? (
            <span
              className={`font-medium ${
                margin >= 40
                  ? 'text-green-400'
                  : margin >= 20
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {margin.toFixed(1)}%
            </span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.color}`}>
            {sc.label}
          </span>
        </td>
        <td className="px-3 py-2.5 text-slate-400 text-[11px] whitespace-nowrap">
          {date}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-slate-800/40 bg-slate-900/40">
          <td colSpan={8} className="px-4 py-4">
            <PipelineExpandedRow contractId={contract.id} basePath={basePath} />
          </td>
        </tr>
      )}
    </>
  )
}

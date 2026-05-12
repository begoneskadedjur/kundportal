// src/pages/admin/CustomerAnalytics.tsx — Affärsinsikt (ombyggd)

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, BarChart3, Users, DollarSign,
  RefreshCw, AlertCircle, Package, Briefcase, Info, AlertTriangle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import sv from 'date-fns/locale/sv'

import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import InsightDrillPanel, { type DrillCustomer } from '../../components/shared/InsightDrillPanel'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import ARRForecastChart from '../../components/admin/customers/ARRForecastChart'
import ContractTimelineGantt from '../../components/admin/customers/analytics/ContractTimelineGantt'
import CustomerSegmentationScatter from '../../components/admin/customers/analytics/CustomerSegmentationScatter'
import ChurnAnalysisSection from '../../components/admin/customers/analytics/ChurnAnalysisSection'
import PortalAdoptionChart from '../../components/admin/customers/analytics/PortalAdoptionChart'
import RenewalPipeline from '../../components/admin/customers/analytics/RenewalPipeline'
import SalesPersonTable from '../../components/admin/customers/analytics/SalesPersonTable'
import ContractTypeBreakdown from '../../components/admin/customers/analytics/ContractTypeBreakdown'
import ProductOccurrenceTable from '../../components/admin/customers/analytics/ProductOccurrenceTable'
import ArrDistributionHistogram from '../../components/admin/customers/analytics/ArrDistributionHistogram'

import { useContractInsights, fetchCustomersForService } from '../../hooks/useContractInsights'
import { useConsolidatedCustomers } from '../../hooks/useConsolidatedCustomers'

// ---- Tab config -----------------------------------------------------------

const TABS = [
  { id: 'overview', label: 'Översikt' },
  { id: 'salespeople', label: 'Säljare' },
  { id: 'contracts', label: 'Avtalsvärden' },
  { id: 'churn', label: 'Status & Churn' },
] as const
type TabId = typeof TABS[number]['id']

// ---- Donut chart helper ---------------------------------------------------

const DONUT_COLORS = ['#20c58f', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs shadow-xl">
      <p className="text-slate-200 font-medium">{d.name}</p>
      <p className="text-white font-semibold">{d.value} st</p>
    </div>
  )
}

const GrowthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {Number(p.value).toLocaleString('sv-SE')} kr
        </p>
      ))}
    </div>
  )
}

// ---- Main component -------------------------------------------------------

export default function CustomerAnalytics() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('overview')
  const [drillPanel, setDrillPanel] = useState<{
    title: string
    subtitle: string
    customers: DrillCustomer[]
    loading: boolean
  } | null>(null)

  const { loading, error, kpiSummary, growthByMonth, byContractType, bySalesPerson,
    byBillingFrequency, renewalPipeline, topProducts, contractLengthDistribution,
    continuingContracts, allCustomers } = useContractInsights()

  const { consolidatedCustomers, activeConsolidatedCustomers, analytics: consolidatedAnalytics } = useConsolidatedCustomers()

  const terminatedCustomers = useMemo(
    () => consolidatedCustomers.filter(c => c.isTerminated),
    [consolidatedCustomers]
  )

  // Lookup: customer_id → customer data (för drill-down enrichment)
  const customerLookup = useMemo(() => {
    const map = new Map<string, any>()
    allCustomers.forEach((c: any) => map.set(c.id, c))
    return map
  }, [allCustomers])

  const navigateToCustomer = (id: string) => {
    navigate('/admin/befintliga-kunder', { state: { filter: { id } } })
  }

  // Drill-down: vilka kunder har en viss tjänst i avtalet
  const handleServiceClick = async (serviceName: string, occurrences: number, totalValue: number) => {
    setDrillPanel({ title: serviceName, subtitle: `${occurrences} avtal · ${totalValue.toLocaleString('sv-SE')} kr`, customers: [], loading: true })
    const items = await fetchCustomersForService(serviceName)
    // Aggregera per kund (en kund kan ha flera rader)
    const perCustomer = new Map<string, { totalPrice: number; qty: number }>()
    items.forEach(item => {
      if (!item.customerId) return
      if (!perCustomer.has(item.customerId)) perCustomer.set(item.customerId, { totalPrice: 0, qty: 0 })
      perCustomer.get(item.customerId)!.totalPrice += item.totalPrice
      perCustomer.get(item.customerId)!.qty += item.quantity
    })
    const customers: DrillCustomer[] = Array.from(perCustomer.entries()).map(([customerId, v]) => {
      const c = customerLookup.get(customerId)
      return {
        id: customerId,
        company_name: c?.company_name ?? 'Okänd kund',
        annual_value: c?.annual_value ?? null,
        sales_person: c?.sales_person ?? null,
        contract_end_date: c?.contract_end_date ?? null,
        extra: v.qty > 1 ? `${v.qty} st · ${v.totalPrice.toLocaleString('sv-SE')} kr` : `${v.totalPrice.toLocaleString('sv-SE')} kr`,
      }
    })
    setDrillPanel({ title: serviceName, subtitle: `${customers.length} kunder · ${totalValue.toLocaleString('sv-SE')} kr`, customers, loading: false })
  }

  // Drill-down: vilka kunder tillhör en viss avtalstyp
  const handleTypeClick = (type: string, count: number, totalArr: number) => {
    const customers: DrillCustomer[] = allCustomers
      .filter((c: any) => (c.contract_type || 'Okänd') === type && !c.terminated_at && c.is_active !== false)
      .map((c: any) => ({
        id: c.id,
        company_name: c.company_name,
        annual_value: c.annual_value ?? null,
        sales_person: c.sales_person ?? null,
        contract_end_date: c.contract_end_date ?? null,
      }))
    setDrillPanel({
      title: type,
      subtitle: `${customers.length} aktiva avtal · ${totalArr.toLocaleString('sv-SE')} kr ARR`,
      customers,
      loading: false,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-red-400">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  // Sparkline data for KPI cards (monthly ARR trend last 12m)
  const arrTrend = growthByMonth.slice(-12).map(m => ({ value: m.newArr }))

  // Contract length donut
  const lengthDonut = contractLengthDistribution.map((d, i) => ({
    name: d.label, value: d.count, fill: DONUT_COLORS[i % DONUT_COLORS.length]
  }))

  // Billing frequency donut
  const freqDonut = byBillingFrequency.map((d, i) => ({
    name: d.freq, value: d.count, fill: DONUT_COLORS[i % DONUT_COLORS.length]
  }))

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Drill-down panel */}
      <InsightDrillPanel
        isOpen={drillPanel !== null}
        onClose={() => setDrillPanel(null)}
        title={drillPanel?.title ?? ''}
        subtitle={drillPanel?.subtitle ?? ''}
        customers={drillPanel?.customers ?? []}
        loading={drillPanel?.loading ?? false}
        onCustomerClick={id => { setDrillPanel(null); navigateToCustomer(id) }}
      />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Affärsinsikt</h1>
        <p className="text-sm text-slate-400 mt-0.5">Portföljanalys & försäljningsintelligens</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              tab === t.id
                ? 'bg-[#20c58f] text-slate-900'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/* FLIK 1: ÖVERSIKT                                                  */}
      {/* ================================================================ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <EnhancedKpiCard
              title="Total ARR"
              value={kpiSummary.totalArr}
              icon={DollarSign}
              prefix=""
              suffix=" kr"
              trendData={arrTrend}
              delay={0}
            />
            <EnhancedKpiCard
              title="Snitt avtalsvärde"
              value={kpiSummary.avgArr}
              icon={BarChart3}
              suffix=" kr"
              delay={0.05}
            />
            <EnhancedKpiCard
              title="Aktiva avtal"
              value={kpiSummary.activeCount}
              icon={Briefcase}
              isNumeric
              delay={0.1}
            />
            <EnhancedKpiCard
              title="Förnyelse 12 mån"
              value={kpiSummary.renewalArr12m}
              icon={RefreshCw}
              suffix=" kr"
              trend={kpiSummary.renewalArr12m > 0 ? 'neutral' : undefined}
              delay={0.15}
            />
            <EnhancedKpiCard
              title="Churn 12 mån"
              value={kpiSummary.churnArr12m}
              icon={TrendingDown}
              suffix=" kr"
              trend={kpiSummary.churnArr12m > 0 ? 'down' : 'neutral'}
              delay={0.2}
            />
          </div>

          {/* ARR growth + contract length distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">ARR-tillväxt per månad</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={growthByMonth} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={m => m.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<GrowthTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="newArr" name="Ny ARR" fill="#20c58f" opacity={0.8} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="churnedArr" name="Churnad ARR" fill="#ef4444" opacity={0.6} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Avtalslängdsfördelning</h3>
              {lengthDonut.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={lengthDonut}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {lengthDonut.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {lengthDonut.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                          <span className="text-slate-400">{d.name}</span>
                        </div>
                        <span className="text-slate-300 font-medium">{d.value} st</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-slate-600 text-sm text-center py-8">Ingen data</p>
              )}
            </div>
          </div>

          {/* Renewal pipeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Förnyelsepipeline</h3>
            <p className="text-xs text-slate-500 mb-4">Avtal som löper ut inom 12 månader</p>
            <RenewalPipeline
              pipeline={renewalPipeline}
              onCustomerClick={navigateToCustomer}
            />
          </div>

          {/* Gantt timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Kontraktstidslinje</h3>
            <ContractTimelineGantt
              customers={activeConsolidatedCustomers}
              onCustomerClick={name =>
                navigate('/admin/befintliga-kunder', { state: { filter: { search: name } } })
              }
            />
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* FLIK 2: SÄLJARE                                                   */}
      {/* ================================================================ */}
      {tab === 'salespeople' && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EnhancedKpiCard
              title="Total portfölj-ARR"
              value={kpiSummary.totalArr}
              icon={DollarSign}
              suffix=" kr"
              delay={0}
            />
            <EnhancedKpiCard
              title="Snitt ARR/avtal"
              value={kpiSummary.avgArr}
              icon={BarChart3}
              suffix=" kr"
              delay={0.05}
            />
            {kpiSummary.avgMargin !== null ? (
              <EnhancedKpiCard
                title={`Snitt marginal (${kpiSummary.marginSampleSize} kunder)`}
                value={kpiSummary.avgMargin}
                icon={TrendingUp}
                suffix="%"
                trend={kpiSummary.avgMargin >= 40 ? 'up' : kpiSummary.avgMargin >= 20 ? 'neutral' : 'down'}
                delay={0.1}
              />
            ) : (
              <EnhancedKpiCard
                title="Marginal"
                value="–"
                icon={TrendingUp}
                isNumeric={false}
                delay={0.1}
              />
            )}
          </div>

          {/* Sales person table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Säljare — portföljöversikt</h3>
            <SalesPersonTable data={bySalesPerson} />
          </div>

          {/* ARR per salesperson bar chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">ARR per säljare</h3>
            <ResponsiveContainer width="100%" height={Math.max(160, bySalesPerson.length * 52)}>
              <BarChart
                data={bySalesPerson.map(s => ({ name: s.name, arr: s.totalArr }))}
                layout="vertical"
                margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: any) => [`${Number(v).toLocaleString('sv-SE')} kr`, 'ARR']}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="arr" fill="#20c58f" radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* FLIK 3: AVTALSVÄRDEN & INNEHÅLL                                   */}
      {/* ================================================================ */}
      {tab === 'contracts' && (
        <div className="space-y-6">
          {/* Contract type breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Avtalstyper</h3>
            <p className="text-xs text-slate-500 mb-4">Fördelning av ARR och marginal per avtalstyp</p>
            <ContractTypeBreakdown data={byContractType} onTypeClick={handleTypeClick} />
          </div>

          {/* Billing frequency + ARR distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Faktureringsfrekvens</h3>
              {freqDonut.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={freqDonut}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {freqDonut.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {freqDonut.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                          <span className="text-slate-400">{d.name}</span>
                        </div>
                        <span className="text-slate-300 font-medium">{d.value} st</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-slate-600 text-sm text-center py-8">Ingen data</p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">ARR-distribution</h3>
              <ArrDistributionHistogram
                customers={allCustomers.filter((c: any) => !c.terminated_at && c.is_active !== false)}
              />
            </div>
          </div>

          {/* Top products */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Produkter i avtal (top 15)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Faktiska tjänster i aktiva avtal</p>
              </div>
              <Package className="w-4 h-4 text-slate-600" />
            </div>
            {topProducts.length > 0 ? (
              <ProductOccurrenceTable data={topProducts} onServiceClick={handleServiceClick} />
            ) : (
              <p className="text-slate-600 text-sm text-center py-8">Inga produkter hittades i avtalsdatan</p>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* FLIK 4: KUNDSTATUS & CHURN                                        */}
      {/* ================================================================ */}
      {tab === 'churn' && (
        <div className="space-y-6">
          {/* Continuing contracts warning */}
          {continuingContracts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-amber-300 mb-1">
                    {continuingContracts.length} avtal har passerat slutdatum utan uppsägning
                  </h3>
                  <p className="text-xs text-amber-400/70 mb-3">
                    Dessa kunder är kandidater för förnyelsedialog.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {continuingContracts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => navigateToCustomer(c.id)}
                        className="flex items-center justify-between text-xs bg-slate-900/50 hover:bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-slate-200 truncate">{c.company_name}</p>
                          <p className="text-slate-500">{c.sales_person || 'Okänd säljare'}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-amber-400">
                            {format(new Date(c.contract_end_date), 'd MMM yyyy', { locale: sv })}
                          </p>
                          {c.annual_value && (
                            <p className="text-slate-400">{c.annual_value.toLocaleString('sv-SE')} kr</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Churn analysis (reused) */}
          <ChurnAnalysisSection
            terminatedCustomers={terminatedCustomers}
            onCustomerClick={name =>
              navigate('/admin/befintliga-kunder', { state: { filter: { search: name } } })
            }
          />

          {/* Segmentation scatter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-slate-200">Kundsegmentering</h3>
              <div className="flex items-center gap-1 text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
                <Info className="w-3 h-3" />
                Health score är estimerad
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">Avtalsvärde vs estimerat health score per kund</p>
            <CustomerSegmentationScatter
              customers={activeConsolidatedCustomers}
              onCustomerClick={name =>
                navigate('/admin/befintliga-kunder', { state: { filter: { search: name } } })
              }
            />
          </div>

          {/* Portal adoption */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Portalanvändning</h3>
            <PortalAdoptionChart
              stats={consolidatedAnalytics.portalAccessStats}
            />
          </div>
        </div>
      )}
    </div>
  )
}

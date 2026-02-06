// src/pages/admin/CustomerAnalytics.tsx - Dedikerad Analytics-sida för Success Management

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, DollarSign, Target, ArrowLeft, BarChart3, Users
} from 'lucide-react'
import Card from '../../components/ui/Card'
import { PageHeader } from '../../components/shared'
import ARRForecastChart from '../../components/admin/customers/ARRForecastChart'
import RevenueBreakdownChart from '../../components/admin/customers/analytics/RevenueBreakdownChart'
import HealthScoreDistributionChart from '../../components/admin/customers/analytics/HealthScoreDistributionChart'
import PortalAdoptionChart from '../../components/admin/customers/analytics/PortalAdoptionChart'
import CustomerSegmentationScatter from '../../components/admin/customers/analytics/CustomerSegmentationScatter'
import ContractTimelineGantt from '../../components/admin/customers/analytics/ContractTimelineGantt'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useConsolidatedCustomers } from '../../hooks/useConsolidatedCustomers'
import { useCustomerAnalytics } from '../../hooks/useCustomerAnalytics'
import { formatCurrency } from '../../utils/customerMetrics'

export default function CustomerAnalytics() {
  const navigate = useNavigate()
  const { consolidatedCustomers, consolidatedAnalytics, loading } = useConsolidatedCustomers()
  const { customers: legacyCustomers } = useCustomerAnalytics()

  // KPI-data (de som flyttades från huvudsidan)
  const kpis = useMemo(() => ({
    renewalValue90Days: consolidatedAnalytics.renewalValue90Days,
    averageContractValue: consolidatedAnalytics.averageContractValue,
    totalOrganizations: consolidatedAnalytics.totalOrganizations,
    multisiteOrganizations: consolidatedAnalytics.multisiteOrganizations,
    singleCustomers: consolidatedAnalytics.singleCustomers,
    totalSites: consolidatedAnalytics.totalSites,
  }), [consolidatedAnalytics])

  const navigateWithFilter = (filter: Record<string, string>) => {
    navigate('/admin/customers', { state: { filter } })
  }

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Customer Analytics"
          subtitle="Djupgående analyser av kundportföljen"
          icon={BarChart3}
          iconColor="text-purple-500"
          showBackButton={true}
          backPath="/admin/customers"
        />
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Customer Analytics"
        subtitle="Djupgående analyser av kundportföljen"
        icon={BarChart3}
        iconColor="text-purple-500"
        showBackButton={true}
        backPath="/admin/customers"
        rightContent={
          <button
            onClick={() => navigate('/admin/customers')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:text-white hover:border-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till kundlista
          </button>
        }
      />

      {/* Flyttade KPI-kort: Förnyelsevärde + Genomsnittsvärde + Organisationsöversikt */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Förnyelsevärde (90 dagar)</p>
            <TrendingUp className="w-6 h-6 text-purple-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {formatCurrency(kpis.renewalValue90Days)}
          </p>
          <p className="text-xs text-slate-400">
            Avtal som förfaller inom 90 dagar
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Genomsnittligt Avtalsvärde</p>
            <Target className="w-6 h-6 text-cyan-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {formatCurrency(kpis.averageContractValue)}
          </p>
          <p className="text-xs text-slate-400">
            Per organisation
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Organisationer</p>
            <Users className="w-6 h-6 text-blue-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {kpis.totalOrganizations}
          </p>
          <p className="text-xs text-slate-400">
            {kpis.multisiteOrganizations} multisite · {kpis.singleCustomers} enkelkunder
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Totalt Enheter</p>
            <DollarSign className="w-6 h-6 text-green-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {kpis.totalSites}
          </p>
          <p className="text-xs text-slate-400">
            Enheter under förvaltning
          </p>
        </Card>
      </div>

      {/* ARR Forecast - Flyttad från sidebar */}
      <Card className="p-6">
        <ARRForecastChart customers={legacyCustomers || []} />
      </Card>

      {/* 2x2 Grid med diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdownChart
          customers={consolidatedCustomers}
          onSegmentClick={(type) => navigateWithFilter({ revenueType: type })}
        />
        <HealthScoreDistributionChart
          customers={consolidatedCustomers}
          onBarClick={(level) => navigateWithFilter({ healthFilter: level })}
        />
        <PortalAdoptionChart
          stats={consolidatedAnalytics.portalAccessStats}
          onSegmentClick={(access) => navigateWithFilter({ portalFilter: access })}
        />
      </div>

      {/* Kontrakts-tidslinje — full bredd */}
      <ContractTimelineGantt
        customers={consolidatedCustomers}
        onCustomerClick={(name) => navigateWithFilter({ search: name })}
      />

      {/* Kundsegmentering scatter chart — full bredd */}
      <CustomerSegmentationScatter
        customers={consolidatedCustomers}
        onCustomerClick={(name) => navigateWithFilter({ search: name })}
      />
    </div>
  )
}

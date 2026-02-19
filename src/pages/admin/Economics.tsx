import React from 'react'
import { EconomicsPeriodProvider } from '../../contexts/EconomicsPeriodContext'

import EconomicsHeader from '../../components/admin/economics/EconomicsHeader'
import KpiCards from '../../components/admin/economics/KpiCards'
import RevenueHealthBar from '../../components/admin/economics/RevenueHealthBar'
import UnifiedRevenueAnalysis from '../../components/admin/economics/UnifiedRevenueAnalysis'
import ArticleRevenueBreakdown from '../../components/admin/economics/ArticleRevenueBreakdown'
import PriceListUtilization from '../../components/admin/economics/PriceListUtilization'
import PestProfitability from '../../components/admin/economics/PestProfitability'
import TechnicianRevenueSection from '../../components/admin/economics/TechnicianRevenueSection'
import ChurnRiskSection from '../../components/admin/economics/ChurnRiskSection'
import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'

const Economics: React.FC = () => {
  return (
    <EconomicsPeriodProvider>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* 1. Page Header with global period selector */}
        <EconomicsHeader />

        {/* 2. Hero KPI Cards */}
        <KpiCards />

        {/* 3. Revenue Health Bar - Intäktsmix */}
        <RevenueHealthBar />

        {/* 4. Unified Revenue Analysis (tabbed) */}
        <UnifiedRevenueAnalysis />

        {/* 5. Article Revenue (2/3) + Price List Utilization (1/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <ArticleRevenueBreakdown />
          </div>
          <div className="lg:col-span-1">
            <PriceListUtilization />
          </div>
        </div>

        {/* 6. Pest Profitability (1/2) + Technician Revenue (1/2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <PestProfitability />
          <TechnicianRevenueSection />
        </div>

        {/* 7. Churn Risk (1/2) + Marketing ROI (1/2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <ChurnRiskSection />
          <MarketingSpendManager />
        </div>

      </div>
    </EconomicsPeriodProvider>
  )
}

export default Economics

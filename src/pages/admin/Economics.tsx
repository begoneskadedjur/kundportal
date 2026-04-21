import React from 'react'
import { EconomicsPeriodProvider } from '../../contexts/EconomicsPeriodContext'

import EconomicsHeader from '../../components/admin/economics/EconomicsHeader'

// Rad 1 — Pulsen
import HeroMetrics from '../../components/admin/economics/HeroMetrics'
import RevenuePulseChart from '../../components/admin/economics/RevenuePulseChart'

// Rad 2 — Marginal & lönsamhet
import MarginTrendChart from '../../components/admin/economics/MarginTrendChart'
import ServiceMarginRanking from '../../components/admin/economics/ServiceMarginRanking'

// Rad 3 — Fakturapipeline
import InvoicePipelineFunnel from '../../components/admin/economics/InvoicePipelineFunnel'
import OverdueAgingChart from '../../components/admin/economics/OverdueAgingChart'
import PaymentVelocityHistogram from '../../components/admin/economics/PaymentVelocityHistogram'

// Rad 4 — Kundportfölj
import CustomerPortfolioTreemap from '../../components/admin/economics/CustomerPortfolioTreemap'
import ChurnRiskSection from '../../components/admin/economics/ChurnRiskSection'
import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'

// Rad 5 — Tekniker & operationell effektivitet
import TechnicianMarginScatter from '../../components/admin/economics/TechnicianMarginScatter'
import TechnicianCommissionTrend from '../../components/admin/economics/TechnicianCommissionTrend'
import CaseThroughputChart from '../../components/admin/economics/CaseThroughputChart'

const Economics: React.FC = () => {
  return (
    <EconomicsPeriodProvider>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">

        <EconomicsHeader />

        {/* Rad 1 — Pulsen */}
        <section className="space-y-4">
          <HeroMetrics />
          <RevenuePulseChart />
        </section>

        {/* Rad 2 — Marginal & lönsamhet */}
        <section className="space-y-4">
          <MarginTrendChart />
          <ServiceMarginRanking />
        </section>

        {/* Rad 3 — Fakturapipeline */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InvoicePipelineFunnel />
          <OverdueAgingChart />
          <div className="lg:col-span-2">
            <PaymentVelocityHistogram />
          </div>
        </section>

        {/* Rad 4 — Kundportfölj */}
        <section className="space-y-4">
          <CustomerPortfolioTreemap />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChurnRiskSection />
            <MarketingSpendManager />
          </div>
        </section>

        {/* Rad 5 — Tekniker & operationell effektivitet */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TechnicianMarginScatter />
            <CaseThroughputChart />
          </div>
          <TechnicianCommissionTrend />
        </section>

      </div>
    </EconomicsPeriodProvider>
  )
}

export default Economics

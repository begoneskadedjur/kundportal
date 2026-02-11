// 📁 src/pages/admin/Economics.tsx
import React from 'react'
import { RefreshCw, DollarSign, BarChart3, TrendingUp, Activity } from 'lucide-react'
import Button from '../../components/ui/Button'

// Importera komponenter som fungerar
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'
import EconomicInsightsChart from '../../components/admin/economics/EconomicInsightsChart'
import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'
import PerformanceTestReport from '../../components/admin/economics/PerformanceTestReport'

const Economics: React.FC = () => {
  const handleRefresh = async () => {
    window.location.reload()
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Inline header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ekonomisk Översikt</h1>
          <p className="text-sm text-slate-400 mt-1">
            Komplett analys av intäkter, kostnader och tillväxt
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Uppdatera
        </Button>
      </div>

      {/* 1. KPI Panel */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-yellow-400" />
          Nyckeltal
        </h3>
        <KpiCards />
      </section>

      {/* 2. FULLBREDD: Månadsvis Intäktsflöde */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Månadsvis Intäktsflöde
          <span className="ml-2 text-xs text-slate-400 font-normal">Avtalskunder + Merförsäljning</span>
        </h3>
        <MonthlyRevenueChart />
      </section>

      {/* 3. FULLBREDD: Intäkter Engångsjobb */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Intäkter Engångsjobb
          <span className="ml-2 text-xs text-slate-400 font-normal">Privatpersoner + Företag</span>
        </h3>
        <BeGoneMonthlyStatsChart />
      </section>

      {/* 4. EKONOMISKA INSIGHTS */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            Ekonomiska Insights
            <span className="ml-2 text-xs text-slate-400 font-normal">Topp ärenden & skadedjur</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Identifiera högsta ärenden och mest lönsamma skadedjur
          </p>
        </div>
        <EconomicInsightsChart />
      </section>

      {/* 5. MARKNADSFÖRINGSKOSTNADER */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-purple-400" />
            Marknadsföringskostnader
            <span className="ml-2 text-xs text-slate-400 font-normal">Monthly Marketing Spend Management</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Hantera och spåra marknadsföringskostnader per månad
          </p>
        </div>
        <MarketingSpendManager />
      </section>

      {/* 6. PERFORMANCE TEST RAPPORT */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            Performance Test Rapport
            <span className="ml-2 text-xs text-slate-400 font-normal">RLS-Optimering Validering</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Testa och validera prestanda-förbättringar efter RLS-optimeringar
          </p>
        </div>
        <PerformanceTestReport />
      </section>

    </div>
  )
}

export default Economics

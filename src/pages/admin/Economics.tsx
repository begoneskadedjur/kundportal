// 📁 src/pages/admin/Economics.tsx - UTAN TEKNIKER-SEKTION
import React from 'react'
import { RefreshCw, DollarSign, BarChart3, TrendingUp } from 'lucide-react'
import Button from '../../components/ui/Button'
import { PageHeader } from '../../components/shared'

// Importera komponenter som fungerar
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'
import EconomicInsightsChart from '../../components/admin/economics/EconomicInsightsChart'

const Economics: React.FC = () => {
  const handleRefresh = async () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        
        <PageHeader 
          title="Ekonomisk Översikt"
          showBackButton={true}
          backPath="/admin/dashboard"
        />

        {/* Controls */}
        <div className="mb-8 flex items-center justify-between">
          <p className="text-slate-400">
            Komplett analys av intäkter, kostnader och tillväxt
            <span className="ml-2 text-green-400">• Nu med moderna insights</span>
          </p>
          <Button 
            onClick={handleRefresh} 
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Uppdatera
          </Button>
        </div>

        <div className="space-y-8">
          
          {/* 1. KPI Panel */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              Nyckeltal
            </h3>
            <KpiCards />
          </section>

          {/* Separator */}
          <div className="border-t border-slate-700"></div>

          {/* 2. FULLBREDD: Månadsvis Intäktsflöde */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Månadsvis Intäktsflöde
              <span className="ml-2 text-sm text-slate-400">Avtalskunder + Merförsäljning</span>
            </h3>
            <MonthlyRevenueChart />
          </section>

          {/* Separator */}
          <div className="border-t border-slate-700"></div>

          {/* 3. FULLBREDD: Intäkter Engångsjobb */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Intäkter Engångsjobb 
              <span className="ml-2 text-sm text-slate-400">Privatpersoner + Företag</span>
            </h3>
            <BeGoneMonthlyStatsChart />
          </section>

          {/* Separator */}
          <div className="border-t border-slate-700"></div>

          {/* 4. EKONOMISKA INSIGHTS */}
          <section>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                Ekonomiska Insights
                <span className="ml-2 text-sm text-slate-400">Topp ärenden & skadedjur</span>
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Identifiera högsta ärenden och mest lönsamma skadedjur
              </p>
            </div>
            <EconomicInsightsChart />
          </section>

        </div>
      </div>
    </div>
  )
}

export default Economics
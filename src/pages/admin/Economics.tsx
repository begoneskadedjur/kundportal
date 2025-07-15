// 📁 src/pages/admin/Economics.tsx - UTAN TEKNIKER-SEKTION
import React from 'react'
import { ArrowLeft, RefreshCw, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'

// Importera komponenter som fungerar
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'
import EconomicInsightsChart from '../../components/admin/economics/EconomicInsightsChart'

const Economics: React.FC = () => {
  const navigate = useNavigate()

  const handleRefresh = async () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Ekonomisk Översikt</h1>
                <p className="text-slate-400 text-sm">
                  Komplett analys av intäkter, kostnader och tillväxt
                  <span className="ml-2 text-green-400">• Nu med moderna insights</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleRefresh} 
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Uppdatera
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          
          {/* 1. KPI Panel */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Nyckeltal</h2>
            <KpiCards />
          </section>

          {/* 2. FULLBREDD: Månadsvis Intäktsflöde */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              Månadsvis Intäktsflöde
              <span className="ml-2 text-sm text-slate-400">Avtalskunder + Merförsäljning</span>
            </h2>
            <MonthlyRevenueChart />
          </section>

          {/* 3. FULLBREDD: Intäkter Engångsjobb */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              Intäkter Engångsjobb 
              <span className="ml-2 text-sm text-slate-400">Privatpersoner + Företag</span>
            </h2>
            <BeGoneMonthlyStatsChart />
          </section>

          {/* 4. EKONOMISKA INSIGHTS */}
          <section>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  Ekonomiska Insights
                  <span className="ml-2 text-sm text-slate-400">Topp ärenden & skadedjur</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Identifiera högsta ärenden och mest lönsamma skadedjur
                </p>
              </div>
            </div>
            <EconomicInsightsChart />
          </section>

        </div>
      </main>
    </div>
  )
}

export default Economics
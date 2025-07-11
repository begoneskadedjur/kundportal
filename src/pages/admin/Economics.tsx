// 📁 src/pages/admin/Economics.tsx - UPPDATERAD med BeGone ärendestatistik
import React from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { useEconomicsDashboard } from '../../hooks/useEconomicsDashboard'

// Befintliga komponenter
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import ExpiringContractsChart from '../../components/admin/economics/ExpiringContractsChart'
import MarketingRoiChart from '../../components/admin/economics/MarketingRoiChart'
import TechnicianRevenueChart from '../../components/admin/economics/TechnicianRevenueChart'
import AccountManagerRevenueChart from '../../components/admin/economics/AccountManagerRevenueChart'
import CaseEconomyChart from '../../components/admin/economics/CaseEconomyChart'
import CustomerContractTable from '../../components/admin/economics/CustomerContractTable'
import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'

// 🆕 Ny BeGone komponent
import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'

const Economics: React.FC = () => {
  const navigate = useNavigate()
  const { loading, error, refetch } = useEconomicsDashboard()

  const handleRefresh = async () => {
    await refetch()
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
                  <span className="ml-2 text-orange-400">• Nu med BeGone ärendestatistik</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

          {/* 2. Intäktsflöde - Utökad med BeGone */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Intäktsanalys</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <MonthlyRevenueChart />
              {/* 🆕 Ny BeGone ärendestatistik */}
              <BeGoneMonthlyStatsChart />
            </div>
          </section>

          {/* 3. Ärendeekonomi */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Ärendeekonomi</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CaseEconomyChart />
              <TechnicianRevenueChart />
            </div>
          </section>

          {/* 4. Marknadsföring & ROI */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Marknadsföring & ROI</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <MarketingRoiChart />
              <AccountManagerRevenueChart />
            </div>
          </section>

          {/* 5. Avtalshantering */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Avtalshantering</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ExpiringContractsChart />
              <div className="space-y-6">
                {/* Marknadsföring utgifter */}
                <MarketingSpendManager />
              </div>
            </div>
          </section>

          {/* 6. Detaljerad kundöversikt */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Kundavtal</h2>
            <CustomerContractTable />
          </section>

        </div>
      </main>
    </div>
  )
}

export default Economics
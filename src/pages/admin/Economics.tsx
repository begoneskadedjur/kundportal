// 📁 src/pages/admin/Economics.tsx
import React from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { useEconomicsDashboard } from '../../hooks/useEconomicsDashboard'
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import ExpiringContractsChart from '../../components/admin/economics/ExpiringContractsChart'
import MarketingRoiChart from '../../components/admin/economics/MarketingRoiChart'
import TechnicianRevenueChart from '../../components/admin/economics/TechnicianRevenueChart'
import AccountManagerRevenueChart from '../../components/admin/economics/AccountManagerRevenueChart'
import CaseEconomyChart from '../../components/admin/economics/CaseEconomyChart'
import CustomerContractTable from '../../components/admin/economics/CustomerContractTable'

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
                <p className="text-slate-400 text-sm">Komplett analys av intäkter, kostnader och tillväxt</p>
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

          {/* 2. Intäktsflöde */}
          <section>
            <MonthlyRevenueChart />
          </section>

          {/* Grid för 3+4: Avtalsstatus + ROI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 3. Avtalsstatus */}
            <section>
              <ExpiringContractsChart />
            </section>

            {/* 4. ROI */}
            <section>
              <MarketingRoiChart />
            </section>
          </div>

          {/* Grid för 5+6: Tekniker + Account Managers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 5. Teknikerintäkter */}
            <section>
              <TechnicianRevenueChart />
            </section>

            {/* 6. Account Manager-intäkter */}
            <section>
              <AccountManagerRevenueChart />
            </section>
          </div>

          {/* 7. Ärendeekonomi */}
          <section>
            <CaseEconomyChart />
          </section>

          {/* 8. Fullständig avtalslista */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Detaljerad Avtalslista</h2>
            <CustomerContractTable />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center gap-4">
              <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
              <div className="h-1 w-1 bg-slate-600 rounded-full"></div>
              <span>Realtidsdata från Supabase</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>System operationellt</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Economics
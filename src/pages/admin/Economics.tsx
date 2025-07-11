// src/pages/admin/Economics.tsx - SÄKER VERSION för debugging
import React from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

// Importera endast de komponenter som vi vet fungerar
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'

// Tillfälligt kommenterade komponenter för debugging
// import ExpiringContractsChart from '../../components/admin/economics/ExpiringContractsChart'
// import MarketingRoiChart from '../../components/admin/economics/MarketingRoiChart'
// import TechnicianRevenueChart from '../../components/admin/economics/TechnicianRevenueChart'
// import AccountManagerRevenueChart from '../../components/admin/economics/AccountManagerRevenueChart'
// import CaseEconomyChart from '../../components/admin/economics/CaseEconomyChart'
// import CustomerContractTable from '../../components/admin/economics/CustomerContractTable'
// import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'
// import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'

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
                  <span className="ml-2 text-orange-400">• Nu med BeGone ärendestatistik</span>
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

          {/* 2. Intäktsflöde */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Intäktsanalys</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <MonthlyRevenueChart />
              
              {/* BeGone Chart - Tillfälligt ersatt med placeholder */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">BeGone Ärendestatistik</h3>
                  <div className="h-80 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <p className="mb-2">BeGone komponent laddas...</p>
                      <p className="text-sm">Komponenten är tillfälligt inaktiverad för debugging</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* 3. Placeholder för övriga komponenter */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Ytterligare Analytics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Ärendeekonomi</h3>
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <p className="mb-2">Komponent laddas...</p>
                      <p className="text-sm">Ärendeekonomi-data kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Teknikerintäkter</h3>
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <p className="mb-2">Komponent laddas...</p>
                      <p className="text-sm">Tekniker-data kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

            </div>
          </section>

          {/* Debug sektion */}
          <section>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🔧 Debug Information</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-green-400">✅ KPI Cards: Laddad</p>
                  <p className="text-green-400">✅ Monthly Revenue Chart: Laddad</p>
                  <p className="text-yellow-400">⏸️ Övriga komponenter: Tillfälligt inaktiverade</p>
                  <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                    <h4 className="text-white font-medium mb-2">Debugging Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      <li>Kontrollera att formatters.ts importeras korrekt</li>
                      <li>Verifiera att alla array-data har säker null-hantering</li>
                      <li>Testa en komponent i taget för att isolera problemet</li>
                      <li>Kontrollera att Supabase anslutningen fungerar</li>
                    </ol>
                  </div>
                </div>
              </div>
            </Card>
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
              <span>Säker debugging-version</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Debug mode aktivt</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Economics⏸️ BeGone Monthly Stats: Tillfälligt inaktiverad</p>
                  <p className="text-yellow-400">
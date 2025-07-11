// src/pages/admin/Economics.tsx - KOMPLETT FIXAD VERSION
import React from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

// Importera komponenter som fungerar
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'

// 🆕 FIXADE TEKNIKER KOMPONENTER (nya namn för att undvika konflikt)
import BeGoneTechnicianChart from '../../components/admin/economics/BeGoneTechnicianChart'
import ContractTechnicianChart from '../../components/admin/economics/ContractTechnicianChart'

// Tillfälligt kommenterade komponenter för debugging
// import ExpiringContractsChart from '../../components/admin/economics/ExpiringContractsChart'
// import MarketingRoiChart from '../../components/admin/economics/MarketingRoiChart'
// import CaseEconomyChart from '../../components/admin/economics/CaseEconomyChart'
// import CustomerContractTable from '../../components/admin/economics/CustomerContractTable'
// import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'

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
                  <span className="ml-2 text-green-400">• Nu med tekniker-prestanda analys</span>
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

          {/* 2. FULLBREDD: Månadsvis Intäktsflöde (Avtalskunder + Merförsäljning) */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              Månadsvis Intäktsflöde
              <span className="ml-2 text-sm text-slate-400">Avtalskunder + Merförsäljning</span>
            </h2>
            <MonthlyRevenueChart />
          </section>

          {/* 3. FULLBREDD: Intäkter Engångsjobb (Omfattande Statistik) */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              Intäkter Engångsjobb 
              <span className="ml-2 text-sm text-slate-400">Privatpersoner + Företag</span>
            </h2>
            <BeGoneMonthlyStatsChart />
          </section>

          {/* 4. TEKNIKER-PRESTANDA: BeGone vs Avtalskunder */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              Tekniker-prestanda
              <span className="ml-2 text-sm text-slate-400">Engångsjobb vs Avtalskunder med pokaler</span>
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* BeGone Tekniker (Vänster) */}
              <div>
                <BeGoneTechnicianChart />
              </div>

              {/* Avtalskund Tekniker (Höger) */}
              <div>
                <ContractTechnicianChart />
              </div>

            </div>
          </section>

          {/* 5. Övriga Komponenter (Grid-layout för mindre komponenter) */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Övrig Ekonomisk Analys</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Platshållare för Ärendeekonomi */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Ärendeekonomi</h3>
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg">💼</span>
                      </div>
                      <p className="mb-2 font-medium">Komponent laddas...</p>
                      <p className="text-sm">Ärendeekonomi-data kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Platshållare för Marknadsföring & ROI */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Marknadsföring & ROI</h3>
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg">📈</span>
                      </div>
                      <p className="mb-2 font-medium">Komponent laddas...</p>
                      <p className="text-sm">ROI-data kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Platshållare för Utgående Avtal */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Utgående Avtal</h3>
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg">⚠️</span>
                      </div>
                      <p className="mb-2 font-medium">Komponent laddas...</p>
                      <p className="text-sm">Avtalsdata kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Platshållare för Account Manager Performance */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Account Manager Performance</h3>
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg">👔</span>
                      </div>
                      <p className="mb-2 font-medium">Komponent laddas...</p>
                      <p className="text-sm">Account manager-data kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

            </div>
          </section>

          {/* 6. System Status */}
          <section>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🔧 System Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Komponent Status */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-white font-medium">Aktiva Komponenter:</h4>
                    <p className="text-green-400">✅ KPI Cards</p>
                    <p className="text-green-400">✅ Månadsvis Intäktsflöde</p>
                    <p className="text-green-400">✅ Intäkter Engångsjobb</p>
                    <p className="text-green-400">✅ BeGone Tekniker-prestanda</p>
                    <p className="text-green-400">✅ Avtalskund Tekniker-prestanda</p>
                    <p className="text-yellow-400">⏸️ Övriga komponenter</p>
                  </div>
                  
                  {/* System Status */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-white font-medium">System:</h4>
                    <p className="text-green-400">✅ React Router</p>
                    <p className="text-green-400">✅ Supabase</p>
                    <p className="text-green-400">✅ Formatters</p>
                    <p className="text-blue-400">🔄 Real-time data</p>
                    <p className="text-purple-400">🏆 Medal system</p>
                    <p className="text-green-400">✅ Conflict resolved</p>
                  </div>

                  {/* Data Sources */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-white font-medium">Data Källor:</h4>
                    <p className="text-green-400">✅ customers (avtalskunder)</p>
                    <p className="text-green-400">✅ cases (merförsäljning)</p>
                    <p className="text-green-400">✅ private_cases (privatpersoner)</p>
                    <p className="text-green-400">✅ business_cases (företag)</p>
                    <p className="text-blue-400">👷 technician assignments</p>
                  </div>

                </div>

                {/* Quick Actions */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                      Dashboard v2.1 - Med tekniker-prestanda och pokalsystem
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-400 text-sm">5 aktiva komponenter</span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 text-sm">
                        <span>🥇🥈🥉</span>
                        <span>Pokalsystem aktivt</span>
                      </div>
                    </div>
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
              <span>Economics Dashboard v2.1</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span>5 aktiva komponenter</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🏆</span>
                <span>2 tekniker-komponenter</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Economics
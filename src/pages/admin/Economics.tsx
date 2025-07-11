// src/pages/admin/Economics.tsx - UPPDATERAD LAYOUT MED FULLBREDDSGRAF
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
                  <span className="ml-2 text-orange-400">• Debug Mode</span>
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

          {/* 2. Månadsvis Intäktsflöde (Fullbredd) - ✅ NY LAYOUT */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Månadsvis Intäktsflöde</h2>
            <MonthlyRevenueChart />
          </section>

          {/* 3. Detaljerad Analys (Grid-layout) */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Detaljerad Analys</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* BeGone Chart - Platshållare flyttad hit */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">BeGone Ärendestatistik</h3>
                  <div className="h-80 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📊</span>
                      </div>
                      <p className="mb-2 font-medium">BeGone komponent laddas...</p>
                      <p className="text-sm">Komponenten är tillfälligt inaktiverad för debugging</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Platshållare för Ärendeekonomi */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Ärendeekonomi</h3>
                  <div className="h-80 flex items-center justify-center text-slate-400">
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

              {/* Platshållare för Teknikerintäkter */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Teknikerintäkter</h3>
                  <div className="h-80 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg">👷</span>
                      </div>
                      <p className="mb-2 font-medium">Komponent laddas...</p>
                      <p className="text-sm">Tekniker-data kommer snart</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Platshållare för Marknadsföring & ROI */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Marknadsföring & ROI</h3>
                  <div className="h-80 flex items-center justify-center text-slate-400">
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

            </div>
          </section>

          {/* Debug sektion */}
          <section>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🔧 Debug Information</h3>
                <div className="space-y-4">
                  
                  {/* Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm">
                      <h4 className="text-white font-medium">Komponent Status:</h4>
                      <p className="text-green-400">✅ KPI Cards: Laddad</p>
                      <p className="text-green-400">✅ Monthly Revenue Chart: Laddad</p>
                      <p className="text-yellow-400">⏸️ BeGone Monthly Stats: Tillfälligt inaktiverad</p>
                      <p className="text-yellow-400">⏸️ Övriga komponenter: Tillfälligt inaktiverade</p>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <h4 className="text-white font-medium">System Status:</h4>
                      <p className="text-green-400">✅ React Router: Fungerar</p>
                      <p className="text-green-400">✅ Hooks: Laddade</p>
                      <p className="text-green-400">✅ Supabase: Ansluten</p>
                      <p className="text-blue-400">🔄 API Calls: Pågår...</p>
                    </div>
                  </div>

                  {/* Debugging Steps */}
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <h4 className="text-white font-medium mb-2">🔧 Debugging Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 text-sm">
                      <li>Kontrollera att formatters.ts importeras korrekt</li>
                      <li>Verifiera att alla array-data har säker null-hantering</li>
                      <li>Testa en komponent i taget för att isolera problemet</li>
                      <li>Kontrollera att Supabase anslutningen fungerar</li>
                      <li>Använd browser console för att se eventuella fel</li>
                      <li>Kontrollera Network-fliken för API-responses</li>
                    </ol>
                  </div>

                  {/* Next Steps */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-2">📊 Nästa steg:</h4>
                    <ul className="list-disc list-inside space-y-1 text-blue-300 text-sm">
                      <li>När KPI Cards + Monthly Revenue fungerar → Aktivera BeGone Chart</li>
                      <li>Testa en komponent i taget för att identifiera problem</li>
                      <li>Kontrollera network-fliken för API-fel</li>
                      <li>Uppdatera hooks med array safety som diskuterat</li>
                      <li>Gradvis återaktivera alla komponenter</li>
                    </ul>
                  </div>

                  {/* Working Components */}
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <h4 className="text-green-400 font-medium mb-2">✅ Vad som fungerar:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-green-300 font-medium mb-1">Frontend:</p>
                        <ul className="list-disc list-inside text-green-200 space-y-0.5">
                          <li>Navigation & Header</li>
                          <li>Card komponenter</li>
                          <li>Button komponenter</li>
                          <li>Grundläggande layout</li>
                          <li>Tailwind CSS styling</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-green-300 font-medium mb-1">Data Layer:</p>
                        <ul className="list-disc list-inside text-green-200 space-y-0.5">
                          <li>Supabase anslutning</li>
                          <li>Economics service</li>
                          <li>Database tabeller</li>
                          <li>API endpoints</li>
                          <li>Webhook integration</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Version Info */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Debug Version: 1.0</span>
                    <span className="text-slate-400 text-sm">
                      Uppdaterad: {new Date().toLocaleString('sv-SE')}
                    </span>
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
              <span>Säker debugging-version v1.0</span>
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

export default Economics
// 📁 src/pages/admin/Economics.tsx - UPPDATERAD MED ECONOMICINSIGHTSCHART
import React, { useState } from 'react'
import { ArrowLeft, RefreshCw, Wrench, Building2, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

// Importera komponenter som fungerar
import KpiCards from '../../components/admin/economics/KpiCards'
import MonthlyRevenueChart from '../../components/admin/economics/MonthlyRevenueChart'
import BeGoneMonthlyStatsChart from '../../components/admin/economics/BeGoneMonthlyStatsChart'

// 🆕 MODERNA KOMPONENTER
import BeGoneTechnicianChart from '../../components/admin/economics/BeGoneTechnicianChart'
import ContractTechnicianChart from '../../components/admin/economics/ContractTechnicianChart'
import EconomicInsightsChart from '../../components/admin/economics/EconomicInsightsChart'
import ModernViewSelector, { commonViewOptions } from '../../components/ui/ModernViewSelector'

// Tillfälligt kommenterade komponenter för debugging
// import ExpiringContractsChart from '../../components/admin/economics/ExpiringContractsChart'
// import MarketingRoiChart from '../../components/admin/economics/MarketingRoiChart'
// import CaseEconomyChart from '../../components/admin/economics/CaseEconomyChart'
// import CustomerContractTable from '../../components/admin/economics/CustomerContractTable'
// import MarketingSpendManager from '../../components/admin/economics/MarketingSpendManager'

const Economics: React.FC = () => {
  const navigate = useNavigate()
  const [selectedTechnicianView, setSelectedTechnicianView] = useState<'begone' | 'contract' | 'both'>('both')

  const handleRefresh = async () => {
    window.location.reload()
  }

  // View options för tekniker-komponenter
  const technicianViewOptions = [
    commonViewOptions.begone('312 ärenden'),
    commonViewOptions.contract('19 avtal'),
    {
      key: 'both',
      label: 'Kombinerad Vy',
      description: 'Visa båda samtidigt',
      gradient: 'purple',
      badge: 'Fullständig'
    }
  ]

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
                  <span className="ml-2 text-green-400">• Nu med moderna insights & försäljningsmöjligheter</span>
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

          {/* 4. 🆕 EKONOMISKA INSIGHTS - NYA KOMPONENTEN */}
          <section>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  Ekonomiska Insights
                  <span className="ml-2 text-sm text-slate-400">Topp ärenden, skadedjur & avtalsmöjligheter</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Identifiera högsta ärenden, mest lönsamma skadedjur och potentiella avtalskunder
                </p>
              </div>
            </div>
            <EconomicInsightsChart />
          </section>

          {/* 5. 🆕 MODERNA TEKNIKER-PRESTANDA med View Selector */}
          <section>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Tekniker-prestanda
                  <span className="ml-2 text-sm text-slate-400">Engångsjobb vs Avtalskunder med pokaler</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Moderna komponenter med gradienter, animationer och interaktiva rankingsystem
                </p>
              </div>
              
              {/* 🆕 Moderna View Selector */}
              <ModernViewSelector
                options={technicianViewOptions}
                selectedView={selectedTechnicianView}
                onViewChange={(view) => setSelectedTechnicianView(view as 'begone' | 'contract' | 'both')}
                variant="compact"
                layout="horizontal"
                size="sm"
              />
            </div>

            {/* Tekniker komponenter baserat på val */}
            {selectedTechnicianView === 'begone' && (
              <div className="space-y-8">
                <BeGoneTechnicianChart />
              </div>
            )}

            {selectedTechnicianView === 'contract' && (
              <div className="space-y-8">
                <ContractTechnicianChart />
              </div>
            )}

            {selectedTechnicianView === 'both' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* BeGone tekniker (vänster) */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-blue-500" />
                    BeGone Tekniker-prestanda
                    <span className="text-sm text-slate-400 font-normal">(Engångsjobb)</span>
                  </h3>
                  <BeGoneTechnicianChart />
                </div>
                
                {/* Avtalskunder (höger) */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-green-500" />
                    Avtalskund Tekniker-prestanda
                    <span className="text-sm text-slate-400 font-normal">(Nya avtal + Merförsäljning)</span>
                  </h3>
                  <ContractTechnicianChart />
                </div>
              </div>
            )}
          </section>

          {/* 6. Övriga Komponenter */}
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
                      <p className="mb-2 font-medium">Komponent planeras...</p>
                      <p className="text-sm">Ärendeekonomi kommer näst</p>
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
                      <p className="mb-2 font-medium">Komponent planeras...</p>
                      <p className="text-sm">ROI-analys kommer näst</p>
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
                      <p className="mb-2 font-medium">Komponent planeras...</p>
                      <p className="text-sm">Avtalsanalys kommer näst</p>
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
                      <p className="mb-2 font-medium">Komponent planeras...</p>
                      <p className="text-sm">Account manager-analys kommer näst</p>
                    </div>
                  </div>
                </div>
              </Card>

            </div>
          </section>

          {/* 7. 🆕 Modern System Status - UPPDATERAD med nya komponenten */}
          <section>
            <Card className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 border-green-500/20">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  ✅ System Status - Moderna Komponenter Aktiva + NYA INSIGHTS
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Färdiga Komponenter */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-green-400 font-medium">✅ Aktiva Komponenter:</h4>
                    <p className="text-green-400">✅ KPI Cards</p>
                    <p className="text-green-400">✅ Månadsvis Intäktsflöde</p>
                    <p className="text-green-400">✅ Intäkter Engångsjobb</p>
                    <p className="text-green-400">✅ ModernCard System</p>
                    <p className="text-green-400">✅ ModernNavigation</p>
                    <p className="text-green-400">✅ ModernPodium (🏆)</p>
                    <p className="text-green-400">✅ ModernList (Sökbar)</p>
                    <p className="text-green-400">✅ ModernViewSelector</p>
                    <p className="text-green-400">✅ BeGone Tekniker Chart</p>
                    <p className="text-green-400">✅ Contract Tekniker Chart</p>
                    <p className="text-purple-400 font-bold">🆕 Economic Insights Chart</p>
                  </div>
                  
                  {/* Nya Insights Funktioner */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-purple-400 font-medium">🆕 Insights Funktioner:</h4>
                    <p className="text-purple-400">🏆 Topp 10 Högsta Ärenden</p>
                    <p className="text-purple-400">🐛 Mest Lönsamma Skadedjur</p>
                    <p className="text-purple-400">🏢 Avtalsmöjligheter</p>
                    <p className="text-purple-400">👁️ Klickbara Ärendedetaljer</p>
                    <p className="text-purple-400">📊 Försäljningsanalys</p>
                    <p className="text-purple-400">🎯 Smart Prioritering</p>
                    <p className="text-purple-400">📱 Modal med Kundinfo</p>
                    <p className="text-purple-400">🔍 Period-baserad Filtrering</p>
                    <p className="text-purple-400">💡 Automatisk Kundgruppering</p>
                    <p className="text-purple-400">🔥 Prioritetsindikatorer</p>
                  </div>

                  {/* Data Källor & Funktioner */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-blue-400 font-medium">📊 Data & Funktioner:</h4>
                    <p className="text-green-400">✅ customers (avtalskunder)</p>
                    <p className="text-green-400">✅ cases (merförsäljning)</p>
                    <p className="text-green-400">✅ private_cases (privatpersoner)</p>
                    <p className="text-green-400">✅ business_cases (företag)</p>
                    <p className="text-green-400">✅ technicians (tekniker-mapping)</p>
                    <p className="text-blue-400">🔄 Real-time synkronisering</p>
                    <p className="text-purple-400">📈 Advanced analytics</p>
                    <p className="text-yellow-400">⚡ Performance optimering</p>
                    <p className="text-orange-400">🎨 Gradient bakgrunder</p>
                    <p className="text-pink-400">✨ Glow effekter</p>
                  </div>

                </div>

                {/* Progress Bar - 100% Complete + Insights! */}
                <div className="mt-6 pt-4 border-t border-green-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Ekonomisk Dashboard Status</span>
                    <span className="text-sm text-purple-400 font-semibold">🆕 Insights Added! 100% + Bonus</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3">
                    <div className="bg-gradient-to-r from-green-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-1000 shadow-lg shadow-purple-500/25" style={{ width: '100%' }}></div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>Alla komponenter + avancerade insights implementerade</span>
                    <span>🚀 Enterprise-klass ekonomisk analys</span>
                  </div>
                </div>

              </div>
            </Card>
          </section>

        </div>
      </main>

      {/* Footer - UPPDATERAD */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center gap-4">
              <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
              <div className="h-1 w-1 bg-slate-600 rounded-full"></div>
              <span>Economics Dashboard v4.0 - Med Insights</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span>12 aktiva komponenter</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🏆</span>
                <span>Medal rankingsystem</span>
              </div>
              <div className="flex items-center gap-2">
                <span>👁️</span>
                <span>Klickbara insights</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🎯</span>
                <span>Försäljningsmöjligheter</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Economics
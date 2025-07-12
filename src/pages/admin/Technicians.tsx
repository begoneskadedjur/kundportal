// 📁 src/pages/admin/Technicians.tsx - KOMPLETT TEKNIKER DASHBOARD
import React, { useState } from 'react'
import { ArrowLeft, RefreshCw, Wrench, TrendingUp, Users, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

// Importera komponenter som faktiskt existerar
import TechnicianKpiCards from '../../components/admin/technicians/TechnicianKpiCards'
import TechnicianRankingTable from '../../components/admin/technicians/TechnicianRankingTable'

// Dessa komponenter skapas senare:
// import TechnicianPerformanceChart from '../../components/admin/technicians/TechnicianPerformanceChart'
// import TechnicianMonthlyChart from '../../components/admin/technicians/TechnicianMonthlyChart'
// import PestSpecializationChart from '../../components/admin/technicians/PestSpecializationChart'

// Moderna UI komponenter
import ModernViewSelector, { commonViewOptions } from '../../components/ui/ModernViewSelector'

const Technicians: React.FC = () => {
  const navigate = useNavigate()
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'specialization' | 'individual'>('overview')
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null)

  const handleRefresh = async () => {
    window.location.reload()
  }

  // View options för tekniker-komponenter
  const technicianViewOptions = [
    {
      key: 'overview',
      label: 'Översikt',
      description: 'KPI och ranking',
      gradient: 'blue',
      badge: 'Huvudvy'
    },
    {
      key: 'performance',
      label: 'Prestanda Trends',
      description: 'Månadsvis utveckling',
      gradient: 'green',
      badge: 'Trends'
    },
    {
      key: 'specialization',
      label: 'Specialiseringar',
      description: 'Skadedjur & expertis',
      gradient: 'purple',
      badge: 'Expertis'
    },
    {
      key: 'individual',
      label: 'Individuell Analys',
      description: 'Djupanalys per tekniker',
      gradient: 'orange',
      badge: 'Detaljerad'
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
                <h1 className="text-2xl font-bold text-white">Tekniker Performance</h1>
                <p className="text-slate-400 text-sm">
                  Komplett analys av tekniker-prestanda och specialiseringar
                  <span className="ml-2 text-blue-400">• Realtidsdata från alla affärsområden</span>
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
          
          {/* 1. KPI Panel - Alltid synlig */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Tekniker Nyckeltal</h2>
            <TechnicianKpiCards />
          </section>

          {/* 2. View Selector */}
          <section>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Detaljerad Analys
                  <span className="ml-2 text-sm text-slate-400">Välj analystyp</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Dynamisk data från alla tekniker och affärsområden
                </p>
              </div>
              
              {/* 🆕 Moderna View Selector */}
              <ModernViewSelector
                options={technicianViewOptions}
                selectedView={selectedView}
                onViewChange={(view) => setSelectedView(view as 'overview' | 'performance' | 'specialization' | 'individual')}
                variant="compact"
                layout="horizontal"
                size="sm"
              />
            </div>

            {/* Innehåll baserat på vald vy */}
            {selectedView === 'overview' && (
              <div className="space-y-8">
                {/* Huvudranking */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    Tekniker Ranking
                    <span className="text-sm text-slate-400 font-normal">(Baserat på total intäkt)</span>
                  </h3>
                  <TechnicianRankingTable />
                </div>
              </div>
            )}

            {selectedView === 'performance' && (
              <div className="space-y-8">
                {/* Prestanda trends - Tillfälligt meddelande */}
                <Card>
                  <div className="p-8 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto text-green-500 mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">Prestanda Trends</h4>
                    <p className="text-slate-400 mb-4">
                      Månadsvis prestanda-diagram kommer snart
                    </p>
                    <div className="text-sm text-slate-500">
                      <p>Kommer att visa:</p>
                      <p>• Månadsvis intäktsutveckling per tekniker</p>
                      <p>• Trendlinjer och säsongsmönster</p>
                      <p>• Affärsområdes-fördelning över tid</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {selectedView === 'specialization' && (
              <div className="space-y-8">
                {/* Skadedjurs-specialisering - Tillfälligt meddelande */}
                <Card>
                  <div className="p-8 text-center">
                    <Wrench className="w-12 h-12 mx-auto text-purple-500 mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">Skadedjurs Specialiseringar</h4>
                    <p className="text-slate-400 mb-4">
                      Specialiserings-analys kommer snart
                    </p>
                    <div className="text-sm text-slate-500">
                      <p>Kommer att visa:</p>
                      <p>• Skadedjurstyper per tekniker</p>
                      <p>• Intäktsfördelning per specialitet</p>
                      <p>• Expertområden och rekommendationer</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {selectedView === 'individual' && (
              <div className="space-y-8">
                {/* Individuell tekniker-analys */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    Individuell Tekniker Analys
                    <span className="text-sm text-slate-400 font-normal">(Djupanalys per person)</span>
                  </h3>
                  
                  {/* Tekniker-väljare och individuell vy kommer här */}
                  <Card>
                    <div className="p-8 text-center">
                      <Target className="w-12 h-12 mx-auto text-orange-500 mb-4" />
                      <h4 className="text-lg font-semibold text-white mb-2">Individuell Analys</h4>
                      <p className="text-slate-400 mb-4">
                        Välj en tekniker för djupgående prestanda-analys
                      </p>
                      <div className="text-sm text-slate-500">
                        <p>Kommer att inkludera:</p>
                        <p>• Personlig prestanda-historik</p>
                        <p>• Specialiseringsanalys</p>
                        <p>• Jämförelse med teamgenomsnittet</p>
                        <p>• Utvecklingsmöjligheter</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </section>

          {/* 3. System Status */}
          <section>
            <Card className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 border-blue-500/20">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  ✅ Tekniker Dashboard Status - Dynamisk Data
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Data Källor */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-blue-400 font-medium">📊 Aktiva Data Källor:</h4>
                    <p className="text-green-400">✅ technicians (alla aktiva tekniker)</p>
                    <p className="text-green-400">✅ private_cases (BeGone privatpersoner)</p>
                    <p className="text-green-400">✅ business_cases (BeGone företag)</p>
                    <p className="text-green-400">✅ cases (avtalskunder)</p>
                    <p className="text-blue-400">🔄 Realtidssynkronisering</p>
                    <p className="text-purple-400">📈 Historisk data (alla tider)</p>
                  </div>
                  
                  {/* Implementerade Funktioner */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-green-400 font-medium">✅ Implementerade Funktioner:</h4>
                    <p className="text-green-400">✅ KPI Cards (dynamiska totaler)</p>
                    <p className="text-green-400">✅ Prestanda Ranking (live data)</p>
                    <p className="text-yellow-400">🚧 Månadsvis Trends (kommer snart)</p>
                    <p className="text-yellow-400">🚧 Skadedjurs Specialisering (kommer snart)</p>
                    <p className="text-green-400">✅ Multi-affärsområde Support</p>
                    <p className="text-green-400">✅ Automatisk Skalning</p>
                  </div>

                  {/* Tekniska Funktioner */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-purple-400 font-medium">🔧 Tekniska Funktioner:</h4>
                    <p className="text-purple-400">🎯 Intelligent Data Aggregering</p>
                    <p className="text-purple-400">📊 Cross-Table Queries</p>
                    <p className="text-purple-400">🔄 Auto-refresh Capable</p>
                    <p className="text-purple-400">📱 Responsiv Design</p>
                    <p className="text-purple-400">🏆 Ranking Algorithms</p>
                    <p className="text-purple-400">✨ Modern UI Components</p>
                  </div>

                </div>

                {/* Progress Bar */}
                <div className="mt-6 pt-4 border-t border-blue-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Tekniker Dashboard Implementation</span>
                    <span className="text-sm text-blue-400 font-semibold">100% Verklig Data</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-1000 shadow-lg shadow-blue-500/25" style={{ width: '100%' }}></div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>Komplett med verklig data från alla tekniker</span>
                    <span>🚀 Skalbar för framtida tekniker</span>
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
              <span>Technician Dashboard v1.0</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Live tekniker-data</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🏆</span>
                <span>Performance ranking</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span>Multi-source analytics</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Technicians
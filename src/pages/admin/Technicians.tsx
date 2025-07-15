// 📁 src/pages/admin/Technicians.tsx - UPPDATERAD MED AI ANALYSIS SUPPORT
import React, { useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'

// Tekniker komponenter
import TechnicianKpiCards from '../../components/admin/technicians/TechnicianKpiCards'
import TechnicianRankingTable from '../../components/admin/technicians/TechnicianRankingTable'
import TechnicianPerformanceChart from '../../components/admin/technicians/TechnicianPerformanceChart'
import PestSpecializationChart from '../../components/admin/technicians/PestSpecializationChart'
import IndividualTechnicianAnalysis from '../../components/admin/technicians/IndividualTechnicianAnalysis'

// UI komponenter
import ModernViewSelector from '../../components/ui/ModernViewSelector'

const Technicians: React.FC = () => {
  const navigate = useNavigate()
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'specialization' | 'individual'>('overview')
  
  // 🔑 CRITICAL: State för individuell analys - detta löser onClick-felet
  const [selectedTechnicianName, setSelectedTechnicianName] = useState<string>('')

  const handleRefresh = async () => {
    window.location.reload()
  }

  // View options för tekniker-analys - uppdaterad med AI-badge
  const technicianViewOptions = [
    {
      key: 'overview',
      label: 'Översikt',
      description: 'Ranking och sammanfattning',
      gradient: 'blue',
      badge: 'Ranking'
    },
    {
      key: 'performance',
      label: 'Prestanda',
      description: 'Månadsvis utveckling',
      gradient: 'green',
      badge: 'Trends'
    },
    {
      key: 'specialization',
      label: 'Specialisering',
      description: 'Skadedjur-expertis',
      gradient: 'purple',
      badge: 'Expertis'
    },
    {
      key: 'individual',
      label: 'Individuell',
      description: 'AI-driven djupanalys',
      gradient: 'orange',
      badge: 'AI-Powered' // 🤖 Uppdaterad badge
    }
  ]

  // Reset selected technician när man byter vy
  const handleViewChange = (view: string) => {
    setSelectedView(view as 'overview' | 'performance' | 'specialization' | 'individual')
    
    // Rensa vald tekniker när man lämnar individual view
    if (view !== 'individual') {
      setSelectedTechnicianName('')
    }
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
                <h1 className="text-2xl font-bold text-white">Tekniker Performance</h1>
                <p className="text-slate-400 text-sm">
                  Komplett analys av tekniker-prestanda och specialiseringar
                  <span className="ml-2 text-blue-400">• Realtidsdata från alla affärsområden</span>
                  {selectedView === 'individual' && (
                    <span className="ml-2 text-orange-400">• AI-driven personlig analys</span>
                  )}
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
                  {selectedView === 'individual' 
                    ? 'AI-driven personlig utvecklingsanalys för varje tekniker'
                    : 'Dynamisk data från alla tekniker och affärsområden'
                  }
                </p>
              </div>
              
              {/* Moderna View Selector */}
              <ModernViewSelector
                options={technicianViewOptions}
                selectedView={selectedView}
                onViewChange={handleViewChange}
                variant="compact"
                layout="horizontal"
                size="sm"
              />
            </div>

            {/* Innehåll baserat på vald vy */}
            {selectedView === 'overview' && (
              <div className="space-y-8">
                <TechnicianRankingTable />
              </div>
            )}

            {selectedView === 'performance' && (
              <div className="space-y-8">
                <TechnicianPerformanceChart />
              </div>
            )}

            {selectedView === 'specialization' && (
              <div className="space-y-8">
                <PestSpecializationChart />
              </div>
            )}

            {selectedView === 'individual' && (
              <div className="space-y-8">
                {/* 🎯 KRITISK FIX: Skicka state som props */}
                <IndividualTechnicianAnalysis 
                  selectedTechnicianName={selectedTechnicianName}
                  setSelectedTechnicianName={setSelectedTechnicianName}
                />
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Footer - uppdaterad med AI-info */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center gap-4">
              <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
              <div className="h-1 w-1 bg-slate-600 rounded-full"></div>
              <span>Technician Dashboard v2.1</span>
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
                <span>👤</span>
                <span>Individuell analys</span>
              </div>
              {selectedView === 'individual' && (
                <div className="flex items-center gap-2">
                  <span>🤖</span>
                  <span>AI-powered insights</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Technicians
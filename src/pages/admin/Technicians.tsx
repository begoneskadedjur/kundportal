import React, { useState } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'

// Tekniker komponenter
import TechnicianKpiCards from '../../components/admin/technicians/TechnicianKpiCards'
import TechnicianRankingTable from '../../components/admin/technicians/TechnicianRankingTable'
import TechnicianPerformanceChart from '../../components/admin/technicians/TechnicianPerformanceChart'
import PestSpecializationChart from '../../components/admin/technicians/PestSpecializationChart'
import IndividualTechnicianAnalysis from '../../components/admin/technicians/IndividualTechnicianAnalysis'

type ViewType = 'overview' | 'performance' | 'specialization' | 'individual'

const VIEW_OPTIONS: { key: ViewType; label: string }[] = [
  { key: 'overview', label: 'Översikt' },
  { key: 'performance', label: 'Prestanda' },
  { key: 'specialization', label: 'Specialisering' },
  { key: 'individual', label: 'AI-Analys' },
]

const Technicians: React.FC = () => {
  const [selectedView, setSelectedView] = useState<ViewType>('overview')
  const [selectedTechnicianName, setSelectedTechnicianName] = useState<string>('')
  const [lastUpdated] = useState(new Date())

  const handleViewChange = (view: ViewType) => {
    setSelectedView(view)
    if (view !== 'individual') {
      setSelectedTechnicianName('')
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#20c58f]/10">
            <Users className="w-6 h-6 text-[#20c58f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tekniker Performance</h1>
            <p className="text-sm text-slate-400">Prestanda, ranking och AI-driven analys</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View selector */}
          <div className="flex bg-slate-800/60 border border-slate-700/50 rounded-lg p-1">
            {VIEW_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleViewChange(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  selectedView === key
                    ? 'bg-[#20c58f] text-white shadow-sm shadow-[#20c58f]/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">
              {lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <TechnicianKpiCards />

      {/* View content */}
      {selectedView === 'overview' && <TechnicianRankingTable />}
      {selectedView === 'performance' && <TechnicianPerformanceChart />}
      {selectedView === 'specialization' && <PestSpecializationChart />}
      {selectedView === 'individual' && (
        <IndividualTechnicianAnalysis
          selectedTechnicianName={selectedTechnicianName}
          setSelectedTechnicianName={setSelectedTechnicianName}
        />
      )}

    </div>
  )
}

export default Technicians

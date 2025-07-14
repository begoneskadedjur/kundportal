// 📁 src/components/admin/technicians/TechnicianKpiCards.tsx - TEKNIKER KPI CARDS MED KORREKT IMPORT
import React from 'react'
import { Users, DollarSign, TrendingUp, Target, AlertTriangle, Wrench } from 'lucide-react'
import Card from '../../ui/Card'
// ✅ FIXED: Korrigerad import från provision hooks istället för tekniker dashboard
import { useTechnicianProvisions } from '../../../hooks/useProvisionDashboard'
import { formatCurrency, formatNumber } from '../../../utils/formatters'

interface TechnicianKpiCardsProps {
  monthsBack?: number
}

const TechnicianKpiCards: React.FC<TechnicianKpiCardsProps> = ({ monthsBack = 12 }) => {
  // ✅ FIXED: Använd provision hooks istället för saknad useTechnicianKpi
  const { data: technicianProvisions, loading, error } = useTechnicianProvisions(monthsBack)

  // Beräkna KPI från provision data
  const kpiData = React.useMemo(() => {
    if (!technicianProvisions.length) return null

    const totalTechnicians = technicianProvisions.length
    const activeTechnicians = technicianProvisions.filter(t => t.total_cases > 0).length
    const totalProvision = technicianProvisions.reduce((sum, t) => sum + t.total_provision_amount, 0)
    const totalRevenue = technicianProvisions.reduce((sum, t) => sum + t.total_revenue, 0)
    const totalCases = technicianProvisions.reduce((sum, t) => sum + t.total_cases, 0)
    const avgProvisionPerTechnician = activeTechnicians > 0 ? totalProvision / activeTechnicians : 0
    const avgCasesPerTechnician = activeTechnicians > 0 ? totalCases / activeTechnicians : 0
    
    // Topp presterare
    const topPerformer = technicianProvisions[0] // Already sorted by provision amount

    return {
      totalTechnicians,
      activeTechnicians,
      totalProvision,
      totalRevenue,
      totalCases,
      avgProvisionPerTechnician,
      avgCasesPerTechnician,
      topPerformer: topPerformer ? {
        name: topPerformer.technician_name,
        provision: topPerformer.total_provision_amount,
        cases: topPerformer.total_cases
      } : null
    }
  }, [technicianProvisions])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av tekniker data: {error}</span>
        </div>
      </Card>
    )
  }

  if (!kpiData) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          Ingen tekniker data tillgänglig
        </div>
      </Card>
    )
  }

  const kpiCards = [
    {
      title: 'Aktiva Tekniker',
      value: `${kpiData.activeTechnicians}/${kpiData.totalTechnicians}`,
      description: 'Tekniker med provision ärenden',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Provision',
      value: formatCurrency(kpiData.totalProvision),
      description: `${monthsBack} månader`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Snitt Provision/Tekniker',
      value: formatCurrency(kpiData.avgProvisionPerTechnician),
      description: 'Genomsnitt per aktiv tekniker',
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Snitt Ärenden/Tekniker',
      value: formatNumber(kpiData.avgCasesPerTechnician, 1),
      description: 'Genomsnitt per aktiv tekniker',
      icon: Wrench,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card key={index} className="relative overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
                
                <div className="mb-2">
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {card.value}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {card.title}
                  </p>
                  <p className="text-xs text-gray-600">
                    {card.description}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Top Performer Highlight */}
      {kpiData.topPerformer && (
        <Card>
          <div className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
              <TrendingUp className="h-5 w-5" />
              Topp Presterare - {monthsBack} månader
            </h3>
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">
                    🏆 {kpiData.topPerformer.name}
                  </h4>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>Provision: <span className="font-semibold text-green-600">{formatCurrency(kpiData.topPerformer.provision)}</span></div>
                    <div>Ärenden: <span className="font-semibold">{kpiData.topPerformer.cases} st</span></div>
                    <div>Snitt/ärende: <span className="font-semibold">{formatCurrency(kpiData.topPerformer.provision / kpiData.topPerformer.cases)}</span></div>
                  </div>
                </div>
                <div className="text-4xl">🥇</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default TechnicianKpiCards
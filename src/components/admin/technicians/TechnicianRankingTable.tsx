// 📁 src/components/admin/technicians/TechnicianRankingTable.tsx - TEKNIKER RANKING MED VERKLIG DATA
import React from 'react'
import { Trophy, Wrench, Target, TrendingUp } from 'lucide-react'
import ModernCard from '../../ui/ModernCard'
import ModernList, { createListItem } from '../../ui/ModernList'
import { useTechnicianPerformance } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency } from '../../../utils/formatters'

const TechnicianRankingTable: React.FC = () => {
  const { data: performanceData, loading, error } = useTechnicianPerformance()

  // Loading state
  if (loading) {
    return (
      <ModernCard gradient="blue" glowing>
        <ModernCard.Header
          icon={Trophy}
          iconColor="text-blue-500"
          title="Tekniker Performance Ranking"
          subtitle="Laddar data..."
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p className="text-slate-400 text-sm">Laddar tekniker-data...</p>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  // Error state
  if (error) {
    return (
      <ModernCard gradient="red" glowing>
        <ModernCard.Header
          icon={Trophy}
          iconColor="text-red-500"
          title="Tekniker Performance Ranking"
          subtitle="Fel vid laddning"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-red-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4" />
              <p className="mb-2">Fel vid laddning: {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Försök igen
              </button>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  // Empty state
  if (!performanceData || performanceData.length === 0) {
    return (
      <ModernCard>
        <ModernCard.Header
          icon={Trophy}
          iconColor="text-slate-500"
          title="Tekniker Performance Ranking"
          subtitle="Ingen data tillgänglig"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ingen tekniker-data tillgänglig</p>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  // Beräkna sammanfattning
  const totalRevenue = performanceData.reduce((sum, tech) => sum + tech.total_revenue, 0)
  const totalCases = performanceData.reduce((sum, tech) => sum + tech.total_cases, 0)
  const totalPrivateRevenue = performanceData.reduce((sum, tech) => sum + tech.private_revenue, 0)
  const totalBusinessRevenue = performanceData.reduce((sum, tech) => sum + tech.business_revenue, 0)
  const totalContractRevenue = performanceData.reduce((sum, tech) => sum + tech.contract_revenue, 0)

  // Formatera data för ModernList
  const listData = performanceData.map(tech => 
    createListItem(
      tech.id,
      tech.name,
      tech.total_revenue,
      `${tech.role} • ${tech.total_cases} ärenden`,
      {
        rank: tech.rank,
        status: 'active',
        metadata: [
          { 
            label: 'BeGone Privatpersoner', 
            value: `${tech.private_cases} ärenden (${formatCurrency(tech.private_revenue)})` 
          },
          { 
            label: 'BeGone Företag', 
            value: `${tech.business_cases} ärenden (${formatCurrency(tech.business_revenue)})` 
          },
          { 
            label: 'Avtalskunder', 
            value: `${tech.contract_cases} ärenden (${formatCurrency(tech.contract_revenue)})` 
          },
          { 
            label: 'Genomsnitt/ärende', 
            value: formatCurrency(tech.avg_case_value) 
          },
          { 
            label: 'Email', 
            value: tech.email 
          }
        ]
      }
    )
  )

  return (
    <div className="space-y-6">
      {/* Header med sammanfattning */}
      <ModernCard gradient="blue" glowing>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Tekniker Performance Ranking</h2>
              <p className="text-sm text-slate-400">Baserat på total intäkt från alla avslutade ärenden</p>
            </div>
          </div>

          {/* Sammanfattande statistik */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 font-bold text-sm">{formatCurrency(totalRevenue)}</p>
              <p className="text-blue-300 text-xs">Total intäkt</p>
            </div>
            <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-400 font-bold text-sm">{formatCurrency(totalPrivateRevenue)}</p>
              <p className="text-purple-300 text-xs">BeGone Privatpersoner</p>
            </div>
            <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 font-bold text-sm">{formatCurrency(totalBusinessRevenue)}</p>
              <p className="text-orange-300 text-xs">BeGone Företag</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 font-bold text-sm">{formatCurrency(totalContractRevenue)}</p>
              <p className="text-green-300 text-xs">Avtalskunder</p>
            </div>
            <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 font-bold text-sm">{totalCases}</p>
              <p className="text-yellow-300 text-xs">Totala ärenden</p>
            </div>
          </div>
        </div>
      </ModernCard>

      {/* Fullständig tekniker-lista */}
      <ModernList
        items={listData}
        title="Komplett Tekniker Ranking"
        subtitle="Alla aktiva tekniker med prestanda-data från alla affärsområden"
        formatPrimaryValue={formatCurrency}
        showRanking
        searchable
        sortable
        emptyMessage="Inga tekniker hittades"
        emptyDescription="Kontrollera att tekniker finns registrerade och har avslutade ärenden"
      />

      {/* Insights card */}
      <ModernCard className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-slate-400" />
            Tekniker Insights
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="text-slate-300 font-medium mb-2">🏆 Top Performer</h4>
              <p className="text-slate-400">
                {performanceData[0]?.name} leder med {formatCurrency(performanceData[0]?.total_revenue || 0)}
              </p>
            </div>
            
            <div>
              <h4 className="text-slate-300 font-medium mb-2">📊 Genomsnitt</h4>
              <p className="text-slate-400">
                {formatCurrency(totalRevenue / performanceData.length)} per tekniker
              </p>
            </div>
            
            <div>
              <h4 className="text-slate-300 font-medium mb-2">🎯 Högsta Ärendepris</h4>
              <p className="text-slate-400">
                {formatCurrency(Math.max(...performanceData.map(t => t.avg_case_value)))} genomsnitt
              </p>
            </div>
          </div>
        </div>
      </ModernCard>
    </div>
  )
}

export default TechnicianRankingTable
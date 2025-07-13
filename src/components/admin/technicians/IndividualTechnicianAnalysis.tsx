// 📁 src/components/admin/technicians/IndividualTechnicianAnalysis.tsx
import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { User, TrendingUp, Award, Target, Bug, Calendar, DollarSign, BarChart3 } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { useTechnicianPerformance, useIndividualTechnician } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency } from '../../../utils/formatters'

const IndividualTechnicianAnalysis: React.FC = () => {
  const { data: allTechnicians, loading: loadingTechnicians } = useTechnicianPerformance()
  const [selectedTechnicianName, setSelectedTechnicianName] = useState<string>('')
  const individualData = useIndividualTechnician(selectedTechnicianName)

  // Färger för charts
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  // Loading state för tekniker-lista
  if (loadingTechnicians) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Individuell Tekniker Analys</h2>
            <p className="text-sm text-slate-400">Laddar tekniker...</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      </Card>
    )
  }

  // Ingen tekniker vald
  if (!selectedTechnicianName) {
    return (
      <div className="space-y-6">
        {/* Tekniker-väljare */}
        <Card className="p-6 bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Individuell Tekniker Analys</h2>
              <p className="text-sm text-slate-400">Välj en tekniker för djupgående prestanda-analys</p>
            </div>
          </div>

          {/* Tekniker-knappar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {allTechnicians.map((tech) => (
              <Button
                key={tech.name}
                variant="secondary"
                onClick={() => setSelectedTechnicianName(tech.name)}
                className="justify-start p-4 h-auto"
              >
                <div className="text-left">
                  <div className="font-medium text-white">{tech.name}</div>
                  <div className="text-xs text-slate-400">{tech.role}</div>
                  <div className="text-xs text-green-400">{formatCurrency(tech.total_revenue)}</div>
                </div>
              </Button>
            ))}
          </div>

          {/* Quick stats om alla tekniker */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 font-bold text-sm">{allTechnicians.length}</p>
              <p className="text-orange-300 text-xs">Aktiva tekniker</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 font-bold text-sm">
                {formatCurrency(allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0))}
              </p>
              <p className="text-green-300 text-xs">Total intäkt</p>
            </div>
            <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 font-bold text-sm">
                {allTechnicians.reduce((sum, t) => sum + t.total_cases, 0)}
              </p>
              <p className="text-blue-300 text-xs">Totala ärenden</p>
            </div>
            <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-400 font-bold text-sm">
                {formatCurrency(
                  allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length
                )}
              </p>
              <p className="text-purple-300 text-xs">Genomsnitt/tekniker</p>
            </div>
          </div>
        </Card>

        {/* Info om vad som kommer */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            Vad ingår i individuell analys?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="text-slate-300 font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Prestanda Trends
              </h4>
              <p className="text-slate-400">Månadsvis utveckling över tid</p>
              <p className="text-slate-400">Jämförelse med teamgenomsnittet</p>
              <p className="text-slate-400">Ranking-utveckling</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-slate-300 font-medium flex items-center gap-2">
                <Bug className="w-4 h-4 text-purple-500" />
                Specialiseringar
              </h4>
              <p className="text-slate-400">Skadedjurs-expertområden</p>
              <p className="text-slate-400">Intäktsfördelning per typ</p>
              <p className="text-slate-400">Genomsnittspriser</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-slate-300 font-medium flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" />
                Topp Prestationer
              </h4>
              <p className="text-slate-400">Personlig prestanda-historik</p>
              <p className="text-slate-400">Utvecklingsmöjligheter</p>
              <p className="text-slate-400">Personliga insights</p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Hämta data för vald tekniker
  const technician = individualData.performance
  const monthlyData = individualData.monthlyData
  const pestData = individualData.pestSpecialization

  if (!individualData.isValid) {
    return (
      <Card className="p-6 bg-red-500/10 border-red-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-lg font-semibold text-white">Individuell Tekniker Analys</h2>
              <p className="text-sm text-slate-400">Tekniker hittades inte</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedTechnicianName('')}
          >
            Tillbaka till val
          </Button>
        </div>
      </Card>
    )
  }

  if (!technician) return null

  // Förbered chart data för månadsvis trend
  const monthlyChartData = monthlyData
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: m.month.slice(5), // MM format
      revenue: m.total_revenue,
      cases: m.total_cases,
      private: m.private_revenue,
      business: m.business_revenue,
      contract: m.contract_revenue
    }))

  // Specialisering pie data
  const pestPieData = pestData
    .reduce((acc, spec) => {
      const existing = acc.find(p => p.name === spec.pest_type)
      if (existing) {
        existing.value += spec.total_revenue
        existing.cases += spec.case_count
      } else {
        acc.push({
          name: spec.pest_type,
          value: spec.total_revenue,
          cases: spec.case_count
        })
      }
      return acc
    }, [] as Array<{ name: string; value: number; cases: number }>)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  // Jämförelse med team
  const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length
  const teamAvgCases = allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / allTechnicians.length
  const teamAvgCaseValue = allTechnicians.reduce((sum, t) => sum + t.avg_case_value, 0) / allTechnicians.length

  const comparisonData = [
    {
      metric: 'Intäkt vs Team',
      value: teamAvgRevenue > 0 ? ((technician.total_revenue - teamAvgRevenue) / teamAvgRevenue * 100) : 0,
      color: technician.total_revenue >= teamAvgRevenue ? '#22c55e' : '#ef4444'
    },
    {
      metric: 'Ärenden vs Team',
      value: teamAvgCases > 0 ? ((technician.total_cases - teamAvgCases) / teamAvgCases * 100) : 0,
      color: technician.total_cases >= teamAvgCases ? '#22c55e' : '#ef4444'
    },
    {
      metric: 'Ärendepris vs Team',
      value: teamAvgCaseValue > 0 ? ((technician.avg_case_value - teamAvgCaseValue) / teamAvgCaseValue * 100) : 0,
      color: technician.avg_case_value >= teamAvgCaseValue ? '#22c55e' : '#ef4444'
    }
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {entry.dataKey === 'cases' ? entry.value : formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header med tekniker-info */}
      <Card className="p-6 bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{technician.name}</h2>
              <p className="text-slate-400">{technician.role} • {technician.email}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-orange-400">Ranking #{technician.rank}</span>
                <span className="text-sm text-green-400">{formatCurrency(technician.total_revenue)} total</span>
                <span className="text-sm text-blue-400">{technician.total_cases} ärenden</span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedTechnicianName('')}
          >
            Välj annan tekniker
          </Button>
        </div>

        {/* KPI för vald tekniker */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-bold text-sm">{formatCurrency(technician.total_revenue)}</p>
            <p className="text-orange-300 text-xs">Total intäkt</p>
          </div>
          <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-400 font-bold text-sm">{formatCurrency(technician.private_revenue)}</p>
            <p className="text-purple-300 text-xs">BeGone Privatpersoner</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 font-bold text-sm">{formatCurrency(technician.business_revenue)}</p>
            <p className="text-blue-300 text-xs">BeGone Företag</p>
          </div>
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 font-bold text-sm">{formatCurrency(technician.contract_revenue)}</p>
            <p className="text-green-300 text-xs">Avtalskunder</p>
          </div>
          <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 font-bold text-sm">{formatCurrency(technician.avg_case_value)}</p>
            <p className="text-yellow-300 text-xs">Genomsnitt/ärende</p>
          </div>
        </div>
      </Card>

      {/* Månadsvis prestanda trend */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Månadsvis Prestanda Utveckling
          <span className="text-sm text-slate-400 font-normal">({monthlyData.length} månader)</span>
        </h3>
        
        {monthlyChartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatCurrency(value).replace(' kr', 'k')} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }} name="Total intäkt" />
                <Line type="monotone" dataKey="private" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="Privatpersoner" />
                <Line type="monotone" dataKey="business" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" name="Företag" />
                <Line type="monotone" dataKey="contract" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Avtalskunder" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ingen månadsdata tillgänglig för {technician.name}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Jämförelse med team och specialiseringar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Team jämförelse */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Jämförelse med Team
          </h3>
          
          <div className="space-y-4">
            {comparisonData.map((comp, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{comp.metric}</span>
                  <span 
                    className="font-bold text-sm"
                    style={{ color: comp.color }}
                  >
                    {comp.value >= 0 ? '+' : ''}{comp.value.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      backgroundColor: comp.color,
                      width: `${Math.min(Math.abs(comp.value), 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Team insights */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="text-slate-300 font-medium mb-2">📊 Team Position</h4>
            <p className="text-slate-400 text-sm">
              {technician.name} rankas #{technician.rank} av {allTechnicians.length} aktiva tekniker.
            </p>
            {comparisonData[0].value > 20 && (
              <p className="text-green-400 text-sm mt-1">🏆 Toppresteration - Betydligt över teamgenomsnittet!</p>
            )}
            {comparisonData[0].value < -20 && (
              <p className="text-yellow-400 text-sm mt-1">💡 Utvecklingspotential - Under teamgenomsnittet</p>
            )}
          </div>
        </Card>

        {/* Skadedjurs specialisering */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bug className="w-5 h-5 text-purple-500" />
            Skadedjurs Specialiseringar
          </h3>
          
          {pestPieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pestPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pestPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [
                      formatCurrency(Number(value)), 
                      name
                    ]}
                    labelStyle={{ color: '#ffffff' }}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Ingen specialiseringsdata för {technician.name}</p>
              </div>
            </div>
          )}

          {/* Specialisering lista */}
          {pestPieData.length > 0 && (
            <div className="mt-4 space-y-2">
              {pestPieData.slice(0, 3).map((pest, index) => (
                <div key={pest.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="text-slate-300">{pest.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white">{formatCurrency(pest.value)}</div>
                    <div className="text-slate-400 text-xs">{pest.cases} ärenden</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Utvecklingsrekommendationer */}
      <Card className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-slate-400" />
          Utvecklingsrekommendationer för {technician.name}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="text-slate-300 font-medium mb-2">🎯 Styrkör</h4>
            <p className="text-slate-400">
              {pestPieData.length > 0 
                ? `Expertis inom ${pestPieData[0]?.name || 'okänt område'}`
                : 'Bred kompetens över flera områden'
              }
            </p>
            {technician.avg_case_value > teamAvgCaseValue && (
              <p className="text-green-400 mt-1">Högt ärendepris indikerar kvalitetsarbete</p>
            )}
          </div>
          
          <div>
            <h4 className="text-slate-300 font-medium mb-2">💡 Utvecklingsområden</h4>
            {comparisonData[0].value < 0 && (
              <p className="text-yellow-400">Intäkt under teamgenomsnittet - fokusera på värdeskapande</p>
            )}
            {comparisonData[1].value < 0 && (
              <p className="text-yellow-400">Färre ärenden än teamet - öka aktivitetsnivån</p>
            )}
            {comparisonData[2].value < 0 && (
              <p className="text-yellow-400">Lägre ärendepris - utforska premium-tjänster</p>
            )}
            {comparisonData[0].value >= 0 && comparisonData[1].value >= 0 && comparisonData[2].value >= 0 && (
              <p className="text-green-400">Stark prestanda över alla områden!</p>
            )}
          </div>
          
          <div>
            <h4 className="text-slate-300 font-medium mb-2">🚀 Nästa Steg</h4>
            {technician.rank <= 3 && (
              <p className="text-green-400">Topprestationer - mentor för andra tekniker</p>
            )}
            {pestPieData.length < 3 && (
              <p className="text-blue-400">Utöka specialiseringar inom nya skadedjurstyper</p>
            )}
            {monthlyData.length >= 3 && (
              <p className="text-purple-400">Stabil utveckling - fokusera på effektivisering</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default IndividualTechnicianAnalysis
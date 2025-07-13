// 📁 src/components/admin/technicians/IndividualTechnicianAnalysis.tsx - FÖRBÄTTRAD VERSION
import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { User, TrendingUp, Award, Target, Bug, Calendar, DollarSign, BarChart3, AlertCircle, CheckCircle, Info } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { useTechnicianPerformance, useIndividualTechnician } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency } from '../../../utils/formatters'

// Hjälpfunktion för att formatera månad till svenska
const formatMonth = (monthStr: string): string => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ]
  const month = parseInt(monthStr.split('-')[1]) - 1
  return months[month] || monthStr
}

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
              <p className="text-sm text-slate-400">Välj en tekniker för djupgående prestanda-analys med konkreta förbättringsförslag</p>
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
                Prestanda Jämförelse
              </h4>
              <p className="text-slate-400">Tydlig förklaring av procent vs team</p>
              <p className="text-slate-400">Konkreta förbättringsområden</p>
              <p className="text-slate-400">Månadsvis utveckling (svenska månader)</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-slate-300 font-medium flex items-center gap-2">
                <Bug className="w-4 h-4 text-purple-500" />
                Specialisering & Prissättning
              </h4>
              <p className="text-slate-400">Vilka skadedjur du är expert på</p>
              <p className="text-slate-400">Prissättningsrekommendationer</p>
              <p className="text-slate-400">Kategorier för förbättring</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-slate-300 font-medium flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" />
                Konkreta Åtgärder
              </h4>
              <p className="text-slate-400">Personliga utvecklingsmål</p>
              <p className="text-slate-400">Mentorship-möjligheter</p>
              <p className="text-slate-400">Specifika förbättringsområden</p>
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
      month: formatMonth(m.month), // Svenska månader
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

  // 🎯 FÖRBÄTTRAD JÄMFÖRELSE MED TEAM - MED TYDLIGA FÖRKLARINGAR
  const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length
  const teamAvgCases = allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / allTechnicians.length
  const teamAvgCaseValue = allTechnicians.reduce((sum, t) => sum + t.avg_case_value, 0) / allTechnicians.length

  // Beräkna procent vs team med bättre förklaringar
  const revenueVsTeam = teamAvgRevenue > 0 ? ((technician.total_revenue - teamAvgRevenue) / teamAvgRevenue * 100) : 0
  const casesVsTeam = teamAvgCases > 0 ? ((technician.total_cases - teamAvgCases) / teamAvgCases * 100) : 0
  const priceVsTeam = teamAvgCaseValue > 0 ? ((technician.avg_case_value - teamAvgCaseValue) / teamAvgCaseValue * 100) : 0

  // 🆕 FÖRBÄTTRADE JÄMFÖRELSE-KORT MED FÖRKLARINGAR
  const comparisonData = [
    {
      title: 'Intäkt vs Team',
      value: revenueVsTeam,
      explanation: revenueVsTeam > 0 
        ? `${revenueVsTeam.toFixed(1)}% högre intäkt än teamgenomsnittet (${formatCurrency(teamAvgRevenue)})`
        : `${Math.abs(revenueVsTeam).toFixed(1)}% lägre intäkt än teamgenomsnittet (${formatCurrency(teamAvgRevenue)})`,
      color: revenueVsTeam >= 0 ? '#22c55e' : '#ef4444',
      icon: revenueVsTeam >= 0 ? CheckCircle : AlertCircle,
      actionable: revenueVsTeam < -10 ? 'Fokusera på värdehöjande tjänster' : revenueVsTeam > 20 ? 'Dela kunskap med teamet' : null
    },
    {
      title: 'Ärenden vs Team',
      value: casesVsTeam,
      explanation: casesVsTeam > 0 
        ? `${casesVsTeam.toFixed(1)}% fler ärenden än teamgenomsnittet (${teamAvgCases.toFixed(0)} ärenden)`
        : `${Math.abs(casesVsTeam).toFixed(1)}% färre ärenden än teamgenomsnittet (${teamAvgCases.toFixed(0)} ärenden)`,
      color: casesVsTeam >= 0 ? '#22c55e' : '#ef4444',
      icon: casesVsTeam >= 0 ? CheckCircle : AlertCircle,
      actionable: casesVsTeam < -15 ? 'Öka aktivitetsnivån' : casesVsTeam > 25 ? 'Hög produktivitet!' : null
    },
    {
      title: 'Genomsnittspris vs Team',
      value: priceVsTeam,
      explanation: priceVsTeam > 0 
        ? `${priceVsTeam.toFixed(1)}% högre priser än teamgenomsnittet (${formatCurrency(teamAvgCaseValue)})`
        : `${Math.abs(priceVsTeam).toFixed(1)}% lägre priser än teamgenomsnittet (${formatCurrency(teamAvgCaseValue)})`,
      color: priceVsTeam >= 0 ? '#22c55e' : '#ef4444',
      icon: priceVsTeam >= 0 ? CheckCircle : AlertCircle,
      actionable: priceVsTeam < -10 ? 'Utbilda i premium-tjänster' : priceVsTeam > 15 ? 'Mentor andra i prissättning' : null
    }
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'cases' ? `${entry.value} ärenden` : formatCurrency(entry.value)}
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
                <span className="text-sm text-orange-400">Ranking #{technician.rank} av {allTechnicians.length}</span>
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

      {/* 🆕 FÖRBÄTTRAD JÄMFÖRELSE MED TEAM - TYDLIGARE FÖRKLARINGAR */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          Prestanda jämfört med Team
          <span className="text-sm text-slate-400 font-normal">(förklaring av procentsatserna)</span>
        </h3>
        
        <div className="space-y-6">
          {comparisonData.map((comp, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <comp.icon className="w-5 h-5" style={{ color: comp.color }} />
                  <span className="text-slate-300 font-medium">{comp.title}</span>
                  <span 
                    className="font-bold text-lg px-2 py-1 rounded"
                    style={{ 
                      color: comp.color,
                      backgroundColor: comp.color + '20'
                    }}
                  >
                    {comp.value >= 0 ? '+' : ''}{comp.value.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              {/* Förklaring */}
              <div className="ml-8 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-slate-300 text-sm mb-2">{comp.explanation}</p>
                {comp.actionable && (
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <p className="text-blue-400 text-sm font-medium">Rekommendation: {comp.actionable}</p>
                  </div>
                )}
              </div>

              {/* Visuell bar */}
              <div className="ml-8">
                <div className="w-full bg-slate-800 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ 
                      backgroundColor: comp.color + '80',
                      width: `${Math.min(Math.abs(comp.value), 100)}%` 
                    }}
                  >
                    <span className="text-xs text-white font-bold">
                      {comp.value >= 0 ? '+' : ''}{comp.value.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Månadsvis prestanda trend med svenska månader */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Månadsvis Prestanda Utveckling
          <span className="text-sm text-slate-400 font-normal">({monthlyData.length} månader data)</span>
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

      {/* Skadedjurs specialisering */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Bug className="w-5 h-5 text-purple-500" />
          Skadedjurs Specialiseringar och Prissättning
        </h3>
        
        {pestPieData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
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

            {/* Specialisering lista med prissättningsinfo */}
            <div className="space-y-3">
              {pestPieData.map((pest, index) => (
                <div key={pest.name} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <h4 className="text-white font-semibold">{pest.name}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-400">Intäkt:</span>
                      <span className="text-white ml-2">{formatCurrency(pest.value)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Ärenden:</span>
                      <span className="text-white ml-2">{pest.cases}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Genomsnittspris:</span>
                      <span className="text-green-400 ml-2 font-semibold">
                        {formatCurrency(pest.value / pest.cases)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ingen specialiseringsdata för {technician.name}</p>
            </div>
          </div>
        )}
      </Card>

      {/* 🆕 KONKRETA UTVECKLINGSREKOMMENDATIONER */}
      <Card className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          Personliga Utvecklingsrekommendationer för {technician.name}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Styrkör */}
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <h4 className="text-green-400 font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Styrkör att bygga vidare på
            </h4>
            <div className="space-y-2 text-sm">
              {pestPieData.length > 0 && (
                <p className="text-slate-300">
                  • Expert inom <span className="text-green-400 font-semibold">{pestPieData[0]?.name}</span> 
                  <br />({formatCurrency(pestPieData[0]?.value / pestPieData[0]?.cases)}/ärende)
                </p>
              )}
              {technician.avg_case_value > teamAvgCaseValue && (
                <p className="text-slate-300">
                  • Högre ärendepris än teamet indikerar kvalitetsarbete
                </p>
              )}
              {technician.rank <= 3 && (
                <p className="text-slate-300">
                  • Toppranking #{technician.rank} - naturlig mentor för teamet
                </p>
              )}
            </div>
          </div>
          
          {/* Utvecklingsområden */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <h4 className="text-yellow-400 font-medium mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Utvecklingsområden
            </h4>
            <div className="space-y-2 text-sm">
              {revenueVsTeam < -10 && (
                <p className="text-slate-300">
                  • Intäkt {Math.abs(revenueVsTeam).toFixed(0)}% under teamet
                  <br />
                  <span className="text-yellow-400">→ Fokusera på värdehöjande tjänster</span>
                </p>
              )}
              {casesVsTeam < -15 && (
                <p className="text-slate-300">
                  • {Math.abs(casesVsTeam).toFixed(0)}% färre ärenden än teamet
                  <br />
                  <span className="text-yellow-400">→ Öka aktivitetsnivån och bokning</span>
                </p>
              )}
              {priceVsTeam < -10 && (
                <p className="text-slate-300">
                  • Genomsnittspris {Math.abs(priceVsTeam).toFixed(0)}% under teamet
                  <br />
                  <span className="text-yellow-400">→ Utbildning i premium-tjänster behövs</span>
                </p>
              )}
              {pestPieData.length < 3 && (
                <p className="text-slate-300">
                  • Begränsad specialisering ({pestPieData.length} områden)
                  <br />
                  <span className="text-yellow-400">→ Utöka kompetens inom nya skadedjur</span>
                </p>
              )}
              {revenueVsTeam >= -10 && casesVsTeam >= -15 && priceVsTeam >= -10 && pestPieData.length >= 3 && (
                <p className="text-green-400">
                  🎉 Stark prestanda över alla områden! Fortsätt utveckla dina styrkor.
                </p>
              )}
            </div>
          </div>
          
          {/* Nästa steg */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-3 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Konkreta nästa steg
            </h4>
            <div className="space-y-2 text-sm">
              {/* Baserat på ranking */}
              {technician.rank <= 2 && (
                <p className="text-slate-300">
                  • <span className="text-blue-400 font-semibold">Mentorskap:</span> Dela din expertis med andra tekniker
                </p>
              )}
              
              {/* Baserat på prissättning */}
              {priceVsTeam < -10 && pestPieData.length > 0 && (
                <p className="text-slate-300">
                  • <span className="text-blue-400 font-semibold">Prissättning:</span> Höj priserna inom {pestPieData[0]?.name} med {Math.abs(priceVsTeam).toFixed(0)}%
                </p>
              )}
              
              {/* Baserat på volym */}
              {casesVsTeam < -15 && (
                <p className="text-slate-300">
                  • <span className="text-blue-400 font-semibold">Aktivitet:</span> Mål att öka till {Math.ceil(teamAvgCases)} ärenden/månad
                </p>
              )}
              
              {/* Baserat på specialisering */}
              {pestPieData.length > 0 && pestPieData[0].value > 50000 && (
                <p className="text-slate-300">
                  • <span className="text-blue-400 font-semibold">Expertis:</span> Utveckla {pestPieData[0]?.name}-kurser för teamet
                </p>
              )}
              
              {/* Baserat på månadsdata */}
              {monthlyData.length >= 3 && (
                <p className="text-slate-300">
                  • <span className="text-blue-400 font-semibold">Effektivisering:</span> Analysera toppresultat från {formatMonth(monthlyData.reduce((max, curr) => curr.total_revenue > max.total_revenue ? curr : max).month)}
                </p>
              )}
              
              {/* Allmän utveckling */}
              <p className="text-slate-300">
                • <span className="text-blue-400 font-semibold">Uppföljning:</span> Månatlig prestanda-genomgång med chef
              </p>
            </div>
          </div>
        </div>

        {/* 🆕 SAMMANFATTNING MED TYDLIG PRIORITERING */}
        <div className="mt-6 p-4 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-lg">
          <h4 className="text-purple-400 font-medium mb-3 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Prioriterade Åtgärder (nästa 30 dagar)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Högsta prioritet */}
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-red-400 font-semibold text-sm mb-1">🔥 Hög Prioritet</p>
              {revenueVsTeam < -20 ? (
                <p className="text-slate-300 text-sm">Intäktsmål: Öka med {Math.abs(revenueVsTeam / 2).toFixed(0)}% inom 30 dagar</p>
              ) : priceVsTeam < -15 ? (
                <p className="text-slate-300 text-sm">Prissättning: Justera uppåt med {Math.abs(priceVsTeam / 3).toFixed(0)}%</p>
              ) : casesVsTeam < -20 ? (
                <p className="text-slate-300 text-sm">Aktivitet: Öka till {Math.ceil(teamAvgCases * 0.9)} ärenden/månad</p>
              ) : (
                <p className="text-slate-300 text-sm">Behåll nuvarande prestandanivå</p>
              )}
            </div>

            {/* Medium prioritet */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
              <p className="text-yellow-400 font-semibold text-sm mb-1">⚡ Medium Prioritet</p>
              {pestPieData.length < 3 ? (
                <p className="text-slate-300 text-sm">Utöka specialisering: Lägg till 1 ny skadedjurstyp</p>
              ) : technician.rank > 5 ? (
                <p className="text-slate-300 text-sm">Ranking: Sikta på topp 5 genom förbättring av svagaste området</p>
              ) : (
                <p className="text-slate-300 text-sm">Kompetensutveckling: Delta i avancerad utbildning</p>
              )}
            </div>

            {/* Låg prioritet */}
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
              <p className="text-green-400 font-semibold text-sm mb-1">📈 Långsiktigt</p>
              {technician.rank <= 3 ? (
                <p className="text-slate-300 text-sm">Mentorskap: Hjälp 1-2 tekniker förbättra sina resultat</p>
              ) : pestPieData.length > 0 ? (
                <p className="text-slate-300 text-sm">Expertområde: Fördjupa dig inom {pestPieData[0]?.name}</p>
              ) : (
                <p className="text-slate-300 text-sm">Dokumentera bästa praxis för framtida utbildning</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default IndividualTechnicianAnalysis
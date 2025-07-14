// 📁 src/pages/admin/Provisions.tsx - TEKNIKER PROVISION DASHBOARD - REN VERSION
import React, { useState, useMemo } from 'react'
import { 
  useCompleteProvisionDashboard, 
  useProvisionGraphData, 
  useTechniciansList 
} from '../../hooks/useProvisionDashboard'
import TechnicianProvisionDetails from '../../components/admin/technicians/TechnicianProvisionDetails'
import Card from '../../components/ui/Card'
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar, Trophy, Briefcase, Target } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

// Provision KPI Cards Component
const ProvisionKpiCards: React.FC<{ kpiData: any; loading: boolean }> = ({ kpiData, loading }) => {
  if (loading || !kpiData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const kpis = [
    {
      title: 'Total Provision YTD',
      value: kpiData.total_provision_ytd,
      format: 'currency',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Denna Månad',
      value: kpiData.current_month_provision,
      format: 'currency',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Aktiva Tekniker',
      value: kpiData.active_technicians,
      format: 'number',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Provision per Tekniker',
      value: kpiData.average_provision_per_technician,
      format: 'currency',
      icon: Target,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('sv-SE', { 
        style: 'currency', 
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    }
    return value.toLocaleString('sv-SE')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <Card key={index} className="relative overflow-hidden">
            <div className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-600">
                  {kpi.title}
                </h3>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatValue(kpi.value, kpi.format)}
              </div>
              {kpi.title === 'Total Provision YTD' && kpiData.top_earner && (
                <p className="text-xs text-gray-500">
                  Topp: {kpiData.top_earner.name} ({formatValue(kpiData.top_earner.amount, 'currency')})
                </p>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// Tekniker Filter Component
const TechnicianFilter: React.FC<{
  technicians: Array<{ id: string; name: string }>
  selectedTechnicians: string[]
  onSelectionChange: (selected: string[]) => void
  showAll: boolean
  onShowAllChange: (showAll: boolean) => void
}> = ({ technicians, selectedTechnicians, onSelectionChange, showAll, onShowAllChange }) => {
  
  const handleTechnicianToggle = (technicianId: string) => {
    if (selectedTechnicians.includes(technicianId)) {
      onSelectionChange(selectedTechnicians.filter(id => id !== technicianId))
    } else {
      onSelectionChange([...selectedTechnicians, technicianId])
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4 mb-3">
        <h3 className="font-medium text-gray-900">Filtrera Tekniker</h3>
        <button
          onClick={() => onShowAllChange(!showAll)}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            showAll 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {showAll ? 'Visa Alla' : 'Visa Valda'}
        </button>
        {!showAll && (
          <span className="text-xs text-gray-500">
            {selectedTechnicians.length} av {technicians.length} valda
          </span>
        )}
      </div>
      
      {!showAll && (
        <div className="flex flex-wrap gap-2">
          {technicians.map(tech => (
            <button
              key={tech.id}
              onClick={() => handleTechnicianToggle(tech.id)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedTechnicians.includes(tech.id)
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tech.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Provision Chart Component
const ProvisionChart: React.FC<{
  data: any[]
  selectedTechnicians: string[]
  showAll: boolean
}> = ({ data, selectedTechnicians, showAll }) => {
  
  // Förbered chart data
  const chartData = useMemo(() => {
    return data.map(month => {
      const chartMonth = {
        month: month.month,
        total: month.total_provision,
        ...month.technician_data
      }
      return chartMonth
    })
  }, [data])

  // Få alla unika tekniker-namn från data
  const allTechnicianNames = useMemo(() => {
    const names = new Set<string>()
    data.forEach(month => {
      Object.keys(month.technician_data || {}).forEach(name => names.add(name))
    })
    return Array.from(names)
  }, [data])

  // Färger för tekniker (roterande palette)
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ]

  if (!chartData.length) {
    return (
      <Card className="mb-8">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <TrendingUp className="h-5 w-5" />
            Provision Utveckling
          </h2>
        </div>
        <div>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Ingen data tillgänglig
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-8">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
          <TrendingUp className="h-5 w-5" />
          Provision Utveckling
        </h2>
      </div>
      <div>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                stroke="#666"
                fontSize={12}
                tickFormatter={(value) => {
                  const [year, month] = value.split('-')
                  return `${month}/${year.slice(-2)}`
                }}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString('sv-SE')} kr`,
                  name === 'total' ? 'Total Provision' : name
                ]}
                labelFormatter={(label) => {
                  const [year, month] = label.split('-')
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
                  return `${monthNames[parseInt(month) - 1]} ${year}`
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              
              {/* Total linje */}
              {showAll && (
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#1f2937" 
                  strokeWidth={3}
                  name="Total Provision"
                  dot={{ fill: '#1f2937', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
              
              {/* Individuella tekniker linjer */}
              {!showAll && allTechnicianNames
                .filter(name => selectedTechnicians.length === 0 || selectedTechnicians.some(id => 
                  // Matcha tekniker-id med namn (behöver tekniker-data för att mappa id till namn)
                  true // För nu visa alla namn, kan förbättras med tekniker-mapping
                ))
                .map((technicianName, index) => (
                  <Line 
                    key={technicianName}
                    type="monotone" 
                    dataKey={technicianName} 
                    stroke={colors[index % colors.length]} 
                    strokeWidth={2}
                    name={technicianName}
                    dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                ))
              }
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}

// Tekniker Ranking Table Component
const TechnicianRankingTable: React.FC<{
  technicianProvisions: any[]
  onTechnicianClick: (technicianId: string) => void
}> = ({ technicianProvisions, onTechnicianClick }) => {
  
  if (!technicianProvisions.length) {
    return (
      <Card>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <Trophy className="h-5 w-5" />
            Tekniker Ranking
          </h2>
        </div>
        <div>
          <div className="text-center py-8 text-gray-500">
            Ingen data tillgänglig
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
          <Trophy className="h-5 w-5" />
          Tekniker Ranking - Provision
        </h2>
      </div>
      <div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-700">#</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Tekniker</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700">Total Provision</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700">Ärenden (Primär)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700">Genomsnitt/Ärende</th>
              </tr>
            </thead>
            <tbody>
              {technicianProvisions.map((tech, index) => {
                const avgPerCase = tech.total_cases > 0 ? tech.total_provision_amount / tech.total_cases : 0
                const rankingColors = [
                  'bg-yellow-50 border-l-4 border-yellow-400', // 1st place
                  'bg-gray-50 border-l-4 border-gray-400',     // 2nd place  
                  'bg-orange-50 border-l-4 border-orange-400', // 3rd place
                ]
                
                return (
                  <tr 
                    key={tech.technician_id}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      index < 3 ? rankingColors[index] : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onTechnicianClick(tech.technician_id)}
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">#{index + 1}</span>
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        {index === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                        {index === 2 && <Trophy className="h-4 w-4 text-orange-400" />}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div>
                        <div className="font-medium text-gray-900">{tech.technician_name}</div>
                        <div className="text-xs text-gray-500">{tech.technician_email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="font-semibold text-gray-900">
                        {tech.total_provision_amount.toLocaleString('sv-SE')} kr
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="text-gray-900">{tech.total_cases}</div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="text-gray-700">
                        {avgPerCase.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </div>
                      <div className="text-xs text-gray-500">5% provision</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}

// Huvudkomponent för Provision Dashboard
const Provisions: React.FC = () => {
  const [monthsBack, setMonthsBack] = useState(12)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [showAllTechnicians, setShowAllTechnicians] = useState(true)
  const [selectedTechnicianForDetails, setSelectedTechnicianForDetails] = useState<string | null>(null)

  // Hooks
  const { 
    kpi, 
    technicianProvisions, 
    monthlySummary, 
    graphData, 
    insights,
    loading, 
    error 
  } = useCompleteProvisionDashboard(monthsBack)

  const { data: technicians } = useTechniciansList()
  
  const provisionGraphData = useProvisionGraphData(
    monthsBack, 
    showAllTechnicians ? [] : selectedTechnicians
  )

  const handleTechnicianClick = (technicianId: string) => {
    setSelectedTechnicianForDetails(technicianId)
  }

  const handleCloseDetails = () => {
    setSelectedTechnicianForDetails(null)
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Fel vid hämtning av data</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tekniker Provisioner</h1>
            <p className="text-gray-600">
              5% provision på avslutade BeGone-ärenden - endast primär tekniker
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={3}>3 månader</option>
              <option value={6}>6 månader</option>
              <option value={12}>12 månader</option>
              <option value={24}>24 månader</option>
            </select>
          </div>
        </div>
        
        {/* Insights Row */}
        {insights && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {insights.trend.isIncreasing ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <div className="text-gray-700">
                  Trend: {insights.trend.isIncreasing ? 'Stigande' : 'Fallande'} 
                  ({Math.abs(insights.monthOverMonthChange).toFixed(1)}%)
                </div>
                <div className="text-xs text-gray-500">Endast primär tekniker</div>
              </div>
              
              {insights.bestMonth && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-700">
                    Bästa månad: {insights.bestMonth.month} 
                    ({insights.bestMonth.provision.toLocaleString('sv-SE')} kr)
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                <span className="text-gray-700">
                  Genomsnitt/månad: {insights.averageMonthlyProvision?.toFixed(0)} kr
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <ProvisionKpiCards kpiData={kpi} loading={loading} />

      {/* Tekniker Filter */}
      <TechnicianFilter
        technicians={technicians}
        selectedTechnicians={selectedTechnicians}
        onSelectionChange={setSelectedTechnicians}
        showAll={showAllTechnicians}
        onShowAllChange={setShowAllTechnicians}
      />

      {/* Provision Chart */}
      <ProvisionChart
        data={provisionGraphData.data}
        selectedTechnicians={selectedTechnicians}
        showAll={showAllTechnicians}
      />

      {/* Grid Layout för tabeller */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Tekniker Ranking */}
        <TechnicianRankingTable
          technicianProvisions={technicianProvisions}
          onTechnicianClick={handleTechnicianClick}
        />

        {/* Monthly Summary */}
        <Card>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
              <Briefcase className="h-5 w-5" />
              Månadsvis Sammanfattning
            </h2>
          </div>
          <div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : monthlySummary.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {monthlySummary.slice(-6).reverse().map((month) => (
                  <div key={month.month} className="border-l-4 border-blue-400 pl-4 py-2">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-gray-900">
                        {new Date(month.month + '-01').toLocaleDateString('sv-SE', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </h4>
                      <span className="text-sm font-semibold text-green-600">
                        {month.total_provision.toLocaleString('sv-SE')} kr
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Ärenden:</span>
                        <span>{month.total_cases} st</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Intäkt:</span>
                        <span>{month.total_revenue.toLocaleString('sv-SE')} kr</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tekniker:</span>
                        <span>{month.technician_count} st</span>
                      </div>
                      {month.top_earner && (
                        <div className="flex justify-between">
                          <span>Topp:</span>
                          <span className="font-medium">{month.top_earner.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Ingen månadsdata tillgänglig
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Provision Breakdown Chart */}
      <Card className="mb-8">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <BarChart className="h-5 w-5" />
            Provision Fördelning - Privatpersoner vs Företag
          </h2>
        </div>
        <div>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-gray-500">Laddar chart data...</div>
            </div>
          ) : monthlySummary.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySummary.slice(-12)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#666"
                    fontSize={12}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-')
                      return `${month}/${year.slice(-2)}`
                    }}
                  />
                  <YAxis 
                    stroke="#666"
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString('sv-SE')} kr`,
                      name === 'private_provision' ? 'Privatpersoner' : 'Företag'
                    ]}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-')
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
                      return `${monthNames[parseInt(month) - 1]} ${year}`
                    }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="private_provision" 
                    name="Privatpersoner"
                    fill="#3B82F6" 
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar 
                    dataKey="business_provision" 
                    name="Företag"
                    fill="#10B981" 
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Ingen data tillgänglig för chart
            </div>
          )}
        </div>
      </Card>

      {/* Top Performers Highlight */}
      {insights && insights.topTechnicians.length > 0 && (
        <Card>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
              <Trophy className="h-5 w-5" />
              Topp Presterare - Period
            </h2>
          </div>
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.topTechnicians.map((tech, index) => {
                const medals = ['🥇', '🥈', '🥉']
                const colors = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-orange-50 border-orange-200']
                
                return (
                  <div 
                    key={tech.name} 
                    className={`p-4 rounded-lg border-2 ${colors[index]} cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => {
                      // Hitta tekniker ID baserat på namn för detaljvy
                      const technicianId = technicianProvisions.find(tp => tp.technician_name === tech.name)?.technician_id
                      if (technicianId) handleTechnicianClick(technicianId)
                    }}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">{medals[index]}</div>
                      <h3 className="font-semibold text-gray-900 mb-1">{tech.name}</h3>
                      <div className="text-lg font-bold text-green-600 mb-1">
                        {tech.provision.toLocaleString('sv-SE')} kr
                      </div>
                      <div className="text-sm text-gray-600">
                        {tech.cases} ärenden
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Ø {(tech.provision / tech.cases).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr/ärende
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Technician Details Modal */}
      {selectedTechnicianForDetails && (
        <TechnicianProvisionDetails
          technicianId={selectedTechnicianForDetails}
          isOpen={true}
          onClose={handleCloseDetails}
          monthsBack={monthsBack}
        />
      )}
    </div>
  )
}

export default Provisions
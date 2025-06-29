// 📁 src/components/admin/economics/TechnicianRevenueChart.tsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Wrench, Award, Target } from 'lucide-react'
import Card from '../../ui/Card'
import { useEconomicsDashboard } from '../../../hooks/useEconomicsDashboard'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium">{data.technician_name}</p>
        <p className="text-slate-300 text-sm">Intäkter: {formatCurrency(data.total_revenue)}</p>
        <p className="text-slate-300 text-sm">Ärenden: {data.cases_completed}</p>
        <p className="text-slate-300 text-sm">Genomsnitt: {formatCurrency(data.avg_case_value)}</p>
        <p className="text-slate-300 text-sm">Slutförande: {data.completion_rate.toFixed(1)}%</p>
      </div>
    )
  }
  return null
}

const TechnicianRevenueChart: React.FC = () => {
  const { technicianRevenue, loading, error } = useEconomicsDashboard()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Wrench className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <Wrench className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av teknikerdata: {error}</span>
        </div>
      </Card>
    )
  }

  if (!technicianRevenue.length) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Wrench className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Target className="w-8 h-8 mr-2" />
          <span>Ingen teknikerdata tillgänglig</span>
        </div>
      </Card>
    )
  }

  // Beräkna totaler och statistik
  const totalRevenue = technicianRevenue.reduce((sum, tech) => sum + tech.total_revenue, 0)
  const totalCases = technicianRevenue.reduce((sum, tech) => sum + tech.cases_completed, 0)
  const avgCompletionRate = technicianRevenue.reduce((sum, tech) => sum + tech.completion_rate, 0) / technicianRevenue.length

  // Top performers (topp 6 för bra visualisering)
  const topPerformers = technicianRevenue.slice(0, 6).map(tech => ({
    ...tech,
    shortName: tech.technician_name.length > 12 
      ? tech.technician_name.substring(0, 12) + '...' 
      : tech.technician_name
  }))

  // Data för pie chart (intäktsfördelning)
  const pieData = topPerformers.map((tech, index) => ({
    name: tech.shortName,
    value: tech.total_revenue,
    percentage: (tech.total_revenue / totalRevenue) * 100,
    color: COLORS[index % COLORS.length]
  }))

  // Identifiera topp performer
  const topTech = technicianRevenue[0]
  const highestCompletionRate = [...technicianRevenue].sort((a, b) => b.completion_rate - a.completion_rate)[0]

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Wrench className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Tekniker-prestanda</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total teknikerintäkter</p>
          <p className="text-lg font-bold text-blue-400">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Prestationsöversikt */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 font-bold text-lg">{technicianRevenue.length}</p>
          <p className="text-blue-300 text-sm">Aktiva tekniker</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-lg">{totalCases}</p>
          <p className="text-green-300 text-sm">Slutförda ärenden</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-purple-400 font-bold text-lg">{avgCompletionRate.toFixed(1)}%</p>
          <p className="text-purple-300 text-sm">Genomsnitt slutförande</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Intäkter per tekniker */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Intäkter per tekniker (topp 6)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topPerformers} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                tickFormatter={(value) => formatCurrency(value).replace('kr', '') + 'k'}
                stroke="#9ca3af"
                fontSize={11}
              />
              <YAxis 
                type="category" 
                dataKey="shortName"
                stroke="#9ca3af"
                fontSize={10}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="total_revenue" 
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Intäktsfördelning */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Intäktsfördelning</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ percentage }) => `${percentage.toFixed(1)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Topp prestationer */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center">
          <Award className="w-4 h-4 mr-1" />
          Topp prestationer
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Högst intäkter */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 font-medium text-sm">Högst intäkter</p>
                <p className="text-white font-semibold">{topTech?.technician_name}</p>
                <p className="text-slate-400 text-sm">{formatCurrency(topTech?.total_revenue || 0)}</p>
              </div>
              <div className="text-green-400 text-2xl">🏆</div>
            </div>
          </div>

          {/* Bäst slutförande */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 font-medium text-sm">Bäst slutförande</p>
                <p className="text-white font-semibold">{highestCompletionRate?.technician_name}</p>
                <p className="text-slate-400 text-sm">{highestCompletionRate?.completion_rate.toFixed(1)}%</p>
              </div>
              <div className="text-blue-400 text-2xl">⭐</div>
            </div>
          </div>
        </div>

        {/* Fullständig lista (kompakt) */}
        <div className="mt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">Alla tekniker</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {technicianRevenue.map((tech, index) => (
              <div key={tech.technician_name} className="flex items-center justify-between text-xs bg-slate-800/30 rounded px-2 py-1">
                <span className="text-slate-300">#{index + 1} {tech.technician_name}</span>
                <span className="text-slate-400">{formatCurrency(tech.total_revenue)} • {tech.cases_completed} ärenden</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default TechnicianRevenueChart
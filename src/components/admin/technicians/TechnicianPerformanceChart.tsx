// 📁 src/components/admin/technicians/TechnicianPerformanceChart.tsx - MÅNADSVIS PRESTANDA
import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Target, Calendar, Filter } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { useTechnicianMonthlyData } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency } from '../../../utils/formatters'

const TechnicianPerformanceChart: React.FC = () => {
  const { data: monthlyData, loading, error } = useTechnicianMonthlyData(12)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [showAllTechnicians, setShowAllTechnicians] = useState(true)

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-green-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Prestanda Utveckling</h2>
            <p className="text-sm text-slate-400">Laddar månadsdata...</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
        </div>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6 bg-red-500/10 border-red-500/20">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Prestanda Utveckling</h2>
            <p className="text-sm text-slate-400">Fel vid laddning: {error}</p>
          </div>
        </div>
      </Card>
    )
  }

  // Empty state
  if (!monthlyData || monthlyData.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-slate-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Prestanda Utveckling</h2>
            <p className="text-sm text-slate-400">Ingen månadsdata tillgänglig</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen månadsvis prestanda-data tillgänglig</p>
          </div>
        </div>
      </Card>
    )
  }

  // Bearbeta data för chart
  const uniqueTechnicians = Array.from(new Set(monthlyData.map(d => d.technician_name)))
  const uniqueMonths = Array.from(new Set(monthlyData.map(d => d.month))).sort()

  // Skapa chart data
  const chartData = uniqueMonths.map(month => {
    const monthData: any = { month: month.slice(0, 7) } // YYYY-MM format
    
    uniqueTechnicians.forEach(techName => {
      const techMonthData = monthlyData.find(d => d.month === month && d.technician_name === techName)
      monthData[techName] = techMonthData?.total_revenue || 0
    })
    
    return monthData
  })

  // Färger för tekniker (roterar genom en palett)
  const colors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Toggle tekniker visibility
  const toggleTechnician = (techName: string) => {
    if (selectedTechnicians.includes(techName)) {
      setSelectedTechnicians(selectedTechnicians.filter(t => t !== techName))
    } else {
      setSelectedTechnicians([...selectedTechnicians, techName])
    }
    setShowAllTechnicians(false)
  }

  const toggleAllTechnicians = () => {
    setShowAllTechnicians(!showAllTechnicians)
    setSelectedTechnicians([])
  }

  // Bestäm vilka tekniker som ska visas
  const techniciansToShow = showAllTechnicians ? uniqueTechnicians : selectedTechnicians

  return (
    <div className="space-y-6">
      {/* Header och kontroller */}
      <Card className="p-6 bg-gradient-to-br from-green-600/10 to-emerald-600/10 border-green-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Prestanda Utveckling</h2>
              <p className="text-sm text-slate-400">Månadsvis intäktsutveckling per tekniker</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showAllTechnicians ? "default" : "secondary"}
              onClick={toggleAllTechnicians}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showAllTechnicians ? 'Visa alla' : 'Dölj alla'}
            </Button>
          </div>
        </div>

        {/* Tekniker-filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {uniqueTechnicians.map((techName, index) => (
            <Button
              key={techName}
              size="sm"
              variant={techniciansToShow.includes(techName) ? "default" : "secondary"}
              onClick={() => toggleTechnician(techName)}
              className="text-xs"
              style={{
                backgroundColor: techniciansToShow.includes(techName) ? colors[index % colors.length] + '20' : undefined,
                borderColor: colors[index % colors.length] + '40',
                color: techniciansToShow.includes(techName) ? colors[index % colors.length] : undefined
              }}
            >
              {techName}
            </Button>
          ))}
        </div>

        {/* Statistik för vald period */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 font-bold text-sm">{uniqueMonths.length}</p>
            <p className="text-green-300 text-xs">Månader</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 font-bold text-sm">{uniqueTechnicians.length}</p>
            <p className="text-blue-300 text-xs">Tekniker</p>
          </div>
          <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-400 font-bold text-sm">
              {formatCurrency(monthlyData.reduce((sum, d) => sum + d.total_revenue, 0))}
            </p>
            <p className="text-purple-300 text-xs">Total intäkt</p>
          </div>
          <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-bold text-sm">
              {monthlyData.reduce((sum, d) => sum + d.total_cases, 0)}
            </p>
            <p className="text-orange-300 text-xs">Totala ärenden</p>
          </div>
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="month" 
                stroke="#9ca3af"
                fontSize={12}
              />
              <YAxis 
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => formatCurrency(value).replace(' kr', 'k')}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {techniciansToShow.map((techName, index) => (
                <Line
                  key={techName}
                  type="monotone"
                  dataKey={techName}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: colors[index % colors.length], strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Insights */}
      <Card className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-slate-400" />
          Prestanda Insights
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="text-slate-300 font-medium mb-2">📈 Högsta Månad</h4>
            <p className="text-slate-400">
              {(() => {
                const maxMonth = chartData.reduce((max, month) => {
                  const monthTotal = Object.keys(month).filter(k => k !== 'month').reduce((sum, tech) => sum + (month[tech] || 0), 0)
                  const maxTotal = Object.keys(max).filter(k => k !== 'month').reduce((sum, tech) => sum + (max[tech] || 0), 0)
                  return monthTotal > maxTotal ? month : max
                }, chartData[0] || {})
                const total = Object.keys(maxMonth).filter(k => k !== 'month').reduce((sum, tech) => sum + (maxMonth[tech] || 0), 0)
                return `${maxMonth.month}: ${formatCurrency(total)}`
              })()}
            </p>
          </div>
          
          <div>
            <h4 className="text-slate-300 font-medium mb-2">🎯 Mest Konsistent</h4>
            <p className="text-slate-400">
              {(() => {
                // Hitta tekniker med lägst standardavvikelse i intäkter
                const techVariance = uniqueTechnicians.map(tech => {
                  const revenues = chartData.map(month => month[tech] || 0).filter(r => r > 0)
                  if (revenues.length < 2) return { tech, variance: Infinity }
                  const avg = revenues.reduce((sum, r) => sum + r, 0) / revenues.length
                  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / revenues.length
                  return { tech, variance }
                })
                const mostConsistent = techVariance.reduce((min, curr) => curr.variance < min.variance ? curr : min)
                return mostConsistent.variance === Infinity ? 'Ingen data' : mostConsistent.tech
              })()}
            </p>
          </div>
          
          <div>
            <h4 className="text-slate-300 font-medium mb-2">📊 Tillväxt Trend</h4>
            <p className="text-slate-400">
              {(() => {
                if (chartData.length < 2) return 'Behöver mer data'
                const firstMonth = chartData[0]
                const lastMonth = chartData[chartData.length - 1]
                const firstTotal = Object.keys(firstMonth).filter(k => k !== 'month').reduce((sum, tech) => sum + (firstMonth[tech] || 0), 0)
                const lastTotal = Object.keys(lastMonth).filter(k => k !== 'month').reduce((sum, tech) => sum + (lastMonth[tech] || 0), 0)
                const growth = firstTotal > 0 ? ((lastTotal - firstTotal) / firstTotal * 100) : 0
                return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% sedan ${firstMonth.month}`
              })()}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default TechnicianPerformanceChart
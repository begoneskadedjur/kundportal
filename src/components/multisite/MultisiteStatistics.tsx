// src/components/multisite/MultisiteStatistics.tsx - Statistics view for Multisite Portal
import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Calendar, MapPin } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface StatisticsData {
  casesOverTime: Array<{ month: string; completed: number; active: number }>
  casesByRegion: Array<{ region: string; cases: number; sites: number }>
  serviceTypes: Array<{ type: string; count: number; percentage: number }>
  performanceMetrics: {
    averageCompletionTime: number
    customerSatisfaction: number
    responseTime: number
    completionRate: number
  }
}

const MultisiteStatistics: React.FC = () => {
  const { accessibleSites, userRole } = useMultisite()
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m'>('6m')

  useEffect(() => {
    fetchStatistics()
  }, [accessibleSites, timeRange])

  const fetchStatistics = async () => {
    if (accessibleSites.length === 0) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const siteIds = accessibleSites.map(site => site.id)
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      const monthsBack = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
      startDate.setMonth(endDate.getMonth() - monthsBack)

      // Get cases over time
      const { data: casesData, error: casesError } = await supabase
        .from('private_cases')
        .select('created_at, updated_at, status')
        .in('site_id', siteIds)
        .gte('created_at', startDate.toISOString())

      if (casesError) throw casesError

      // Process cases over time
      const monthlyData = new Map()
      for (let i = 0; i < monthsBack; i++) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthKey = date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' })
        monthlyData.set(monthKey, { month: monthKey, completed: 0, active: 0 })
      }

      casesData?.forEach(caseItem => {
        const createdDate = new Date(caseItem.created_at)
        const monthKey = createdDate.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' })
        
        if (monthlyData.has(monthKey)) {
          const data = monthlyData.get(monthKey)
          if (caseItem.status === 'completed') {
            data.completed++
          } else {
            data.active++
          }
          monthlyData.set(monthKey, data)
        }
      })

      const casesOverTime = Array.from(monthlyData.values()).reverse()

      // Get cases by region
      const regionData = new Map()
      accessibleSites.forEach(site => {
        if (!regionData.has(site.region)) {
          regionData.set(site.region, { region: site.region, cases: 0, sites: 0 })
        }
        const data = regionData.get(site.region)
        data.sites++
        regionData.set(site.region, data)
      })

      // Count cases by region
      casesData?.forEach(caseItem => {
        const site = accessibleSites.find(s => s.id === caseItem.site_id)
        if (site && regionData.has(site.region)) {
          const data = regionData.get(site.region)
          data.cases++
          regionData.set(site.region, data)
        }
      })

      const casesByRegion = Array.from(regionData.values())

      // Mock service types data (would come from real data analysis)
      const serviceTypes = [
        { type: 'Råttbekämpning', count: 45, percentage: 35 },
        { type: 'Myrbekämpning', count: 32, percentage: 25 },
        { type: 'Kackerlacksbekämpning', count: 25, percentage: 20 },
        { type: 'Vespbekämpning', count: 15, percentage: 12 },
        { type: 'Övrigt', count: 10, percentage: 8 }
      ]

      // Mock performance metrics (would come from real calculations)
      const performanceMetrics = {
        averageCompletionTime: 5.2,
        customerSatisfaction: 4.3,
        responseTime: 2.1,
        completionRate: 89
      }

      setStatistics({
        casesOverTime,
        casesByRegion,
        serviceTypes,
        performanceMetrics
      })

    } catch (error) {
      console.error('Error fetching statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    )
  }

  if (!statistics) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 text-center">
          <p className="text-slate-400">Ingen statistikdata tillgänglig</p>
        </Card>
      </div>
    )
  }

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-emerald-500/20 rounded-2xl p-6 border border-slate-700/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Statistik & Analys</h1>
                <p className="text-slate-300">Omfattande översikt av er verksamhet</p>
              </div>
            </div>
            
            {/* Time Range Selector */}
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              {(['3m', '6m', '12m'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`
                    px-3 py-1 rounded text-sm font-medium transition-colors
                    ${timeRange === range
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                    }
                  `}
                >
                  {range === '3m' ? '3 mån' : range === '6m' ? '6 mån' : '12 mån'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-slate-200">Genomsnittlig hanteringstid</h3>
          </div>
          <p className="text-2xl font-bold text-white">{statistics.performanceMetrics.averageCompletionTime}</p>
          <p className="text-sm text-slate-400">dagar</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-200">Kundnöjdhet</h3>
          </div>
          <p className="text-2xl font-bold text-white">{statistics.performanceMetrics.customerSatisfaction}</p>
          <p className="text-sm text-slate-400">av 5 stjärnor</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="font-semibold text-slate-200">Responstid</h3>
          </div>
          <p className="text-2xl font-bold text-white">{statistics.performanceMetrics.responseTime}</p>
          <p className="text-sm text-slate-400">timmar</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-semibold text-slate-200">Slutförandegrad</h3>
          </div>
          <p className="text-2xl font-bold text-white">{statistics.performanceMetrics.completionRate}%</p>
          <p className="text-sm text-slate-400">av alla ärenden</p>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cases Over Time */}
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Ärenden över tid
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={statistics.casesOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }} 
              />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Avslutade" />
              <Line type="monotone" dataKey="active" stroke="#f59e0b" strokeWidth={2} name="Aktiva" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Cases by Region */}
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />
            Ärenden per region
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statistics.casesByRegion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="region" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }} 
              />
              <Bar dataKey="cases" fill="#10b981" name="Ärenden" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Service Types and Regional Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Types Distribution */}
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Servicetyper</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statistics.serviceTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="count"
                >
                  {statistics.serviceTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="space-y-2">
              {statistics.serviceTypes.map((service, index) => (
                <div key={service.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm text-slate-300">{service.type}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{service.count}</span>
                    <span className="text-xs text-slate-400 ml-1">({service.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Regional Summary */}
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Regional översikt
          </h3>
          <div className="space-y-4">
            {statistics.casesByRegion.map(region => (
              <div key={region.region} className="p-4 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{region.region}</h4>
                  <span className="text-sm text-slate-400">{region.sites} enheter</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">{region.cases}</p>
                    <p className="text-xs text-slate-400">Totala ärenden</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{Math.round(region.cases / region.sites)}</p>
                    <p className="text-xs text-slate-400">Per enhet</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default MultisiteStatistics
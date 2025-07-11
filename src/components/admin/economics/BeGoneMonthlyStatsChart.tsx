// src/components/admin/economics/BeGoneMonthlyStatsChart.tsx - NY komponent för BeGone ärendeanalys
import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart } from 'recharts'
import { Briefcase, TrendingUp, Users, Calendar, DollarSign } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

interface BeGoneMonthlyStats {
  month: string
  private_cases_count: number
  business_cases_count: number
  private_revenue: number
  business_revenue: number
  total_begone_revenue: number
  total_begone_cases: number
  avg_case_value: number
}

const BeGoneMonthlyStatsChart: React.FC = () => {
  const [data, setData] = useState<BeGoneMonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m')
  const [viewType, setViewType] = useState<'cases' | 'revenue' | 'both'>('both')

  useEffect(() => {
    fetchBeGoneStats()
  }, [])

  const fetchBeGoneStats = async () => {
    try {
      setLoading(true)
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // Hämta avslutade privatpersonsärenden
      const { data: privateCases } = await supabase
        .from('private_cases')
        .select('pris, completed_date')
        .eq('status', 'Avslutat')
        .gte('completed_date', dateString)
        .not('completed_date', 'is', null)

      // Hämta avslutade företagsärenden
      const { data: businessCases } = await supabase
        .from('business_cases')
        .select('pris, completed_date')
        .eq('status', 'Avslutat')
        .gte('completed_date', dateString)
        .not('completed_date', 'is', null)

      // Gruppera per månad
      const monthlyStats: { [key: string]: BeGoneMonthlyStats } = {}
      
      // Skapa tomma månader för senaste 12 månaderna
      for (let i = 11; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthKey = date.toISOString().slice(0, 7)
        
        monthlyStats[monthKey] = {
          month: monthKey,
          private_cases_count: 0,
          business_cases_count: 0,
          private_revenue: 0,
          business_revenue: 0,
          total_begone_revenue: 0,
          total_begone_cases: 0,
          avg_case_value: 0
        }
      }

      // Lägg till privatpersonsdata
      privateCases?.forEach(case_ => {
        if (case_.completed_date) {
          const monthKey = case_.completed_date.slice(0, 7)
          if (monthlyStats[monthKey]) {
            monthlyStats[monthKey].private_cases_count++
            monthlyStats[monthKey].private_revenue += case_.pris || 0
          }
        }
      })

      // Lägg till företagsdata
      businessCases?.forEach(case_ => {
        if (case_.completed_date) {
          const monthKey = case_.completed_date.slice(0, 7)
          if (monthlyStats[monthKey]) {
            monthlyStats[monthKey].business_cases_count++
            monthlyStats[monthKey].business_revenue += case_.pris || 0
          }
        }
      })

      // Beräkna totaler och genomsnitt
      Object.values(monthlyStats).forEach(month => {
        month.total_begone_revenue = month.private_revenue + month.business_revenue
        month.total_begone_cases = month.private_cases_count + month.business_cases_count
        month.avg_case_value = month.total_begone_cases > 0 
          ? month.total_begone_revenue / month.total_begone_cases 
          : 0
      })

      const sortedData = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month))
      setData(sortedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Briefcase className="w-5 h-5 text-orange-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Ärendestatistik</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Briefcase className="w-5 h-5 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Ärendestatistik</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-red-400">
          <span>Fel vid laddning: {error}</span>
        </div>
      </Card>
    )
  }

  // Filtrera data baserat på vald period
  const getFilteredData = () => {
    const monthsToShow = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    return data.slice(-monthsToShow)
  }

  const filteredData = getFilteredData()

  // Formatera data för chart
  const chartData = filteredData.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('sv-SE', { 
      month: 'short', 
      year: '2-digit' 
    }),
    fullMonth: item.month,
    'Privatperson Ärenden': item.private_cases_count,
    'Företag Ärenden': item.business_cases_count,
    'Privatperson Intäkt': item.private_revenue,
    'Företag Intäkt': item.business_revenue,
    'Total Intäkt': item.total_begone_revenue,
    'Genomsnittspris': item.avg_case_value,
    'Totala Ärenden': item.total_begone_cases
  }))

  // Beräkna totaler för period
  const totalPrivateCases = filteredData.reduce((sum, item) => sum + item.private_cases_count, 0)
  const totalBusinessCases = filteredData.reduce((sum, item) => sum + item.business_cases_count, 0)
  const totalPrivateRevenue = filteredData.reduce((sum, item) => sum + item.private_revenue, 0)
  const totalBusinessRevenue = filteredData.reduce((sum, item) => sum + item.business_revenue, 0)
  const totalRevenue = totalPrivateRevenue + totalBusinessRevenue
  const totalCases = totalPrivateCases + totalBusinessCases
  const avgCaseValue = totalCases > 0 ? totalRevenue / totalCases : 0

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
          <p className="text-white font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {
                entry.name.includes('Intäkt') || entry.name.includes('pris') 
                  ? formatCurrency(entry.value)
                  : entry.value
              }
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Briefcase className="w-5 h-5 text-orange-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Ärendestatistik</h2>
          <span className="ml-2 text-sm text-slate-400">(Endast avslutade ärenden)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View type filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['cases', 'revenue', 'both'] as const).map((type) => (
              <Button
                key={type}
                variant={viewType === type ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setViewType(type)}
                className="text-xs"
              >
                {type === 'cases' ? 'Ärenden' : type === 'revenue' ? 'Intäkter' : 'Båda'}
              </Button>
            ))}
          </div>
          
          {/* Period filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['3m', '6m', '12m'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="text-xs"
              >
                {period === '3m' ? '3 mån' : period === '6m' ? '6 mån' : '12 mån'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Statistik kort */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-orange-400 font-bold text-lg">{totalCases}</p>
          <p className="text-orange-300 text-sm">Totala ärenden</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-purple-400 font-bold text-lg">{totalPrivateCases}</p>
          <p className="text-purple-300 text-sm">Privatpersoner</p>
        </div>
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 font-bold text-lg">{totalBusinessCases}</p>
          <p className="text-blue-300 text-sm">Företag</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-lg">{formatCurrency(totalRevenue)}</p>
          <p className="text-green-300 text-sm">Total intäkt</p>
        </div>
        <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 font-bold text-lg">{formatCurrency(avgCaseValue)}</p>
          <p className="text-yellow-300 text-sm">Snitt per ärende</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {viewType === 'cases' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8"
                fontSize={12}
              />
              <YAxis 
                stroke="#94a3b8"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar 
                dataKey="Privatperson Ärenden" 
                fill="#a855f7" 
                name="Privatperson"
                stackId="cases"
              />
              <Bar 
                dataKey="Företag Ärenden" 
                fill="#3b82f6" 
                name="Företag"
                stackId="cases"
              />
            </BarChart>
          ) : viewType === 'revenue' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8"
                fontSize={12}
              />
              <YAxis 
                stroke="#94a3b8"
                fontSize={12}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar 
                dataKey="Privatperson Intäkt" 
                fill="#a855f7" 
                name="Privatperson"
                stackId="revenue"
              />
              <Bar 
                dataKey="Företag Intäkt" 
                fill="#3b82f6" 
                name="Företag"
                stackId="revenue"
              />
            </BarChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="#94a3b8"
                fontSize={12}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                stroke="#94a3b8"
                fontSize={12}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar 
                yAxisId="left"
                dataKey="Totala Ärenden" 
                fill="#f97316" 
                name="Antal ärenden"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="Total Intäkt" 
                stroke="#10b981" 
                strokeWidth={3}
                name="Total intäkt"
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Trend analys */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Privatperson andel:</span>
            <span className="text-purple-400 font-semibold">
              {totalCases > 0 ? ((totalPrivateCases / totalCases) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Företag andel:</span>
            <span className="text-blue-400 font-semibold">
              {totalCases > 0 ? ((totalBusinessCases / totalCases) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Privatperson snitt:</span>
            <span className="text-purple-400 font-semibold">
              {formatCurrency(totalPrivateCases > 0 ? totalPrivateRevenue / totalPrivateCases : 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Företag snitt:</span>
            <span className="text-blue-400 font-semibold">
              {formatCurrency(totalBusinessCases > 0 ? totalBusinessRevenue / totalBusinessCases : 0)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default BeGoneMonthlyStatsChart
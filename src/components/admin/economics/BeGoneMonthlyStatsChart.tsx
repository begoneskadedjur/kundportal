// src/components/admin/economics/BeGoneMonthlyStatsChart.tsx - FIXAD VERSION MED INTÄKTER
import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart, PieChart, Pie, Cell } from 'recharts'
import { Briefcase, TrendingUp, Users, Calendar, DollarSign, ChevronLeft, ChevronRight, Bug, MapPin, AlertTriangle, RefreshCw } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

// 🎯 Interface structure
interface BeGoneStats {
  monthlyData: Array<{
    month: string
    private_cases: number
    business_cases: number
    private_revenue: number
    business_revenue: number
    total_cases: number
    total_revenue: number
    avg_case_value: number
  }>
  allCasesData: Array<{
    case_id: string
    type: 'private' | 'business'
    pris: number
    completed_date: string
    primary_assignee_name: string
    skadedjur: string
    status: string
  }>
  ongoingCasesData: Array<{
    status: string
  }>
}

interface AnalysisData {
  technicianData: Array<{
    name: string
    cases: number
    revenue: number
  }>
  skadedjurData: Array<{
    type: string
    count: number
    percentage: number
    revenue: number
  }>
  statusData: Array<{
    status: string
    count: number
  }>
}

const BeGoneMonthlyStatsChart: React.FC = () => {
  // State
  const [data, setData] = useState<BeGoneStats>({
    monthlyData: [],
    allCasesData: [],
    ongoingCasesData: []
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m')
  const [activeTab, setActiveTab] = useState<'overview' | 'technicians' | 'skadedjur' | 'status'>('overview')

  useEffect(() => {
    fetchBeGoneData()
  }, [])

  // 🔄 Förbättrad data fetching - hämtar RAW data en gång
  const fetchBeGoneData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching BeGone data...')
      
      // Hämta data från senaste 12 månaderna
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // 1. Hämta ALL data från båda tabellerna
      const [privateResult, businessResult, ongoingPrivateResult, ongoingBusinessResult] = await Promise.all([
        supabase
          .from('private_cases')
          .select('id, pris, completed_date, primary_assignee_name, skadedjur, status')
          .eq('status', 'Avslutat')
          .gte('completed_date', dateString)
          .not('completed_date', 'is', null),
        
        supabase
          .from('business_cases')
          .select('id, pris, completed_date, primary_assignee_name, skadedjur, status')
          .eq('status', 'Avslutat')
          .gte('completed_date', dateString)
          .not('completed_date', 'is', null),
        
        supabase
          .from('private_cases')
          .select('status')
          .neq('status', 'Avslutat'),
        
        supabase
          .from('business_cases')
          .select('status')
          .neq('status', 'Avslutat')
      ])

      if (privateResult.error) throw new Error(`Private cases: ${privateResult.error.message}`)
      if (businessResult.error) throw new Error(`Business cases: ${businessResult.error.message}`)

      // Kombinera all case data
      const allCasesData = [
        ...(privateResult.data || []).map(case_ => ({
          case_id: case_.id,
          type: 'private' as const,
          pris: case_.pris || 0,
          completed_date: case_.completed_date,
          primary_assignee_name: case_.primary_assignee_name || 'Ej tilldelad',
          skadedjur: case_.skadedjur || 'Okänt',
          status: case_.status
        })),
        ...(businessResult.data || []).map(case_ => ({
          case_id: case_.id,
          type: 'business' as const,
          pris: case_.pris || 0,
          completed_date: case_.completed_date,
          primary_assignee_name: case_.primary_assignee_name || 'Ej tilldelad',
          skadedjur: case_.skadedjur || 'Okänt',
          status: case_.status
        }))
      ]

      const ongoingCasesData = [
        ...(ongoingPrivateResult.data || []),
        ...(ongoingBusinessResult.data || [])
      ]

      console.log(`📊 Loaded: ${allCasesData.length} completed cases, ${ongoingCasesData.length} ongoing`)

      // Processa månadsdata
      const monthlyData = processMonthlyData(allCasesData)
      
      setData({
        monthlyData,
        allCasesData,
        ongoingCasesData
      })
      
      console.log('✅ BeGone data processed successfully')
      
    } catch (err) {
      console.error('❌ fetchBeGoneData error:', err)
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av data')
    } finally {
      setLoading(false)
    }
  }

  // 📊 Process monthly data from raw cases
  const processMonthlyData = (allCases: BeGoneStats['allCasesData']) => {
    const monthlyStats: { [key: string]: any } = {}
    
    // Skapa 12 månader
    for (let i = 11; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().slice(0, 7)
      
      monthlyStats[monthKey] = {
        month: monthKey,
        private_cases: 0,
        business_cases: 0,
        private_revenue: 0,
        business_revenue: 0,
        total_cases: 0,
        total_revenue: 0,
        avg_case_value: 0
      }
    }

    // Lägg till case data
    allCases.forEach(case_ => {
      if (case_?.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyStats[monthKey]) {
          if (case_.type === 'private') {
            monthlyStats[monthKey].private_cases++
            monthlyStats[monthKey].private_revenue += case_.pris
          } else {
            monthlyStats[monthKey].business_cases++
            monthlyStats[monthKey].business_revenue += case_.pris
          }
        }
      }
    })

    // Beräkna totaler
    Object.values(monthlyStats).forEach((month: any) => {
      month.total_cases = month.private_cases + month.business_cases
      month.total_revenue = month.private_revenue + month.business_revenue
      month.avg_case_value = month.total_cases > 0 ? month.total_revenue / month.total_cases : 0
    })

    return Object.values(monthlyStats).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }

  // 🎯 Memoized filtering - detta förhindrar infinite loops
  const getFilteredData = useMemo(() => {
    const selectedIndex = data.monthlyData.findIndex(item => item.month === selectedMonth)
    if (selectedIndex === -1) return []
    
    const monthsToShow = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    const startIndex = Math.max(0, selectedIndex - monthsToShow + 1)
    const endIndex = selectedIndex + 1
    
    return data.monthlyData.slice(startIndex, endIndex)
  }, [data.monthlyData, selectedMonth, selectedPeriod])

  // 🆕 Memoized analysis data baserat på vald period
  const getFilteredAnalysisData = useMemo((): AnalysisData => {
    if (!data.allCasesData.length) {
      return {
        technicianData: [],
        skadedjurData: [],
        statusData: []
      }
    }

    // Bestäm datumspan för filtrering
    const selectedIndex = data.monthlyData.findIndex(item => item.month === selectedMonth)
    if (selectedIndex === -1) {
      return {
        technicianData: [],
        skadedjurData: [],
        statusData: []
      }
    }
    
    const monthsToShow = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    const startIndex = Math.max(0, selectedIndex - monthsToShow + 1)
    const startMonth = data.monthlyData[startIndex]?.month
    const endMonth = selectedMonth

    console.log(`🔍 Filtering analysis data: ${startMonth} to ${endMonth}`)

    // Filtrera cases baserat på period
    const filteredCases = data.allCasesData.filter(case_ => {
      if (!case_.completed_date) return false
      const caseMonth = case_.completed_date.slice(0, 7)
      return caseMonth >= startMonth && caseMonth <= endMonth
    })

    console.log(`📊 Filtered to ${filteredCases.length} cases for analysis`)

    // 1. TEKNIKERDATA
    const technicianStats: { [key: string]: { cases: number; revenue: number } } = {}
    
    filteredCases.forEach(case_ => {
      const name = case_.primary_assignee_name || 'Ej tilldelad'
      if (!technicianStats[name]) {
        technicianStats[name] = { cases: 0, revenue: 0 }
      }
      technicianStats[name].cases++
      technicianStats[name].revenue += case_.pris
    })

    const technicianData = Object.entries(technicianStats)
      .map(([name, stats]) => ({
        name,
        cases: stats.cases,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    // 2. SKADEDJURDATA med intäkter
    const skadedjurStats: { [key: string]: { count: number; revenue: number } } = {}
    
    filteredCases.forEach(case_ => {
      const skadedjur = case_.skadedjur || 'Okänt'
      if (!skadedjurStats[skadedjur]) {
        skadedjurStats[skadedjur] = { count: 0, revenue: 0 }
      }
      skadedjurStats[skadedjur].count++
      skadedjurStats[skadedjur].revenue += case_.pris
    })

    const totalCases = filteredCases.length
    const skadedjurData = Object.entries(skadedjurStats)
      .map(([type, stats]) => ({
        type,
        count: stats.count,
        revenue: stats.revenue,
        percentage: totalCases > 0 ? (stats.count / totalCases) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue) // Sortera efter intäkt
      .slice(0, 8)

    // 3. STATUSDATA (använder ongoing data)
    const statusStats: { [key: string]: number } = {}
    
    data.ongoingCasesData.forEach(case_ => {
      const status = case_?.status || 'Okänd'
      statusStats[status] = (statusStats[status] || 0) + 1
    })

    const statusData = Object.entries(statusStats)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    return {
      technicianData,
      skadedjurData,
      statusData
    }
  }, [data.allCasesData, data.ongoingCasesData, data.monthlyData, selectedMonth, selectedPeriod])

  // Navigation functions
  const goToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prevDate = new Date(year, month - 2)
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month)
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }

  const canGoPrevious = () => {
    if (data.monthlyData.length === 0) return false
    const earliestMonth = data.monthlyData[0].month
    return selectedMonth > earliestMonth
  }

  const canGoNext = () => {
    if (data.monthlyData.length === 0) return false
    const latestMonth = data.monthlyData[data.monthlyData.length - 1].month
    return selectedMonth < latestMonth
  }

  const isCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth === currentMonth
  }

  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Briefcase className="w-5 h-5 text-orange-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Intäkter Engångsjobb</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            <p className="text-slate-400 text-sm">Laddar engångsjobb statistik...</p>
          </div>
        </div>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Briefcase className="w-5 h-5 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Intäkter Engångsjobb</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-red-400">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p className="mb-2">Fel vid laddning: {error}</p>
            <Button onClick={fetchBeGoneData} size="sm" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Försök igen
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Empty state
  if (!data.monthlyData || data.monthlyData.length === 0) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Briefcase className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Intäkter Engångsjobb</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen engångsjobb data tillgänglig</p>
          </div>
        </div>
      </Card>
    )
  }

  const selectedMonthData = data.monthlyData.find(item => item.month === selectedMonth)

  // Chart data
  const chartData = getFilteredData.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('sv-SE', { 
      month: 'short', 
      year: '2-digit' 
    }),
    'Privatperson': item.private_cases,
    'Företag': item.business_cases,
    'Privatperson Intäkt': item.private_revenue,
    'Företag Intäkt': item.business_revenue,
    'Total Intäkt': item.total_revenue,
    'Totala Ärenden': item.total_cases,
    isSelected: item.month === selectedMonth
  }))

  // Colors
  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16']

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0]?.payload
      const isSelectedMonth = data?.isSelected
      
      return (
        <div className={`border rounded-lg p-4 shadow-lg ${
          isSelectedMonth 
            ? 'bg-orange-800 border-orange-600' 
            : 'bg-slate-800 border-slate-700'
        }`}>
          <p className={`font-semibold mb-2 ${
            isSelectedMonth ? 'text-orange-200' : 'text-white'
          }`}>
            {label} {isSelectedMonth && '(Vald månad)'}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {
                entry.name.includes('Intäkt')
                  ? formatCurrency(entry.value || 0)
                  : (entry.value || 0)
              }
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // 🆕 Custom tooltip för tekniker/skadedjur med intäkter
  const RevenueTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0]?.payload
      
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2 text-white">{label}</p>
          <p className="text-sm text-green-400">
            Intäkt: {formatCurrency(data.revenue || 0)}
          </p>
          <p className="text-sm text-slate-300">
            Ärenden: {data.cases || data.count || 0}
          </p>
          {data.percentage && (
            <p className="text-sm text-slate-400">
              Andel: {data.percentage.toFixed(1)}%
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Huvudkort med navigation */}
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Briefcase className="w-5 h-5 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-white">Intäkter Engångsjobb</h2>
            <span className="ml-2 text-sm text-slate-400">(Endast avslutade ärenden)</span>
          </div>
          
          {/* Navigation */}
          <div className="flex items-center gap-4">
            {/* Månadväljare */}
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={goToPreviousMonth}
                disabled={!canGoPrevious()}
                className="p-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="px-3 py-1 text-white font-medium min-w-[140px] text-center">
                {formatSelectedMonth(selectedMonth)}
              </div>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={goToNextMonth}
                disabled={!canGoNext()}
                className="p-1"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {!isCurrentMonth() && (
              <Button
                variant="primary"
                size="sm"
                onClick={goToCurrentMonth}
                className="text-xs"
              >
                Nuvarande
              </Button>
            )}

            {/* Tab filter */}
            <div className="flex bg-slate-800 rounded-lg p-1">
              {(['overview', 'technicians', 'skadedjur', 'status'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className="text-xs"
                >
                  {tab === 'overview' ? 'Översikt' : 
                   tab === 'technicians' ? 'Tekniker' :
                   tab === 'skadedjur' ? 'Skadedjur' : 'Status'}
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

        {/* KPI för vald månad */}
        <div className="mb-6">
          <h3 className="text-sm text-slate-400 mb-3">
            {formatSelectedMonth(selectedMonth)} - Engångsjobb översikt
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 font-bold text-lg">{selectedMonthData?.total_cases || 0}</p>
              <p className="text-orange-300 text-sm">Totala ärenden</p>
            </div>
            <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-400 font-bold text-lg">{selectedMonthData?.private_cases || 0}</p>
              <p className="text-purple-300 text-sm">Privatpersoner</p>
            </div>
            <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 font-bold text-lg">{selectedMonthData?.business_cases || 0}</p>
              <p className="text-blue-300 text-sm">Företag</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 font-bold text-lg">{formatCurrency(selectedMonthData?.total_revenue || 0)}</p>
              <p className="text-green-300 text-sm">Total intäkt</p>
            </div>
            <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 font-bold text-lg">{formatCurrency(selectedMonthData?.avg_case_value || 0)}</p>
              <p className="text-yellow-300 text-sm">Snitt per ärende</p>
            </div>
          </div>
        </div>

        {/* Dynamisk innehåll baserat på activeTab */}
        {activeTab === 'overview' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Bar yAxisId="left" dataKey="Totala Ärenden" fill="#f97316" name="Antal ärenden" />
                <Line yAxisId="right" type="monotone" dataKey="Total Intäkt" stroke="#10b981" strokeWidth={3} name="Total intäkt" dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'technicians' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Top Tekniker ({selectedPeriod.toUpperCase()} period) - Sorterat efter intäkt
              </h4>
              {getFilteredAnalysisData.technicianData.slice(0, 6).map((tech, index) => (
                <div key={tech.name} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm`} 
                         style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                      {tech.name.charAt(0)}
                    </div>
                    <span className="text-white">{tech.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-semibold">{formatCurrency(tech.revenue)}</p>
                    <p className="text-slate-400 text-xs">{tech.cases} ärenden</p>
                  </div>
                </div>
              ))}
              {getFilteredAnalysisData.technicianData.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Inga tekniker för denna period</p>
                </div>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getFilteredAnalysisData.technicianData.slice(0, 6)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="revenue" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'skadedjur' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getFilteredAnalysisData.skadedjurData.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percentage }) => `${type}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {getFilteredAnalysisData.skadedjurData.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<RevenueTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Bug className="w-4 h-4 text-red-500" />
                Top Skadedjurstyper ({selectedPeriod.toUpperCase()} period) - Sorterat efter intäkt
              </h4>
              {getFilteredAnalysisData.skadedjurData.slice(0, 8).map((item, index) => (
                <div key={item.type} className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-slate-300">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-green-400 font-semibold text-sm">{formatCurrency(item.revenue)}</p>
                      <p className="text-slate-400 text-xs">{item.count} ärenden ({item.percentage.toFixed(1)}%)</p>
                    </div>
                  </div>
                </div>
              ))}
              {getFilteredAnalysisData.skadedjurData.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  <Bug className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Inga skadedjur för denna period</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-3">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-500" />
              Pågående Ärenden Status (Alla)
            </h4>
            {getFilteredAnalysisData.statusData.length > 0 ? (
              getFilteredAnalysisData.statusData.map((status, index) => (
                <div key={status.status} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-slate-300">{status.status}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{status.count}</span>
                    <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${(status.count / Math.max(...getFilteredAnalysisData.statusData.map(s => s.count))) * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-8">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Inga pågående ärenden</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export default BeGoneMonthlyStatsChart
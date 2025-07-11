// 📁 src/components/admin/economics/BeGoneTechnicianChart.tsx - FIXAD VERSION
import React, { useState, useEffect, useMemo } from 'react'
import { Wrench, Award, Target, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

interface TechnicianData {
  name: string
  email?: string
  total_cases: number
  private_cases: number
  business_cases: number
  total_revenue: number
  private_revenue: number
  business_revenue: number
  avg_case_value: number
  rank: number
}

interface BeGoneCasesData {
  privateCases: Array<{
    primary_assignee_name: string
    primary_assignee_email?: string
    pris: number
    completed_date: string
  }>
  businessCases: Array<{
    primary_assignee_name: string
    primary_assignee_email?: string
    pris: number
    completed_date: string
  }>
}

const BeGoneTechnicianChart: React.FC = () => {
  // State
  const [allData, setAllData] = useState<BeGoneCasesData>({
    privateCases: [],
    businessCases: []
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Månad och period navigation
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('6m')

  useEffect(() => {
    fetchBeGoneTechnicianData()
  }, [])

  // 🔄 Hämta BARA BeGone tekniker data
  const fetchBeGoneTechnicianData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching BeGone technician data...')
      
      // Hämta data från senaste 12 månaderna
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // 1. BeGone privatpersonsärenden
      const { data: privateCases, error: privateError } = await supabase
        .from('private_cases')
        .select('primary_assignee_name, primary_assignee_email, pris, completed_date')
        .eq('status', 'Avslutat')
        .not('primary_assignee_name', 'is', null)
        .not('completed_date', 'is', null)
        .gte('completed_date', dateString)

      if (privateError) {
        console.error('❌ Private cases error:', privateError)
        throw new Error(`Private cases: ${privateError.message}`)
      }

      // 2. BeGone företagsärenden
      const { data: businessCases, error: businessError } = await supabase
        .from('business_cases')
        .select('primary_assignee_name, primary_assignee_email, pris, completed_date')
        .eq('status', 'Avslutat')
        .not('primary_assignee_name', 'is', null)
        .not('completed_date', 'is', null)
        .gte('completed_date', dateString)

      if (businessError) {
        console.error('❌ Business cases error:', businessError)
        throw new Error(`Business cases: ${businessError.message}`)
      }

      console.log(`📊 Loaded BeGone data: ${(privateCases || []).length} private, ${(businessCases || []).length} business cases`)

      setAllData({
        privateCases: privateCases || [],
        businessCases: businessCases || []
      })
      
      console.log('✅ BeGone technician data processed successfully')
      
    } catch (err) {
      console.error('❌ fetchBeGoneTechnicianData error:', err)
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone teknikerdata')
    } finally {
      setLoading(false)
    }
  }

  // 🎯 Memoized processing av BeGone tekniker-data baserat på vald period
  const technicianData = useMemo((): TechnicianData[] => {
    if (!allData.privateCases.length && !allData.businessCases.length) {
      return []
    }

    // Bestäm datumspan för filtrering
    const allDates = [
      ...allData.privateCases.map(c => c.completed_date),
      ...allData.businessCases.map(c => c.completed_date)
    ].filter(Boolean).map(date => date.slice(0, 7)).sort()

    const uniqueDates = Array.from(new Set(allDates)).sort()
    const selectedIndex = uniqueDates.findIndex(month => month === selectedMonth)
    
    if (selectedIndex === -1) {
      console.log(`⚠️ Selected month ${selectedMonth} not found in BeGone data`)
      return []
    }
    
    const monthsToShow = selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    const startIndex = Math.max(0, selectedIndex - monthsToShow + 1)
    const endMonth = selectedMonth
    const startMonth = uniqueDates[startIndex]

    console.log(`🔍 Filtering BeGone technician data: ${startMonth} to ${endMonth} (${monthsToShow} months)`)

    // Filtrera BeGone cases baserat på period
    const filteredPrivateCases = allData.privateCases.filter(case_ => {
      if (!case_.completed_date) return false
      const caseMonth = case_.completed_date.slice(0, 7)
      return caseMonth >= startMonth && caseMonth <= endMonth
    })

    const filteredBusinessCases = allData.businessCases.filter(case_ => {
      if (!case_.completed_date) return false
      const caseMonth = case_.completed_date.slice(0, 7)
      return caseMonth >= startMonth && caseMonth <= endMonth
    })

    console.log(`📊 Filtered BeGone data: ${filteredPrivateCases.length} private, ${filteredBusinessCases.length} business cases`)

    // Samla BeGone tekniker-statistik
    const technicianStats: { [key: string]: any } = {}

    // BeGone privatpersoner
    filteredPrivateCases.forEach(case_ => {
      const name = case_.primary_assignee_name || 'Ej tilldelad'
      const email = case_.primary_assignee_email || ''
      
      if (!technicianStats[name]) {
        technicianStats[name] = {
          name,
          email,
          total_cases: 0,
          private_cases: 0,
          business_cases: 0,
          total_revenue: 0,
          private_revenue: 0,
          business_revenue: 0
        }
      }
      
      technicianStats[name].total_cases++
      technicianStats[name].private_cases++
      technicianStats[name].total_revenue += case_.pris || 0
      technicianStats[name].private_revenue += case_.pris || 0
    })

    // BeGone företag
    filteredBusinessCases.forEach(case_ => {
      const name = case_.primary_assignee_name || 'Ej tilldelad'
      const email = case_.primary_assignee_email || ''
      
      if (!technicianStats[name]) {
        technicianStats[name] = {
          name,
          email,
          total_cases: 0,
          private_cases: 0,
          business_cases: 0,
          total_revenue: 0,
          private_revenue: 0,
          business_revenue: 0
        }
      }
      
      technicianStats[name].total_cases++
      technicianStats[name].business_cases++
      technicianStats[name].total_revenue += case_.pris || 0
      technicianStats[name].business_revenue += case_.pris || 0
    })

    // Konvertera till array och beräkna genomsnitt + ranking
    const technicianArray = Object.values(technicianStats)
      .map((tech: any) => ({
        ...tech,
        avg_case_value: tech.total_cases > 0 ? tech.total_revenue / tech.total_cases : 0
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .map((tech, index) => ({
        ...tech,
        rank: index + 1
      }))

    console.log(`✅ Processed ${technicianArray.length} BeGone technicians for period`)
    return technicianArray
  }, [allData, selectedMonth, selectedPeriod])

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
    if (!allData.privateCases.length && !allData.businessCases.length) return false
    
    const allDates = [
      ...allData.privateCases.map(c => c.completed_date),
      ...allData.businessCases.map(c => c.completed_date)
    ].filter(Boolean).map(date => date.slice(0, 7)).sort()
    
    const uniqueDates = Array.from(new Set(allDates)).sort()
    const earliestMonth = uniqueDates[0]
    return selectedMonth > earliestMonth
  }

  const canGoNext = () => {
    if (!allData.privateCases.length && !allData.businessCases.length) return false
    
    const allDates = [
      ...allData.privateCases.map(c => c.completed_date),
      ...allData.businessCases.map(c => c.completed_date)
    ].filter(Boolean).map(date => date.slice(0, 7)).sort()
    
    const uniqueDates = Array.from(new Set(allDates)).sort()
    const latestMonth = uniqueDates[uniqueDates.length - 1]
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

  // 🏆 Medal components
  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return `#${rank}`
    }
  }

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-yellow-500 to-yellow-600 border-yellow-500'
      case 2: return 'from-gray-400 to-gray-500 border-gray-400'
      case 3: return 'from-amber-600 to-amber-700 border-amber-600'
      default: return 'from-slate-600 to-slate-700 border-slate-600'
    }
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Wrench className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <p className="text-slate-400 text-sm">Laddar BeGone tekniker statistik...</p>
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
          <Wrench className="w-5 h-5 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-red-400">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-4" />
            <p className="mb-2">Fel vid laddning: {error}</p>
            <Button onClick={fetchBeGoneTechnicianData} size="sm" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Försök igen
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Empty state
  if (!technicianData || technicianData.length === 0) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Wrench className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen BeGone teknikerdata tillgänglig för vald period</p>
          </div>
        </div>
      </Card>
    )
  }

  const totalRevenue = technicianData.reduce((sum, tech) => sum + tech.total_revenue, 0)
  const totalCases = technicianData.reduce((sum, tech) => sum + tech.total_cases, 0)
  const totalPrivateRevenue = technicianData.reduce((sum, tech) => sum + tech.private_revenue, 0)
  const totalBusinessRevenue = technicianData.reduce((sum, tech) => sum + tech.business_revenue, 0)

  return (
    <Card>
      {/* Header med navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Wrench className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">BeGone Tekniker-prestanda</h2>
          <span className="ml-2 text-sm text-slate-400">(Bara engångsjobb)</span>
        </div>
        
        {/* Navigation - 🔧 FIXAD: Responsiv layout för period-knappar */}
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Period filter - 🔧 FIXAD: Mindre knappar för bättre passform */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['1m', '3m', '6m', '12m'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="text-xs px-2 py-1"
              >
                {period === '1m' ? '1' : period === '3m' ? '3' : period === '6m' ? '6' : '12'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Period översikt */}
      <div className="mb-6">
        <h3 className="text-sm text-slate-400 mb-3">
          {selectedPeriod === '1m' 
            ? `${formatSelectedMonth(selectedMonth)} - BeGone tekniker översikt`
            : `${formatSelectedMonth(selectedMonth)} (${selectedPeriod.toUpperCase()} period) - BeGone tekniker översikt`
          }
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 font-bold text-lg">{formatCurrency(totalRevenue)}</p>
            <p className="text-blue-300 text-sm">Total intäkt</p>
          </div>
          <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-400 font-bold text-lg">{formatCurrency(totalPrivateRevenue)}</p>
            <p className="text-purple-300 text-sm">Privatpersoner</p>
          </div>
          <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-bold text-lg">{formatCurrency(totalBusinessRevenue)}</p>
            <p className="text-orange-300 text-sm">Företag</p>
          </div>
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 font-bold text-lg">{totalCases}</p>
            <p className="text-green-300 text-sm">Totala ärenden</p>
          </div>
        </div>
      </div>

      {/* 🏆 Top 3 podium */}
      {technicianData.length >= 3 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Topp 3 BeGone Tekniker
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {technicianData.slice(0, 3).map((tech, index) => (
              <div key={tech.name} className={`relative bg-gradient-to-br ${getMedalColor(tech.rank)} p-4 rounded-lg border-2`}>
                <div className="text-center">
                  <div className="text-3xl mb-2">{getMedalIcon(tech.rank)}</div>
                  <h4 className="text-white font-bold text-lg mb-1">{tech.name}</h4>
                  <p className="text-white/90 font-semibold text-xl mb-2">{formatCurrency(tech.total_revenue)}</p>
                  <div className="space-y-1 text-white/80 text-sm">
                    <p>{tech.total_cases} ärenden totalt</p>
                    <p>{tech.private_cases} privatperson • {tech.business_cases} företag</p>
                    <p>⌀ {formatCurrency(tech.avg_case_value)}/ärende</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📊 Fullständig tekniker-lista */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          Alla BeGone Tekniker
          <span className="text-sm text-slate-400 font-normal">({technicianData.length} tekniker)</span>
        </h3>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {technicianData.map((tech) => (
            <div 
              key={tech.name} 
              className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                tech.rank <= 3 
                  ? `bg-gradient-to-r ${getMedalColor(tech.rank)} bg-opacity-20 border-opacity-40` 
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                  tech.rank <= 3 ? 'bg-white/20' : 'bg-slate-700'
                }`}>
                  {getMedalIcon(tech.rank)}
                </div>
                <div>
                  <h4 className="text-white font-semibold">{tech.name}</h4>
                  <p className="text-slate-400 text-sm">
                    {tech.total_cases} ärenden ({tech.private_cases} privatperson + {tech.business_cases} företag)
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-green-400 font-bold text-lg">{formatCurrency(tech.total_revenue)}</p>
                <div className="text-slate-400 text-sm space-y-1">
                  <p>Privatperson: {formatCurrency(tech.private_revenue)}</p>
                  <p>Företag: {formatCurrency(tech.business_revenue)}</p>
                  <p>⌀ {formatCurrency(tech.avg_case_value)}/ärende</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default BeGoneTechnicianChart
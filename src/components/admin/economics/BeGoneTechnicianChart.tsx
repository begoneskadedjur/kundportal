// 📁 src/components/admin/economics/BeGoneTechnicianChart.tsx - MODERN VERSION
import React, { useState, useEffect, useMemo } from 'react'
import { Wrench, Target, TrendingUp } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

// Nya moderna komponenter
import ModernCard from '../../ui/ModernCard'
import { CombinedNavigation } from '../../ui/ModernNavigation'
import ModernPodium, { formatTechnicianForPodium } from '../../ui/ModernPodium'
import ModernList, { createListItem } from '../../ui/ModernList'

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
  
  // Navigation state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('6m')

  // Period options för navigation
  const periodOptions = [
    { key: '1m', label: '1 månad', shortLabel: '1M' },
    { key: '3m', label: '3 månader', shortLabel: '3M' },
    { key: '6m', label: '6 månader', shortLabel: '6M' },
    { key: '12m', label: '12 månader', shortLabel: '12M' }
  ]

  useEffect(() => {
    fetchBeGoneTechnicianData()
  }, [])

  // 🔄 Hämta BeGone tekniker data
  const fetchBeGoneTechnicianData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching BeGone technician data...')
      
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // Hämta privatpersonsärenden
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

      // Hämta företagsärenden
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

  // 🎯 Processad tekniker-data baserat på vald period
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

    // Filtrera cases baserat på period
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

    // Samla tekniker-statistik
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

  const goToCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }

  // Loading state
  if (loading) {
    return (
      <ModernCard gradient="blue" glowing>
        <ModernCard.Header
          icon={Wrench}
          iconColor="text-blue-500"
          title="BeGone Tekniker-prestanda"
          subtitle="Laddar data..."
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p className="text-slate-400 text-sm">Laddar BeGone tekniker statistik...</p>
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
          icon={Wrench}
          iconColor="text-red-500"
          title="BeGone Tekniker-prestanda"
          subtitle="Fel vid laddning"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-red-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4" />
              <p className="mb-2">Fel vid laddning: {error}</p>
              <button
                onClick={fetchBeGoneTechnicianData}
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
  if (!technicianData || technicianData.length === 0) {
    return (
      <ModernCard>
        <ModernCard.Header
          icon={Wrench}
          iconColor="text-slate-500"
          title="BeGone Tekniker-prestanda"
          subtitle="Ingen data tillgänglig"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ingen BeGone teknikerdata tillgänglig för vald period</p>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  // Beräkna sammanfattning
  const totalRevenue = technicianData.reduce((sum, tech) => sum + tech.total_revenue, 0)
  const totalCases = technicianData.reduce((sum, tech) => sum + tech.total_cases, 0)
  const totalPrivateRevenue = technicianData.reduce((sum, tech) => sum + tech.private_revenue, 0)
  const totalBusinessRevenue = technicianData.reduce((sum, tech) => sum + tech.business_revenue, 0)

  // Formatera data för podium
  const podiumData = technicianData.slice(0, 3).map(tech => 
    formatTechnicianForPodium(tech, formatCurrency)
  )

  // Formatera data för lista
  const listData = technicianData.map(tech => 
    createListItem(
      tech.name,
      tech.name,
      tech.total_revenue,
      `${tech.total_cases} ärenden`,
      {
        rank: tech.rank,
        status: 'active',
        metadata: [
          { label: 'Privatpersoner', value: `${tech.private_cases} (${formatCurrency(tech.private_revenue)})` },
          { label: 'Företag', value: `${tech.business_cases} (${formatCurrency(tech.business_revenue)})` },
          { label: 'Genomsnitt', value: formatCurrency(tech.avg_case_value) }
        ]
      }
    )
  )

  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-8">
      {/* Header med navigation */}
      <ModernCard gradient="blue" glowing>
        <ModernCard.Header
          icon={Wrench}
          iconColor="text-blue-500"
          title="BeGone Tekniker-prestanda"
          subtitle="Bara engångsjobb"
          rightElement={
            <CombinedNavigation
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              selectedPeriod={selectedPeriod}
              onPeriodChange={(period) => setSelectedPeriod(period as '1m' | '3m' | '6m' | '12m')}
              periods={periodOptions}
              canGoPrevious={canGoPrevious()}
              canGoNext={canGoNext()}
              onGoToCurrent={goToCurrentMonth}
              isCurrentMonth={isCurrentMonth()}
              compact
            />
          }
        />
        
        {/* Period översikt med moderna stat cards */}
        <ModernCard.Content>
          <div className="mb-6">
            <h3 className="text-sm text-slate-400 mb-4">
              {selectedPeriod === '1m' 
                ? `${formatSelectedMonth(selectedMonth)} - BeGone tekniker översikt`
                : `${formatSelectedMonth(selectedMonth)} (${selectedPeriod.toUpperCase()} period) - BeGone tekniker översikt`
              }
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <ModernCard.Stat
                icon={TrendingUp}
                iconGradient="from-blue-500 to-blue-600"
                label="Total intäkt"
                value={formatCurrency(totalRevenue)}
                change={{ value: '↗️', positive: true }}
              />
              <ModernCard.Stat
                icon={Wrench}
                iconGradient="from-purple-500 to-purple-600"
                label="Privatpersoner"
                value={formatCurrency(totalPrivateRevenue)}
              />
              <ModernCard.Stat
                icon={Target}
                iconGradient="from-orange-500 to-orange-600"
                label="Företag"
                value={formatCurrency(totalBusinessRevenue)}
              />
              <ModernCard.Stat
                icon={Wrench}
                iconGradient="from-green-500 to-green-600"
                label="Totala ärenden"
                value={totalCases}
              />
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>

      {/* 🏆 Topp 3 podium */}
      {technicianData.length >= 3 && (
        <ModernPodium
          items={podiumData}
          title="Topp 3 BeGone Tekniker"
          subtitle="Bäst presterande tekniker för vald period"
          valueLabel="Baserat på total intäkt från avslutade ärenden"
          variant="detailed"
          showMetrics
          formatValue={formatCurrency}
        />
      )}

      {/* 📊 Fullständig tekniker-lista */}
      <ModernList
        items={listData}
        title="Alla BeGone Tekniker"
        subtitle="Komplett lista över alla tekniker med prestanda-data"
        formatPrimaryValue={formatCurrency}
        showRanking
        searchable
        sortable
      />
    </div>
  )
}

export default BeGoneTechnicianChart
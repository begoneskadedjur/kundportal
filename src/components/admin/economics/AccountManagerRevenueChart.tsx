// 📁 src/components/admin/economics/AccountManagerRevenueChart.tsx - AVTALSKUNDER TEKNIKER
import React, { useState, useEffect, useMemo } from 'react'
import { Building2, Award, Target, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

interface ContractTechnicianData {
  name: string
  email?: string
  total_cases: number
  new_customers: number
  upsell_cases: number
  total_revenue: number
  new_customer_value: number
  upsell_revenue: number
  avg_case_value: number
  avg_new_customer_value: number
  rank: number
}

interface ContractCasesData {
  cases: Array<{
    assigned_technician_name: string
    assigned_technician_email: string
    price: number
    completed_date: string
    case_type: string
    customer_id: number
  }>
  customers: Array<{
    id: number
    annual_premium: number
    total_contract_value: number
    created_at: string
  }>
}

const ContractTechnicianRevenueChart: React.FC = () => {
  // State
  const [allData, setAllData] = useState<ContractCasesData>({
    cases: [],
    customers: []
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
    fetchContractTechnicianData()
  }, [])

  // 🔄 Hämta avtalskund tekniker data
  const fetchContractTechnicianData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching contract technician data...')
      
      // Hämta data från senaste 12 månaderna
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // 1. Avtalskunder ärenden (merförsäljning)
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('assigned_technician_name, assigned_technician_email, price, completed_date, case_type, customer_id')
        .not('assigned_technician_name', 'is', null)
        .not('completed_date', 'is', null)
        .gte('completed_date', dateString)

      if (casesError) {
        console.error('❌ Contract cases error:', casesError)
        throw new Error(`Contract cases: ${casesError.message}`)
      }

      // 2. Nya avtalskunder (för att beräkna nya kunder per tekniker)
      // TILLFÄLLIGT: Returnera tom array eftersom customers-tabellen är tom
      const customers: any[] = []
      const customersError = null
      
      // const { data: customers, error: customersError } = await supabase
      //   .from('customers')
      //   .select('id, annual_value, total_contract_value, created_at')
      //   .gte('created_at', dateString)
      //   .eq('is_active', true)

      // if (customersError) {
      //   console.error('❌ Customers error:', customersError)
      //   throw new Error(`Customers: ${customersError.message}`)
      // }

      console.log(`📊 Loaded contract data: ${(cases || []).length} cases, ${(customers || []).length} new customers`)

      setAllData({
        cases: cases || [],
        customers: customers || []
      })
      
      console.log('✅ Contract technician data processed successfully')
      
    } catch (err) {
      console.error('❌ fetchContractTechnicianData error:', err)
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av avtalskund teknikerdata')
    } finally {
      setLoading(false)
    }
  }

  // 🎯 Memoized processing av avtalskund tekniker-data baserat på vald period
  const getTechnicianData = useMemo((): ContractTechnicianData[] => {
    if (!allData.cases.length) {
      return []
    }

    // Bestäm datumspan för filtrering
    const allCaseDates = allData.cases
      .map(c => c.completed_date)
      .filter(Boolean)
      .map(date => date.slice(0, 7))
      .sort()

    const selectedIndex = allCaseDates.findIndex(month => month === selectedMonth)
    if (selectedIndex === -1) {
      console.log(`⚠️ Selected month ${selectedMonth} not found in contract data`)
      return []
    }
    
    const monthsToShow = selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    const startIndex = Math.max(0, selectedIndex - monthsToShow + 1)
    const endMonth = selectedMonth
    const startMonth = allCaseDates[startIndex]

    console.log(`🔍 Filtering contract technician data: ${startMonth} to ${endMonth} (${monthsToShow} months)`)

    // Filtrera cases baserat på period
    const filteredCases = allData.cases.filter(case_ => {
      if (!case_.completed_date) return false
      const caseMonth = case_.completed_date.slice(0, 7)
      return caseMonth >= startMonth && caseMonth <= endMonth
    })

    // Filtrera nya kunder baserat på period
    const filteredCustomers = allData.customers.filter(customer => {
      if (!customer.created_at) return false
      const customerMonth = customer.created_at.slice(0, 7)
      return customerMonth >= startMonth && customerMonth <= endMonth
    })

    console.log(`📊 Filtered contract data: ${filteredCases.length} cases, ${filteredCustomers.length} new customers`)

    // Samla avtalskund tekniker-statistik
    const technicianStats: { [key: string]: any } = {}

    // Beräkna nya kunder per tekniker (enkel fördelning baserat på cases)
    const customerTechnicianMap: { [customerId: number]: string } = {}
    filteredCases.forEach(case_ => {
      if (!customerTechnicianMap[case_.customer_id]) {
        customerTechnicianMap[case_.customer_id] = case_.assigned_technician_name
      }
    })

    // Merförsäljning ärenden
    filteredCases.forEach(case_ => {
      const name = case_.assigned_technician_name || 'Ej tilldelad'
      const email = case_.assigned_technician_email || ''
      
      if (!technicianStats[name]) {
        technicianStats[name] = {
          name,
          email,
          total_cases: 0,
          new_customers: 0,
          upsell_cases: 0,
          total_revenue: 0,
          new_customer_value: 0,
          upsell_revenue: 0
        }
      }
      
      technicianStats[name].total_cases++
      technicianStats[name].upsell_cases++
      technicianStats[name].total_revenue += case_.price || 0
      technicianStats[name].upsell_revenue += case_.price || 0
    })

    // Nya avtalskunder värde
    filteredCustomers.forEach(customer => {
      const assignedTechnician = customerTechnicianMap[customer.id]
      if (assignedTechnician && technicianStats[assignedTechnician]) {
        technicianStats[assignedTechnician].new_customers++
        technicianStats[assignedTechnician].new_customer_value += customer.total_contract_value || 0
        technicianStats[assignedTechnician].total_revenue += customer.annual_premium || 0
      }
    })

    // Konvertera till array och beräkna genomsnitt + ranking
    const technicianArray = Object.values(technicianStats)
      .map((tech: any) => ({
        ...tech,
        avg_case_value: tech.total_cases > 0 ? tech.total_revenue / tech.total_cases : 0,
        avg_new_customer_value: tech.new_customers > 0 ? tech.new_customer_value / tech.new_customers : 0
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .map((tech, index) => ({
        ...tech,
        rank: index + 1
      }))

    console.log(`✅ Processed ${technicianArray.length} contract technicians for period`)
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
    if (!allData.cases.length) return false
    
    const allDates = allData.cases
      .map(c => c.completed_date)
      .filter(Boolean)
      .map(date => date.slice(0, 7))
      .sort()
    
    const earliestMonth = allDates[0]
    return selectedMonth > earliestMonth
  }

  const canGoNext = () => {
    if (!allData.cases.length) return false
    
    const allDates = allData.cases
      .map(c => c.completed_date)
      .filter(Boolean)
      .map(date => date.slice(0, 7))
      .sort()
    
    const latestMonth = allDates[allDates.length - 1]
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
          <Building2 className="w-5 h-5 text-green-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Avtalskund Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
            <p className="text-slate-400 text-sm">Laddar avtalskund tekniker statistik...</p>
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
          <Building2 className="w-5 h-5 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Avtalskund Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-red-400">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-4" />
            <p className="mb-2">Fel vid laddning: {error}</p>
            <Button onClick={fetchContractTechnicianData} size="sm" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Försök igen
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Empty state
  if (!getTechnicianData || getTechnicianData.length === 0) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Building2 className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Avtalskund Tekniker-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen avtalskund teknikerdata tillgänglig för vald period</p>
          </div>
        </div>
      </Card>
    )
  }

  const technicianData = getTechnicianData
  const totalRevenue = technicianData.reduce((sum, tech) => sum + tech.total_revenue, 0)
  const totalCases = technicianData.reduce((sum, tech) => sum + tech.total_cases, 0)
  const totalNewCustomers = technicianData.reduce((sum, tech) => sum + tech.new_customers, 0)
  const totalNewCustomerValue = technicianData.reduce((sum, tech) => sum + tech.new_customer_value, 0)
  const totalUpsellRevenue = technicianData.reduce((sum, tech) => sum + tech.upsell_revenue, 0)

  return (
    <Card>
      {/* Header med navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Building2 className="w-5 h-5 text-green-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Avtalskund Tekniker-prestanda</h2>
          <span className="ml-2 text-sm text-slate-400">(Nya avtal + Merförsäljning)</span>
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

          {/* Period filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['1m', '3m', '6m', '12m'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="text-xs"
              >
                {period === '1m' ? '1 mån' : period === '3m' ? '3 mån' : period === '6m' ? '6 mån' : '12 mån'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Period översikt */}
      <div className="mb-6">
        <h3 className="text-sm text-slate-400 mb-3">
          {selectedPeriod === '1m' 
            ? `${formatSelectedMonth(selectedMonth)} - Avtalskund tekniker översikt`
            : `${formatSelectedMonth(selectedMonth)} (${selectedPeriod.toUpperCase()} period) - Avtalskund tekniker översikt`
          }
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 font-bold text-lg">{formatCurrency(totalRevenue)}</p>
            <p className="text-green-300 text-sm">Total intäkt</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 font-bold text-lg">{totalNewCustomers}</p>
            <p className="text-blue-300 text-sm">Nya avtal</p>
          </div>
          <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-400 font-bold text-lg">{formatCurrency(totalNewCustomerValue)}</p>
            <p className="text-purple-300 text-sm">Avtalsvärde</p>
          </div>
          <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 font-bold text-lg">{formatCurrency(totalUpsellRevenue)}</p>
            <p className="text-yellow-300 text-sm">Merförsäljning</p>
          </div>
          <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-bold text-lg">{totalCases}</p>
            <p className="text-orange-300 text-sm">Totala ärenden</p>
          </div>
        </div>
      </div>

      {/* 🏆 Top 3 podium */}
      {technicianData.length >= 3 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Topp 3 Avtalskund Tekniker
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {technicianData.slice(0, 3).map((tech, index) => (
              <div key={tech.name} className={`relative bg-gradient-to-br ${getMedalColor(tech.rank)} p-4 rounded-lg border-2`}>
                <div className="text-center">
                  <div className="text-3xl mb-2">{getMedalIcon(tech.rank)}</div>
                  <h4 className="text-white font-bold text-lg mb-1">{tech.name}</h4>
                  <p className="text-white/90 font-semibold text-xl mb-2">{formatCurrency(tech.total_revenue)}</p>
                  <div className="space-y-1 text-white/80 text-sm">
                    <p>{tech.new_customers} nya avtal • {tech.upsell_cases} merförsäljning</p>
                    <p>Avtalsvärde: {formatCurrency(tech.new_customer_value)}</p>
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
          <Target className="w-5 h-5 text-green-500" />
          Alla Avtalskund Tekniker
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
                    {tech.new_customers} nya avtal • {tech.upsell_cases} merförsäljning
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-green-400 font-bold text-lg">{formatCurrency(tech.total_revenue)}</p>
                <div className="text-slate-400 text-sm space-y-1">
                  <p>Avtalsvärde: {formatCurrency(tech.new_customer_value)}</p>
                  <p>Merförsäljning: {formatCurrency(tech.upsell_revenue)}</p>
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

export default ContractTechnicianRevenueChart
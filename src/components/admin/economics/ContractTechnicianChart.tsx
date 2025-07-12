// 📁 src/components/admin/economics/ContractTechnicianChart.tsx - MODERNISERAD VERSION
import React, { useState, useEffect, useMemo } from 'react'
import { Building2, Target, TrendingUp, Users, Briefcase } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

// Nya moderna komponenter
import ModernCard from '../../ui/ModernCard'
import { CombinedNavigation } from '../../ui/ModernNavigation'
import ModernList, { createListItem } from '../../ui/ModernList'

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
  avg_contract_value: number
  rank: number
}

interface ContractCasesData {
  cases: Array<{
    assigned_technician_name: string
    assigned_technician_email: string
    price: number
    completed_date: string
    case_type: string
    customer_id: string
  }>
  customers: Array<{
    id: string
    annual_premium: number
    total_contract_value: number
    created_at: string
    assigned_account_manager: string
    company_name: string
  }>
}

const ContractTechnicianChart: React.FC = () => {
  // State
  const [allData, setAllData] = useState<ContractCasesData>({
    cases: [],
    customers: []
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
    fetchContractTechnicianData()
  }, [])

  // 🔄 Hämta avtalskund tekniker data
  const fetchContractTechnicianData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching contract technician data...')
      
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

      // 2. Nya avtalskunder
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, annual_premium, total_contract_value, created_at, assigned_account_manager, company_name')
        .gte('created_at', dateString)
        .eq('is_active', true)

      if (customersError) {
        console.error('❌ Customers error:', customersError)
        throw new Error(`Customers: ${customersError.message}`)
      }

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

  // 🎯 Processad avtalskund tekniker-data baserat på vald period  
  const technicianData = useMemo((): ContractTechnicianData[] => {
    if (!allData.cases.length && !allData.customers.length) {
      return []
    }

    // Bestäm datumspan för filtrering
    const allCaseDates = allData.cases
      .map(c => c.completed_date)
      .filter(Boolean)
      .map(date => date.slice(0, 7))
    
    const allCustomerDates = allData.customers
      .map(c => c.created_at)
      .filter(Boolean)
      .map(date => date.slice(0, 7))

    const allDates = [...allCaseDates, ...allCustomerDates]
    const uniqueDates = Array.from(new Set(allDates)).sort()
    
    console.log(`🔍 Available contract months:`, uniqueDates)
    console.log(`🎯 Selected month: ${selectedMonth}, Period: ${selectedPeriod}`)
    
    let selectedIndex = uniqueDates.findIndex(month => month === selectedMonth)
    
    // Om vald månad inte finns, använd den senaste tillgängliga månaden
    if (selectedIndex === -1) {
      console.log(`⚠️ Selected month ${selectedMonth} not found, using latest available month`)
      selectedIndex = uniqueDates.length - 1
      if (selectedIndex < 0) {
        return []
      }
    }
    
    const monthsToShow = selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    const startIndex = Math.max(0, selectedIndex - monthsToShow + 1)
    const endMonth = uniqueDates[selectedIndex]
    const startMonth = uniqueDates[startIndex]

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

    // Om ingen filtrerad data, returnera tom array
    if (filteredCases.length === 0 && filteredCustomers.length === 0) {
      return []
    }

    // Samla avtalskund tekniker-statistik
    const technicianStats: { [key: string]: any } = {}

    // Merförsäljning ärenden från cases-tabellen
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
          upsell_revenue: 0,
          customer_contracts: []
        }
      }
      
      technicianStats[name].total_cases++
      technicianStats[name].upsell_cases++
      technicianStats[name].total_revenue += case_.price || 0
      technicianStats[name].upsell_revenue += case_.price || 0
    })

    // Nya avtalskunder från customers-tabellen - FÖRBÄTTRAD mappning
    filteredCustomers.forEach(customer => {
      const accountManagerEmail = customer.assigned_account_manager?.toLowerCase() || ''
      let technicianName = 'Ej tilldelad'
      
      // Expanderad mappning för att fånga fler tekniker
      if (accountManagerEmail.includes('christian.karlsson') || accountManagerEmail.includes('christian')) {
        technicianName = 'Christian Karlsson'
      } else if (accountManagerEmail.includes('kristian.agnevik') || accountManagerEmail.includes('kristian')) {
        technicianName = 'Kristian Agnevik'
      } else if (accountManagerEmail.includes('sofia.palshagen') || accountManagerEmail.includes('sofia')) {
        technicianName = 'Sofia Pålshagen'
      } else if (accountManagerEmail.includes('hans.norman') || accountManagerEmail.includes('hans')) {
        technicianName = 'Hans Norman'
      } else if (accountManagerEmail.includes('mathias') || accountManagerEmail.includes('carlsson')) {
        technicianName = 'Mathias Carlsson'
      } else if (accountManagerEmail.includes('kim') || accountManagerEmail.includes('wahlberg')) {
        technicianName = 'Kim Wahlberg'
      } else if (customer.assigned_account_manager && customer.assigned_account_manager.trim() !== '') {
        // Om det finns en account manager men vi inte kan matcha, använd det som finns
        technicianName = customer.assigned_account_manager.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())
      }

      if (!technicianStats[technicianName]) {
        technicianStats[technicianName] = {
          name: technicianName,
          email: customer.assigned_account_manager || '',
          total_cases: 0,
          new_customers: 0,
          upsell_cases: 0,
          total_revenue: 0,
          new_customer_value: 0,
          upsell_revenue: 0,
          customer_contracts: []
        }
      }

      technicianStats[technicianName].new_customers++
      technicianStats[technicianName].total_cases++
      
      // Använd annual_premium för intäkt istället för total_contract_value
      const customerRevenue = customer.annual_premium || 0
      const contractValue = customer.total_contract_value || 0
      
      technicianStats[technicianName].new_customer_value += contractValue
      technicianStats[technicianName].total_revenue += customerRevenue
      technicianStats[technicianName].customer_contracts.push(contractValue)

      console.log(`📊 Customer mapped: ${customer.company_name} → ${technicianName} (Revenue: ${customerRevenue}, Contract: ${contractValue})`)
    })

    // Konvertera till array och beräkna genomsnitt + ranking
    const technicianArray = Object.values(technicianStats)
      .map((tech: any) => ({
        ...tech,
        avg_case_value: tech.total_cases > 0 ? tech.total_revenue / tech.total_cases : 0,
        avg_contract_value: tech.customer_contracts.length > 0 
          ? tech.customer_contracts.reduce((sum: number, val: number) => sum + val, 0) / tech.customer_contracts.length 
          : 0
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
  const canGoPrevious = () => {
    if (!allData.cases.length && !allData.customers.length) return false
    
    const allDates = [
      ...allData.cases.map(c => c.completed_date),
      ...allData.customers.map(c => c.created_at)
    ].filter(Boolean).map(date => date.slice(0, 7))
    
    const uniqueDates = Array.from(new Set(allDates)).sort()
    const earliestMonth = uniqueDates[0]
    return selectedMonth > earliestMonth
  }

  const canGoNext = () => {
    if (!allData.cases.length && !allData.customers.length) return false
    
    const allDates = [
      ...allData.cases.map(c => c.completed_date),
      ...allData.customers.map(c => c.created_at)
    ].filter(Boolean).map(date => date.slice(0, 7))
    
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

  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  // Loading state
  if (loading) {
    return (
      <ModernCard gradient="green" glowing>
        <ModernCard.Header
          icon={Building2}
          iconColor="text-green-500"
          title="Avtalskund Tekniker-prestanda"
          subtitle="Laddar data..."
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
              <p className="text-slate-400 text-sm">Laddar avtalskund tekniker statistik...</p>
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
          icon={Building2}
          iconColor="text-red-500"
          title="Avtalskund Tekniker-prestanda"
          subtitle="Fel vid laddning"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-red-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4" />
              <p className="mb-2">Fel vid laddning: {error}</p>
              <button
                onClick={fetchContractTechnicianData}
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
          icon={Building2}
          iconColor="text-slate-500"
          title="Avtalskund Tekniker-prestanda"
          subtitle="Ingen data tillgänglig"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ingen avtalskund teknikerdata tillgänglig för vald period</p>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  // Beräkna sammanfattning
  const totalRevenue = technicianData.reduce((sum, tech) => sum + tech.total_revenue, 0)
  const totalCases = technicianData.reduce((sum, tech) => sum + tech.total_cases, 0)
  const totalNewCustomers = technicianData.reduce((sum, tech) => sum + tech.new_customers, 0)
  const totalNewCustomerValue = technicianData.reduce((sum, tech) => sum + tech.new_customer_value, 0)
  const totalUpsellRevenue = technicianData.reduce((sum, tech) => sum + tech.upsell_revenue, 0)

  // Formatera data för lista
  const listData = technicianData
    .filter(tech => tech.total_revenue > 0)
    .map(tech => 
      createListItem(
        tech.name,
        tech.name,
        tech.total_revenue || 0,
        `${tech.new_customers || 0} nya avtal • ${tech.upsell_cases || 0} merförsäljning`,
        {
          rank: tech.rank,
          status: 'active',
          metadata: [
            { label: 'Avtalsvärde', value: formatCurrency(tech.new_customer_value || 0) },
            { label: 'Merförsäljning', value: formatCurrency(tech.upsell_revenue || 0) },
            { label: 'Genomsnitt/avtal', value: formatCurrency(tech.avg_contract_value || 0) }
          ]
        }
      )
    )

  return (
    <div className="space-y-8">
      {/* Header med navigation */}
      <ModernCard gradient="green" glowing>
        <div className="p-6">
          <div className="flex flex-col gap-4 mb-6">
            {/* Titel rad */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Avtalskund Tekniker-prestanda</h2>
                <p className="text-sm text-slate-400">Nya avtal + Merförsäljning</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row gap-3">
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
                className="flex-1"
              />
            </div>
          </div>
        
          {/* Period översikt med moderna stat cards */}
          <div className="mb-6">
            <h3 className="text-sm text-slate-400 mb-4">
              {selectedPeriod === '1m' 
                ? `${formatSelectedMonth(selectedMonth)} - Avtalskund tekniker översikt`
                : `${formatSelectedMonth(selectedMonth)} (${selectedPeriod.toUpperCase()} period) - Avtalskund tekniker översikt`
              }
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-400 font-bold text-sm">{formatCurrency(totalRevenue)}</p>
                <p className="text-green-300 text-xs">Total intäkt</p>
              </div>
              <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 font-bold text-sm">{totalNewCustomers}</p>
                <p className="text-blue-300 text-xs">Nya avtal</p>
              </div>
              <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-purple-400 font-bold text-sm">{formatCurrency(totalNewCustomerValue)}</p>
                <p className="text-purple-300 text-xs">Avtalsvärde</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400 font-bold text-sm">{formatCurrency(totalUpsellRevenue)}</p>
                <p className="text-yellow-300 text-xs">Merförsäljning</p>
              </div>
              <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-orange-400 font-bold text-sm">{totalCases}</p>
                <p className="text-orange-300 text-xs">Totala ärenden</p>
              </div>
            </div>
          </div>
        </div>
      </ModernCard>

      {/* Meddelande när ingen data finns */}
      {listData.length === 0 && (
        <ModernCard>
          <ModernCard.Content>
            <div className="text-center p-8 bg-slate-800/50 rounded-lg border border-slate-700">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-500" />
              <h3 className="text-lg font-semibold text-white mb-2">Ingen avtalskund data för vald period</h3>
              <p className="text-slate-400 text-sm mb-4">
                Månad: {selectedMonth}, Period: {selectedPeriod}
              </p>
              <p className="text-xs text-slate-500">
                Cases: {allData.cases.length}, Customers: {allData.customers.length}
              </p>
            </div>
          </ModernCard.Content>
        </ModernCard>
      )}

      {/* 📊 Fullständig tekniker-lista - Visar endast om det finns data */}
      {listData.length > 0 && (
        <ModernList
          items={listData}
          title="Alla Avtalskund Tekniker"
          subtitle="Komplett lista över alla tekniker med avtalskund-prestanda"
          formatPrimaryValue={formatCurrency}
          showRanking
          searchable
          sortable
        />
      )}
    </div>
  )
}

export default ContractTechnicianChart
// 📁 src/hooks/useCommissionDashboard.ts - State management för dashboard, API-calls och filter-logik
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { 
  CommissionDashboardState, 
  MonthSelection, 
  TechnicianFilter,
  CommissionKpi,
  CommissionMonthlyData,
  TechnicianCommissionSummary,
  CommissionCaseDetail
} from '../types/commission'
import { getCurrentMonth, getMonthOptions } from '../types/commission'
import {
  getCommissionKpis,
  getCommissionMonthlyData,
  getTechnicianCommissionSummaries,
  getCommissionCaseDetails,
  getAvailableTechnicians
} from '../services/commissionService'

// Hook för commission dashboard state management
export const useCommissionDashboard = () => {
  // State
  const [selectedMonth, setSelectedMonth] = useState<MonthSelection>(getCurrentMonth())
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianFilter>({ id: 'all', name: 'Alla tekniker' })
  const [availableTechnicians, setAvailableTechnicians] = useState<TechnicianFilter[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Data state
  const [kpis, setKpis] = useState<CommissionKpi>({
    total_commission: 0,
    total_cases: 0,
    active_technicians: 0,
    avg_commission_per_case: 0,
    avg_commission_per_technician: 0,
    pending_commission: 0,
    paid_commission: 0
  })
  
  const [monthlyData, setMonthlyData] = useState<CommissionMonthlyData[]>([])
  const [technicianSummaries, setTechnicianSummaries] = useState<TechnicianCommissionSummary[]>([])
  const [caseDetails, setCaseDetails] = useState<CommissionCaseDetail[]>([])

  // Månadsalternativ (12 månader bakåt)
  const monthOptions = useMemo(() => getMonthOptions(12), [])

  // Läs in tillgängliga tekniker en gång
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        const technicians = await getAvailableTechnicians()
        setAvailableTechnicians(technicians)
      } catch (err) {
        console.error('Failed to load technicians:', err)
      }
    }
    
    loadTechnicians()
  }, [])

  // Ladda dashboard data när månad eller tekniker ändras
  const loadDashboardData = useCallback(async () => {
    if (!selectedMonth.value) return
    
    setLoading(true)
    setError(null)
    
    try {
      console.log(`🔄 Loading commission dashboard data for ${selectedMonth.value}, technician: ${selectedTechnician.id}`)
      
      // Parallella API-anrop för bättre prestanda
      const [
        kpisData,
        monthlyDataResult,
        summariesData,
        casesData
      ] = await Promise.all([
        getCommissionKpis(selectedMonth.value),
        getCommissionMonthlyData(6), // 6 månader för diagram
        getTechnicianCommissionSummaries(selectedMonth.value),
        getCommissionCaseDetails(selectedMonth.value, selectedTechnician.id)
      ])
      
      setKpis(kpisData)
      setMonthlyData(monthlyDataResult)
      setTechnicianSummaries(summariesData)
      setCaseDetails(casesData)
      
      console.log(`✅ Commission dashboard data loaded:`, {
        kpis: kpisData,
        monthlyEntries: monthlyDataResult.length,
        technicians: summariesData.length,
        cases: casesData.length
      })
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel'
      console.error('Failed to load commission dashboard data:', err)
      setError(`Kunde inte ladda provisionsdata: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth.value, selectedTechnician.id])

  // Ladda data när dependencies ändras
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Månadsnavigation
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth.value)
    
    if (direction === 'prev' && currentIndex < monthOptions.length - 1) {
      setSelectedMonth(monthOptions[currentIndex + 1])
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedMonth(monthOptions[currentIndex - 1])
    }
  }, [monthOptions, selectedMonth.value])

  // Gå till specifik månad
  const goToMonth = useCallback((month: MonthSelection) => {
    setSelectedMonth(month)
  }, [])

  // Tekniker-filter
  const setTechnicianFilter = useCallback((technician: TechnicianFilter) => {
    setSelectedTechnician(technician)
  }, [])

  // Refresh data manuellt
  const refreshData = useCallback(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Filtrerade data baserat på vald tekniker
  const filteredData = useMemo(() => {
    if (selectedTechnician.id === 'all') {
      return {
        summaries: technicianSummaries,
        cases: caseDetails,
        monthlyData: monthlyData
      }
    }
    
    // Filtrera bara summaries och monthlyData - cases är redan filtrerade från API
    const filteredSummaries = technicianSummaries.filter(
      summary => summary.technician_id === selectedTechnician.id
    )
    
    const filteredMonthlyData = monthlyData.filter(
      data => data.technician_id === selectedTechnician.id
    )
    
    return {
      summaries: filteredSummaries,
      cases: caseDetails, // Already filtered by API
      monthlyData: filteredMonthlyData
    }
  }, [technicianSummaries, caseDetails, monthlyData, selectedTechnician.id])

  // Beräknade värden
  const calculations = useMemo(() => {
    const totalCommissionForMonth = filteredData.cases.reduce(
      (sum, case_) => sum + (case_.commission_amount || 0), 0
    )
    
    const avgCommissionPerCase = filteredData.cases.length > 0 
      ? totalCommissionForMonth / filteredData.cases.length 
      : 0
    
    const uniqueTechniciansInSelection = new Set(
      filteredData.cases.map(case_ => case_.primary_assignee_id).filter(Boolean)
    ).size
    
    const avgCommissionPerTechnician = uniqueTechniciansInSelection > 0
      ? totalCommissionForMonth / uniqueTechniciansInSelection
      : 0

    // Top performer för vald period
    const topPerformer = filteredData.summaries.length > 0 
      ? filteredData.summaries[0] 
      : null

    return {
      totalCommissionForMonth,
      avgCommissionPerCase,
      uniqueTechniciansInSelection,
      avgCommissionPerTechnician,
      topPerformer
    }
  }, [filteredData])

  // Navigation helpers
  const canNavigatePrev = useMemo(() => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth.value)
    return currentIndex < monthOptions.length - 1
  }, [monthOptions, selectedMonth.value])

  const canNavigateNext = useMemo(() => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth.value)
    const isNotFuture = monthOptions[currentIndex - 1]?.value <= new Date().toISOString().slice(0, 7)
    return currentIndex > 0 && isNotFuture
  }, [monthOptions, selectedMonth.value])

  // Return hook interface
  return {
    // State
    selectedMonth,
    selectedTechnician,
    availableTechnicians,
    monthOptions,
    loading,
    error,
    
    // Data
    kpis,
    monthlyData: filteredData.monthlyData,
    technicianSummaries: filteredData.summaries,
    caseDetails: filteredData.cases,
    
    // Calculated values
    calculations,
    
    // Navigation
    canNavigatePrev,
    canNavigateNext,
    navigateMonth,
    goToMonth,
    
    // Actions
    setTechnicianFilter,
    refreshData,
    
    // Utils
    isDataEmpty: filteredData.cases.length === 0 && !loading,
    hasMultipleTechnicians: availableTechnicians.length > 1,
    selectedMonthDisplay: selectedMonth.display,
    selectedTechnicianDisplay: selectedTechnician.name
  }
}

// Hook för enkel KPI access
export const useCommissionKpis = (month: string) => {
  const [kpis, setKpis] = useState<CommissionKpi | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const loadKpis = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const data = await getCommissionKpis(month)
        setKpis(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Okänt fel')
      } finally {
        setLoading(false)
      }
    }
    
    if (month) {
      loadKpis()
    }
  }, [month])
  
  return { kpis, loading, error }
}

// Hook för månadsdata charts
export const useCommissionChartData = (months: number = 6) => {
  const [data, setData] = useState<CommissionMonthlyData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const monthlyData = await getCommissionMonthlyData(months)
        setData(monthlyData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Okänt fel')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [months])
  
  // Transform data för Recharts
  const chartData = useMemo(() => {
    if (!data.length) return []
    
    // Gruppera per månad
    const monthGroups: { [month: string]: any } = {}
    
    data.forEach(entry => {
      if (!monthGroups[entry.month]) {
        monthGroups[entry.month] = {
          month: entry.month,
          month_display: entry.month_display
        }
      }
      
      // Lägg till tekniker som dynamic key
      monthGroups[entry.month][entry.technician_name] = entry.total_commission
    })
    
    return Object.values(monthGroups).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [data])
  
  // Unika tekniker för färger
  const uniqueTechnicians = useMemo(() => {
    return Array.from(new Set(data.map(entry => entry.technician_name)))
  }, [data])
  
  return { 
    data: chartData, 
    technicians: uniqueTechnicians,
    loading, 
    error,
    isEmpty: chartData.length === 0
  }
}
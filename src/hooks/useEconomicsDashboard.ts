// src/hooks/useEconomicsDashboard.ts - SNABB FIX för array safety
import { useState, useEffect } from 'react'
import { 
  getKpiData, 
  getMonthlyRevenue, 
  getExpiringContracts, 
  getTechnicianRevenue,
  getAccountManagerRevenue,
  getMarketingSpend,
  getCaseEconomy,
  getCustomerContracts,
  getBeGoneMonthlyStats, // 🆕 Ny BeGone funktion
  type KpiData,
  type MonthlyRevenue,
  type ExpiringContract,
  type TechnicianRevenue,
  type AccountManagerRevenue,
  type MarketingSpend,
  type CaseEconomy,
  type CustomerContract,
  type BeGoneMonthlyStats // 🆕 Ny typ
} from '../services/economicsService'

// Huvudhook för economics dashboard
export const useEconomicsDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      // Här kan vi trigga en re-fetch av alla data
      // För nu returnerar vi bara success
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering')
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, refetch }
}

// KPI Data hook - FIXAD
export const useKpiData = () => {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getKpiData()
        setData(result || null) // 🆕 Fallback till null
      } catch (err) {
        console.error('❌ useKpiData error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI data')
        setData(null) // 🆕 Explicit null vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Monthly Revenue hook - FIXAD med array safety
export const useMonthlyRevenue = () => {
  const [data, setData] = useState<MonthlyRevenue[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getMonthlyRevenue()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getMonthlyRevenue returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useMonthlyRevenue error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av månadsintäkter')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// 🆕 BeGone Monthly Stats hook - FIXAD med array safety
export const useBeGoneMonthlyStats = () => {
  const [data, setData] = useState<BeGoneMonthlyStats[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getBeGoneMonthlyStats()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getBeGoneMonthlyStats returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useBeGoneMonthlyStats error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone statistik')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Expiring Contracts hook - FIXAD med array safety
export const useExpiringContracts = () => {
  const [data, setData] = useState<ExpiringContract[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getExpiringContracts()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getExpiringContracts returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useExpiringContracts error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av utgående avtal')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Technician Revenue hook - FIXAD med array safety
export const useTechnicianRevenue = () => {
  const [data, setData] = useState<TechnicianRevenue[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getTechnicianRevenue()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getTechnicianRevenue returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useTechnicianRevenue error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av teknikerintäkter')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Account Manager Revenue hook - FIXAD med array safety
export const useAccountManagerRevenue = () => {
  const [data, setData] = useState<AccountManagerRevenue[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getAccountManagerRevenue()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getAccountManagerRevenue returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useAccountManagerRevenue error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av account manager intäkter')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Marketing Spend hook - FIXAD med array safety
export const useMarketingSpend = () => {
  const [data, setData] = useState<MarketingSpend[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getMarketingSpend()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getMarketingSpend returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useMarketingSpend error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av marknadsföringsdata')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Case Economy hook - FIXAD
export const useCaseEconomy = () => {
  const [data, setData] = useState<CaseEconomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getCaseEconomy()
        setData(result || null) // 🆕 Fallback till null
      } catch (err) {
        console.error('❌ useCaseEconomy error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av ärendeekonomi')
        setData(null) // 🆕 Explicit null vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Customer Contracts hook - FIXAD med array safety
export const useCustomerContracts = () => {
  const [data, setData] = useState<CustomerContract[]>([]) // 🆕 Tom array som default
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const result = await getCustomerContracts()
        
        // 🆕 KRITISK FIX: Säkerställ att result är en array
        if (Array.isArray(result)) {
          setData(result)
        } else {
          console.warn('⚠️ getCustomerContracts returned non-array:', result)
          setData([])
        }
      } catch (err) {
        console.error('❌ useCustomerContracts error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av kundavtal')
        setData([]) // 🆕 Tom array vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// 🆕 Combined BeGone Analytics hook - MASSIVT FIXAD
export const useBeGoneAnalytics = () => {
  const [combinedData, setCombinedData] = useState<{
    monthlyStats: BeGoneMonthlyStats[]
    currentMonthTotal: number
    yearToDateTotal: number
    averageCaseValue: number
    topMonth: { month: string; revenue: number } | null
    privateVsBusinessRatio: { private: number; business: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const monthlyStats = await getBeGoneMonthlyStats()
        
        // 🆕 KRITISK FIX: Kontrollera att monthlyStats är en array
        if (!Array.isArray(monthlyStats)) {
          console.warn('⚠️ useBeGoneAnalytics: monthlyStats is not an array:', monthlyStats)
          setCombinedData(null)
          return
        }
        
        const currentMonth = new Date().toISOString().slice(0, 7)
        const currentYear = new Date().getFullYear().toString()
        
        const currentMonthData = monthlyStats.find(m => m?.month === currentMonth)
        const yearData = monthlyStats.filter(m => m?.month?.startsWith(currentYear))
        
        // 🆕 Säker summering med null-hantering
        const yearToDateTotal = yearData.reduce((sum, m) => sum + (m?.total_begone_revenue || 0), 0)
        const totalCases = yearData.reduce((sum, m) => sum + (m?.total_begone_cases || 0), 0)
        const totalPrivateCases = yearData.reduce((sum, m) => sum + (m?.private_cases_count || 0), 0)
        const totalBusinessCases = yearData.reduce((sum, m) => sum + (m?.business_cases_count || 0), 0)
        
        // 🆕 Säker topMonth beräkning
        const validMonths = monthlyStats.filter(m => m && (m.total_begone_revenue || 0) > 0)
        const topMonth = validMonths.length > 0 
          ? validMonths.sort((a, b) => (b?.total_begone_revenue || 0) - (a?.total_begone_revenue || 0))[0]
          : null

        setCombinedData({
          monthlyStats,
          currentMonthTotal: currentMonthData?.total_begone_revenue || 0,
          yearToDateTotal,
          averageCaseValue: totalCases > 0 ? yearToDateTotal / totalCases : 0,
          topMonth: topMonth ? { month: topMonth.month, revenue: topMonth.total_begone_revenue || 0 } : null,
          privateVsBusinessRatio: {
            private: totalCases > 0 ? (totalPrivateCases / totalCases) * 100 : 0,
            business: totalCases > 0 ? (totalBusinessCases / totalCases) * 100 : 0
          }
        })
      } catch (err) {
        console.error('❌ useBeGoneAnalytics error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone analys')
        setCombinedData(null) // 🆕 Explicit null vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data: combinedData, loading, error }
}

// 🆕 Hook för att jämföra avtalskunder vs BeGone intäkter - FIXAD
export const useRevenueComparison = () => {
  const [data, setData] = useState<{
    contract_revenue: number
    case_revenue: number
    begone_revenue: number
    total_revenue: number
    begone_percentage: number
    contract_percentage: number
    case_percentage: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null) // 🆕 Rensa tidigare fel
        const [kpiData, monthlyRevenue] = await Promise.all([
          getKpiData(),
          getMonthlyRevenue()
        ])

        // 🆕 KRITISK FIX: Kontrollera att vi fick giltig data
        if (!kpiData) {
          console.warn('⚠️ useRevenueComparison: kpiData is null')
          setData(null)
          return
        }

        if (!Array.isArray(monthlyRevenue)) {
          console.warn('⚠️ useRevenueComparison: monthlyRevenue is not an array:', monthlyRevenue)
          setData(null)
          return
        }

        const currentYear = new Date().getFullYear()
        const yearlyData = monthlyRevenue.filter(m => m?.month?.startsWith(currentYear.toString()))
        
        const contract_revenue = kpiData.total_arr || 0
        const case_revenue = kpiData.total_case_revenue_ytd || 0
        const begone_revenue = kpiData.total_begone_revenue_ytd || 0
        const total_revenue = contract_revenue + case_revenue + begone_revenue

        setData({
          contract_revenue,
          case_revenue,
          begone_revenue,
          total_revenue,
          begone_percentage: total_revenue > 0 ? (begone_revenue / total_revenue) * 100 : 0,
          contract_percentage: total_revenue > 0 ? (contract_revenue / total_revenue) * 100 : 0,
          case_percentage: total_revenue > 0 ? (case_revenue / total_revenue) * 100 : 0
        })
      } catch (err) {
        console.error('❌ useRevenueComparison error:', err) // 🆕 Debug logging
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av intäktsjämförelse')
        setData(null) // 🆕 Explicit null vid fel
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}
// src/hooks/useEconomicsDashboard.ts - UPPDATERAD med BeGone funktioner
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

// KPI Data hook
export const useKpiData = () => {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getKpiData()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Monthly Revenue hook
export const useMonthlyRevenue = () => {
  const [data, setData] = useState<MonthlyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getMonthlyRevenue()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av månadsintäkter')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// 🆕 BeGone Monthly Stats hook
export const useBeGoneMonthlyStats = () => {
  const [data, setData] = useState<BeGoneMonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getBeGoneMonthlyStats()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone statistik')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Expiring Contracts hook
export const useExpiringContracts = () => {
  const [data, setData] = useState<ExpiringContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getExpiringContracts()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av utgående avtal')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Technician Revenue hook
export const useTechnicianRevenue = () => {
  const [data, setData] = useState<TechnicianRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getTechnicianRevenue()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av teknikerintäkter')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Account Manager Revenue hook
export const useAccountManagerRevenue = () => {
  const [data, setData] = useState<AccountManagerRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getAccountManagerRevenue()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av account manager intäkter')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Marketing Spend hook
export const useMarketingSpend = () => {
  const [data, setData] = useState<MarketingSpend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getMarketingSpend()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av marknadsföringsdata')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Case Economy hook
export const useCaseEconomy = () => {
  const [data, setData] = useState<CaseEconomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getCaseEconomy()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av ärendeekonomi')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Customer Contracts hook
export const useCustomerContracts = () => {
  const [data, setData] = useState<CustomerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getCustomerContracts()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av kundavtal')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// 🆕 Combined BeGone Analytics hook för mer avancerad användning
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
        const monthlyStats = await getBeGoneMonthlyStats()
        
        const currentMonth = new Date().toISOString().slice(0, 7)
        const currentYear = new Date().getFullYear().toString()
        
        const currentMonthData = monthlyStats.find(m => m.month === currentMonth)
        const yearData = monthlyStats.filter(m => m.month.startsWith(currentYear))
        
        const yearToDateTotal = yearData.reduce((sum, m) => sum + m.total_begone_revenue, 0)
        const totalCases = yearData.reduce((sum, m) => sum + m.total_begone_cases, 0)
        const totalPrivateCases = yearData.reduce((sum, m) => sum + m.private_cases_count, 0)
        const totalBusinessCases = yearData.reduce((sum, m) => sum + m.business_cases_count, 0)
        
        const topMonth = monthlyStats
          .filter(m => m.total_begone_revenue > 0)
          .sort((a, b) => b.total_begone_revenue - a.total_begone_revenue)[0] || null

        setCombinedData({
          monthlyStats,
          currentMonthTotal: currentMonthData?.total_begone_revenue || 0,
          yearToDateTotal,
          averageCaseValue: totalCases > 0 ? yearToDateTotal / totalCases : 0,
          topMonth: topMonth ? { month: topMonth.month, revenue: topMonth.total_begone_revenue } : null,
          privateVsBusinessRatio: {
            private: totalCases > 0 ? (totalPrivateCases / totalCases) * 100 : 0,
            business: totalCases > 0 ? (totalBusinessCases / totalCases) * 100 : 0
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone analys')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data: combinedData, loading, error }
}

// 🆕 Hook för att jämföra avtalskunder vs BeGone intäkter
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
        const [kpiData, monthlyRevenue] = await Promise.all([
          getKpiData(),
          getMonthlyRevenue()
        ])

        const currentYear = new Date().getFullYear()
        const yearlyData = monthlyRevenue.filter(m => m.month.startsWith(currentYear.toString()))
        
        const contract_revenue = kpiData.total_arr
        const case_revenue = kpiData.total_case_revenue_ytd
        const begone_revenue = kpiData.total_begone_revenue_ytd
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
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av intäktsjämförelse')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}
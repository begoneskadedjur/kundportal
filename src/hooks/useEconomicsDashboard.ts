// src/hooks/useEconomicsDashboard.ts - Ekonomisk dashboard hooks
import { useState, useEffect, useMemo } from 'react'
import {
  getKpiData,
  getMonthlyRevenue,
  getExpiringContracts,
  getTechnicianRevenue,
  getAccountManagerRevenue,
  getMarketingSpend,
  getCaseEconomy,
  getCustomerContracts,
  getBeGoneMonthlyStats,
  getKpiDataWithTrends,
  getArticleRevenueBreakdown,
  getPriceListUtilization,
  getRevenueHealthMix,
  type KpiData,
  type KpiDataWithTrends,
  type MonthlyRevenue,
  type ExpiringContract,
  type TechnicianRevenue,
  type AccountManagerRevenue,
  type MarketingSpend,
  type CaseEconomy,
  type CustomerContract,
  type BeGoneMonthlyStats,
  type ArticleRevenueItem,
  type PriceListUtilizationData,
  type RevenueHealthData
} from '../services/economicsService'

// Huvudhook för economics dashboard
export const useEconomicsDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
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
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getKpiData()
        if (!cancelled) setData(result || null)
      } catch (err) {
        if (!cancelled) {
          console.error('useKpiData error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI data')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Monthly Revenue hook
export const useMonthlyRevenue = () => {
  const [data, setData] = useState<MonthlyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getMonthlyRevenue()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useMonthlyRevenue error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av månadsintäkter')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// BeGone Monthly Stats hook
export const useBeGoneMonthlyStats = () => {
  const [data, setData] = useState<BeGoneMonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getBeGoneMonthlyStats()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useBeGoneMonthlyStats error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone statistik')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Expiring Contracts hook
export const useExpiringContracts = () => {
  const [data, setData] = useState<ExpiringContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getExpiringContracts()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useExpiringContracts error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av utgående avtal')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Technician Revenue hook
export const useTechnicianRevenue = () => {
  const [data, setData] = useState<TechnicianRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getTechnicianRevenue()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useTechnicianRevenue error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av teknikerintäkter')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Account Manager Revenue hook
export const useAccountManagerRevenue = () => {
  const [data, setData] = useState<AccountManagerRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getAccountManagerRevenue()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useAccountManagerRevenue error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av account manager intäkter')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Marketing Spend hook
export const useMarketingSpend = () => {
  const [data, setData] = useState<MarketingSpend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getMarketingSpend()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useMarketingSpend error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av marknadsföringsdata')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Case Economy hook
export const useCaseEconomy = () => {
  const [data, setData] = useState<CaseEconomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getCaseEconomy()
        if (!cancelled) setData(result || null)
      } catch (err) {
        if (!cancelled) {
          console.error('useCaseEconomy error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av ärendeekonomi')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Customer Contracts hook
export const useCustomerContracts = () => {
  const [data, setData] = useState<CustomerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getCustomerContracts()
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useCustomerContracts error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av kundavtal')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Combined BeGone Analytics hook
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
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const monthlyStats = await getBeGoneMonthlyStats()

        if (!Array.isArray(monthlyStats)) {
          if (!cancelled) setCombinedData(null)
          return
        }

        const currentMonth = new Date().toISOString().slice(0, 7)
        const currentYear = new Date().getFullYear().toString()

        const currentMonthData = monthlyStats.find(m => m?.month === currentMonth)
        const yearData = monthlyStats.filter(m => m?.month?.startsWith(currentYear))

        const yearToDateTotal = yearData.reduce((sum, m) => sum + (m?.total_begone_revenue || 0), 0)
        const totalCases = yearData.reduce((sum, m) => sum + (m?.total_begone_cases || 0), 0)
        const totalPrivateCases = yearData.reduce((sum, m) => sum + (m?.private_cases_count || 0), 0)
        const totalBusinessCases = yearData.reduce((sum, m) => sum + (m?.business_cases_count || 0), 0)

        const validMonths = monthlyStats.filter(m => m && (m.total_begone_revenue || 0) > 0)
        const topMonth = validMonths.length > 0
          ? validMonths.sort((a, b) => (b?.total_begone_revenue || 0) - (a?.total_begone_revenue || 0))[0]
          : null

        if (!cancelled) {
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
        }
      } catch (err) {
        if (!cancelled) {
          console.error('useBeGoneAnalytics error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av BeGone analys')
          setCombinedData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data: combinedData, loading, error }
}

// KPI Data med riktiga trender (kräver EconomicsPeriodContext)
export const useKpiDataWithTrends = (dateRange?: { start: string; end: string }, previousDateRange?: { start: string; end: string }) => {
  const [data, setData] = useState<KpiDataWithTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rangeKey = useMemo(() =>
    dateRange ? `${dateRange.start}-${dateRange.end}` : 'default',
    [dateRange?.start, dateRange?.end]
  )

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        if (dateRange && previousDateRange) {
          const result = await getKpiDataWithTrends(
            dateRange.start, dateRange.end,
            previousDateRange.start, previousDateRange.end
          )
          if (!cancelled) setData(result)
        } else {
          const kpi = await getKpiData()
          if (!cancelled) {
            setData({
              ...kpi,
              trends: {
                arr_change_percent: 0,
                mrr_change_percent: 0,
                customers_change: 0,
                case_revenue_change_percent: 0,
                begone_revenue_change_percent: 0,
                churn_change: 0
              }
            })
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('useKpiDataWithTrends error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI data')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [rangeKey])

  return { data, loading, error }
}

// Artikelintäkter hook
export const useArticleRevenue = (dateRange?: { start: string; end: string }) => {
  const [data, setData] = useState<ArticleRevenueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rangeKey = useMemo(() =>
    dateRange ? `${dateRange.start}-${dateRange.end}` : 'default',
    [dateRange?.start, dateRange?.end]
  )

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      if (!dateRange) { if (!cancelled) setLoading(false); return }
      try {
        setLoading(true)
        setError(null)
        const result = await getArticleRevenueBreakdown(dateRange.start, dateRange.end)
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!cancelled) {
          console.error('useArticleRevenue error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av artikelintäkter')
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [rangeKey])

  return { data, loading, error }
}

// Prislisteutilisering hook
export const usePriceListAnalytics = () => {
  const [data, setData] = useState<PriceListUtilizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getPriceListUtilization()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          console.error('usePriceListAnalytics error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av prislistedata')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Intäktsmix / Revenue Health hook
export const useRevenueHealth = (dateRange?: { start: string; end: string }) => {
  const [data, setData] = useState<RevenueHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rangeKey = useMemo(() =>
    dateRange ? `${dateRange.start}-${dateRange.end}` : 'default',
    [dateRange?.start, dateRange?.end]
  )

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      if (!dateRange) { if (!cancelled) setLoading(false); return }
      try {
        setLoading(true)
        setError(null)
        const result = await getRevenueHealthMix(dateRange.start, dateRange.end)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          console.error('useRevenueHealth error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av intäktsmix')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [rangeKey])

  return { data, loading, error }
}

// Hook för att jämföra avtalskunder vs BeGone intäkter
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
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [kpiData, monthlyRevenue] = await Promise.all([
          getKpiData(),
          getMonthlyRevenue()
        ])

        if (!kpiData || !Array.isArray(monthlyRevenue)) {
          if (!cancelled) setData(null)
          return
        }

        const currentYear = new Date().getFullYear()
        const yearlyData = monthlyRevenue.filter(m => m?.month?.startsWith(currentYear.toString()))

        const contract_revenue = kpiData.total_arr || 0
        const case_revenue = kpiData.total_case_revenue_ytd || 0
        const begone_revenue = kpiData.total_begone_revenue_ytd || 0
        const total_revenue = contract_revenue + case_revenue + begone_revenue

        if (!cancelled) {
          setData({
            contract_revenue,
            case_revenue,
            begone_revenue,
            total_revenue,
            begone_percentage: total_revenue > 0 ? (begone_revenue / total_revenue) * 100 : 0,
            contract_percentage: total_revenue > 0 ? (contract_revenue / total_revenue) * 100 : 0,
            case_percentage: total_revenue > 0 ? (case_revenue / total_revenue) * 100 : 0
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error('useRevenueComparison error:', err)
          setError(err instanceof Error ? err.message : 'Fel vid hämtning av intäktsjämförelse')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

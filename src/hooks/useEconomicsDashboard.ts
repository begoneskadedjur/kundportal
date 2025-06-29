// 📁 src/hooks/useEconomicsDashboard.ts
import { useState, useEffect } from 'react'
import { 
  getKpiData,
  getMonthlyRevenue,
  getExpiringContracts,
  getTechnicianRevenue,
  getAccountManagerRevenue,
  getMonthlyMarketingSpend,
  getCaseEconomy,
  getCustomerContracts,
  type KpiData,
  type MonthlyRevenue,
  type ExpiringContract,
  type TechnicianRevenue,
  type AccountManagerRevenue,
  type MarketingSpend,
  type CaseEconomy,
  type CustomerContract
} from '../services/economicsService'

interface EconomicsDashboardData {
  kpiData: KpiData | null
  monthlyRevenue: MonthlyRevenue[]
  expiringContracts: ExpiringContract[]
  technicianRevenue: TechnicianRevenue[]
  accountManagerRevenue: AccountManagerRevenue[]
  marketingSpend: MarketingSpend[]
  caseEconomy: CaseEconomy | null
  customerContracts: CustomerContract[]
}

interface UseEconomicsDashboardReturn extends EconomicsDashboardData {
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const useEconomicsDashboard = (): UseEconomicsDashboardReturn => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EconomicsDashboardData>({
    kpiData: null,
    monthlyRevenue: [],
    expiringContracts: [],
    technicianRevenue: [],
    accountManagerRevenue: [],
    marketingSpend: [],
    caseEconomy: null,
    customerContracts: []
  })

  const fetchAllData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 useEconomicsDashboard: Starting to fetch all data...')

      // Kör alla queries parallellt för bättre prestanda
      const [
        kpiData,
        monthlyRevenue,
        expiringContracts,
        technicianRevenue,
        accountManagerRevenue,
        marketingSpend,
        caseEconomy,
        customerContracts
      ] = await Promise.all([
        getKpiData().catch(err => { console.error('❌ KPI data error:', err); return null; }),
        getMonthlyRevenue().catch(err => { console.error('❌ Monthly revenue error:', err); return []; }),
        getExpiringContracts().catch(err => { console.error('❌ Expiring contracts error:', err); return []; }),
        getTechnicianRevenue().catch(err => { console.error('❌ Technician revenue error:', err); return []; }),
        getAccountManagerRevenue().catch(err => { console.error('❌ Account manager revenue error:', err); return []; }),
        getMonthlyMarketingSpend().catch(err => { console.error('❌ Marketing spend error:', err); return []; }),
        getCaseEconomy().catch(err => { console.error('❌ Case economy error:', err); return null; }),
        getCustomerContracts().catch(err => { console.error('❌ Customer contracts error:', err); return []; })
      ])

      console.log('✅ useEconomicsDashboard: All data fetched successfully')
      console.log('📊 Case economy data:', caseEconomy)

      setData({
        kpiData,
        monthlyRevenue,
        expiringContracts,
        technicianRevenue,
        accountManagerRevenue,
        marketingSpend,
        caseEconomy,
        customerContracts
      })
    } catch (err) {
      console.error('💥 Error fetching economics dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Ett oväntat fel inträffade')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  return {
    ...data,
    loading,
    error,
    refetch: fetchAllData
  }
}

// Individuella hooks för specifika data (om man bara vill hämta en del)
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
// src/hooks/useEconomicsV2.ts
// React-hooks för nya analytics-service-lagret (economicsServiceV2).
import { useEffect, useState, useMemo } from 'react'
import {
  getRevenuePulse,
  getMarginByMonth,
  getServiceMarginRanking,
  getInvoicePipeline,
  getOverdueAging,
  getPaymentVelocity,
  getCustomerPortfolio,
  getTechnicianMarginScatter,
  getTechnicianCommissionTrend,
  getCaseThroughput,
  getMrrSparkline,
  getAvgMarginSparkline,
  getOutstandingSparkline,
  type RevenuePulsePoint,
  type MarginPoint,
  type ServiceMarginRow,
  type PipelineBucket,
  type OverdueBucket,
  type PaymentVelocityBucket,
  type CustomerPortfolioRow,
  type TechnicianScatterPoint,
  type TechnicianCommissionTrendRow,
  type ThroughputPoint,
  type SparklineMetric,
} from '../services/economicsServiceV2'

type State<T> = { data: T | null; loading: boolean; error: string | null }

function useAsync<T>(fn: () => Promise<T>, deps: any[] = []): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: null })
    fn()
      .then(result => { if (!cancelled) setState({ data: result, loading: false, error: null }) })
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Fel' }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export const useRevenuePulse = (months: number = 12) =>
  useAsync<RevenuePulsePoint[]>(() => getRevenuePulse(months), [months])

export const useMarginByMonth = (months: number = 12) =>
  useAsync<MarginPoint[]>(() => getMarginByMonth(months), [months])

export const useServiceMarginRanking = (range: { start: string; end: string }) => {
  const key = useMemo(() => `${range.start}-${range.end}`, [range.start, range.end])
  return useAsync<ServiceMarginRow[]>(() => getServiceMarginRanking(range.start, range.end), [key])
}

export const useInvoicePipeline = () =>
  useAsync<PipelineBucket[]>(() => getInvoicePipeline(), [])

export const useOverdueAging = () =>
  useAsync<OverdueBucket[]>(() => getOverdueAging(), [])

export const usePaymentVelocity = (months: number = 6) =>
  useAsync<PaymentVelocityBucket[]>(() => getPaymentVelocity(months), [months])

export const useCustomerPortfolio = () =>
  useAsync<CustomerPortfolioRow[]>(() => getCustomerPortfolio(), [])

export const useTechnicianMarginScatter = (range: { start: string; end: string }) => {
  const key = useMemo(() => `${range.start}-${range.end}`, [range.start, range.end])
  return useAsync<TechnicianScatterPoint[]>(() => getTechnicianMarginScatter(range.start, range.end), [key])
}

export const useTechnicianCommissionTrend = (months: number = 12) =>
  useAsync<{ data: TechnicianCommissionTrendRow[]; technicians: string[] }>(
    () => getTechnicianCommissionTrend(months), [months]
  )

export const useCaseThroughput = (months: number = 12) =>
  useAsync<ThroughputPoint[]>(() => getCaseThroughput(months), [months])

export const useMrrSparkline = () => useAsync<SparklineMetric>(() => getMrrSparkline(), [])
export const useAvgMarginSparkline = () => useAsync<SparklineMetric>(() => getAvgMarginSparkline(), [])
export const useOutstandingSparkline = () => useAsync<SparklineMetric>(() => getOutstandingSparkline(), [])

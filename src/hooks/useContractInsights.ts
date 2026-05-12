// src/hooks/useContractInsights.ts
// Aggregerar all data för Affärsinsikt-sidan. Körs en gång, delas mellan flikar.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { parseContractLengthMonths } from '../utils/contractLength'

// ---- Types ----------------------------------------------------------------

export interface KpiSummary {
  totalArr: number
  avgArr: number
  activeCount: number
  renewalArr12m: number
  churnArr12m: number
  avgMargin: number | null
  marginSampleSize: number
}

export interface GrowthMonth {
  month: string      // 'YYYY-MM'
  newArr: number
  churnedArr: number
}

export interface ContractTypeStat {
  type: string
  count: number
  totalArr: number
  avgArr: number
  minArr: number
  maxArr: number
  margin: number | null
  marginSampleSize: number
}

export interface SalesPersonStat {
  name: string
  active: number
  churned: number
  totalArr: number
  avgArr: number
  avgTenureYears: number | null
  margin: number | null
  marginSampleSize: number
  renewalCount12m: number
  renewalArr12m: number
}

export interface BillingFreqStat {
  freq: string
  count: number
  totalArr: number
}

export interface RenewalBucket {
  bucket: '0-3m' | '3-6m' | '6-12m' | '12m+'
  count: number
  arr: number
  customers: { id: string; name: string; salesPerson: string; endDate: string }[]
}

export interface TopProduct {
  name: string
  occurrences: number
  totalValue: number
  avgPrice: number
}

export interface ContractLengthStat {
  label: string
  count: number
}

export interface MarginStat {
  revenue: number
  cost: number
  margin: number
  sampleSize: number
}

export interface ContinuingCustomer {
  id: string
  company_name: string
  contract_end_date: string
  annual_value: number | null
  sales_person: string | null
  contract_type: string | null
}

export interface ContractInsights {
  kpiSummary: KpiSummary
  growthByMonth: GrowthMonth[]
  byContractType: ContractTypeStat[]
  bySalesPerson: SalesPersonStat[]
  byBillingFrequency: BillingFreqStat[]
  renewalPipeline: RenewalBucket[]
  topProducts: TopProduct[]
  contractLengthDistribution: ContractLengthStat[]
  continuingContracts: ContinuingCustomer[]
  allCustomers: any[]
  loading: boolean
  error: string | null
}

// ---- Helpers ---------------------------------------------------------------

function ym(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function monthsFromNow(dateStr: string): number {
  const now = new Date()
  const d = new Date(dateStr)
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

function contractLengthLabel(lengthStr: string | null | undefined): string {
  const months = parseContractLengthMonths(lengthStr)
  if (!months) return 'Okänd'
  if (months < 12) return `${months} mån`
  const years = months / 12
  return `${years} år`
}

// ---- Hook ------------------------------------------------------------------

export function useContractInsights(): ContractInsights {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Omit<ContractInsights, 'loading' | 'error'> | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // 1. Customers (all, including terminated)
        const { data: customers, error: custErr } = await supabase
          .from('customers')
          .select(`
            id, company_name, annual_value, billing_frequency, contract_type,
            contract_start_date, contract_end_date, contract_length,
            terminated_at, termination_reason, sales_person, is_active,
            contract_status
          `)
          .order('company_name')

        if (custErr) throw custErr

        // 2. Contracts for product parsing
        const { data: contracts } = await supabase
          .from('contracts')
          .select('customer_id, selected_products')
          .not('selected_products', 'is', null)

        // 3. Case billing items for margin calc (service=revenue, article=cost)
        // We need to link cases back to customers
        const { data: privateCases } = await supabase
          .from('private_cases')
          .select('id, customer_id')

        const { data: businessCases } = await supabase
          .from('business_cases')
          .select('id, customer_id')

        const { data: billingItems } = await supabase
          .from('case_billing_items')
          .select(`
            id, item_type, amount, case_id, case_type,
            article:articles(default_price)
          `)
          .in('item_type', ['service', 'article'])

        // ---- Build lookup: case_id → customer_id --------------------------
        const caseToCustomer = new Map<string, string>()
        ;(privateCases || []).forEach((c: any) => caseToCustomer.set(`private:${c.id}`, c.customer_id))
        ;(businessCases || []).forEach((c: any) => caseToCustomer.set(`business:${c.id}`, c.customer_id))

        // ---- Build lookup: customer_id → sales_person + contract_type -----
        const customerMeta = new Map<string, { salesPerson: string; contractType: string }>()
        ;(customers || []).forEach((c: any) => {
          customerMeta.set(c.id, {
            salesPerson: c.sales_person || 'Okänd',
            contractType: c.contract_type || 'Okänd',
          })
        })

        // ---- Margin aggregation per sales_person and contract_type ---------
        // Group billing items by customer
        const marginByCustomer = new Map<string, { revenue: number; cost: number }>()

        ;(billingItems || []).forEach((item: any) => {
          if (!item.case_id || !item.case_type) return
          const key = `${item.case_type}:${item.case_id}`
          const customerId = caseToCustomer.get(key)
          if (!customerId) return

          if (!marginByCustomer.has(customerId)) {
            marginByCustomer.set(customerId, { revenue: 0, cost: 0 })
          }
          const m = marginByCustomer.get(customerId)!
          if (item.item_type === 'service') {
            m.revenue += Number(item.amount) || 0
          } else if (item.item_type === 'article') {
            const cost = Number(item.article?.default_price) || Number(item.amount) || 0
            m.cost += cost
          }
        })

        // Per sales_person margin
        const marginBySalesPerson = new Map<string, { revenue: number; cost: number; count: number }>()
        const marginByContractType = new Map<string, { revenue: number; cost: number; count: number }>()

        marginByCustomer.forEach((margins, customerId) => {
          if (margins.revenue <= 0) return
          const meta = customerMeta.get(customerId)
          if (!meta) return

          // Sales person
          if (!marginBySalesPerson.has(meta.salesPerson)) {
            marginBySalesPerson.set(meta.salesPerson, { revenue: 0, cost: 0, count: 0 })
          }
          const sp = marginBySalesPerson.get(meta.salesPerson)!
          sp.revenue += margins.revenue
          sp.cost += margins.cost
          sp.count++

          // Contract type
          if (!marginByContractType.has(meta.contractType)) {
            marginByContractType.set(meta.contractType, { revenue: 0, cost: 0, count: 0 })
          }
          const ct = marginByContractType.get(meta.contractType)!
          ct.revenue += margins.revenue
          ct.cost += margins.cost
          ct.count++
        })

        const calcMargin = (rev: number, cost: number) =>
          rev > 0 ? Math.round(((rev - cost) / rev) * 100) : null

        // ---- Active customers ----------------------------------------------
        const now = new Date()
        const activeCustomers = (customers || []).filter(
          (c: any) => !c.terminated_at && c.is_active !== false
        )

        // ---- KPI summary ---------------------------------------------------
        const totalArr = activeCustomers.reduce((s: number, c: any) => s + (Number(c.annual_value) || 0), 0)
        const activeCount = activeCustomers.length
        const avgArr = activeCount > 0 ? Math.round(totalArr / activeCount) : 0

        // Renewal in next 12 months
        const in12months = new Date(now)
        in12months.setMonth(in12months.getMonth() + 12)
        const renewalArr12m = activeCustomers
          .filter((c: any) => c.contract_end_date && new Date(c.contract_end_date) <= in12months)
          .reduce((s: number, c: any) => s + (Number(c.annual_value) || 0), 0)

        // Churn in last 12 months
        const ago12months = new Date(now)
        ago12months.setMonth(ago12months.getMonth() - 12)
        const churnArr12m = (customers || [])
          .filter((c: any) => c.terminated_at && new Date(c.terminated_at) >= ago12months)
          .reduce((s: number, c: any) => s + (Number(c.annual_value) || 0), 0)

        // Overall margin
        let totalRev = 0, totalCost = 0
        marginBySalesPerson.forEach(m => { totalRev += m.revenue; totalCost += m.cost })
        const avgMargin = totalRev > 0 ? calcMargin(totalRev, totalCost) : null
        const marginSampleSize = marginByCustomer.size

        const kpiSummary: KpiSummary = {
          totalArr, avgArr, activeCount, renewalArr12m, churnArr12m,
          avgMargin, marginSampleSize
        }

        // ---- Growth by month -----------------------------------------------
        const growthMap = new Map<string, { newArr: number; churnedArr: number }>()
        const ensureMonth = (m: string) => {
          if (!growthMap.has(m)) growthMap.set(m, { newArr: 0, churnedArr: 0 })
        }
        ;(customers || []).forEach((c: any) => {
          if (c.contract_start_date) {
            const m = ym(c.contract_start_date)
            ensureMonth(m)
            growthMap.get(m)!.newArr += Number(c.annual_value) || 0
          }
          if (c.terminated_at) {
            const m = ym(c.terminated_at)
            ensureMonth(m)
            growthMap.get(m)!.churnedArr += Number(c.annual_value) || 0
          }
        })
        const growthByMonth = Array.from(growthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, v]) => ({ month, ...v }))
          .slice(-24) // Last 24 months

        // ---- By contract type ----------------------------------------------
        const ctMap = new Map<string, { arr: number[]; churned: number }>()
        ;(customers || []).forEach((c: any) => {
          const type = c.contract_type || 'Okänd'
          if (!ctMap.has(type)) ctMap.set(type, { arr: [], churned: 0 })
          const entry = ctMap.get(type)!
          if (!c.terminated_at && c.is_active !== false) {
            entry.arr.push(Number(c.annual_value) || 0)
          }
        })
        const byContractType: ContractTypeStat[] = Array.from(ctMap.entries())
          .map(([type, v]) => {
            const totalArr = v.arr.reduce((s, n) => s + n, 0)
            const count = v.arr.length
            const marginData = marginByContractType.get(type)
            return {
              type,
              count,
              totalArr,
              avgArr: count > 0 ? Math.round(totalArr / count) : 0,
              minArr: count > 0 ? Math.min(...v.arr) : 0,
              maxArr: count > 0 ? Math.max(...v.arr) : 0,
              margin: marginData ? calcMargin(marginData.revenue, marginData.cost) : null,
              marginSampleSize: marginData?.count ?? 0,
            }
          })
          .filter(s => s.count > 0)
          .sort((a, b) => b.totalArr - a.totalArr)

        // ---- By sales person -----------------------------------------------
        const spMap = new Map<string, { active: number; churned: number; arr: number[]; tenures: number[] }>()
        ;(customers || []).forEach((c: any) => {
          const name = c.sales_person || 'Okänd'
          if (!spMap.has(name)) spMap.set(name, { active: 0, churned: 0, arr: [], tenures: [] })
          const entry = spMap.get(name)!
          if (!c.terminated_at && c.is_active !== false) {
            entry.active++
            entry.arr.push(Number(c.annual_value) || 0)
            if (c.contract_start_date && c.contract_end_date) {
              const start = new Date(c.contract_start_date)
              const end = new Date(c.contract_end_date)
              const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
              if (months > 0) entry.tenures.push(months / 12)
            }
          } else if (c.terminated_at) {
            entry.churned++
          }
        })

        // Renewal in 12m per sales person
        const spRenewal = new Map<string, { count: number; arr: number }>()
        activeCustomers
          .filter((c: any) => c.contract_end_date && new Date(c.contract_end_date) <= in12months)
          .forEach((c: any) => {
            const name = c.sales_person || 'Okänd'
            if (!spRenewal.has(name)) spRenewal.set(name, { count: 0, arr: 0 })
            spRenewal.get(name)!.count++
            spRenewal.get(name)!.arr += Number(c.annual_value) || 0
          })

        const bySalesPerson: SalesPersonStat[] = Array.from(spMap.entries())
          .map(([name, v]) => {
            const totalArr = v.arr.reduce((s, n) => s + n, 0)
            const count = v.arr.length
            const avgTenure = v.tenures.length > 0
              ? v.tenures.reduce((s, n) => s + n, 0) / v.tenures.length
              : null
            const marginData = marginBySalesPerson.get(name)
            const renewal = spRenewal.get(name)
            return {
              name,
              active: v.active,
              churned: v.churned,
              totalArr,
              avgArr: count > 0 ? Math.round(totalArr / count) : 0,
              avgTenureYears: avgTenure ? Math.round(avgTenure * 10) / 10 : null,
              margin: marginData ? calcMargin(marginData.revenue, marginData.cost) : null,
              marginSampleSize: marginData?.count ?? 0,
              renewalCount12m: renewal?.count ?? 0,
              renewalArr12m: renewal?.arr ?? 0,
            }
          })
          .sort((a, b) => b.totalArr - a.totalArr)

        // ---- Billing frequency ---------------------------------------------
        const freqMap = new Map<string, { count: number; arr: number }>()
        activeCustomers.forEach((c: any) => {
          const freq = c.billing_frequency || 'Okänd'
          if (!freqMap.has(freq)) freqMap.set(freq, { count: 0, arr: 0 })
          freqMap.get(freq)!.count++
          freqMap.get(freq)!.arr += Number(c.annual_value) || 0
        })
        const byBillingFrequency: BillingFreqStat[] = Array.from(freqMap.entries())
          .map(([freq, v]) => ({ freq, count: v.count, totalArr: v.arr }))
          .sort((a, b) => b.count - a.count)

        // ---- Renewal pipeline ----------------------------------------------
        const buckets: Record<string, { count: number; arr: number; customers: any[] }> = {
          '0-3m': { count: 0, arr: 0, customers: [] },
          '3-6m': { count: 0, arr: 0, customers: [] },
          '6-12m': { count: 0, arr: 0, customers: [] },
          '12m+': { count: 0, arr: 0, customers: [] },
        }
        activeCustomers
          .filter((c: any) => c.contract_end_date && new Date(c.contract_end_date) > now)
          .forEach((c: any) => {
            const m = monthsFromNow(c.contract_end_date)
            const key = m <= 3 ? '0-3m' : m <= 6 ? '3-6m' : m <= 12 ? '6-12m' : '12m+'
            buckets[key].count++
            buckets[key].arr += Number(c.annual_value) || 0
            buckets[key].customers.push({
              id: c.id,
              name: c.company_name,
              salesPerson: c.sales_person || 'Okänd',
              endDate: c.contract_end_date,
            })
          })
        const renewalPipeline: RenewalBucket[] = (
          ['0-3m', '3-6m', '6-12m', '12m+'] as const
        ).map(bucket => ({ bucket, ...buckets[bucket] }))

        // ---- Top products from JSONB ----------------------------------------
        const productMap = new Map<string, { occurrences: number; totalValue: number }>()
        const contractsByCustomer = new Map<string, any[]>()
        ;(contracts || []).forEach((c: any) => {
          if (!contractsByCustomer.has(c.customer_id)) {
            contractsByCustomer.set(c.customer_id, [])
          }
          contractsByCustomer.get(c.customer_id)!.push(c)
        })

        // Parse selected_products JSONB: [{ products: [{ name, price_2: { amount: { amount } } }] }]
        ;(contracts || []).forEach((contract: any) => {
          if (!contract.selected_products) return
          try {
            const sections = Array.isArray(contract.selected_products)
              ? contract.selected_products
              : JSON.parse(contract.selected_products)

            sections.forEach((section: any) => {
              const prods = section.products || []
              prods.forEach((p: any) => {
                const name = p.name || p.product_name || 'Okänd produkt'
                const price =
                  p.price_2?.amount?.amount ??
                  p.price?.amount ??
                  p.price_2?.amount ??
                  0
                if (!productMap.has(name)) productMap.set(name, { occurrences: 0, totalValue: 0 })
                productMap.get(name)!.occurrences++
                productMap.get(name)!.totalValue += Number(price) || 0
              })
            })
          } catch (_) {}
        })
        const topProducts: TopProduct[] = Array.from(productMap.entries())
          .map(([name, v]) => ({
            name,
            occurrences: v.occurrences,
            totalValue: v.totalValue,
            avgPrice: v.occurrences > 0 ? Math.round(v.totalValue / v.occurrences) : 0,
          }))
          .sort((a, b) => b.occurrences - a.occurrences)
          .slice(0, 15)

        // ---- Contract length distribution ----------------------------------
        const lengthMap = new Map<string, number>()
        activeCustomers.forEach((c: any) => {
          const label = contractLengthLabel(c.contract_length)
          lengthMap.set(label, (lengthMap.get(label) || 0) + 1)
        })
        const contractLengthDistribution: ContractLengthStat[] = Array.from(lengthMap.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)

        // ---- Continuing contracts (end date passed, not terminated) --------
        const continuingContracts: ContinuingCustomer[] = (customers || [])
          .filter((c: any) =>
            !c.terminated_at &&
            c.contract_end_date &&
            new Date(c.contract_end_date) < now &&
            c.is_active !== false
          )
          .map((c: any) => ({
            id: c.id,
            company_name: c.company_name,
            contract_end_date: c.contract_end_date,
            annual_value: c.annual_value,
            sales_person: c.sales_person,
            contract_type: c.contract_type,
          }))

        setResult({
          kpiSummary,
          growthByMonth,
          byContractType,
          bySalesPerson,
          byBillingFrequency,
          renewalPipeline,
          topProducts,
          contractLengthDistribution,
          continuingContracts,
          allCustomers: customers || [],
        })
      } catch (e: any) {
        console.error('[useContractInsights]', e)
        setError(e.message || 'Okänt fel')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const empty: Omit<ContractInsights, 'loading' | 'error'> = {
    kpiSummary: { totalArr: 0, avgArr: 0, activeCount: 0, renewalArr12m: 0, churnArr12m: 0, avgMargin: null, marginSampleSize: 0 },
    growthByMonth: [],
    byContractType: [],
    bySalesPerson: [],
    byBillingFrequency: [],
    renewalPipeline: [],
    topProducts: [],
    contractLengthDistribution: [],
    continuingContracts: [],
    allCustomers: [],
  }

  return { ...(result ?? empty), loading, error }
}

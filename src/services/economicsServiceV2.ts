// src/services/economicsServiceV2.ts
// Nya analytics-metoder som bygger enbart på den nya billing-modellen:
// cases, case_billing_items, contract_billing_items, invoices, articles, services, customers.
// Ingen data från private_cases / business_cases används här.
import { supabase } from '../lib/supabase'

// ---------- Typer ----------

export interface RevenuePulsePoint {
  month: string // YYYY-MM
  contract_revenue: number      // årspremie
  adhoc_revenue: number         // merförsäljning avtal
  case_private_revenue: number  // engångsjobb privat
  case_business_revenue: number // engångsjobb företag
  total_revenue: number
}

export interface MarginPoint {
  month: string
  revenue: number      // försäljning (service-rader + contract + ad_hoc)
  cost: number         // summan av artikelkostnader (quantity × articles.default_price)
  gross_profit: number
  margin_percent: number
}

export interface ServiceMarginRow {
  service_id: string
  service_name: string
  service_code: string
  min_margin_percent: number | null
  revenue: number
  cost: number
  gross_profit: number
  margin_percent: number
  cases_count: number
}

export type PipelineStatus = 'pending' | 'sent' | 'paid'

export interface PipelineBucket {
  status: PipelineStatus
  count: number
  total: number
}

export interface OverdueBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+'
  count: number
  total: number
}

export interface PaymentVelocityBucket {
  bucket: string // "0-7 dagar", "8-14 dagar" etc
  count: number
}

export interface CustomerPortfolioRow {
  customer_id: string
  company_name: string
  annual_value: number
  margin_percent: number // genomsnittlig marginal från kundens ärenden senaste 12 mån
  case_count: number
}

export interface TechnicianScatterPoint {
  technician_id: string
  technician_name: string
  cases_completed: number
  avg_margin_percent: number
  total_revenue: number
}

export interface TechnicianCommissionTrendRow {
  month: string
  [technicianName: string]: string | number
}

export interface ThroughputPoint {
  month: string
  avg_days: number
  cases_completed: number
}

export interface SparklinePoint {
  date: string // YYYY-MM-DD
  value: number
}

export interface SparklineMetric {
  current: number
  previous: number
  delta_percent: number
  sparkline: SparklinePoint[]
}

// ---------- Hjälpare ----------

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const monthsBackFrom = (months: number): string[] => {
  const now = new Date()
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

const startOfMonthISO = (months: number): string => {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  return d.toISOString().split('T')[0]
}

// Hämta case_billing_items för en (potentiellt stor) lista case_ids genom att chunka requests
// — URL:en blir för lång och ger 400 om vi skickar 1000+ uuids i en enda .in()-filter
const fetchCaseBillingItemsByCaseIds = async (
  caseIds: string[],
  select: string,
  chunkSize: number = 200
): Promise<any[]> => {
  if (caseIds.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < caseIds.length; i += chunkSize) chunks.push(caseIds.slice(i, i + chunkSize))

  const results = await Promise.all(chunks.map(chunk =>
    supabase
      .from('case_billing_items')
      .select(select)
      .in('case_id', chunk)
      .neq('status', 'cancelled')
  ))

  return results.flatMap(r => (r.data as any[] | null) || [])
}

// ---------- 1. Revenue pulse (4 strömmar över tid) ----------

export const getRevenuePulse = async (months: number = 12): Promise<RevenuePulsePoint[]> => {
  const since = startOfMonthISO(months)
  const keys = monthsBackFrom(months)
  const empty: Record<string, RevenuePulsePoint> = {}
  keys.forEach(k => {
    empty[k] = {
      month: k,
      contract_revenue: 0,
      adhoc_revenue: 0,
      case_private_revenue: 0,
      case_business_revenue: 0,
      total_revenue: 0,
    }
  })

  // Contract billing items (item_type contract/ad_hoc)
  const { data: cbi } = await supabase
    .from('contract_billing_items')
    .select('item_type, total_price, billing_period_start, invoice_date, status')
    .gte('billing_period_start', since)
    .neq('status', 'cancelled')

  cbi?.forEach((row: any) => {
    const dateStr = row.item_type === 'ad_hoc' ? (row.invoice_date || row.billing_period_start) : row.billing_period_start
    if (!dateStr) return
    const key = dateStr.slice(0, 7)
    if (!empty[key]) return
    if (row.item_type === 'ad_hoc') empty[key].adhoc_revenue += Number(row.total_price || 0)
    else empty[key].contract_revenue += Number(row.total_price || 0)
  })

  // Case billing items för privat/företag — hämta completed_date från alla tre case-tabellerna
  // (case_billing_items.case_id saknar FK och kan peka mot cases / private_cases / business_cases)
  const [legacyRes, privateRes, businessRes] = await Promise.all([
    supabase.from('cases').select('id, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
    supabase.from('private_cases').select('id, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
    supabase.from('business_cases').select('id, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
  ])

  const caseById = new Map<string, { completed_date: string }>()
  ;[...(legacyRes.data || []), ...(privateRes.data || []), ...(businessRes.data || [])]
    .forEach((c: any) => caseById.set(c.id, c))
  const caseIds = Array.from(caseById.keys())

  // case_type härleds via customer.business_type om customer_id finns; annars betrakta som 'private'
  // Men case_billing_items har också case_type-kolumn direkt. Vi använder den.
  if (caseIds.length > 0) {
    const items = await fetchCaseBillingItemsByCaseIds(caseIds, 'case_id, case_type, total_price, item_type, status')

    items.forEach((it: any) => {
      const c = caseById.get(it.case_id)
      if (!c || !c.completed_date) return
      const key = c.completed_date.slice(0, 7)
      if (!empty[key]) return
      const amount = Number(it.total_price || 0)
      if (it.case_type === 'business') empty[key].case_business_revenue += amount
      else if (it.case_type === 'private') empty[key].case_private_revenue += amount
      // case_type='contract' räknas inte här — det är redan i contract_billing_items
    })
  }

  const result = keys.map(k => {
    const p = empty[k]
    p.total_revenue = p.contract_revenue + p.adhoc_revenue + p.case_private_revenue + p.case_business_revenue
    return p
  })
  return result
}

// ---------- 2. Marginal per månad ----------

export const getMarginByMonth = async (months: number = 12): Promise<MarginPoint[]> => {
  const since = startOfMonthISO(months)
  const keys = monthsBackFrom(months)
  const bucket: Record<string, MarginPoint> = {}
  keys.forEach(k => { bucket[k] = { month: k, revenue: 0, cost: 0, gross_profit: 0, margin_percent: 0 } })

  // Hämta cases med completed_date från alla tre case-tabellerna
  // (case_billing_items.case_id saknar FK och kan peka mot cases / private_cases / business_cases)
  const [legacyRes, privateRes, businessRes] = await Promise.all([
    supabase.from('cases').select('id, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
    supabase.from('private_cases').select('id, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
    supabase.from('business_cases').select('id, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
  ])

  const caseMonth = new Map<string, string | undefined>()
  ;[...(legacyRes.data || []), ...(privateRes.data || []), ...(businessRes.data || [])]
    .forEach((c: any) => caseMonth.set(c.id, c.completed_date?.slice(0, 7)))
  const caseIds = Array.from(caseMonth.keys())

  if (caseIds.length > 0) {
    const items = await fetchCaseBillingItemsByCaseIds(caseIds, 'case_id, item_type, total_price, quantity, article_id')

    // Hämta artiklarnas default_price för kostnadsberäkning
    const articleIds = Array.from(new Set(items.map((i: any) => i.article_id).filter(Boolean)))
    const { data: articles } = articleIds.length > 0
      ? await supabase.from('articles').select('id, default_price').in('id', articleIds)
      : { data: [] as any[] }
    const costById = new Map((articles || []).map((a: any) => [a.id, Number(a.default_price || 0)]))

    items.forEach((it: any) => {
      const key = caseMonth.get(it.case_id)
      if (!key || !bucket[key]) return
      if (it.item_type === 'service') {
        bucket[key].revenue += Number(it.total_price || 0)
      } else if (it.item_type === 'article') {
        const cost = costById.get(it.article_id) || 0
        bucket[key].cost += cost * Number(it.quantity || 0)
      }
    })
  }

  // Lägg till contract_billing_items (både contract & ad_hoc) som ren intäkt utan kostnadskoppling idag
  const { data: cbi } = await supabase
    .from('contract_billing_items')
    .select('item_type, total_price, billing_period_start, invoice_date, status')
    .gte('billing_period_start', since)
    .neq('status', 'cancelled')

  cbi?.forEach((row: any) => {
    const dateStr = row.item_type === 'ad_hoc' ? (row.invoice_date || row.billing_period_start) : row.billing_period_start
    if (!dateStr) return
    const key = dateStr.slice(0, 7)
    if (!bucket[key]) return
    bucket[key].revenue += Number(row.total_price || 0)
  })

  return keys.map(k => {
    const p = bucket[k]
    p.gross_profit = p.revenue - p.cost
    p.margin_percent = p.revenue > 0 ? (p.gross_profit / p.revenue) * 100 : 0
    return p
  })
}

// ---------- 3. Service-marginal-ranking ----------

export const getServiceMarginRanking = async (
  startDate: string,
  endDate: string
): Promise<ServiceMarginRow[]> => {
  // Hämta completed_date från alla tre case-tabellerna (cases/private_cases/business_cases)
  // eftersom case_billing_items.case_id saknar FK och kan peka mot vilken som helst
  const [legacyRes, privateRes, businessRes] = await Promise.all([
    supabase.from('cases').select('id, completed_date').gte('completed_date', startDate).lte('completed_date', endDate).not('completed_date', 'is', null),
    supabase.from('private_cases').select('id, completed_date').gte('completed_date', startDate).lte('completed_date', endDate).not('completed_date', 'is', null),
    supabase.from('business_cases').select('id, completed_date').gte('completed_date', startDate).lte('completed_date', endDate).not('completed_date', 'is', null),
  ])

  const validCaseIds = new Set<string>([
    ...(legacyRes.data || []).map((c: any) => c.id),
    ...(privateRes.data || []).map((c: any) => c.id),
    ...(businessRes.data || []).map((c: any) => c.id),
  ])

  if (validCaseIds.size === 0) return []

  const items = await fetchCaseBillingItemsByCaseIds(
    Array.from(validCaseIds),
    'case_id, item_type, total_price, quantity, article_id, service_id, mapped_service_id'
  )

  if (items.length === 0) return []

  const articleIds = Array.from(new Set(items.map((i: any) => i.article_id).filter(Boolean)))
  const { data: articles } = articleIds.length > 0
    ? await supabase.from('articles').select('id, default_price').in('id', articleIds)
    : { data: [] as any[] }
  const costById = new Map((articles || []).map((a: any) => [a.id, Number(a.default_price || 0)]))

  const stats = new Map<string, { revenue: number; cost: number; cases: Set<string> }>()

  const addToStats = (sid: string, revenue: number, cost: number, caseId: string | null) => {
    const s = stats.get(sid) || { revenue: 0, cost: 0, cases: new Set<string>() }
    s.revenue += revenue
    s.cost += cost
    if (caseId) s.cases.add(caseId)
    stats.set(sid, s)
  }

  // Steg 1: bygg map case_id → [{service_id, revenue}] för proportionell allokering
  const serviceRevenueByCase = new Map<string, Array<{ service_id: string; revenue: number }>>()
  items.forEach((i: any) => {
    if (i.item_type !== 'service' || !i.service_id) return
    const arr = serviceRevenueByCase.get(i.case_id) || []
    arr.push({ service_id: i.service_id, revenue: Number(i.total_price || 0) })
    serviceRevenueByCase.set(i.case_id, arr)
  })

  // Steg 2: service-rader → intäkt
  items.forEach((i: any) => {
    if (i.item_type !== 'service' || !i.service_id) return
    addToStats(i.service_id, Number(i.total_price || 0), 0, i.case_id)
  })

  // Steg 3: artikel-rader → kostnad (primär: mapped_service_id, fallback: proportionell allokering)
  items.forEach((a: any) => {
    if (a.item_type !== 'article') return
    const cost = (costById.get(a.article_id) || 0) * Number(a.quantity || 0)
    if (cost === 0) return

    if (a.mapped_service_id) {
      addToStats(a.mapped_service_id, 0, cost, a.case_id)
      return
    }

    const services = serviceRevenueByCase.get(a.case_id) || []
    const totalRevenue = services.reduce((sum, x) => sum + x.revenue, 0)
    if (totalRevenue === 0 || services.length === 0) return
    services.forEach(svc => {
      const share = svc.revenue / totalRevenue
      addToStats(svc.service_id, 0, cost * share, a.case_id)
    })
  })

  const sids = Array.from(stats.keys())
  if (sids.length === 0) return []

  const { data: services } = await supabase
    .from('services')
    .select('id, name, code, min_margin_percent')
    .in('id', sids)

  const svcById = new Map((services || []).map((s: any) => [s.id, s]))

  return sids
    .map(sid => {
      const s = stats.get(sid)!
      const svc = svcById.get(sid)
      const revenue = s.revenue
      const cost = s.cost
      const gross = revenue - cost
      return {
        service_id: sid,
        service_name: svc?.name || 'Okänd tjänst',
        service_code: svc?.code || '',
        min_margin_percent: svc?.min_margin_percent ?? null,
        revenue,
        cost,
        gross_profit: gross,
        margin_percent: revenue > 0 ? (gross / revenue) * 100 : 0,
        cases_count: s.cases.size,
      }
    })
    .filter(r => r.revenue > 0)
    .sort((a, b) => b.margin_percent - a.margin_percent)
}

// ---------- 4. Invoice pipeline ----------

export const getInvoicePipeline = async (): Promise<PipelineBucket[]> => {
  const buckets: Record<PipelineStatus, PipelineBucket> = {
    pending: { status: 'pending', count: 0, total: 0 },
    sent:    { status: 'sent',    count: 0, total: 0 },
    paid:    { status: 'paid',    count: 0, total: 0 },
  }

  // invoices (privat/företag) — draft/pending_approval/ready = pending, sent = sent, paid = paid
  const { data: inv } = await supabase
    .from('invoices')
    .select('status, total_amount')
    .neq('status', 'cancelled')

  inv?.forEach((r: any) => {
    const s = (r.status || '').toLowerCase()
    const amt = Number(r.total_amount || 0)
    if (['draft', 'pending_approval', 'ready'].includes(s)) {
      buckets.pending.count++; buckets.pending.total += amt
    } else if (s === 'sent') {
      buckets.sent.count++; buckets.sent.total += amt
    } else if (s === 'paid') {
      buckets.paid.count++; buckets.paid.total += amt
    }
  })

  // contract_billing_items (avtalskunder + merförsäljning) — pending/approved = pending, invoiced = sent, paid = paid
  const { data: cbi } = await supabase
    .from('contract_billing_items')
    .select('status, total_price')
    .neq('status', 'cancelled')

  cbi?.forEach((r: any) => {
    const s = r.status
    const amt = Number(r.total_price || 0)
    if (s === 'pending' || s === 'approved') {
      buckets.pending.count++; buckets.pending.total += amt
    } else if (s === 'invoiced') {
      buckets.sent.count++; buckets.sent.total += amt
    } else if (s === 'paid') {
      buckets.paid.count++; buckets.paid.total += amt
    }
  })

  return ['pending', 'sent', 'paid'].map(s => buckets[s as PipelineStatus])
}

// ---------- 5. Overdue aging ----------

export const getOverdueAging = async (): Promise<OverdueBucket[]> => {
  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]

  const buckets: Record<string, OverdueBucket> = {
    '0-30':  { bucket: '0-30',  count: 0, total: 0 },
    '31-60': { bucket: '31-60', count: 0, total: 0 },
    '61-90': { bucket: '61-90', count: 0, total: 0 },
    '90+':   { bucket: '90+',   count: 0, total: 0 },
  }

  const addToBucket = (dueDate: string, amount: number) => {
    const due = new Date(dueDate)
    const diff = Math.floor((today.getTime() - due.getTime()) / 86400000)
    if (diff <= 0) return
    const key = diff <= 30 ? '0-30' : diff <= 60 ? '31-60' : diff <= 90 ? '61-90' : '90+'
    buckets[key].count++
    buckets[key].total += amount
  }

  const { data: cbi } = await supabase
    .from('contract_billing_items')
    .select('due_date, total_price, paid_at, status')
    .lt('due_date', todayISO)
    .is('paid_at', null)
    .neq('status', 'cancelled')

  cbi?.forEach((r: any) => { if (r.due_date) addToBucket(r.due_date, Number(r.total_price || 0)) })

  const { data: inv } = await supabase
    .from('invoices')
    .select('due_date, total_amount, paid_at, status')
    .lt('due_date', todayISO)
    .is('paid_at', null)

  inv?.forEach((r: any) => { if (r.due_date) addToBucket(r.due_date, Number(r.total_amount || 0)) })

  return (['0-30', '31-60', '61-90', '90+'] as const).map(k => buckets[k])
}

// ---------- 6. Payment velocity ----------

export const getPaymentVelocity = async (months: number = 6): Promise<PaymentVelocityBucket[]> => {
  const since = startOfMonthISO(months)

  const buckets: Record<string, PaymentVelocityBucket> = {
    '0-7 dagar':    { bucket: '0-7 dagar',    count: 0 },
    '8-14 dagar':   { bucket: '8-14 dagar',   count: 0 },
    '15-30 dagar':  { bucket: '15-30 dagar',  count: 0 },
    '31-60 dagar':  { bucket: '31-60 dagar',  count: 0 },
    '60+ dagar':    { bucket: '60+ dagar',    count: 0 },
  }

  const classify = (days: number) => {
    if (days <= 7) return '0-7 dagar'
    if (days <= 14) return '8-14 dagar'
    if (days <= 30) return '15-30 dagar'
    if (days <= 60) return '31-60 dagar'
    return '60+ dagar'
  }

  const { data: cbi } = await supabase
    .from('contract_billing_items')
    .select('created_at, paid_at')
    .gte('created_at', since)
    .not('paid_at', 'is', null)

  cbi?.forEach((r: any) => {
    const days = Math.floor((new Date(r.paid_at).getTime() - new Date(r.created_at).getTime()) / 86400000)
    buckets[classify(days)].count++
  })

  const { data: inv } = await supabase
    .from('invoices')
    .select('created_at, paid_at')
    .gte('created_at', since)
    .not('paid_at', 'is', null)

  inv?.forEach((r: any) => {
    const days = Math.floor((new Date(r.paid_at).getTime() - new Date(r.created_at).getTime()) / 86400000)
    buckets[classify(days)].count++
  })

  return Object.values(buckets)
}

// ---------- 7. Customer portfolio (ARR + marginal) ----------

export const getCustomerPortfolio = async (): Promise<CustomerPortfolioRow[]> => {
  const { data: customers } = await supabase
    .from('customers')
    .select('id, company_name, annual_value, is_active')
    .eq('is_active', true)

  if (!customers || customers.length === 0) return []

  const sinceISO = startOfMonthISO(12)

  const { data: cases } = await supabase
    .from('cases')
    .select('id, customer_id')
    .gte('completed_date', sinceISO)
    .not('completed_date', 'is', null)

  const caseIdsByCust = new Map<string, string[]>()
  cases?.forEach((c: any) => {
    if (!c.customer_id) return
    const arr = caseIdsByCust.get(c.customer_id) || []
    arr.push(c.id)
    caseIdsByCust.set(c.customer_id, arr)
  })

  const allCaseIds = Array.from(caseIdsByCust.values()).flat()

  let costByCase = new Map<string, { revenue: number; cost: number }>()

  if (allCaseIds.length > 0) {
    const items = await fetchCaseBillingItemsByCaseIds(allCaseIds, 'case_id, item_type, total_price, quantity, article_id')

    const articleIds = Array.from(new Set(items.map((i: any) => i.article_id).filter(Boolean)))
    const { data: articles } = articleIds.length > 0
      ? await supabase.from('articles').select('id, default_price').in('id', articleIds)
      : { data: [] as any[] }
    const costById = new Map((articles || []).map((a: any) => [a.id, Number(a.default_price || 0)]))

    items.forEach((it: any) => {
      const k = costByCase.get(it.case_id) || { revenue: 0, cost: 0 }
      if (it.item_type === 'service') k.revenue += Number(it.total_price || 0)
      else if (it.item_type === 'article') k.cost += (costById.get(it.article_id) || 0) * Number(it.quantity || 0)
      costByCase.set(it.case_id, k)
    })
  }

  return customers.map((c: any) => {
    const caseIds = caseIdsByCust.get(c.id) || []
    const agg = caseIds.reduce((acc, cid) => {
      const v = costByCase.get(cid)
      if (!v) return acc
      acc.revenue += v.revenue
      acc.cost += v.cost
      return acc
    }, { revenue: 0, cost: 0 })
    const marginPct = agg.revenue > 0 ? ((agg.revenue - agg.cost) / agg.revenue) * 100 : 0
    return {
      customer_id: c.id,
      company_name: c.company_name || 'Okänd kund',
      annual_value: Number(c.annual_value || 0),
      margin_percent: marginPct,
      case_count: caseIds.length,
    }
  }).filter(r => r.annual_value > 0)
}

// ---------- 8. Technician scatter ----------

export const getTechnicianMarginScatter = async (
  startDate: string,
  endDate: string
): Promise<TechnicianScatterPoint[]> => {
  // Hämta completed cases från alla tre tabellerna
  // cases (legacy): primary_technician_id/name | private_cases/business_cases: primary_assignee_id/name
  const [legacyRes, privateRes, businessRes] = await Promise.all([
    supabase.from('cases').select('id, primary_technician_id, primary_technician_name').gte('completed_date', startDate).lte('completed_date', endDate).not('primary_technician_id', 'is', null),
    supabase.from('private_cases').select('id, primary_assignee_id, primary_assignee_name').gte('completed_date', startDate).lte('completed_date', endDate).not('primary_assignee_id', 'is', null),
    supabase.from('business_cases').select('id, primary_assignee_id, primary_assignee_name').gte('completed_date', startDate).lte('completed_date', endDate).not('primary_assignee_id', 'is', null),
  ])

  const cases: Array<{ id: string; primary_technician_id: string; primary_technician_name: string }> = [
    ...(legacyRes.data || []).map((c: any) => ({ id: c.id, primary_technician_id: c.primary_technician_id, primary_technician_name: c.primary_technician_name })),
    ...(privateRes.data || []).map((c: any) => ({ id: c.id, primary_technician_id: c.primary_assignee_id, primary_technician_name: c.primary_assignee_name })),
    ...(businessRes.data || []).map((c: any) => ({ id: c.id, primary_technician_id: c.primary_assignee_id, primary_technician_name: c.primary_assignee_name })),
  ]

  if (cases.length === 0) return []

  const caseIds = cases.map((c: any) => c.id)
  const items = await fetchCaseBillingItemsByCaseIds(caseIds, 'case_id, item_type, total_price, quantity, article_id')

  const articleIds = Array.from(new Set(items.map((i: any) => i.article_id).filter(Boolean)))
  const { data: articles } = articleIds.length > 0
    ? await supabase.from('articles').select('id, default_price').in('id', articleIds)
    : { data: [] as any[] }
  const costById = new Map((articles || []).map((a: any) => [a.id, Number(a.default_price || 0)]))

  const caseAgg = new Map<string, { revenue: number; cost: number }>()
  items.forEach((it: any) => {
    const k = caseAgg.get(it.case_id) || { revenue: 0, cost: 0 }
    if (it.item_type === 'service') k.revenue += Number(it.total_price || 0)
    else if (it.item_type === 'article') k.cost += (costById.get(it.article_id) || 0) * Number(it.quantity || 0)
    caseAgg.set(it.case_id, k)
  })

  const byTech = new Map<string, { name: string; cases: Set<string>; revenue: number; cost: number }>()
  cases.forEach((c: any) => {
    const t = byTech.get(c.primary_technician_id) || {
      name: c.primary_technician_name || 'Okänd',
      cases: new Set<string>(), revenue: 0, cost: 0,
    }
    const agg = caseAgg.get(c.id)
    if (agg) { t.revenue += agg.revenue; t.cost += agg.cost }
    t.cases.add(c.id)
    byTech.set(c.primary_technician_id, t)
  })

  return Array.from(byTech.entries()).map(([id, t]) => ({
    technician_id: id,
    technician_name: t.name,
    cases_completed: t.cases.size,
    avg_margin_percent: t.revenue > 0 ? ((t.revenue - t.cost) / t.revenue) * 100 : 0,
    total_revenue: t.revenue,
  }))
}

// ---------- 9. Technician commission trend ----------

export const getTechnicianCommissionTrend = async (
  months: number = 12
): Promise<{ data: TechnicianCommissionTrendRow[]; technicians: string[] }> => {
  const since = startOfMonthISO(months)
  const keys = monthsBackFrom(months)

  // Auktoritativ källa: commission_posts (samma som /admin/provisioner).
  // Provisioner's månadsväljare grupperar på created_at och visar alla statusar
  // utom 'cancelled' — vi speglar det för att siffrorna ska matcha.
  const { data, error } = await supabase
    .from('commission_posts')
    .select('created_at, technician_name, commission_amount, status')
    .gte('created_at', since)
    .neq('status', 'cancelled')

  if (error) throw error
  const posts = (data || []) as Array<{
    created_at: string
    technician_name: string
    commission_amount: number | null
  }>

  const byMonth = new Map<string, Map<string, number>>()
  keys.forEach(k => byMonth.set(k, new Map()))
  const techSet = new Set<string>()

  posts.forEach(p => {
    if (!p.created_at || !p.technician_name) return
    const key = p.created_at.slice(0, 7)
    const mm = byMonth.get(key)
    if (!mm) return
    techSet.add(p.technician_name)
    mm.set(p.technician_name, (mm.get(p.technician_name) || 0) + Number(p.commission_amount || 0))
  })

  const technicians = Array.from(techSet).sort()
  const result: TechnicianCommissionTrendRow[] = keys.map(month => {
    const mm = byMonth.get(month)!
    const row: TechnicianCommissionTrendRow = { month }
    technicians.forEach(name => { row[name] = mm.get(name) || 0 })
    return row
  })
  return { data: result, technicians }
}

// ---------- 10. Case throughput (avg completion days) ----------

export const getCaseThroughput = async (months: number = 12): Promise<ThroughputPoint[]> => {
  const since = startOfMonthISO(months)
  const keys = monthsBackFrom(months)

  // Hämta från alla tre case-tabellerna
  const [legacyRes, privateRes, businessRes] = await Promise.all([
    supabase.from('cases').select('created_at, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
    supabase.from('private_cases').select('created_at, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
    supabase.from('business_cases').select('created_at, completed_date').gte('completed_date', since).not('completed_date', 'is', null),
  ])
  const cases: Array<{ created_at: string; completed_date: string }> = [
    ...((legacyRes.data || []) as any[]),
    ...((privateRes.data || []) as any[]),
    ...((businessRes.data || []) as any[]),
  ]

  const bucket: Record<string, { sum: number; count: number }> = {}
  keys.forEach(k => { bucket[k] = { sum: 0, count: 0 } })

  cases?.forEach((c: any) => {
    const k = c.completed_date.slice(0, 7)
    if (!bucket[k]) return
    const days = (new Date(c.completed_date).getTime() - new Date(c.created_at).getTime()) / 86400000
    bucket[k].sum += days
    bucket[k].count++
  })

  return keys.map(month => ({
    month,
    avg_days: bucket[month].count > 0 ? bucket[month].sum / bucket[month].count : 0,
    cases_completed: bucket[month].count,
  }))
}

// ---------- 11. Sparkline-mått (hero-kort) ----------

/**
 * MRR baserat på customers.monthly_value (summa) — enkel sparkline som visar tillväxten över 30 dagar
 * (snapshot, inte historisk eftersom vi inte har tidsserie på monthly_value ännu)
 */
export const getMrrSparkline = async (): Promise<SparklineMetric> => {
  const { data: customers } = await supabase
    .from('customers')
    .select('monthly_value')
    .eq('is_active', true)

  const current = (customers || []).reduce((s: number, c: any) => s + Number(c.monthly_value || 0), 0)

  // Fyll 30-dagars sparkline med nuvärdet (tills vi har tidsserie)
  const sparkline: SparklinePoint[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    sparkline.push({ date: d.toISOString().split('T')[0], value: current })
  }
  return { current, previous: current, delta_percent: 0, sparkline }
}

export const getAvgMarginSparkline = async (): Promise<SparklineMetric> => {
  const points = await getMarginByMonth(12)
  const valid = points.filter(p => p.revenue > 0)
  const current = valid.length > 0 ? valid[valid.length - 1].margin_percent : 0
  const previous = valid.length > 1 ? valid[valid.length - 2].margin_percent : current
  const delta = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0

  const sparkline: SparklinePoint[] = points.map(p => ({ date: `${p.month}-01`, value: p.margin_percent }))
  return { current, previous, delta_percent: delta, sparkline }
}

export const getOutstandingSparkline = async (): Promise<SparklineMetric> => {
  const [{ data: cbi }, { data: inv }] = await Promise.all([
    supabase.from('contract_billing_items').select('total_price, created_at, paid_at, status').is('paid_at', null).neq('status', 'cancelled'),
    supabase.from('invoices').select('total_amount, created_at, paid_at, status').is('paid_at', null),
  ])

  const outstandingNow =
    (cbi || []).reduce((s: number, r: any) => s + Number(r.total_price || 0), 0) +
    (inv || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)

  // 30-dagars sparkline (beräknar hur mycket som var utestående N dagar tillbaka)
  const sparkline: SparklinePoint[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    const v =
      (cbi || []).filter((r: any) => r.created_at && r.created_at.slice(0, 10) <= iso).reduce((s: number, r: any) => s + Number(r.total_price || 0), 0) +
      (inv || []).filter((r: any) => r.created_at && r.created_at.slice(0, 10) <= iso).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
    sparkline.push({ date: iso, value: v })
  }
  const previous = sparkline.length > 0 ? sparkline[0].value : 0
  const delta = previous > 0 ? ((outstandingNow - previous) / previous) * 100 : 0
  return { current: outstandingNow, previous, delta_percent: delta, sparkline }
}

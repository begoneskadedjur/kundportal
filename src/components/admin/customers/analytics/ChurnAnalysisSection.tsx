// src/components/admin/customers/analytics/ChurnAnalysisSection.tsx - Churn-analys med KPI:er, diagram och lista

import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingDown, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import Card from '../../../ui/Card'
import { ConsolidatedCustomer } from '../../../../hooks/useConsolidatedCustomers'

interface ChurnAnalysisSectionProps {
  terminatedCustomers: ConsolidatedCustomer[]
  onCustomerClick?: (name: string) => void
}

const REASON_COLORS = ['#ef4444', '#f97316', '#eab308', '#64748b', '#94a3b8', '#475569']

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function ChurnAnalysisSection({ terminatedCustomers, onCustomerClick }: ChurnAnalysisSectionProps) {
  const [sortBy, setSortBy] = useState<'value' | 'date' | 'health'>('value')
  const [activeReasonIndex, setActiveReasonIndex] = useState<number | null>(null)

  // KPI-beräkningar
  const kpis = useMemo(() => {
    const lostAnnualValue = terminatedCustomers.reduce((sum, c) => sum + (c.totalAnnualValue || 0), 0)

    // Genomsnittlig avtalstid i månader
    const tenures = terminatedCustomers
      .filter(c => c.earliestContractStartDate && c.effectiveEndDate)
      .map(c => {
        const start = new Date(c.earliestContractStartDate!)
        const end = new Date(c.effectiveEndDate!)
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      })
    const avgTenureMonths = tenures.length > 0
      ? Math.round(tenures.reduce((sum, t) => sum + t, 0) / tenures.length)
      : 0

    return { lostAnnualValue, avgTenureMonths }
  }, [terminatedCustomers])

  // Anledningsfördelning (PieChart-data)
  const reasonsData = useMemo(() => {
    const reasons: Record<string, number> = {}
    terminatedCustomers.forEach(c => {
      // Hämta anledning från sites (kan variera per site, ta första med anledning)
      const reason = c.sites.find(s => s.termination_reason)?.termination_reason || 'Ej angiven'
      reasons[reason] = (reasons[reason] || 0) + 1
    })
    return Object.entries(reasons)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [terminatedCustomers])

  const reasonsTotal = reasonsData.reduce((sum, d) => sum + d.value, 0)

  // Churn-tidslinje (BarChart-data, grupperat per månad)
  const timelineData = useMemo(() => {
    const months: Record<string, { count: number; value: number }> = {}
    terminatedCustomers.forEach(c => {
      const dateStr = c.effectiveEndDate || c.sites.find(s => s.terminated_at)?.terminated_at
      if (!dateStr) return
      const date = new Date(dateStr)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { count: 0, value: 0 }
      months[key].count++
      months[key].value += c.totalAnnualValue || 0
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [year, month] = key.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        const label = date.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
        return { month: label, count: data.count, value: data.value }
      })
  }, [terminatedCustomers])

  // Sorterad kundlista
  const sortedCustomers = useMemo(() => {
    return [...terminatedCustomers].sort((a, b) => {
      switch (sortBy) {
        case 'value': return (b.totalAnnualValue || 0) - (a.totalAnnualValue || 0)
        case 'date':
          const dateA = a.effectiveEndDate ? new Date(a.effectiveEndDate).getTime() : 0
          const dateB = b.effectiveEndDate ? new Date(b.effectiveEndDate).getTime() : 0
          return dateB - dateA
        case 'health': return (a.overallHealthScore?.score || 0) - (b.overallHealthScore?.score || 0)
        default: return 0
      }
    })
  }, [terminatedCustomers, sortBy])

  const ReasonTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-white">{item.name}</p>
        <p className="text-sm text-red-400">{item.value} kunder</p>
        <p className="text-xs text-slate-400">
          {reasonsTotal > 0 ? ((item.value / reasonsTotal) * 100).toFixed(0) : 0}%
        </p>
      </div>
    )
  }

  const TimelineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-white mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-sm" style={{ color: p.color }}>
            {p.dataKey === 'count' ? `${p.value} uppsagda` : formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { label: 'Utmärkt', color: 'text-green-400 bg-green-400/10' }
    if (score >= 60) return { label: 'Bra', color: 'text-yellow-400 bg-yellow-400/10' }
    if (score >= 40) return { label: 'Medel', color: 'text-orange-400 bg-orange-400/10' }
    return { label: 'Dålig', color: 'text-red-400 bg-red-400/10' }
  }

  return (
    <div className="space-y-6">
      {/* Rubrik */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
          <TrendingDown className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Churn-analys</h2>
          <p className="text-xs text-slate-400">Insikter om uppsagda kunder och förlorade intäkter</p>
        </div>
      </div>

      {/* KPI-rad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Förlorat Årsvärde</p>
            <TrendingDown className="w-5 h-5 text-red-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(kpis.lostAnnualValue)}</p>
          <p className="text-xs text-slate-500">Totalt förlorad årsintäkt</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Uppsagda Kunder</p>
            <Users className="w-5 h-5 text-red-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white">{terminatedCustomers.length}</p>
          <p className="text-xs text-slate-500">Antal uppsagda organisationer</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-slate-400">Snitt Avtalstid</p>
            <Clock className="w-5 h-5 text-amber-500 opacity-50" />
          </div>
          <p className="text-2xl font-bold text-white">
            {kpis.avgTenureMonths > 0 ? `${kpis.avgTenureMonths} mån` : '—'}
          </p>
          <p className="text-xs text-slate-500">Genomsnittlig tid som kund</p>
        </Card>
      </div>

      {/* Diagram-grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uppsägningsanledningar (PieChart) */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Uppsägningsanledningar</h3>

          {reasonsData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Ingen data tillgänglig
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reasonsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveReasonIndex(index)}
                      onMouseLeave={() => setActiveReasonIndex(null)}
                    >
                      {reasonsData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={REASON_COLORS[index % REASON_COLORS.length]}
                          opacity={activeReasonIndex === null || activeReasonIndex === index ? 1 : 0.4}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ReasonTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-2">
                {reasonsData.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2 rounded hover:bg-slate-800/50 transition-colors"
                    onMouseEnter={() => setActiveReasonIndex(index)}
                    onMouseLeave={() => setActiveReasonIndex(null)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: REASON_COLORS[index % REASON_COLORS.length] }}
                      />
                      <span className="text-sm text-slate-300 truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-white">{item.value}</span>
                      <span className="text-xs text-slate-500 ml-1">
                        ({reasonsTotal > 0 ? ((item.value / reasonsTotal) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Churn-tidslinje (BarChart) */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Uppsägningar per månad</h3>

          {timelineData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Ingen tidslinjedata tillgänglig
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<TimelineTooltip />} />
                <Bar yAxisId="left" dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} name="Antal" />
                <Bar yAxisId="right" dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.6} name="Förlorat värde" />
              </BarChart>
            </ResponsiveContainer>
          )}

          {timelineData.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-500" />
                Antal uppsagda
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500 opacity-60" />
                Förlorat värde
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Uppsagda kunder-lista */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Uppsagda kunder</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sortera:</span>
            {(['value', 'date', 'health'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sortBy === key
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                }`}
              >
                {key === 'value' ? 'Värde' : key === 'date' ? 'Datum' : 'Hälsa'}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-800/95 border-b border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Företag</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Typ</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Årsvärde</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Slutdatum</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Anledning</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Hälsa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedCustomers.map((customer) => {
                const reason = customer.sites.find(s => s.termination_reason)?.termination_reason || '—'
                const healthBadge = getHealthBadge(customer.overallHealthScore?.score || 0)
                const endDate = customer.effectiveEndDate
                  ? new Date(customer.effectiveEndDate).toLocaleDateString('sv-SE')
                  : '—'

                return (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => onCustomerClick?.(customer.company_name)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-white font-medium">{customer.company_name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        customer.organizationType === 'multisite'
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'bg-slate-400/10 text-slate-400'
                      }`}>
                        {customer.organizationType === 'multisite' ? 'Multisite' : 'Enskild'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm text-red-400 font-medium">
                        {formatCurrency(customer.totalAnnualValue || 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-slate-300">{endDate}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-slate-400 truncate block max-w-[160px]">{reason}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${healthBadge.color}`}>
                        {customer.overallHealthScore?.score || 0}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// 📁 src/components/admin/economics/CaseEconomyChart.tsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { FileText, Clock, DollarSign, TrendingUp } from 'lucide-react'
import Card from '../../ui/Card'
import { useEconomicsDashboard } from '../../../hooks/useEconomicsDashboard'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium">{data.case_type}</p>
        <p className="text-slate-300 text-sm">Antal: {data.count}</p>
        <p className="text-slate-300 text-sm">Genomsnittspris: {formatCurrency(data.avg_price)}</p>
        <p className="text-slate-300 text-sm">Total intäkt: {formatCurrency(data.total_revenue)}</p>
      </div>
    )
  }
  return null
}

const CaseEconomyChart: React.FC = () => {
  const { caseEconomy, loading, error } = useEconomicsDashboard()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <FileText className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Ärendeekonomi</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <FileText className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av ärendedata: {error}</span>
        </div>
      </Card>
    )
  }

  if (!caseEconomy) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <FileText className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Ärendeekonomi</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Clock className="w-8 h-8 mr-2" />
          <span>Ingen ärendedata tillgänglig</span>
        </div>
      </Card>
    )
  }

  // Förbered data för visualisering
  const caseTypeData = caseEconomy.case_types.sort((a, b) => b.total_revenue - a.total_revenue)

  // Data för pie chart
  const pieData = caseTypeData.map((type, index) => ({
    name: type.case_type,
    value: type.total_revenue,
    count: type.count,
    percentage: (type.total_revenue / caseEconomy.total_revenue_this_month) * 100
  }))

  // Identifiera mest lönsamma ärendetype
  const mostProfitable = caseTypeData[0]
  const mostCommon = [...caseTypeData].sort((a, b) => b.count - a.count)[0]
  const highestAvgPrice = [...caseTypeData].sort((a, b) => b.avg_price - a.avg_price)[0]

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Ärendeekonomi</h2>
          <span className="ml-2 text-sm text-slate-400">(Denna månad)</span>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total intäkt denna månad</p>
          <p className="text-lg font-bold text-yellow-400">{formatCurrency(caseEconomy.total_revenue_this_month)}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 font-bold text-lg">{caseEconomy.total_cases_this_month}</p>
          <p className="text-yellow-300 text-sm">Totala ärenden</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-lg">{formatCurrency(caseEconomy.avg_case_price)}</p>
          <p className="text-green-300 text-sm">Genomsnittspris</p>
        </div>
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 font-bold text-lg">{caseEconomy.avg_completion_days.toFixed(1)}</p>
          <p className="text-blue-300 text-sm">Dagar att slutföra</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-purple-400 font-bold text-lg">{caseTypeData.length}</p>
          <p className="text-purple-300 text-sm">Ärendetyper</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Intäkter per ärendetype */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Intäkter per ärendetype</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={caseTypeData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                tickFormatter={(value) => formatCurrency(value).replace('kr', '') + 'k'}
                stroke="#9ca3af"
                fontSize={11}
              />
              <YAxis 
                type="category" 
                dataKey="case_type"
                stroke="#9ca3af"
                fontSize={10}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="total_revenue" 
                fill="#f59e0b"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Fördelning av intäkter */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Intäktsfördelning</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  formatCurrency(value), 
                  `${name} (${props.payload.count} ärenden)`
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analys och insights */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center">
          <TrendingUp className="w-4 h-4 mr-1" />
          Ärendeanalys
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mest lönsam - nu visar pågående potential */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 font-medium text-sm">Pågående potential</p>
                <p className="text-white font-semibold text-sm">{caseEconomy.ongoing_cases_count} ärenden</p>
                <p className="text-slate-400 text-xs">{formatCurrency(caseEconomy.ongoing_potential_revenue)} potential</p>
              </div>
              <div className="text-green-400 text-xl">⏳</div>
            </div>
          </div>

          {/* Vanligast */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 font-medium text-sm">Vanligast</p>
                <p className="text-white font-semibold text-sm">{mostCommon?.case_type || 'N/A'}</p>
                <p className="text-slate-400 text-xs">{mostCommon?.count || 0} ärenden</p>
              </div>
              <div className="text-blue-400 text-xl">📊</div>
            </div>
          </div>

          {/* Högst pris */}
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 font-medium text-sm">Högst genomsnittspris</p>
                <p className="text-white font-semibold text-sm">{highestAvgPrice?.case_type || 'N/A'}</p>
                <p className="text-slate-400 text-xs">{formatCurrency(highestAvgPrice?.avg_price || 0)}</p>
              </div>
              <div className="text-purple-400 text-xl">💎</div>
            </div>
          </div>
        </div>

        {/* Detaljerad ärendetabell */}
        <div className="mt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">Fullständig ärendeöversikt</h4>
          <div className="overflow-hidden rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-800">
                <tr className="text-slate-300">
                  <th className="px-3 py-2 text-left">Typ av ärende</th>
                  <th className="px-3 py-2 text-right">Antal</th>
                  <th className="px-3 py-2 text-right">Genomsnittspris</th>
                  <th className="px-3 py-2 text-right">Total intäkt</th>
                  <th className="px-3 py-2 text-right">Andel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {caseTypeData.map((type, index) => (
                  <tr key={type.case_type} className="text-slate-300 hover:bg-slate-800/50">
                    <td className="px-3 py-2">{type.case_type}</td>
                    <td className="px-3 py-2 text-right">{type.count}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(type.avg_price)}</td>
                    <td className="px-3 py-2 text-right text-yellow-400">{formatCurrency(type.total_revenue)}</td>
                    <td className="px-3 py-2 text-right">{((type.total_revenue / caseEconomy.total_revenue_this_month) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default CaseEconomyChart
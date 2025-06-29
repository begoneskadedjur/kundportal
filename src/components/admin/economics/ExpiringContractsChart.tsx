// 📁 src/components/admin/economics/ExpiringContractsChart.tsx
import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { AlertTriangle, Clock, Users } from 'lucide-react'
import Card from '../../ui/Card'
import { useExpiringContracts } from '../../../hooks/useEconomicsDashboard'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const RISK_COLORS = {
  high: '#ef4444', // red-500
  medium: '#f59e0b', // amber-500
  low: '#22c55e' // green-500
}

const RISK_LABELS = {
  high: 'Hög risk (≤3 mån)',
  medium: 'Medium risk (4-6 mån)',
  low: 'Låg risk (>6 mån)'
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium">{data.company_name}</p>
        <p className="text-slate-300 text-sm">Årspremie: {formatCurrency(data.annual_premium)}</p>
        <p className="text-slate-300 text-sm">Månader kvar: {data.months_remaining}</p>
        <p className="text-slate-300 text-sm">Account Manager: {data.assigned_account_manager}</p>
      </div>
    )
  }
  return null
}

const ExpiringContractsChart: React.FC = () => {
  const { data: contracts, loading, error } = useExpiringContracts()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Utgående Avtal</h2>
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
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av avtalsdata: {error}</span>
        </div>
      </Card>
    )
  }

  if (!contracts.length) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Utgående Avtal</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Users className="w-8 h-8 mr-2" />
          <span>Inga utgående avtal</span>
        </div>
      </Card>
    )
  }

  // Gruppera efter risknivå
  const riskSummary = contracts.reduce((acc, contract) => {
    const risk = contract.risk_level
    if (!acc[risk]) {
      acc[risk] = {
        name: RISK_LABELS[risk],
        count: 0,
        totalValue: 0,
        contracts: []
      }
    }
    acc[risk].count++
    acc[risk].totalValue += contract.annual_premium
    acc[risk].contracts.push(contract)
    return acc
  }, {} as Record<string, any>)

  const pieData = Object.entries(riskSummary).map(([risk, data]) => ({
    name: data.name,
    value: data.count,
    totalValue: data.totalValue,
    risk
  }))

  // Top 10 avtal som löper ut soonest för bar chart
  const topContracts = contracts
    .slice(0, 10)
    .map(contract => ({
      ...contract,
      shortName: contract.company_name.length > 15 
        ? contract.company_name.substring(0, 15) + '...' 
        : contract.company_name
    }))

  const totalAtRisk = contracts.reduce((sum, c) => sum + c.annual_premium, 0)
  const highRiskCount = contracts.filter(c => c.risk_level === 'high').length
  const mediumRiskCount = contracts.filter(c => c.risk_level === 'medium').length

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Utgående Avtal</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total ARR i riskzonen</p>
          <p className="text-lg font-bold text-yellow-400">{formatCurrency(totalAtRisk)}</p>
        </div>
      </div>

      {/* Sammanfattning */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 font-bold text-xl">{highRiskCount}</p>
          <p className="text-red-300 text-sm">Hög risk</p>
        </div>
        <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 font-bold text-xl">{mediumRiskCount}</p>
          <p className="text-yellow-300 text-sm">Medium risk</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-xl">{contracts.length}</p>
          <p className="text-green-300 text-sm">Totalt</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Fördelning */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Riskfördelning</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${value}`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.risk as keyof typeof RISK_COLORS]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name, props) => [
                  `${value} avtal (${formatCurrency(props.payload.totalValue)})`,
                  props.payload.name
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Top 10 soonest */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Närmast utgång</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topContracts} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                tickFormatter={(value) => `${value} mån`}
                stroke="#9ca3af"
                fontSize={11}
              />
              <YAxis 
                type="category" 
                dataKey="shortName"
                stroke="#9ca3af"
                fontSize={10}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="months_remaining" 
                fill={(entry: any) => RISK_COLORS[entry.risk_level]}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lista över högriskkunder */}
      {highRiskCount > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Kräver omedelbar uppmärksamhet ({highRiskCount} kunder)
          </h3>
          <div className="space-y-2">
            {contracts
              .filter(c => c.risk_level === 'high')
              .slice(0, 5)
              .map(contract => (
                <div key={contract.customer_id} className="flex items-center justify-between text-sm bg-red-500/5 border border-red-500/20 rounded p-2">
                  <span className="text-white">{contract.company_name}</span>
                  <span className="text-red-400">{contract.months_remaining} mån</span>
                  <span className="text-slate-300">{formatCurrency(contract.annual_premium)}</span>
                  <span className="text-slate-400">{contract.assigned_account_manager}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default ExpiringContractsChart
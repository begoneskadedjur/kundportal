// 📁 src/components/admin/economics/AccountManagerRevenueChart.tsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import { UserCheck, Crown, Users } from 'lucide-react'
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium">{data.account_manager}</p>
        <p className="text-slate-300 text-sm">Årlig ARR: {formatCurrency(data.annual_revenue)}</p>
        <p className="text-slate-300 text-sm">Kunder: {data.customers_count}</p>
        <p className="text-slate-300 text-sm">Totalt avtalsvärde: {formatCurrency(data.total_contract_value)}</p>
        <p className="text-slate-300 text-sm">Genomsnitt/kund: {formatCurrency(data.avg_contract_value)}</p>
      </div>
    )
  }
  return null
}

const ScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium">{data.account_manager}</p>
        <p className="text-slate-300 text-sm">Kunder: {data.customers_count}</p>
        <p className="text-slate-300 text-sm">ARR per kund: {formatCurrency(data.avg_contract_value)}</p>
      </div>
    )
  }
  return null
}

const AccountManagerRevenueChart: React.FC = () => {
  const { accountManagerRevenue, loading, error } = useEconomicsDashboard()

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <UserCheck className="w-5 h-5 text-indigo-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Account Manager-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <UserCheck className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av account manager-data: {error}</span>
        </div>
      </Card>
    )
  }

  if (!accountManagerRevenue.length) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <UserCheck className="w-5 h-5 text-indigo-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Account Manager-prestanda</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Users className="w-8 h-8 mr-2" />
          <span>Ingen account manager-data tillgänglig</span>
        </div>
      </Card>
    )
  }

  // Beräkna totaler och statistik
  const totalRevenue = accountManagerRevenue.reduce((sum, am) => sum + am.annual_revenue, 0)
  const totalCustomers = accountManagerRevenue.reduce((sum, am) => sum + am.customers_count, 0)
  const avgRevenuePerManager = totalRevenue / accountManagerRevenue.length

  // Förkorta namn för visualisering
  const chartData = accountManagerRevenue.map(am => ({
    ...am,
    shortName: am.account_manager.length > 15 
      ? am.account_manager.substring(0, 15) + '...' 
      : am.account_manager
  }))

  // Identifiera topp performers
  const topRevenue = accountManagerRevenue[0]
  const mostCustomers = [...accountManagerRevenue].sort((a, b) => b.customers_count - a.customers_count)[0]
  const highestAvgValue = [...accountManagerRevenue].sort((a, b) => b.avg_contract_value - a.avg_contract_value)[0]

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <UserCheck className="w-5 h-5 text-indigo-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Account Manager-prestanda</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total ARR</p>
          <p className="text-lg font-bold text-indigo-400">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Övergripande statistik */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
          <p className="text-indigo-400 font-bold text-lg">{accountManagerRevenue.length}</p>
          <p className="text-indigo-300 text-sm">Account Managers</p>
        </div>
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 font-bold text-lg">{totalCustomers}</p>
          <p className="text-blue-300 text-sm">Totala kunder</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 font-bold text-lg">{formatCurrency(avgRevenuePerManager)}</p>
          <p className="text-green-300 text-sm">Genomsnitt ARR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - ARR per Account Manager */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Årlig ARR per Account Manager</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                tickFormatter={(value) => formatCurrency(value).replace('kr', '') + 'k'}
                stroke="#9ca3af"
                fontSize={11}
              />
              <YAxis 
                type="category" 
                dataKey="shortName"
                stroke="#9ca3af"
                fontSize={10}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="annual_revenue" 
                fill="#6366f1"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter Plot - Kunder vs Genomsnittsvärde */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Kunder vs Genomsnittsvärde per kund</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                dataKey="customers_count"
                name="Antal kunder"
                stroke="#9ca3af"
                fontSize={11}
              />
              <YAxis 
                type="number" 
                dataKey="avg_contract_value"
                name="Genomsnittsvärde"
                tickFormatter={(value) => formatCurrency(value).replace('kr', '') + 'k'}
                stroke="#9ca3af"
                fontSize={11}
              />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter 
                name="Account Managers" 
                dataKey="avg_contract_value" 
                fill="#8b5cf6"
                strokeWidth={2}
                stroke="#8b5cf6"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Topp prestationer */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center">
          <Crown className="w-4 h-4 mr-1" />
          Topp prestationer
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Högst ARR */}
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-400 font-medium text-sm">Högst ARR</p>
                <p className="text-white font-semibold text-sm">{topRevenue?.account_manager}</p>
                <p className="text-slate-400 text-xs">{formatCurrency(topRevenue?.annual_revenue || 0)}</p>
              </div>
              <div className="text-indigo-400 text-xl">👑</div>
            </div>
          </div>

          {/* Flest kunder */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 font-medium text-sm">Flest kunder</p>
                <p className="text-white font-semibold text-sm">{mostCustomers?.account_manager}</p>
                <p className="text-slate-400 text-xs">{mostCustomers?.customers_count} kunder</p>
              </div>
              <div className="text-blue-400 text-xl">🏢</div>
            </div>
          </div>

          {/* Högst genomsnittsvärde */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 font-medium text-sm">Högst kundvärde</p>
                <p className="text-white font-semibold text-sm">{highestAvgValue?.account_manager}</p>
                <p className="text-slate-400 text-xs">{formatCurrency(highestAvgValue?.avg_contract_value || 0)}/kund</p>
              </div>
              <div className="text-green-400 text-xl">💎</div>
            </div>
          </div>
        </div>

        {/* Detaljerad ranking */}
        <div className="mt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">Fullständig ranking</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {accountManagerRevenue.map((am, index) => (
              <div key={am.account_manager} className="flex items-center justify-between text-xs bg-slate-800/30 rounded px-2 py-1">
                <span className="text-slate-300">#{index + 1} {am.account_manager}</span>
                <div className="flex items-center space-x-3 text-slate-400">
                  <span>{formatCurrency(am.annual_revenue)}</span>
                  <span>•</span>
                  <span>{am.customers_count} kunder</span>
                  <span>•</span>
                  <span>{formatCurrency(am.avg_contract_value)}/kund</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default AccountManagerRevenueChart
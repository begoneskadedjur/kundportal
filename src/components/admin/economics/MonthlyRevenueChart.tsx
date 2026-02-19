// src/components/admin/economics/MonthlyRevenueChart.tsx - MED 1 MÅNAD + MÅNAD-FÖR-MÅNAD NAVIGATION
import React, { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Calendar, Filter, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import Button from '../../ui/Button'
import { useMonthlyRevenue } from '../../../hooks/useEconomicsDashboard'
import { formatCurrency } from '../../../utils/formatters'

const MonthlyRevenueChart: React.FC = () => {
  const { data: monthlyData, loading, error } = useMonthlyRevenue()
  
  // 🆕 Månad-för-månad navigation med 1m option
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default till nuvarande månad
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('6m')
  const [showDataTypes, setShowDataTypes] = useState({
    contract: true,
    case: true,
    engangsjobb: true
  })

  // 🆕 Uppdatera selectedMonth när data laddas (för att säkerställa att månaden finns)
  useEffect(() => {
    if (Array.isArray(monthlyData) && monthlyData.length > 0) {
      const currentMonth = selectedMonth
      const monthExists = monthlyData.some(item => item.month === currentMonth)
      
      if (!monthExists) {
        // Om den valda månaden inte finns, välj den senaste tillgängliga månaden
        const latestMonth = monthlyData[monthlyData.length - 1].month
        setSelectedMonth(latestMonth)
      }
    }
  }, [monthlyData, selectedMonth])

  // 🆕 Navigeringsfunktioner
  const goToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prevDate = new Date(year, month - 2) // month - 1 för 0-baserad, -1 för föregående = -2
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month) // month - 1 för 0-baserad, +1 för nästa = 0
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }

  // 🆕 Kontrollera om navigation är möjlig
  const canGoPrevious = () => {
    if (!Array.isArray(monthlyData) || monthlyData.length === 0) return false
    const earliestMonth = monthlyData[0].month
    return selectedMonth > earliestMonth
  }

  const canGoNext = () => {
    if (!Array.isArray(monthlyData) || monthlyData.length === 0) return false
    const latestMonth = monthlyData[monthlyData.length - 1].month
    return selectedMonth < latestMonth
  }

  const isCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth === currentMonth
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-center mb-3">
          <BarChart3 className="w-4 h-4 text-[#20c58f] mr-2" />
          <h2 className="text-sm font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-center mb-3">
          <BarChart3 className="w-4 h-4 text-red-500 mr-2" />
          <h2 className="text-sm font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-red-400">
          <div className="text-center">
            <p className="mb-2">Fel vid laddning: {error}</p>
            <p className="text-sm text-slate-400">Kontrollera nätverksanslutningen och försök igen</p>
          </div>
        </div>
      </div>
    )
  }

  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    return (
      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-center mb-3">
          <BarChart3 className="w-4 h-4 text-slate-500 mr-2" />
          <h2 className="text-sm font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen intäktsdata tillgänglig</p>
            <p className="text-sm mt-2">Data kommer att visas när ärenden registreras</p>
          </div>
        </div>
      </div>
    )
  }

  // 🆕 Filtrera data baserat på vald månad + period (inklusive 1m)
  const getFilteredData = () => {
    const selectedIndex = monthlyData.findIndex(item => item.month === selectedMonth)
    if (selectedIndex === -1) return []
    
    const monthsToShow = selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
    const startIndex = Math.max(0, selectedIndex - monthsToShow + 1)
    const endIndex = selectedIndex + 1
    
    return monthlyData.slice(startIndex, endIndex)
  }

  const filteredData = getFilteredData()
  
  // 🆕 Hitta data för den valda månaden
  const selectedMonthData = monthlyData.find(item => item.month === selectedMonth)

  // Formatering av chart data med nya namn
  const chartData = filteredData.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('sv-SE', { 
      month: 'short', 
      year: '2-digit' 
    }),
    fullMonth: item.month,
    'Kontraktsintäkter': showDataTypes.contract ? (item.contract_revenue || 0) : 0,
    'Merförsäljning Avtal': showDataTypes.case ? (item.case_revenue || 0) : 0,
    'Intäkter Engångsjobb': showDataTypes.engangsjobb ? (item.begone_revenue || 0) : 0,
    'Total': (item.total_revenue || 0),
    // 🆕 Markera vald månad
    isSelected: item.month === selectedMonth
  }))

  // Beräkna totaler för period
  const totalContractRevenue = filteredData.reduce((sum, item) => sum + (item.contract_revenue || 0), 0)
  const totalCaseRevenue = filteredData.reduce((sum, item) => sum + (item.case_revenue || 0), 0)
  const totalEngangsjobb = filteredData.reduce((sum, item) => sum + (item.begone_revenue || 0), 0)
  const totalRevenue = filteredData.reduce((sum, item) => sum + (item.total_revenue || 0), 0)

  // 🆕 Data för vald månad
  const selectedMonthContract = selectedMonthData?.contract_revenue || 0
  const selectedMonthCase = selectedMonthData?.case_revenue || 0
  const selectedMonthEngangsjobb = selectedMonthData?.begone_revenue || 0
  const selectedMonthTotal = selectedMonthData?.total_revenue || 0

  // Beräkna tillväxt jämfört med föregående månad
  const selectedIndex = monthlyData.findIndex(item => item.month === selectedMonth)
  const previousMonthData = selectedIndex > 0 ? monthlyData[selectedIndex - 1] : null
  
  let growth = 0
  if (previousMonthData && (previousMonthData.total_revenue || 0) > 0) {
    growth = (((selectedMonthTotal) - (previousMonthData.total_revenue || 0)) / (previousMonthData.total_revenue || 0)) * 100
  }

  // 🆕 Formatera månad för visning
  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && Array.isArray(payload) && payload.length > 0) {
      const data = payload[0]?.payload
      const isSelectedMonth = data?.isSelected
      
      return (
        <div className={`border rounded-lg p-4 shadow-lg ${
          isSelectedMonth 
            ? 'bg-blue-800 border-blue-600' 
            : 'bg-slate-800 border-slate-700'
        }`}>
          <p className={`font-semibold mb-2 ${
            isSelectedMonth ? 'text-blue-200' : 'text-white'
          }`}>
            {label} {isSelectedMonth && '(Vald månad)'}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value || 0)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      {/* Header med månadnavigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center">
          <BarChart3 className="w-4 h-4 text-[#20c58f] mr-2" />
          <h2 className="text-sm font-semibold text-white">Månadsvis Intäktsflöde</h2>
        </div>

        {/* Månadnavigation */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Månadväljare */}
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-800 rounded-lg p-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious()}
              className="p-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="px-2 sm:px-3 py-1 text-white font-medium text-sm sm:text-base min-w-[120px] sm:min-w-[140px] text-center">
              {formatSelectedMonth(selectedMonth)}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={goToNextMonth}
              disabled={!canGoNext()}
              className="p-1"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Nuvarande månad knapp */}
          {!isCurrentMonth() && (
            <Button
              variant="primary"
              size="sm"
              onClick={goToCurrentMonth}
              className="text-xs"
            >
              Nuvarande
            </Button>
          )}

          {/* Period filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['1m', '3m', '6m', '12m'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="text-xs"
              >
                {period === '1m' ? '1 mån' : period === '3m' ? '3 mån' : period === '6m' ? '6 mån' : '12 mån'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 🆕 Statistik för vald månad/period */}
      <div className="mb-3">
        <h3 className="text-sm text-slate-400 mb-3">
          {selectedPeriod === '1m' 
            ? `${formatSelectedMonth(selectedMonth)} - Detaljerade intäkter`
            : `${formatSelectedMonth(selectedMonth)} (${selectedPeriod.toUpperCase()} period) - Detaljerade intäkter`
          }
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg">
            <p className="text-slate-300 font-bold text-lg">
              {selectedPeriod === '1m' ? formatCurrency(selectedMonthTotal) : formatCurrency(totalRevenue)}
            </p>
            <p className="text-slate-400 text-sm">
              {selectedPeriod === '1m' ? 'Total intäkt' : `Total intäkt (${selectedPeriod})`}
            </p>
          </div>
          <div className="text-center p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg">
            <p className="text-slate-300 font-bold text-lg">
              {selectedPeriod === '1m' ? formatCurrency(selectedMonthContract) : formatCurrency(totalContractRevenue)}
            </p>
            <p className="text-slate-400 text-sm">Kontraktsintäkter</p>
          </div>
          <div className="text-center p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg">
            <p className="text-slate-300 font-bold text-lg">
              {selectedPeriod === '1m' ? formatCurrency(selectedMonthCase) : formatCurrency(totalCaseRevenue)}
            </p>
            <p className="text-slate-400 text-sm">Merförsäljning Avtal</p>
          </div>
          <div className="text-center p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg">
            <p className="text-slate-300 font-bold text-lg">
              {selectedPeriod === '1m' ? formatCurrency(selectedMonthEngangsjobb) : formatCurrency(totalEngangsjobb)}
            </p>
            <p className="text-slate-400 text-sm">Intäkter Engångsjobb</p>
          </div>
        </div>
      </div>

      {/* Data typ filter */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3">
        <span className="text-sm text-slate-400 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Visa:
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showDataTypes.contract ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowDataTypes(prev => ({ ...prev, contract: !prev.contract }))}
            className="text-xs"
          >
            Kontrakt
          </Button>
          <Button
            variant={showDataTypes.case ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowDataTypes(prev => ({ ...prev, case: !prev.case }))}
            className="text-xs"
          >
            Merförsäljning
          </Button>
          <Button
            variant={showDataTypes.engangsjobb ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowDataTypes(prev => ({ ...prev, engangsjobb: !prev.engangsjobb }))}
            className="text-xs"
          >
            Engångsjobb
          </Button>
        </div>
      </div>

      {/* Chart med markering av vald månad */}
      <div className="h-48 sm:h-64 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="contractGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="caseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="engangsjobGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#475569" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#475569" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="month" 
              stroke="#94a3b8"
              fontSize={12}
            />
            <YAxis 
              stroke="#94a3b8"
              fontSize={12}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />
            
            {showDataTypes.contract && (
              <Area
                type="monotone"
                dataKey="Kontraktsintäkter"
                stackId="1"
                stroke="#64748b"
                fill="url(#contractGradient)"
                strokeWidth={2}
              />
            )}
            
            {showDataTypes.case && (
              <Area
                type="monotone"
                dataKey="Merförsäljning Avtal"
                stackId="1"
                stroke="#94a3b8"
                fill="url(#caseGradient)"
                strokeWidth={2}
              />
            )}
            
            {showDataTypes.engangsjobb && (
              <Area
                type="monotone"
                dataKey="Intäkter Engångsjobb"
                stackId="1"
                stroke="#475569"
                fill="url(#engangsjobGradient)"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 🆕 Tillväxt jämfört med föregående månad - visar alltid för vald månad */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
          <span className="text-slate-400">
            {formatSelectedMonth(selectedMonth)} jämfört med föregående månad:
          </span>
          <div className="flex items-center gap-4">
            <span className="text-white">
              {formatCurrency(selectedMonthTotal)}
            </span>
            {previousMonthData && (
              <span className={`flex items-center gap-1 ${
                growth >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                <TrendingUp className={`w-3 h-3 ${growth < 0 ? 'rotate-180' : ''}`} />
                {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonthlyRevenueChart
// 📁 src/pages/technician/TechnicianCommissions.tsx - FÖRENKLAD VERSION BASERAT PÅ ADMIN-MÖNSTER
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, DollarSign, Calendar, TrendingUp, Eye, FileText,
  ChevronLeft, ChevronRight, Building2, User, CheckCircle, AlertCircle
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared'

// Interfaces
interface MonthlyCommission {
  month: string
  month_display: string
  total_commission: number
  case_count: number
  private_commission: number
  business_commission: number
  avg_commission_per_case: number
}

interface CommissionStats {
  total_ytd: number
  total_cases_ytd: number
  avg_per_case: number
  highest_month: number
  best_month_name: string
}

interface CommissionsData {
  success: boolean
  monthly_data: MonthlyCommission[]
  stats: CommissionStats
  meta: {
    technician_id: string
    technician_name?: string
    year: number
    months_available: number
  }
}

export default function TechnicianCommissions() {
  const { profile, technician, isTechnician } = useAuth()
  const navigate = useNavigate()
  
  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CommissionsData | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  // Säkerhetskontroll
  useEffect(() => {
    if (!isTechnician || !technician?.id) {
      console.log('❌ Inte en tekniker, omdirigerar från commissions...')
      navigate('/login', { replace: true })
      return
    }
  }, [isTechnician, technician, navigate])

  // 🔥 SAMMA FETCH-MÖNSTER SOM ADMIN
  useEffect(() => {
    if (isTechnician && technician?.id) {
      fetchCommissionData()
    }
  }, [isTechnician, technician?.id])

  useEffect(() => {
    if (data?.monthly_data.length > 0 && !selectedMonth) {
      setSelectedMonth(data.monthly_data[0].month)
    }
  }, [data?.monthly_data])

  const fetchCommissionData = async () => {
    if (!technician?.id) {
      setError('Ingen tekniker-ID tillgänglig')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching commission data for technician:', technician.id)
      
      // 🔥 ENKEL API-ANROP LIKT ADMIN
      const response = await fetch(`/api/technician/commissions?technician_id=${technician.id}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const commissionsData = await response.json()
      
      console.log('✅ Commission data loaded:', commissionsData)
      setData(commissionsData)
      
      // Sätt senaste månaden som default om det finns data
      if (commissionsData.monthly_data?.length > 0) {
        setSelectedMonth(commissionsData.monthly_data[0].month)
      }
      
    } catch (error) {
      console.error('💥 Error fetching commission data:', error)
      setError(error instanceof Error ? error.message : 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const currentMonthData = data?.monthly_data.find(m => m.month === selectedMonth)
  const currentMonthIndex = data?.monthly_data.findIndex(m => m.month === selectedMonth) ?? -1

  const goToPreviousMonth = () => {
    if (data && currentMonthIndex < data.monthly_data.length - 1) {
      const newMonth = data.monthly_data[currentMonthIndex + 1].month
      setSelectedMonth(newMonth)
    }
  }

  const goToNextMonth = () => {
    if (data && currentMonthIndex > 0) {
      const newMonth = data.monthly_data[currentMonthIndex - 1].month
      setSelectedMonth(newMonth)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Problem med att ladda provisioner</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={fetchCommissionData} className="w-full">
                Försök igen
              </Button>
              <Button variant="outline" onClick={() => navigate('/technician/dashboard')} className="w-full">
                Tillbaka till dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-slate-400">Ingen data tillgänglig</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader 
          title="Mina Provisioner"
          backPath="/technician/dashboard"
        />
        {/* 🔍 Success Debug Info */}
        <Card className="p-4 mb-6 bg-green-500/10 border-green-500/30">
          <div className="text-xs text-green-400">
            <p className="font-medium mb-2">✅ Commission Data Successfully Loaded!</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-400">Tekniker:</p>
                <p>{data.meta.technician_name || technician?.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Månader:</p>
                <p>{data.monthly_data.length} tillgängliga</p>
              </div>
              <div>
                <p className="text-slate-400">YTD Total:</p>
                <p>{formatCurrency(data.stats.total_ytd)} ({data.stats.total_cases_ytd} cases)</p>
              </div>
              <div>
                <p className="text-slate-400">Vald månad:</p>
                <p>{currentMonthData?.month_display || 'Ingen vald'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Årsstatistik */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Total i år</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(data.stats.total_ytd)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm font-medium">Antal ärenden</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {data.stats.total_cases_ytd}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm font-medium">Snitt per ärende</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(data.stats.avg_per_case)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500/20 to-red-600/20 border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-sm font-medium">Bästa månaden</p>
                <p className="text-lg font-bold text-white mt-1">
                  {formatCurrency(data.stats.highest_month)}
                </p>
                <p className="text-orange-300 text-xs">
                  {data.stats.best_month_name || 'Ingen data'}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-orange-400" />
            </div>
          </Card>
        </div>

        {/* Månadsvy */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Månadsnavigation och översikt */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Månadsöversikt</h2>
              {data.monthly_data.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousMonth}
                    disabled={currentMonthIndex >= data.monthly_data.length - 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-white font-medium px-4">
                    {currentMonthData?.month_display || 'Ingen data'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextMonth}
                    disabled={currentMonthIndex <= 0}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <span className="text-slate-400 text-sm">Ingen data tillgänglig</span>
              )}
            </div>

            {currentMonthData ? (
              <div className="space-y-4">
                {/* Total provision */}
                <div className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm font-medium">Total provision</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {formatCurrency(currentMonthData.total_commission)}
                  </p>
                </div>

                {/* Uppdelning */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">Privatpersoner</p>
                    <p className="text-xl font-bold text-blue-400">
                      {formatCurrency(currentMonthData.private_commission)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">Företag</p>
                    <p className="text-xl font-bold text-purple-400">
                      {formatCurrency(currentMonthData.business_commission)}
                    </p>
                  </div>
                </div>

                {/* Statistik */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">Antal ärenden</p>
                    <p className="text-lg font-semibold text-white">
                      {currentMonthData.case_count}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">Snitt per ärende</p>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(currentMonthData.avg_commission_per_case)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">
                  {data.monthly_data.length === 0 ? 'Ingen provisionsdata tillgänglig' : 'Ingen data för vald månad'}
                </p>
              </div>
            )}
          </Card>

          {/* Månadshistorik */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Månadshistorik</h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.monthly_data.length > 0 ? (
                data.monthly_data.map(month => (
                  <div 
                    key={month.month}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      month.month === selectedMonth 
                        ? 'bg-blue-500/20 border border-blue-500/30' 
                        : 'bg-slate-800/50 hover:bg-slate-800/70'
                    }`}
                    onClick={() => setSelectedMonth(month.month)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white">{month.month_display}</h3>
                      <span className="text-green-400 font-bold">
                        {formatCurrency(month.total_commission)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                      <div>
                        <span className="text-slate-400">Ärenden: </span>
                        <span className="text-white">{month.case_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Privat: </span>
                        <span className="text-blue-400">{formatCurrency(month.private_commission)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Företag: </span>
                        <span className="text-purple-400">{formatCurrency(month.business_commission)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">Ingen månadshistorik tillgänglig</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Övergripande månadshistorik tabell */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-semibold text-white mb-6">Komplett Månadsöversikt</h2>
          
          <div className="overflow-x-auto">
            {data.monthly_data.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 text-sm font-medium pb-3">Månad</th>
                    <th className="text-right text-slate-400 text-sm font-medium pb-3">Provision</th>
                    <th className="text-right text-slate-400 text-sm font-medium pb-3">Ärenden</th>
                    <th className="text-right text-slate-400 text-sm font-medium pb-3">Privat</th>
                    <th className="text-right text-slate-400 text-sm font-medium pb-3">Företag</th>
                    <th className="text-right text-slate-400 text-sm font-medium pb-3">Snitt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly_data.map(month => (
                    <tr 
                      key={month.month}
                      className={`border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer ${
                        month.month === selectedMonth ? 'bg-blue-500/10' : ''
                      }`}
                      onClick={() => setSelectedMonth(month.month)}
                    >
                      <td className="py-3 text-white font-medium">{month.month_display}</td>
                      <td className="py-3 text-right text-green-400 font-semibold">
                        {formatCurrency(month.total_commission)}
                      </td>
                      <td className="py-3 text-right text-white">{month.case_count}</td>
                      <td className="py-3 text-right text-blue-400">
                        {formatCurrency(month.private_commission)}
                      </td>
                      <td className="py-3 text-right text-purple-400">
                        {formatCurrency(month.business_commission)}
                      </td>
                      <td className="py-3 text-right text-slate-300">
                        {formatCurrency(month.avg_commission_per_case)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">Ingen månadsdata tillgänglig</p>
              </div>
            )}
          </div>
        </Card>

        {/* Insights */}
        <Card className="p-6 mt-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Provisions Insights
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="text-slate-300 font-medium mb-2">📈 Trend</h4>
              <p className="text-slate-400">
                {(() => {
                  if (data.monthly_data.length < 2) return 'Behöver mer data'
                  const firstMonth = data.monthly_data[data.monthly_data.length - 1]
                  const lastMonth = data.monthly_data[0]
                  const growth = firstMonth.total_commission > 0 ? 
                    ((lastMonth.total_commission - firstMonth.total_commission) / firstMonth.total_commission * 100) : 0
                  return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% sedan ${firstMonth.month_display}`
                })()}
              </p>
            </div>
            
            <div>
              <h4 className="text-slate-300 font-medium mb-2">🎯 Konsistens</h4>
              <p className="text-slate-400">
                {(() => {
                  if (data.monthly_data.length === 0) return 'Ingen data'
                  const commissions = data.monthly_data.map(m => m.total_commission)
                  const avg = commissions.reduce((sum, c) => sum + c, 0) / commissions.length
                  const variance = commissions.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / commissions.length
                  const stdDev = Math.sqrt(variance)
                  const consistency = avg > 0 ? (1 - (stdDev / avg)) * 100 : 0
                  return `${Math.max(0, consistency).toFixed(0)}% konsistens`
                })()}
              </p>
            </div>
            
            <div>
              <h4 className="text-slate-300 font-medium mb-2">💡 Rekommendation</h4>
              <p className="text-slate-400">
                {(() => {
                  if (data.monthly_data.length === 0) return 'Ingen data att analysera'
                  const avgPrivate = data.monthly_data.reduce((sum, m) => sum + m.private_commission, 0) / data.monthly_data.length
                  const avgBusiness = data.monthly_data.reduce((sum, m) => sum + m.business_commission, 0) / data.monthly_data.length
                  return avgBusiness > avgPrivate ? 
                    'Fokusera på företagsärenden för högre provision' : 
                    'Bra balans mellan privat- och företagskunder'
                })()}
              </p>
            </div>
          </div>
        </Card>
      </div>  
    </div>
  )
}
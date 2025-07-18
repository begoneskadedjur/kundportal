// src/pages/technician/TechnicianCommissions.tsx - TEKNIKER PROVISIONSÖVERSIKT
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, DollarSign, Calendar, TrendingUp, Eye, FileText,
  ChevronLeft, ChevronRight, Building2, User, CheckCircle
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'

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

interface CommissionCase {
  id: string
  clickup_task_id: string
  case_number?: string
  title: string
  type: 'private' | 'business'
  case_price: number
  commission_amount: number
  completed_date: string
  kontaktperson?: string
  adress?: any
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip'
}

interface CommissionStats {
  total_ytd: number
  total_cases_ytd: number
  avg_per_case: number
  highest_month: number
  best_month_name: string
}

export default function TechnicianCommissions() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  // State
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [monthlyData, setMonthlyData] = useState<MonthlyCommission[]>([])
  const [selectedMonthCases, setSelectedMonthCases] = useState<CommissionCase[]>([])
  const [stats, setStats] = useState<CommissionStats>({
    total_ytd: 0,
    total_cases_ytd: 0,
    avg_per_case: 0,
    highest_month: 0,
    best_month_name: ''
  })

  useEffect(() => {
    if (profile?.technician_id) {
      fetchCommissionData()
    }
  }, [profile?.technician_id])

  useEffect(() => {
    if (selectedMonth && profile?.technician_id) {
      fetchMonthCases()
    }
  }, [selectedMonth, profile?.technician_id])

  const fetchCommissionData = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/technician/commissions?technician_id=${profile?.technician_id}`)
      if (response.ok) {
        const data = await response.json()
        setMonthlyData(data.monthly_data || [])
        setStats(data.stats || {})
        
        // Sätt senaste månaden som default
        if (data.monthly_data?.length > 0) {
          setSelectedMonth(data.monthly_data[0].month)
        }
      }
    } catch (error) {
      console.error('Error fetching commission data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthCases = async () => {
    try {
      const response = await fetch(
        `/api/technician/commissions/cases?technician_id=${profile?.technician_id}&month=${selectedMonth}`
      )
      if (response.ok) {
        const data = await response.json()
        setSelectedMonthCases(data.cases || [])
      }
    } catch (error) {
      console.error('Error fetching month cases:', error)
    }
  }

  const currentMonthData = monthlyData.find(m => m.month === selectedMonth)
  const currentMonthIndex = monthlyData.findIndex(m => m.month === selectedMonth)

  const goToPreviousMonth = () => {
    if (currentMonthIndex < monthlyData.length - 1) {
      setSelectedMonth(monthlyData[currentMonthIndex + 1].month)
    }
  }

  const goToNextMonth = () => {
    if (currentMonthIndex > 0) {
      setSelectedMonth(monthlyData[currentMonthIndex - 1].month)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => navigate('/technician/dashboard')} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 p-2 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Mina Provisioner</h1>
                <p className="text-sm text-slate-400">Översikt över intjänade provisioner</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Årsstatistik */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Total i år</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(stats.total_ytd)}
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
                  {stats.total_cases_ytd}
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
                  {formatCurrency(stats.avg_per_case)}
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
                  {formatCurrency(stats.highest_month)}
                </p>
                <p className="text-orange-300 text-xs">
                  {stats.best_month_name}
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousMonth}
                  disabled={currentMonthIndex >= monthlyData.length - 1}
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
                <p className="text-slate-400">Ingen data för vald månad</p>
              </div>
            )}
          </Card>

          {/* Ärendedetaljer för månaden */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Ärenden denna månad</h2>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                {selectedMonthCases.length} ärenden
              </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedMonthCases.length > 0 ? (
                selectedMonthCases.map(case_ => (
                  <div 
                    key={case_.id}
                    className="bg-slate-800/50 rounded-lg p-4 hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white text-sm">
                            {case_.title}
                          </p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            case_.type === 'private' 
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {case_.type === 'private' ? 'Privat' : 'Företag'}
                          </span>
                        </div>
                        
                        {case_.kontaktperson && (
                          <p className="text-slate-400 text-xs mb-1">
                            <User className="w-3 h-3 inline mr-1" />
                            {case_.kontaktperson}
                          </p>
                        )}
                        
                        <p className="text-slate-400 text-xs">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {formatDate(case_.completed_date)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">
                          {formatCurrency(case_.commission_amount)}
                        </p>
                        <p className="text-slate-400 text-xs">
                          av {formatCurrency(case_.case_price)}
                        </p>
                        {case_.billing_status && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                            case_.billing_status === 'paid' 
                              ? 'bg-green-500/20 text-green-400'
                              : case_.billing_status === 'sent'
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {case_.billing_status === 'paid' ? 'Betald' : 
                             case_.billing_status === 'sent' ? 'Skickad' : 'Väntande'}
                          </span>
                        )}
                      </div>
                    </div>

                    {case_.case_number && (
                      <p className="text-slate-500 text-xs">
                        Ärendenr: {case_.case_number}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-400">Inga ärenden för denna månad</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Månadshistorik */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-semibold text-white mb-6">Månadshistorik</h2>
          
          <div className="overflow-x-auto">
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
                {monthlyData.map(month => (
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
          </div>

          {monthlyData.length === 0 && (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">Ingen provisionsdata tillgänglig</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
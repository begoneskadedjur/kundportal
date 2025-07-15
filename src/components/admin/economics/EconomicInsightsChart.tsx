// 📁 src/components/admin/economics/EconomicInsightsChart.tsx - UTAN FÖRSÄLJNINGSMÖJLIGHETER
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'
import { 
  Award, 
  Bug, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  User, 
  Building2, 
  MapPin, 
  Calendar, 
  Wrench 
} from 'lucide-react'

import { ModernCard } from '../../ui/ModernCard'
import LoadingSpinner from '../../shared/LoadingSpinner'

// 🎯 Interfaces
interface TopCase {
  id: string
  case_number?: string
  title?: string
  pris: number
  completed_date: string
  primary_assignee_name: string
  primary_assignee_email?: string
  skadedjur: string
  adress?: any
  description?: string
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  type: 'private' | 'business'
}

interface TopSkadedjur {
  type: string
  total_revenue: number
  case_count: number
  avg_price: number
  recent_cases: Array<{
    id: string
    pris: number
    completed_date: string
    technician: string
  }>
}

interface CaseDetailsModalProps {
  case_: TopCase | null
  isOpen: boolean
  onClose: () => void
}

// Modal för ärendedetaljer
const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ case_, isOpen, onClose }) => {
  if (!isOpen || !case_) return null

  const formatAddress = (address: any): string => {
    if (!address) return 'Ingen adress angiven'
    
    if (typeof address === 'string') {
      if (address.startsWith('{') && address.includes('formatted_address')) {
        try {
          const parsed = JSON.parse(address)
          return parsed.formatted_address || 'Ingen adress angiven'
        } catch (e) {
          return address
        }
      }
      return address
    }
    
    if (typeof address === 'object') {
      if (address.formatted_address) {
        return address.formatted_address
      }
      
      const parts = []
      if (address.street) parts.push(address.street)
      if (address.city) parts.push(address.city)
      if (address.postalCode || address.postal_code) parts.push(address.postalCode || address.postal_code)
      
      return parts.length > 0 ? parts.join(', ') : 'Ingen adress angiven'
    }
    
    return 'Ingen adress angiven'
  }

  const isBusiness = case_.type === 'business'
  const vatAmount = isBusiness ? case_.pris * 0.25 : 0
  const totalAmount = case_.pris + vatAmount

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isBusiness ? 'bg-blue-500/20' : 'bg-purple-500/20'
              }`}>
                {isBusiness ? <Building2 className="w-5 h-5 text-blue-400" /> : <User className="w-5 h-5 text-purple-400" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{case_.case_number || case_.title}</h2>
                <p className="text-sm text-slate-400">
                  {isBusiness ? 'Företag' : 'Privatperson'} • {case_.skadedjur}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Pricing */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-400">Ärendets värde</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(totalAmount)}</p>
                {isBusiness && (
                  <p className="text-xs text-slate-400">
                    {formatCurrency(case_.pris)} + {formatCurrency(vatAmount)} moms
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Tekniker</p>
                <p className="text-white font-medium">{case_.primary_assignee_name}</p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Info */}
            {case_.kontaktperson && (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Kontakt</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-300">{case_.kontaktperson}</p>
                  {case_.telefon_kontaktperson && (
                    <p className="text-blue-400">{case_.telefon_kontaktperson}</p>
                  )}
                  {case_.e_post_kontaktperson && (
                    <p className="text-blue-400">{case_.e_post_kontaktperson}</p>
                  )}
                </div>
              </div>
            )}

            {/* Address */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Adress
              </h3>
              <p className="text-slate-300 text-sm">{formatAddress(case_.adress)}</p>
            </div>

            {/* Date */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Slutfört
              </h3>
              <p className="text-slate-300 text-sm">
                {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
              </p>
            </div>

            {/* Case Type */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">Skadedjur</h3>
              <p className="text-slate-300 text-sm">{case_.skadedjur}</p>
            </div>
          </div>

          {/* Description */}
          {case_.description && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">Beskrivning</h3>
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{case_.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EconomicInsightsChart: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<'cases' | 'skadedjur'>('cases')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3m')
  const [selectedCase, setSelectedCase] = useState<TopCase | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Data states
  const [data, setData] = useState<{
    topCases: TopCase[]
    topSkadedjur: TopSkadedjur[]
  }>({
    topCases: [],
    topSkadedjur: []
  })

  // Period options
  const periodOptions = [
    { key: '1m', label: '1 månad', shortLabel: '1M' },
    { key: '3m', label: '3 månader', shortLabel: '3M' },
    { key: '6m', label: '6 månader', shortLabel: '6M' },
    { key: '12m', label: '12 månader', shortLabel: '12M' }
  ]

  // View tabs - UPPDATERAD utan försäljningsmöjligheter
  const viewOptions = [
    { key: 'cases', label: 'Topp Ärenden', icon: Award, color: 'text-yellow-500' },
    { key: 'skadedjur', label: 'Skadedjur', icon: Bug, color: 'text-red-500' }
  ]

  useEffect(() => {
    // Sätt aktuell månad som default
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchInsightsData()
    }
  }, [selectedMonth, selectedPeriod])

  // 🔄 Hämta insights data
  const fetchInsightsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching insights data...')
      
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // Hämta ALLA avslutade ärenden från BeGone
      const [privateResult, businessResult] = await Promise.all([
        supabase
          .from('private_cases')
          .select(`
            id, case_number, title, pris, completed_date, 
            primary_assignee_name, primary_assignee_email,
            skadedjur, adress, description, kontaktperson,
            telefon_kontaktperson, e_post_kontaktperson
          `)
          .eq('status', 'Avslutat')
          .gte('completed_date', dateString)
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
          .order('pris', { ascending: false }),
        
        supabase
          .from('business_cases')
          .select(`
            id, case_number, title, pris, completed_date, 
            primary_assignee_name, primary_assignee_email,
            skadedjur, adress, description, kontaktperson,
            telefon_kontaktperson, e_post_kontaktperson, org_nr
          `)
          .eq('status', 'Avslutat')
          .gte('completed_date', dateString)
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
          .order('pris', { ascending: false })
      ])

      if (privateResult.error) throw privateResult.error
      if (businessResult.error) throw businessResult.error

      // Kombinera och tagga data
      const allCases = [
        ...(privateResult.data || []).map(c => ({ ...c, type: 'private' as const })),
        ...(businessResult.data || []).map(c => ({ ...c, type: 'business' as const }))
      ]

      console.log(`📊 Total cases loaded: ${allCases.length}`)

      setData({
        topCases: allCases,
        topSkadedjur: []  // Kommer att beräknas i useMemo
      })

    } catch (err) {
      console.error('❌ Error fetching insights data:', err)
      setError(err instanceof Error ? err.message : 'Ett okänt fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  // Filtrera data baserat på period och månad
  const filteredData = useMemo(() => {
    if (!data.topCases.length) return { topCases: [], topSkadedjur: [] }

    // Beräkna datumperiod
    const selectedDate = new Date(selectedMonth + '-01')
    const endDate = new Date(selectedDate)
    endDate.setMonth(endDate.getMonth() + 1)
    
    const periodMonths = parseInt(selectedPeriod.replace('m', ''))
    const startDate = new Date(selectedDate)
    startDate.setMonth(startDate.getMonth() - periodMonths)

    console.log(`🔍 Filtering data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

    // Filtrera ärenden baserat på period
    const allFilteredCases = data.topCases.filter(case_ => {
      const caseDate = new Date(case_.completed_date)
      return caseDate >= startDate && caseDate < endDate
    })

    console.log(`📋 Filtered cases: ${allFilteredCases.length}`)

    // 1. TOPP CASES - ta top 10 från alla filtrerade
    const topCasesForPeriod = allFilteredCases
      .sort((a, b) => b.pris - a.pris)
      .slice(0, 10)

    console.log(`🏆 Top cases for period: ${topCasesForPeriod.length}`)

    // 2. SKADEDJUR - beräkna från scratch
    const skadedjurStatsForPeriod: { [key: string]: { revenue: number; cases: any[]; count: number } } = {}
    
    allFilteredCases.forEach(case_ => {
      const skadedjur = case_.skadedjur || 'Okänt'
      if (!skadedjurStatsForPeriod[skadedjur]) {
        skadedjurStatsForPeriod[skadedjur] = { revenue: 0, cases: [], count: 0 }
      }
      skadedjurStatsForPeriod[skadedjur].revenue += case_.pris
      skadedjurStatsForPeriod[skadedjur].count++
      skadedjurStatsForPeriod[skadedjur].cases.push({
        id: case_.id,
        pris: case_.pris,
        completed_date: case_.completed_date,
        technician: case_.primary_assignee_name || 'Ej tilldelad'
      })
    })

    const topSkadedjurForPeriod = Object.entries(skadedjurStatsForPeriod)
      .map(([type, stats]) => ({
        type,
        total_revenue: stats.revenue,
        case_count: stats.count,
        avg_price: stats.count > 0 ? stats.revenue / stats.count : 0,
        recent_cases: stats.cases
          .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())
          .slice(0, 5)
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)

    console.log(`🐛 Skadedjur for period: ${topSkadedjurForPeriod.length}`)

    return {
      topCases: topCasesForPeriod,
      topSkadedjur: topSkadedjurForPeriod
    }
  }, [data.topCases, selectedMonth, selectedPeriod])

  // Navigation functions
  const canGoPrevious = () => true
  const canGoNext = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth < currentMonth
  }

  const isCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth === currentMonth
  }

  const goToPreviousMonth = () => {
    const date = new Date(selectedMonth + '-01')
    date.setMonth(date.getMonth() - 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToNextMonth = () => {
    const date = new Date(selectedMonth + '-01')
    date.setMonth(date.getMonth() + 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }

  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  // Handle case click
  const handleCaseClick = (case_: TopCase) => {
    setSelectedCase(case_)
    setIsModalOpen(true)
  }

  // Loading state
  if (loading) {
    return (
      <ModernCard>
        <ModernCard.Content>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  if (error) {
    return (
      <ModernCard>
        <ModernCard.Content>
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={fetchInsightsData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Försök igen
            </button>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* View Tabs */}
        <div className="flex gap-2">
          {viewOptions.map(view => {
            const Icon = view.icon
            return (
              <button
                key={view.key}
                onClick={() => setSelectedView(view.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedView === view.key
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${view.color}`} />
                {view.label}
              </button>
            )
          })}
        </div>

        {/* Period + Month Navigation */}
        <div className="flex items-center gap-4">
          {/* Period selector */}
          <div className="flex gap-2">
            {periodOptions.map(period => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {period.shortLabel}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button 
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious()}
              className="p-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[140px]">
              <p className="text-white font-medium">{formatSelectedMonth(selectedMonth)}</p>
              <p className="text-xs text-slate-400">
                {periodOptions.find(p => p.key === selectedPeriod)?.label} bakåt
              </p>
            </div>
            <button 
              onClick={goToNextMonth}
              disabled={!canGoNext()}
              className="p-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isCurrentMonth() && (
              <button 
                onClick={goToCurrentMonth}
                className="ml-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                Idag
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedView === 'cases' && (
        <ModernCard>
          <ModernCard.Header>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-white">Topp Ärenden</h2>
            </div>
          </ModernCard.Header>
          <ModernCard.Content>
            {filteredData.topCases.length > 0 ? (
              <div className="space-y-3">
                {filteredData.topCases.map((case_, index) => (
                  <div
                    key={case_.id}
                    className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => handleCaseClick(case_)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          index === 2 ? 'bg-amber-600' :
                          'bg-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          case_.type === 'business' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                        }`}>
                          {case_.type === 'business' ? 
                            <Building2 className="w-4 h-4 text-blue-400" /> : 
                            <User className="w-4 h-4 text-purple-400" />
                          }
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">
                            {case_.case_number || case_.title || `Ärende ${case_.id.slice(0, 8)}`}
                          </h3>
                          <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                            {case_.skadedjur}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {case_.primary_assignee_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          {formatCurrency(case_.type === 'business' ? case_.pris * 1.25 : case_.pris)}
                        </div>
                        {case_.type === 'business' && (
                          <div className="text-xs text-slate-400">inkl. moms</div>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga ärenden för vald period</p>
              </div>
            )}
          </ModernCard.Content>
        </ModernCard>
      )}

      {selectedView === 'skadedjur' && (
        <ModernCard>
          <ModernCard.Header>
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-white">Mest Lönsamma Skadedjur</h2>
            </div>
          </ModernCard.Header>
          <ModernCard.Content>
            {filteredData.topSkadedjur.length > 0 ? (
              <div className="space-y-3">
                {filteredData.topSkadedjur.map((skadedjur, index) => (
                  <div
                    key={skadedjur.type}
                    className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' :
                        'bg-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <Bug className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{skadedjur.type}</h3>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>{skadedjur.case_count} ärenden</span>
                          <span>∅ {formatCurrency(skadedjur.avg_price)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        {formatCurrency(skadedjur.total_revenue)}
                      </div>
                      <div className="text-xs text-slate-400">total intäkt</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga skadedjur för vald period</p>
              </div>
            )}
          </ModernCard.Content>
        </ModernCard>
      )}

      {/* Case Details Modal */}
      <CaseDetailsModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

export default EconomicInsightsChart
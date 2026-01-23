// src/components/customer/CompletedCasesView.tsx
// Genomförda ärenden - Avslutade serviceärenden för kundportalen
// Design baserad på InspectionSessionsView för konsekvent UX

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Briefcase,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  History,
  ChevronDown,
  ChevronUp,
  Bug,
  MapPin,
  CreditCard
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDebounce } from '../../hooks/useDebounce'
import { getCustomerStatusDisplay, isCompletedStatus } from '../../types/database'
import { formatCurrency } from '../../utils/formatters'
import CaseDetailsModal from './CaseDetailsModal'
import LoadingSpinner from '../shared/LoadingSpinner'
import type { Case } from '../../types/cases'

interface CompletedCasesViewProps {
  customerId: string
  companyName: string
}

// Färgkodning för pest_level (0-3)
function getPestLevelInfo(level: number | null): { color: string; label: string; status: 'ok' | 'warning' | 'critical' } {
  if (level === null) return { color: '#6b7280', label: '-', status: 'ok' }
  if (level === 0) return { color: '#22c55e', label: 'Ingen', status: 'ok' }
  if (level === 1) return { color: '#22c55e', label: 'Låg', status: 'ok' }
  if (level === 2) return { color: '#f59e0b', label: 'Medium', status: 'warning' }
  return { color: '#ef4444', label: 'Hög', status: 'critical' }
}

// Färgkodning för problem_rating (1-5)
function getProblemRatingInfo(rating: number | null): { color: string; label: string; status: 'ok' | 'warning' | 'critical' } {
  if (rating === null) return { color: '#6b7280', label: '-', status: 'ok' }
  if (rating === 1) return { color: '#22c55e', label: 'Utmärkt', status: 'ok' }
  if (rating === 2) return { color: '#22c55e', label: 'Bra', status: 'ok' }
  if (rating === 3) return { color: '#f59e0b', label: 'Acceptabel', status: 'warning' }
  if (rating === 4) return { color: '#ef4444', label: 'Problem', status: 'critical' }
  return { color: '#ef4444', label: 'Kritisk', status: 'critical' }
}

// Avgör om ett ärende har avvikelser
function hasIssue(caseItem: Case): boolean {
  return (caseItem.pest_level !== null && caseItem.pest_level >= 2) ||
         (caseItem.problem_rating !== null && caseItem.problem_rating >= 4)
}

export function CompletedCasesView({ customerId, companyName }: CompletedCasesViewProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cases, setCases] = useState<Case[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)

  // Historik-sektion
  const [showHistory, setShowHistory] = useState(false)

  // Modal state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Ladda ärenden
  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', customerId)
        .not('completed_date', 'is', null)
        .order('completed_date', { ascending: false })

      if (error) throw error
      setCases(data || [])
    } catch (error) {
      console.error('Error fetching completed cases:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  // Beräkna sammanfattningsstatistik
  const statistics = useMemo(() => {
    const latestCase = cases.length > 0 ? cases[0] : null

    let okCount = 0
    let warningCount = 0
    let criticalCount = 0

    cases.forEach(c => {
      const pestInfo = getPestLevelInfo(c.pest_level)
      const ratingInfo = getProblemRatingInfo(c.problem_rating)

      // Ta det värsta av de två
      if (pestInfo.status === 'critical' || ratingInfo.status === 'critical') {
        criticalCount++
      } else if (pestInfo.status === 'warning' || ratingInfo.status === 'warning') {
        warningCount++
      } else {
        okCount++
      }
    })

    return {
      latestCase,
      totalCases: cases.length,
      okCount,
      warningCount,
      criticalCount
    }
  }, [cases])

  // Filtrera ärenden baserat på sök och filter
  const filteredCases = useMemo(() => {
    let filtered = cases

    // Sök
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.case_number?.toLowerCase().includes(query) ||
        c.title?.toLowerCase().includes(query) ||
        c.pest_type?.toLowerCase().includes(query) ||
        c.address?.formatted_address?.toLowerCase().includes(query)
      )
    }

    // Endast avvikelser
    if (showOnlyIssues) {
      filtered = filtered.filter(hasIssue)
    }

    return filtered
  }, [cases, debouncedSearchQuery, showOnlyIssues])

  // Gruppera ärenden per månad för historik
  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, Case[]>()

    cases.forEach(c => {
      if (c.completed_date) {
        const date = new Date(c.completed_date)
        const monthKey = format(date, 'yyyy-MM')
        const monthLabel = format(date, 'MMMM yyyy', { locale: sv })

        if (!groups.has(monthKey)) {
          groups.set(monthKey, [])
        }
        groups.get(monthKey)!.push(c)
      }
    })

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label: format(new Date(key + '-01'), 'MMMM yyyy', { locale: sv }),
        cases: items,
        count: items.length
      }))
  }, [cases])

  const openCaseDetails = (caseItem: Case) => {
    setSelectedCase(caseItem)
    setIsModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Genomförda ärenden</h1>
              <p className="text-sm text-slate-400">
                Avslutade serviceärenden för {companyName}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>

        {/* Senaste ärende - Sammanfattning */}
        {statistics.latestCase && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Senaste serviceärende</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Datum */}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Datum</p>
                  <p className="text-white font-medium">
                    {statistics.latestCase.completed_date
                      ? format(new Date(statistics.latestCase.completed_date), 'd MMM yyyy', { locale: sv })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Tekniker */}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Tekniker</p>
                  <p className="text-white font-medium">
                    {statistics.latestCase.primary_technician_name || '-'}
                  </p>
                </div>
              </div>

              {/* OK */}
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">OK</p>
                  <p className="text-emerald-400 font-bold text-xl">{statistics.okCount}</p>
                </div>
              </div>

              {/* Varning */}
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Varning</p>
                  <p className="text-amber-400 font-bold text-xl">{statistics.warningCount}</p>
                </div>
              </div>

              {/* Kritisk */}
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Kritisk</p>
                  <p className="text-red-400 font-bold text-xl">{statistics.criticalCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ärendehistorik (expanderbar) */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl mb-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-slate-400" />
              <span className="text-white font-medium">Ärendehistorik</span>
              <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                {cases.length} ärenden
              </span>
            </div>
            {showHistory ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showHistory && (
            <div className="border-t border-slate-700 p-4 max-h-64 overflow-y-auto">
              {groupedByMonth.length > 0 ? (
                <div className="space-y-3">
                  {groupedByMonth.map((group) => (
                    <div key={group.key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 capitalize">{group.label}</span>
                      <span className="text-slate-500">{group.count} ärenden</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Ingen historik tillgänglig</p>
              )}
            </div>
          )}
        </div>

        {/* Sök och Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök ärende eller skadedjur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowOnlyIssues(!showOnlyIssues)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              showOnlyIssues
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Endast avvikelser
          </button>
        </div>

        {/* Ärendetabell */}
        {filteredCases.length > 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Ärende #</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Titel</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Skadedjur</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Aktivitetsnivå</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Situation</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Pris</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Slutfört</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredCases.map((caseItem) => {
                    const pestInfo = getPestLevelInfo(caseItem.pest_level)
                    const ratingInfo = getProblemRatingInfo(caseItem.problem_rating)
                    const statusDisplay = getCustomerStatusDisplay(caseItem.status)

                    return (
                      <tr
                        key={caseItem.id}
                        className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                        onClick={() => openCaseDetails(caseItem)}
                      >
                        {/* Ärende # */}
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">#{caseItem.case_number}</span>
                        </td>

                        {/* Titel */}
                        <td className="px-4 py-3">
                          <span className="text-slate-300 max-w-[200px] truncate block">
                            {caseItem.title || '-'}
                          </span>
                        </td>

                        {/* Skadedjur */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Bug className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-300">{caseItem.pest_type || '-'}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${statusDisplay.color}20`,
                              color: statusDisplay.color
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {statusDisplay.label}
                          </span>
                        </td>

                        {/* Aktivitetsnivå */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${pestInfo.color}20`,
                              color: pestInfo.color
                            }}
                          >
                            {pestInfo.status === 'critical' && <AlertTriangle className="w-3 h-3" />}
                            {pestInfo.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                            {pestInfo.status === 'ok' && pestInfo.label !== '-' && <CheckCircle2 className="w-3 h-3" />}
                            {pestInfo.label}
                          </span>
                        </td>

                        {/* Situationsbedömning */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${ratingInfo.color}20`,
                              color: ratingInfo.color
                            }}
                          >
                            {ratingInfo.status === 'critical' && <AlertTriangle className="w-3 h-3" />}
                            {ratingInfo.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                            {ratingInfo.status === 'ok' && ratingInfo.label !== '-' && <CheckCircle2 className="w-3 h-3" />}
                            {ratingInfo.label}
                          </span>
                        </td>

                        {/* Pris */}
                        <td className="px-4 py-3 text-right">
                          {caseItem.price && caseItem.price > 0 ? (
                            <span className="text-white font-medium">
                              {formatCurrency(caseItem.price)}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Slutfört */}
                        <td className="px-4 py-3">
                          <span className="text-slate-300">
                            {caseItem.completed_date
                              ? format(new Date(caseItem.completed_date), 'd MMM yyyy', { locale: sv })
                              : '-'}
                          </span>
                        </td>

                        {/* Åtgärder */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openCaseDetails(caseItem)
                            }}
                            className="p-2 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-white"
                            title="Visa detaljer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {debouncedSearchQuery || showOnlyIssues ? 'Inga ärenden matchar filtret' : 'Inga avslutade ärenden'}
            </h3>
            <p className="text-slate-400">
              {debouncedSearchQuery || showOnlyIssues
                ? 'Prova att justera sökningen eller ta bort filtret'
                : 'Avslutade serviceärenden kommer att visas här'}
            </p>
          </div>
        )}

        {/* Förklaring av färgkodning */}
        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-2">Mätvärdeindikatorer:</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-slate-400">OK - Inom normala värden</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-slate-400">Varning - Överstiger/understiger varningsnivå</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-slate-400">Kritisk - Överstiger/understiger kritisk nivå</span>
            </div>
          </div>
        </div>
      </div>

      {/* Case Details Modal */}
      {selectedCase && (
        <CaseDetailsModal
          caseId={selectedCase.id}
          clickupTaskId={selectedCase.clickup_task_id || ''}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedCase(null)
          }}
        />
      )}
    </div>
  )
}

export default CompletedCasesView

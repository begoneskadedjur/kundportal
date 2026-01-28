// src/components/customer/CompletedCasesView.tsx
// Dina ärenden - Alla serviceärenden för kundportalen
// Design baserad på InspectionSessionsView för konsekvent UX

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Bug,
  User
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDebounce } from '../../hooks/useDebounce'
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

  // Modal state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Ladda ärenden (alla ärenden, inte bara slutförda)
  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCases(data || [])
    } catch (error) {
      console.error('Error fetching cases:', error)
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
              <FileText className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Dina ärenden</h1>
              <p className="text-sm text-slate-400">
                Alla era serviceärenden för {companyName}
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
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Rubrik</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Datum</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Skadedjursnivå</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Övergripande status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Skadedjur</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Tekniker</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Kostnad</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredCases.map((caseItem) => {
                    const pestInfo = getPestLevelInfo(caseItem.pest_level)
                    const ratingInfo = getProblemRatingInfo(caseItem.problem_rating)
                    // Bestäm datum att visa (senaste aktivitetsdatum)
                    const displayDate = caseItem.completed_date || caseItem.scheduled_date || caseItem.created_at

                    return (
                      <tr
                        key={caseItem.id}
                        className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                        onClick={() => openCaseDetails(caseItem)}
                      >
                        {/* Rubrik */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-white font-medium max-w-[250px] truncate">
                              {caseItem.title || 'Ärende'}
                            </span>
                            <span className="text-xs text-slate-500">#{caseItem.case_number}</span>
                          </div>
                        </td>

                        {/* Datum */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-300">
                              {displayDate
                                ? format(new Date(displayDate), 'd MMM yyyy', { locale: sv })
                                : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Skadedjursnivå */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${pestInfo.color}20`,
                              color: pestInfo.color
                            }}
                          >
                            {pestInfo.status === 'critical' && '🔴'}
                            {pestInfo.status === 'warning' && '🟡'}
                            {pestInfo.status === 'ok' && pestInfo.label !== '-' && '🟢'}
                            <span className="ml-1">{caseItem.pest_level !== null ? caseItem.pest_level : '-'}</span>
                          </span>
                        </td>

                        {/* Övergripande status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${ratingInfo.color}20`,
                              color: ratingInfo.color
                            }}
                          >
                            {ratingInfo.status === 'critical' && '🔴'}
                            {ratingInfo.status === 'warning' && '🟡'}
                            {ratingInfo.status === 'ok' && ratingInfo.label !== '-' && '🟢'}
                            <span className="ml-1">{caseItem.problem_rating !== null ? caseItem.problem_rating : '-'}</span>
                          </span>
                        </td>

                        {/* Skadedjur */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Bug className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-300">{caseItem.pest_type || '-'}</span>
                          </div>
                        </td>

                        {/* Tekniker */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-300">{caseItem.primary_technician_name || caseItem.technician_name || '-'}</span>
                          </div>
                        </td>

                        {/* Kostnad */}
                        <td className="px-4 py-3 text-right">
                          {caseItem.price && caseItem.price > 0 ? (
                            <span className="text-white font-medium">
                              {formatCurrency(caseItem.price)}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Åtgärd */}
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
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {debouncedSearchQuery || showOnlyIssues ? 'Inga ärenden matchar filtret' : 'Inga ärenden'}
            </h3>
            <p className="text-slate-400">
              {debouncedSearchQuery || showOnlyIssues
                ? 'Prova att justera sökningen eller ta bort filtret'
                : 'Era serviceärenden kommer att visas här'}
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
          fallbackData={{
            case_number: selectedCase.case_number,
            title: selectedCase.title,
            pest_type: selectedCase.pest_type,
            status: selectedCase.status,
            pest_level: selectedCase.pest_level,
            problem_rating: selectedCase.problem_rating,
            price: selectedCase.price,
            completed_date: selectedCase.completed_date,
            primary_technician_name: selectedCase.primary_technician_name,
            address: selectedCase.address,
            description: selectedCase.description,
            recommendations: selectedCase.recommendations,
            // Nya fält från cases-tabellen
            work_report: selectedCase.work_report,
            materials_used: selectedCase.materials_used,
            time_spent_minutes: selectedCase.time_spent_minutes,
            service_type: selectedCase.service_type,
            priority: selectedCase.priority,
            work_started_at: selectedCase.work_started_at,
            // Filer/foton
            files: selectedCase.files
          }}
        />
      )}
    </div>
  )
}

export default CompletedCasesView

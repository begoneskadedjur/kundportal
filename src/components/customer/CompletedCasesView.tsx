import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  Eye,
  User,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Wrench
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDebounce } from '../../hooks/useDebounce'
import { formatCurrency } from '../../utils/formatters'
import CaseDetailsModal from './CaseDetailsModal'
import LoadingSpinner from '../shared/LoadingSpinner'
import type { Case } from '../../types/cases'

interface CaseWithService extends Case {
  service?: { id: string; name: string; group?: { name: string; color: string } | null } | null
}

const PAGE_SIZE = 50

interface CompletedCasesViewProps {
  customerId: string
  companyName: string
}

function getPestLevelInfo(level: number | null): { color: string; label: string; status: 'ok' | 'warning' | 'critical' } {
  if (level === null) return { color: '#6b7280', label: '-', status: 'ok' }
  if (level === 0) return { color: '#22c55e', label: 'Ingen', status: 'ok' }
  if (level === 1) return { color: '#22c55e', label: 'Låg', status: 'ok' }
  if (level === 2) return { color: '#f59e0b', label: 'Medium', status: 'warning' }
  return { color: '#ef4444', label: 'Hög', status: 'critical' }
}

function getProblemRatingInfo(rating: number | null): { color: string; label: string; status: 'ok' | 'warning' | 'critical' } {
  if (rating === null) return { color: '#6b7280', label: '-', status: 'ok' }
  if (rating === 1) return { color: '#22c55e', label: 'Utmärkt', status: 'ok' }
  if (rating === 2) return { color: '#22c55e', label: 'Bra', status: 'ok' }
  if (rating === 3) return { color: '#f59e0b', label: 'Acceptabel', status: 'warning' }
  if (rating === 4) return { color: '#ef4444', label: 'Problem', status: 'critical' }
  return { color: '#ef4444', label: 'Kritisk', status: 'critical' }
}

function getServiceTypeInfo(serviceType: string | null): { label: string; color: string; bg: string } {
  switch (serviceType) {
    case 'routine': return { label: 'Servicebesök', color: '#20c58f', bg: '#20c58f20' }
    case 'inspection': return { label: 'Kontroll', color: '#60a5fa', bg: '#60a5fa20' }
    case 'establishment': return { label: 'Etablering', color: '#a78bfa', bg: '#a78bfa20' }
    case 'acute': return { label: 'Akut', color: '#f87171', bg: '#f8717120' }
    default: return { label: 'Övrigt', color: '#94a3b8', bg: '#94a3b820' }
  }
}

function hasIssue(caseItem: Case): boolean {
  return (caseItem.pest_level !== null && caseItem.pest_level >= 2) ||
         (caseItem.problem_rating !== null && caseItem.problem_rating >= 4)
}

type SortField = 'created_at' | 'pest_level' | 'problem_rating' | 'status'
type SortDir = 'asc' | 'desc'

export function CompletedCasesView({ customerId, companyName }: CompletedCasesViewProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cases, setCases] = useState<CaseWithService[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedCase, setSelectedCase] = useState<CaseWithService | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*, service:services!service_id(id, name, group:service_groups!group_id(name, color))')
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

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  // Unique statuses for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const s = new Set(cases.map(c => c.status).filter(Boolean))
    return Array.from(s).sort()
  }, [cases])

  const filteredCases = useMemo(() => {
    let filtered = cases

    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.case_number?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.service?.name?.toLowerCase().includes(q) ||
        c.address?.formatted_address?.toLowerCase().includes(q)
      )
    }

    if (showOnlyIssues) filtered = filtered.filter(hasIssue)

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => (c.service_type ?? 'other') === typeFilter)
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let av: any, bv: any
      if (sortField === 'created_at') {
        av = a.created_at ? new Date(a.created_at).getTime() : 0
        bv = b.created_at ? new Date(b.created_at).getTime() : 0
      } else if (sortField === 'pest_level') {
        av = a.pest_level ?? -1
        bv = b.pest_level ?? -1
      } else if (sortField === 'problem_rating') {
        av = a.problem_rating ?? -1
        bv = b.problem_rating ?? -1
      } else {
        av = a.status ?? ''
        bv = b.status ?? ''
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [cases, debouncedSearchQuery, showOnlyIssues, statusFilter, sortField, sortDir])

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [debouncedSearchQuery, showOnlyIssues, statusFilter, typeFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE))
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredCases.slice(start, start + PAGE_SIZE)
  }, [filteredCases, currentPage])

  const hasRoutineCases = useMemo(() => filteredCases.some(c => c.service_type === 'routine'), [filteredCases])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-slate-600 inline ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-emerald-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-emerald-400 inline ml-1" />
  }

  const openCaseDetails = (caseItem: Case) => {
    setSelectedCase(caseItem)
    setIsModalOpen(true)
  }

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (currentPage > 3) pages.push('...')
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) pages.push(p)
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }, [totalPages, currentPage])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const startItem = (currentPage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(currentPage * PAGE_SIZE, filteredCases.length)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-slate-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Dina ärenden</h1>
            <p className="text-sm text-slate-500">Alla serviceärenden för {companyName}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Uppdatera
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Sök ärende eller tjänst..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">Alla typer</option>
          <option value="routine">Servicebesök</option>
          <option value="inspection">Kontroll</option>
          <option value="establishment">Etablering</option>
          <option value="acute">Akut</option>
          <option value="other">Övrigt</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">Alla statusar</option>
          {uniqueStatuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          onClick={() => setShowOnlyIssues(!showOnlyIssues)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            showOnlyIssues
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Endast avvikelser
        </button>
      </div>

      {/* Table */}
      {filteredCases.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          {/* Table meta row */}
          <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Visar {startItem}–{endItem} av {filteredCases.length} ärenden
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Rubrik</th>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort('created_at')}
                  >
                    Datum <SortIcon field="created_at" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Tjänst</th>
                  {hasRoutineCases && (
                    <th
                      className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                      onClick={() => toggleSort('pest_level')}
                    >
                      Nivå <SortIcon field="pest_level" />
                    </th>
                  )}
                  {hasRoutineCases && (
                    <th
                      className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                      onClick={() => toggleSort('problem_rating')}
                    >
                      Övergripande <SortIcon field="problem_rating" />
                    </th>
                  )}
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Tekniker</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Nästa besök</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Kostnad</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {paginatedCases.map((caseItem) => {
                  const pestInfo = getPestLevelInfo(caseItem.pest_level)
                  const ratingInfo = getProblemRatingInfo(caseItem.problem_rating)
                  const displayDate = caseItem.completed_date || caseItem.scheduled_date || caseItem.created_at
                  const hasPestData = caseItem.pest_level !== null
                  const hasRatingData = caseItem.problem_rating !== null
                  const typeInfo = getServiceTypeInfo(caseItem.service_type)

                  return (
                    <tr
                      key={caseItem.id}
                      className="hover:bg-slate-700/20 cursor-pointer transition-colors"
                      onClick={() => openCaseDetails(caseItem)}
                    >
                      <td className="px-4 py-2">
                        <div>
                          <span className="text-white text-sm font-medium max-w-[220px] truncate block">
                            {caseItem.title || caseItem.case_number || 'Ärende'}
                          </span>
                          <span className="text-xs text-slate-500">#{caseItem.case_number}</span>
                        </div>
                      </td>

                      <td className="px-4 py-2 text-slate-400 text-sm whitespace-nowrap">
                        {displayDate ? format(new Date(displayDate), 'd MMM yyyy', { locale: sv }) : '—'}
                      </td>

                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <Wrench className="w-3 h-3 flex-shrink-0" style={{ color: typeInfo.color }} />
                          <span className="text-xs font-medium" style={{ color: typeInfo.color }}>
                            {caseItem.service?.name || typeInfo.label}
                          </span>
                        </div>
                      </td>

                      {hasRoutineCases && (
                        <td className="px-4 py-2 text-center">
                          {hasPestData ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: `${pestInfo.color}20`, color: pestInfo.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: pestInfo.color }} />
                              {pestInfo.label}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      )}

                      {hasRoutineCases && (
                        <td className="px-4 py-2 text-center">
                          {hasRatingData ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: `${ratingInfo.color}20`, color: ratingInfo.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: ratingInfo.color }} />
                              {ratingInfo.label}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {(caseItem.primary_technician_name || caseItem.technician_name) ? (
                            <>
                              <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-slate-300 text-sm">
                                {caseItem.primary_technician_name || caseItem.technician_name}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-600 text-sm">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        {caseItem.scheduled_start && new Date(caseItem.scheduled_start) > new Date() ? (
                          <div className="flex items-center gap-1.5">
                            <CalendarCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="text-emerald-400 text-sm font-medium">
                              {format(new Date(caseItem.scheduled_start), 'd MMM', { locale: sv })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-sm">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {caseItem.price && caseItem.price > 0 ? (
                          <span className="text-white text-sm font-medium">{formatCurrency(caseItem.price)}</span>
                        ) : (
                          <span className="text-slate-600 text-sm">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2">
                        <button
                          onClick={e => { e.stopPropagation(); openCaseDetails(caseItem) }}
                          className="p-1.5 hover:bg-slate-600/50 rounded transition-colors text-slate-500 hover:text-white"
                          title="Visa detaljer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Föregående
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((p, i) =>
                  p === '...'
                    ? <span key={`ellipsis-${i}`} className="px-2 text-slate-600">…</span>
                    : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          currentPage === p
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    )
                )}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-white mb-1">
            {debouncedSearchQuery || showOnlyIssues || statusFilter !== 'all'
              ? 'Inga ärenden matchar filtret'
              : 'Inga ärenden'}
          </h3>
          <p className="text-sm text-slate-500">
            {debouncedSearchQuery || showOnlyIssues || statusFilter !== 'all'
              ? 'Prova att justera sökningen eller ta bort filtret'
              : 'Era serviceärenden kommer att visas här'}
          </p>
        </div>
      )}

      {/* Legend — bara relevant för servicebesök */}
      {hasRoutineCases && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            OK – Inom normala värden
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            Varning
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Kritisk
          </div>
        </div>
      )}

      {selectedCase && (
        <CaseDetailsModal
          caseId={selectedCase.id}
          clickupTaskId={selectedCase.clickup_task_id || ''}
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedCase(null) }}
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
            work_report: selectedCase.work_report,
            materials_used: selectedCase.materials_used,
            time_spent_minutes: selectedCase.time_spent_minutes,
            service_type: selectedCase.service_type,
            priority: selectedCase.priority,
            work_started_at: selectedCase.work_started_at,
            files: selectedCase.files
          }}
        />
      )}
    </div>
  )
}

export default CompletedCasesView

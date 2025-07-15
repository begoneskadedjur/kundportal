// 📁 src/components/admin/commissions/CommissionDetailsTable.tsx - Tabell med ärenden som grund för provision, sorterbara kolumner + COLLAPSIBLE GROUPS
import React, { useState, useMemo } from 'react'
import { 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  User, 
  Building2, 
  MapPin, 
  Calendar,
  DollarSign,
  Search,
  Filter,
  X,
  ChevronRight
} from 'lucide-react'
import { formatCurrency, formatSwedishDate, formatAddress, formatCustomerInfo } from '../../../services/commissionCalculations'
import type { CommissionCaseDetail, CommissionSort } from '../../../types/commission'

interface CommissionDetailsTableProps {
  cases: CommissionCaseDetail[]
  loading?: boolean
  onCaseClick?: (case_: CommissionCaseDetail) => void
  showTechnicianColumn?: boolean
  groupByTechnician?: boolean
}

const CommissionDetailsTable: React.FC<CommissionDetailsTableProps> = ({
  cases,
  loading = false,
  onCaseClick,
  showTechnicianColumn = true,
  groupByTechnician = false
}) => {
  const [sort, setSort] = useState<CommissionSort>({ field: 'completed_date', direction: 'desc' })
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'private' | 'business'>('all')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Filtrera och sortera cases
  const processedCases = useMemo(() => {
    let filtered = cases

    // Sökfilter
    if (searchTerm) {
      filtered = filtered.filter(case_ => 
        case_.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.primary_assignee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatCustomerInfo(case_).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Typfilter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.type === typeFilter)
    }

    // Sortering
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sort.field) {
        case 'completed_date':
          aValue = new Date(a.completed_date)
          bValue = new Date(b.completed_date)
          break
        case 'commission_amount':
          aValue = a.commission_amount || 0
          bValue = b.commission_amount || 0
          break
        case 'case_price':
          aValue = a.case_price || 0
          bValue = b.case_price || 0
          break
        case 'technician_name':
          aValue = a.primary_assignee_name || ''
          bValue = b.primary_assignee_name || ''
          break
        case 'case_type':
          aValue = a.type
          bValue = b.type
          break
        default:
          return 0
      }

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [cases, searchTerm, typeFilter, sort])

  // Gruppering per tekniker om aktiverat
  const groupedCases = useMemo(() => {
    if (!groupByTechnician) return [{ technician: null, cases: processedCases }]

    const groups: { [key: string]: CommissionCaseDetail[] } = {}
    
    processedCases.forEach(case_ => {
      const techName = case_.primary_assignee_name || 'Ej tilldelad'
      if (!groups[techName]) groups[techName] = []
      groups[techName].push(case_)
    })

    return Object.entries(groups)
      .map(([technician, cases]) => ({ technician, cases }))
      .sort((a, b) => b.cases.length - a.cases.length)
  }, [processedCases, groupByTechnician])

  // Toggle expand/collapse för en tekniker
  const toggleGroup = (technicianName: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(technicianName)) {
      newExpanded.delete(technicianName)
    } else {
      newExpanded.add(technicianName)
    }
    setExpandedGroups(newExpanded)
  }

  // Expand/collapse alla
  const toggleAllGroups = (expand: boolean) => {
    if (expand) {
      const allTechnicians = groupedCases
        .filter(group => group.technician)
        .map(group => group.technician!)
      setExpandedGroups(new Set(allTechnicians))
    } else {
      setExpandedGroups(new Set())
    }
  }

  const handleSort = (field: CommissionSort['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const SortIcon = ({ field }: { field: CommissionSort['field'] }) => {
    if (sort.field !== field) return <ChevronUp className="w-4 h-4 text-slate-500" />
    return sort.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-green-400" />
      : <ChevronDown className="w-4 h-4 text-green-400" />
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="flex justify-between mb-4">
            <div className="w-48 h-6 bg-slate-700 rounded"></div>
            <div className="w-32 h-8 bg-slate-700 rounded"></div>
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex space-x-4 mb-3">
              <div className="w-20 h-4 bg-slate-700 rounded"></div>
              <div className="w-32 h-4 bg-slate-700 rounded"></div>
              <div className="w-24 h-4 bg-slate-700 rounded"></div>
              <div className="w-28 h-4 bg-slate-700 rounded"></div>
              <div className="w-20 h-4 bg-slate-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header med filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            Ärendedetaljer
          </h3>
          <p className="text-sm text-slate-400">
            {processedCases.length} ärenden 
            {cases.length !== processedCases.length && ` (filtrerat från ${cases.length})`}
          </p>
        </div>

        {/* Filter och sök */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          {/* Sök */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök ärenden..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none w-full sm:w-64"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-600 rounded"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>

          {/* Typfilter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="pl-10 pr-8 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">Alla typer</option>
              <option value="private">Privatperson</option>
              <option value="business">Företag</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expand/Collapse kontroller */}
      {groupByTechnician && groupedCases.length > 1 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-700/30 rounded-lg">
          <span className="text-sm text-slate-300">
            {groupedCases.filter(group => group.technician).length} tekniker med ärenden
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => toggleAllGroups(true)}
              className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 transition-colors"
            >
              Visa alla
            </button>
            <button
              onClick={() => toggleAllGroups(false)}
              className="px-3 py-1 text-xs bg-slate-600/50 text-slate-300 rounded border border-slate-600 hover:bg-slate-600/70 transition-colors"
            >
              Dölj alla
            </button>
          </div>
        </div>
      )}

      {/* Tabell */}
      {processedCases.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Inga ärenden hittades</h3>
          <p className="text-slate-500">
            {searchTerm || typeFilter !== 'all' 
              ? 'Prova att justera dina filter eller sökkriterier.'
              : 'Det finns inga ärenden för den valda perioden.'
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {groupedCases.map(({ technician, cases: groupCases }, groupIndex) => (
            <div key={technician || 'ungrouped'} className={groupIndex > 0 ? 'mt-8' : ''}>
              {/* Klickbar gruppheader för tekniker */}
              {groupByTechnician && technician && (
                <div 
                  className="flex items-center justify-between mb-4 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => toggleGroup(technician)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <User className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{technician}</h4>
                      <p className="text-sm text-slate-400">
                        {groupCases.length} ärenden • {formatCurrency(
                          groupCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
                        )} provision
                      </p>
                    </div>
                  </div>
                  
                  {/* Expand/Collapse ikon */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">
                      {expandedGroups.has(technician) ? 'Dölj ärenden' : 'Visa ärenden'}
                    </span>
                    <ChevronRight 
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        expandedGroups.has(technician) ? 'rotate-90' : ''
                      }`} 
                    />
                  </div>
                </div>
              )}

              {/* Konditionell rendering av tabell */}
              {(!groupByTechnician || !technician || expandedGroups.has(technician)) && (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4">
                          <button
                            onClick={() => handleSort('completed_date')}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors"
                          >
                            <span>Datum</span>
                            <SortIcon field="completed_date" />
                          </button>
                        </th>
                        
                        <th className="text-left py-3 px-4">
                          <button
                            onClick={() => handleSort('case_type')}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors"
                          >
                            <span>Ärende</span>
                            <SortIcon field="case_type" />
                          </button>
                        </th>

                        {showTechnicianColumn && !groupByTechnician && (
                          <th className="text-left py-3 px-4">
                            <button
                              onClick={() => handleSort('technician_name')}
                              className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors"
                            >
                              <span>Tekniker</span>
                              <SortIcon field="technician_name" />
                            </button>
                          </th>
                        )}

                        <th className="text-left py-3 px-4">
                          <span className="text-slate-400">Kund</span>
                        </th>

                        <th className="text-right py-3 px-4">
                          <button
                            onClick={() => handleSort('case_price')}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors ml-auto"
                          >
                            <span>Pris</span>
                            <SortIcon field="case_price" />
                          </button>
                        </th>

                        <th className="text-right py-3 px-4">
                          <button
                            onClick={() => handleSort('commission_amount')}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors ml-auto"
                          >
                            <span>Provision</span>
                            <SortIcon field="commission_amount" />
                          </button>
                        </th>

                        <th className="text-right py-3 px-4">
                          <span className="text-slate-400">Åtgärder</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {groupCases.map((case_, index) => (
                        <tr 
                          key={case_.id}
                          className={`
                            border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors
                            ${onCaseClick ? 'cursor-pointer' : ''}
                          `}
                          onClick={() => onCaseClick?.(case_)}
                        >
                          {/* Datum */}
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="text-white text-sm">
                                {formatSwedishDate(case_.completed_date)}
                              </span>
                            </div>
                          </td>

                          {/* Ärende */}
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${
                                case_.type === 'private' 
                                  ? 'bg-purple-500/20 text-purple-400' 
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {case_.type === 'private' ? (
                                  <User className="w-4 h-4" />
                                ) : (
                                  <Building2 className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">
                                  {case_.case_number || case_.id.slice(0, 8)}
                                </p>
                                <p className="text-slate-400 text-xs truncate max-w-32">
                                  {case_.title}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Tekniker (om visas) */}
                          {showTechnicianColumn && !groupByTechnician && (
                            <td className="py-4 px-4">
                              <span className="text-white text-sm">
                                {case_.primary_assignee_name || 'Ej tilldelad'}
                              </span>
                            </td>
                          )}

                          {/* Kund */}
                          <td className="py-4 px-4">
                            <div className="max-w-48">
                              <p className="text-white text-sm truncate">
                                {formatCustomerInfo(case_)}
                              </p>
                              {case_.adress && (
                                <p className="text-slate-400 text-xs truncate">
                                  <MapPin className="w-3 h-3 inline mr-1" />
                                  {formatAddress(case_.adress)}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Pris */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <DollarSign className="w-4 h-4 text-slate-400" />
                              <span className="text-white font-medium">
                                {formatCurrency(case_.case_price)}
                              </span>
                            </div>
                            {case_.type === 'business' && (
                              <p className="text-xs text-slate-400">+ moms</p>
                            )}
                          </td>

                          {/* Provision */}
                          <td className="py-4 px-4 text-right">
                            <span className="text-green-400 font-bold">
                              {formatCurrency(case_.commission_amount || 0)}
                            </span>
                          </td>

                          {/* Åtgärder */}
                          <td className="py-4 px-4 text-right">
                            {onCaseClick && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onCaseClick(case_)
                                }}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                title="Visa detaljer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Gruppfooter med totaler */}
                  {groupByTechnician && (
                    <div className="mt-4 p-3 bg-slate-700/20 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">
                          Totalt för {technician}: {groupCases.length} ärenden
                        </span>
                        <span className="text-green-400 font-bold">
                          {formatCurrency(groupCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer med totaler */}
      {processedCases.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
            <div className="text-sm text-slate-400">
              Visar {processedCases.length} av {cases.length} ärenden
              {groupByTechnician && (
                <span className="ml-2">
                  • {expandedGroups.size} av {groupedCases.filter(g => g.technician).length} tekniker expanderade
                </span>
              )}
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-slate-400">
                Total ärendepris: <span className="text-white font-medium">
                  {formatCurrency(processedCases.reduce((sum, c) => sum + c.case_price, 0))}
                </span>
              </div>
              <div className="text-slate-400">
                Total provision: <span className="text-green-400 font-bold">
                  {formatCurrency(processedCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommissionDetailsTable
// 📁 src/components/admin/economics/CustomerContractTable.tsx
import React, { useState } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Calendar, DollarSign, Users, Filter } from 'lucide-react'
import Card from '../../ui/Card'
import { useEconomicsDashboard } from '../../../hooks/useEconomicsDashboard'
import type { CustomerContract } from '../../../services/economicsService'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('sv-SE')
}

const getBusinessTypeIcon = (businessType: string): string => {
  const icons: { [key: string]: string } = {
    'brf': '🏢',
    'restaurant': '🍽️',
    'hotel': '🏨',
    'fastighetsägare': '🏗️',
    'boendeverksamhet': '🏠',
    'livsmedelsbutik': '🛒',
    'hästgård': '🐎',
    'såverk': '🪵',
    'fastighetsförvaltning': '🏘️',
    'livsmedelsindustri': '🏭',
    'samfällighet': '🏞️',
    'annat': '📋'
  }
  return icons[businessType] || '📋'
}

const getStatusColor = (daysRemaining: number): string => {
  if (daysRemaining <= 0) return 'text-red-400 bg-red-500/10'
  if (daysRemaining <= 90) return 'text-red-400 bg-red-500/10'
  if (daysRemaining <= 180) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-green-400 bg-green-500/10'
}

type SortField = keyof CustomerContract
type SortDirection = 'asc' | 'desc'

const CustomerContractTable: React.FC = () => {
  const { customerContracts, loading, error } = useEconomicsDashboard()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('days_remaining')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring' | 'active'>('all')
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('all')

  if (loading) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Users className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Detaljerad Avtalslista</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <div className="flex items-center text-red-400">
          <Users className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av avtalsdata: {error}</span>
        </div>
      </Card>
    )
  }

  if (!customerContracts.length) {
    return (
      <Card>
        <div className="flex items-center mb-6">
          <Users className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Detaljerad Avtalslista</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Calendar className="w-8 h-8 mr-2" />
          <span>Inga avtal tillgängliga</span>
        </div>
      </Card>
    )
  }

  // Filtrera data
  const filteredContracts = customerContracts.filter(contract => {
    const matchesSearch = contract.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.assigned_account_manager.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'expiring' && contract.days_remaining <= 180) ||
                         (statusFilter === 'active' && contract.days_remaining > 180)
    
    const matchesBusinessType = businessTypeFilter === 'all' || contract.business_type === businessTypeFilter

    return matchesSearch && matchesStatus && matchesBusinessType
  })

  // Sortera data
  const sortedContracts = [...filteredContracts].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    return 0
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
  }

  // Statistik för filtrerad data
  const totalFilteredRevenue = sortedContracts.reduce((sum, c) => sum + c.annual_value, 0)
  const expiringCount = sortedContracts.filter(c => c.days_remaining <= 180).length

  // Unika verksamhetstyper för filter
  const businessTypes = Array.from(new Set(customerContracts.map(c => c.business_type))).filter(Boolean)

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Users className="w-5 h-5 text-slate-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Detaljerad Avtalslista</h2>
          <span className="ml-2 text-sm text-slate-400">({sortedContracts.length} av {customerContracts.length})</span>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total ARR (filtrerad)</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalFilteredRevenue)}</p>
        </div>
      </div>

      {/* Filter och sök */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Sökruta */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Sök företag eller account manager..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alla avtal</option>
          <option value="expiring">Utgår inom 6 mån</option>
          <option value="active">Aktiva längre</option>
        </select>

        {/* Verksamhetstyp filter */}
        <select
          value={businessTypeFilter}
          onChange={(e) => setBusinessTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alla verksamheter</option>
          {businessTypes.map(type => (
            <option key={type} value={type}>
              {getBusinessTypeIcon(type)} {type}
            </option>
          ))}
        </select>
      </div>

      {/* Snabb statistik */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-slate-800/50 rounded-lg">
          <p className="text-slate-400 text-sm">Visade avtal</p>
          <p className="text-white font-bold text-lg">{sortedContracts.length}</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 text-sm">Total ARR</p>
          <p className="text-green-400 font-bold text-lg">{formatCurrency(totalFilteredRevenue)}</p>
        </div>
        <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">Utgår snart</p>
          <p className="text-yellow-400 font-bold text-lg">{expiringCount}</p>
        </div>
        <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-400 text-sm">Genomsnitt/kund</p>
          <p className="text-blue-400 font-bold text-lg">
            {sortedContracts.length > 0 ? formatCurrency(totalFilteredRevenue / sortedContracts.length) : '0 kr'}
          </p>
        </div>
      </div>

      {/* Tabell */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr className="text-slate-300">
              <th 
                className="px-4 py-3 text-left cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('company_name')}
              >
                <div className="flex items-center">
                  Företag
                  {getSortIcon('company_name')}
                </div>
              </th>
              <th className="px-4 py-3 text-left">Verksamhet</th>
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('annual_value')}
              >
                <div className="flex items-center justify-end">
                  Årspremie
                  {getSortIcon('annual_value')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('total_contract_value')}
              >
                <div className="flex items-center justify-end">
                  Totalt värde
                  {getSortIcon('total_contract_value')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('contract_end_date')}
              >
                <div className="flex items-center">
                  Slutdatum
                  {getSortIcon('contract_end_date')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('days_remaining')}
              >
                <div className="flex items-center justify-end">
                  Tid kvar
                  {getSortIcon('days_remaining')}
                </div>
              </th>
              <th className="px-4 py-3 text-left">Account Manager</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {sortedContracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{contract.company_name}</div>
                  <div className="text-xs text-slate-400">{contract.contract_type_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <span className="mr-1">{getBusinessTypeIcon(contract.business_type)}</span>
                    <span className="text-slate-300 text-xs">{contract.business_type}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-green-400">{formatCurrency(contract.annual_value)}</div>
                  <div className="text-xs text-slate-400">
                    {formatCurrency(contract.annual_value / 12)}/mån
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-white">{formatCurrency(contract.total_contract_value)}</div>
                  <div className="text-xs text-slate-400">
                    {contract.contract_length_months} månader
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{formatDate(contract.contract_end_date)}</div>
                  <div className="text-xs text-slate-400">{formatDate(contract.contract_start_date)}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={`font-semibold ${getStatusColor(contract.days_remaining).split(' ')[0]}`}>
                    {contract.days_remaining > 0 
                      ? `${contract.days_remaining} dagar`
                      : 'Utgånget'
                    }
                  </div>
                  <div className="text-xs text-slate-400">
                    {contract.days_remaining > 0 
                      ? `${Math.ceil(contract.days_remaining / 30)} månader`
                      : ''
                    }
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-300">{contract.assigned_account_manager}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.days_remaining)}`}>
                    {contract.days_remaining <= 0 ? 'Utgånget' :
                     contract.days_remaining <= 90 ? 'Kritisk' :
                     contract.days_remaining <= 180 ? 'Varning' : 'Aktiv'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginering placeholder (kan implementeras senare) */}
      {sortedContracts.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Filter className="w-8 h-8 mx-auto mb-2" />
          <p>Inga avtal matchar de valda filtren</p>
        </div>
      )}

      {/* Footer med export-möjligheter (placeholder) */}
      <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
        <div>
          Visar {sortedContracts.length} av {customerContracts.length} avtal
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-3 h-3" />
          <span>Total portföljvärde: {formatCurrency(customerContracts.reduce((sum, c) => sum + c.total_contract_value, 0))}</span>
        </div>
      </div>
    </Card>
  )
}

export default CustomerContractTable
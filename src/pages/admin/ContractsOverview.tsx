// src/pages/admin/ContractsOverview.tsx - Dashboard för avtals- och offertöverblick
import React, { useState, useMemo } from 'react'
import { FileText, Search, ExternalLink, Eye, DollarSign, CheckCircle, ShoppingCart, Filter, Download, TrendingUp, Users, Package, Calendar, Clock, AlertTriangle, BarChart3 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import ContractFilesModal from '../../components/admin/contracts/ContractFilesModal'
import ContractImportModal from '../../components/admin/contracts/ContractImportModal'
import FilesColumn from '../../components/admin/contracts/FilesColumn'
import FileDownloadButton from '../../components/admin/contracts/FileDownloadButton'
import { useContracts } from '../../hooks/useContracts'
import { ContractFilters, ContractWithSourceData } from '../../services/contractService'
import { formatContractValue, getContractStatusColor, getContractStatusText, getContractTypeText } from '../../services/contractService'
import toast from 'react-hot-toast'

// Typ badge-komponent
const TypeBadge: React.FC<{ type: 'contract' | 'offer' }> = ({ type }) => {
  const colors = type === 'contract' 
    ? 'text-green-400 bg-green-500/20 border-green-500/30'
    : 'text-blue-400 bg-blue-500/20 border-blue-500/30'
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors}`}>
      {getContractTypeText(type)}
    </span>
  )
}

// Status badge-komponent  
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColorClasses = (status: string) => {
    const colors = {
      'pending': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      'signed': 'text-green-400 bg-green-500/20 border-green-500/30',
      'active': 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      'declined': 'text-red-400 bg-red-500/20 border-red-500/30',
      'ended': 'text-slate-400 bg-slate-500/20 border-slate-500/30',
      'overdue': 'text-red-400 bg-red-500/20 border-red-500/30'
    }
    return colors[status as keyof typeof colors] || 'text-slate-400 bg-slate-500/20 border-slate-500/30'
  }
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColorClasses(status)}`}>
      {getContractStatusText(status as any)}
    </span>
  )
}

// Mobil card-komponent
const ContractMobileCard: React.FC<{ 
  contract: ContractWithSourceData
  onOpenFilesModal: (contract: ContractWithSourceData) => void
}> = ({ contract, onOpenFilesModal }) => {
  const handleViewOneFlow = () => {
    if (contract.oneflow_contract_id) {
      window.open(`https://app.oneflow.com/contracts/${contract.oneflow_contract_id}`, '_blank')
    }
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-3">
        <TypeBadge type={contract.type} />
        <StatusBadge status={contract.status} />
      </div>
      
      <div className="space-y-2">
        <h3 className="font-semibold text-white">
          {contract.company_name || contract.contact_person || 'Okänd motpart'}
        </h3>
        
        {contract.contact_person && contract.company_name && (
          <p className="text-sm text-slate-400">{contract.contact_person}</p>
        )}
        
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">
            {contract.total_value ? formatContractValue(contract.total_value) : '-'}
          </span>
          <div className="text-right">
            {contract.contract_length && (
              <div className="text-slate-400 text-sm">
                {contract.contract_length} månader
              </div>
            )}
            <div className="text-slate-400 text-sm">
              Start: {contract.start_date ? new Date(contract.start_date).toLocaleDateString('sv-SE') : 'Ej angivet'}
            </div>
            <div className="text-slate-500 text-xs">
              Skapad: {new Date(contract.created_at).toLocaleDateString('sv-SE')}
            </div>
          </div>
        </div>
        
        {contract.begone_employee_name && (
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3 text-green-400" />
            <p className="text-xs text-slate-400">
              {contract.begone_employee_name}
            </p>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewOneFlow}
              className="text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              OneFlow
            </Button>
          </div>
          
          {/* Files column för mobile */}
          <FilesColumn 
            contractId={contract.id}
            onFilesModalOpen={() => onOpenFilesModal(contract)}
            showButton={true}
          />
        </div>
      </div>
    </Card>
  )
}

export default function ContractsOverview() {
  const { contracts, loading, error, stats, currentFilters, setFilters, clearFilters, refreshContracts } = useContracts()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [valueFilter, setValueFilter] = useState<{ min: string, max: string }>({ min: '', max: '' })
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set())
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // Files modal state
  const [filesModalOpen, setFilesModalOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [selectedContractName, setSelectedContractName] = useState<string>('')

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Filtrera kontrakt lokalt för snabb respons
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const matchesSearch = !searchTerm || 
        contract.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.oneflow_contract_id?.includes(searchTerm) ||
        contract.begone_employee_name?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'all' || contract.status === statusFilter
      const matchesType = typeFilter === 'all' || contract.type === typeFilter
      
      // Date filtering
      const matchesDate = (() => {
        if (dateFilter === 'all') return true
        
        const contractDate = new Date(contract.created_at)
        const now = new Date()
        
        switch (dateFilter) {
          case 'today':
            return contractDate.toDateString() === now.toDateString()
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return contractDate >= weekAgo
          case 'month':
            return contractDate.getMonth() === now.getMonth() && contractDate.getFullYear() === now.getFullYear()
          case 'quarter':
            const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
            return contractDate >= quarterStart
          case 'year':
            return contractDate.getFullYear() === now.getFullYear()
          default:
            return true
        }
      })()
      
      // Value filtering
      const matchesValue = (() => {
        if (!valueFilter.min && !valueFilter.max) return true
        if (!contract.total_value) return false
        
        const value = contract.total_value
        const min = valueFilter.min ? parseFloat(valueFilter.min) : 0
        const max = valueFilter.max ? parseFloat(valueFilter.max) : Infinity
        
        return value >= min && value <= max
      })()

      return matchesSearch && matchesStatus && matchesType && matchesDate && matchesValue
    })
  }, [contracts, searchTerm, statusFilter, typeFilter, dateFilter, valueFilter])

  // Hantera filter-uppdateringar
  const updateFilters = (newFilters: Partial<ContractFilters>) => {
    setFilters({
      ...currentFilters,
      ...newFilters,
      search: searchTerm || undefined
    })
  }

  // KPI-card click handlers
  const handleKpiClick = (type: string) => {
    switch (type) {
      case 'contracts':
        setTypeFilter('contract')
        break
      case 'offers':
        setTypeFilter('offer')
        break
      case 'pending':
        setStatusFilter('pending')
        break
      case 'signed':
        setStatusFilter('signed')
        break
      case 'overdue':
        setStatusFilter('overdue')
        break
      case 'value':
      case 'conversion':
      default:
        // För vissa KPIs visar vi bara data utan att filtrera
        break
    }
  }

  const handleViewOneFlow = (contractId: string) => {
    if (contractId) {
      window.open(`https://app.oneflow.com/contracts/${contractId}`, '_blank')
    }
  }

  // Files modal handlers
  const handleOpenFilesModal = (contract: ContractWithSourceData) => {
    setSelectedContractId(contract.id)
    setSelectedContractName(contract.company_name || contract.contact_person || 'Okänd motpart')
    setFilesModalOpen(true)
  }

  const handleCloseFilesModal = () => {
    setFilesModalOpen(false)
    setSelectedContractId(null)
    setSelectedContractName('')
  }

  // Import modal handlers
  const handleOpenImportModal = () => {
    setImportModalOpen(true)
  }

  const handleCloseImportModal = () => {
    setImportModalOpen(false)
  }

  const handleImportComplete = () => {
    // Ladda om kontraktslistan efter lyckad import
    refreshContracts()
    toast.success('Kontraktslistan uppdaterad efter import!')
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setTypeFilter('all')
    setDateFilter('all')
    setValueFilter({ min: '', max: '' })
    setSelectedContracts(new Set())
    clearFilters()
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Avtalsöversikt
          </h3>
        </div>
        
        <Card>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-500"></div>
          </div>
        </Card>
      </div>
    )
  }

  // Error state  
  if (error) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Avtalsöversikt
        </h3>
        
        <Card className="bg-red-500/10 border-red-500/20">
          <div className="flex items-center text-red-400">
            <FileText className="w-5 h-5 mr-2" />
            <span>Fel vid laddning av avtalsdata: {error}</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Avtalsöversikt
        </h3>
        
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenImportModal}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Importera Kontrakt
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-slate-400"
          >
            <Filter className="w-4 h-4 mr-2" />
            Rensa filter
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EnhancedKpiCard
          title="Total Avtalsvärd"
          value={stats?.total_value || 0}
          icon={DollarSign}
          prefix=""
          suffix=" kr"
          decimals={0}
          onClick={() => handleKpiClick('value')}
          trend={stats?.growth_rate ? (stats.growth_rate > 0 ? "up" : stats.growth_rate < 0 ? "down" : "neutral") : "neutral"}
          trendValue={stats?.growth_rate ? `${stats.growth_rate > 0 ? '+' : ''}${stats.growth_rate}% denna månad` : 'Ingen data'}
          delay={0}
        />

        <EnhancedKpiCard
          title="Signerat Värde"
          value={stats?.signed_value || 0}
          icon={CheckCircle}
          prefix=""
          suffix=" kr"
          decimals={0}
          onClick={() => handleKpiClick('signed')}
          trend="up"
          trendValue={`${stats?.signed_contracts || 0} signerade avtal`}
          delay={0.1}
        />

        <EnhancedKpiCard
          title="Väntande Värde"
          value={stats?.pending_value || 0}
          icon={Clock}
          prefix=""
          suffix=" kr"
          decimals={0}
          onClick={() => handleKpiClick('pending')}
          trend="neutral"
          trendValue={`${stats?.pending_contracts || 0} väntande`}
          delay={0.2}
        />

        <EnhancedKpiCard
          title="Signeringsgrad"
          value={stats?.contract_signing_rate || 0}
          icon={TrendingUp}
          suffix="%"
          onClick={() => handleKpiClick('conversion')}
          trend={stats?.contract_signing_rate && stats.contract_signing_rate > 70 ? "up" : "neutral"}
          trendValue={`${stats?.offer_conversion_rate || 0}% offert-konvertering`}
          delay={0.3}
        />
      </div>

      {/* Secondary Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <EnhancedKpiCard
          title="Totala Avtal"
          value={stats?.total_contracts || 0}
          icon={FileText}
          onClick={() => handleKpiClick('contracts')}
          trend={stats?.contracts_this_month && stats.contracts_last_month ? 
            (stats.contracts_this_month > stats.contracts_last_month ? "up" : 
             stats.contracts_this_month < stats.contracts_last_month ? "down" : "neutral") : "neutral"}
          trendValue={`${stats?.contracts_this_month || 0} denna månad`}
          delay={0.4}
        />

        <EnhancedKpiCard
          title="Totala Offerter"
          value={stats?.total_offers || 0}
          icon={ShoppingCart}
          onClick={() => handleKpiClick('offers')}
          trend="neutral"
          trendValue={`Ø ${stats?.average_offer_value ? Math.round(stats.average_offer_value).toLocaleString('sv-SE') : 0} kr`}
          delay={0.5}
        />

        <EnhancedKpiCard
          title="Snitt Avtalsvärde"
          value={stats?.average_contract_value || 0}
          icon={BarChart3}
          prefix=""
          suffix=" kr"
          decimals={0}
          onClick={() => {}}
          trend="neutral"
          trendValue="per avtal"
          delay={0.6}
        />

        <EnhancedKpiCard
          title="Pipeline Hälsa"
          value={stats?.overdue_count || 0}
          icon={AlertTriangle}
          onClick={() => handleKpiClick('overdue')}
          trend={stats?.overdue_count && stats.overdue_count > 0 ? "down" : "up"}
          trendValue={`${stats?.contracts_expiring_soon || 0} utgår snart`}
          delay={0.7}
        />

        <EnhancedKpiCard
          title="Snitt Signeringstid"
          value={stats?.avg_signing_time_days || 0}
          icon={Calendar}
          suffix=" dagar"
          onClick={() => {}}
          trend="neutral"
          trendValue="genomsnitt"
          delay={0.8}
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-6">
          {/* Sökruta */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Sök namn, företag, e-post..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alla status</option>
            <option value="pending">Väntande</option>
            <option value="signed">Signerat</option>
            <option value="active">Aktivt</option>
            <option value="declined">Avvisat</option>
            <option value="ended">Avslutat</option>
            <option value="overdue">Försenat</option>
          </select>

          {/* Typ filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alla typer</option>
            <option value="contract">Avtal</option>
            <option value="offer">Offert</option>
          </select>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-20" /> {/* Typ */}
              <col className="w-64" /> {/* Motpart */}
              <col className="w-24" /> {/* Status */}
              <col className="w-28" /> {/* Värde */}
              <col className="w-24" /> {/* Startdatum */}
              <col className="w-24" /> {/* Skapad */}
              <col className="w-32" /> {/* BeGone-ansvarig */}
              <col className="w-32" /> {/* Filer */}
              <col className="w-20" /> {/* Åtgärder */}
            </colgroup>
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr className="text-slate-300">
                <th className="px-3 py-3 text-left cursor-pointer hover:bg-slate-700 transition-colors">
                  <div className="flex items-center">Typ</div>
                </th>
                <th className="px-3 py-3 text-left">Motpart</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Värde (SEK)</th>
                <th className="px-3 py-3 text-left">Startdatum</th>
                <th className="px-3 py-3 text-left">Skapad</th>
                <th className="px-3 py-3 text-left">BeGone-ansvarig</th>
                <th className="px-3 py-3 text-left">Filer</th>
                <th className="px-3 py-3 text-center">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <TypeBadge type={contract.type} />
                    </div>
                  </td>
                  
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate" title={contract.company_name || contract.contact_person || 'Okänd motpart'}>
                        {contract.company_name || contract.contact_person || 'Okänd motpart'}
                      </div>
                      {contract.contact_person && contract.company_name && (
                        <div className="text-slate-400 text-xs truncate" title={contract.contact_person}>
                          {contract.contact_person}
                        </div>
                      )}
                      {contract.contact_email && (
                        <div className="text-slate-500 text-xs truncate" title={contract.contact_email}>
                          {contract.contact_email}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <StatusBadge status={contract.status} />
                    </div>
                  </td>
                  
                  <td className="px-3 py-3 text-right">
                    <div className="text-white font-medium">
                      {contract.total_value ? formatContractValue(contract.total_value) : '-'}
                    </div>
                  </td>
                  
                  <td className="px-3 py-3">
                    <div className="text-slate-400 text-xs">
                      {contract.start_date ? new Date(contract.start_date).toLocaleDateString('sv-SE') : 'Ej angivet'}
                    </div>
                  </td>
                  
                  <td className="px-3 py-3">
                    <div className="text-slate-400 text-xs">
                      {new Date(contract.created_at).toLocaleDateString('sv-SE')}
                    </div>
                  </td>
                  
                  <td className="px-3 py-3">
                    <div className="text-slate-400 text-xs truncate" title={contract.begone_employee_name || '-'}>
                      {contract.begone_employee_name || '-'}
                    </div>
                  </td>
                  
                  <td className="px-3 py-3">
                    <FilesColumn 
                      contractId={contract.id}
                      onFilesModalOpen={() => handleOpenFilesModal(contract)}
                      showButton={true}
                    />
                  </td>
                  
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOneFlow(contract.oneflow_contract_id)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredContracts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                ? 'Inga avtal matchar de valda filtren.'
                : 'Inga avtal eller offerter hittades.'
              }
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden space-y-4">
          {filteredContracts.map(contract => (
            <ContractMobileCard 
              key={contract.id} 
              contract={contract} 
              onOpenFilesModal={handleOpenFilesModal}
            />
          ))}
          
          {filteredContracts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                ? 'Inga avtal matchar de valda filtren.'
                : 'Inga avtal eller offerter hittades.'
              }
            </div>
          )}
        </div>
      </Card>

      {/* Files Modal */}
      <ContractFilesModal
        isOpen={filesModalOpen}
        onClose={handleCloseFilesModal}
        contractId={selectedContractId}
        contractName={selectedContractName}
      />

      {/* Import Modal */}
      <ContractImportModal
        isOpen={importModalOpen}
        onClose={handleCloseImportModal}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}
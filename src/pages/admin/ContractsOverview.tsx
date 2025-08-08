// src/pages/admin/ContractsOverview.tsx - Pipeline-fokuserad försäljningsöversikt med kollapsbar sidopanel
import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { 
  FileText, Search, ExternalLink, Eye, DollarSign, CheckCircle, 
  ShoppingCart, Filter, Download, TrendingUp, Users, Package, 
  Calendar, Clock, AlertTriangle, BarChart3, Percent, Target, 
  Award, User, ChevronLeft, ChevronRight, Tag, Layers, X,
  ArrowUp, ArrowDown, Menu, Building2, Mail, Phone, Info
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import ContractFilesModal from '../../components/admin/contracts/ContractFilesModal'
import ContractImportModal from '../../components/admin/contracts/ContractImportModal'
import FilesColumn from '../../components/admin/contracts/FilesColumn'
import FileDownloadButton from '../../components/admin/contracts/FileDownloadButton'
import { PageHeader } from '../../components/shared'
import { useContracts } from '../../hooks/useContracts'
import { ContractFilters, ContractWithSourceData } from '../../services/contractService'
import { formatContractValue, getContractStatusColor, getContractStatusText, getContractTypeText } from '../../services/contractService'
import toast from 'react-hot-toast'

// Parse products från JSON-fält
const parseContractProducts = (contract: ContractWithSourceData): Array<{name: string, quantity: number}> => {
  try {
    // Kolla om det finns selected_products först (från contracts)
    if (contract.selected_products) {
      const data = typeof contract.selected_products === 'string' 
        ? JSON.parse(contract.selected_products) 
        : contract.selected_products
      
      // OneFlow struktur: array av produktgrupper
      if (Array.isArray(data)) {
        const allProducts: any[] = []
        
        data.forEach((group: any) => {
          // Varje grupp har en products array
          if (group.products && Array.isArray(group.products)) {
            group.products.forEach((product: any) => {
              allProducts.push({
                name: product.name || 'Okänd produkt',
                // Hantera quantity som objekt med amount
                quantity: product.quantity?.amount || product.quantity || 1
              })
            })
          }
          // Fallback om produkter ligger direkt i arrayen (gammal struktur)
          else if (group.name) {
            allProducts.push({
              name: group.name || group.product_name || 'Okänd produkt',
              quantity: group.quantity?.amount || group.quantity || 1
            })
          }
        })
        
        // Debug-logging för att verifiera alla produkter
        if (allProducts.length > 3) {
          console.log(`Contract ${contract.id} har ${allProducts.length} produkter:`, allProducts)
        }
        
        return allProducts.length > 0 ? allProducts : []
      }
    }
    
    // Fallback till customer products om de finns
    if (contract.customer_data?.products) {
      const customerProducts = contract.customer_data.products
      
      if (Array.isArray(customerProducts)) {
        // OneFlow struktur från customers table
        const allProducts: any[] = []
        customerProducts.forEach((group: any) => {
          if (group.products && Array.isArray(group.products)) {
            group.products.forEach((product: any) => {
              allProducts.push({
                name: product.name || 'Okänd produkt',
                quantity: product.quantity?.amount || product.quantity || 1
              })
            })
          }
        })
        return allProducts
      }
    }
    
    return []
  } catch (error) {
    console.error('Error parsing products:', error, { contract_id: contract.id })
    return []
  }
}

// Pipeline Stage Badge
const PipelineStageBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStageInfo = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Utkast', color: 'text-slate-400 bg-slate-500/20', icon: '📝' }
      case 'pending':
        return { label: 'Skickad', color: 'text-blue-400 bg-blue-500/20', icon: '📤' }
      case 'signed':
        return { label: 'Signerad', color: 'text-green-400 bg-green-500/20', icon: '✅' }
      case 'active':
        return { label: 'Aktiv', color: 'text-emerald-400 bg-emerald-500/20', icon: '🟢' }
      case 'declined':
        return { label: 'Avvisad', color: 'text-red-400 bg-red-500/20', icon: '❌' }
      case 'overdue':
        return { label: 'Försenad', color: 'text-orange-400 bg-orange-500/20', icon: '⚠️' }
      case 'ended':
        return { label: 'Avslutad', color: 'text-gray-400 bg-gray-500/20', icon: '🏁' }
      default:
        return { label: status, color: 'text-slate-400 bg-slate-500/20', icon: '📄' }
    }
  }

  const info = getStageInfo(status)
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${info.color}`}>
      <span className="mr-1">{info.icon}</span>
      {info.label}
    </span>
  )
}

// Kompakt säljarkort för sidopanel
const CompactSellerCard: React.FC<{ 
  seller: any, 
  rank: number,
  onClick: () => void 
}> = ({ seller, rank, onClick }) => {
  const medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'
  
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{medalEmoji}</span>
        <div>
          <p className="text-sm font-medium text-white group-hover:text-green-400 transition-colors">
            {seller.name}
          </p>
          <p className="text-xs text-slate-400">
            {seller.contract_count} avtal
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-green-400">
          {formatContractValue(seller.total_value)}
        </p>
        <p className="text-xs text-slate-500">
          Snitt: {formatContractValue(Math.round(seller.avg_value))}
        </p>
      </div>
    </div>
  )
}

// Interaktiv produktvisning med popover - PORTAL VERSION
const ProductsCell: React.FC<{ products: Array<{name: string, quantity: number}> }> = ({ products }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [backdropClickable, setBackdropClickable] = useState(false)
  
  // Förhindra backdrop från att stänga tooltip direkt efter öppning
  useEffect(() => {
    if (showTooltip) {
      setBackdropClickable(false)
      const timer = setTimeout(() => {
        setBackdropClickable(true)
      }, 200) // Vänta 200ms innan backdrop blir klickbar
      
      return () => clearTimeout(timer)
    }
  }, [showTooltip])
  
  if (products.length === 0) {
    return <span className="text-xs text-slate-500">Inga produkter</span>
  }
  
  // Klick-handler för att visa/dölja popover
  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    
    if (products.length > 3) {
      setShowTooltip(!showTooltip)
    }
  }
  
  // Beräkna position baserat på button ref
  const getTooltipStyle = () => {
    if (!buttonRef.current) return {}
    const rect = buttonRef.current.getBoundingClientRect()
    
    return {
      position: 'fixed' as const,
      left: `${rect.left}px`,
      top: `${rect.bottom + 8}px`,
      zIndex: 99999
    }
  }
  
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1">
        {products.slice(0, 3).map((product, idx) => (
          <span 
            key={idx}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-300"
          >
            {product.quantity > 1 && (
              <span className="font-bold mr-1">{product.quantity}x</span>
            )}
            {product.name}
          </span>
        ))}
        {products.length > 3 && (
          /* ANVÄND BUTTON ISTÄLLET FÖR SPAN - INGEN HOVER, BARA KLICK */
          <button 
            ref={buttonRef}
            type="button"
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-600/20 text-green-400 cursor-pointer hover:bg-green-500/30 hover:text-green-300 hover:scale-105 active:scale-95 transition-all duration-200 font-medium select-none focus:outline-none focus:ring-2 focus:ring-green-500/50"
            onClick={handleButtonClick}
            aria-label={`Visa alla ${products.length} produkter`}
            title={`Klicka för att visa alla ${products.length} produkter`}
          >
            +{products.length - 3} till
          </button>
        )}
      </div>
      
      {/* Tooltip/Popover med alla produkter - PORTAL VERSION */}
      {showTooltip && products.length > 3 && ReactDOM.createPortal(
        <>
          {/* Backdrop för att stänga popover vid klick utanför */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => {
              if (backdropClickable) {
                setShowTooltip(false)
              }
            }}
          />
          
          {/* Popover med alla produkter */}
          <div 
            className="fixed bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-2xl w-80 z-[9999]"
            style={getTooltipStyle()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-400" />
                <h4 className="text-sm font-medium text-white">Alla {products.length} produkter</h4>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowTooltip(false)
                }}
                className="text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all p-1 -m-1"
                aria-label="Stäng"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {/* Visa alla produkter med indikering av vilka som syns i listan */}
              {products.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-700/50 transition-colors">
                  <span className="text-slate-300 truncate flex-1">{product.name}</span>
                  <span className="text-slate-400 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded ml-2 text-xs">
                    {product.quantity}x
                  </span>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">Inga produkter att visa</p>
              )}
            </div>
            
            {/* Liten pil som pekar mot knappen */}
            <div 
              className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-600 rotate-45 border-l border-t border-slate-600"
            />
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// Pipeline filter pills
const PipelineFilters: React.FC<{
  activeFilter: string,
  onFilterChange: (filter: string) => void,
  stats: any
}> = ({ activeFilter, onFilterChange, stats }) => {
  const stages = [
    { key: 'all', label: 'Alla', count: stats?.total_contracts || 0, color: 'bg-slate-600' },
    { key: 'pending', label: 'Skickade', count: stats?.pending_contracts || 0, color: 'bg-blue-600' },
    { key: 'signed', label: 'Signerade', count: stats?.signed_contracts || 0, color: 'bg-green-600' },
    { key: 'active', label: 'Aktiva', count: stats?.active_contracts || 0, color: 'bg-emerald-600' },
    { key: 'overdue', label: 'Försenade', count: stats?.overdue_count || 0, color: 'bg-orange-600' }
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {stages.map(stage => (
        <button
          key={stage.key}
          onClick={() => onFilterChange(stage.key)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium transition-all
            ${activeFilter === stage.key 
              ? `${stage.color} text-white shadow-lg scale-105` 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }
          `}
        >
          {stage.label}
          <span className="ml-2 px-2 py-0.5 bg-black/20 rounded-full text-xs">
            {stage.count}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function ContractsOverview() {
  const { contracts, loading, error, stats, currentFilters, setFilters, clearFilters, refreshContracts } = useContracts()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set())
  
  // Sidopanel state
  const [sidePanelOpen, setSidePanelOpen] = useState(() => {
    const saved = localStorage.getItem('contractsSidePanelOpen')
    return saved ? saved === 'true' : false
  })
  
  // Modal states
  const [filesModalOpen, setFilesModalOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [selectedContractName, setSelectedContractName] = useState<string>('')
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Spara sidopanel-preferens
  useEffect(() => {
    localStorage.setItem('contractsSidePanelOpen', sidePanelOpen.toString())
  }, [sidePanelOpen])

  // Filtrera kontrakt
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

      return matchesSearch && matchesStatus && matchesType
    })
  }, [contracts, searchTerm, statusFilter, typeFilter])

  // Pipeline statistik
  const pipelineStats = useMemo(() => {
    const stages = {
      pending: { count: 0, value: 0 },
      signed: { count: 0, value: 0 },
      active: { count: 0, value: 0 },
      overdue: { count: 0, value: 0 }
    }

    filteredContracts.forEach(contract => {
      const status = contract.status as keyof typeof stages
      if (stages[status]) {
        stages[status].count++
        stages[status].value += contract.total_value || 0
      }
    })

    return stages
  }, [filteredContracts])

  const handleOpenFilesModal = (contract: ContractWithSourceData) => {
    setSelectedContractId(contract.id)
    setSelectedContractName(contract.company_name || contract.contact_person || 'Okänd motpart')
    setFilesModalOpen(true)
  }

  const handleViewOneFlow = (contractId: string) => {
    if (contractId) {
      window.open(`https://app.oneflow.com/contracts/${contractId}`, '_blank')
    }
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setTypeFilter('all')
    clearFilters()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Försäljningspipeline"
          icon={FileText}
          iconColor="text-green-500"
          showBackButton={false}
        />
        
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-slate-700 rounded w-20 animate-pulse"></div>
                  <div className="h-8 bg-slate-600 rounded w-24 animate-pulse"></div>
                  <div className="h-3 bg-slate-700 rounded w-16 animate-pulse"></div>
                </div>
                <div className="w-8 h-8 bg-slate-700 rounded opacity-50 animate-pulse"></div>
              </div>
            </Card>
          ))}
        </div>
        
        {/* Skeleton Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-10 bg-slate-700 rounded-full w-20 animate-pulse"></div>
          ))}
        </div>
        
        {/* Skeleton Table */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-6 bg-slate-700 rounded w-48 animate-pulse"></div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-4">
                <div className="h-12 bg-slate-700 rounded flex-1 animate-pulse"></div>
                <div className="h-12 bg-slate-700 rounded w-32 animate-pulse"></div>
                <div className="h-12 bg-slate-700 rounded w-24 animate-pulse"></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20 p-8">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av avtalsdata: {error}</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Försäljningspipeline"
        subtitle="Hantera kontrakt och försäljningsprocesser"
        icon={FileText}
        iconColor="text-green-500"
        showBackButton={false}
        rightContent={
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Importera
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSidePanelOpen(!sidePanelOpen)}
              className="flex items-center gap-2"
            >
              {sidePanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              Statistik
            </Button>
          </div>
        }
      />
      
      <div className="relative">
        {/* Huvudinnehåll */}
        <div className={`transition-all duration-300 ${sidePanelOpen ? 'lg:mr-96' : ''}`}>
          <div className="space-y-6">

          {/* Kompakt KPI-rad */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Pipeline-värde</p>
                  <p className="text-xl font-bold text-white">
                    {formatContractValue(stats?.total_value || 0)}
                  </p>
                  <p className="text-xs text-green-400 mt-1">
                    {stats?.total_contracts || 0} avtal totalt
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Signerat värde</p>
                  <p className="text-xl font-bold text-white">
                    {formatContractValue(stats?.signed_value || 0)}
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    {stats?.signed_contracts || 0} signerade
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Konvertering</p>
                  <p className="text-xl font-bold text-white">
                    {stats?.contract_signing_rate || 0}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Signeringsgrad
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Snitt deal</p>
                  <p className="text-xl font-bold text-white">
                    {formatContractValue(stats?.average_contract_value || 0)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Per avtal
                  </p>
                </div>
                <Target className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Pipeline-stadier filter */}
          <PipelineFilters 
            activeFilter={statusFilter} 
            onFilterChange={setStatusFilter}
            stats={stats}
          />

          {/* Sök och filter */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sök företag, kontakt, e-post eller säljare..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Alla typer</option>
                <option value="contract">Kontrakt</option>
                <option value="offer">Offert</option>
              </select>

              {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-slate-400"
                >
                  <X className="w-4 h-4 mr-2" />
                  Rensa
                </Button>
              )}
            </div>
          </Card>

          {/* Kontraktslista - Huvudfokus */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Företag / Kontakt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Produkter
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Värde
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Säljare
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredContracts.map((contract) => {
                    const products = parseContractProducts(contract)
                    const isMultiYear = contract.contract_length && parseInt(contract.contract_length) > 12
                    
                    return (
                      <tr key={contract.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <PipelineStageBadge status={contract.status} />
                        </td>
                        
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {contract.company_name || contract.contact_person || 'Okänd'}
                            </p>
                            {contract.contact_person && contract.company_name && (
                              <p className="text-xs text-slate-400 mt-1">
                                <User className="w-3 h-3 inline mr-1" />
                                {contract.contact_person}
                              </p>
                            )}
                            {contract.contact_email && (
                              <p className="text-xs text-slate-500 mt-1">
                                <Mail className="w-3 h-3 inline mr-1" />
                                {contract.contact_email}
                              </p>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4">
                          <ProductsCell products={products} />
                        </td>
                        
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-bold text-white">
                              {contract.total_value ? formatContractValue(contract.total_value) : '-'}
                            </p>
                            {isMultiYear && contract.total_value && (
                              <p className="text-xs text-green-400 mt-1">
                                {formatContractValue(Math.round(contract.total_value / (parseInt(contract.contract_length) / 12)))} /år
                              </p>
                            )}
                            {contract.contract_length && (
                              <p className="text-xs text-slate-500 mt-1">
                                {contract.contract_length} {parseInt(contract.contract_length) === 1 ? 'månad' : 'månader'}
                              </p>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4">
                          <div>
                            {contract.begone_employee_name && (
                              <p className="text-sm text-white">
                                {contract.begone_employee_name}
                              </p>
                            )}
                            {contract.created_by_name && contract.created_by_name !== contract.begone_employee_name && (
                              <p className="text-xs text-slate-500 mt-1">
                                Skapad av: {contract.created_by_name}
                              </p>
                            )}
                            {!contract.begone_employee_name && !contract.created_by_name && (
                              <span className="text-sm text-slate-500">-</span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-400">
                            {new Date(contract.created_at).toLocaleDateString('sv-SE')}
                          </div>
                          {contract.start_date && (
                            <div className="text-xs text-slate-500 mt-1">
                              Start: {new Date(contract.start_date).toLocaleDateString('sv-SE')}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-4 py-4">
                          <div className="flex justify-center gap-2">
                            <FilesColumn 
                              contractId={contract.id}
                              onFilesModalOpen={() => handleOpenFilesModal(contract)}
                              showButton={false}
                            />
                            {contract.oneflow_contract_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewOneFlow(contract.oneflow_contract_id)}
                                className="text-blue-400 hover:text-blue-300 p-1"
                                title="Öppna i OneFlow"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {filteredContracts.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">
                    {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                      ? 'Inga kontrakt matchar dina filter'
                      : 'Inga kontrakt att visa'}
                  </p>
                </div>
              )}
            </div>
          </Card>
          </div>
        </div>

        {/* Kollapsbar sidopanel */}
      <div className={`
        fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-800 
        transform transition-transform duration-300 z-40 overflow-y-auto
        ${sidePanelOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6 space-y-6">
          {/* Sidopanel header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              Analys & Insikter
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidePanelOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Pipeline översikt */}
          <Card className="p-4 bg-gradient-to-br from-slate-800 to-slate-800/50">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Pipeline-stadier</h4>
            <div className="space-y-2">
              {Object.entries(pipelineStats).map(([stage, data]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 capitalize">{stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{data.count}</span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="text-xs text-green-400">{formatContractValue(data.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top säljare */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Top 3 Säljare
            </h4>
            <div className="space-y-2">
              {stats?.top_employees?.slice(0, 3).map((seller: any, index: number) => (
                <CompactSellerCard
                  key={seller.email}
                  seller={seller}
                  rank={index + 1}
                  onClick={() => {
                    setSearchTerm(seller.name)
                    setSidePanelOpen(false)
                  }}
                />
              ))}
              {!stats?.top_employees?.length && (
                <p className="text-xs text-slate-500 text-center py-4">
                  Ingen säljdata tillgänglig
                </p>
              )}
            </div>
          </div>

          {/* Populära produkter */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-400" />
              Top 5 Produkter
            </h4>
            <div className="space-y-2">
              {stats?.popular_products && stats.popular_products.length > 0 ? (
                stats.popular_products.slice(0, 5).map((product: any, index: number) => (
                  <div 
                    key={`${product.name}-${index}`}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                      <p className="text-sm text-white truncate">{product.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-green-400">
                        {product.count} st
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatContractValue(product.total_value)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Ingen produktdata tillgänglig
                  </p>
                  <details className="mt-2">
                    <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400">
                      Debug info
                    </summary>
                    <div className="text-xs text-slate-600 mt-1 font-mono bg-slate-800 p-2 rounded">
                      <p>Stats exists: {!!stats ? 'Yes' : 'No'}</p>
                      <p>Popular products: {JSON.stringify(stats?.popular_products)}</p>
                      <p>Contracts count: {contracts.length}</p>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Snabbstatistik</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Snitt signeringstid</p>
                <p className="text-lg font-bold text-white">
                  {stats?.avg_signing_time_days || 0} dagar
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Utgår snart</p>
                <p className="text-lg font-bold text-orange-400">
                  {stats?.contracts_expiring_soon || 0} st
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Denna månad</p>
                <p className="text-lg font-bold text-white">
                  {stats?.contracts_this_month || 0} avtal
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tillväxt</p>
                <p className="text-lg font-bold text-green-400">
                  {stats?.growth_rate ? `${stats.growth_rate > 0 ? '+' : ''}${stats.growth_rate}%` : '0%'}
                </p>
              </div>
            </div>
          </Card>
        </div>
        </div>

        {/* Modals */}
        <ContractImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImportComplete={() => {
            refreshContracts()
            toast.success('Kontrakt importerade!')
          }}
        />

        <ContractFilesModal
          isOpen={filesModalOpen}
          onClose={() => {
            setFilesModalOpen(false)
            setSelectedContractId(null)
            setSelectedContractName('')
          }}
          contractId={selectedContractId}
          contractName={selectedContractName}
        />
      </div>
    </div>
  )
}
// src/pages/admin/ContractsOverview.tsx - Pipeline-fokuserad försäljningsöversikt med kollapsbar sidopanel
import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom'
import {
  FileText, Search, ExternalLink, Eye, DollarSign, CheckCircle,
  ShoppingCart, Filter, Download, TrendingUp, Users, Package,
  Calendar, Clock, AlertTriangle, BarChart3, Percent, Target,
  Award, User, Tag, Layers, X, ChevronDown, ChevronUp, Activity,
  ArrowUp, ArrowDown, Menu, Building2, Mail, Phone, Info, Briefcase
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import ContractFilesModal from '../../components/admin/contracts/ContractFilesModal'
import ContractImportModal from '../../components/admin/contracts/ContractImportModal'
import FilesColumn from '../../components/admin/contracts/FilesColumn'
import FileDownloadButton from '../../components/admin/contracts/FileDownloadButton'
import { useContracts } from '../../hooks/useContracts'
import { ContractFilters, ContractWithSourceData, ContractService, ContractBillingAggregate } from '../../services/contractService'
import { formatContractValue, getContractStatusColor, getContractStatusText, getContractTypeText } from '../../services/contractService'
import { PriceListService } from '../../services/priceListService'
import type { PriceList, PriceListItemWithArticle } from '../../types/articles'
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

// Contract Type Badge - visuell differentiering mellan avtal och offerter
const ContractTypeBadge: React.FC<{ type: string, contractLength?: string | null }> = ({ type, contractLength }) => {
  if (type === 'contract') {
    const years = contractLength ? parseInt(contractLength) : 0
    const yearText = years > 0 ? ` ${years}år` : ''
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400">
        <FileText className="w-3 h-3 mr-1" />
        Avtal{yearText}
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-500/20 text-sky-400">
      <DollarSign className="w-3 h-3 mr-1" />
      Offert
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

// Prislista/Artiklar-cell med fallback till produkter
interface PriceListCellData {
  priceList: PriceList
  items: PriceListItemWithArticle[]
}

const PriceListCell: React.FC<{
  contract: ContractWithSourceData
  priceListData?: PriceListCellData | null
}> = ({ contract, priceListData }) => {
  const [showPopover, setShowPopover] = useState(false)
  const [backdropClickable, setBackdropClickable] = useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showPopover) {
      setBackdropClickable(false)
      const timer = setTimeout(() => setBackdropClickable(true), 200)
      return () => clearTimeout(timer)
    }
  }, [showPopover])

  // Om prislista finns → visa den
  if (priceListData && priceListData.items.length > 0) {
    const items = priceListData.items
    const maxVisible = 2

    const getPopoverStyle = () => {
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-1">
            {priceListData.priceList.name}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {items.slice(0, maxVisible).map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300"
            >
              {item.article?.name || 'Okänd'}
            </span>
          ))}
          {items.length > maxVisible && (
            <button
              ref={buttonRef}
              type="button"
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-600/20 text-green-400 cursor-pointer hover:bg-green-500/30 hover:text-green-300 transition-all duration-200 font-medium select-none focus:outline-none focus:ring-2 focus:ring-green-500/50"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowPopover(!showPopover)
              }}
              title={`Visa alla ${items.length} artiklar`}
            >
              +{items.length - maxVisible} till
            </button>
          )}
        </div>

        {showPopover && items.length > maxVisible && ReactDOM.createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => { if (backdropClickable) setShowPopover(false) }}
            />
            <div
              className="fixed bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-2xl w-80 z-[9999]"
              style={getPopoverStyle()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-medium text-white">{priceListData.priceList.name}</h4>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowPopover(false) }}
                  className="text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all p-1 -m-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-700/50 transition-colors">
                    <span className="text-slate-300 truncate flex-1">{item.article?.name || 'Okänd'}</span>
                    <span className="text-slate-400 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded ml-2 text-xs">
                      {new Intl.NumberFormat('sv-SE').format(item.custom_price)} kr/{item.article?.unit || 'st'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-600 rotate-45 border-l border-t border-slate-600" />
            </div>
          </>,
          document.body
        )}
      </div>
    )
  }

  // Fallback: visa gamla OneFlow-produkter
  const products = parseContractProducts(contract)
  return <ProductsCell products={products} />
}

// Tjänster-cell: visar signerade tjänster från case_billing_items, fallback till OneFlow-produkter
const ServicesCell: React.FC<{
  contract: ContractWithSourceData
  agg?: ContractBillingAggregate | null
}> = ({ contract, agg }) => {
  const [showPopover, setShowPopover] = useState(false)
  const [backdropClickable, setBackdropClickable] = useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showPopover) {
      setBackdropClickable(false)
      const t = setTimeout(() => setBackdropClickable(true), 200)
      return () => clearTimeout(t)
    }
  }, [showPopover])

  const services = agg?.services || []
  if (services.length === 0) {
    const products = parseContractProducts(contract)
    return <ProductsCell products={products} />
  }

  const maxVisible = 2
  const getPopoverStyle = () => {
    if (!buttonRef.current) return {}
    const rect = buttonRef.current.getBoundingClientRect()
    return {
      position: 'fixed' as const,
      left: `${rect.left}px`,
      top: `${rect.bottom + 8}px`,
      zIndex: 99999,
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1">
        {services.slice(0, maxVisible).map(s => (
          <span
            key={s.id}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-300"
          >
            {s.quantity > 1 && <span className="font-bold mr-1">{s.quantity}×</span>}
            {s.name}
          </span>
        ))}
        {services.length > maxVisible && (
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-[#20c58f]/20 text-[#20c58f] hover:bg-[#20c58f]/30 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              setShowPopover(!showPopover)
            }}
          >
            +{services.length - maxVisible} till
          </button>
        )}
      </div>
      {showPopover && services.length > maxVisible && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => { if (backdropClickable) setShowPopover(false) }}
          />
          <div
            className="fixed bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-2xl w-80 z-[9999]"
            style={getPopoverStyle()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#20c58f]" />
                <h4 className="text-sm font-medium text-white">Alla {services.length} tjänster</h4>
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setShowPopover(false)
                }}
                className="text-slate-400 hover:text-white p-1 -m-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {services.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-700/50">
                  <span className="text-slate-300 truncate flex-1">{s.name}</span>
                  <span className="text-slate-400 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded ml-2 text-xs">
                    {s.quantity}×
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// Marginal-cell: färgkodad marginal + tooltip med brytning
const MarginCell: React.FC<{ agg?: ContractBillingAggregate | null }> = ({ agg }) => {
  if (!agg || agg.margin_pct === null) {
    return <span className="text-xs text-slate-500" title="Ingen intern kostnadsdata">–</span>
  }
  const color =
    agg.margin_pct >= 30
      ? 'text-[#20c58f]'
      : agg.margin_pct >= 15
        ? 'text-amber-400'
        : 'text-red-400'
  const marginVal = agg.external_total - agg.internal_cost
  const tip = `Extern: ${agg.external_total.toLocaleString('sv-SE')} kr · Intern: ${agg.internal_cost.toLocaleString('sv-SE')} kr · Marginal: ${marginVal.toLocaleString('sv-SE')} kr (${agg.margin_pct}%)`
  return (
    <div className={`text-xs font-medium ${color} mt-1`} title={tip}>
      {agg.margin_pct >= 0 ? '+' : ''}{agg.margin_pct}% marginal
    </div>
  )
}

// Kompakt KPI-card
const KpiCard: React.FC<{
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent?: 'green' | 'blue' | 'red' | 'amber' | 'slate'
}> = ({ label, value, sub, icon: Icon, accent = 'slate' }) => {
  const accentMap: Record<string, string> = {
    green: 'text-[#20c58f]',
    blue: 'text-blue-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400',
  }
  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1 truncate">{value}</p>
          {sub && <p className={`text-xs mt-1 ${accentMap[accent]}`}>{sub}</p>}
        </div>
        <Icon className={`w-5 h-5 ${accentMap[accent]} opacity-60 flex-shrink-0`} />
      </div>
    </div>
  )
}

// Funnel-stapel för pipelinehälsa
const FunnelBar: React.FC<{
  segments: Array<{ label: string; value: number; color: string }>
}> = ({ segments }) => {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <p className="text-xs text-slate-500">Ingen data</p>
  return (
    <div className="space-y-2">
      {segments.map(seg => {
        const pct = Math.round((seg.value / total) * 100)
        return (
          <div key={seg.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">{seg.label}</span>
              <span className="text-slate-400">{pct}% · {formatContractValue(seg.value)}</span>
            </div>
            <div className="w-full h-2 bg-slate-700/40 rounded-full overflow-hidden">
              <div className={`h-full ${seg.color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
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
    { key: 'all', label: 'Alla', count: (stats?.total_contracts || 0) + (stats?.total_offers || 0), color: 'bg-slate-600' },
    { key: 'pending', label: 'Skickade', count: stats?.pending_contracts || 0, color: 'bg-blue-600' },
    { key: 'signed', label: 'Signerade', count: stats?.signed_contracts || 0, color: 'bg-green-600' },
    { key: 'active', label: 'Aktiva', count: stats?.active_contracts || 0, color: 'bg-emerald-600' },
    { key: 'declined', label: 'Avvisade', count: stats?.declined_contracts || 0, color: 'bg-red-600' },
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
  const {
    contracts, loading, error, stats, currentFilters, setFilters, clearFilters, refreshContracts,
    // Fil-state — skickas som props till FilesColumn, FileDownloadButton, ContractFilesModal
    contractFiles, filesLoading, downloadingFiles, viewingFiles,
    loadContractFiles, hasContractFiles, viewContractFile, downloadContractFile
  } = useContracts()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set())
  const [showInsights, setShowInsights] = useState(false)


  // Modal states
  const [filesModalOpen, setFilesModalOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [selectedContractName, setSelectedContractName] = useState<string>('')
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Prisliste-cache för tabellceller (fallback för legacy-kontrakt)
  const [priceListCache, setPriceListCache] = useState<Map<string, PriceListCellData>>(new Map())
  // Billing-aggregat per kontrakt (tjänster + interna artiklar från wizarden)
  const [billingAggMap, setBillingAggMap] = useState<Map<string, ContractBillingAggregate>>(new Map())

  // Hämta billing aggregate för synliga kontrakt
  useEffect(() => {
    if (!contracts.length) return
    const ids = contracts.map(c => c.id).filter(Boolean) as string[]
    ContractService.getContractBillingAggregate(ids)
      .then(map => setBillingAggMap(map))
      .catch(err => console.warn('Kunde inte ladda billing aggregate:', err))
  }, [contracts.length])

  // Hämta prislistedata för kontrakt som har price_list_id (direkt eller via kund)
  useEffect(() => {
    if (!contracts.length) return

    const fetchPriceLists = async () => {
      // Samla unika price_list_id:s (från kontrakt eller kundrelation)
      const priceListIds = new Set<string>()
      contracts.forEach(c => {
        const plId = (c as any).price_list_id || c.customer_data?.price_list_id
        if (plId) priceListIds.add(plId)
      })

      if (priceListIds.size === 0) return

      const cache = new Map<string, PriceListCellData>()
      await Promise.all(
        Array.from(priceListIds).map(async (plId) => {
          try {
            const [priceList, items] = await Promise.all([
              PriceListService.getPriceListById(plId),
              PriceListService.getPriceListItems(plId)
            ])
            if (priceList) {
              cache.set(plId, { priceList, items })
            }
          } catch (err) {
            console.warn('Kunde inte hämta prislista:', plId, err)
          }
        })
      )
      if (cache.size > 0) setPriceListCache(cache)
    }

    fetchPriceLists()
  }, [contracts.length])


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
      overdue: { count: 0, value: 0 },
      declined: { count: 0, value: 0 }
    }

    filteredContracts.forEach(contract => {
      const status = contract.status as keyof typeof stages
      if (stages[status]) {
        stages[status].count++
        // Beräkna korrekt värde baserat på kontraktstyp och längd
        let contractValue = contract.total_value || 0
        if (contract.type === 'contract' && contract.contract_length) {
          const years = parseInt(contract.contract_length)
          contractValue = contractValue * years
        }
        stages[status].value += contractValue
      }
    })

    return stages
  }, [filteredContracts])

  const stageLabels: Record<string, string> = {
    pending: 'Väntande',
    signed: 'Signerade',
    active: 'Aktiva',
    overdue: 'Försenade',
    declined: 'Avvisade'
  }

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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Försäljningspipeline</h1>
          <p className="text-sm text-slate-400 mt-1">Hantera kontrakt och försäljningsprocesser</p>
        </div>
        
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
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Sidtitel + åtgärdsknappar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Försäljningspipeline</h1>
          <p className="text-sm text-slate-400 mt-1">Hantera kontrakt och försäljningsprocesser</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Importera</span>
          </button>
        </div>
      </div>
      
      <div className="flex gap-6">
        {/* Huvudinnehåll */}
        <div className="flex-1 min-w-0">
          <div className="space-y-6">

          {/* Ekonomisk KPI-rad — strategisk vy för säljchef/marknadschef */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="ARR"
              value={formatContractValue(stats?.arr_total || 0)}
              sub={
                stats?.arr_delta_30d
                  ? `${stats.arr_delta_30d > 0 ? '+' : ''}${formatContractValue(stats.arr_delta_30d)} senaste 30d`
                  : `${stats?.active_contracts || 0} aktiva avtal`
              }
              icon={DollarSign}
              accent="green"
            />
            <KpiCard
              label="MRR"
              value={formatContractValue(Math.round(stats?.mrr_total || 0))}
              sub="ARR / 12"
              icon={TrendingUp}
              accent="green"
            />
            <KpiCard
              label="Snitt-marginal"
              value={stats?.avg_margin_pct !== null && stats?.avg_margin_pct !== undefined ? `${stats.avg_margin_pct}%` : '–'}
              sub={stats?.avg_margin_pct !== null && stats?.avg_margin_pct !== undefined ? 'Signerade med intern data' : 'Ingen intern data'}
              icon={Percent}
              accent={
                (stats?.avg_margin_pct ?? 0) >= 30
                  ? 'green'
                  : (stats?.avg_margin_pct ?? 0) >= 15
                    ? 'amber'
                    : 'red'
              }
            />
            <KpiCard
              label="Forecast 30d"
              value={formatContractValue(Math.round(stats?.forecast_30d || 0))}
              sub={`Pending × ${stats?.overall_conversion_rate || 0}% konv.`}
              icon={Activity}
              accent="blue"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Konv.-grad"
              value={`${stats?.overall_conversion_rate || 0}%`}
              sub={`${stats?.signed_contracts || 0} av ${((stats?.total_contracts || 0) + (stats?.total_offers || 0) - (stats?.declined_contracts || 0))} möjliga`}
              icon={Target}
              accent="blue"
            />
            <KpiCard
              label="Snitt deal"
              value={formatContractValue(Math.round(stats?.average_contract_value || 0))}
              sub={`${stats?.signed_contracts || 0} signerade`}
              icon={Briefcase}
              accent="slate"
            />
            <KpiCard
              label="Väntande pipeline"
              value={formatContractValue(stats?.pending_value || 0)}
              sub={`${stats?.pending_contracts || 0} väntande deals`}
              icon={Clock}
              accent="blue"
            />
            <KpiCard
              label="Avvisat värde"
              value={formatContractValue(stats?.declined_value || 0)}
              sub={`${stats?.declined_contracts || 0} declined`}
              icon={AlertTriangle}
              accent="red"
            />
          </div>

          {/* Insights-toggle */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInsights(v => !v)}
              className="text-slate-300 hover:text-[#20c58f]"
            >
              {showInsights ? (
                <><ChevronUp className="w-4 h-4 mr-1" /> Dölj insikter</>
              ) : (
                <><ChevronDown className="w-4 h-4 mr-1" /> Visa insikter</>
              )}
            </Button>
          </div>

          {/* Insights-paneler */}
          {showInsights && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 3a. Marginal & lönsamhet */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-[#20c58f]" />
                    Marginal & lönsamhet
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Höga marginaler (≥30%)</span>
                      <span className="text-[#20c58f] font-medium">
                        {stats.margin_distribution.high.count} · {formatContractValue(stats.margin_distribution.high.value)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Medel (15-30%)</span>
                      <span className="text-amber-400 font-medium">
                        {stats.margin_distribution.mid.count} · {formatContractValue(stats.margin_distribution.mid.value)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Låga (&lt;15%)</span>
                      <span className="text-red-400 font-medium">
                        {stats.margin_distribution.low.count} · {formatContractValue(stats.margin_distribution.low.value)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700/50 pt-2">
                      <span className="text-slate-500">Utan intern data</span>
                      <span className="text-slate-500">{stats.margin_distribution.unknown.count} (legacy)</span>
                    </div>
                  </div>

                  {stats.top_profitable_deals.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <p className="text-xs font-semibold text-slate-300 mb-2">Topp 3 lönsammaste</p>
                      <div className="space-y-1.5">
                        {stats.top_profitable_deals.map((d, i) => (
                          <button
                            key={d.contract_id}
                            onClick={() => setSearchTerm(d.company_name)}
                            className="w-full flex items-center justify-between px-2 py-1.5 bg-slate-800/40 hover:bg-slate-800 rounded text-xs text-left transition-colors"
                          >
                            <span className="text-slate-300 truncate flex-1">#{i + 1} {d.company_name}</span>
                            <span className="text-[#20c58f] font-medium ml-2">+{d.margin_pct}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3b. Forecast & pipeline-hälsa */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Forecast & pipeline-hälsa
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Forecast 30d</span>
                      <span className="text-blue-400 font-medium">{formatContractValue(Math.round(stats.forecast_30d))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Forecast 60d</span>
                      <span className="text-blue-400 font-medium">{formatContractValue(Math.round(stats.forecast_60d))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Forecast 90d</span>
                      <span className="text-blue-400 font-medium">{formatContractValue(Math.round(stats.forecast_90d))}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-xs font-semibold text-slate-300 mb-2">Pipeline-tratt</p>
                    <FunnelBar
                      segments={[
                        { label: 'Väntande', value: stats.pending_value, color: 'bg-blue-500' },
                        { label: 'Signerat/Aktivt', value: stats.signed_value, color: 'bg-[#20c58f]' },
                        { label: 'Avvisat', value: stats.declined_value, color: 'bg-red-500' },
                      ]}
                    />
                  </div>
                </div>

                {/* 3c. Säljar-performance */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#20c58f]" />
                    Säljar-performance
                  </h4>
                  <div className="space-y-2">
                    {stats.seller_performance.length === 0 && (
                      <p className="text-xs text-slate-500 py-4 text-center">Ingen säljardata</p>
                    )}
                    {stats.seller_performance.map((s, i) => (
                      <button
                        key={s.email}
                        onClick={() => setSearchTerm(s.name)}
                        className="w-full p-2 bg-slate-800/40 hover:bg-slate-800 rounded-lg text-left transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white truncate">
                            #{i + 1} {s.name}
                          </span>
                          <span className="text-xs text-[#20c58f] font-medium">
                            {formatContractValue(s.arr_contribution)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                          <span>{s.contract_count} avtal</span>
                          <span>Konv: {s.conversion_rate}%</span>
                          {s.avg_margin_pct !== null && <span>Marg: {s.avg_margin_pct}%</span>}
                          <span>Snitt: {formatContractValue(Math.round(s.avg_deal_value))}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3d. Inköpsanalys + Top tjänster */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-400" />
                    Topp 10 interna artiklar (inköp)
                  </h4>
                  {stats.top_internal_articles.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Ingen inköpsdata</p>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.top_internal_articles.map((a, i) => (
                        <div key={a.name} className="flex items-center justify-between px-2 py-1.5 bg-slate-800/40 rounded text-xs">
                          <span className="text-slate-300 truncate flex-1">
                            <span className="text-slate-500 mr-2">#{i + 1}</span>
                            {a.name}
                          </span>
                          <div className="text-right ml-2">
                            <div className="text-amber-400 font-medium">
                              {formatContractValue(a.total_cost)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {a.total_quantity.toLocaleString('sv-SE')} st
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#20c58f]" />
                    Topp 5 tjänster (ARR-bidrag)
                  </h4>
                  {stats.top_services_actual.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Inga tjänstedata</p>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.top_services_actual.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between px-2 py-1.5 bg-slate-800/40 rounded text-xs">
                          <span className="text-slate-300 truncate flex-1">
                            <span className="text-slate-500 mr-2">#{i + 1}</span>
                            {s.name}
                          </span>
                          <div className="text-right ml-2">
                            <div className="text-[#20c58f] font-medium">
                              {formatContractValue(s.total_arr)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.count.toLocaleString('sv-SE')} st
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pipeline-stadier filter */}
          <PipelineFilters 
            activeFilter={statusFilter} 
            onFilterChange={setStatusFilter}
            stats={stats}
          />

          {/* Sök och filter */}
          <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sök företag, kontakt, e-post eller säljare..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                />
              </div>

              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: '📄 Alla typer' },
                  { value: 'contract', label: '📋 Endast Avtal' },
                  { value: 'offer', label: '💼 Endast Offerter' },
                ]}
              />

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
          </div>

          {/* Kontraktslista - Huvudfokus */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/70 border-b border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status & Typ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Företag / Kontakt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Tjänster
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Värde & Marginal
                      <span className="block text-xs font-normal text-slate-500 mt-1">
                        Total / Årligt
                      </span>
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
                    const isMultiYear = contract.contract_length && parseInt(contract.contract_length) > 12
                    const agg = billingAggMap.get(contract.id) || null

                    return (
                      <tr key={contract.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <PipelineStageBadge status={contract.status} />
                            <ContractTypeBadge type={contract.type} contractLength={contract.contract_length} />
                          </div>
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
                          <ServicesCell contract={contract} agg={agg} />
                        </td>

                        <td className="px-4 py-4">
                          <div>
                            {contract.type === 'contract' && contract.contract_length ? (
                              <>
                                <p className="text-sm font-bold text-white">
                                  {contract.total_value ? formatContractValue(contract.total_value * parseInt(contract.contract_length)) : '-'}
                                </p>
                                <p className="text-xs text-[#20c58f] mt-1">
                                  {contract.total_value ? formatContractValue(contract.total_value) : '-'} /år
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {parseInt(contract.contract_length)} års avtal
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-white">
                                  {contract.total_value ? formatContractValue(contract.total_value) : '-'}
                                </p>
                                <p className="text-xs text-amber-400 mt-1">Engångsjobb</p>
                              </>
                            )}
                            <MarginCell agg={agg} />
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
                              contractFiles={contractFiles}
                              filesLoading={filesLoading}
                              downloadingFiles={downloadingFiles}
                              viewingFiles={viewingFiles}
                              loadContractFiles={loadContractFiles}
                              hasContractFiles={hasContractFiles}
                              viewContractFile={viewContractFile}
                              downloadContractFile={downloadContractFile}
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
          </div>
          </div>
        </div>

        {/* Sidopanel */}
        <aside className="hidden lg:block w-80 xl:w-96 flex-shrink-0">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4 space-y-4">
          {/* Sidopanel header */}
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[#20c58f]" />
            Analys & Insikter
          </h3>

          {/* Pipeline översikt */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Pipeline-stadier</h4>
            <div className="space-y-2">
              {Object.entries(pipelineStats).map(([stage, data]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className={`text-xs ${stage === 'declined' ? 'text-red-400' : 'text-slate-400'}`}>{stageLabels[stage] || stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{data.count}</span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className={`text-xs ${stage === 'declined' ? 'text-red-400' : 'text-green-400'}`}>
                      {formatContractValue(data.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top säljare (ARR-bidrag) */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#20c58f]" />
              Top 3 Säljare (ARR)
            </h4>
            <div className="space-y-2">
              {stats?.seller_performance?.slice(0, 3).map((seller, index) => (
                <div
                  key={seller.email}
                  onClick={() => setSearchTerm(seller.name)}
                  className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{seller.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {seller.contract_count} avtal · Konv: {seller.conversion_rate}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs font-medium text-[#20c58f]">
                      {formatContractValue(seller.arr_contribution)}
                    </p>
                  </div>
                </div>
              ))}
              {!stats?.seller_performance?.length && (
                <p className="text-xs text-slate-500 text-center py-4">
                  Ingen säljdata tillgänglig
                </p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Snabbstatistik</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500">Snitt signeringstid</p>
                <p className="text-sm font-bold text-white">
                  {stats?.avg_signing_time_days || 0} dagar
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Utgår snart</p>
                <p className="text-sm font-bold text-orange-400">
                  {stats?.contracts_expiring_soon || 0} st
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Denna månad</p>
                <p className="text-sm font-bold text-white">
                  {stats?.contracts_this_month || 0} avtal
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tillväxt</p>
                <p className="text-sm font-bold text-green-400">
                  {stats?.growth_rate ? `${stats.growth_rate > 0 ? '+' : ''}${stats.growth_rate}%` : '0%'}
                </p>
              </div>
            </div>
          </div>
          </div>
        </aside>

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
          contractFiles={contractFiles}
          filesLoading={filesLoading}
          downloadingFiles={downloadingFiles}
          loadContractFiles={loadContractFiles}
          downloadContractFile={downloadContractFile}
        />
      </div>
    </div>
  )
}
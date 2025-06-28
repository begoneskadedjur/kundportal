// src/components/admin/CustomerCard.tsx - Uppdaterad med AdminCreateCaseModal
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Eye, Edit, MoreVertical, DollarSign, Calendar,
  Users, FileText, Mail, Phone, Plus, Trash2, Power
} from 'lucide-react'
import Button from '../ui/Button'
import AdminCreateCaseModal from './AdminCreateCaseModal'
import { getBusinessTypeLabel, getBusinessTypeIcon } from '../../constants/businessTypes'

interface Customer {
  id: string
  company_name: string
  org_number: string
  contact_person: string
  email: string
  phone: string
  address: string
  is_active: boolean
  created_at: string
  business_type?: string | null
  contract_types?: {
    id: string
    name: string
  }
  // Avtalsfält
  contract_start_date?: string | null
  contract_length_months?: number | null
  annual_premium?: number | null
  total_contract_value?: number | null
  assigned_account_manager?: string | null
  contract_status?: string
  // Beräknade fält
  monthsLeft?: number
  activeCases?: number
}

interface CustomerCardProps {
  customer: Customer
  onToggleStatus: (id: string, currentStatus: boolean) => void
  onDelete?: (id: string) => void
  onCaseCreated?: () => void // Ny prop för att refresha data efter ärendeskapande
}

export default function CustomerCard({ customer, onToggleStatus, onDelete, onCaseCreated }: CustomerCardProps) {
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false)

  // Beräkna månader kvar på avtal
  const getMonthsLeft = () => {
    if (!customer.contract_start_date || !customer.contract_length_months) return null
    
    const startDate = new Date(customer.contract_start_date)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + customer.contract_length_months)
    
    const now = new Date()
    const monthsLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
    
    return Math.max(0, monthsLeft)
  }

  // Färgkodning baserat på tid kvar
  const getStatusColor = (monthsLeft: number | null) => {
    if (monthsLeft === null) return 'text-slate-400'
    if (monthsLeft <= 3) return 'text-red-400'
    if (monthsLeft <= 6) return 'text-yellow-400'
    return 'text-green-400'
  }

  const monthsLeft = getMonthsLeft()
  const statusColor = getStatusColor(monthsLeft)

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '0 kr'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleCardClick = () => {
    navigate(`/admin/customers/${customer.id}`)
  }

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    setShowDropdown(false) // Stäng dropdown först
    action()
  }

  return (
    <div 
      className={`
        relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6 
        cursor-pointer transition-all duration-200 hover:border-slate-600/50 
        ${isHovered ? 'bg-slate-800/70 transform scale-[1.02]' : ''}
        ${!customer.is_active ? 'opacity-60' : ''}
      `}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header - Företagsnamn och Actions */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="text-2xl">
            {getBusinessTypeIcon(customer.business_type)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-white truncate">
              {customer.company_name}
            </h3>
            <p className="text-sm text-slate-400 truncate">
              {customer.org_number}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => handleActionClick(e, () => navigate(`/admin/customers/${customer.id}`))}
            className="whitespace-nowrap"
          >
            <Eye className="w-4 h-4 mr-1" />
            Visa detaljer
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => handleActionClick(e, () => navigate(`/admin/customers/${customer.id}/edit`))}
          >
            <Edit className="w-4 h-4" />
          </Button>

          {/* Dropdown Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleActionClick(e, () => setShowDropdown(!showDropdown))}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                <button
                  onClick={(e) => handleActionClick(e, () => {
                    setShowCreateCaseModal(true)
                  })}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                  disabled={showCreateCaseModal} // Förhindra dubbelklick
                >
                  <Plus className="w-4 h-4" />
                  Skapa ärende
                </button>
                
                <button
                  onClick={(e) => handleActionClick(e, () => {
                    window.location.href = `mailto:${customer.email}`
                    setShowDropdown(false)
                  })}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Skicka e-post
                </button>

                <button
                  onClick={(e) => handleActionClick(e, () => {
                    window.location.href = `tel:${customer.phone}`
                    setShowDropdown(false)
                  })}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Ring kund
                </button>

                <div className="border-t border-slate-700 my-1"></div>

                <button
                  onClick={(e) => handleActionClick(e, () => {
                    onToggleStatus(customer.id, customer.is_active)
                    setShowDropdown(false)
                  })}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                >
                  <Power className="w-4 h-4" />
                  {customer.is_active ? 'Inaktivera' : 'Aktivera'}
                </button>

                {onDelete && (
                  <button
                    onClick={(e) => handleActionClick(e, () => {
                      onDelete(customer.id)
                      setShowDropdown(false)
                    })}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Ta bort
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2 mb-4">
        {/* Verksamhetstyp Badge */}
        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-md">
          {getBusinessTypeLabel(customer.business_type)}
        </span>

        {/* Avtalsstatus Badge */}
        <span className={`px-2 py-1 bg-slate-600/20 text-xs font-medium rounded-md ${statusColor}`}>
          {customer.is_active ? 'Aktiv' : 'Inaktiv'}
        </span>

        {/* Tid kvar Badge */}
        {monthsLeft !== null && (
          <span className={`px-2 py-1 bg-slate-600/20 text-xs font-medium rounded-md ${statusColor}`}>
            {monthsLeft > 0 ? `${monthsLeft} mån kvar` : 'Utgånget'}
          </span>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Årspremie */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-500" />
          <div>
            <p className="text-xs text-slate-400">Årspremie</p>
            <p className="text-sm font-medium text-white">
              {formatCurrency(customer.annual_premium)}
            </p>
          </div>
        </div>

        {/* Aktiva ärenden */}
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange-500" />
          <div>
            <p className="text-xs text-slate-400">Aktiva ärenden</p>
            <p className="text-sm font-medium text-white">
              {customer.activeCases || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
        {/* Startdatum */}
        {customer.contract_start_date && (
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            <span>Start: {formatDate(customer.contract_start_date)}</span>
          </div>
        )}

        {/* Kontraktansvarig */}
        {customer.assigned_account_manager && (
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span className="truncate">
              {customer.assigned_account_manager.split('@')[0]}
            </span>
          </div>
        )}
      </div>

      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 rounded-lg ring-2 ring-green-500/20 pointer-events-none"></div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-[5]" 
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Create Case Modal */}
      {showCreateCaseModal && (
        <AdminCreateCaseModal
          isOpen={showCreateCaseModal}
          onClose={() => setShowCreateCaseModal(false)}
          onSuccess={() => {
            onCaseCreated?.() // Trigga refresh av data
          }}
          customer={{
            id: customer.id,
            company_name: customer.company_name,
            contact_person: customer.contact_person,
            email: customer.email,
            phone: customer.phone
          }}
        />
      )}
    </div>
  )
}
// src/components/customer/CompanyInformation.tsx
import React from 'react'
import { Building2, Edit, MapPin, Calendar, Crown, DollarSign, Timer, User } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getBusinessTypeLabel, getBusinessTypeIcon } from '../../constants/businessTypes'

interface CompanyInformationProps {
  customer: {
    id: string
    company_name: string
    org_number: string | null
    contact_person: string
    email: string
    phone: string
    address: string
    business_type?: string
    contract_types?: {
      name: string
    }
    contract_start_date?: string
    contract_end_date?: string
    contract_length_months?: number
    annual_premium?: number
    total_contract_value?: number
    assigned_account_manager?: string
    contract_status?: string
  }
  onEdit: () => void
}

const CompanyInformation: React.FC<CompanyInformationProps> = ({ customer, onEdit }) => {
  // Beräkna månader kvar till avtalsslut
  const getMonthsLeft = () => {
    if (!customer.contract_end_date) return null
    
    const endDate = new Date(customer.contract_end_date)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))
    
    return diffMonths
  }

  const monthsLeft = getMonthsLeft()

  // Färgkodning för tid kvar
  const getTimeLeftColor = (months: number | null) => {
    if (months === null) return 'text-slate-400'
    if (months <= 0) return 'text-red-400'
    if (months <= 3) return 'text-red-400'
    if (months <= 6) return 'text-yellow-400'
    return 'text-green-400'
  }

  // Formatera datum
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  // Formatera pengar
  const formatCurrency = (amount?: number) => {
    if (!amount) return '-'
    return `${amount.toLocaleString('sv-SE')} kr`
  }

  // Få namnet från e-post
  const getNameFromEmail = (email?: string) => {
    if (!email) return '-'
    const name = email.split('@')[0]
    return name.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Företagsinformation</h3>
            <p className="text-slate-400 text-sm">Dina kontouppgifter och avtalsinformation</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          className="flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Redigera
        </Button>
      </div>

      {/* Företagsuppgifter */}
      <div className="space-y-4">
        <div className="pb-4 border-b border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Grunduppgifter</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Företag</span>
              <span className="text-white font-medium">{customer.company_name}</span>
            </div>
            
            {customer.org_number && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Organisationsnummer</span>
                <span className="text-white">{customer.org_number}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Kontaktperson</span>
              <span className="text-white">{customer.contact_person}</span>
            </div>

            {customer.business_type && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Verksamhetstyp</span>
                <div className="flex items-center gap-2">
                  <span>{getBusinessTypeIcon(customer.business_type)}</span>
                  <span className="text-white">{getBusinessTypeLabel(customer.business_type)}</span>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between">
              <span className="text-slate-400 text-sm">Adress</span>
              <div className="flex items-center gap-2 text-right">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-white text-sm">{customer.address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Avtalsinformation */}
        <div className="pb-4 border-b border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Avtalsinformation</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Avtalstyp</span>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="text-white">{customer.contract_types?.name || '-'}</span>
              </div>
            </div>

            {customer.contract_start_date && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Startdatum</span>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  <span className="text-white">{formatDate(customer.contract_start_date)}</span>
                </div>
              </div>
            )}

            {customer.contract_length_months && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Avtalslängd</span>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-blue-500" />
                  <span className="text-white">{customer.contract_length_months} månader</span>
                </div>
              </div>
            )}

            {monthsLeft !== null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Tid kvar</span>
                <div className="flex items-center gap-2">
                  <Timer className={`w-4 h-4 ${getTimeLeftColor(monthsLeft)}`} />
                  <span className={`font-medium ${getTimeLeftColor(monthsLeft)}`}>
                    {monthsLeft <= 0 ? 'Utgånget' : `${monthsLeft} månader`}
                  </span>
                </div>
              </div>
            )}

            {customer.annual_premium && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Årspremie</span>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-white font-medium">{formatCurrency(customer.annual_premium)}</span>
                </div>
              </div>
            )}

            {customer.assigned_account_manager && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Kontaktperson BeGone</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  <span className="text-white">{getNameFromEmail(customer.assigned_account_manager)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Status</h4>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm font-medium">Aktivt avtal</span>
            {monthsLeft !== null && monthsLeft <= 6 && (
              <>
                <div className="h-1 w-1 bg-slate-600 rounded-full mx-2"></div>
                <span className={`text-sm ${getTimeLeftColor(monthsLeft)}`}>
                  {monthsLeft <= 3 ? 'Förnyelse krävs snart' : 'Planera förnyelse'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Kontakt Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700 bg-slate-800/30 rounded-lg p-3">
        <p className="text-slate-400 text-xs text-center">
          Behöver du ändra avtalsinformation? Kontakta din kontaktperson på BeGone.
        </p>
      </div>
    </Card>
  )
}

export default CompanyInformation
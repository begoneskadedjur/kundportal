// src/pages/admin/CustomerDetails.tsx - DIN BEFINTLIGA AVANCERADE VERSION + contract_end_date
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Building2, User, Mail, Phone, MapPin, 
  Calendar, DollarSign, FileText, Users, Eye, Edit,
  AlertTriangle, CheckCircle, Clock, Briefcase,
  BarChart3, TrendingUp, CreditCard, Activity
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { customerService } from '../../services/customerService'
import { getBusinessTypeLabel, getBusinessTypeIcon } from '../../constants/businessTypes'
import { getContractStatus } from '../../types/database' // 🆕 Import hjälpfunktion
import toast from 'react-hot-toast'
import { PageHeader } from '../../components/shared'

interface CustomerDetails {
  id: string
  company_name: string
  organization_number?: string | null
  contact_person?: string | null
  contact_email: string
  contact_phone?: string | null
  contact_address?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  business_type?: string | null
  contract_type?: string | null
  // OneFlow fält
  oneflow_contract_id?: string | null
  contract_template_id?: string | null
  contract_status?: 'signed' | 'active' | 'terminated' | 'expired'
  // Avtalsfält
  contract_start_date?: string | null
  contract_end_date?: string | null
  contract_length?: string | null
  annual_value?: number | null
  monthly_value?: number | null
  total_contract_value?: number | null
  agreement_text?: string | null
  // Account management
  assigned_account_manager?: string | null
  account_manager_email?: string | null
  sales_person?: string | null
  sales_person_email?: string | null
  // Business Intelligence
  industry_category?: string | null
  customer_size?: 'small' | 'medium' | 'large' | null
  service_frequency?: string | null
  source_type?: 'oneflow' | 'manual' | 'import' | null
  // Ärenden
  cases?: Array<{
    id: string
    case_number: string
    title: string
    status: string
    priority: string
    scheduled_date: string | null
  }>
}

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchCustomerDetails()
    }
  }, [id])

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true)
      const data = await customerService.getCustomer(id!)
      setCustomer(data)
    } catch (error) {
      console.error('Error fetching customer details:', error)
      setError('Kunde inte hämta kunddetaljer')
      toast.error('Kunde inte hämta kunddetaljer')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!customer) return
    
    try {
      await customerService.toggleCustomerStatus(customer.id, customer.is_active)
      await fetchCustomerDetails() // Uppdatera data
    } catch (error) {
      console.error('Error toggling customer status:', error)
    }
  }

  // Månadsberäkning baserat på contract_end_date
  const getMonthsUntilExpiry = (): number | null => {
    if (!customer?.contract_end_date) return null
    
    const end = new Date(customer.contract_end_date)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44))
    return diffMonths
  }

  // BEHÅLLS OFÖRÄNDRAD
  const getExpiryStatus = (monthsLeft: number | null) => {
    if (monthsLeft === null) return { color: 'text-slate-400', text: '-', bgColor: 'bg-slate-500/20' }
    
    if (monthsLeft <= 0) return { color: 'text-red-400', text: 'Utgånget', bgColor: 'bg-red-500/20' }
    if (monthsLeft <= 3) return { color: 'text-red-400', text: `${monthsLeft} mån kvar`, bgColor: 'bg-red-500/20' }
    if (monthsLeft <= 6) return { color: 'text-yellow-400', text: `${monthsLeft} mån kvar`, bgColor: 'bg-yellow-500/20' }
    return { color: 'text-green-400', text: `${monthsLeft} mån kvar`, bgColor: 'bg-green-500/20' }
  }

  // BEHÅLLS OFÖRÄNDRAD
  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // BEHÅLLS OFÖRÄNDRAD
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="glass border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/customers')}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tillbaka
              </Button>
              <h1 className="text-xl font-semibold">Kunddetaljer</h1>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Kunde inte hämtas</h3>
            <p className="text-slate-400">{error}</p>
          </Card>
        </div>
      </div>
    )
  }

  const monthsLeft = getMonthsUntilExpiry()
  const expiryStatus = getExpiryStatus(monthsLeft)

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header (BEHÅLLS HELT OFÖRÄNDRAD) */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/customers')}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tillbaka
              </Button>
              <div className="flex items-center gap-3">
                {customer.business_type && (
                  <span className="text-xl">{getBusinessTypeIcon(customer.business_type)}</span>
                )}
                <Building2 className="w-5 h-5 text-green-500" />
                <div>
                  <h1 className="text-xl font-semibold">{customer.company_name}</h1>
                  <p className="text-sm text-slate-400">{customer.organization_number || 'Org.nr saknas'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                customer.is_active 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {customer.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={handleToggleStatus}
              >
                {customer.is_active ? 'Inaktivera' : 'Aktivera'}
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Redigera
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Vänster kolumn - Huvudinformation (BEHÅLLS HELT OFÖRÄNDRAD) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Företagsinformation */}
            <Card>
              <div className="flex items-center mb-6">
                <Building2 className="w-5 h-5 text-blue-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Företagsinformation</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Företagsnamn</label>
                  <p className="text-white font-medium">{customer.company_name}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Organisationsnummer</label>
                  <p className="text-white">{customer.organization_number || '-'}</p>
                </div>
                
                {customer.business_type && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Verksamhetstyp</label>
                    <div className="flex items-center gap-2">
                      <span>{getBusinessTypeIcon(customer.business_type)}</span>
                      <p className="text-white">{getBusinessTypeLabel(customer.business_type)}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Avtalstyp</label>
                  <p className="text-white">{customer.contract_type || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Adress</label>
                  <p className="text-white">{customer.contact_address || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Registrerad</label>
                  <p className="text-white">{formatDate(customer.created_at)}</p>
                </div>
              </div>
            </Card>

            {/* Kontaktinformation (BEHÅLLS HELT OFÖRÄNDRAD) */}
            <Card>
              <div className="flex items-center mb-6">
                <User className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Kontaktinformation</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Kontaktperson</label>
                  <p className="text-white font-medium">{customer.contact_person || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">E-postadress</label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <p className="text-white">{customer.contact_email}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Telefonnummer</label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <p className="text-white">{customer.contact_phone || '-'}</p>
                  </div>
                </div>
                
                {customer.assigned_account_manager && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Avtalsansvarig</label>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <p className="text-white">{customer.assigned_account_manager}</p>
                    </div>
                    {customer.account_manager_email && (
                      <p className="text-sm text-slate-400 mt-1">{customer.account_manager_email}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Avtalsinformation */}
            {customer.agreement_text && (
              <Card>
                <div className="flex items-center mb-4">
                  <FileText className="w-5 h-5 text-yellow-500 mr-2" />
                  <h2 className="text-lg font-semibold text-white">Avtalsbeskrivning</h2>
                </div>
                <p className="text-slate-300 leading-relaxed">{customer.agreement_text}</p>
              </Card>
            )}

            {/* OneFlow & Affärsinformation */}
            <Card>
              <div className="flex items-center mb-6">
                <Briefcase className="w-5 h-5 text-purple-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Affärsinformation</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {customer.oneflow_contract_id && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">OneFlow Kontrakt-ID</label>
                    <p className="text-white font-mono text-sm">{customer.oneflow_contract_id}</p>
                  </div>
                )}
                
                {customer.industry_category && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Branschkategori</label>
                    <p className="text-white">{customer.industry_category}</p>
                  </div>
                )}
                
                {customer.customer_size && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Företagsstorlek</label>
                    <p className="text-white">
                      {customer.customer_size === 'small' ? 'Litet' : 
                       customer.customer_size === 'medium' ? 'Medelstort' : 
                       customer.customer_size === 'large' ? 'Stort' : customer.customer_size}
                    </p>
                  </div>
                )}
                
                {customer.service_frequency && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Servicefrekvens</label>
                    <p className="text-white">{customer.service_frequency}</p>
                  </div>
                )}

                {customer.source_type && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Källa</label>
                    <p className="text-white">
                      {customer.source_type === 'oneflow' ? 'OneFlow' : 
                       customer.source_type === 'manual' ? 'Manuell' : 
                       customer.source_type === 'import' ? 'Importerad' : customer.source_type}
                    </p>
                  </div>
                )}

                {customer.sales_person && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Säljare</label>
                    <p className="text-white">{customer.sales_person}</p>
                    {customer.sales_person_email && (
                      <p className="text-sm text-slate-400">{customer.sales_person_email}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Ärenden (BEHÅLLS HELT OFÖRÄNDRAD) */}
            {customer.cases && customer.cases.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Activity className="w-5 h-5 text-orange-500 mr-2" />
                    <h2 className="text-lg font-semibold text-white">Senaste ärenden</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/customers/${customer.id}/cases`)}
                  >
                    Visa alla
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {customer.cases.slice(0, 5).map(case_ => (
                    <div key={case_.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{case_.title}</p>
                        <p className="text-sm text-slate-400">#{case_.case_number}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          case_.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          case_.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {case_.status}
                        </span>
                        {case_.scheduled_date && (
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(case_.scheduled_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Höger kolumn - Avtalsinformation & Statistik */}
          <div className="space-y-6">
            
            {/* Avtalsstatus - UPPDATERAD med contract_end_date */}
            <Card>
              <div className="flex items-center mb-4">
                <CreditCard className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Avtalsstatus</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Startdatum</label>
                    <p className="text-white">
                      {customer.contract_start_date 
                        ? formatDate(customer.contract_start_date)
                        : 'Ej angivet'
                      }
                    </p>
                  </div>
                  
                  {/* 🆕 Visa slutdatum */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Slutdatum</label>
                    <p className="text-white">
                      {customer.contract_end_date 
                        ? formatDate(customer.contract_end_date)
                        : 'Ej angivet'
                      }
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Avtalslängd</label>
                    <p className="text-white">
                      {customer.contract_length ? `${customer.contract_length} år` : 'Ej angivet'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Status</label>
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${expiryStatus.bgColor}`}>
                      <Clock className={`w-4 h-4 ${expiryStatus.color}`} />
                      <span className={`font-medium ${expiryStatus.color}`}>
                        {expiryStatus.text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 🆕 Avtalstidslinje - Visuell representation */}
                {customer.contract_start_date && customer.contract_end_date && (
                  <div className="mt-6">
                    <label className="block text-sm text-slate-400 mb-2">Avtalstidslinje</label>
                    <div className="relative">
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        {(() => {
                          const now = new Date()
                          const start = new Date(customer.contract_start_date!)
                          const end = new Date(customer.contract_end_date!)
                          const totalDuration = end.getTime() - start.getTime()
                          const elapsed = now.getTime() - start.getTime()
                          const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
                          
                          return (
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                progress >= 90 ? 'bg-red-500' :
                                progress >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          )
                        })()}
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>Start</span>
                        <span>Nu</span>
                        <span>Slut</span>
                      </div>
                    </div>
                    
                    {/* Avtalsinformation */}
                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      <div className="text-center">
                        <p className="text-slate-400">Avtalstid</p>
                        <p className="text-white font-medium">
                          {(() => {
                            const start = new Date(customer.contract_start_date!)
                            const end = new Date(customer.contract_end_date!)
                            const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                            return `${totalDays} dagar`
                          })()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-400">Förbrukad tid</p>
                        <p className="text-white font-medium">
                          {(() => {
                            const now = new Date()
                            const start = new Date(customer.contract_start_date!)
                            const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                            return `${elapsed} dagar`
                          })()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-400">Tid kvar</p>
                        <p className={`font-medium ${expiryStatus.color}`}>
                          {monthsLeft !== null && monthsLeft > 0 
                            ? (() => {
                                const now = new Date()
                                const end = new Date(customer.contract_end_date!)
                                const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                return `${daysLeft} dagar`
                              })()
                            : 'Utgånget'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Ekonomisk översikt (BEHÅLLS HELT OFÖRÄNDRAD) */}
            <Card>
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Ekonomisk översikt</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Årspremie</label>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(customer.annual_value)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Totalt avtalsvärde</label>
                  <p className="text-xl font-semibold text-white">
                    {formatCurrency(customer.total_contract_value)}
                  </p>
                </div>
                
                {customer.monthly_value && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Månadsbelopp</label>
                    <p className="text-white">
                      {formatCurrency(customer.monthly_value)}
                    </p>
                  </div>
                )}
                
                {!customer.monthly_value && customer.annual_value && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Månadsbelopp (beräknat)</label>
                    <p className="text-white">
                      {formatCurrency(customer.annual_value / 12)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Ärendestatistik (BEHÅLLS HELT OFÖRÄNDRAD) */}
            {customer.cases && customer.cases.length > 0 && (
              <Card>
                <div className="flex items-center mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
                  <h2 className="text-lg font-semibold text-white">Ärendestatistik</h2>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Totalt</span>
                    <span className="text-white font-medium">{customer.cases.length}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pågående</span>
                    <span className="text-blue-400 font-medium">
                      {customer.cases.filter(c => c.status === 'in_progress').length}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avslutade</span>
                    <span className="text-green-400 font-medium">
                      {customer.cases.filter(c => c.status === 'completed').length}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Snabbåtgärder (BEHÅLLS HELT OFÖRÄNDRAD) */}
            <Card>
              <div className="flex items-center mb-4">
                <Activity className="w-5 h-5 text-purple-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Snabbåtgärder</h2>
              </div>
              
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => navigate(`/admin/customers/${customer.id}/new-case`)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Skapa nytt ärende
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => navigate(`/admin/customers/${customer.id}/cases`)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Visa alla ärenden
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open(`mailto:${customer.email}`, '_blank')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Skicka e-post
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
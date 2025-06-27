// src/pages/admin/CustomerDetails.tsx - Detaljerad kundvy
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
import toast from 'react-hot-toast'

interface CustomerDetails {
  id: string
  company_name: string
  org_number: string
  contact_person: string
  email: string
  phone: string
  address: string
  is_active: boolean
  created_at: string
  updated_at: string
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
  contract_description?: string | null
  assigned_account_manager?: string | null
  contract_status?: string
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

  // Beräkna månader kvar till avtalet löper ut
  const getMonthsUntilExpiry = (): number | null => {
    if (!customer?.contract_start_date || !customer?.contract_length_months) return null
    
    const start = new Date(customer.contract_start_date)
    const end = new Date(start)
    end.setMonth(end.getMonth() + customer.contract_length_months)
    
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44))
    
    return diffMonths
  }

  const getExpiryStatus = (monthsLeft: number | null) => {
    if (monthsLeft === null) return { color: 'text-slate-400', text: '-', bgColor: 'bg-slate-500/20' }
    
    if (monthsLeft <= 0) return { color: 'text-red-400', text: 'Utgånget', bgColor: 'bg-red-500/20' }
    if (monthsLeft <= 3) return { color: 'text-red-400', text: `${monthsLeft} mån kvar`, bgColor: 'bg-red-500/20' }
    if (monthsLeft <= 6) return { color: 'text-yellow-400', text: `${monthsLeft} mån kvar`, bgColor: 'bg-yellow-500/20' }
    return { color: 'text-green-400', text: `${monthsLeft} mån kvar`, bgColor: 'bg-green-500/20' }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount)
  }

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
      {/* Header */}
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
                  <p className="text-sm text-slate-400">{customer.org_number}</p>
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
          
          {/* Vänster kolumn - Huvudinformation */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Företagsinformation */}
            <Card>
              <div className="flex items-center mb-6">
                <Building2 className="w-5 h-5 text-blue-500 mr-2" />
                <h2 className="text-lg font-semibold">Företagsinformation</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Företagsnamn</label>
                  <p className="text-white font-medium">{customer.company_name}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Organisationsnummer</label>
                  <p className="text-white">{customer.org_number}</p>
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
                  <p className="text-white">{customer.contract_types?.name || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Adress</label>
                  <p className="text-white">{customer.address}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Registrerad</label>
                  <p className="text-white">{formatDate(customer.created_at)}</p>
                </div>
              </div>
            </Card>

            {/* Kontaktinformation */}
            <Card>
              <div className="flex items-center mb-6">
                <User className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold">Kontaktinformation</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Kontaktperson</label>
                  <p className="text-white font-medium">{customer.contact_person}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">E-postadress</label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <p className="text-white">{customer.email}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Telefonnummer</label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <p className="text-white">{customer.phone}</p>
                  </div>
                </div>
                
                {customer.assigned_account_manager && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Avtalsansvarig</label>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <p className="text-white">{customer.assigned_account_manager.split('@')[0]}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Avtalsbeskrivning */}
            {customer.contract_description && (
              <Card>
                <div className="flex items-center mb-4">
                  <FileText className="w-5 h-5 text-yellow-500 mr-2" />
                  <h2 className="text-lg font-semibold">Avtalsobjekt</h2>
                </div>
                <p className="text-slate-300 leading-relaxed">{customer.contract_description}</p>
              </Card>
            )}

            {/* Ärenden */}
            {customer.cases && customer.cases.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Activity className="w-5 h-5 text-orange-500 mr-2" />
                    <h2 className="text-lg font-semibold">Senaste ärenden</h2>
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
            
            {/* Avtalsstatus */}
            <Card>
              <div className="flex items-center mb-4">
                <CreditCard className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold">Avtalsstatus</h2>
              </div>
              
              <div className="space-y-4">
                {customer.contract_start_date && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Avtalsperiod</label>
                    <div className="text-white">
                      <p>{formatDate(customer.contract_start_date)}</p>
                      {customer.contract_length_months && (
                        <p className="text-sm text-slate-400">
                          {customer.contract_length_months} månader
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Tid kvar</label>
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${expiryStatus.bgColor}`}>
                    <Clock className={`w-4 h-4 ${expiryStatus.color}`} />
                    <span className={`font-medium ${expiryStatus.color}`}>
                      {expiryStatus.text}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Ekonomisk översikt */}
            <Card>
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold">Ekonomisk översikt</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Årspremie</label>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(customer.annual_premium)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Totalt avtalsvärde</label>
                  <p className="text-xl font-semibold text-white">
                    {formatCurrency(customer.total_contract_value)}
                  </p>
                </div>
                
                {customer.annual_premium && customer.contract_length_months && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Månadsbelopp</label>
                    <p className="text-white">
                      {formatCurrency(customer.annual_premium / 12)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Ärendestatistik */}
            {customer.cases && customer.cases.length > 0 && (
              <Card>
                <div className="flex items-center mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
                  <h2 className="text-lg font-semibold">Ärendestatistik</h2>
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

            {/* Snabbåtgärder */}
            <Card>
              <div className="flex items-center mb-4">
                <Activity className="w-5 h-5 text-purple-500 mr-2" />
                <h2 className="text-lg font-semibold">Snabbåtgärder</h2>
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
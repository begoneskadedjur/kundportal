// src/pages/admin/Customers.tsx - Komplett implementation
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Filter, Eye, Edit, Trash2, 
  Building2, User, Mail, Phone, Calendar,
  DollarSign, FileText, Users, MapPin, MoreVertical,
  Clock, AlertTriangle, Briefcase
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { customerService } from '../../services/customerService'
import { getBusinessTypeLabel, getBusinessTypeIcon } from '../../constants/businessTypes'
import toast from 'react-hot-toast'

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
  assigned_account_manager?: string | null
  contract_status?: string
}

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [businessTypeFilter, setBusinessTypeFilter] = useState<'all' | string>('all')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await customerService.getCustomers()
      setCustomers(data)
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Kunde inte hämta kunder')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await customerService.toggleCustomerStatus(id, !isActive)
      await fetchCustomers()
    } catch (error) {
      console.error('Error toggling customer status:', error)
    }
  }

  // Beräkna månader kvar till avtalet löper ut
  const getMonthsUntilExpiry = (startDate: string | null, lengthMonths: number | null): number | null => {
    if (!startDate || !lengthMonths) return null
    
    const start = new Date(startDate)
    const end = new Date(start)
    end.setMonth(end.getMonth() + lengthMonths)
    
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)) // Genomsnittliga dagar per månad
    
    return diffMonths
  }

  // Filtrera kunder
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && customer.is_active) ||
      (statusFilter === 'inactive' && !customer.is_active)

    const matchesBusinessType = 
      businessTypeFilter === 'all' || 
      customer.business_type === businessTypeFilter

    return matchesSearch && matchesStatus && matchesBusinessType
  })

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

  const getExpiryStatus = (monthsLeft: number | null) => {
    if (monthsLeft === null) return { color: 'text-slate-400', text: '-' }
    
    if (monthsLeft <= 0) return { color: 'text-red-400', text: 'Utgånget' }
    if (monthsLeft <= 3) return { color: 'text-red-400', text: `${monthsLeft} mån kvar` }
    if (monthsLeft <= 6) return { color: 'text-yellow-400', text: `${monthsLeft} mån kvar` }
    return { color: 'text-green-400', text: `${monthsLeft} mån kvar` }
  }

  // Unika verksamhetstyper för filter
  const uniqueBusinessTypes = Array.from(new Set(customers.map(c => c.business_type).filter(Boolean)))

  // Statistik
  const stats = {
    total: customers.length,
    active: customers.filter(c => c.is_active).length,
    totalRevenue: customers
      .filter(c => c.is_active && c.annual_premium)
      .reduce((sum, c) => sum + (c.annual_premium || 0), 0),
    expiringContracts: customers.filter(c => {
      const monthsLeft = getMonthsUntilExpiry(c.contract_start_date, c.contract_length_months)
      return monthsLeft !== null && monthsLeft <= 6 && monthsLeft > 0
    }).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold">Kundhantering</h1>
            <Button
              onClick={() => navigate('/admin/new-customer')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ny kund
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1">
            <Input
              label=""
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sök efter företag, kontaktperson eller e-post..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Alla status</option>
              <option value="active">Aktiva</option>
              <option value="inactive">Inaktiva</option>
            </select>
            
            <select
              value={businessTypeFilter}
              onChange={(e) => setBusinessTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Alla verksamheter</option>
              {uniqueBusinessTypes.map(type => (
                <option key={type} value={type}>
                  {getBusinessTypeLabel(type || '')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-slate-400">Totalt</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-slate-400">Aktiva</p>
                <p className="text-2xl font-bold text-white">{stats.active}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm text-slate-400">Årsomsättning</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm text-slate-400">Löper ut snart</p>
                <p className="text-2xl font-bold text-white">{stats.expiringContracts}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Customer List */}
        <div className="space-y-4">
          {filteredCustomers.length === 0 ? (
            <Card className="p-8 text-center">
              <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {searchTerm ? 'Inga kunder hittades' : 'Inga kunder än'}
              </h3>
              <p className="text-slate-400 mb-4">
                {searchTerm 
                  ? 'Prova att ändra din sökning'
                  : 'Lägg till din första kund för att komma igång'
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => navigate('/admin/new-customer')}>
                  Lägg till första kunden
                </Button>
              )}
            </Card>
          ) : (
            filteredCustomers.map(customer => {
              const monthsLeft = getMonthsUntilExpiry(customer.contract_start_date, customer.contract_length_months)
              const expiryStatus = getExpiryStatus(monthsLeft)
              
                      return (
                <Card key={customer.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header med företag och status */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          {customer.business_type && (
                            <span className="text-lg">{getBusinessTypeIcon(customer.business_type)}</span>
                          )}
                          <Building2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">
                            {customer.company_name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-slate-400">
                              {customer.org_number}
                            </span>
                            {customer.business_type && (
                              <span className="text-sm text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
                                {getBusinessTypeLabel(customer.business_type)}
                              </span>
                            )}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              customer.is_active 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Avtalsinformation - Huvudfokus */}
                      <div className="bg-slate-800/30 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Avtalsinformation
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          {/* Avtalstyp */}
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avtalstyp</p>
                            <p className="text-white font-medium">
                              {customer.contract_types?.name || '-'}
                            </p>
                          </div>

                          {/* Avtalstid */}
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avtalstid</p>
                            <p className="text-white">
                              {customer.contract_length_months ? `${customer.contract_length_months} månader` : '-'}
                            </p>
                          </div>

                          {/* Månader kvar */}
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Kvar</p>
                            <p className={`font-medium ${expiryStatus.color}`}>
                              {expiryStatus.text}
                            </p>
                          </div>

                          {/* Årspremie */}
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Årspremie</p>
                            <p className="text-white font-medium">
                              {formatCurrency(customer.annual_premium)}
                            </p>
                          </div>

                          {/* Totalt avtalsvärde */}
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Totalt värde</p>
                            <p className="text-white font-medium">
                              {formatCurrency(customer.total_contract_value)}
                            </p>
                          </div>
                        </div>

                        {/* Extra info rad */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-700">
                          {customer.contract_start_date && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-blue-400" />
                              <span className="text-slate-300">
                                Startdatum: {formatDate(customer.contract_start_date)}
                              </span>
                            </div>
                          )}
                          
                          {customer.assigned_account_manager && (
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-4 h-4 text-purple-400" />
                              <span className="text-slate-300">
                                Ansvarig: {customer.assigned_account_manager.split('@')[0]}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Kontaktinformation */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">{customer.contact_person}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">{customer.email}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">{customer.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(customer.id, customer.is_active)}
                      >
                        {customer.is_active ? 'Inaktivera' : 'Aktivera'}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/customers/${customer.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
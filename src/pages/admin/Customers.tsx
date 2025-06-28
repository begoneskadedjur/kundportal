// src/pages/admin/Customers.tsx - Uppdaterad med ny CustomerCard
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Filter, BarChart3, Users as UsersIcon,
  Building2, DollarSign, AlertTriangle, TrendingUp
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CustomerCard from '../../components/admin/CustomerCard'
import { customerService } from '../../services/customerService'
import { getBusinessTypeLabel, BUSINESS_TYPES } from '../../constants/businessTypes'
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
  // Beräknade fält
  monthsLeft?: number
  activeCases?: number
}

interface CustomerStats {
  totalCustomers: number
  activeCustomers: number
  totalAnnualRevenue: number
  contractsExpiringSoon: number
}

export default function Customers() {
  const navigate = useNavigate()
  
  // State management
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<CustomerStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    totalAnnualRevenue: 0,
    contractsExpiringSoon: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('all')

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [customers, searchTerm, statusFilter, businessTypeFilter])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const customersData = await customerService.getAllCustomers()
      
      // Beräkna extra fält för varje kund
      const enrichedCustomers = customersData.map(customer => ({
        ...customer,
        monthsLeft: calculateMonthsLeft(customer.contract_start_date, customer.contract_length_months),
        activeCases: Math.floor(Math.random() * 5) // TODO: Hämta från databas
      }))
      
      setCustomers(enrichedCustomers)
      calculateStats(enrichedCustomers)
      
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError('Kunde inte hämta kunder')
      toast.error('Kunde inte hämta kunder')
    } finally {
      setLoading(false)
    }
  }

  const calculateMonthsLeft = (startDate: string | null, lengthMonths: number | null): number | null => {
    if (!startDate || !lengthMonths) return null
    
    const start = new Date(startDate)
    const end = new Date(start)
    end.setMonth(end.getMonth() + lengthMonths)
    
    const now = new Date()
    const monthsLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
    
    return Math.max(0, monthsLeft)
  }

  const calculateStats = (customerData: Customer[]) => {
    const activeCustomers = customerData.filter(c => c.is_active)
    
    const totalAnnualRevenue = activeCustomers.reduce((sum, customer) => {
      return sum + (customer.annual_premium || 0)
    }, 0)

    const contractsExpiringSoon = activeCustomers.filter(customer => {
      const monthsLeft = customer.monthsLeft
      return monthsLeft !== null && monthsLeft <= 6 && monthsLeft > 0
    }).length

    setStats({
      totalCustomers: customerData.length,
      activeCustomers: activeCustomers.length,
      totalAnnualRevenue,
      contractsExpiringSoon
    })
  }

  const applyFilters = () => {
    let filtered = customers

    // Textsökning
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(customer =>
        customer.company_name.toLowerCase().includes(searchLower) ||
        customer.contact_person.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        customer.org_number?.toLowerCase().includes(searchLower)
      )
    }

    // Statusfilter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer =>
        statusFilter === 'active' ? customer.is_active : !customer.is_active
      )
    }

    // Verksamhetstyp-filter
    if (businessTypeFilter !== 'all') {
      filtered = filtered.filter(customer =>
        customer.business_type === businessTypeFilter
      )
    }

    setFilteredCustomers(filtered)
  }

  const handleToggleStatus = async (customerId: string, currentStatus: boolean) => {
    try {
      await customerService.updateCustomer(customerId, { is_active: !currentStatus })
      
      setCustomers(prev => prev.map(customer =>
        customer.id === customerId
          ? { ...customer, is_active: !currentStatus }
          : customer
      ))
      
      toast.success(`Kund ${!currentStatus ? 'aktiverad' : 'inaktiverad'}`)
    } catch (error) {
      console.error('Error toggling customer status:', error)
      toast.error('Kunde inte uppdatera kundstatus')
    }
  }

  const handleDeleteCustomer = async (customerId: string) => {
    if (!window.confirm('Är du säker på att du vill ta bort denna kund?')) {
      return
    }

    try {
      await customerService.deleteCustomer(customerId)
      setCustomers(prev => prev.filter(customer => customer.id !== customerId))
      toast.success('Kund borttagen')
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Kunde inte ta bort kund')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Kunde inte hämta kunder</h3>
        <p className="text-slate-400 mb-4">{error}</p>
        <Button onClick={fetchCustomers}>Försök igen</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Kundhantering</h1>
          <p className="text-slate-400 mt-1">
            Hantera alla dina kunder och deras avtal
          </p>
        </div>
        <Button 
          onClick={() => navigate('/admin/customers/new')}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ny kund
        </Button>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Totalt</p>
              <p className="text-2xl font-bold text-white">{stats.totalCustomers}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Aktiva</p>
              <p className="text-2xl font-bold text-white">{stats.activeCustomers}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Årsomsättning</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(stats.totalAnnualRevenue)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Löper ut snart</p>
              <p className="text-2xl font-bold text-white">{stats.contractsExpiringSoon}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Filter och Sök */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sökfält */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Sök efter företag, kontakt eller e-post..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Alla status</option>
            <option value="active">Aktiva</option>
            <option value="inactive">Inaktiva</option>
          </select>

          {/* Verksamhetstyp Filter */}
          <select
            value={businessTypeFilter}
            onChange={(e) => setBusinessTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Alla verksamheter</option>
            {BUSINESS_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Results Info */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-400">
            Visar {filteredCustomers.length} av {customers.length} kunder
            {searchTerm && ` som matchar "${searchTerm}"`}
            {statusFilter !== 'all' && ` som är ${statusFilter === 'active' ? 'aktiva' : 'inaktiva'}`}
            {businessTypeFilter !== 'all' && ` inom ${getBusinessTypeLabel(businessTypeFilter)}`}
          </p>
        </div>
      </Card>

      {/* Kundkort */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Inga kunder hittades</h3>
            <p className="text-slate-400 mb-4">
              {searchTerm || statusFilter !== 'all' || businessTypeFilter !== 'all'
                ? 'Prova att ändra dina filter eller sökord.'
                : 'Lägg till din första kund för att komma igång.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && businessTypeFilter === 'all' && (
              <Button onClick={() => navigate('/admin/customers/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Lägg till kund
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCustomers.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteCustomer}
            />
          ))}
        </div>
      )}
    </div>
  )
}
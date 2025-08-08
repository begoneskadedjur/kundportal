// src/pages/admin/Customers.tsx - Med ClickUp lista-hantering och återkalla-inbjudan
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Filter, BarChart3, Users as UsersIcon,
  Building2, DollarSign, AlertTriangle, TrendingUp, ArrowLeft, RefreshCw,
  Eye, Mail, Phone, Send, CheckCircle, Clock, UserPlus, MoreHorizontal,
  Calendar, FileText, Settings, Trash2, Power, PowerOff, X, FolderPlus, 
  FolderMinus, ExternalLink
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { customerService } from '../../services/customerService'
import { getBusinessTypeLabel, BUSINESS_TYPES } from '../../constants/businessTypes'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { PageHeader } from '../../components/shared'

interface Customer {
  id: string
  company_name: string
  organization_number?: string | null
  contact_person: string | null
  contact_email: string
  contact_phone?: string | null
  contact_address?: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
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
  assigned_account_manager?: string | null
  account_manager_email?: string | null
  sales_person?: string | null
  sales_person_email?: string | null
  // Business Intelligence
  industry_category?: string | null
  customer_size?: 'small' | 'medium' | 'large' | null
  service_frequency?: string | null
  source_type?: 'oneflow' | 'manual' | 'import' | null
  // ClickUp integration
  clickup_list_id?: string | null
  clickup_list_name?: string | null
  // Beräknade fält
  monthsLeft?: number
  activeCases?: number
  hasInvitation?: boolean
  invitationStatus?: 'pending' | 'accepted' | 'expired' | 'none'
  lastInvitationDate?: string | null
}

interface CustomerStats {
  totalCustomers: number
  activeCustomers: number
  totalAnnualRevenue: number
  contractsExpiringSoon: number
}

interface CustomerInvitation {
  customer_id: string
  email: string
  invited_by: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export default function Customers() {
  const navigate = useNavigate()
  
  // State management
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [invitations, setInvitations] = useState<CustomerInvitation[]>([])
  const [stats, setStats] = useState<CustomerStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    totalAnnualRevenue: 0,
    contractsExpiringSoon: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null)
  const [revokingInvitation, setRevokingInvitation] = useState<string | null>(null)
  const [creatingClickUpList, setCreatingClickUpList] = useState<string | null>(null)
  const [deletingClickUpList, setDeletingClickUpList] = useState<string | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [customers, searchTerm, statusFilter, businessTypeFilter])

  const fetchData = async () => {
    await Promise.all([fetchCustomers(), fetchInvitations()])
  }

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const customersData = await customerService.getCustomers()
      
      // Beräkna extra fält för varje kund
      const enrichedCustomers = customersData.map(customer => ({
        ...customer,
        monthsLeft: calculateMonthsLeft(customer.contract_start_date, customer.contract_end_date),
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

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvitations(data || [])
    } catch (error) {
      console.error('Error fetching invitations:', error)
    }
  }

  const calculateMonthsLeft = (startDate: string | null, endDate: string | null): number | null => {
    if (!endDate) return null
    
    const end = new Date(endDate)
    const now = new Date()
    const monthsLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
    
    return Math.max(0, monthsLeft)
  }

  const calculateStats = (customerData: Customer[]) => {
    const activeCustomers = customerData.filter(c => c.is_active)
    
    // Använd annual_value för årligt kontraktsvärde
    const totalAnnualRevenue = activeCustomers.reduce((sum, customer) => {
      return sum + (customer.annual_value || 0)
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
        (customer.contact_person?.toLowerCase().includes(searchLower) || false) ||
        customer.contact_email.toLowerCase().includes(searchLower) ||
        (customer.organization_number?.toLowerCase().includes(searchLower) || false)
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

    // Lägg till inbjudningsstatus
    const enrichedFiltered = filtered.map(customer => {
      const invitation = invitations.find(inv => inv.customer_id === customer.id)
      return {
        ...customer,
        hasInvitation: !!invitation,
        invitationStatus: getInvitationStatus(invitation),
        lastInvitationDate: invitation?.created_at || null
      }
    })

    setFilteredCustomers(enrichedFiltered)
  }

  const getInvitationStatus = (invitation: CustomerInvitation | undefined): 'pending' | 'accepted' | 'expired' | 'none' => {
    if (!invitation) return 'none'
    if (invitation.accepted_at) return 'accepted'
    
    const expiresAt = new Date(invitation.expires_at)
    const now = new Date()
    if (expiresAt < now) return 'expired'
    
    return 'pending'
  }

  const handleSendInvitation = async (customer: Customer) => {
    setSendingInvitation(customer.id)
    try {
      const response = await fetch('/api/send-customer-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          email: customer.contact_email,
          contactPerson: customer.contact_person,
          companyName: customer.company_name
        })
      })

      if (!response.ok) {
        throw new Error('Kunde inte skicka inbjudan')
      }

      const result = await response.json()
      toast.success(`Inbjudan skickad till ${customer.contact_person}`)
      await fetchInvitations() // Uppdatera inbjudningsstatus
      
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Kunde inte skicka inbjudan')
    } finally {
      setSendingInvitation(null)
    }
  }

  // NYTT: Återkalla inbjudan
  const handleRevokeInvitation = async (customer: Customer, reason: string = 'admin_action') => {
    if (!window.confirm(`Är du säker på att du vill återkalla inbjudan för ${customer.contact_person}?`)) {
      return
    }

    setRevokingInvitation(customer.id)
    try {
      const response = await fetch('/api/revoke-invitation', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          email: customer.contact_email,
          reason,
          sendNotification: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunde inte återkalla inbjudan')
      }

      toast.success('Inbjudan återkallad')
      await fetchInvitations() // Uppdatera status
      
    } catch (error: any) {
      console.error('Error revoking invitation:', error)
      toast.error(error.message || 'Kunde inte återkalla inbjudan')
    } finally {
      setRevokingInvitation(null)
    }
  }

  // NYTT: Skapa ClickUp lista manuellt
  const handleCreateClickUpList = async (customer: Customer) => {
    if (!customer.contract_type) {
      toast.error('Kunden saknar avtalstyp - kan inte skapa ClickUp lista')
      return
    }

    setCreatingClickUpList(customer.id)
    try {
      const response = await fetch('/api/create-clickup-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          companyName: customer.company_name,
          orgNumber: customer.organization_number,
          contractType: customer.contract_type
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunde inte skapa ClickUp lista')
      }

      const result = await response.json()
      toast.success(`ClickUp lista skapad: ${result.listName}`)
      await fetchCustomers() // Uppdatera kunddata med nya lista-ID
      
    } catch (error: any) {
      console.error('Error creating ClickUp list:', error)
      toast.error(error.message || 'Kunde inte skapa ClickUp lista')
    } finally {
      setCreatingClickUpList(null)
    }
  }

  // NYTT: Ta bort ClickUp lista
  const handleDeleteClickUpList = async (customer: Customer) => {
    if (!customer.clickup_list_id) {
      toast.error('Kunden har ingen ClickUp lista att ta bort')
      return
    }

    if (!window.confirm(`Är du säker på att du vill ta bort ClickUp listan "${customer.clickup_list_name}" för ${customer.company_name}? Alla ärenden i listan kommer att försvinna!`)) {
      return
    }

    setDeletingClickUpList(customer.id)
    try {
      const response = await fetch('/api/delete-clickup-list', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          listId: customer.clickup_list_id
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunde inte ta bort ClickUp lista')
      }

      toast.success('ClickUp lista borttagen')
      await fetchCustomers() // Uppdatera kunddata
      
    } catch (error: any) {
      console.error('Error deleting ClickUp list:', error)
      toast.error(error.message || 'Kunde inte ta bort ClickUp lista')
    } finally {
      setDeletingClickUpList(null)
    }
  }

  const handleToggleStatus = async (customerId: string, currentStatus: boolean | null) => {
    try {
      await customerService.toggleCustomerStatus(customerId, !currentStatus)
      
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const getInvitationBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Accepterad
        </span>
      case 'pending':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Väntar
        </span>
      case 'expired':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Utgången
        </span>
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20">
          Ingen inbjudan
        </span>
    }
  }

  const getContractStatusColor = (monthsLeft: number | null) => {
    if (monthsLeft === null) return 'text-slate-400'
    if (monthsLeft <= 3) return 'text-red-400'
    if (monthsLeft <= 6) return 'text-yellow-400'
    return 'text-green-400'
  }

  // NYTT: Visa ClickUp lista status
  const getClickUpListBadge = (customer: Customer) => {
    if (customer.clickup_list_id) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <ExternalLink className="w-3 h-3 mr-1" />
          Lista skapad
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20">
        Ingen lista
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => navigate('/admin/dashboard')} 
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> 
                  Tillbaka
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Kundhantering</h1>
                  <p className="text-slate-400 text-sm">Hantera alla dina kunder och deras avtal</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => navigate('/admin/dashboard')} 
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> 
                  Tillbaka
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Kundhantering</h1>
                  <p className="text-slate-400 text-sm">Hantera alla dina kunder och deras avtal</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Kunde inte hämta kunder</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <Button onClick={fetchData}>Försök igen</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - Economics Style */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Kundhantering</h1>
                <p className="text-slate-400 text-sm">Hantera alla dina kunder och deras avtal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={fetchData} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
              <Button 
                onClick={() => navigate('/admin/customers/new')}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Ny kund
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* KPI Panel */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Översikt</h2>
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
          </section>

          {/* Filter */}
          <section>
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
          </section>

          {/* Kundlista */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Kunder</h2>
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
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Företag</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Kontakt</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Avtal</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Inbjudan</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">ClickUp Lista</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center">
                                {customer.business_type && getBusinessTypeLabel(customer.business_type) ? 
                                  getBusinessTypeLabel(customer.business_type).charAt(0) : 
                                  <Building2 className="w-5 h-5 text-green-400" />
                                }
                              </div>
                              <div className="ml-3">
                                <p className="text-white font-medium">{customer.company_name}</p>
                                <p className="text-slate-400 text-sm">{customer.organization_number || 'Org.nr saknas'}</p>
                                {customer.business_type && (
                                  <p className="text-slate-500 text-xs">{getBusinessTypeLabel(customer.business_type)}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="text-white font-medium">{customer.contact_person || 'Kontakt saknas'}</p>
                              <p className="text-slate-400 text-sm">{customer.contact_email}</p>
                              <p className="text-slate-400 text-sm">{customer.contact_phone || 'Telefon saknas'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="text-white font-medium">
                                {(customer as any).annual_value ? formatCurrency((customer as any).annual_value) : 'Ej satt'}
                              </p>
                              <p className="text-slate-400 text-sm">
                                {customer.contract_type || 'Okänt avtal'}
                              </p>
                              {customer.monthsLeft !== null && (
                                <p className={`text-sm ${getContractStatusColor(customer.monthsLeft)}`}>
                                  {customer.monthsLeft > 0 ? `${customer.monthsLeft} mån kvar` : 'Utgånget'}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              {customer.is_active ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                                  <Power className="w-3 h-3 mr-1" />
                                  Aktiv
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                                  <PowerOff className="w-3 h-3 mr-1" />
                                  Inaktiv
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              {getInvitationBadge(customer.invitationStatus || 'none')}
                              {customer.lastInvitationDate && (
                                <p className="text-slate-500 text-xs mt-1">
                                  {formatDate(customer.lastInvitationDate)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              {getClickUpListBadge(customer)}
                              {customer.clickup_list_name && (
                                <p className="text-slate-500 text-xs mt-1">
                                  {customer.clickup_list_name}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              {/* Visa detaljer */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/admin/customers/${customer.id}`)}
                                className="p-2"
                                title="Visa detaljer"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {/* Inbjudningshantering */}
                              {customer.invitationStatus === 'pending' ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleRevokeInvitation(customer)}
                                  disabled={revokingInvitation === customer.id}
                                  className="p-2 text-red-400 hover:text-red-300"
                                  title="Återkalla inbjudan"
                                >
                                  {revokingInvitation === customer.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleSendInvitation(customer)}
                                  disabled={sendingInvitation === customer.id}
                                  className="p-2"
                                  title={customer.invitationStatus === 'none' ? 'Skicka inbjudan' : 'Skicka ny inbjudan'}
                                >
                                  {sendingInvitation === customer.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </Button>
                              )}

                              {/* ClickUp lista hantering */}
                              {customer.clickup_list_id ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDeleteClickUpList(customer)}
                                  disabled={deletingClickUpList === customer.id}
                                  className="p-2 text-orange-400 hover:text-orange-300"
                                  title="Ta bort ClickUp lista"
                                >
                                  {deletingClickUpList === customer.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                                  ) : (
                                    <FolderMinus className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleCreateClickUpList(customer)}
                                  disabled={creatingClickUpList === customer.id}
                                  className="p-2 text-blue-400 hover:text-blue-300"
                                  title="Skapa ClickUp lista"
                                >
                                  {creatingClickUpList === customer.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                                  ) : (
                                    <FolderPlus className="w-4 h-4" />
                                  )}
                                </Button>
                              )}

                              {/* Kontakt */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => window.open(`mailto:${customer.contact_email}`, '_blank')}
                                className="p-2"
                                title="Skicka e-post"
                              >
                                <Mail className="w-4 h-4" />
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => window.open(`tel:${customer.contact_phone}`, '_blank')}
                                className="p-2"
                                title="Ring"
                              >
                                <Phone className="w-4 h-4" />
                              </Button>

                              {/* Admin funktioner */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleToggleStatus(customer.id, customer.is_active)}
                                className="p-2"
                                title={customer.is_active ? 'Inaktivera' : 'Aktivera'}
                              >
                                {customer.is_active ? (
                                  <PowerOff className="w-4 h-4" />
                                ) : (
                                  <Power className="w-4 h-4" />
                                )}
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDeleteCustomer(customer.id)}
                                className="p-2 text-red-400 hover:text-red-300"
                                title="Ta bort kund"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
        </div>
      </main>

      {/* Footer - Economics Style */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center gap-4">
              <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
              <div className="h-1 w-1 bg-slate-600 rounded-full"></div>
              <span>Realtidsdata från Supabase</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>System operationellt</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
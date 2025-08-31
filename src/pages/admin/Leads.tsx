// src/pages/admin/Leads.tsx - Lead Pipeline Management Page

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Target, 
  Plus, 
  Search, 
  Filter,
  TrendingUp,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Flame,
  Star,
  DollarSign,
  BarChart3,
  Tag,
  Edit3,
  Eye,
  MessageSquare,
  ChevronDown,
  Activity,
  Building,
  Hash,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { toast } from 'react-hot-toast'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { PageHeader } from '../../components/shared'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import StaggeredGrid from '../../components/shared/StaggeredGrid'

import { 
  Lead, 
  LeadStatus, 
  LEAD_STATUS_DISPLAY, 
  CONTACT_METHOD_DISPLAY,
  COMPANY_SIZE_DISPLAY,
  calculateLeadScore,
  getLeadQuality,
  getPriorityLabel,
  getPriorityColor
} from '../../types/database'
import CreateLeadModal from '../../components/admin/leads/CreateLeadModal'
import LeadDetailModal from '../../components/admin/leads/LeadDetailModal'
import EditLeadModal from '../../components/admin/leads/EditLeadModal'

interface LeadStats {
  totalLeads: number
  hotLeads: number
  warmLeads: number
  coldLeads: number
  dealsWon: number
  conversionRate: number
  totalEstimatedValue: number
  avgLeadScore: number
}

const Leads: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [technicians, setTechnicians] = useState<{[key: string]: string}>({})
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchLeads()
    fetchTechnicians()
    
    // Set up optimized real-time subscription for leads
    const subscription = supabase
      .channel('leads_realtime')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'leads'
        },
        (payload) => {
          // For new leads, refresh the entire list
          setTimeout(() => {
            fetchLeads()
          }, 500)
        }
      )
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'leads'
        },
        (payload) => {
          // For updates, try optimistic update first, then sync
          if (payload.new && payload.old) {
            const updatedLead = payload.new as Lead
            optimisticUpdateLead(updatedLead.id, updatedLead)
            
            // Also sync full data after a short delay for consistency
            setTimeout(() => {
              fetchLeads()
            }, 2000)
          }
        }
      )
      .on('postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'leads'
        },
        (payload) => {
          // For deletes, remove immediately and refresh
          if (payload.old) {
            const deletedLead = payload.old as Lead
            setLeads(prev => prev.filter(lead => lead.id !== deletedLead.id))
          }
          setTimeout(() => {
            fetchLeads()
          }, 500)
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_technicians'
        },
        (payload) => {
          // Refresh leads when technician assignments change
          setTimeout(() => {
            fetchLeads()
          }, 500)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyFilters()
  }, [leads, searchTerm, statusFilter, sortField, sortDirection])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          created_by_profile:profiles!leads_created_by_fkey(display_name, email),
          updated_by_profile:profiles!leads_updated_by_fkey(display_name, email),
          lead_technicians(
            id,
            is_primary,
            assigned_at,
            technicians:technician_id(
              id,
              name,
              email
            )
          ),
          lead_comments(count),
          lead_events(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setLeads(data || [])
      calculateStats(data || [])
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid hämtning av leads')
      toast.error('Kunde inte ladda leads')
    } finally {
      setLoading(false)
    }
  }

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name')
        .eq('is_active', true)

      if (error) throw error

      const techMap: {[key: string]: string} = {}
      data.forEach(tech => {
        techMap[tech.id] = tech.name
      })
      setTechnicians(techMap)
    } catch (err) {
      console.error('Error fetching technicians:', err)
    }
  }

  const calculateStats = (leadsData: Lead[]) => {
    const totalLeads = leadsData.length
    
    // More accurate hot leads calculation - include both hot leads AND deals
    const hotLeads = leadsData.filter(lead => 
      lead.status === 'orange_hot' || lead.status === 'green_deal'
    ).length
    
    const warmLeads = leadsData.filter(lead => lead.status === 'yellow_warm').length
    const coldLeads = leadsData.filter(lead => lead.status === 'blue_cold').length
    const dealsWon = leadsData.filter(lead => lead.status === 'green_deal').length
    
    // More accurate conversion rate calculation
    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0
    
    // Calculate total estimated value - only from active leads (not lost)
    const totalEstimatedValue = leadsData
      .filter(lead => lead.status !== 'red_lost')
      .reduce((sum, lead) => {
        return sum + (lead.estimated_value || 0)
      }, 0)
    
    // Calculate average lead score
    const leadScores = leadsData.map(lead => calculateLeadScore(lead))
    const avgLeadScore = leadScores.length > 0 ? Math.round(leadScores.reduce((a, b) => a + b, 0) / leadScores.length) : 0

    setStats({
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      dealsWon,
      conversionRate,
      totalEstimatedValue,
      avgLeadScore
    })
  }

  const applyFilters = () => {
    let filtered = leads

    // Sökfilter
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.organization_number && lead.organization_number.includes(searchTerm))
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    // Sortering
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortField) {
          case 'lead_score':
            aValue = calculateLeadScore(a)
            bValue = calculateLeadScore(b)
            break
          case 'company_name':
            aValue = a.company_name?.toLowerCase() || ''
            bValue = b.company_name?.toLowerCase() || ''
            break
          case 'status':
            aValue = a.status || ''
            bValue = b.status || ''
            break
          case 'priority':
            // Priority order: high=3, medium=2, low=1, null=0
            const priorityValues = { high: 3, medium: 2, low: 1 }
            aValue = priorityValues[a.priority as keyof typeof priorityValues] || 0
            bValue = priorityValues[b.priority as keyof typeof priorityValues] || 0
            break
          case 'estimated_value':
            aValue = a.estimated_value || 0
            bValue = b.estimated_value || 0
            break
          case 'activity':
            // Sort by total activity (comments + events)
            aValue = (a.lead_comments?.[0]?.count || 0) + (a.lead_events?.[0]?.count || 0)
            bValue = (b.lead_comments?.[0]?.count || 0) + (b.lead_events?.[0]?.count || 0)
            break
          case 'updated_at':
            aValue = new Date(a.updated_at).getTime()
            bValue = new Date(b.updated_at).getTime()
            break
          case 'comments_count':
            aValue = a.lead_comments?.length || 0
            bValue = b.lead_comments?.length || 0
            break
          case 'events_count':
            aValue = a.lead_events?.length || 0
            bValue = b.lead_events?.length || 0
            break
          default:
            return 0
        }

        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
        }
      })
    }

    setFilteredLeads(filtered)
  }

  const getStatusBadge = (status: LeadStatus) => {
    const config = LEAD_STATUS_DISPLAY[status]
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${config.color}/10 text-${config.color} border border-${config.color}/20`}>
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('sv-SE').format(value)
  }

  const toggleExpandRow = (leadId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(leadId)) {
        newSet.delete(leadId)
      } else {
        newSet.add(leadId)
      }
      return newSet
    })
  }

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead)
    setShowDetailModal(true)
  }

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead)
    setShowEditModal(true)
  }

  // Optimistic update for better UX
  const optimisticUpdateLead = (leadId: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { ...lead, ...updates, updated_at: new Date().toISOString() }
        : lead
    ))
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to desc
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-purple-400" />
      : <ArrowDown className="w-4 h-4 text-purple-400" />
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-purple-500/5" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader title="Lead Pipeline" />
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader title="Lead Pipeline" />
          <Card className="p-8 backdrop-blur-sm bg-slate-800/70 border-slate-700/50">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Fel vid laddning</h3>
              <p className="text-slate-400 mb-6">{error}</p>
              <Button onClick={fetchLeads}>Försök igen</Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-purple-500/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Lead Pipeline" 
          description="Hantera potentiella kunder och lead-processen"
        />

        {/* KPI Cards */}
        <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <EnhancedKpiCard
            title="Totala Leads"
            value={stats?.totalLeads || 0}
            icon={Users}
            trend="neutral"
            delay={0}
            onClick={() => setStatusFilter('all')}
            className={`cursor-pointer hover:scale-105 transition-transform ${statusFilter === 'all' ? 'ring-2 ring-purple-500' : ''}`}
          />
          
          <EnhancedKpiCard
            title="Heta Leads"
            value={stats?.hotLeads || 0}
            icon={Flame}
            trend="up"
            trendValue={`av ${stats?.totalLeads || 0}`}
            delay={0.1}
            onClick={() => setStatusFilter('orange_hot')}
            className={`cursor-pointer hover:scale-105 transition-transform ${statusFilter === 'orange_hot' ? 'ring-2 ring-orange-500' : ''}`}
          />
          
          <EnhancedKpiCard
            title="Uppskattat värde"
            value={stats?.totalEstimatedValue ? formatNumber(Math.round(stats.totalEstimatedValue / 1000)) : 0}
            suffix="k SEK"
            icon={DollarSign}
            trend={stats?.totalEstimatedValue > 500000 ? "up" : "neutral"}
            trendValue={stats?.totalEstimatedValue ? formatCurrency(stats.totalEstimatedValue) : '0 SEK'}
            delay={0.2}
            onClick={() => setStatusFilter('green_deal')}
            className={`cursor-pointer hover:scale-105 transition-transform ${statusFilter === 'green_deal' ? 'ring-2 ring-green-500' : ''}`}
          />
          
          <EnhancedKpiCard
            title="Avg Lead Score"
            value={stats?.avgLeadScore || 0}
            suffix="/100"
            icon={BarChart3}
            trend={stats?.avgLeadScore > 60 ? "up" : stats?.avgLeadScore > 30 ? "neutral" : "down"}
            trendValue={`${stats?.avgLeadScore || 0} poäng`}
            delay={0.3}
            onClick={() => setStatusFilter('all')}
            className={`cursor-pointer hover:scale-105 transition-transform ${statusFilter === 'all' ? 'ring-2 ring-purple-500' : ''}`}
          />
        </StaggeredGrid>

        {/* Controls */}
        <Card className="p-6 mb-8 backdrop-blur-sm bg-slate-800/70 border-slate-700/50">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Sök företag, kontaktperson, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
                  className="pl-10 pr-8 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="all">Alla status</option>
                  <option value="green_deal">Affär</option>
                  <option value="orange_hot">Het</option>
                  <option value="yellow_warm">Ljummen</option>
                  <option value="blue_cold">Kall</option>
                  <option value="red_lost">Tappad</option>
                </select>
              </div>
            </div>

            {/* Add Lead Button */}
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Skapa Lead
            </Button>
          </div>
        </Card>

        {/* Leads Table */}
        <Card className="backdrop-blur-sm bg-slate-800/70 border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <Target className="w-6 h-6 text-purple-400" />
              Leads ({filteredLeads.length})
            </h3>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'Inga leads matchar filtren' : 'Inga leads än'}
              </h3>
              <p className="text-slate-400 mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Prova att justera dina sökkriterier'
                  : 'Skapa din första lead för att komma igång'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Skapa din första lead
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th 
                      className="text-left p-4 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors w-48"
                      onClick={() => handleSort('company_name')}
                    >
                      <div className="flex items-center gap-2">
                        Företag
                        {getSortIcon('company_name')}
                      </div>
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-slate-300 w-40">Kontakt</th>
                    <th 
                      className="text-left p-3 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors w-24"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors hidden lg:table-cell w-20"
                      onClick={() => handleSort('priority')}
                    >
                      <div className="flex items-center gap-2">
                        Prioritet
                        {getSortIcon('priority')}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors w-24"
                      onClick={() => handleSort('lead_score')}
                      title={`Lead Score Kalkyl (0-100 poäng):

📊 STATUS (grundpoäng):
• Förlorad: 0p (automatiskt)
• Kall: 30p 
• Ljummen: 40p
• Het: 50p
• Affär: 100p (automatiskt)

🎯 BANT-KRITERIER (0-30p):
• Budget bekräftad: +7.5p
• Befogenhet bekräftad: +7.5p  
• Behov bekräftat: +7.5p
• Tidslinje bekräftad: +7.5p

🎲 SANNOLIKHET (modifierare):
• 0-20%: -20p
• 21-40%: -10p
• 41-60%: 0p (neutral)
• 61-80%: +10p  
• 81-100%: +20p

🏆 KVALITET:
80-100p: Utmärkt | 60-79p: Bra | 40-59p: Medel | 20-39p: Svag | 0-19p: Mycket svag`}
                    >
                      <div className="flex items-center gap-2">
                        Lead Score
                        {getSortIcon('lead_score')}
                      </div>
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-slate-300 w-36">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-400" />
                        Tilldelade kollegor
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors w-28"
                      onClick={() => handleSort('estimated_value')}
                    >
                      <div className="flex items-center gap-2">
                        Värde
                        {getSortIcon('estimated_value')}
                      </div>
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors w-28"
                      onClick={() => handleSort('updated_at')}
                    >
                      <div className="flex items-center gap-2">
                        Uppdaterad
                        {getSortIcon('updated_at')}
                      </div>
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-slate-300 w-20">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredLeads.map((lead, index) => (
                    <React.Fragment key={lead.id}>
                      <tr 
                        className={`hover:bg-slate-800/30 transition-colors ${
                          lead.priority === 'high' ? 'border-l-4 border-l-red-400' :
                          lead.priority === 'medium' ? 'border-l-4 border-l-yellow-400' :
                          lead.priority === 'low' ? 'border-l-4 border-l-green-400' : ''
                        }`}
                      >
                      <td className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{lead.company_name}</div>
                            {lead.organization_number && (
                              <div className="text-xs text-slate-400">{lead.organization_number}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleExpandRow(lead.id)}
                            className="text-slate-400 hover:text-white p-1 ml-2"
                            title="Visa mer information"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform ${
                              expandedRows.has(lead.id) ? 'rotate-180' : ''
                            }`} />
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-white">{lead.contact_person}</span>
                          </div>
                          
                          {expandedRows.has(lead.id) && (
                            <div className="space-y-1 text-sm text-slate-400">
                              {lead.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3 h-3" />
                                  <a href={`mailto:${lead.email}`} className="hover:text-white">
                                    {lead.email}
                                  </a>
                                </div>
                              )}
                              {lead.phone_number && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3" />
                                  <a href={`tel:${lead.phone_number}`} className="hover:text-white">
                                    {lead.phone_number}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Activity indicators */}
                          <div className="flex items-center gap-2 text-xs">
                            {lead.tags && lead.tags.length > 0 && (
                              <span className="flex items-center gap-1 text-green-400">
                                <Tag className="w-3 h-3" />
                                {lead.tags.length}
                              </span>
                            )}
                            {/* Add more activity indicators here based on available data */}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {lead.priority ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getPriorityColor(lead.priority)}/10 text-${getPriorityColor(lead.priority)} border border-${getPriorityColor(lead.priority)}/20`}>
                            <Star className="w-3 h-3 mr-1" />
                            {getPriorityLabel(lead.priority)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          <div className="font-mono text-lg font-bold text-white">
                            {calculateLeadScore(lead)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {getLeadQuality(calculateLeadScore(lead)).label}
                          </div>
                        </div>
                      </td>
                      {/* Tilldelade kollegor Column */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {lead.lead_technicians && lead.lead_technicians.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {lead.lead_technicians.slice(0, 2).map((assignment, idx) => (
                                <div key={assignment.id} className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${
                                    assignment.is_primary ? 'bg-yellow-400' : 'bg-green-400'
                                  }`}></div>
                                  <span className="text-white text-xs">
                                    {assignment.technicians?.name}
                                  </span>
                                  {idx < Math.min(lead.lead_technicians.length - 1, 1) && (
                                    <span className="text-slate-500">,</span>
                                  )}
                                </div>
                              ))}
                              {lead.lead_technicians.length > 2 && (
                                <span className="text-slate-400 text-xs">+{lead.lead_technicians.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Ej tilldelad</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {lead.estimated_value ? (
                          <div className="text-sm">
                            <div className="text-white font-mono">{formatCurrency(lead.estimated_value)}</div>
                            {lead.probability && (
                              <div className="text-slate-400 text-xs">{lead.probability}%</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-white" 
                             title={`${formatDate(lead.updated_at)} av ${lead.updated_by_profile?.display_name || 
                                     lead.updated_by_profile?.email || 
                                     'Okänd användare'}`}>
                          {new Date(lead.updated_at).toLocaleDateString('sv-SE', { 
                            year: 'numeric',
                            month: '2-digit', 
                            day: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditLead(lead)}
                            className="text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-200 p-2 rounded-md group"
                            title="Redigera lead"
                          >
                            <Edit3 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewLead(lead)}
                            className="text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 transition-all duration-200 p-2 rounded-md group"
                            title="Visa detaljer"
                          >
                            <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanderbar rad för intern information */}
                    {expandedRows.has(lead.id) && (
                      <tr className="bg-slate-800/30">
                        <td colSpan={9} className="p-4 border-l-2 border-l-purple-400">
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                            {/* Leverantör/Affärsinfo sektion */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Building className="w-4 h-4 text-blue-400" />
                                Affärsinformation
                              </h4>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-slate-400 text-xs">Nuvarande Leverantör:</span>
                                  <div className="text-white text-sm">
                                    {lead.contract_with || 'Ingen registrerad'}
                                  </div>
                                </div>
                                {lead.contract_expires && (
                                  <div>
                                    <span className="text-slate-400 text-xs">Avtal löper ut:</span>
                                    <div className="text-white text-sm">
                                      {new Date(lead.contract_expires).toLocaleDateString('sv-SE')}
                                    </div>
                                  </div>
                                )}
                                {lead.company_size && (
                                  <div>
                                    <span className="text-slate-400 text-xs">Företagsstorlek:</span>
                                    <div className="text-white text-sm">
                                      {COMPANY_SIZE_DISPLAY[lead.company_size]?.label || lead.company_size}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Aktivitetsdetaljer sektion */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Activity className="w-4 h-4 text-purple-400" />
                                Aktivitetssammanfattning
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-400 text-xs">Kommentarer:</span>
                                  <span className="text-white text-sm font-medium">
                                    {lead.lead_comments?.[0]?.count || 0}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400 text-xs">Händelser:</span>
                                  <span className="text-white text-sm font-medium">
                                    {lead.lead_events?.[0]?.count || 0}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400 text-xs">Skapad:</span>
                                  <span className="text-white text-sm">
                                    {new Date(lead.created_at).toLocaleDateString('sv-SE')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400 text-xs">Senast uppdaterad:</span>
                                  <span className="text-white text-sm">
                                    {formatDate(lead.updated_at)}
                                  </span>
                                </div>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modals */}
        <CreateLeadModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchLeads}
        />

        <LeadDetailModal
          lead={selectedLead}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedLead(null)
          }}
          onSuccess={async () => {
            // Uppdatera lead-listan
            await fetchLeads()
            
            // Uppdatera selectedLead med nya data från listan
            if (selectedLead?.id) {
              // Hämta uppdaterade lead-data direkt från databasen för att säkerställa att vi har senaste versionen
              try {
                const { data: updatedLead, error } = await supabase
                  .from('leads')
                  .select(`
                    *,
                    created_by_profile:profiles!leads_created_by_fkey(display_name, email),
                    updated_by_profile:profiles!leads_updated_by_fkey(display_name, email)
                  `)
                  .eq('id', selectedLead.id)
                  .single()
                
                if (!error && updatedLead) {
                  setSelectedLead(updatedLead)
                }
              } catch (err) {
                console.error('Failed to refresh selected lead:', err)
              }
            }
          }}
        />

        <EditLeadModal
          lead={selectedLead}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedLead(null)
          }}
          onSuccess={async () => {
            // Optimistic update för bättre UX
            if (selectedLead?.id) {
              optimisticUpdateLead(selectedLead.id, { updated_at: new Date().toISOString() })
            }
            
            setShowEditModal(false)
            
            // Uppdatera lead-listan
            await fetchLeads()
            
            // Uppdatera selectedLead med nya data 
            if (selectedLead?.id) {
              try {
                const { data: updatedLead, error } = await supabase
                  .from('leads')
                  .select(`
                    *,
                    created_by_profile:profiles!leads_created_by_fkey(display_name, email),
                    updated_by_profile:profiles!leads_updated_by_fkey(display_name, email)
                  `)
                  .eq('id', selectedLead.id)
                  .single()
                
                if (!error && updatedLead) {
                  setSelectedLead(updatedLead)
                }
              } catch (err) {
                console.error('Failed to refresh selected lead:', err)
              }
            }
          }}
        />
      </div>
    </div>
  )
}

export default Leads
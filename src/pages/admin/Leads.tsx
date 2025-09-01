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
  User,
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
  LeadPriority,
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
import LeadFilterPanel, { LeadFilters } from '../../components/admin/leads/LeadFilterPanel'

interface LeadStats {
  totalLeads: number
  myActiveLeads: number
  leadsThisWeek: number
  followUpsToday: number
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
  // Load filters from localStorage or use defaults
  const [filters, setFilters] = useState<LeadFilters>(() => {
    const saved = localStorage.getItem('leadFilters')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.warn('Failed to parse saved filters:', e)
      }
    }
    return {
      search: '',
      status: 'all',
      priority: 'all',
      assignedTo: 'all',
      createdBy: 'all',
      companySize: 'all',
      contactMethod: 'all',
      source: 'all',
      estimatedValueMin: null,
      estimatedValueMax: null,
      dateRange: 'all',
      customStartDate: '',
      customEndDate: '',
      followUpToday: false,
      hasEstimatedValue: 'all'
    }
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(() => {
    const saved = localStorage.getItem('showAdvancedLeadFilters')
    return saved ? JSON.parse(saved) : false
  })
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
  }, [leads, filters, sortField, sortDirection])

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
    
    // My active leads (assigned to current user and not lost/closed)
    const myActiveLeads = leadsData.filter(lead => 
      lead.assigned_to === user?.id && lead.status !== 'red_lost'
    ).length
    
    // Leads created this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const leadsThisWeek = leadsData.filter(lead => {
      const createdDate = new Date(lead.created_at)
      return createdDate >= weekStart
    }).length
    
    // Follow-ups due today
    const today = new Date().toISOString().split('T')[0]
    const followUpsToday = leadsData.filter(lead => 
      lead.follow_up_date && lead.follow_up_date.startsWith(today)
    ).length
    
    // Conversion rate (deals / total leads)
    const dealsWon = leadsData.filter(lead => lead.status === 'green_deal').length
    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0
    
    // Calculate total estimated value - only from active leads (not lost)
    const totalEstimatedValue = leadsData
      .filter(lead => lead.status !== 'red_lost' && lead.estimated_value)
      .reduce((sum, lead) => {
        return sum + (lead.estimated_value || 0)
      }, 0)
    
    // Calculate average lead score
    const leadScores = leadsData.map(lead => calculateLeadScore(lead))
    const avgLeadScore = leadScores.length > 0 ? Math.round(leadScores.reduce((a, b) => a + b, 0) / leadScores.length) : 0

    setStats({
      totalLeads,
      myActiveLeads,
      leadsThisWeek,
      followUpsToday,
      conversionRate,
      totalEstimatedValue,
      avgLeadScore
    })
  }

  const applyFilters = () => {
    let filtered = leads

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(lead =>
        lead.company_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        lead.contact_person.toLowerCase().includes(filters.search.toLowerCase()) ||
        lead.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        (lead.organization_number && lead.organization_number.includes(filters.search))
      )
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(lead => lead.status === filters.status)
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(lead => lead.priority === filters.priority)
    }

    // Assigned to filter
    if (filters.assignedTo !== 'all') {
      if (filters.assignedTo === 'me') {
        filtered = filtered.filter(lead => lead.assigned_to === user?.id)
      } else if (filters.assignedTo === 'unassigned') {
        filtered = filtered.filter(lead => !lead.assigned_to)
      }
    }

    // Created by filter
    if (filters.createdBy !== 'all') {
      if (filters.createdBy === 'me') {
        filtered = filtered.filter(lead => lead.created_by === user?.id)
      }
    }

    // Company size filter
    if (filters.companySize !== 'all') {
      filtered = filtered.filter(lead => lead.company_size === filters.companySize)
    }

    // Contact method filter
    if (filters.contactMethod !== 'all') {
      filtered = filtered.filter(lead => lead.contact_method === filters.contactMethod)
    }

    // Source filter
    if (filters.source !== 'all' && filters.source) {
      filtered = filtered.filter(lead => 
        lead.source && lead.source.toLowerCase().includes(filters.source.toLowerCase())
      )
    }

    // Estimated value range
    if (filters.estimatedValueMin !== null) {
      filtered = filtered.filter(lead => 
        lead.estimated_value && lead.estimated_value >= filters.estimatedValueMin!
      )
    }
    if (filters.estimatedValueMax !== null) {
      filtered = filtered.filter(lead => 
        lead.estimated_value && lead.estimated_value <= filters.estimatedValueMax!
      )
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      let startDate: Date
      
      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'custom':
          if (filters.customStartDate) {
            startDate = new Date(filters.customStartDate)
            const endDate = filters.customEndDate ? new Date(filters.customEndDate) : now
            filtered = filtered.filter(lead => {
              const leadDate = new Date(lead.created_at)
              return leadDate >= startDate && leadDate <= endDate
            })
          }
          break
        default:
          startDate = new Date(0)
      }
      
      if (filters.dateRange !== 'custom') {
        filtered = filtered.filter(lead => {
          const leadDate = new Date(lead.created_at)
          return leadDate >= startDate
        })
      }
    }

    // Follow-up today filter
    if (filters.followUpToday) {
      const today = new Date().toISOString().split('T')[0]
      filtered = filtered.filter(lead => 
        lead.follow_up_date && lead.follow_up_date.startsWith(today)
      )
    }

    // Has estimated value filter
    if (filters.hasEstimatedValue !== 'all') {
      filtered = filtered.filter(lead => 
        filters.hasEstimatedValue ? lead.estimated_value && lead.estimated_value > 0 : !lead.estimated_value
      )
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
          case 'closing_date_estimate':
            aValue = a.closing_date_estimate ? new Date(a.closing_date_estimate).getTime() : 0
            bValue = b.closing_date_estimate ? new Date(b.closing_date_estimate).getTime() : 0
            break
          case 'follow_up_date':
            aValue = a.follow_up_date ? new Date(a.follow_up_date).getTime() : 0
            bValue = b.follow_up_date ? new Date(b.follow_up_date).getTime() : 0
            break
          case 'deal_velocity':
            // Sort by lead age (days since created)
            aValue = Math.floor((new Date().getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
            bValue = Math.floor((new Date().getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24))
            break
          case 'activity_pulse':
            // Sort by days since last activity (updated_at)
            aValue = Math.floor((new Date().getTime() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24))
            bValue = Math.floor((new Date().getTime() - new Date(b.updated_at).getTime()) / (1000 * 60 * 60 * 24))
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

  // Filter helper functions
  const handleFiltersChange = (newFilters: LeadFilters) => {
    setFilters(newFilters)
    localStorage.setItem('leadFilters', JSON.stringify(newFilters))
  }

  const handleFiltersReset = () => {
    const defaultFilters = {
      search: '',
      status: 'all',
      priority: 'all',
      assignedTo: 'all',
      createdBy: 'all',
      companySize: 'all',
      contactMethod: 'all',
      source: 'all',
      estimatedValueMin: null,
      estimatedValueMax: null,
      dateRange: 'all',
      customStartDate: '',
      customEndDate: '',
      followUpToday: false,
      hasEstimatedValue: 'all'
    } as LeadFilters
    setFilters(defaultFilters)
    localStorage.setItem('leadFilters', JSON.stringify(defaultFilters))
    setShowAdvancedFilters(false)
    localStorage.setItem('showAdvancedLeadFilters', 'false')
  }

  // Save advanced filters toggle state
  const handleAdvancedFiltersToggle = () => {
    const newState = !showAdvancedFilters
    setShowAdvancedFilters(newState)
    localStorage.setItem('showAdvancedLeadFilters', JSON.stringify(newState))
  }

  const getStatusBadge = (status: LeadStatus) => {
    const config = LEAD_STATUS_DISPLAY[status]
    return (
      <div className="flex items-center gap-2" title={config.label}>
        <div className={`w-3 h-3 rounded-full bg-${config.color}`} />
        <span className={`text-sm font-medium text-${config.color}`}>
          {config.label}
        </span>
      </div>
    )
  }

  const getPriorityIndicator = (priority: LeadPriority | null) => {
    if (!priority) {
      return (
        <span className="text-sm text-slate-400" title="Ej angiven">
          Ej angiven
        </span>
      )
    }

    const config = getPriorityColor(priority)
    const label = getPriorityLabel(priority)
    
    // Get priority color classes based on priority level
    const getPriorityDisplay = () => {
      switch (priority) {
        case 'urgent':
          return { color: 'text-red-400', label }
        case 'high':
          return { color: 'text-orange-400', label }
        case 'medium':
          return { color: 'text-yellow-400', label }
        case 'low':
          return { color: 'text-green-400', label }
        default:
          return { color: 'text-slate-400', label }
      }
    }

    const display = getPriorityDisplay()
    return (
      <div className="flex items-center justify-center" title={display.label}>
        <span className={`text-sm font-medium ${display.color}`}>
          {display.label}
        </span>
      </div>
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
    <div className="space-y-6">
        <PageHeader 
          title="Lead Pipeline" 
          description="Hantera potentiella kunder och lead-processen"
          showBackButton={true}
          backPath="/admin/dashboard"
        />

        {/* KPI Cards */}
        <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <EnhancedKpiCard
            title="Mina aktiva leads"
            value={stats?.myActiveLeads || 0}
            icon={User}
            trend="neutral"
            trendValue={`av ${stats?.totalLeads || 0} totalt`}
            delay={0}
            onClick={() => setFilters(prev => ({ ...prev, assignedTo: 'me', status: 'all' }))}
            className="cursor-pointer hover:scale-105 transition-transform"
          />
          
          <EnhancedKpiCard
            title="Leads denna vecka"
            value={stats?.leadsThisWeek || 0}
            icon={Calendar}
            trend="up"
            trendValue="nya leads"
            delay={0.1}
            onClick={() => setFilters(prev => ({ ...prev, dateRange: 'week' }))}
            className="cursor-pointer hover:scale-105 transition-transform"
          />
          
          <EnhancedKpiCard
            title="Uppföljningar idag"
            value={stats?.followUpsToday || 0}
            icon={Target}
            trend={stats?.followUpsToday > 0 ? "up" : "neutral"}
            trendValue="att genomföra"
            delay={0.2}
            onClick={() => setFilters(prev => ({ ...prev, followUpToday: true }))}
            className="cursor-pointer hover:scale-105 transition-transform"
          />
          
          <EnhancedKpiCard
            title="Konverteringsgrad"
            value={stats?.conversionRate || 0}
            suffix="%"
            icon={TrendingUp}
            trend={stats?.conversionRate > 10 ? "up" : stats?.conversionRate > 5 ? "neutral" : "down"}
            trendValue="affärsavslut"
            delay={0.3}
            onClick={() => setFilters(prev => ({ ...prev, status: 'green_deal' }))}
            className="cursor-pointer hover:scale-105 transition-transform"
          />
        </StaggeredGrid>

        {/* Filter Panel */}
        <LeadFilterPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleFiltersReset}
          isOpen={showAdvancedFilters}
          onToggle={handleAdvancedFiltersToggle}
          resultCount={filteredLeads.length}
        />

        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={() => navigate('/admin/leads/analytics')}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500"
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            Analysera Leads
          </Button>
          
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nytt Lead
          </Button>
        </div>

        {/* Leads Table */}
        <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/70 border-b border-slate-600">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('company_name')}>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-400" />
                      Lead & Kontakt
                      {getSortIcon('company_name')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-400" />
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden lg:table-cell" onClick={() => handleSort('priority')}>
                    <div className="flex items-center justify-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      Prioritet
                      {getSortIcon('priority')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-400" />
                      Tilldelad
                    </div>
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('estimated_value')}>
                    <div className="flex items-center justify-end gap-2">
                      <DollarSign className="w-4 h-4 text-yellow-400" />
                      Estimerat Värde
                      {getSortIcon('estimated_value')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('lead_score')}>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      Lead Score
                      {getSortIcon('lead_score')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('closing_date_estimate')}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      Uppskattad deadline
                      {getSortIcon('closing_date_estimate')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('deal_velocity')}>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      Deal Velocity
                      {getSortIcon('deal_velocity')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('activity_pulse')}>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      Activity Pulse
                      {getSortIcon('activity_pulse')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('updated_at')}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Senast Uppdaterad
                      {getSortIcon('updated_at')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden sm:table-cell" onClick={() => handleSort('follow_up_date')}>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      Nästa Aktivitet
                      {getSortIcon('follow_up_date')}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-2">
                      <Edit3 className="w-4 h-4 text-slate-400" />
                      Åtgärder
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, index) => {
                  const isExpanded = expandedRows.has(lead.id)
                  return (
                    <React.Fragment key={lead.id}>
                      {/* Main lead row */}
                      <tr className={`hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 ${
                        lead.priority === 'urgent' ? 'border-l-4 border-l-red-500' :
                        lead.priority === 'high' ? 'border-l-4 border-l-orange-400' :
                        lead.priority === 'medium' ? 'border-l-4 border-l-yellow-400' :
                        lead.priority === 'low' ? 'border-l-4 border-l-green-400' : ''
                      }`}>
                        {/* Lead & Kontakt */}
                        <td className="px-4 py-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold text-white">{lead.company_name}</div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleExpandRow(lead.id)}
                                    className="text-slate-400 hover:text-white p-1"
                                    title="Visa mer information"
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`} />
                                  </Button>
                                </div>
                                {lead.organization_number && (
                                  <div className="text-xs text-slate-400 font-mono">{lead.organization_number}</div>
                                )}
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm text-white">{lead.contact_person}</span>
                                </div>
                                <div className="space-y-1 text-xs text-slate-400">
                                  {lead.email && (
                                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-blue-400 transition-colors duration-200">
                                      <Mail className="w-3 h-3" />
                                      {lead.email}
                                    </a>
                                  )}
                                  {lead.phone_number && (
                                    <a href={`tel:${lead.phone_number}`} className="flex items-center gap-1 hover:text-blue-400 transition-colors duration-200">
                                      <Phone className="w-3 h-3" />
                                      {lead.phone_number}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          {getStatusBadge(lead.status)}
                        </td>

                        {/* Prioritet */}
                        <td className="px-4 py-4 hidden lg:table-cell text-center">
                          {getPriorityIndicator(lead.priority)}
                        </td>

                        {/* Tilldelad */}
                        <td className="px-4 py-4 hidden xl:table-cell">
                          <div className="space-y-1">
                            {lead.lead_technicians && lead.lead_technicians.length > 0 ? (
                              lead.lead_technicians.map((assignment, idx) => (
                                <div key={assignment.id} className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    assignment.is_primary ? 'bg-yellow-400' : 'bg-green-400'
                                  }`} />
                                  <span className="text-sm text-white truncate">
                                    {assignment.technicians?.name || 'Okänd'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-slate-400 italic">Ej tilldelad</span>
                            )}
                          </div>
                        </td>

                        {/* Estimerat Värde */}
                        <td className="px-4 py-4 text-right">
                          {lead.estimated_value ? (
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-white font-mono">
                                {formatCurrency(lead.estimated_value)}
                              </div>
                              {lead.probability && (
                                <div className="text-xs text-slate-400">{lead.probability}% sannolikhet</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>

                        {/* Lead Score */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold font-mono text-white">
                              {calculateLeadScore(lead)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {getLeadQuality(calculateLeadScore(lead)).label}
                            </div>
                          </div>
                        </td>

                        {/* Förhoppning slutförande */}
                        <td className="px-4 py-4 hidden md:table-cell">
                          {lead.closing_date_estimate ? (
                            <div className="text-sm text-white">
                              {new Date(lead.closing_date_estimate).toLocaleDateString('sv-SE')}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">Ej angiven</span>
                          )}
                        </td>

                        {/* Deal Velocity */}
                        <td className="px-4 py-4 hidden md:table-cell">
                          {(() => {
                            const leadAge = Math.floor((new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
                            const isUrgent = lead.closing_date_estimate && 
                              Math.floor((new Date(lead.closing_date_estimate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7 &&
                              Math.floor((new Date(lead.closing_date_estimate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) >= 0;
                            const isStagnant = leadAge > 30 && (lead.status === 'blue_cold' || lead.status === 'red_lost');
                            
                            return (
                              <div className="flex items-center gap-2">
                                {isUrgent && <Flame className="w-4 h-4 text-red-400" title="Deadline inom 7 dagar!" />}
                                <div className="space-y-1">
                                  <div className={`text-sm font-medium ${
                                    isStagnant ? 'text-red-400' :
                                    leadAge > 14 ? 'text-yellow-400' :
                                    'text-white'
                                  }`}>
                                    {leadAge} dagar
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {isStagnant ? 'Stagnerad' :
                                     leadAge > 14 ? 'Långsam' :
                                     'Aktiv'}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Activity Pulse */}
                        <td className="px-4 py-4 hidden md:table-cell">
                          {(() => {
                            const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                            const commentCount = (lead.lead_comments?.[0]?.count || 0);
                            const eventCount = (lead.lead_events?.[0]?.count || 0);
                            const totalActivity = commentCount + eventCount;
                            
                            const getActivityColor = (days: number) => {
                              if (days <= 1) return 'text-green-400';
                              if (days <= 7) return 'text-yellow-400';
                              if (days <= 30) return 'text-orange-400';
                              return 'text-red-400';
                            };
                            
                            const getActivityStatus = (days: number) => {
                              if (days <= 1) return 'Aktiv';
                              if (days <= 7) return 'Nylig';
                              if (days <= 30) return 'Tyst';
                              return 'Inaktiv';
                            };
                            
                            return (
                              <div className="space-y-1">
                                <div className={`text-sm font-medium ${getActivityColor(daysSinceUpdate)}`}>
                                  {daysSinceUpdate === 0 ? 'Idag' : 
                                   daysSinceUpdate === 1 ? 'Igår' : 
                                   `${daysSinceUpdate} dagar`}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {getActivityStatus(daysSinceUpdate)}
                                  {totalActivity > 0 && ` (${totalActivity})`}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Senast Uppdaterad */}
                        <td className="px-4 py-4 hidden md:table-cell">
                          <div className="space-y-1">
                            <div className="text-sm text-white">
                              {new Date(lead.updated_at).toLocaleDateString('sv-SE')}
                            </div>
                            <div className="text-xs text-slate-400">
                              {lead.updated_by_profile?.display_name || 
                               lead.updated_by_profile?.email || 
                               lead.created_by_profile?.display_name || 
                               lead.created_by_profile?.email || 
                               'Okänd'}
                            </div>
                          </div>
                        </td>

                        {/* Nästa Aktivitet */}
                        <td className="px-4 py-4 hidden sm:table-cell">
                          {lead.follow_up_date ? (
                            <div className="space-y-1">
                              <div className={`text-sm font-medium ${
                                new Date(lead.follow_up_date) < new Date() ? 'text-red-400' :
                                new Date(lead.follow_up_date).toDateString() === new Date().toDateString() ? 'text-yellow-400' :
                                'text-white'
                              }`}>
                                {new Date(lead.follow_up_date).toLocaleDateString('sv-SE')}
                              </div>
                              <div className="text-xs text-slate-400">Uppföljning</div>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">Ej schemalagd</span>
                          )}
                        </td>

                        {/* Åtgärder */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditLead(lead)}
                              className="text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-200 p-2 rounded-md"
                              title="Redigera lead"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewLead(lead)}
                              className="text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 transition-all duration-200 p-2 rounded-md"
                              title="Visa detaljer"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable details row */}
                      {isExpanded && (
                        <tr className="bg-slate-800/30 border-b border-slate-700/30">
                          <td colSpan={13} className="px-6 py-4 border-l-4 border-purple-400/50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Affärsinformation */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                  <Building className="w-4 h-4 text-blue-400" />
                                  Affärsinformation
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Källa:</span>
                                    <span className="text-white">{lead.source || 'Ej angiven'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Kontaktmetod:</span>
                                    <span className="text-white">
                                      {lead.contact_method ? CONTACT_METHOD_DISPLAY[lead.contact_method]?.label || lead.contact_method : 'Ej angiven'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Företagsstorlek:</span>
                                    <span className="text-white">
                                      {lead.company_size ? COMPANY_SIZE_DISPLAY[lead.company_size]?.label || lead.company_size : 'Ej angiven'}
                                    </span>
                                  </div>
                                  {lead.contract_with && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Nuvarande leverantör:</span>
                                      <span className="text-white">{lead.contract_with}</span>
                                    </div>
                                  )}
                                  {lead.contract_expires && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Avtal löper ut:</span>
                                      <span className="text-white">
                                        {new Date(lead.contract_expires).toLocaleDateString('sv-SE')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* BANT-kriterier och kvalifikation */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                  Kvalifikation (BANT)
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Budget bekräftad:</span>
                                    <span className={lead.budget_confirmed ? 'text-green-400' : 'text-slate-400'}>
                                      {lead.budget_confirmed ? '✓' : '✗'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Befogenhet bekräftad:</span>
                                    <span className={lead.authority_confirmed ? 'text-green-400' : 'text-slate-400'}>
                                      {lead.authority_confirmed ? '✓' : '✗'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Behov bekräftat:</span>
                                    <span className={lead.need_confirmed ? 'text-green-400' : 'text-slate-400'}>
                                      {lead.need_confirmed ? '✓' : '✗'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Tidslinje bekräftad:</span>
                                    <span className={lead.timeline_confirmed ? 'text-green-400' : 'text-slate-400'}>
                                      {lead.timeline_confirmed ? '✓' : '✗'}
                                    </span>
                                  </div>
                                  {lead.probability && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Sannolikhet:</span>
                                      <span className="text-white font-mono">{lead.probability}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Aktivitet och tidslinje */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-purple-400" />
                                  Aktivitet & Tidslinje
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Kommentarer:</span>
                                    <span className="text-white">{lead.lead_comments?.[0]?.count || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Händelser:</span>
                                    <span className="text-white">{lead.lead_events?.[0]?.count || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Skapad:</span>
                                    <span className="text-white">
                                      {new Date(lead.created_at).toLocaleDateString('sv-SE')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Skapad av:</span>
                                    <span className="text-white">
                                      {lead.created_by_profile?.display_name || lead.created_by_profile?.email || 'Okänd'}
                                    </span>
                                  </div>
                                  {lead.tags && lead.tags.length > 0 && (
                                    <div className="flex justify-between items-start">
                                      <span className="text-slate-400">Taggar:</span>
                                      <div className="flex flex-wrap gap-1 max-w-32">
                                        {lead.tags.map((tag, idx) => (
                                          <span key={idx} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Anteckningar */}
                            {lead.notes && (
                              <div className="mt-4 pt-4 border-t border-slate-700">
                                <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4 text-blue-400" />
                                  Anteckningar
                                </h4>
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                  {lead.notes}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="text-center py-20 bg-slate-800/20">
                <div className="mx-auto w-fit p-4 rounded-full bg-slate-700/30 border border-slate-600/50 mb-6">
                  <Target className="w-16 h-16 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-300 mb-2">
                  {filters.search || filters.status !== 'all' || filters.assignedTo !== 'all' ? 'Inga leads matchar filtren' : 'Inga leads än'}
                </h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                  {filters.search || filters.status !== 'all' || filters.assignedTo !== 'all'
                    ? 'Prova att justera dina sökkriterier för att hitta leads.'
                    : 'Leads kommer att visas här när de läggs till i systemet.'
                  }
                </p>
                {!filters.search && filters.status === 'all' && filters.assignedTo === 'all' && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Skapa din första lead
                  </Button>
                )}
              </div>
            )}
          </div>
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
  )
}

export default Leads
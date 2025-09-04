// src/pages/admin/Leads.tsx - Lead Pipeline Management Page

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Target, 
  Plus, 
  TrendingUp,
  Users,
  User,
  Calendar,
  XCircle,
  BarChart3
} from 'lucide-react'
import { toast } from 'react-hot-toast'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { PageHeader } from '../../components/shared'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import StaggeredGrid from '../../components/shared/StaggeredGrid'
import TooltipWrapper from '../../components/ui/TooltipWrapper'

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
import LeadsFilters from '../../components/admin/leads/LeadsFilters'
import LeadsTable from '../../components/admin/leads/LeadsTable'

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
  const { user, profile, isAdmin, isKoordinator, isTechnician } = useAuth()
  
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
  const [showOnlyActive, setShowOnlyActive] = useState(() => {
    const saved = localStorage.getItem('showOnlyActiveLeads')
    return saved ? JSON.parse(saved) : true // Default to true
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
  const [deletingLead, setDeletingLead] = useState<string | null>(null)

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

  // Memoized filtered and sorted leads
  const filteredAndSortedLeads = useMemo(() => {
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

    // Assigned to filter - updated to check lead_technicians table
    if (filters.assignedTo !== 'all') {
      if (filters.assignedTo === 'me') {
        filtered = filtered.filter(lead => {
          // Check if user is assigned directly via assigned_to field
          const directlyAssigned = lead.assigned_to === profile?.technician_id
          // Check if user is in lead_technicians table
          const technicianAssigned = lead.lead_technicians?.some(
            assignment => assignment.technician_id === profile?.technician_id
          )
          return directlyAssigned || technicianAssigned
        })
      } else if (filters.assignedTo === 'unassigned') {
        filtered = filtered.filter(lead => !lead.assigned_to && (!lead.lead_technicians || lead.lead_technicians.length === 0))
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

    // Show only active leads filter (exclude Affär and Förlorad)
    if (showOnlyActive) {
      filtered = filtered.filter(lead => 
        lead.status !== 'green_deal' && lead.status !== 'red_lost'
      )
    }

    // Sorting
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

    return filtered
  }, [leads, filters, sortField, sortDirection, showOnlyActive, profile?.technician_id, user?.id])

  // Memoized stats calculation
  const statsData = useMemo(() => {
    const totalLeads = leads.length
    
    // My active leads - check both assigned_to and lead_technicians table
    const myActiveLeads = leads.filter(lead => {
      // Check if user is assigned directly via assigned_to field
      const directlyAssigned = lead.assigned_to === profile?.technician_id
      // Check if user is in lead_technicians table
      const technicianAssigned = lead.lead_technicians?.some(
        assignment => assignment.technician_id === profile?.technician_id
      )
      return (directlyAssigned || technicianAssigned) && lead.status !== 'red_lost'
    }).length
    
    // Leads created this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const leadsThisWeek = leads.filter(lead => {
      const createdDate = new Date(lead.created_at)
      return createdDate >= weekStart
    }).length
    
    // Follow-ups due today
    const today = new Date().toISOString().split('T')[0]
    const followUpsToday = leads.filter(lead => 
      lead.follow_up_date && lead.follow_up_date.startsWith(today)
    ).length
    
    // Conversion rate (deals / total leads)
    const dealsWon = leads.filter(lead => lead.status === 'green_deal').length
    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0
    
    // Calculate total estimated value - only from active leads (not lost)
    const totalEstimatedValue = leads
      .filter(lead => lead.status !== 'red_lost' && lead.estimated_value)
      .reduce((sum, lead) => {
        return sum + (lead.estimated_value || 0)
      }, 0)
    
    // Calculate average lead score
    const leadScores = leads.map(lead => calculateLeadScore(lead))
    const avgLeadScore = leadScores.length > 0 ? Math.round(leadScores.reduce((a, b) => a + b, 0) / leadScores.length) : 0

    return {
      totalLeads,
      myActiveLeads,
      leadsThisWeek,
      followUpsToday,
      conversionRate,
      totalEstimatedValue,
      avgLeadScore
    }
  }, [leads, profile?.technician_id])

  // Update filteredLeads when memoized value changes
  useEffect(() => {
    setFilteredLeads(filteredAndSortedLeads)
  }, [filteredAndSortedLeads])

  // Update stats when memoized value changes
  useEffect(() => {
    setStats(statsData)
  }, [statsData])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          company_name,
          organization_number,
          contact_person,
          email,
          phone_number,
          status,
          priority,
          estimated_value,
          probability,
          source,
          contact_method,
          company_size,
          assigned_to,
          follow_up_date,
          closing_date_estimate,
          notes,
          tags,
          budget_confirmed,
          authority_confirmed,
          needs_confirmed,
          timeline_confirmed,
          contract_with,
          contract_expires,
          created_at,
          updated_at,
          created_by,
          updated_by,
          created_by_profile:profiles!leads_created_by_fkey(display_name, email),
          updated_by_profile:profiles!leads_updated_by_fkey(display_name, email),
          lead_technicians(
            id,
            is_primary,
            assigned_at,
            technician_id,
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

  const calculateStats = useCallback((leadsData: Lead[]) => {
    const totalLeads = leadsData.length
    
    // My active leads - check both assigned_to and lead_technicians table
    const myActiveLeads = leadsData.filter(lead => {
      // Check if user is assigned directly via assigned_to field
      const directlyAssigned = lead.assigned_to === profile?.technician_id
      // Check if user is in lead_technicians table
      const technicianAssigned = lead.lead_technicians?.some(
        assignment => assignment.technician_id === profile?.technician_id
      )
      return (directlyAssigned || technicianAssigned) && lead.status !== 'red_lost'
    }).length
    
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
  }, [profile?.technician_id])

  // Filter helper functions
  const handleFiltersChange = useCallback((newFilters: LeadFilters) => {
    setFilters(newFilters)
    localStorage.setItem('leadFilters', JSON.stringify(newFilters))
  }, [])

  const handleFiltersReset = useCallback(() => {
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
  }, [])

  // Save advanced filters toggle state
  const handleAdvancedFiltersToggle = useCallback(() => {
    const newState = !showAdvancedFilters
    setShowAdvancedFilters(newState)
    localStorage.setItem('showAdvancedLeadFilters', JSON.stringify(newState))
  }, [showAdvancedFilters])

  // Save show only active leads toggle state
  const handleShowOnlyActiveToggle = useCallback(() => {
    const newState = !showOnlyActive
    setShowOnlyActive(newState)
    localStorage.setItem('showOnlyActiveLeads', JSON.stringify(newState))
  }, [showOnlyActive])

  const toggleExpandRow = useCallback((leadId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(leadId)) {
        newSet.delete(leadId)
      } else {
        newSet.add(leadId)
      }
      return newSet
    })
  }, [])

  const handleViewLead = useCallback((lead: Lead) => {
    setSelectedLead(lead)
    setShowDetailModal(true)
  }, [])

  const handleEditLead = useCallback((lead: Lead) => {
    setSelectedLead(lead)
    setShowEditModal(true)
  }, [])

  const handleDeleteLead = useCallback(async (lead: Lead) => {
    if (deletingLead) return // Prevent multiple delete attempts
    
    const confirmed = window.confirm(
      `Är du säker på att du vill radera leadet "${lead.company_name}"?\n\nDetta går inte att ångra.`
    )
    
    if (!confirmed) return
    
    try {
      setDeletingLead(lead.id)
      
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id)
      
      if (error) throw error
      
      toast.success(`Lead "${lead.company_name}" har raderats`)
      
      // Remove from local state immediately for better UX
      setLeads(prev => prev.filter(l => l.id !== lead.id))
      
    } catch (err) {
      console.error('Error deleting lead:', err)
      toast.error('Kunde inte radera leadet')
    } finally {
      setDeletingLead(null)
    }
  }, [deletingLead])

  // Optimistic update for better UX
  const optimisticUpdateLead = (leadId: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { ...lead, ...updates, updated_at: new Date().toISOString() }
        : lead
    ))
  }

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to desc
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])


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

        {/* Results Count */}
        <div className="flex justify-end mb-6">
          <div className="text-sm text-slate-400">
            {filteredLeads.length} av {leads.length} leads
          </div>
        </div>

        {/* Filters and Actions */}
        <LeadsFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleFiltersReset}
          isOpen={showAdvancedFilters}
          onToggle={handleAdvancedFiltersToggle}
          resultCount={filteredLeads.length}
          showOnlyActive={showOnlyActive}
          onShowOnlyActiveToggle={handleShowOnlyActiveToggle}
          onNavigateToAnalytics={() => navigate('/admin/leads/analytics')}
        />

        {/* Create Lead Button */}
        <div className="flex justify-end mb-6">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nytt Lead
          </Button>
        </div>

        {/* Leads Table */}
        <LeadsTable
          leads={filteredLeads}
          expandedRows={expandedRows}
          sortField={sortField}
          sortDirection={sortDirection}
          deletingLead={deletingLead}
          onToggleExpandRow={toggleExpandRow}
          onSort={handleSort}
          onViewLead={handleViewLead}
          onEditLead={handleEditLead}
          onDeleteLead={handleDeleteLead}
        />

        {/* Empty state when no leads match filters */}
        {filteredLeads.length === 0 && (
          <div className="text-center py-20">
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
                    id,
                    company_name,
                    organization_number,
                    contact_person,
                    email,
                    phone_number,
                    status,
                    priority,
                    estimated_value,
                    probability,
                    source,
                    contact_method,
                    company_size,
                    assigned_to,
                    follow_up_date,
                    closing_date_estimate,
                    notes,
                    tags,
                    budget_confirmed,
                    authority_confirmed,
                    needs_confirmed,
                    timeline_confirmed,
                    contract_with,
                    contract_expires,
                    created_at,
                    updated_at,
                    created_by,
                    updated_by,
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
                    id,
                    company_name,
                    organization_number,
                    contact_person,
                    email,
                    phone_number,
                    status,
                    priority,
                    estimated_value,
                    probability,
                    source,
                    contact_method,
                    company_size,
                    assigned_to,
                    follow_up_date,
                    closing_date_estimate,
                    notes,
                    tags,
                    budget_confirmed,
                    authority_confirmed,
                    needs_confirmed,
                    timeline_confirmed,
                    contract_with,
                    contract_expires,
                    created_at,
                    updated_at,
                    created_by,
                    updated_by,
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
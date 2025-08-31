// src/pages/admin/LeadAnalytics.tsx - Comprehensive Lead Analytics Dashboard

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Users,
  Target,
  DollarSign,
  MapPin,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react'
import { toast } from 'react-hot-toast'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { PageHeader } from '../../components/shared'

// Analytics components (to be implemented)
import LeadKpiOverview from '../../components/admin/leads/analytics/LeadKpiOverview'
import LeadConversionFunnel from '../../components/admin/leads/analytics/LeadConversionFunnel'
import LeadTrendAnalysis from '../../components/admin/leads/analytics/LeadTrendAnalysis'
import LeadTeamPerformance from '../../components/admin/leads/analytics/LeadTeamPerformance'
import LeadRevenueAnalytics from '../../components/admin/leads/analytics/LeadRevenueAnalytics'
import LeadGeographicDistribution from '../../components/admin/leads/analytics/LeadGeographicDistribution'

import { Lead, calculateLeadScore } from '../../types/database'

interface AnalyticsData {
  leads: Lead[]
  totalLeads: number
  conversionRate: number
  totalPipelineValue: number
  avgLeadScore: number
  leadsByStatus: Record<string, number>
  leadsBySource: Record<string, number>
  leadsByMonth: Record<string, number>
  teamPerformance: Record<string, any>
  geographicData: Record<string, number>
  revenueByMonth: Record<string, number>
}

const LeadAnalytics: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange])

  const fetchAnalyticsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      // Calculate date range
      const now = new Date()
      const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365
      const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))

      // Fetch leads data with relations and better error handling
      const { data: leads, error: leadsError } = await supabase
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
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (leadsError) {
        console.error('Supabase error details:', leadsError)
        throw new Error(`Database error: ${leadsError.message}`)
      }

      // EXTENSIVE DEBUG - Log raw database results
      console.log('🔍 RAW DATABASE RESULTS:', {
        totalRecords: (leads || []).length,
        dateRange: `${startDate.toISOString()} to ${now.toISOString()}`,
        firstLead: leads?.[0],
        allLeadIds: (leads || []).map(l => l.id),
        allLeadDates: (leads || []).map(l => ({ id: l.id, created_at: l.created_at }))
      })

      // Validate and clean the data
      const validLeads = (leads || []).filter(lead => {
        if (!lead.id) {
          console.warn('Lead without ID found, skipping')
          return false
        }
        if (!lead.created_at) {
          console.warn('Lead without created_at found:', lead.id)
          return false
        }
        return true
      })

      console.log(`✅ Processed ${validLeads.length} valid leads out of ${(leads || []).length} total leads`)
      
      // DEBUG: Check date filtering
      if (validLeads.length === 0 && (leads || []).length > 0) {
        console.warn('⚠️ ALL LEADS FILTERED OUT - Check date filtering logic!')
        console.log('Raw leads:', (leads || []).map(l => ({ 
          id: l.id, 
          created_at: l.created_at, 
          isInRange: new Date(l.created_at) >= startDate 
        })))
      }

      // DEBUG: Log startDate for verification
      console.log(`📅 Date range: ${daysBack} days back from now`)
      console.log(`📅 Start date: ${startDate.toISOString()}`)
      console.log(`📅 Now: ${now.toISOString()}`)

      // Process analytics data with validated leads
      const processedData = processAnalyticsData(validLeads)
      
      // DEBUG: Log processed data
      console.log('📊 Processed analytics data:', {
        totalLeads: processedData.totalLeads,
        leadsByMonth: processedData.leadsByMonth,
        leadsBySource: processedData.leadsBySource,
        leadsByStatus: processedData.leadsByStatus
      })
      setAnalyticsData(processedData)
    } catch (err) {
      console.error('Error fetching analytics data:', err)
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid hämtning av analysdata')
      toast.error('Kunde inte ladda analysdata')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const processAnalyticsData = (leads: Lead[]): AnalyticsData => {
    // Calculate basic metrics
    const totalLeads = leads.length
    const dealsWon = leads.filter(lead => lead.status === 'green_deal').length
    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100 * 100) / 100 : 0 // Round to 2 decimals
    
    const totalPipelineValue = leads
      .filter(lead => lead.status !== 'red_lost' && lead.estimated_value)
      .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

    // Calculate average lead score with error handling
    let avgLeadScore = 0
    try {
      const leadScores = leads.map(lead => calculateLeadScore(lead)).filter(score => !isNaN(score))
      avgLeadScore = leadScores.length > 0 ? 
        Math.round(leadScores.reduce((sum, score) => sum + score, 0) / leadScores.length) : 0
    } catch (error) {
      console.warn('Error calculating lead scores, using fallback:', error)
      // Fallback scoring based on status
      const validLeads = leads.filter(lead => lead.status)
      avgLeadScore = validLeads.length > 0 ? 
        Math.round(validLeads.reduce((sum, lead) => {
          switch (lead.status) {
            case 'green_deal': return sum + 100
            case 'orange_hot': return sum + 85
            case 'yellow_warm': return sum + 60
            case 'blue_cold': return sum + 35
            case 'red_lost': return sum + 0
            default: return sum + 30
          }
        }, 0) / validLeads.length) : 0
    }

    // Group by status with validation
    const leadsByStatus = leads.reduce((acc, lead) => {
      const status = lead.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by source with validation
    const leadsBySource = leads.reduce((acc, lead) => {
      const source = lead.source || 'Okänd'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by month with improved date handling - ensure consistent format
    const leadsByMonth = leads.reduce((acc, lead) => {
      try {
        const date = new Date(lead.created_at)
        if (isNaN(date.getTime())) {
          console.warn('Invalid date for lead:', lead.id, 'date:', lead.created_at)
          return acc
        }
        // FIXED: Use same format as MonthlyRevenueChart (short month + 2-digit year)
        const month = date.toLocaleDateString('sv-SE', { year: '2-digit', month: 'short' }).replace('.', '')
        acc[month] = (acc[month] || 0) + 1
        console.log('Processed lead date:', lead.created_at, '-> month key:', month)
      } catch (error) {
        console.warn('Error processing date for lead:', lead.id, error)
      }
      return acc
    }, {} as Record<string, number>)
    
    console.log('📅 Final leadsByMonth:', leadsByMonth)

    // Team performance (placeholder, but with structure)
    const teamPerformance = {
      totalMembers: 0,
      avgConversionRate: 0,
      topPerformer: null
    }

    // Geographic data (placeholder with structure)
    const geographicData = {
      totalRegions: 0,
      topRegion: null
    }

    // Revenue by month with improved validation and debug info
    const revenueByMonth = leads.reduce((acc, lead) => {
      if (lead.estimated_value && lead.status !== 'red_lost') {
        try {
          const date = new Date(lead.created_at)
          if (isNaN(date.getTime())) {
            return acc
          }
          const month = date.toLocaleDateString('sv-SE', { year: '2-digit', month: 'short' }).replace('.', '')
          acc[month] = (acc[month] || 0) + lead.estimated_value
          console.log('Revenue processing:', {
            leadId: lead.id,
            month,
            value: lead.estimated_value,
            status: lead.status
          })
        } catch (error) {
          console.warn('Error processing revenue date for lead:', lead.id, error)
        }
      } else if (!lead.estimated_value && lead.status !== 'red_lost') {
        console.log('Lead without estimated_value:', lead.id, 'status:', lead.status)
      }
      return acc
    }, {} as Record<string, number>)
    
    console.log('💰 Final revenueByMonth:', revenueByMonth)

    return {
      leads,
      totalLeads,
      conversionRate,
      totalPipelineValue,
      avgLeadScore,
      leadsByStatus,
      leadsBySource,
      leadsByMonth,
      teamPerformance,
      geographicData,
      revenueByMonth
    }
  }

  const handleRefresh = () => {
    fetchAnalyticsData(true)
  }

  const handleExport = () => {
    // TODO: Implement analytics export functionality
    toast.success('Export-funktionalitet kommer snart')
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-purple-500/5" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/leads')}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Tillbaka till Leads
            </Button>
          </div>
          
          <PageHeader 
            title="Lead Analytics" 
            description="Analyser och insikter från lead-pipelinen"
          />
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
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/leads')}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Tillbaka till Leads
            </Button>
          </div>
          
          <PageHeader title="Lead Analytics" />
          <Card className="p-8 backdrop-blur-sm bg-slate-800/70 border-slate-700/50">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Fel vid laddning</h3>
              <p className="text-slate-400 mb-6">{error}</p>
              <Button onClick={() => fetchAnalyticsData()}>Försök igen</Button>
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
        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/leads')}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Tillbaka till Leads
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="7d">Senaste 7 dagarna</option>
              <option value="30d">Senaste 30 dagarna</option>
              <option value="90d">Senaste 90 dagarna</option>
              <option value="1y">Senaste året</option>
            </select>
            
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleExport}
              className="text-slate-400 hover:text-white"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <PageHeader 
          title="Lead Analytics" 
          description="Analyser och insikter från lead-pipelinen"
        />

        {/* Analytics Dashboard Grid */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* KPI Overview - Full width top section */}
            <div className="lg:col-span-12">
              <LeadKpiOverview data={analyticsData} />
            </div>

            {/* Conversion Funnel - Left side */}
            <div className="lg:col-span-6">
              <LeadConversionFunnel data={analyticsData} />
            </div>

            {/* Revenue Analytics - Right side */}
            <div className="lg:col-span-6">
              <LeadRevenueAnalytics data={analyticsData} />
            </div>

            {/* Trend Analysis - Full width */}
            <div className="lg:col-span-12">
              <LeadTrendAnalysis data={analyticsData} />
            </div>

            {/* Team Performance - Left side */}
            <div className="lg:col-span-7">
              <LeadTeamPerformance data={analyticsData} />
            </div>

            {/* Geographic Distribution - Right side */}
            <div className="lg:col-span-5">
              <LeadGeographicDistribution data={analyticsData} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LeadAnalytics
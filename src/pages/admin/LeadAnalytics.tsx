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

      // Fetch leads data with relations
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

      if (leadsError) throw leadsError

      // Process analytics data
      const processedData = processAnalyticsData(leads || [])
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
    const conversionRate = totalLeads > 0 ? (dealsWon / totalLeads) * 100 : 0
    
    const totalPipelineValue = leads
      .filter(lead => lead.status !== 'red_lost' && lead.estimated_value)
      .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

    // Calculate average lead score
    const leadScores = leads.map(lead => calculateLeadScore(lead))
    const avgLeadScore = leadScores.length > 0 ? leadScores.reduce((sum, score) => sum + score, 0) / leadScores.length : 0

    // Group by status
    const leadsByStatus = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by source
    const leadsBySource = leads.reduce((acc, lead) => {
      const source = lead.source || 'Okänd'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by month
    const leadsByMonth = leads.reduce((acc, lead) => {
      const month = new Date(lead.created_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' })
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Team performance (placeholder)
    const teamPerformance = {}

    // Geographic data (placeholder)
    const geographicData = {}

    // Revenue by month
    const revenueByMonth = leads.reduce((acc, lead) => {
      if (lead.estimated_value && lead.status !== 'red_lost') {
        const month = new Date(lead.created_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' })
        acc[month] = (acc[month] || 0) + lead.estimated_value
      }
      return acc
    }, {} as Record<string, number>)

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
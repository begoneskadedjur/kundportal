// src/components/admin/leads/analytics/LeadKpiOverview.tsx - KPI Overview Cards for Lead Analytics

import React from 'react'
import { 
  Target,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Award,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

import EnhancedKpiCard from '../../../shared/EnhancedKpiCard'
import StaggeredGrid from '../../../shared/StaggeredGrid'
import { calculateLeadScore } from '../../../../types/database'

interface AnalyticsData {
  leads: any[]
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

interface LeadKpiOverviewProps {
  data: AnalyticsData
}

const LeadKpiOverview: React.FC<LeadKpiOverviewProps> = ({ data }) => {
  const {
    totalLeads,
    conversionRate,
    totalPipelineValue,
    leadsByStatus,
    leads
  } = data

  // Calculate average lead score properly
  const leadScores = leads.map(lead => calculateLeadScore(lead))
  const avgLeadScore = leadScores.length > 0 ? leadScores.reduce((sum, score) => sum + score, 0) / leadScores.length : 0

  // Calculate additional metrics
  const activeLeads = totalLeads - (leadsByStatus['red_lost'] || 0)
  const hotLeads = leadsByStatus['orange_hot'] || 0
  const dealsWon = leadsByStatus['green_deal'] || 0
  
  // Calculate this week's leads
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  
  const leadsThisWeek = leads.filter(lead => {
    const createdDate = new Date(lead.created_at)
    return createdDate >= weekStart
  }).length

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Calculate trends (placeholder logic - in real implementation, you'd compare with previous period)
  const getTrend = (current: number, baseline: number = 0): 'up' | 'down' | 'neutral' => {
    if (current > baseline * 1.05) return 'up'
    if (current < baseline * 0.95) return 'down'
    return 'neutral'
  }

  return (
    <div className="mb-8">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-3 mb-2">
          <Target className="w-6 h-6 text-blue-400" />
          Nyckeltal - Översikt
        </h3>
        <p className="text-slate-400">Viktigaste mätvärdena för lead-prestanda</p>
      </div>

      <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Active Leads */}
        <EnhancedKpiCard
          title="Aktiva Leads"
          value={activeLeads}
          icon={Target}
          trend={getTrend(activeLeads, totalLeads * 0.8)}
          trendValue={`${totalLeads} totalt`}
          delay={0}
          className="hover:scale-105 transition-transform cursor-pointer"
        />

        {/* Conversion Rate */}
        <EnhancedKpiCard
          title="Konverteringsgrad"
          value={conversionRate}
          suffix="%"
          decimals={1}
          icon={TrendingUp}
          trend={getTrend(conversionRate, 15)}
          trendValue={`${dealsWon} affärer`}
          delay={0.1}
          className="hover:scale-105 transition-transform cursor-pointer"
        />

        {/* Pipeline Value */}
        <EnhancedKpiCard
          title="Pipeline-värde"
          value={formatCurrency(totalPipelineValue)}
          icon={DollarSign}
          trend={getTrend(totalPipelineValue, 1000000)}
          trendValue="aktivt värde"
          delay={0.2}
          isNumeric={false}
          className="hover:scale-105 transition-transform cursor-pointer"
        />

        {/* Hot Leads */}
        <EnhancedKpiCard
          title="Heta Leads"
          value={hotLeads}
          icon={AlertCircle}
          trend={hotLeads > 0 ? 'up' : 'neutral'}
          trendValue="krävs uppmärksamhet"
          delay={0.3}
          className="hover:scale-105 transition-transform cursor-pointer"
        />
      </StaggeredGrid>

      {/* Secondary KPI Row */}
      <div className="mt-6">
        <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Weekly New Leads */}
          <EnhancedKpiCard
            title="Nya denna vecka"
            value={leadsThisWeek}
            icon={Calendar}
            trend={getTrend(leadsThisWeek, 5)}
            trendValue="nya leads"
            delay={0.4}
            className="hover:scale-105 transition-transform cursor-pointer"
          />

          {/* Average Lead Score */}
          <EnhancedKpiCard
            title="Genomsnittlig Score"
            value={avgLeadScore}
            suffix=" pts"
            icon={Award}
            trend={getTrend(avgLeadScore, 50)}
            trendValue="kvalitet"
            delay={0.5}
            className="hover:scale-105 transition-transform cursor-pointer"
          />

          {/* Warm Leads */}
          <EnhancedKpiCard
            title="Ljumna Leads"
            value={leadsByStatus['yellow_warm'] || 0}
            icon={Users}
            trend="neutral"
            trendValue="potentiella affärer"
            delay={0.6}
            className="hover:scale-105 transition-transform cursor-pointer"
          />

          {/* Won Deals */}
          <EnhancedKpiCard
            title="Vunna Affärer"
            value={dealsWon}
            icon={CheckCircle}
            trend={dealsWon > 0 ? 'up' : 'neutral'}
            trendValue="avslutade"
            delay={0.7}
            className="hover:scale-105 transition-transform cursor-pointer"
          />
        </StaggeredGrid>
      </div>
    </div>
  )
}

export default LeadKpiOverview
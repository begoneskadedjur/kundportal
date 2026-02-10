// src/components/admin/leads/analytics/LeadTeamPerformance.tsx - Team Performance Matrix

import React, { useState, useEffect } from 'react'
import { 
  Users,
  Award,
  Target,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  Trophy,
  User
} from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { calculateLeadScore } from '../../../../types/database'

import Card from '../../../ui/Card'
import LoadingSpinner from '../../../shared/LoadingSpinner'

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

interface TeamMember {
  id: string
  name: string
  email: string
  totalLeads: number
  activeLeads: number
  convertedLeads: number
  conversionRate: number
  totalPipelineValue: number
  avgLeadScore: number
  lastActivity: string
}

interface LeadTeamPerformanceProps {
  data: AnalyticsData
}

const LeadTeamPerformance: React.FC<LeadTeamPerformanceProps> = ({ data }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<keyof TeamMember>('conversionRate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchTeamPerformance()
  }, [data])

  const fetchTeamPerformance = async () => {
    try {
      setLoading(true)

      // Fetch team members who have been assigned to leads
      const { data: teamData, error: teamError } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          email,
          role
        `)
        .in('role', ['admin', 'koordinator', 'technician'])

      if (teamError) throw teamError

      // Calculate performance metrics for each team member
      const teamPerformance: TeamMember[] = []

      for (const member of teamData || []) {
        // Get leads assigned to this member
        const memberLeads = data.leads.filter(lead => 
          lead.assigned_to === member.id ||
          lead.created_by === member.id ||
          (lead.lead_technicians && lead.lead_technicians.some((tech: any) => tech.technicians?.id === member.id))
        )

        const totalLeads = memberLeads.length
        const activeLeads = memberLeads.filter(lead => lead.status !== 'red_lost').length
        const convertedLeads = memberLeads.filter(lead => lead.status === 'green_deal').length
        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0
        
        const totalPipelineValue = memberLeads
          .filter(lead => lead.status !== 'red_lost' && lead.estimated_value)
          .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

        // Calculate average lead score using the actual calculateLeadScore function
        const leadScores = memberLeads.map(lead => {
          let score = 0
          
          // Try to use the imported calculateLeadScore function if available
          try {
            if (calculateLeadScore && typeof calculateLeadScore === 'function') {
              score = calculateLeadScore(lead)
            } else {
              throw new Error('calculateLeadScore not available')
            }
          } catch (error) {
            // Fallback: Enhanced lead score calculation
            let baseScore = 0
            switch (lead.status) {
              case 'green_deal': baseScore = 100; break
              case 'orange_hot': baseScore = 85; break
              case 'yellow_warm': baseScore = 60; break
              case 'blue_cold': baseScore = 35; break
              case 'red_lost': baseScore = 0; break
              default: baseScore = 30; break
            }
            
            // Add bonus points for estimated value
            if (lead.estimated_value && lead.estimated_value > 0) {
              baseScore += Math.min(15, Math.floor(lead.estimated_value / 10000))
            }
            
            // Bonus for recent activity (within last 7 days)
            if (lead.updated_at) {
              const daysSinceUpdate = (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
              if (daysSinceUpdate <= 7) {
                baseScore += 5
              }
            }
            
            score = Math.min(100, baseScore)
          }
          
          return score
        })
        
        const avgLeadScore = leadScores.length > 0 ? 
          Math.round(leadScores.reduce((sum, score) => sum + score, 0) / leadScores.length) : 0

        // Get last activity date
        const lastActivity = memberLeads.length > 0 ? 
          Math.max(...memberLeads.map(lead => new Date(lead.updated_at).getTime())) : 0

        if (totalLeads > 0) {
          teamPerformance.push({
            id: member.id,
            name: member.display_name || member.email.split('@')[0],
            email: member.email,
            totalLeads,
            activeLeads,
            convertedLeads,
            conversionRate,
            totalPipelineValue,
            avgLeadScore,
            lastActivity: new Date(lastActivity).toISOString()
          })
        }
      }

      setTeamMembers(teamPerformance)
    } catch (err) {
      console.error('Error fetching team performance:', err)
      toast.error('Kunde inte ladda teamprestation')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (column: keyof TeamMember) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  const sortedTeamMembers = [...teamMembers].sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    
    const numA = Number(aValue) || 0
    const numB = Number(bValue) || 0
    
    return sortDirection === 'asc' ? numA - numB : numB - numA
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  const getSortIcon = (column: keyof TeamMember) => {
    if (sortBy !== column) {
      return <Minus className="w-4 h-4 text-slate-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-[#20c58f]" />
      : <ArrowDown className="w-4 h-4 text-[#20c58f]" />
  }

  const getPerformanceIcon = (conversionRate: number) => {
    if (conversionRate >= 30) return <Trophy className="w-4 h-4 text-yellow-400" />
    if (conversionRate >= 20) return <Star className="w-4 h-4 text-green-400" />
    if (conversionRate >= 10) return <Target className="w-4 h-4 text-blue-400" />
    return <User className="w-4 h-4 text-slate-400" />
  }

  if (loading) {
    return (
      <Card className="backdrop-blur-sm bg-slate-800/70 border-slate-700/50 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-green-400" />
            Teamprestation
          </h3>
        </div>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="backdrop-blur-sm bg-slate-800/70 border-slate-700/50 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-green-400" />
          Teamprestation
        </h3>
        <p className="text-slate-400">Individuella resultat och konverteringseffektivitet</p>
      </div>

      {teamMembers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Ingen teamdata tillgänglig</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th 
                  className="text-left py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Teammmedlem
                    {getSortIcon('name')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('totalLeads')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Totalt
                    {getSortIcon('totalLeads')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('activeLeads')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Aktiva
                    {getSortIcon('activeLeads')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('convertedLeads')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Konverterade
                    {getSortIcon('convertedLeads')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('conversionRate')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Konv. %
                    {getSortIcon('conversionRate')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('totalPipelineValue')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Pipeline
                    {getSortIcon('totalPipelineValue')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('avgLeadScore')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Snitt Score
                    {getSortIcon('avgLeadScore')}
                  </div>
                </th>
                <th 
                  className="text-center py-3 px-2 text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('lastActivity')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Senast aktiv
                    {getSortIcon('lastActivity')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sortedTeamMembers.map((member, index) => (
                <tr 
                  key={member.id}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-700/50 rounded-lg">
                        {getPerformanceIcon(member.conversionRate)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{member.name}</div>
                        <div className="text-xs text-slate-400">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="text-white font-medium">{member.totalLeads}</span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="text-green-400 font-medium">{member.activeLeads}</span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="text-blue-400 font-medium">{member.convertedLeads}</span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`font-bold ${
                        member.conversionRate >= 30 ? 'text-yellow-400' :
                        member.conversionRate >= 20 ? 'text-green-400' :
                        member.conversionRate >= 10 ? 'text-blue-400' :
                        'text-slate-400'
                      }`}>
                        {member.conversionRate.toFixed(1)}%
                      </span>
                      {member.conversionRate >= 25 && <TrendingUp className="w-3 h-3 text-green-400" />}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="text-white font-mono text-sm">
                      {formatCurrency(member.totalPipelineValue)}
                    </span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-white font-medium">{member.avgLeadScore.toFixed(0)}</span>
                      <Award className="w-3 h-3 text-purple-400" />
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="text-slate-400 text-sm">
                      {formatDate(member.lastActivity)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Summary */}
      {teamMembers.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {teamMembers.length}
            </div>
            <div className="text-sm text-slate-400">Aktiva medlemmar</div>
          </div>
          
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {(teamMembers.reduce((sum, member) => sum + member.conversionRate, 0) / teamMembers.length).toFixed(1)}%
            </div>
            <div className="text-sm text-slate-400">Genomsnittlig konvertering</div>
          </div>
          
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {teamMembers.filter(member => member.conversionRate >= 20).length}
            </div>
            <div className="text-sm text-slate-400">Topprestationer (≥20%)</div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default LeadTeamPerformance
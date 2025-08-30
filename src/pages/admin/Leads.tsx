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
  Flame
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
  COMPANY_SIZE_DISPLAY 
} from '../../types/database'
import CreateLeadModal from '../../components/admin/leads/CreateLeadModal'
import EditLeadModal from '../../components/admin/leads/EditLeadModal'

interface LeadStats {
  totalLeads: number
  hotLeads: number
  coldLeads: number
  dealsWon: number
  conversionRate: number
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [leads, searchTerm, statusFilter])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          created_by_profile:profiles!leads_created_by_fkey(display_name, email),
          updated_by_profile:profiles!leads_updated_by_fkey(display_name, email)
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

  const calculateStats = (leadsData: Lead[]) => {
    const totalLeads = leadsData.length
    const hotLeads = leadsData.filter(lead => lead.status === 'green_deal').length
    const coldLeads = leadsData.filter(lead => lead.status === 'blue_cold').length
    const dealsWon = leadsData.filter(lead => lead.status === 'green_deal').length
    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0

    setStats({
      totalLeads,
      hotLeads,
      coldLeads,
      dealsWon,
      conversionRate
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
          />
          
          <EnhancedKpiCard
            title="Heta Leads"
            value={stats?.hotLeads || 0}
            icon={Flame}
            trend="up"
            trendValue="+3"
            delay={0.1}
          />
          
          <EnhancedKpiCard
            title="Kalla Leads"
            value={stats?.coldLeads || 0}
            icon={Clock}
            trend="neutral"
            delay={0.2}
          />
          
          <EnhancedKpiCard
            title="Konverteringsgrad"
            value={stats?.conversionRate || 0}
            icon={TrendingUp}
            suffix="%"
            trend={stats?.conversionRate > 15 ? "up" : "neutral"}
            trendValue={`${stats?.conversionRate}%`}
            delay={0.3}
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
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-slate-300">Företag</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-300">Kontakt</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-300">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-300">Kontaktad</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-300">Uppföljning</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-300">Uppdaterad</th>
                    <th className="text-right p-4 text-sm font-medium text-slate-300">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredLeads.map((lead, index) => (
                    <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-white">{lead.company_name}</div>
                          {lead.organization_number && (
                            <div className="text-sm text-slate-400">{lead.organization_number}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-white">{lead.contact_person}</div>
                          <div className="text-sm text-slate-400 space-y-1">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </div>
                            {lead.phone_number && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                {lead.phone_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="p-4">
                        {lead.contact_date ? (
                          <div className="text-sm">
                            <div className="text-white">{formatDate(lead.contact_date)}</div>
                            {lead.contact_method && (
                              <div className="text-slate-400 flex items-center gap-1 mt-1">
                                {lead.contact_method === 'mail' && <Mail className="w-3 h-3" />}
                                {lead.contact_method === 'phone' && <Phone className="w-3 h-3" />}
                                {lead.contact_method === 'visit' && <MapPin className="w-3 h-3" />}
                                {CONTACT_METHOD_DISPLAY[lead.contact_method].label}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {lead.follow_up_date ? (
                          <div className="text-sm text-white">{formatDate(lead.follow_up_date)}</div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div className="text-white">{formatDate(lead.updated_at)}</div>
                          <div className="text-slate-400">
                            av {lead.updated_by_profile?.display_name || 'Okänd'}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedLead(lead)
                            setShowEditModal(true)
                          }}
                        >
                          Redigera
                        </Button>
                      </td>
                    </tr>
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

        <EditLeadModal
          lead={selectedLead}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedLead(null)
          }}
          onSuccess={fetchLeads}
        />
      </div>
    </div>
  )
}

export default Leads
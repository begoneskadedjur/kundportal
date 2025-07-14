// 📁 src/components/TechnicianProvisionDetails.tsx - DETALJVY FÖR TEKNIKER PROVISION
import React, { useState, useMemo } from 'react'
import { 
  useTechnicianProvisionDetails, 
  useProvisionCases 
} from '../hooks/useProvisionDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  X, User, DollarSign, Briefcase, Calendar, MapPin, Phone, Mail, 
  ExternalLink, Filter, Search, ChevronDown, ChevronUp, Star, Trophy,
  TrendingUp, BarChart3, Target, Clock
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TechnicianProvisionDetailsProps {
  technicianId: string
  isOpen: boolean
  onClose: () => void
  monthsBack?: number
}

interface CaseTableRow {
  id: string
  case_number: string | null
  title: string
  source: 'private' | 'business'
  pris: number
  provision_amount: number
  completed_date: string
  skadedjur?: string | null
  kontaktperson?: string | null
  telefon_kontaktperson?: string | null
  adress?: any
  clickup_task_id: string
  role: 'primary' | 'secondary' | 'tertiary'
}

// Provision Beräkning Konstanter
const PROVISION_RATE = 0.05 // 5%
const PRIMARY_RATE = 0.60    // 60%
const SECONDARY_RATE = 0.30  // 30%
const TERTIARY_RATE = 0.10   // 10%

const TechnicianProvisionDetails: React.FC<TechnicianProvisionDetailsProps> = ({
  technicianId,
  isOpen,
  onClose,
  monthsBack = 12
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'private' | 'business'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'provision'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  // Hooks
  const { data: technicianDetails, loading: technicianLoading, error: technicianError } = 
    useTechnicianProvisionDetails(technicianId, monthsBack)
  
  const { data: allCases, loading: casesLoading } = useProvisionCases(monthsBack, technicianId)

  // Beräkna provision för varje ärende och tekniker-roll
  const casesWithProvision = useMemo<CaseTableRow[]>(() => {
    if (!allCases.length || !technicianDetails) return []

    return allCases.map(case_ => {
      let role: 'primary' | 'secondary' | 'tertiary' = 'primary'
      let provisionRate = PRIMARY_RATE

      if (case_.primary_assignee_id === technicianId) {
        role = 'primary'
        provisionRate = PRIMARY_RATE
      } else if (case_.secondary_assignee_id === technicianId) {
        role = 'secondary'
        provisionRate = SECONDARY_RATE
      } else if (case_.tertiary_assignee_id === technicianId) {
        role = 'tertiary'
        provisionRate = TERTIARY_RATE
      }

      const baseProvision = (case_.pris || 0) * PROVISION_RATE
      const provision_amount = baseProvision * provisionRate

      return {
        id: case_.id,
        case_number: case_.case_number,
        title: case_.title,
        source: case_.source,
        pris: case_.pris || 0,
        provision_amount,
        completed_date: case_.completed_date,
        skadedjur: case_.skadedjur,
        kontaktperson: case_.kontaktperson,
        telefon_kontaktperson: case_.telefon_kontaktperson,
        adress: case_.adress,
        clickup_task_id: case_.clickup_task_id,
        role
      }
    })
  }, [allCases, technicianDetails, technicianId])

  // Filtrera och sortera ärenden
  const filteredAndSortedCases = useMemo(() => {
    let filtered = casesWithProvision

    // Sökfilter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(case_ => 
        case_.title.toLowerCase().includes(search) ||
        case_.case_number?.toLowerCase().includes(search) ||
        case_.kontaktperson?.toLowerCase().includes(search) ||
        case_.skadedjur?.toLowerCase().includes(search)
      )
    }

    // Källfilter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.source === sourceFilter)
    }

    // Sortering
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.completed_date).getTime() - new Date(b.completed_date).getTime()
          break
        case 'amount':
          comparison = a.pris - b.pris
          break
        case 'provision':
          comparison = a.provision_amount - b.provision_amount
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [casesWithProvision, searchTerm, sourceFilter, sortBy, sortOrder])

  // KPI Beräkningar
  const kpis = useMemo(() => {
    if (!casesWithProvision.length) return null

    const totalProvision = casesWithProvision.reduce((sum, c) => sum + c.provision_amount, 0)
    const totalRevenue = casesWithProvision.reduce((sum, c) => sum + c.pris, 0)
    const avgProvisionPerCase = casesWithProvision.length > 0 ? totalProvision / casesWithProvision.length : 0
    
    const roleBreakdown = {
      primary: casesWithProvision.filter(c => c.role === 'primary').length,
      secondary: casesWithProvision.filter(c => c.role === 'secondary').length,
      tertiary: casesWithProvision.filter(c => c.role === 'tertiary').length
    }

    const sourceBreakdown = {
      private: casesWithProvision.filter(c => c.source === 'private'),
      business: casesWithProvision.filter(c => c.source === 'business')
    }

    return {
      totalProvision,
      totalRevenue,
      totalCases: casesWithProvision.length,
      avgProvisionPerCase,
      roleBreakdown,
      sourceBreakdown
    }
  }, [casesWithProvision])

  if (!isOpen) return null

  const loading = technicianLoading || casesLoading
  const error = technicianError

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {technicianDetails?.technician_name || 'Laddar...'}
              </h2>
              <p className="text-blue-100">
                Provision Detaljer - {monthsBack} månader
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-medium">Fel vid hämtning av data</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          ) : !technicianDetails ? (
            <div className="text-center py-12 text-gray-500">
              Tekniker hittades inte
            </div>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Provision</p>
                          <p className="text-xl font-bold text-gray-900">
                            {kpis.totalProvision.toLocaleString('sv-SE')} kr
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Briefcase className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Ärenden</p>
                          <p className="text-xl font-bold text-gray-900">{kpis.totalCases}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Target className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Snitt/Ärende</p>
                          <p className="text-xl font-bold text-gray-900">
                            {kpis.avgProvisionPerCase.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Trophy className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Primära Roller</p>
                          <p className="text-xl font-bold text-gray-900">{kpis.roleBreakdown.primary}</p>
                          <p className="text-xs text-gray-500">
                            Sek: {kpis.roleBreakdown.secondary}, Tert: {kpis.roleBreakdown.tertiary}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Månadsvis Trend Chart */}
              {technicianDetails && technicianDetails.monthly_breakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Månadsvis Provision Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={technicianDetails.monthly_breakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="month" 
                            stroke="#666"
                            fontSize={12}
                            tickFormatter={(value) => {
                              const [year, month] = value.split('-')
                              return `${month}/${year.slice(-2)}`
                            }}
                          />
                          <YAxis 
                            stroke="#666"
                            fontSize={12}
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toLocaleString('sv-SE')} kr`, 'Provision']}
                            labelFormatter={(label) => {
                              const [year, month] = label.split('-')
                              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
                              return `${monthNames[parseInt(month) - 1]} ${year}`
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="provision_amount" 
                            stroke="#3B82F6" 
                            strokeWidth={3}
                            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filters och Search */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-64">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Sök ärenden, kunder, skadedjur..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Source Filter */}
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value as any)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Alla källor</option>
                      <option value="private">Privatpersoner</option>
                      <option value="business">Företag</option>
                    </select>

                    {/* Sort */}
                    <select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [newSortBy, newSortOrder] = e.target.value.split('-')
                        setSortBy(newSortBy as any)
                        setSortOrder(newSortOrder as any)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="date-desc">Datum (senaste först)</option>
                      <option value="date-asc">Datum (äldsta först)</option>
                      <option value="amount-desc">Belopp (högst först)</option>
                      <option value="amount-asc">Belopp (lägst först)</option>
                      <option value="provision-desc">Provision (högst först)</option>
                      <option value="provision-asc">Provision (lägst först)</option>
                    </select>

                    <div className="text-sm text-gray-600">
                      {filteredAndSortedCases.length} av {casesWithProvision.length} ärenden
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cases Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Provision Ärenden
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAndSortedCases.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Inga ärenden hittades med aktuella filter
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Ärende</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Källa</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Roll</th>
                            <th className="text-right py-3 px-2 font-medium text-gray-700">Belopp</th>
                            <th className="text-right py-3 px-2 font-medium text-gray-700">Provision</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Datum</th>
                            <th className="text-center py-3
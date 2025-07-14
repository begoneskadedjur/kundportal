// 📁 src/components/admin/technicians/TechnicianProvisionDetails.tsx - KOMPLETT DETALJVY FÖR TEKNIKER PROVISION
import React, { useState, useMemo } from 'react'
import { 
  useTechnicianProvisionDetails, 
  useProvisionCases 
} from '../../../hooks/useProvisionDashboard'
import Card from '../../../components/ui/Card'
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
  is_primary: boolean
}

// Provision Beräkning Konstanter
const PROVISION_RATE = 0.05 // 5% endast för primär tekniker

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

  // Beräkna provision för varje ärende - endast primära tekniker får provision
  const casesWithProvision = useMemo<CaseTableRow[]>(() => {
    if (!allCases.length || !technicianDetails) return []

    return allCases
      .filter(case_ => case_.primary_assignee_id === technicianId) // Endast primär tekniker
      .map(case_ => {
        const provision_amount = (case_.pris || 0) * PROVISION_RATE // 5% av ärendebelopp

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
          is_primary: true // Alltid true eftersom vi bara visar primära ärenden
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
    
    const sourceBreakdown = {
      private: casesWithProvision.filter(c => c.source === 'private'),
      business: casesWithProvision.filter(c => c.source === 'business')
    }

    return {
      totalProvision,
      totalRevenue,
      totalCases: casesWithProvision.length,
      avgProvisionPerCase,
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
                Provision Detaljer - {monthsBack} månader (Endast primär tekniker)
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
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Provision</p>
                          <p className="text-xl font-bold text-gray-900">
                            {kpis.totalProvision.toLocaleString('sv-SE')} kr
                          </p>
                          <p className="text-xs text-gray-500">5% av ärendebelopp</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Briefcase className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Ärenden (Primär)</p>
                          <p className="text-xl font-bold text-gray-900">{kpis.totalCases}</p>
                          <p className="text-xs text-gray-500">Som huvudtekniker</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Target className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Snitt/Ärende</p>
                          <p className="text-xl font-bold text-gray-900">
                            {kpis.avgProvisionPerCase.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                          </p>
                          <p className="text-xs text-gray-500">Genomsnittlig provision</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Trophy className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Intäkt</p>
                          <p className="text-xl font-bold text-gray-900">
                            {kpis.totalRevenue.toLocaleString('sv-SE')} kr
                          </p>
                          <p className="text-xs text-gray-500">Ärendeomsättning</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Månadsvis Trend Chart */}
              {technicianDetails && technicianDetails.monthly_breakdown.length > 0 && (
                <Card>
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                      <TrendingUp className="h-5 w-5" />
                      Månadsvis Provision Trend
                    </h2>
                  </div>
                  <div>
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
                  </div>
                </Card>
              )}

              {/* Filters och Search */}
              <Card>
                <div className="p-4">
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
                </div>
              </Card>

              {/* Cases Table */}
              <Card>
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                    <Briefcase className="h-5 w-5" />
                    Provision Ärenden (Endast Primär Tekniker)
                  </h2>
                </div>
                <div> value="amount-desc">Belopp (högst först)</option>
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
                    Provision Ärenden (Endast Primär Tekniker)
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
                            <th className="text-right py-3 px-2 font-medium text-gray-700">Belopp</th>
                            <th className="text-right py-3 px-2 font-medium text-gray-700">Provision (5%)</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Datum</th>
                            <th className="text-center py-3 px-2 font-medium text-gray-700">Åtgärder</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndSortedCases.map((case_) => {
                            const isExpanded = expandedCase === case_.id
                            const sourceColors = {
                              private: 'bg-purple-100 text-purple-800',
                              business: 'bg-orange-100 text-orange-800'
                            }

                            return (
                              <React.Fragment key={case_.id}>
                                <tr className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-3 px-2">
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {case_.case_number || case_.title}
                                      </div>
                                      {case_.case_number && (
                                        <div className="text-sm text-gray-600 truncate max-w-xs">
                                          {case_.title}
                                        </div>
                                      )}
                                      {case_.skadedjur && (
                                        <div className="text-xs text-gray-500">
                                          🐛 {case_.skadedjur}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${sourceColors[case_.source]}`}>
                                      {case_.source === 'private' ? 'Privatperson' : 'Företag'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2 text-right font-medium">
                                    {case_.pris.toLocaleString('sv-SE')} kr
                                  </td>
                                  <td className="py-3 px-2 text-right">
                                    <div className="font-semibold text-green-600">
                                      {case_.provision_amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      5% av {case_.pris.toLocaleString('sv-SE')} kr
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-sm text-gray-600">
                                    {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => setExpandedCase(isExpanded ? null : case_.id)}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Visa detaljer"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </button>
                                      <a
                                        href={`https://app.clickup.com/t/${case_.clickup_task_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-600 hover:text-gray-800"
                                        title="Öppna i ClickUp"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Expanded Details Row */}
                                {isExpanded && (
                                  <tr className="bg-gray-50">
                                    <td colSpan={6} className="py-4 px-6">
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                        {/* Kontaktinfo */}
                                        {case_.kontaktperson && (
                                          <div className="space-y-2">
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                              <User className="h-4 w-4" />
                                              Kontaktperson
                                            </h4>
                                            <div className="text-gray-700">{case_.kontaktperson}</div>
                                            {case_.telefon_kontaktperson && (
                                              <div className="flex items-center gap-2 text-gray-600">
                                                <Phone className="h-3 w-3" />
                                                {case_.telefon_kontaktperson}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Adress */}
                                        {case_.adress && (
                                          <div className="space-y-2">
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                              <MapPin className="h-4 w-4" />
                                              Adress
                                            </h4>
                                            <div className="text-gray-700">
                                              {typeof case_.adress === 'string' 
                                                ? case_.adress 
                                                : case_.adress?.display_name || 'Adress ej tillgänglig'
                                              }
                                            </div>
                                          </div>
                                        )}

                                        {/* Provision Breakdown */}
                                        <div className="space-y-2">
                                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                            <DollarSign className="h-4 w-4" />
                                            Provision Beräkning
                                          </h4>
                                          <div className="space-y-1 text-gray-700">
                                            <div className="flex justify-between">
                                              <span>Ärendebelopp:</span>
                                              <span>{case_.pris.toLocaleString('sv-SE')} kr</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Provision (5%):</span>
                                              <span className="font-semibold text-green-600">
                                                {case_.provision_amount.toLocaleString('sv-SE')} kr
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-2 p-2 bg-green-50 rounded">
                                              💡 Endast primär tekniker erhåller provision
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Stats - Uppdaterad utan rollfördelning */}
              {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {/* Källa fördelning */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Provision Analys - Källa Fördelning
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-purple-800">Privatpersoner</span>
                            <span className="font-semibold">{kpis.sourceBreakdown.private.length} ärenden</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-2">
                            <div className="flex justify-between">
                              <span>Total provision:</span>
                              <span className="font-medium text-green-600">
                                {kpis.sourceBreakdown.private
                                  .reduce((sum, c) => sum + c.provision_amount, 0)
                                  .toLocaleString('sv-SE')} kr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total intäkt:</span>
                              <span className="font-medium">
                                {kpis.sourceBreakdown.private
                                  .reduce((sum, c) => sum + c.pris, 0)
                                  .toLocaleString('sv-SE')} kr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Snitt provision/ärende:</span>
                              <span>
                                {kpis.sourceBreakdown.private.length > 0
                                  ? (kpis.sourceBreakdown.private.reduce((sum, c) => sum + c.provision_amount, 0) / kpis.sourceBreakdown.private.length).toLocaleString('sv-SE', { maximumFractionDigits: 0 })
                                  : '0'} kr
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-orange-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-orange-800">Företag</span>
                            <span className="font-semibold">{kpis.sourceBreakdown.business.length} ärenden</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-2">
                            <div className="flex justify-between">
                              <span>Total provision:</span>
                              <span className="font-medium text-green-600">
                                {kpis.sourceBreakdown.business
                                  .reduce((sum, c) => sum + c.provision_amount, 0)
                                  .toLocaleString('sv-SE')} kr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total intäkt:</span>
                              <span className="font-medium">
                                {kpis.sourceBreakdown.business
                                  .reduce((sum, c) => sum + c.pris, 0)
                                  .toLocaleString('sv-SE')} kr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Snitt provision/ärende:</span>
                              <span>
                                {kpis.sourceBreakdown.business.length > 0
                                  ? (kpis.sourceBreakdown.business.reduce((sum, c) => sum + c.provision_amount, 0) / kpis.sourceBreakdown.business.length).toLocaleString('sv-SE', { maximumFractionDigits: 0 })
                                  : '0'} kr
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Provision Rate Info */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">Provision Information</span>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <div>• Provision: 5% av ärendebelopp</div>
                          <div>• Endast primär tekniker erhåller provision</div>
                          <div>• Beräknas automatiskt vid ärendeavslut</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TechnicianProvisionDetails
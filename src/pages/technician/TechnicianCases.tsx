// src/pages/technician/TechnicianCases.tsx - TEKNIKER ÄRENDEÖVERSIKT
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, ClipboardList, Filter, Search, Eye, ExternalLink,
  Clock, CheckCircle, AlertCircle, User, Building2, Calendar,
  MapPin, Phone, Mail, DollarSign, FileText
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'

// Interfaces
interface TechnicianCase {
  id: string
  clickup_task_id: string
  case_number?: string
  title: string
  status: string
  priority?: string
  case_type: 'private' | 'business'
  created_date: string
  completed_date?: string
  commission_amount?: number
  case_price?: number
  
  // Kontaktuppgifter
  kontaktperson?: string
  telefon?: string
  email?: string
  adress?: any
  
  // Företagsuppgifter (för business cases)
  foretag?: string
  org_nr?: string
  
  // Ärendespecifika fält
  skadedjur?: string
  beskrivning?: string
  
  // ClickUp specifikt
  clickup_url?: string
  assignee_name?: string
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip'
}

interface CaseStats {
  total_cases: number
  completed_cases: number
  pending_cases: number
  in_progress_cases: number
  total_commission: number
}

// Status färger
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'avslutad':
      return 'bg-green-500/20 text-green-400'
    case 'in progress':
    case 'pågående':
      return 'bg-blue-500/20 text-blue-400'
    case 'pending':
    case 'väntande':
      return 'bg-yellow-500/20 text-yellow-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

// Prioritet färger
const getPriorityColor = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'high':
    case 'hög':
      return 'bg-red-500/20 text-red-400'
    case 'medium':
    case 'medel':
      return 'bg-orange-500/20 text-orange-400'
    case 'low':
    case 'låg':
      return 'bg-green-500/20 text-green-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

export default function TechnicianCases() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  // State
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<TechnicianCase[]>([])
  const [filteredCases, setFilteredCases] = useState<TechnicianCase[]>([])
  const [stats, setStats] = useState<CaseStats>({
    total_cases: 0,
    completed_cases: 0,
    pending_cases: 0,
    in_progress_cases: 0,
    total_commission: 0
  })
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'commission' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (profile?.technician_id) {
      fetchCases()
    }
  }, [profile?.technician_id])

  useEffect(() => {
    applyFilters()
  }, [cases, searchTerm, statusFilter, typeFilter, sortBy, sortOrder])

  const fetchCases = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/technician/cases?technician_id=${profile?.technician_id}`)
      if (response.ok) {
        const data = await response.json()
        setCases(data.cases || [])
        setStats(data.stats || {})
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...cases]

    // Textsökning
    if (searchTerm) {
      filtered = filtered.filter(case_ => 
        case_.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.kontaktperson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.foretag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.case_number?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.status?.toLowerCase() === statusFilter.toLowerCase())
    }

    // Typ filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.case_type === typeFilter)
    }

    // Sortering
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
          break
        case 'commission':
          comparison = (a.commission_amount || 0) - (b.commission_amount || 0)
          break
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '')
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    setFilteredCases(filtered)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => navigate('/technician/dashboard')} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg">
                <ClipboardList className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Mina Ärenden</h1>
                <p className="text-sm text-slate-400">Översikt över tilldelade ärenden från ClickUp</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 bg-gradient-to-br from-slate-500/20 to-slate-600/20 border-slate-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt</p>
                <p className="text-xl font-bold text-white">{stats.total_cases}</p>
              </div>
              <ClipboardList className="w-6 h-6 text-slate-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm">Avslutade</p>
                <p className="text-xl font-bold text-white">{stats.completed_cases}</p>
              </div>
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm">Pågående</p>
                <p className="text-xl font-bold text-white">{stats.in_progress_cases}</p>
              </div>
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-400 text-sm">Väntande</p>
                <p className="text-xl font-bold text-white">{stats.pending_cases}</p>
              </div>
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm">Provision</p>
                <p className="text-lg font-bold text-white">{formatCurrency(stats.total_commission)}</p>
              </div>
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
          </Card>
        </div>

        {/* Filter och sök */}
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Sök ärenden, kunder, företag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="all">Alla statusar</option>
              <option value="completed">Avslutade</option>
              <option value="in progress">Pågående</option>
              <option value="pending">Väntande</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="all">Alla typer</option>
              <option value="private">Privatpersoner</option>
              <option value="business">Företag</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as 'date' | 'commission' | 'status')
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="date-desc">Senaste först</option>
              <option value="date-asc">Äldsta först</option>
              <option value="commission-desc">Högsta provision</option>
              <option value="commission-asc">Lägsta provision</option>
              <option value="status-asc">Status A-Z</option>
            </select>
          </div>
        </Card>

        {/* Ärendelista */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCases.length > 0 ? (
            filteredCases.map(case_ => (
              <Card key={case_.id} className="p-6 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-white text-lg truncate">
                        {case_.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
                        {case_.status}
                      </span>
                      {case_.priority && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(case_.priority)}`}>
                          {case_.priority}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                      <span className={`inline-flex items-center gap-1 ${
                        case_.case_type === 'private' ? 'text-blue-400' : 'text-purple-400'
                      }`}>
                        {case_.case_type === 'private' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                        {case_.case_type === 'private' ? 'Privatperson' : 'Företag'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(case_.created_date)}
                      </span>
                    </div>
                  </div>

                  {case_.commission_amount && (
                    <div className="text-right">
                      <p className="text-green-400 font-semibold text-lg">
                        {formatCurrency(case_.commission_amount)}
                      </p>
                      {case_.case_price && (
                        <p className="text-slate-400 text-sm">
                          av {formatCurrency(case_.case_price)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Kontaktinformation */}
                <div className="space-y-2 mb-4">
                  {case_.kontaktperson && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      {case_.kontaktperson}
                    </p>
                  )}
                  
                  {case_.foretag && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {case_.foretag}
                    </p>
                  )}

                  {case_.telefon && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {case_.telefon}
                    </p>
                  )}

                  {case_.email && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {case_.email}
                    </p>
                  )}

                  {case_.adress && (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {typeof case_.adress === 'string' ? case_.adress : 'Adress tillgänglig'}
                    </p>
                  )}
                </div>

                {/* Ärendespecifik information */}
                {case_.skadedjur && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-1">Skadedjur:</p>
                    <p className="text-sm text-white bg-slate-800/50 rounded px-2 py-1">
                      {case_.skadedjur}
                    </p>
                  </div>
                )}

                {case_.beskrivning && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-1">Beskrivning:</p>
                    <p className="text-sm text-slate-300 bg-slate-800/50 rounded px-2 py-1">
                      {case_.beskrivning}
                    </p>
                  </div>
                )}

                {/* Åtgärder */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <div className="text-xs text-slate-400">
                    {case_.case_number && (
                      <span>Ärendenr: {case_.case_number}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {case_.billing_status && (
                      <span className={`px-2 py-1 rounded text-xs ${
                        case_.billing_status === 'paid' 
                          ? 'bg-green-500/20 text-green-400'
                          : case_.billing_status === 'sent'
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {case_.billing_status === 'paid' ? 'Betald' : 
                         case_.billing_status === 'sent' ? 'Skickad' : 'Väntande'}
                      </span>
                    )}
                    
                    {case_.clickup_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(case_.clickup_url, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        ClickUp
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-2">
              <Card className="p-12">
                <div className="text-center">
                  <ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Inga ärenden hittades</h3>
                  <p className="text-slate-400 mb-4">
                    {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                      ? 'Prova att ändra dina filter eller sökord.'
                      : 'Du har inga tilldelade ärenden för tillfället.'
                    }
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
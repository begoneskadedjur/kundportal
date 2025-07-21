// 📁 src/pages/technician/TechnicianCases.tsx - FIXAD MED RÄTT TEKNIKER-ID
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
import { supabase } from '../../lib/supabase'

// Interfaces
interface TechnicianCase {
  id: string
  clickup_task_id: string
  case_number?: string
  title: string
  status: string
  priority?: string
  case_type: 'private' | 'business' | 'contract'
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
    case 'avslutat':
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

export default function TechnicianCases() {
  const { user, profile, technician, isTechnician } = useAuth()
  const navigate = useNavigate()
  
  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cases, setCases] = useState<TechnicianCase[]>([])
  const [stats, setStats] = useState<CaseStats>({
    total_cases: 0,
    completed_cases: 0,
    pending_cases: 0,
    in_progress_cases: 0,
    total_commission: 0
  })
  const [filteredCases, setFilteredCases] = useState<TechnicianCase[]>([])
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'commission' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 🔥 FIX: Hämta rätt tekniker-ID från profile direkt
  const getTechnicianId = () => {
    console.log('🔍 GETTING TECHNIKER ID:', {
      profileTechnicianId: profile?.technician_id,
      technicianId: technician?.id,
      userUID: user?.id,
      profileRole: profile?.role,
      fullProfile: profile,
      fullTechnician: technician
    })
    
    // ✅ ANVÄND ALLTID profile.technician_id FÖRST - det är den säkra källan
    return profile?.technician_id || technician?.id
  }

  // 🔥 SÄKERHETSKONTROLL - vänta tills profile laddas
  useEffect(() => {
    if (!isTechnician || !profile?.technician_id) {
      console.log('❌ Inte en tekniker eller tekniker-ID saknas:', { 
        isTechnician, 
        profileRole: profile?.role,
        technicianId: profile?.technician_id,
        loading: loading
      })
      
      // Om vi inte är en tekniker, omdirigera
      if (profile && profile.role !== 'technician') {
        navigate('/login', { replace: true })
      }
      return
    }
  }, [isTechnician, profile, navigate])

  // 🔥 KÖRT FETCHCASES NÄR VI HAR RÄTT DATA
  useEffect(() => {
    // Vänta tills vi har profile.technician_id
    if (isTechnician && profile?.technician_id) {
      console.log('🚀 Starting fetch with technician ID:', profile.technician_id)
      fetchCasesDirectly(profile.technician_id)
    } else {
      console.log('⏳ Waiting for technician data...', {
        isTechnician,
        profileTechnicianId: profile?.technician_id,
        profileLoaded: !!profile
      })
    }
  }, [isTechnician, profile?.technician_id]) // Endast lyssna på profile.technician_id

  useEffect(() => {
    applyFilters()
  }, [cases, searchTerm, statusFilter, typeFilter, sortBy, sortOrder])

  const fetchCasesDirectly = async (technicianId: string) => {
    console.log('🔍 FINAL TECHNICIAN ID DEBUG:', {
      usedTechnicianId: technicianId,
      profileTechnicianId: profile?.technician_id,
      technicianObjId: technician?.id,
      expectedId: 'ecaf151a-44b2-4220-b105-998aa0f82d6e'
    })

    if (!technicianId) {
      const errorMsg = 'Ingen tekniker-ID tillgänglig'
      console.error('❌', errorMsg)
      setError(errorMsg)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching cases for technician ID:', technicianId)
      
      // 🔥 HUVUDQUERIES - använd det korrekta technician ID:t
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        // Private cases - ALLA STATUS
        supabase
          .from('private_cases')
          .select('id, clickup_task_id, title, status, priority, created_at, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon, email, adress, skadedjur, beskrivning, billing_status')
          .eq('primary_assignee_id', technicianId)
          .order('created_at', { ascending: false })
          .limit(100),

        // Business cases - ALLA STATUS
        supabase
          .from('business_cases')
          .select('id, clickup_task_id, title, status, priority, created_at, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon, email, adress, foretag, org_nr, skadedjur, beskrivning, billing_status')
          .eq('primary_assignee_id', technicianId)
          .order('created_at', { ascending: false })
          .limit(100),

        // Contract cases - använder assigned_technician_id
        supabase
          .from('cases')
          .select('id, clickup_task_id, title, status, priority, created_date, completed_date, price, assigned_technician_name, billing_status')
          .eq('assigned_technician_id', technicianId)
          .order('created_date', { ascending: false })
          .limit(100)
      ])

      // ✅ LOGGA RESULTAT
      console.log('🔍 QUERY RESULTS:', {
        privateStatus: privateResult.status,
        privateCount: privateResult.status === 'fulfilled' ? privateResult.value.data?.length : 0,
        privateError: privateResult.status === 'fulfilled' ? privateResult.value.error : privateResult.reason,
        
        businessStatus: businessResult.status,
        businessCount: businessResult.status === 'fulfilled' ? businessResult.value.data?.length : 0,
        businessError: businessResult.status === 'fulfilled' ? businessResult.value.error : businessResult.reason,
        
        contractStatus: contractResult.status,
        contractCount: contractResult.status === 'fulfilled' ? contractResult.value.data?.length : 0,
        contractError: contractResult.status === 'fulfilled' ? contractResult.value.error : contractResult.reason
      })

      // ✅ KOMBINERA OCH FORMATTERA ALLA CASES
      const privateCases = privateResult.status === 'fulfilled' && privateResult.value.data ? privateResult.value.data : []
      const businessCases = businessResult.status === 'fulfilled' && businessResult.value.data ? businessResult.value.data : []
      const contractCases = contractResult.status === 'fulfilled' && contractResult.value.data ? contractResult.value.data : []

      console.log('🔍 RAW CASE COUNTS:', {
        privateCases: privateCases.length,
        businessCases: businessCases.length,
        contractCases: contractCases.length,
        expectedPrivate: 142,
        expectedBusiness: 85
      })

      const allCases: TechnicianCase[] = [
        ...privateCases.map(c => ({
          id: c.id,
          clickup_task_id: c.clickup_task_id,
          case_number: `P-${c.clickup_task_id}`,
          title: c.title,
          status: c.status,
          priority: c.priority,
          case_type: 'private' as const,
          created_date: c.start_date || c.created_at,
          completed_date: c.completed_date,
          commission_amount: c.commission_amount,
          case_price: c.pris,
          kontaktperson: c.kontaktperson,
          telefon: c.telefon,
          email: c.email,
          adress: c.adress,
          skadedjur: c.skadedjur,
          beskrivning: c.beskrivning,
          assignee_name: c.primary_assignee_name,
          billing_status: c.billing_status,
          clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
        })),
        ...businessCases.map(c => ({
          id: c.id,
          clickup_task_id: c.clickup_task_id,
          case_number: `B-${c.clickup_task_id}`,
          title: c.title,
          status: c.status,
          priority: c.priority,
          case_type: 'business' as const,
          created_date: c.start_date || c.created_at,
          completed_date: c.completed_date,
          commission_amount: c.commission_amount,
          case_price: c.pris,
          kontaktperson: c.kontaktperson,
          telefon: c.telefon,
          email: c.email,
          adress: c.adress,
          foretag: c.foretag,
          org_nr: c.org_nr,
          skadedjur: c.skadedjur,
          beskrivning: c.beskrivning,
          assignee_name: c.primary_assignee_name,
          billing_status: c.billing_status,
          clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
        })),
        ...contractCases.map(c => ({
          id: c.id,
          clickup_task_id: c.clickup_task_id,
          case_number: `C-${c.clickup_task_id}`,
          title: c.title,
          status: c.status,
          priority: c.priority,
          case_type: 'contract' as const,
          created_date: c.created_date,
          completed_date: c.completed_date,
          commission_amount: 0,
          case_price: c.price,
          assignee_name: c.assigned_technician_name,
          billing_status: c.billing_status,
          clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
        }))
      ]

      // ✅ SORTERA EFTER DATUM (senaste först)
      allCases.sort((a, b) => {
        const dateA = new Date(a.created_date || 0).getTime()
        const dateB = new Date(b.created_date || 0).getTime()
        return dateB - dateA
      })

      // ✅ BERÄKNA STATS
      const newStats: CaseStats = {
        total_cases: allCases.length,
        completed_cases: allCases.filter(c => 
          c.status?.toLowerCase() === 'avslutat' || 
          c.status?.toLowerCase() === 'completed' ||
          c.completed_date
        ).length,
        pending_cases: allCases.filter(c => 
          !c.completed_date && 
          c.status?.toLowerCase() !== 'avslutat' && 
          c.status?.toLowerCase() !== 'completed'
        ).length,
        in_progress_cases: allCases.filter(c => 
          c.status?.toLowerCase().includes('pågående') ||
          c.status?.toLowerCase().includes('progress')
        ).length,
        total_commission: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
      }

      console.log('✅ FINAL RESULTS:', {
        totalCases: allCases.length,
        expectedTotal: 227, // 142 + 85
        stats: newStats,
        firstCase: allCases[0]
      })

      setCases(allCases)
      setStats(newStats)
      
    } catch (error) {
      console.error('💥 DETAILED ERROR:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        technicianId: technicianId
      })
      setError(error instanceof Error ? error.message : 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    if (!cases) {
      setFilteredCases([])
      return
    }

    let filtered = [...cases]

    // Textsökning
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(case_ => 
        case_.title?.toLowerCase().includes(searchLower) ||
        case_.kontaktperson?.toLowerCase().includes(searchLower) ||
        case_.foretag?.toLowerCase().includes(searchLower) ||
        case_.case_number?.toLowerCase().includes(searchLower) ||
        case_.clickup_task_id?.toLowerCase().includes(searchLower)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        filtered = filtered.filter(case_ => 
          case_.status?.toLowerCase() === 'completed' || 
          case_.status?.toLowerCase() === 'avslutat' ||
          case_.status?.toLowerCase() === 'avslutad'
        )
      } else if (statusFilter === 'in progress') {
        filtered = filtered.filter(case_ => 
          case_.status?.toLowerCase().includes('progress') || 
          case_.status?.toLowerCase().includes('pågående')
        )
      } else {
        filtered = filtered.filter(case_ => case_.status?.toLowerCase() === statusFilter.toLowerCase())
      }
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
          comparison = new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime()
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

  const technicianId = getTechnicianId()
  const technicianName = technician?.name || profile?.display_name || 'Tekniker'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-slate-400 mt-4">Laddar ärenden för {technicianName}...</p>
          <p className="text-slate-500 text-sm mt-2">Tekniker-ID: {technicianId}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Problem med att ladda ärenden</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <div className="text-xs text-slate-500 mb-4">
              <p>Tekniker: {technicianName}</p>
              <p>ID: {technicianId}</p>
              <p>Roll: {profile?.role}</p>
            </div>
            <div className="space-y-2">
              <Button onClick={() => technicianId && fetchCasesDirectly(technicianId)} className="w-full">
                Försök igen
              </Button>
              <Button variant="outline" onClick={() => navigate('/technician/dashboard')} className="w-full">
                Tillbaka till dashboard
              </Button>
            </div>
          </div>
        </Card>
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
                <p className="text-sm text-slate-400">
                  Översikt över tilldelade ärenden från ClickUp - {technicianName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 🔍 Success Info */}
        <Card className="p-4 mb-6 bg-green-500/10 border-green-500/30">
          <div className="text-xs text-green-400">
            <p className="font-medium mb-2">✅ Cases Successfully Loaded!</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-400">Tekniker:</p>
                <p>{technicianName}</p>
                <p className="text-slate-500">ID: {technicianId}</p>
              </div>
              <div>
                <p className="text-slate-400">Total cases:</p>
                <p>{cases.length} (Expected: 227)</p>
                <p className="text-slate-500">Private: {cases.filter(c => c.case_type === 'private').length}/142, Business: {cases.filter(c => c.case_type === 'business').length}/85</p>
              </div>
              <div>
                <p className="text-slate-400">Stats:</p>
                <p>Commission: {formatCurrency(stats.total_commission)}</p>
                <p className="text-slate-500">Completed: {stats.completed_cases}</p>
              </div>
              <div>
                <p className="text-slate-400">Filtered:</p>
                <p>{filteredCases.length} showing</p>
              </div>
            </div>
          </div>
        </Card>

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
              <option value="contract">Avtalskunder</option>
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
        {cases.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <ClipboardList className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Inga ärenden hittades</h3>
              <p className="text-slate-400 mb-4">
                Det finns inga ärenden tilldelade till dig i systemet.
              </p>
              <div className="text-xs text-slate-500 bg-slate-800/50 rounded p-4 mb-4">
                <p className="font-medium mb-2">Debug Information:</p>
                <p>• Tekniker-ID: {technicianId}</p>
                <p>• Tekniker-namn: {technicianName}</p>
                <p>• Profil-roll: {profile?.role}</p>
                <p>• Auth UID: {user?.id}</p>
              </div>
              <Button onClick={() => technicianId && fetchCasesDirectly(technicianId)}>
                Uppdatera och försök igen
              </Button>
            </div>
          </Card>
        ) : (
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
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                        <span className={`inline-flex items-center gap-1 ${
                          case_.case_type === 'private' ? 'text-blue-400' : 
                          case_.case_type === 'business' ? 'text-purple-400' : 'text-green-400'
                        }`}>
                          {case_.case_type === 'private' ? <User className="w-3 h-3" /> : 
                           case_.case_type === 'business' ? <Building2 className="w-3 h-3" /> : 
                           <FileText className="w-3 h-3" />}
                          {case_.case_type === 'private' ? 'Privatperson' : 
                           case_.case_type === 'business' ? 'Företag' : 'Avtal'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(case_.created_date)}
                        </span>
                        {case_.completed_date && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            {formatDate(case_.completed_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    {case_.commission_amount && case_.commission_amount > 0 && (
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
                        {case_.org_nr && (
                          <span className="text-slate-500 text-xs">({case_.org_nr})</span>
                        )}
                      </p>
                    )}

                    {case_.telefon && (
                      <p className="text-sm text-slate-300 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <a href={`tel:${case_.telefon}`} className="hover:text-blue-400 transition-colors">
                          {case_.telefon}
                        </a>
                      </p>
                    )}

                    {case_.email && (
                      <p className="text-sm text-slate-300 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <a href={`mailto:${case_.email}`} className="hover:text-blue-400 transition-colors">
                          {case_.email}
                        </a>
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
                      <p className="text-sm text-slate-300 bg-slate-800/50 rounded px-2 py-1 line-clamp-3">
                        {case_.beskrivning}
                      </p>
                    </div>
                  )}

                  {/* Åtgärder */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <div className="text-xs text-slate-400">
                      {case_.case_number ? (
                        <span>Ärendenr: {case_.case_number}</span>
                      ) : (
                        <span>ClickUp: {case_.clickup_task_id}</span>
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
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(case_.clickup_url || `https://app.clickup.com/t/${case_.clickup_task_id}`, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        ClickUp
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-2">
                <Card className="p-12">
                  <div className="text-center">
                    <ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Inga ärenden matchar filtret</h3>
                    <p className="text-slate-400 mb-4">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'Prova att ändra dina filter eller sökord.'
                        : 'Du har inga ärenden som matchar de valda kriterierna.'
                      }
                    </p>
                    <p className="text-slate-500 text-sm mb-4">
                      Totalt: {cases.length} ärenden, Filtrerat: {filteredCases.length}
                    </p>
                    {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm('')
                          setStatusFilter('all')
                          setTypeFilter('all')
                        }}
                      >
                        Rensa filter
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Visningsinfo */}
        {filteredCases.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Visar {filteredCases.length} av {cases.length} ärenden
              {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && ' (filtrerade)'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
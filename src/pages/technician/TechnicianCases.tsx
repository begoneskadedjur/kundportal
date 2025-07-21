// 📁 src/pages/technician/TechnicianCases.tsx - KORRIGERAD MED RÄTT SÖKVÄG

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, ClipboardList, Filter, Search, Eye, ExternalLink,
  Clock, CheckCircle, AlertCircle, User, Building2, Calendar,
  MapPin, Phone, Mail, DollarSign, FileText, Edit
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { supabase } from '../../lib/supabase'
// ✅ KORRIGERAD SÖKVÄG TILL KOMPONENTEN
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'

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
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  adress?: any
  foretag?: string
  org_nr?: string
  skadedjur?: string
  description?: string
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

const getStatusColor = (status: string) => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('avslutat') || lowerStatus.includes('completed')) return 'bg-green-500/20 text-green-400';
  if (lowerStatus.startsWith('återbesök')) return 'bg-cyan-500/20 text-cyan-400';
  if (lowerStatus.includes('bokad') || lowerStatus.includes('offert signerad')) return 'bg-blue-500/20 text-blue-400';
  if (lowerStatus.includes('öppen') || lowerStatus.includes('offert skickad')) return 'bg-yellow-500/20 text-yellow-400';
  if (lowerStatus.includes('review')) return 'bg-purple-500/20 text-purple-400';
  if (lowerStatus.includes('stängt')) return 'bg-slate-600/50 text-slate-400';
  return 'bg-slate-500/20 text-slate-400';
};

const formatAddress = (address: any): string => {
  if (!address) return 'Adress saknas';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      return parsed.formatted_address || address;
    } catch (e) {
      return address;
    }
  }
  return 'Adressinformation ej tillgänglig';
};

const statusOrder = [
  'öppen', 'bokad', 'offert skickad', 'offert signerad - boka in',
  'återbesök 1', 'återbesök 2', 'återbesök 3', 'återbesök 4', 'återbesök 5',
  'privatperson - review', 'stängt - slasklogg', 'avslutat'
];

export default function TechnicianCases() {
  const { user, profile, technician, isTechnician } = useAuth()
  const navigate = useNavigate()
  
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
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'commission' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<TechnicianCase | null>(null);

  const getTechnicianId = () => {
    return profile?.technician_id || technician?.id
  }

  useEffect(() => {
    if (profile && !isTechnician) {
      navigate('/login', { replace: true })
    }
  }, [isTechnician, profile, navigate])

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchCasesDirectly(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  useEffect(() => {
    applyFilters()
  }, [cases, searchTerm, statusFilter, typeFilter, sortBy, sortOrder])

    const fetchCasesDirectly = async (technicianId: string) => {
    if (!technicianId) {
      setError('Ingen tekniker-ID tillgänglig')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase
          .from('private_cases')
          .select('id, clickup_task_id, title, status, priority, created_at, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon_kontaktperson, e_post_kontaktperson, adress, skadedjur, description, billing_status')
          .eq('primary_assignee_id', technicianId)
          .order('created_at', { ascending: false }),
        supabase
          .from('business_cases')
          .select('id, clickup_task_id, title, status, priority, created_at, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon_kontaktperson, e_post_kontaktperson, adress, org_nr, skadedjur, description, billing_status')
          .eq('primary_assignee_id', technicianId)
          .order('created_at', { ascending: false }),
        supabase
          .from('cases')
          .select('id, clickup_task_id, title, status, priority, created_date, completed_date, assigned_technician_name')
          .eq('assigned_technician_id', technicianId)
          .order('created_date', { ascending: false })
      ]);

      if (privateResult.status === 'fulfilled' && privateResult.value.error) throw privateResult.value.error;
      if (businessResult.status === 'fulfilled' && businessResult.value.error) throw businessResult.value.error;
      if (contractResult.status === 'fulfilled' && contractResult.value.error) throw contractResult.value.error;

      const privateCases = privateResult.status === 'fulfilled' && privateResult.value.data ? privateResult.value.data : []
      const businessCases = businessResult.status === 'fulfilled' && businessResult.value.data ? businessResult.value.data : []
      const contractCases = contractResult.status === 'fulfilled' && contractResult.value.data ? contractResult.value.data : []

      const allCases: TechnicianCase[] = [
        ...privateCases.map(c => ({
          id: c.id, clickup_task_id: c.clickup_task_id, case_number: `P-${c.clickup_task_id}`,
          title: c.title, status: c.status, priority: c.priority, case_type: 'private' as const,
          created_date: c.start_date || c.created_at, completed_date: c.completed_date,
          commission_amount: c.commission_amount, case_price: c.pris,
          kontaktperson: c.kontaktperson, telefon_kontaktperson: c.telefon_kontaktperson, e_post_kontaktperson: c.e_post_kontaktperson,
          adress: c.adress, skadedjur: c.skadedjur, description: c.description,
          assignee_name: c.primary_assignee_name, billing_status: c.billing_status,
          clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
        })),
        ...businessCases.map(c => ({
          id: c.id, clickup_task_id: c.clickup_task_id, case_number: `B-${c.clickup_task_id}`,
          title: c.title, status: c.status, priority: c.priority, case_type: 'business' as const,
          created_date: c.start_date || c.created_at, completed_date: c.completed_date,
          commission_amount: c.commission_amount, case_price: c.pris,
          kontaktperson: c.kontaktperson, telefon_kontaktperson: c.telefon_kontaktperson, e_post_kontaktperson: c.e_post_kontaktperson,
          adress: c.adress, org_nr: c.org_nr, skadedjur: c.skadedjur, description: c.description,
          assignee_name: c.primary_assignee_name, billing_status: c.billing_status,
          clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
        })),
        ...contractCases.map(c => ({
          id: c.id, clickup_task_id: c.clickup_task_id, case_number: `C-${c.clickup_task_id}`,
          title: c.title, status: c.status, priority: c.priority, case_type: 'contract' as const,
          created_date: c.created_date, completed_date: c.completed_date,
          commission_amount: 0, case_price: undefined,
          assignee_name: c.assigned_technician_name, billing_status: undefined,
          clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}`
        }))
      ]

      allCases.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())

      const newStats: CaseStats = {
        total_cases: allCases.length,
        completed_cases: allCases.filter(c => c.status?.toLowerCase() === 'avslutat' || c.status?.toLowerCase() === 'completed' || c.completed_date).length,
        pending_cases: allCases.filter(c => !c.completed_date && c.status?.toLowerCase() !== 'avslutat' && c.status?.toLowerCase() !== 'completed').length,
        in_progress_cases: allCases.filter(c => c.status?.toLowerCase().includes('pågående') || c.status?.toLowerCase().includes('progress')).length,
        total_commission: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
      }

      setCases(allCases)
      setStats(newStats)
      
    } catch (error) {
      console.error('💥 DETAILED ERROR:', error)
      setError(error instanceof Error ? `Fel från databasen: ${error.message}` : 'Ett oväntat fel uppstod')
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
    
    if (statusFilter !== 'all') {
      const filterLower = statusFilter.toLowerCase();
      if (filterLower === 'återbesök') {
        filtered = filtered.filter(c => c.status?.toLowerCase().startsWith('återbesök'));
      } else if (filterLower === 'avslutat') {
        filtered = filtered.filter(c => c.status?.toLowerCase() === 'avslutat' || c.status?.toLowerCase() === 'completed');
      } else {
        filtered = filtered.filter(c => c.status?.toLowerCase() === filterLower);
      }
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.case_type === typeFilter)
    }

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
          const getStatusIndex = (status: string | undefined): number => {
            if (!status) return statusOrder.length;
            const lowerStatus = status.toLowerCase();
            const index = statusOrder.findIndex(s => s === lowerStatus || lowerStatus.startsWith(s.split(' ')[0] + ' ' && s.includes('återbesök')));
            return index === -1 ? statusOrder.length : index;
          };
          comparison = getStatusIndex(a.status) - getStatusIndex(b.status);
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    setFilteredCases(filtered)
  }
  
  const handleOpenEditModal = (caseToEdit: TechnicianCase) => {
    setSelectedCase(caseToEdit);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCase(null);
  };

  const handleUpdateSuccess = (updatedCase: TechnicianCase) => {
    setCases(currentCases =>
      currentCases.map(c => (c.id === updatedCase.id ? { ...c, ...updatedCase } : c))
    );
  };


  const technicianId = getTechnicianId()
  const technicianName = technician?.name || profile?.display_name || 'Tekniker'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-slate-400 mt-4">Laddar ärenden för {technicianName}...</p>
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
            <Button onClick={() => technicianId && fetchCasesDirectly(technicianId)} className="w-full">
              Försök igen
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg"><ClipboardList className="w-6 h-6 text-blue-500" /></div>
              <div>
                <h1 className="text-2xl font-bold text-white">Mina Ärenden</h1>
                <p className="text-sm text-slate-400">Översikt över tilldelade ärenden - {technicianName}</p>
              </div>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-slate-400 text-sm">Totalt</p><p className="text-xl font-bold text-white">{stats.total_cases}</p></div><ClipboardList className="w-6 h-6 text-slate-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-green-400 text-sm">Avslutade</p><p className="text-xl font-bold text-white">{stats.completed_cases}</p></div><CheckCircle className="w-6 h-6 text-green-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-blue-400 text-sm">Pågående</p><p className="text-xl font-bold text-white">{stats.in_progress_cases}</p></div><Clock className="w-6 h-6 text-blue-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-yellow-400 text-sm">Väntande</p><p className="text-xl font-bold text-white">{stats.pending_cases}</p></div><AlertCircle className="w-6 h-6 text-yellow-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-purple-400 text-sm">Provision</p><p className="text-lg font-bold text-white">{formatCurrency(stats.total_commission)}</p></div><DollarSign className="w-6 h-6 text-purple-400" /></div></Card>
        </div>

        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <Input placeholder="Sök ärenden, kunder..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<Search className="w-4 h-4" />} />
            </div>
            
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
              <option value="all">Alla statusar</option>
              <option value="Öppen">Öppen</option>
              <option value="Bokad">Bokad</option>
              <option value="Offert skickad">Offert skickad</option>
              <option value="Offert signerad - boka in">Offert signerad - boka in</option>
              <option value="återbesök">Återbesök (Alla)</option>
              <option value="Privatperson - review">Privatperson - review</option>
              <option value="Stängt - slasklogg">Stängt - slasklogg</option>
              <option value="Avslutat">Avslutat</option>
            </select>

            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
              <option value="all">Alla typer</option>
              <option value="private">Privatpersoner</option>
              <option value="business">Företag</option>
              <option value="contract">Avtalskunder</option>
            </select>

            <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [field, order] = e.target.value.split('-'); setSortBy(field as any); setSortOrder(order as any); }} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
              <option value="date-desc">Senaste först</option>
              <option value="date-asc">Äldsta först</option>
              <option value="commission-desc">Högsta provision</option>
              <option value="commission-asc">Lägsta provision</option>
              <option value="status-asc">Status (A-Z anpassad)</option>
              <option value="status-desc">Status (Z-A anpassad)</option>
            </select>
          </div>
        </Card>

        {cases.length === 0 ? (
          <Card className="p-12"><div className="text-center"><ClipboardList className="w-16 h-16 text-slate-400 mx-auto mb-4" /><h3 className="text-xl font-semibold text-white mb-2">Inga ärenden hittades</h3><p className="text-slate-400">Det finns inga ärenden tilldelade till dig.</p></div></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredCases.length > 0 ? (
              filteredCases.map(case_ => (
                <Card key={case_.id} className="p-6 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white text-lg truncate">{case_.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>{case_.status}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                        <span className={`inline-flex items-center gap-1 ${ case_.case_type === 'private' ? 'text-blue-400' : case_.case_type === 'business' ? 'text-purple-400' : 'text-green-400' }`}>{case_.case_type === 'private' ? <User className="w-3 h-3" /> : case_.case_type === 'business' ? <Building2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}{case_.case_type === 'private' ? 'Privatperson' : case_.case_type === 'business' ? 'Företag' : 'Avtal'}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(case_.created_date)}</span>
                        {case_.completed_date && (<span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />{formatDate(case_.completed_date)}</span>)}
                      </div>
                    </div>
                    {case_.commission_amount && case_.commission_amount > 0 && (
                      <div className="text-right"><p className="text-green-400 font-semibold text-lg">{formatCurrency(case_.commission_amount)}</p>{case_.case_price && (<p className="text-slate-400 text-sm">av {formatCurrency(case_.case_price)}</p>)}</div>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {case_.kontaktperson && (<p className="text-sm text-slate-300 flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />{case_.kontaktperson}</p>)}
                    {case_.org_nr && (<p className="text-sm text-slate-300 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" />Org.nr: {case_.org_nr}</p>)}
                    {case_.telefon_kontaktperson && (<p className="text-sm text-slate-300 flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /><a href={`tel:${case_.telefon_kontaktperson}`} className="hover:text-blue-400 transition-colors">{case_.telefon_kontaktperson}</a></p>)}
                    {case_.e_post_kontaktperson && (<p className="text-sm text-slate-300 flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /><a href={`mailto:${case_.e_post_kontaktperson}`} className="hover:text-blue-400 transition-colors">{case_.e_post_kontaktperson}</a></p>)}
                    
                    {case_.adress && (
                      <p className="text-sm text-slate-300 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {formatAddress(case_.adress)}
                      </p>
                    )}
                  </div>

                  {case_.skadedjur && (<div className="mb-4"><p className="text-xs text-slate-400 mb-1">Skadedjur:</p><p className="text-sm text-white bg-slate-800/50 rounded px-2 py-1">{case_.skadedjur}</p></div>)}
                  {case_.description && (<div className="mb-4"><p className="text-xs text-slate-400 mb-1">Beskrivning:</p><p className="text-sm text-slate-300 bg-slate-800/50 rounded px-2 py-1 line-clamp-3">{case_.description}</p></div>)}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <div className="text-xs text-slate-400">{case_.case_number ? (<span>Ärendenr: {case_.case_number}</span>) : (<span>ClickUp: {case_.clickup_task_id}</span>)}</div>
                    
                    <div className="flex items-center gap-2">
                      {case_.billing_status && (<span className={`px-2 py-1 rounded text-xs ${ case_.billing_status === 'paid' ? 'bg-green-500/20 text-green-400' : case_.billing_status === 'sent' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{case_.billing_status === 'paid' ? 'Betald' : case_.billing_status === 'sent' ? 'Skickad' : 'Väntande'}</span>)}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditModal(case_)}
                        className="flex items-center gap-2"
                      >
                          <Edit className="w-3 h-3" />
                          Redigera
                      </Button>

                      <Button size="sm" variant="outline" onClick={() => window.open(case_.clickup_url || `https://app.clickup.com/t/${case_.clickup_task_id}`, '_blank')} className="flex items-center gap-2"><ExternalLink className="w-3 h-3" />ClickUp</Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-2">
                <Card className="p-12"><div className="text-center"><ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">Inga ärenden matchar filtret</h3><p className="text-slate-400">Prova att ändra dina filter eller sökord.</p></div></Card>
              </div>
            )}
          </div>
        )}

        {filteredCases.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">Visar {filteredCases.length} av {cases.length} ärenden {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && ' (filtrerade)'}</p>
          </div>
        )}
      </main>

      <EditCaseModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase}
      />
    </div>
  )
}
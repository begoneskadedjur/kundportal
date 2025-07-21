// 📁 src/pages/technician/TechnicianCases.tsx - KORREKT VERSION MED ALL FUNKTIONALITET OCH NY DESIGN

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardList, Filter, Search, ExternalLink,
  Clock, CheckCircle, AlertCircle, User, Building2, Calendar,
  MapPin, Phone, Mail, DollarSign, FileText, Edit
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { supabase } from '../../lib/supabase'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'

// Interfaces
interface TechnicianCase {
  id: string; clickup_task_id: string; case_number?: string; title: string;
  status: string; priority?: string; case_type: 'private' | 'business' | 'contract';
  created_date: string; completed_date?: string; commission_amount?: number;
  case_price?: number; kontaktperson?: string; telefon_kontaktperson?: string;
  e_post_kontaktperson?: string; adress?: any; foretag?: string; org_nr?: string;
  skadedjur?: string; description?: string; clickup_url?: string;
  assignee_name?: string; billing_status?: 'pending' | 'sent' | 'paid' | 'skip';
}

interface CaseStats {
  total_cases: number; completed_cases: number; pending_cases: number;
  in_progress_cases: number; total_commission: number;
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
    } catch (e) { return address; }
  }
  return 'Adressinformation ej tillgänglig';
};

const statusOrder = [
  'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in',
  'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'
];

export default function TechnicianCases() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cases, setCases] = useState<TechnicianCase[]>([])
  const [stats, setStats] = useState<CaseStats>({ total_cases: 0, completed_cases: 0, pending_cases: 0, in_progress_cases: 0, total_commission: 0 })
  const [filteredCases, setFilteredCases] = useState<TechnicianCase[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Öppen')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'commission' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<TechnicianCase | null>(null);

  useEffect(() => {
    if (profile && !isTechnician) { navigate('/login', { replace: true }) }
  }, [isTechnician, profile, navigate])

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchCasesDirectly(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  useEffect(() => {
    applyFilters()
  }, [cases, searchTerm, statusFilter, typeFilter, sortBy, sortOrder])

  // ✅ ÅTERSTÄLLD, KORREKT FUNKTION
  const fetchCasesDirectly = async (technicianId: string) => {
    if (!technicianId) {
      setError('Ingen tekniker-ID tillgänglig');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select('id, clickup_task_id, title, status, priority, created_at, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon_kontaktperson, e_post_kontaktperson, adress, skadedjur, description, billing_status').eq('primary_assignee_id', technicianId).order('created_at', { ascending: false }),
        supabase.from('business_cases').select('id, clickup_task_id, title, status, priority, created_at, start_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon_kontaktperson, e_post_kontaktperson, adress, org_nr, skadedjur, description, billing_status').eq('primary_assignee_id', technicianId).order('created_at', { ascending: false }),
        supabase.from('cases').select('id, clickup_task_id, title, status, priority, created_date, completed_date, assigned_technician_name').eq('assigned_technician_id', technicianId).order('created_date', { ascending: false })
      ]);
      
      if (privateResult.status === 'fulfilled' && privateResult.value.error) throw privateResult.value.error;
      if (businessResult.status === 'fulfilled' && businessResult.value.error) throw businessResult.value.error;
      if (contractResult.status === 'fulfilled' && contractResult.value.error) throw contractResult.value.error;

      const privateCasesData = privateResult.status === 'fulfilled' ? privateResult.value.data || [] : [];
      const businessCasesData = businessResult.status === 'fulfilled' ? businessResult.value.data || [] : [];
      const contractCasesData = contractResult.status === 'fulfilled' ? contractResult.value.data || [] : [];

      const allCases: TechnicianCase[] = [
        ...privateCasesData.map((c: any) => ({ ...c, case_type: 'private', case_number: `P-${c.clickup_task_id}`, created_date: c.start_date || c.created_at, case_price: c.pris, clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}` })),
        ...businessCasesData.map((c: any) => ({ ...c, case_type: 'business', case_number: `B-${c.clickup_task_id}`, created_date: c.start_date || c.created_at, case_price: c.pris, clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}` })),
        ...contractCasesData.map((c: any) => ({ ...c, case_type: 'contract', case_number: `C-${c.clickup_task_id}`, clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}` }))
      ];

      allCases.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
      
      setCases(allCases);
      
      setStats({
          total_cases: allCases.length,
          completed_cases: allCases.filter(c => c.status?.toLowerCase() === 'avslutat').length,
          pending_cases: allCases.filter(c => c.status?.toLowerCase() === 'öppen').length,
          in_progress_cases: allCases.filter(c => c.status?.toLowerCase().includes('bokad') || c.status?.toLowerCase().includes('återbesök')).length,
          total_commission: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
      });

    } catch (error: any) {
      console.error('💥 DETAILED ERROR:', error);
      setError(error.message || 'Ett oväntat fel uppstod');
    } finally {
      setLoading(false);
    }
  }

  // ✅ ÅTERSTÄLLD, KORREKT FUNKTION
  const applyFilters = () => {
    let filtered = [...cases];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        Object.values(c).some(val => String(val).toLowerCase().includes(searchLower))
      );
    }
    
    if (statusFilter !== 'all') {
      const filterLower = statusFilter.toLowerCase();
      if (filterLower === 'återbesök') {
        filtered = filtered.filter(c => c.status?.toLowerCase().startsWith('återbesök'));
      } else {
        filtered = filtered.filter(c => c.status?.toLowerCase() === filterLower);
      }
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.case_type === typeFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'status':
          const statusA = statusOrder.findIndex(s => s.toLowerCase() === a.status?.toLowerCase());
          const statusB = statusOrder.findIndex(s => s.toLowerCase() === b.status?.toLowerCase());
          comparison = (statusA === -1 ? 99 : statusA) - (statusB === -1 ? 99 : statusB);
          break;
        case 'date':
          comparison = new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime();
          break;
        case 'commission':
          comparison = (a.commission_amount || 0) - (b.commission_amount || 0);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredCases(filtered);
  }

  const handleOpenEditModal = (caseToEdit: TechnicianCase) => {
    setSelectedCase(caseToEdit);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCase(null);
  };

  const handleUpdateSuccess = (updatedCase: Partial<TechnicianCase>) => {
    setCases(currentCases =>
      currentCases.map(c => (c.id === selectedCase?.id ? { ...c, ...updatedCase } : c))
    );
  };

  const technicianName = profile?.display_name || 'Tekniker';

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /><p className="text-slate-400 mt-4">Laddar ärenden...</p></div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Card className="p-8 max-w-md text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-semibold text-white mb-2">Fel vid laddning</h2><p className="text-slate-400 mb-4">{error}</p><Button onClick={() => fetchCasesDirectly(profile?.technician_id || '')} className="w-full">Försök igen</Button></Card></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800"><div className="max-w-7xl mx-auto px-4 py-4"><div className="flex items-center gap-3"><div className="bg-blue-500/10 p-2 rounded-lg"><ClipboardList className="w-6 h-6 text-blue-500" /></div><div><h1 className="text-2xl font-bold text-white">Mina Ärenden</h1><p className="text-sm text-slate-400">Översikt över tilldelade ärenden - {technicianName}</p></div></div></div></header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-slate-400 text-sm">Totalt</p><p className="text-xl font-bold text-white">{stats.total_cases}</p></div><ClipboardList className="w-6 h-6 text-slate-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-green-400 text-sm">Avslutade</p><p className="text-xl font-bold text-white">{stats.completed_cases}</p></div><CheckCircle className="w-6 h-6 text-green-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-blue-400 text-sm">Pågående</p><p className="text-xl font-bold text-white">{stats.in_progress_cases}</p></div><Clock className="w-6 h-6 text-blue-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-yellow-400 text-sm">Väntande</p><p className="text-xl font-bold text-white">{stats.pending_cases}</p></div><AlertCircle className="w-6 h-6 text-yellow-400" /></div></Card>
            <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-purple-400 text-sm">Provision</p><p className="text-lg font-bold text-white">{formatCurrency(stats.total_commission)}</p></div><DollarSign className="w-6 h-6 text-purple-400" /></div></Card>
        </div>

        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64"><Input placeholder="Sök ärenden, kunder..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<Search className="w-4 h-4" />} /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                <option value="all">Alla statusar</option>
                {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="återbesök">Återbesök (Alla)</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"><option value="all">Alla typer</option><option value="private">Privat</option><option value="business">Företag</option><option value="contract">Avtal</option></select>
            <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [f, o] = e.target.value.split('-'); setSortBy(f as any); setSortOrder(o as any); }} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"><option value="date-desc">Senaste</option><option value="date-asc">Äldsta</option><option value="status-asc">Status</option></select>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCases.length > 0 ? (
              filteredCases.map(case_ => (
                <Card key={case_.id} className="p-4 hover:bg-slate-800/50 transition-colors flex flex-col">
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-white text-md pr-2 flex-1">{case_.title}</h3>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>{case_.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                        <span className={`inline-flex items-center gap-1.5 ${case_.case_type === 'private' ? 'text-blue-400' : case_.case_type === 'business' ? 'text-purple-400' : 'text-green-400'}`}><User className="w-3 h-3" />{case_.case_type === 'private' ? 'Privat' : case_.case_type === 'business' ? 'Företag' : 'Avtal'}</span>
                        <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDate(case_.created_date)}</span>
                        {case_.commission_amount && case_.commission_amount > 0 && <span className="text-green-400 flex items-center gap-1.5"><DollarSign className="w-3 h-3"/>{formatCurrency(case_.commission_amount)}</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 border-t border-slate-700/50 pt-3">
                        <div>
                            <p className="font-medium text-slate-300 flex items-center gap-2"><User className="w-4 h-4 text-slate-500"/> {case_.kontaktperson || 'Kontakt saknas'}</p>
                            <p className="text-slate-400 flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500"/> {case_.telefon_kontaktperson || 'Telefon saknas'}</p>
                        </div>
                        <div>
                            <p className="font-medium text-slate-300 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500"/> Adress</p>
                            <p className="text-slate-400">{formatAddress(case_.adress)}</p>
                        </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                    <Button size="sm" onClick={() => handleOpenEditModal(case_)} className="flex items-center gap-2">
                        <Edit className="w-4 h-4" /> Öppna ärende
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(case_.clickup_url, '_blank')} className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Visa i ClickUp
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-1 lg:col-span-2">
                <Card className="p-12"><div className="text-center"><ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">Inga ärenden matchar filtret</h3><p className="text-slate-400">Prova att ändra dina filter eller sökord.</p></div></Card>
              </div>
            )}
        </div>
        
        {filteredCases.length > 0 && (
            <p className="mt-6 text-center text-slate-400 text-sm">Visar {filteredCases.length} av {cases.length} ärenden.</p>
        )}

        <div className="mt-10 max-w-2xl mx-auto p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <h4 className="text-md font-semibold text-slate-200 mb-2">Information om fakturastatus</h4>
            <dl className="text-sm text-slate-400 space-y-2">
                <div>
                    <dt className="font-medium text-slate-300">Väntande (Pending)</dt>
                    <dd>Fakturan är skapad i systemet men har ännu inte skickats till kunden.</dd>
                </div>
                <div>
                    <dt className="font-medium text-slate-300">Skickad (Sent)</dt>
                    <dd>Fakturan är skickad till kunden och vi inväntar betalning.</dd>
                </div>
                <div>
                    <dt className="font-medium text-slate-300">Betald (Paid)</dt>
                    <dd>Kunden har betalat fakturan och ärendet är ekonomiskt avslutat.</dd>
                </div>
            </dl>
        </div>
      </main>

      <EditCaseModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} onSuccess={handleUpdateSuccess} caseData={selectedCase} />
    </div>
  )
}
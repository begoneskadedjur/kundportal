// 📁 src/pages/technician/TechnicianCases.tsx - HELT NY LISTVY MED PAGINERING OCH SORTERING

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardList, Search, ExternalLink, ArrowLeft,
  Clock, CheckCircle, AlertCircle, User, Building2, Calendar,
  MapPin, Phone, Mail, DollarSign, FileText, Edit, ChevronUp, ChevronDown
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
  created_date: string; start_date?: string; due_date?: string; completed_date?: string; 
  commission_amount?: number; case_price?: number; kontaktperson?: string; 
  telefon_kontaktperson?: string; e_post_kontaktperson?: string; adress?: any; 
  foretag?: string; org_nr?: string; skadedjur?: string; description?: string; 
  clickup_url?: string; assignee_name?: string; 
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip';
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
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Öppen')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // ✅ State för sortering och paginering
  const [sortConfig, setSortConfig] = useState<{ key: keyof TechnicianCase; direction: 'asc' | 'desc' }>({ key: 'due_date', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
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

  const fetchCasesDirectly = async (technicianId: string) => {
    setLoading(true);
    setError(null);
    try {
      const selectQuery = 'id, clickup_task_id, title, status, priority, created_at, start_date, due_date, completed_date, commission_amount, pris, primary_assignee_name, kontaktperson, telefon_kontaktperson, e_post_kontaktperson, adress, skadedjur, description, billing_status';
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select(selectQuery).eq('primary_assignee_id', technicianId),
        supabase.from('business_cases').select(`${selectQuery}, org_nr`).eq('primary_assignee_id', technicianId),
        supabase.from('cases').select('id, clickup_task_id, title, status, priority, created_date, completed_date, assigned_technician_name').eq('assigned_technician_id', technicianId)
      ]);
      
      const allCases = [
        ...(privateResult.status === 'fulfilled' ? privateResult.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'private' as const, created_date: c.start_date || c.created_at, case_price: c.pris, clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}` })),
        ...(businessResult.status === 'fulfilled' ? businessResult.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'business' as const, created_date: c.start_date || c.created_at, case_price: c.pris, clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}` })),
        ...(contractResult.status === 'fulfilled' ? contractResult.value.data || [] : []).map((c: any) => ({ ...c, case_type: 'contract' as const, clickup_url: `https://app.clickup.com/t/${c.clickup_task_id}` }))
      ];

      setCases(allCases);
      setStats({
          total_cases: allCases.length,
          completed_cases: allCases.filter(c => c.status?.toLowerCase() === 'avslutat').length,
          pending_cases: allCases.filter(c => c.status?.toLowerCase() === 'öppen').length,
          in_progress_cases: allCases.filter(c => c.status?.toLowerCase().includes('bokad') || c.status?.toLowerCase().includes('återbesök')).length,
          total_commission: allCases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
      });
    } catch (error: any) {
      setError(error.message || 'Ett oväntat fel uppstod');
    } finally {
      setLoading(false);
    }
  }

  // ✅ LOGIK FÖR FILTRERING OCH SORTERING (useMemo för prestanda)
  const filteredAndSortedCases = useMemo(() => {
    let sortableItems = [...cases];

    // Filtrering
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(c => Object.values(c).some(val => String(val).toLowerCase().includes(searchLower)));
    }
    if (statusFilter !== 'all') {
      const filterLower = statusFilter.toLowerCase();
      sortableItems = sortableItems.filter(c => (filterLower === 'återbesök') ? c.status?.toLowerCase().startsWith('återbesök') : c.status?.toLowerCase() === filterLower);
    }
    if (typeFilter !== 'all') {
      sortableItems = sortableItems.filter(c => c.case_type === typeFilter);
    }

    // Sortering
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        let comparison = 0;
        if (sortConfig.key === 'status') {
          comparison = (statusOrder.indexOf(aValue) ?? 99) - (statusOrder.indexOf(bValue) ?? 99);
        } else {
          if (aValue < bValue) comparison = -1;
          if (aValue > bValue) comparison = 1;
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [cases, searchTerm, statusFilter, typeFilter, sortConfig]);

  // ✅ LOGIK FÖR PAGINERING
  const currentTableData = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * itemsPerPage;
    const lastPageIndex = firstPageIndex + itemsPerPage;
    return filteredAndSortedCases.slice(firstPageIndex, lastPageIndex);
  }, [currentPage, itemsPerPage, filteredAndSortedCases]);

  const requestSort = (key: keyof TechnicianCase) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleOpenEditModal = (caseToEdit: TechnicianCase) => { setSelectedCase(caseToEdit); setIsEditModalOpen(true); };
  const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedCase(null); };
  const handleUpdateSuccess = (updatedCase: Partial<TechnicianCase>) => { setCases(currentCases => currentCases.map(c => (c.id === selectedCase?.id ? { ...c, ...updatedCase } : c))); };

  const technicianName = profile?.display_name || 'Tekniker';

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /><p className="text-slate-400 mt-4">Laddar ärenden...</p></div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Card className="p-8 max-w-md text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-semibold text-white mb-2">Fel vid laddning</h2><p className="text-slate-400 mb-4">{error}</p><Button onClick={() => fetchCasesDirectly(profile?.technician_id || '')} className="w-full">Försök igen</Button></Card></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg"><ClipboardList className="w-6 h-6 text-blue-500" /></div>
              <div><h1 className="text-2xl font-bold text-white">Mina Ärenden</h1><p className="text-sm text-slate-400">Översikt över tilldelade ärenden - {technicianName}</p></div>
            </div>
            {/* ✅ TILLBAKA-KNAPP */}
            <Button variant="secondary" onClick={() => navigate('/technician/dashboard')}><ArrowLeft className="w-4 h-4 mr-2"/>Tillbaka</Button>
        </div>
      </header>

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
          </div>
        </Card>

        {/* ✅ NY TABELL-VY */}
        <div className="bg-slate-900/50 rounded-lg overflow-hidden border border-slate-800">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50 text-xs text-slate-400 uppercase">
                    <tr>
                        <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('title')}>Ärende</th>
                        <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('status')}>
                            <div className="flex items-center">Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />)}</div>
                        </th>
                        <th scope="col" className="px-6 py-3">Kund</th>
                        <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('due_date')}>
                            <div className="flex items-center">Förfallodatum {sortConfig.key === 'due_date' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />)}</div>
                        </th>
                        <th scope="col" className="px-6 py-3 text-right">Åtgärder</th>
                    </tr>
                </thead>
                <tbody>
                    {currentTableData.map(case_ => (
                        <tr key={case_.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-medium text-white">{case_.title}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>{case_.status}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">{case_.kontaktperson || 'Okänd'}</td>
                            <td className="px-6 py-4 text-slate-300">{case_.due_date ? formatDate(case_.due_date) : 'Inget'}</td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button size="sm" onClick={() => handleOpenEditModal(case_)}><Edit className="w-4 h-4 mr-2" />Öppna</Button>
                                    <Button size="sm" variant="outline" onClick={() => window.open(case_.clickup_url, '_blank')}><ExternalLink className="w-4 h-4" /></Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* ✅ PAGINERINGS-KONTROLLER */}
            <div className="flex items-center justify-between p-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                    <span>Visa</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white">
                        {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                    <span>per sida</span>
                </div>
                <span>Visar {Math.min(filteredAndSortedCases.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(currentPage * itemsPerPage, filteredAndSortedCases.length)} av {filteredAndSortedCases.length} ärenden</span>
                <div className="flex gap-2">
                    <Button onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1}>Föregående</Button>
                    <Button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage * itemsPerPage >= filteredAndSortedCases.length}>Nästa</Button>
                </div>
            </div>
        </div>
      </main>

      <EditCaseModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} onSuccess={handleUpdateSuccess} caseData={selectedCase} />
    </div>
  )
}
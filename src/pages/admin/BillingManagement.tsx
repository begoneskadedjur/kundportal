// 📁 src/pages/admin/BillingManagement.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, FileText, Eye, Check, X, Clock, Search, RotateCcw, ChevronDown, ChevronUp, User, Building2 } from 'lucide-react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { BillingModal } from '../../components/admin/billing/BillingModal';
import type { BillingCase, BillingStatus, SortField, SortDirection } from '../../types/billing';

const BillingManagement: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<BillingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<BillingCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<BillingStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ field: 'completed_date', direction: 'desc' });

  useEffect(() => {
    fetchBillingCases();
  }, []);

  const fetchBillingCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectQuery = `
        id, case_number, title, pris, completed_date, primary_assignee_name, skadedjur, adress, description, rapport,
        markning_faktura, kontaktperson, e_post_faktura, e_post_kontaktperson, telefon_kontaktperson,
        bestallare, org_nr, personnummer, r_fastighetsbeteckning, billing_status, billing_updated_at
      `;
      const [privateResult, businessResult] = await Promise.all([
        supabase.from('private_cases').select(selectQuery).eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('business_cases').select(selectQuery).eq('status', 'Avslutat').not('pris', 'is', null)
      ]);

      if (privateResult.error) throw new Error(`Private cases: ${privateResult.error.message}`);
      if (businessResult.error) throw new Error(`Business cases: ${businessResult.error.message}`);

      const allCases: BillingCase[] = [
        ...(privateResult.data || []).map(c => ({...c, type: 'private' as const, billing_status: c.billing_status || 'pending'})),
        ...(businessResult.data || []).map(c => ({...c, type: 'business' as const, billing_status: c.billing_status || 'pending'}))
      ];
      setCases(allCases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av data.');
    } finally {
      setLoading(false);
    }
  };

  const updateBillingStatus = async (caseId: string, type: 'private' | 'business', status: Exclude<BillingStatus, 'all'>) => {
    setProcessingIds(prev => new Set(prev).add(caseId));
    try {
      const { data, error } = await supabase.from(type === 'private' ? 'private_cases' : 'business_cases')
        .update({ billing_status: status, billing_updated_at: new Date().toISOString() })
        .eq('id', caseId).select().single();
      if (error) throw error;
      handleCaseUpdate(data);
    } catch (err) {
      console.error('❌ updateBillingStatus error:', err);
    } finally {
      setProcessingIds(prev => { const newSet = new Set(prev); newSet.delete(caseId); return newSet });
    }
  };

  const handleCaseUpdate = (updatedCase: BillingCase) => {
    setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
  };

  const filteredAndSortedCases = useMemo(() => {
    let filtered = cases;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.billing_status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        Object.values(c).some(val => String(val).toLowerCase().includes(term))
      );
    }
    return [...filtered].sort((a, b) => {
        const field = sortConfig.field;
        let aVal = a[field as keyof BillingCase] ?? '';
        let bVal = b[field as keyof BillingCase] ?? '';

        if (field === 'completed_date') {
            aVal = new Date(a.completed_date || 0).getTime();
            bVal = new Date(b.completed_date || 0).getTime();
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [cases, statusFilter, searchTerm, sortConfig]);

  const summary = useMemo(() => {
    return cases.reduce((acc, c) => {
      const key = c.billing_status || 'pending';
      const total = c.type === 'private' ? c.pris : c.pris * 1.25;
      if (!acc[key]) acc[key] = { count: 0, total: 0 };
      acc[key].count++;
      acc[key].total += total;
      return acc;
    }, {} as Record<BillingStatus, { count: number; total: number }>);
  }, [cases]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({ field, direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };
  
  const handleCaseClick = (case_: BillingCase) => {
    setSelectedCase(case_);
    setIsModalOpen(true);
  };
  
  const getDisplayName = (case_: BillingCase) => case_.type === 'business' ? (case_.title || case_.kontaktperson || "Företagskund") : (case_.kontaktperson || case_.title || "Privatkund");
  
  const getBillingStatusBadge = (status: BillingStatus) => {
    const statusMap = {
        pending: { label: 'Väntar', Icon: Clock, color: 'yellow' },
        sent: { label: 'Skickad', Icon: FileText, color: 'blue' },
        paid: { label: 'Betald', Icon: Check, color: 'green' },
        skip: { label: 'Ej faktura', Icon: X, color: 'gray' },
        all: { label: 'Okänd', Icon: X, color: 'slate' },
    };
    const { label, Icon, color } = statusMap[status];
    return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}><Icon className="w-3 h-3 mr-1" />{label}</span>;
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-950"><LoadingSpinner /></div>;
  if (error) return <div className="p-8 text-center text-red-400">{error} <Button onClick={fetchBillingCases}>Försök igen</Button></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Tillbaka</Button>
                  <div>
                      <h1 className="text-2xl font-bold text-white">Fakturering</h1>
                      <p className="text-sm text-slate-400">{cases.length} totala ärenden</p>
                  </div>
              </div>
              <Button onClick={fetchBillingCases} disabled={loading} className="flex items-center gap-2"><RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Uppdatera</Button>
          </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* KPI Cards */}
        </div>
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                  {(['all', 'pending', 'sent', 'paid', 'skip'] as BillingStatus[]).map(key => (
                      <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === key ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                          {key.charAt(0).toUpperCase() + key.slice(1)} ({key === 'all' ? cases.length : (summary[key]?.count || 0)})
                      </button>
                  ))}
              </div>
              <div className="relative w-full lg:w-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder="Sök..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white w-full lg:w-80" /></div>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-800/50">
                    <tr>
                        <th className="p-4 text-left text-sm font-semibold text-slate-300"><button onClick={() => handleSort('completed_date')} className="flex items-center gap-1">Datum {sortConfig.field === 'completed_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</button></th>
                        <th className="p-4 text-left text-sm font-semibold text-slate-300">Ärende</th>
                        <th className="p-4 text-left text-sm font-semibold text-slate-300"><button onClick={() => handleSort('primary_assignee_name')} className="flex items-center gap-1">Tekniker {sortConfig.field === 'primary_assignee_name' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</button></th>
                        <th className="p-4 text-left text-sm font-semibold text-slate-300">Kund</th>
                        <th className="p-4 text-right text-sm font-semibold text-slate-300"><button onClick={() => handleSort('pris')} className="flex items-center gap-1 ml-auto">Att fakturera {sortConfig.field === 'pris' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</button></th>
                        <th className="p-4 text-center text-sm font-semibold text-slate-300"><button onClick={() => handleSort('billing_status')} className="flex items-center gap-1 mx-auto">Status {sortConfig.field === 'billing_status' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</button></th>
                        <th className="p-4 text-center text-sm font-semibold text-slate-300">Åtgärder</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {filteredAndSortedCases.map((case_) => (
                        <tr key={case_.id} className="hover:bg-slate-800/30">
                            <td className="p-4 whitespace-nowrap"><div className="text-sm text-slate-300">{new Date(case_.completed_date).toLocaleDateString('sv-SE')}</div></td>
                            <td className="p-4"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>{case_.type === 'private' ? <User className="w-4 h-4 text-purple-400" /> : <Building2 className="w-4 h-4 text-blue-400" />}</div><div className="flex-1"><div className="text-sm font-medium text-white">{case_.case_number || 'Okänt nr'}</div><div className="text-xs text-slate-400 truncate max-w-xs">{case_.title}</div></div></div></td>
                            <td className="p-4"><div className="text-sm text-slate-300">{case_.primary_assignee_name}</div></td>
                            <td className="p-4"><div className="text-sm text-slate-300">{getDisplayName(case_)}</div></td>
                            <td className="p-4 text-right whitespace-nowrap"><div className="text-sm font-medium text-white">{formatCurrency(case_.type === 'private' ? case_.pris : case_.pris * 1.25)}</div></td>
                            <td className="p-4 text-center">{getBillingStatusBadge(case_.billing_status as BillingStatus)}</td>
                            <td className="p-4">
                                <div className="flex items-center justify-center gap-1">
                                    {case_.billing_status === 'pending' && <button onClick={() => updateBillingStatus(case_.id, case_.type, 'sent')} disabled={processingIds.has(case_.id)} className="p-2 text-blue-400 hover:text-white rounded-lg" title="Markera som skickad"><FileText size={16} /></button>}
                                    {case_.billing_status === 'sent' && <button onClick={() => updateBillingStatus(case_.id, case_.type, 'pending')} disabled={processingIds.has(case_.id)} className="p-2 text-yellow-400 hover:text-white rounded-lg" title="Flytta till väntande"><RotateCcw size={16} /></button>}
                                    {(case_.billing_status === 'pending' || case_.billing_status === 'sent') && (<>
                                        <button onClick={() => updateBillingStatus(case_.id, case_.type, 'paid')} disabled={processingIds.has(case_.id)} className="p-2 text-green-400 hover:text-white rounded-lg" title="Markera som betald"><Check size={16} /></button>
                                        <button onClick={() => updateBillingStatus(case_.id, case_.type, 'skip')} disabled={processingIds.has(case_.id)} className="p-2 text-gray-400 hover:text-white rounded-lg" title="Ska ej faktureras"><X size={16} /></button>
                                    </>)}
                                    {(case_.billing_status === 'paid' || case_.billing_status === 'skip') && <button onClick={() => updateBillingStatus(case_.id, case_.type, 'pending')} disabled={processingIds.has(case_.id)} className="p-2 text-yellow-400 hover:text-white rounded-lg" title="Återställ"><RotateCcw size={16} /></button>}
                                    <button onClick={() => handleCaseClick(case_)} className="p-2 text-slate-400 hover:text-white rounded-lg" title="Visa/Redigera detaljer"><Eye size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
          {filteredAndSortedCases.length === 0 && <div className="p-8 text-center text-slate-400">Inga ärenden matchade dina filter.</div>}
        </Card>
      </main>

      <BillingModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedCase(null); }}
        onCaseUpdate={handleCaseUpdate}
      />
    </div>
  );
};

export default BillingManagement;
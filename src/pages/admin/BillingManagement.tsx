// 📁 src/pages/admin/BillingManagement.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../utils/formatters'
import { ArrowLeft, FileText, Eye, Check, X, Clock, Search, RotateCcw, ChevronDown, ChevronUp, User, Building2 } from 'lucide-react'

// Importera UI-komponenter
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

// Importera den nya modalen och delade typer
import { BillingModal } from '../../components/admin/billing/BillingModal'
import type { BillingCase, BillingStatus, SortField, SortDirection } from '../../types/billing'

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
        let aVal = a[sortConfig.field as keyof BillingCase] ?? '';
        let bVal = b[sortConfig.field as keyof BillingCase] ?? '';
        if (sortConfig.field === 'completed_date') {
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
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<BillingStatus, number>);
  }, [cases]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleCaseClick = (case_: BillingCase) => {
    setSelectedCase(case_);
    setIsModalOpen(true);
  };
  
  // ... (getBillingStatusBadge and getDisplayName can be moved to a utils file later)
  const getBillingStatusBadge = (status: string) => { /* ...samma som tidigare... */ }
  const getDisplayName = (case_: BillingCase) => { /* ...samma som tidigare... */ }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-950"><LoadingSpinner /></div>;
  if (error) return <div className="p-8 text-red-400 text-center">{error} <Button onClick={fetchBillingCases}>Försök igen</Button></div>;

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
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                  {(['all', 'pending', 'sent', 'paid', 'skip'] as BillingStatus[]).map(key => (
                      <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === key ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                          {key.charAt(0).toUpperCase() + key.slice(1)} ({key === 'all' ? cases.length : (summary[key] || 0)})
                      </button>
                  ))}
              </div>
              <div className="relative w-full lg:w-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder="Sök..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white w-full lg:w-80" /></div>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
                {/* ... (thead med sorteringsknappar, samma som tidigare) ... */}
                <tbody className="divide-y divide-slate-800">
                    {filteredAndSortedCases.map(case_ => (
                        <tr key={case_.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* ... (alla <td>-element för tabellraden) ... */}
                            <td className="py-4 px-4">
                                <div className="flex items-center justify-center gap-1">
                                    {/* ... (alla status-knappar) ... */}
                                    <button onClick={() => handleCaseClick(case_)} className="p-2 text-slate-400 hover:text-white" title="Visa/Redigera detaljer"><Eye className="w-4 h-4" /></button>
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
        onClose={() => setIsModalOpen(false)}
        onCaseUpdate={handleCaseUpdate}
      />
    </div>
  );
};

export default BillingManagement;
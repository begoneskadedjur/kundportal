// 📁 src/pages/admin/BillingManagement.tsx - MED ANVÄNDARSPÅRNING
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext'; // Lägg till för att få användarinfo
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, FileText, Eye, Check, X, Clock, Search, RotateCcw, ChevronDown, ChevronUp, User, Building2, DollarSign, TrendingUp, AlertTriangle, UserIcon } from 'lucide-react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { BillingModal } from '../../components/admin/billing/BillingModal';
import type { BillingCase, BillingStatus, SortField, SortDirection } from '../../types/billing';

// 🆕 Utökad interface för användarspårning
interface EnhancedBillingCase extends BillingCase {
  billing_updated_by?: string; // E-post eller namn på användaren som uppdaterade
  billing_updated_by_id?: string; // User ID
}

// 📊 KPI-kort för faktureringsstatus (kompakt version)
const BillingKpiCards: React.FC<{ summary: Record<BillingStatus, { count: number; total: number }> }> = ({ summary }) => {
  return (
    <Card className="mb-6">
      <div className="p-6">
        <h3 className="text-lg font-medium text-white mb-4">Faktureringsammanfattning</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-yellow-400 font-medium">Väntar på fakturering</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(summary.pending?.total || 0)}</p>
            <p className="text-yellow-400/70 text-xs">{summary.pending?.count || 0} ärenden</p>
          </div>
          
          <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-blue-400 font-medium">Skickade fakturor</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(summary.sent?.total || 0)}</p>
            <p className="text-blue-400/70 text-xs">{summary.sent?.count || 0} ärenden</p>
          </div>
          
          <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-green-400 font-medium">Betalda fakturor</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(summary.paid?.total || 0)}</p>
            <p className="text-green-400/70 text-xs">{summary.paid?.count || 0} ärenden</p>
          </div>
          
          <div className="text-center p-4 bg-gray-500/10 rounded-lg border border-gray-500/20">
            <p className="text-gray-400 font-medium">Ej faktureras</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(summary.skip?.total || 0)}</p>
            <p className="text-gray-400/70 text-xs">{summary.skip?.count || 0} ärenden</p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Total potentiell intäkt:</span>
            <span className="text-xl font-bold text-white">
              {formatCurrency((summary.pending?.total || 0) + (summary.sent?.total || 0) + (summary.paid?.total || 0))}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

const BillingManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // 🆕 Hämta inloggad användare
  const [cases, setCases] = useState<EnhancedBillingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<EnhancedBillingCase | null>(null);
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
      // 🆕 Utökade kolumner för användarspårning
      const commonFields = `
        id, case_number, title, pris, completed_date, primary_assignee_name, skadedjur, adress, description, rapport,
        kontaktperson, e_post_kontaktperson, telefon_kontaktperson,
        billing_status, billing_updated_at, billing_updated_by, billing_updated_by_id
      `;

      const privateSelectQuery = `
        ${commonFields},
        personnummer,
        r_fastighetsbeteckning
      `;

      const businessSelectQuery = `
        ${commonFields},
        markning_faktura,
        e_post_faktura,
        bestallare,
        org_nr
      `;

      const [privateResult, businessResult] = await Promise.all([
        supabase.from('private_cases').select(privateSelectQuery).eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('business_cases').select(businessSelectQuery).eq('status', 'Avslutat').not('pris', 'is', null)
      ]);

      if (privateResult.error) throw new Error(`Private cases: ${privateResult.error.message}`);
      if (businessResult.error) throw new Error(`Business cases: ${businessResult.error.message}`);

      const allCases: EnhancedBillingCase[] = [
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

  // 🆕 Uppdaterad funktion med användarspårning (fokus på e-post)
  const updateBillingStatus = async (caseId: string, type: 'private' | 'business', status: Exclude<BillingStatus, 'all'>) => {
    setProcessingIds(prev => new Set(prev).add(caseId));
    try {
      // 🆕 Använd e-post som primär identifierare
      const userEmail = user?.email || 'Okänd användare';
      const userId = user?.id || null;

      console.log(`🔄 Updating billing status for case ${caseId} to ${status} by ${userEmail}`);

      const updateData = {
        billing_status: status,
        billing_updated_at: new Date().toISOString(),
        billing_updated_by: userEmail, // Använd e-post för tydlighet
        billing_updated_by_id: userId
      };

      const { data, error } = await supabase
        .from(type === 'private' ? 'private_cases' : 'business_cases')
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single();

      if (error) throw error;

      // 🆕 Skapa audit log-post med e-post
      await createAuditLog(caseId, type, status, userEmail);

      handleCaseUpdate(data);
      console.log(`✅ Updated case ${caseId} to status: ${status} by ${userEmail}`);
    } catch (err) {
      console.error('❌ updateBillingStatus error:', err);
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering av faktureringsstatus');
    } finally {
      setProcessingIds(prev => { const newSet = new Set(prev); newSet.delete(caseId); return newSet });
    }
  };

  // 🆕 Skapa audit log-post för fullständig spårning
  const createAuditLog = async (caseId: string, caseType: string, newStatus: string, userEmail: string) => {
    try {
      const auditData = {
        case_id: caseId,
        case_type: caseType,
        action: 'billing_status_change',
        old_value: cases.find(c => c.id === caseId)?.billing_status || 'unknown',
        new_value: newStatus,
        changed_by: userEmail,
        changed_at: new Date().toISOString(),
        metadata: {
          user_id: user?.id,
          ip_address: 'Unknown', // Kan läggas till senare
          user_agent: navigator.userAgent
        }
      };

      // Försök skapa audit log, men misslyckas inte om tabellen inte finns
      const { error } = await supabase
        .from('billing_audit_log')
        .insert([auditData]);

      if (error) {
        console.warn('Audit log creation failed (table may not exist):', error.message);
      } else {
        console.log('✅ Audit log created successfully');
      }
    } catch (err) {
      console.warn('Audit log creation failed:', err);
      // Inte kritiskt, så vi fortsätter
    }
  };

  const handleCaseUpdate = (updatedCase: EnhancedBillingCase) => {
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
        let aVal = a[field as keyof EnhancedBillingCase] ?? '';
        let bVal = b[field as keyof EnhancedBillingCase] ?? '';

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
  
  const handleCaseClick = (case_: EnhancedBillingCase) => {
    setSelectedCase(case_);
    setIsModalOpen(true);
  };
  
  const getDisplayName = (case_: EnhancedBillingCase) => case_.type === 'business' ? (case_.title || case_.kontaktperson || "Företagskund") : (case_.kontaktperson || case_.title || "Privatkund");
  
  const getBillingStatusBadge = (status: BillingStatus) => {
    const statusMap = {
        pending: { label: 'Väntar', Icon: Clock, color: 'yellow' },
        sent: { label: 'Skickad', Icon: FileText, color: 'blue' },
        paid: { label: 'Betald', Icon: Check, color: 'green' },
        skip: { label: 'Ej faktura', Icon: X, color: 'gray' },
        all: { label: 'Okänd', Icon: X, color: 'slate' },
    };
    const { label, Icon, color } = statusMap[status];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </span>
    );
  }

  // 🆕 Funktion för att visa vem som uppdaterade status (med e-post)
  const getLastUpdatedInfo = (case_: EnhancedBillingCase) => {
    if (!case_.billing_updated_at) return null;
    
    const updatedDate = new Date(case_.billing_updated_at).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Använd e-post och förkorta om den är för lång
    const updatedBy = case_.billing_updated_by || 'Okänd användare';
    const displayEmail = updatedBy.length > 20 
      ? updatedBy.split('@')[0] + '@...' 
      : updatedBy;
    
    return (
      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1" title={`Uppdaterad av: ${updatedBy}`}>
        <UserIcon className="w-3 h-3" />
        <span className="truncate max-w-32">{updatedDate}</span>
        <br />
        <span className="truncate max-w-32 text-slate-500">{displayEmail}</span>
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-950"><LoadingSpinner /></div>;
  if (error) return (
    <div className="p-8 text-center bg-slate-950 text-red-400 min-h-screen">
      <h2 className="text-xl mb-4">Ett fel uppstod</h2>
      <pre className="p-4 bg-slate-800 rounded-md text-left text-sm whitespace-pre-wrap">{error}</pre>
      <Button onClick={fetchBillingCases} className="mt-6">Försök igen</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Tillbaka</Button>
                  <div>
                      <h1 className="text-2xl font-bold text-white">Fakturering</h1>
                      <p className="text-sm text-slate-400">{cases.length} totala ärenden • Inloggad som: <span className="text-blue-400 font-medium">{user?.email}</span></p>
                  </div>
              </div>
              <Button onClick={fetchBillingCases} disabled={loading} className="flex items-center gap-2"><RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Uppdatera</Button>
          </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <BillingKpiCards summary={summary} />
        
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                  {(['all', 'pending', 'sent', 'paid', 'skip'] as BillingStatus[]).map(key => {
                    const labels = {
                      all: 'Alla',
                      pending: 'Väntar',
                      sent: 'Skickad', 
                      paid: 'Betald',
                      skip: 'Ej faktura'
                    };
                    return (
                      <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === key ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                          {labels[key]} ({key === 'all' ? cases.length : (summary[key]?.count || 0)})
                      </button>
                    );
                  })}
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
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                {getBillingStatusBadge(case_.billing_status as BillingStatus)}
                                {/* 🆕 Visa vem som uppdaterade status */}
                                {getLastUpdatedInfo(case_)}
                              </div>
                            </td>
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
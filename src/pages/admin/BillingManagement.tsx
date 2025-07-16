// 📁 src/pages/admin/BillingManagement.tsx - DEBUG OCH FIX AUDIT LOG
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { 
  ArrowLeft, FileText, Eye, Check, X, Clock, Search, RotateCcw, 
  ChevronDown, ChevronUp, User, Building2, DollarSign, TrendingUp, 
  AlertTriangle, UserIcon, History, Calendar, Filter, CalendarRange
} from 'lucide-react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { BillingModal } from '../../components/admin/billing/BillingModal';
import type { BillingCase, BillingStatus, SortField, SortDirection } from '../../types/billing';

// Interfaces (samma som tidigare)
interface BillingAuditEntry {
  id: string;
  case_id: string;
  case_type: 'private' | 'business';
  action: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
  metadata?: any;
  case_number?: string;
  customer_name?: string;
}

interface EnhancedBillingCase extends BillingCase {
  billing_updated_by?: string;
  billing_updated_by_id?: string;
}

interface DateFilter {
  type: 'day' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  label: string;
}

// KPI Cards (samma som tidigare)
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

// 🔧 DEBUG - Test audit log connection
const TestAuditLogConnection: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  
  const testAuditLog = async () => {
    try {
      console.log('🧪 Testing audit log connection...');
      
      // Test 1: Kontrollera om tabellen finns och är tillgänglig
      const { data: tableTest, error: tableError } = await supabase
        .from('billing_audit_log')
        .select('count', { count: 'exact', head: true });
      
      if (tableError) {
        setTestResult(`❌ Tabell-test misslyckades: ${tableError.message}`);
        return;
      }
      
      console.log('✅ Tabell finns och är tillgänglig');
      
      // Test 2: Försök läsa existerande data
      const { data: existingData, error: readError } = await supabase
        .from('billing_audit_log')
        .select('*')
        .limit(5);
      
      if (readError) {
        setTestResult(`❌ Read-test misslyckades: ${readError.message}`);
        return;
      }
      
      console.log('✅ Kan läsa från tabellen, antal rader:', existingData?.length || 0);
      
      // Test 3: Försök skriva test-data
      const testEntry = {
        case_id: 'test-case-id',
        case_type: 'private',
        action: 'billing_status_change',
        old_value: 'pending',
        new_value: 'sent',
        changed_by: 'test@example.com',
        changed_at: new Date().toISOString(),
        metadata: { test: true }
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('billing_audit_log')
        .insert([testEntry])
        .select()
        .single();
      
      if (insertError) {
        setTestResult(`❌ Insert-test misslyckades: ${insertError.message}`);
        return;
      }
      
      console.log('✅ Kan skriva till tabellen:', insertData);
      
      // Test 4: Rensa test-data
      await supabase
        .from('billing_audit_log')
        .delete()
        .eq('case_id', 'test-case-id');
      
      setTestResult(`✅ Audit log fungerar perfekt! Existerande rader: ${existingData?.length || 0}`);
      
    } catch (err) {
      console.error('🔥 Test misslyckades:', err);
      setTestResult(`❌ Oväntat fel: ${err}`);
    }
  };
  
  return (
    <div className="mb-4 p-4 bg-slate-800 rounded-lg">
      <div className="flex items-center gap-4">
        <Button onClick={testAuditLog} size="sm" variant="secondary">
          🧪 Testa Audit Log
        </Button>
        {testResult && (
          <span className={`text-sm ${testResult.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
            {testResult}
          </span>
        )}
      </div>
    </div>
  );
};

// 🔧 FÖRBÄTTRAD updateBillingStatus med detaljerad debugging
const BillingManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<EnhancedBillingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<EnhancedBillingCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Historik states
  const [isCaseHistoryOpen, setIsCaseHistoryOpen] = useState(false);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<{ id: string; number: string } | null>(null);
  
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
      const commonFields = `
        id, case_number, title, pris, completed_date, primary_assignee_name, skadedjur, adress, description, rapport,
        kontaktperson, e_post_kontaktperson, telefon_kontaktperson,
        billing_status, billing_updated_at, billing_updated_by, billing_updated_by_id
      `;

      const privateSelectQuery = `${commonFields}, personnummer, r_fastighetsbeteckning`;
      const businessSelectQuery = `${commonFields}, markning_faktura, e_post_faktura, bestallare, org_nr`;

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

  // 🔧 KRAFTIGT FÖRBÄTTRAD updateBillingStatus med steg-för-steg debugging
  const updateBillingStatus = async (caseId: string, type: 'private' | 'business', status: Exclude<BillingStatus, 'all'>) => {
    setProcessingIds(prev => new Set(prev).add(caseId));
    
    try {
      const userEmail = user?.email || 'Okänd användare';
      const userId = user?.id || null;
      const currentCase = cases.find(c => c.id === caseId);
      const oldStatus = currentCase?.billing_status || 'pending';

      console.log('🔄 === BILLING STATUS UPDATE START ===');
      console.log(`📋 Case ID: ${caseId}`);
      console.log(`📝 Type: ${type}`);
      console.log(`🔄 Status change: ${oldStatus} → ${status}`);
      console.log(`👤 User: ${userEmail} (${userId})`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

      // Steg 1: Uppdatera case-tabellen
      console.log('🏗️ Step 1: Updating case table...');
      const updateData = {
        billing_status: status,
        billing_updated_at: new Date().toISOString(),
        billing_updated_by: userEmail,
        billing_updated_by_id: userId
      };

      const table = type === 'private' ? 'private_cases' : 'business_cases';
      console.log(`📊 Updating table: ${table}`);
      console.log('📝 Update data:', updateData);

      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single();

      if (error) {
        console.error('❌ Case table update failed:', error);
        throw error;
      }
      
      console.log('✅ Case table updated successfully:', data);

      // Steg 2: Skapa audit log entry
      console.log('🏗️ Step 2: Creating audit log entry...');
      const auditData = {
        case_id: caseId,
        case_type: type,
        action: 'billing_status_change',
        old_value: oldStatus,
        new_value: status,
        changed_by: userEmail,
        changed_at: new Date().toISOString(),
        metadata: {
          user_id: userId,
          user_agent: navigator.userAgent,
          case_number: currentCase?.case_number || null,
          timestamp: Date.now()
        }
      };

      console.log('📝 Audit data to insert:', auditData);

      const { data: auditResult, error: auditError } = await supabase
        .from('billing_audit_log')
        .insert([auditData])
        .select()
        .single();

      if (auditError) {
        console.error('❌ Audit log creation failed:', auditError);
        console.error('📊 Audit error details:', {
          message: auditError.message,
          details: auditError.details,
          hint: auditError.hint,
          code: auditError.code
        });
        
        // Visa felmeddelande till användaren men fortsätt
        setError(`Varning: Audit log misslyckades - ${auditError.message}. Status uppdaterades ändå.`);
      } else {
        console.log('✅ Audit log created successfully:', auditResult);
        // Rensa eventuella tidigare felmeddelanden
        setError(null);
      }

      // Steg 3: Uppdatera UI
      console.log('🏗️ Step 3: Updating UI...');
      handleCaseUpdate(data);
      
      console.log('✅ === BILLING STATUS UPDATE COMPLETE ===');
      
    } catch (err) {
      console.error('💥 === BILLING STATUS UPDATE FAILED ===');
      console.error('Error details:', err);
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering av faktureringsstatus');
    } finally {
      setProcessingIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(caseId); 
        return newSet;
      });
    }
  };

  const handleCaseUpdate = (updatedCase: EnhancedBillingCase) => {
    setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
  };

  // 🔧 FÖRBÄTTRAD historik-hämtning med debugging
  const CaseHistoryModal: React.FC<{
    caseId: string;
    caseNumber: string;
    isOpen: boolean;
    onClose: () => void;
  }> = ({ caseId, caseNumber, isOpen, onClose }) => {
    const [history, setHistory] = useState<BillingAuditEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (isOpen && caseId) {
        fetchCaseHistory();
      }
    }, [isOpen, caseId]);

    const fetchCaseHistory = async () => {
      setLoading(true);
      try {
        console.log(`🔍 === FETCHING CASE HISTORY ===`);
        console.log(`📋 Case ID: ${caseId}`);
        console.log(`📝 Case Number: ${caseNumber}`);

        // Hämta från audit log
        const { data: auditData, error: auditError } = await supabase
          .from('billing_audit_log')
          .select('*')
          .eq('case_id', caseId)
          .order('changed_at', { ascending: false });

        if (auditError) {
          console.error('❌ Audit log query failed:', auditError);
          setHistory([]);
        } else {
          console.log(`✅ Found ${auditData?.length || 0} audit entries:`, auditData);
          setHistory(auditData || []);
        }

      } catch (err) {
        console.error('💥 Case history fetch failed:', err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'text-yellow-400';
        case 'sent': return 'text-blue-400';
        case 'paid': return 'text-green-400';
        case 'skip': return 'text-gray-400';
        default: return 'text-slate-400';
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'pending': return 'Väntar';
        case 'sent': return 'Skickad';
        case 'paid': return 'Betald';
        case 'skip': return 'Ej faktura';
        default: return status;
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Faktureringshistorik</h2>
                  <p className="text-sm text-slate-400">{caseNumber}</p>
                </div>
              </div>
              <Button variant="secondary" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Ingen historik tillgänglig för detta ärende</p>
                <p className="text-sm mt-2">Gör en statusändring så skapas historik</p>
                <p className="text-xs mt-2 text-slate-500">Case ID: {caseId}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-slate-400 mb-4">
                  Visar {history.length} historikposter för {caseNumber}
                </div>
                
                {history.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">
                          Status ändrad från{' '}
                          <span className={getStatusColor(entry.old_value)}>
                            {getStatusLabel(entry.old_value)}
                          </span>
                          {' '}till{' '}
                          <span className={getStatusColor(entry.new_value)}>
                            {getStatusLabel(entry.new_value)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          <span>{entry.changed_by}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(entry.changed_at).toLocaleDateString('sv-SE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      {/* 🔧 DEBUG INFO */}
                      <div className="mt-2 text-xs text-slate-500 bg-slate-900 p-2 rounded">
                        ID: {entry.id} | Action: {entry.action}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Global historik-modal (förkortad version - samma logik som case history)
  const GlobalHistoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
  }> = ({ isOpen, onClose }) => {
    const [history, setHistory] = useState<BillingAuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        type: 'month',
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        label: 'Denna månad'
      };
    });

    useEffect(() => {
      if (isOpen) {
        fetchGlobalHistory();
      }
    }, [isOpen, dateFilter]);

    const fetchGlobalHistory = async () => {
      setLoading(true);
      try {
        console.log(`🔍 === FETCHING GLOBAL HISTORY ===`);
        console.log(`📅 Date range: ${dateFilter.startDate} to ${dateFilter.endDate}`);

        const { data, error } = await supabase
          .from('billing_audit_log')
          .select('*')
          .gte('changed_at', `${dateFilter.startDate}T00:00:00`)
          .lte('changed_at', `${dateFilter.endDate}T23:59:59`)
          .order('changed_at', { ascending: false });

        if (error) {
          console.error('❌ Global history query failed:', error);
          setHistory([]);
        } else {
          console.log(`✅ Found ${data?.length || 0} global history entries`);
          setHistory(data || []);
        }

      } catch (err) {
        console.error('💥 Global history fetch failed:', err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Global Faktureringshistorik</h2>
                  <p className="text-sm text-slate-400">Alla statusändringar systemet</p>
                </div>
              </div>
              <Button variant="secondary" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Ingen historik för vald period</p>
                <p className="text-sm mt-2">{dateFilter.label}</p>
                <p className="text-xs mt-2 text-slate-500">Gör statusändringar så skapas historik</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-slate-400 mb-4">
                  Visar {history.length} ändringar för {dateFilter.label}
                </div>
                
                {history.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0"></div>
                    
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">
                        {entry.case_id} - {entry.old_value} → {entry.new_value}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {entry.changed_by} • {new Date(entry.changed_at).toLocaleDateString('sv-SE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Övriga funktioner (samma som tidigare)
  const openCaseHistory = (caseId: string, caseNumber: string) => {
    setSelectedCaseForHistory({ id: caseId, number: caseNumber });
    setIsCaseHistoryOpen(true);
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

  const getLastUpdatedInfo = (case_: EnhancedBillingCase) => {
    if (!case_.billing_updated_at) return null;
    
    const updatedDate = new Date(case_.billing_updated_at).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
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
              <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={() => setIsGlobalHistoryOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <History className="w-4 h-4" />
                    Historik
                  </Button>
                  <Button onClick={fetchBillingCases} disabled={loading} className="flex items-center gap-2"><RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Uppdatera</Button>
              </div>
          </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 🔧 DEBUG SECTION - Ta bort denna efter felsökning */}
        <TestAuditLogConnection />
        
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
                                {getLastUpdatedInfo(case_)}
                              </div>
                            </td>
                            <td className="p-4">
                                <div className="flex items-center justify-center gap-1">
                                    <button 
                                      onClick={() => openCaseHistory(case_.id, case_.case_number || case_.title || 'Okänt')}
                                      className="p-2 text-purple-400 hover:text-white rounded-lg" 
                                      title="Visa historik"
                                    >
                                      <History size={16} />
                                    </button>
                                    
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

      {/* Modaler */}
      <BillingModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedCase(null); }}
        onCaseUpdate={handleCaseUpdate}
      />

      <CaseHistoryModal
        caseId={selectedCaseForHistory?.id || ''}
        caseNumber={selectedCaseForHistory?.number || ''}
        isOpen={isCaseHistoryOpen}
        onClose={() => {
          setIsCaseHistoryOpen(false);
          setSelectedCaseForHistory(null);
        }}
      />

      <GlobalHistoryModal
        isOpen={isGlobalHistoryOpen}
        onClose={() => setIsGlobalHistoryOpen(false)}
      />
    </div>
  );
};

export default BillingManagement;
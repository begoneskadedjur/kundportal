// 📁 src/pages/admin/BillingManagement.tsx - MED FÖRBÄTTRAD HISTORIK-SEKTION
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import {
  ArrowLeft, FileText, Eye, Check, X, Clock, Search, RotateCcw,
  ChevronDown, ChevronUp, User, Building2, History, UserIcon,
  Calendar, ChevronRight, Filter
} from 'lucide-react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { BillingModal } from '../../components/admin/billing/BillingModal';
import type { BillingCase, BillingStatus, SortField, SortDirection } from '../../types/billing';

// Interfaces
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
}

interface EnhancedBillingCase extends BillingCase {
  billing_updated_by?: string;
  billing_updated_by_id?: string;
}

type DateFilterType = 'today' | 'week' | 'month' | 'custom';

interface DateFilter {
  type: DateFilterType;
  startDate: string;
  endDate: string;
  label: string;
}

// Svenska statusar
const STATUS_TRANSLATIONS = {
  'pending': 'Väntar på fakturering',
  'sent': 'Skickad',
  'paid': 'Betald',
  'skip': 'Ej faktureras'
};

const STATUS_COLORS = {
  'pending': 'text-yellow-400',
  'sent': 'text-blue-400',
  'paid': 'text-green-400',
  'skip': 'text-gray-400'
};

// Helper functions för datum
const getDateFilterOptions = (): DateFilter[] => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().split('T')[0];

  return [
    { type: 'today', startDate: todayStr, endDate: todayStr, label: 'Idag' },
    { type: 'week', startDate: weekAgoStr, endDate: todayStr, label: 'Senaste 7 dagarna' },
    { type: 'month', startDate: monthAgoStr, endDate: todayStr, label: 'Senaste månaden' },
    { type: 'custom', startDate: monthAgoStr, endDate: todayStr, label: 'Anpassat intervall' }
  ];
};

// KPI Cards Component
const BillingKpiCards: React.FC<{ summary: Record<string, { count: number; total: number }> }> = ({ summary }) => {
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

// Förbättrad historik-sektion som visas under huvudtabellen
const BillingHistorySection: React.FC<{ cases: EnhancedBillingCase[] }> = ({ cases }) => {
  const [history, setHistory] = useState<BillingAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => getDateFilterOptions()[1]); // Default: senaste 7 dagarna
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const dateFilterOptions = getDateFilterOptions();

  useEffect(() => {
    if (isExpanded) {
      fetchHistory();
    }
  }, [isExpanded, dateFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let startDate = dateFilter.startDate;
      let endDate = dateFilter.endDate;

      if (dateFilter.type === 'custom' && customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      }

      const { data, error } = await supabase
        .from('billing_audit_log')
        .select('*')
        .gte('changed_at', `${startDate}T00:00:00`)
        .lte('changed_at', `${endDate}T23:59:59`)
        .order('changed_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enrichera med case-information
      const enrichedHistory = data?.map(entry => {
        const relatedCase = cases.find(c => c.id === entry.case_id);
        return {
          ...entry,
          case_number: relatedCase?.case_number || entry.metadata?.case_number || null,
          case_title: relatedCase?.title || null,
          case_type_label: entry.case_type === 'private' ? 'Privatperson' : 'Företag'
        };
      }) || [];

      setHistory(enrichedHistory);
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate) {
      const customFilter = {
        type: 'custom' as DateFilterType,
        startDate: customStartDate,
        endDate: customEndDate,
        label: `${customStartDate} - ${customEndDate}`
      };
      setDateFilter(customFilter);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusTransition = (oldValue: string, newValue: string) => {
    const oldLabel = STATUS_TRANSLATIONS[oldValue as keyof typeof STATUS_TRANSLATIONS] || oldValue;
    const newLabel = STATUS_TRANSLATIONS[newValue as keyof typeof STATUS_TRANSLATIONS] || newValue;
    const oldColor = STATUS_COLORS[oldValue as keyof typeof STATUS_COLORS] || 'text-slate-400';
    const newColor = STATUS_COLORS[newValue as keyof typeof STATUS_COLORS] || 'text-slate-400';
    
    return (
      <span className="text-white">
        <span className={oldColor}>{oldLabel}</span>
        <ChevronRight className="inline w-4 h-4 mx-1 text-slate-400" />
        <span className={newColor}>{newLabel}</span>
      </span>
    );
  };

  return (
    <Card className="mt-6">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <History className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Faktureringshistorik</h3>
              <p className="text-sm text-slate-400">Alla statusändringar för faktureringsstatus</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            {isExpanded ? 'Dölj historik' : 'Visa historik'}
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            {/* Datumfilter */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Filter className="w-4 h-4" />
                <span>Filtrera på datum:</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {dateFilterOptions.slice(0, 3).map(option => (
                  <button
                    key={option.type}
                    onClick={() => setDateFilter(option)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      dateFilter.type === option.type
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom datumintervall */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Eller välj:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                />
                <Button
                  size="sm"
                  onClick={handleCustomDateChange}
                  disabled={!customStartDate || !customEndDate}
                  className="text-xs"
                >
                  Filtrera
                </Button>
              </div>
            </div>

            {/* Historik-lista */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen aktivitet hittades för det valda tidsintervallet.</p>
                  <p className="text-sm mt-2">Prova att välja ett längre intervall eller kontrollera att det finns faktureringsändringar.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
                    <span>Visar {history.length} aktiviteter för {dateFilter.label.toLowerCase()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchHistory}
                      className="text-xs"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Uppdatera
                    </Button>
                  </div>

                  {history.map((entry, index) => (
                    <div key={entry.id} className="flex items-start gap-4 p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
                      <div className="w-2 h-2 bg-purple-400 rounded-full mt-3 flex-shrink-0"></div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">
                                {entry.case_number || `${entry.case_type_label}-ärende`}
                              </span>
                              <span className="text-xs text-slate-400">
                                {entry.case_type === 'private' ? (
                                  <User className="w-3 h-3 inline" />
                                ) : (
                                  <Building2 className="w-3 h-3 inline" />
                                )}
                              </span>
                            </div>
                            
                            <div className="text-sm mb-2">
                              Status ändrad: {getStatusTransition(entry.old_value, entry.new_value)}
                            </div>
                            
                            {entry.case_title && (
                              <div className="text-xs text-slate-400 mb-1 truncate">
                                {entry.case_title}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-slate-400 mb-1">
                              {formatDateTime(entry.changed_at)}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <UserIcon className="w-3 h-3" />
                              <span>{entry.changed_by.split('@')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

// Main Component
const BillingManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<EnhancedBillingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<EnhancedBillingCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Case history modal state
  const [isCaseHistoryOpen, setIsCaseHistoryOpen] = useState(false);
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<{ id: string; number: string } | null>(null);

  // Filter and sort states
  const [statusFilter, setStatusFilter] = useState<BillingStatus | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ 
    field: 'completed_date', 
    direction: 'desc' 
  });

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
        ...(privateResult.data || []).map(c => ({ ...c, type: 'private' as const, billing_status: c.billing_status || 'pending' })),
        ...(businessResult.data || []).map(c => ({ ...c, type: 'business' as const, billing_status: c.billing_status || 'pending' }))
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
      const userEmail = user?.email || 'Okänd användare';
      const userId = user?.id || null;
      const currentCase = cases.find(c => c.id === caseId);
      const oldStatus = currentCase?.billing_status || 'pending';

      const updateData = {
        billing_status: status,
        billing_updated_at: new Date().toISOString(),
        billing_updated_by: userEmail,
        billing_updated_by_id: userId
      };

      const table = type === 'private' ? 'private_cases' : 'business_cases';
      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single();

      if (error) throw error;

      const auditData = {
        case_id: caseId,
        case_type: type,
        action: 'billing_status_change',
        old_value: oldStatus,
        new_value: status,
        changed_by: userEmail,
        metadata: {
          user_id: userId,
          case_number: currentCase?.case_number || null,
          timestamp: Date.now()
        }
      };

      const { error: auditError } = await supabase
        .from('billing_audit_log')
        .insert([auditData]);

      if (auditError) {
        setError(`Varning: Audit log misslyckades - ${auditError.message}. Status uppdaterades ändå.`);
      } else {
        setError(null);
      }

      handleCaseUpdate(data);
      
    } catch (err) {
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
    setCases(prev => prev.map(c => 
      c.id === updatedCase.id 
        ? { ...updatedCase, type: updatedCase.type || (cases.find(oc => oc.id === updatedCase.id)?.type) } 
        : c
    ));
  };

  // Case History Modal (behålls för individuell case-historik)
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
        const { data, error } = await supabase
          .from('billing_audit_log')
          .select('*')
          .eq('case_id', caseId)
          .order('changed_at', { ascending: false });

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
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
          
          <div className="p-6 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Ingen historik tillgänglig för detta ärende.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map(entry => (
                  <div key={entry.id} className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white mb-2">
                        Status ändrad från{' '}
                        <span className={STATUS_COLORS[entry.old_value as keyof typeof STATUS_COLORS] || 'text-slate-400'}>
                          {STATUS_TRANSLATIONS[entry.old_value as keyof typeof STATUS_TRANSLATIONS] || entry.old_value}
                        </span>
                        {' '}till{' '}
                        <span className={STATUS_COLORS[entry.new_value as keyof typeof STATUS_COLORS] || 'text-slate-400'}>
                          {STATUS_TRANSLATIONS[entry.new_value as keyof typeof STATUS_TRANSLATIONS] || entry.new_value}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          <span>{entry.changed_by}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(entry.changed_at).toLocaleString('sv-SE')}</span>
                        </div>
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

  const openCaseHistory = (caseId: string, caseNumber: string) => {
    setSelectedCaseForHistory({ id: caseId, number: caseNumber });
    setIsCaseHistoryOpen(true);
  };

  // Memoized calculations
  const filteredAndSortedCases = useMemo(() => {
    let filtered = cases;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => (c.billing_status || 'pending') === statusFilter);
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

      if (field === 'completed_date' || field === 'billing_updated_at') {
        aVal = new Date(a[field] || 0).getTime();
        bVal = new Date(b[field] || 0).getTime();
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
      const total = c.pris ? (c.type === 'private' ? c.pris : c.pris * 1.25) : 0;
      if (!acc[key]) acc[key] = { count: 0, total: 0 };
      acc[key].count++;
      acc[key].total += total;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);
  }, [cases]);

  // Event handlers
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleCaseClick = (case_: EnhancedBillingCase) => {
    setSelectedCase(case_);
    setIsModalOpen(true);
  };

  // UI Helper functions
  const getDisplayName = (case_: EnhancedBillingCase) => {
    return case_.type === 'business' 
      ? (case_.title || case_.kontaktperson || "Företagskund")
      : (case_.kontaktperson || case_.title || "Privatkund");
  };

  const getBillingStatusBadge = (status: BillingStatus) => {
    const statusMap = {
      pending: { label: 'Väntar', Icon: Clock, classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      sent: { label: 'Skickad', Icon: FileText, classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      paid: { label: 'Betald', Icon: Check, classes: 'bg-green-500/10 text-green-400 border-green-500/20' },
      skip: { label: 'Ej faktura', Icon: X, classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
    };
    
    const { label, Icon, classes } = statusMap[status] || { 
      label: 'Okänd', 
      Icon: X, 
      classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20' 
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${classes}`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </span>
    );
  };

  const getLastUpdatedInfo = (case_: EnhancedBillingCase) => {
    if (!case_.billing_updated_at) return null;
    
    const updatedDate = new Date(case_.billing_updated_at).toLocaleString('sv-SE', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
    const updatedBy = case_.billing_updated_by || 'Okänd';
    
    return (
      <div className="text-xs text-slate-400 mt-1" title={`Uppdaterad av: ${updatedBy}`}>
        {updatedDate}
      </div>
    );
  };

  // Loading and error states
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !error.startsWith('Varning')) {
    return (
      <div className="p-8 text-center bg-slate-950 text-red-400 min-h-screen">
        <h2 className="text-xl mb-4">Ett fel uppstod</h2>
        <pre className="p-4 bg-slate-800 rounded-md text-left text-sm whitespace-pre-wrap">
          {error}
        </pre>
        <Button onClick={fetchBillingCases} className="mt-6">
          Försök igen
        </Button>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Fakturering</h1>
              <p className="text-sm text-slate-400">{cases.length} avslutade ärenden</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={fetchBillingCases} 
              disabled={loading} 
              className="flex items-center gap-2"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Warning banner */}
        {error && error.startsWith('Varning') && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 text-sm">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <BillingKpiCards summary={summary} />

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'sent', 'paid', 'skip'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === key
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {({ 
                    all: 'Alla', 
                    pending: 'Väntar', 
                    sent: 'Skickad', 
                    paid: 'Betald', 
                    skip: 'Ej faktura' 
                  })[key]} ({key === 'all' ? cases.length : (summary[key]?.count || 0)})
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Sök ärende, kund, tekniker..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white w-full lg:w-80"
              />
            </div>
          </div>
        </Card>

        {/* Cases Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  {(['completed_date', 'case_number', 'primary_assignee_name', 'kontaktperson', 'pris', 'billing_status'] as const).map(field => (
                    <th key={field} className="p-4 text-left text-sm font-semibold text-slate-300">
                      <button onClick={() => handleSort(field)} className="flex items-center gap-1">
                        {({
                          completed_date: 'Datum',
                          case_number: 'Ärende',
                          primary_assignee_name: 'Tekniker',
                          kontaktperson: 'Kund',
                          pris: 'Att fakturera',
                          billing_status: 'Status'
                        })[field]}
                        {sortConfig.field === field && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="p-4 text-center text-sm font-semibold text-slate-300">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAndSortedCases.map((case_) => (
                  <tr key={case_.id} className="hover:bg-slate-800/30">
                    <td className="p-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                        }`}>
                          {case_.type === 'private' ? (
                            <User className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Building2 className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {case_.case_number || 'Okänt nr'}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-xs">
                            {case_.title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-300">
                        {case_.primary_assignee_name}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-300">
                        {getDisplayName(case_)}
                      </div>
                    </td>
                    <td className="p-4 text-left whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {formatCurrency(case_.pris ? (case_.type === 'private' ? case_.pris : case_.pris * 1.25) : 0)}
                      </div>
                    </td>
                    <td className="p-4 text-left">
                      <div className="flex flex-col">
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
                        
                        {/* Status change buttons */}
                        {(case_.billing_status === 'pending' || case_.billing_status === 'sent') && (
                          <>
                            <button
                              onClick={() => updateBillingStatus(case_.id, case_.type, 'sent')}
                              disabled={processingIds.has(case_.id)}
                              className="p-2 text-blue-400 hover:text-white rounded-lg"
                              title="Markera som skickad"
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              onClick={() => updateBillingStatus(case_.id, case_.type, 'paid')}
                              disabled={processingIds.has(case_.id)}
                              className="p-2 text-green-400 hover:text-white rounded-lg"
                              title="Markera som betald"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => updateBillingStatus(case_.id, case_.type, 'skip')}
                              disabled={processingIds.has(case_.id)}
                              className="p-2 text-gray-400 hover:text-white rounded-lg"
                              title="Ska ej faktureras"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        
                        {/* Reset button for non-pending statuses */}
                        {(case_.billing_status === 'paid' || case_.billing_status === 'skip' || case_.billing_status === 'sent') && (
                          <button
                            onClick={() => updateBillingStatus(case_.id, case_.type, 'pending')}
                            disabled={processingIds.has(case_.id)}
                            className="p-2 text-yellow-400 hover:text-white rounded-lg"
                            title="Återställ till väntande"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        
                        {/* View details button */}
                        <button
                          onClick={() => handleCaseClick(case_)}
                          className="p-2 text-slate-400 hover:text-white rounded-lg"
                          title="Visa/Redigera detaljer"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Empty state */}
          {filteredAndSortedCases.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              Inga ärenden matchade dina filter.
            </div>
          )}
        </Card>

        {/* NEW: Billing History Section - visas under huvudtabellen */}
        <BillingHistorySection cases={cases} />
      </main>

      {/* Modals */}
      <BillingModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCase(null);
        }}
        onCaseUpdate={handleCaseUpdate}
      />
      
      {selectedCaseForHistory && (
        <CaseHistoryModal
          caseId={selectedCaseForHistory.id}
          caseNumber={selectedCaseForHistory.number}
          isOpen={isCaseHistoryOpen}
          onClose={() => {
            setIsCaseHistoryOpen(false);
            setSelectedCaseForHistory(null);
          }}
        />
      )}
    </div>
  );
};

export default BillingManagement;
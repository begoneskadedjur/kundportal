// 📁 src/components/admin/coordinator/CaseSearchCard.tsx
// ⭐ Sökkomponent för koordinatorns dashboard ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, FileSearch, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Card from '../../ui/Card';
import { BeGoneCaseRow } from '../../../types/database';
import { supabase } from '../../../lib/supabase';
import CaseSearchResults from './CaseSearchResults';
import EditCaseModal from '../technicians/EditCaseModal';

interface CaseSearchCardProps {
  className?: string;
}

type SortOption = 'pris' | 'kontaktperson' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

// Debounce hook för sökning
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const CaseSearchCard: React.FC<CaseSearchCardProps> = ({ className = '' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Debounce search query för prestanda
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Hämta alla ärenden vid komponentens första laddning
  const fetchAllCases = useCallback(async () => {
    try {
      setInitialLoading(true);
      
      const [privateCasesResult, businessCasesResult] = await Promise.all([
        supabase
          .from('private_cases')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('business_cases') 
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (privateCasesResult.error) throw privateCasesResult.error;
      if (businessCasesResult.error) throw businessCasesResult.error;

      const combinedCases = [
        ...(privateCasesResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ];

      setAllCases(combinedCases as BeGoneCaseRow[]);
    } catch (error) {
      console.error('Fel vid hämtning av ärenden:', error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCases();
  }, [fetchAllCases]);

  // Filtrera och sortera ärenden baserat på sökning
  const filteredAndSortedResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    
    const query = debouncedSearchQuery.toLowerCase();
    
    const filtered = allCases.filter(caseData => {
      // Sök i titel
      if (caseData.title?.toLowerCase().includes(query)) return true;
      
      // Sök i kontaktperson
      if (caseData.kontaktperson?.toLowerCase().includes(query)) return true;
      
      // Sök i adress
      const address = typeof caseData.adress === 'string' 
        ? caseData.adress 
        : caseData.adress?.formatted_address || '';
      if (address.toLowerCase().includes(query)) return true;
      
      // Sök i status
      if (caseData.status?.toLowerCase().includes(query)) return true;
      
      // Sök i skadedjur
      if (caseData.skadedjur?.toLowerCase().includes(query)) return true;
      
      // Sök i tekniker
      const technicianNames = [
        caseData.primary_assignee_name,
        caseData.secondary_assignee_name, 
        caseData.tertiary_assignee_name
      ].filter(Boolean).join(' ').toLowerCase();
      if (technicianNames.includes(query)) return true;
      
      // Sök i ClickUp task ID
      if (caseData.clickup_task_id?.toLowerCase().includes(query)) return true;

      // Sök i ärendenummer
      if (caseData.case_number?.toLowerCase().includes(query)) return true;

      return false;
    });

    // Sortera resultaten
    const sorted = [...filtered].sort((a, b) => {
      let valueA: any = '';
      let valueB: any = '';

      switch (sortBy) {
        case 'pris':
          valueA = a.pris || 0;
          valueB = b.pris || 0;
          break;
        case 'kontaktperson':
          valueA = a.kontaktperson || '';
          valueB = b.kontaktperson || '';
          break;
        case 'status':
          valueA = a.status || '';
          valueB = b.status || '';
          break;
        case 'created_at':
          valueA = new Date(a.created_at || 0).getTime();
          valueB = new Date(b.created_at || 0).getTime();
          break;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const comparison = valueA.localeCompare(valueB, 'sv');
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = valueA - valueB;
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });

    // Begränsa till 15 resultat för prestanda
    return sorted.slice(0, 15);
  }, [allCases, debouncedSearchQuery, sortBy, sortDirection]);

  const handleCaseClick = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = (updatedCase: any) => {
    // Uppdatera ärendet i lokala state
    setAllCases(currentCases => 
      currentCases.map(c => 
        c.id === selectedCase?.id ? { ...c, ...updatedCase } : c
      )
    );
    setIsEditModalOpen(false);
    setSelectedCase(null);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      // Växla riktning om samma kolumn klickas
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Ny kolumn, börja med desc för pris, asc för text
      setSortBy(option);
      setSortDirection(option === 'pris' ? 'desc' : 'asc');
    }
  };

  const getSortIcon = (option: SortOption) => {
    if (sortBy !== option) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const hasSearchQuery = searchQuery.trim().length > 0;
  const showResults = hasSearchQuery && debouncedSearchQuery === searchQuery;

  return (
    <>
      <Card className={`${className}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg">
              <FileSearch className="w-7 h-7 text-[#20c58f]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Sök Ärenden</h3>
              <p className="text-slate-400">Sök bland alla ärenden i systemet</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Sök på titel, kund, adress, tekniker, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-[#20c58f] focus:outline-none text-white placeholder-slate-500"
              disabled={initialLoading}
            />
            {hasSearchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Loading state för initial datahämtning */}
          {initialLoading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-slate-400">
                <div className="w-4 h-4 border-2 border-slate-600 border-t-[#20c58f] rounded-full animate-spin"></div>
                Laddar ärenden...
              </div>
            </div>
          )}

          {/* Search results */}
          {!initialLoading && showResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-medium text-slate-300">
                  Sökresultat ({filteredAndSortedResults.length})
                </h4>
                
                {/* Sorteringsknapppar */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 mr-2">Sortera efter:</span>
                  <button
                    onClick={() => handleSort('pris')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      sortBy === 'pris' 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600'
                    }`}
                  >
                    Pris {getSortIcon('pris')}
                  </button>
                  <button
                    onClick={() => handleSort('kontaktperson')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      sortBy === 'kontaktperson' 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600'
                    }`}
                  >
                    Namn {getSortIcon('kontaktperson')}
                  </button>
                  <button
                    onClick={() => handleSort('status')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      sortBy === 'status' 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600'
                    }`}
                  >
                    Status {getSortIcon('status')}
                  </button>
                </div>
                
                {debouncedSearchQuery !== searchQuery && (
                  <div className="text-xs text-slate-500">Söker...</div>
                )}
              </div>
              
              <CaseSearchResults 
                results={filteredAndSortedResults}
                onCaseClick={handleCaseClick}
                loading={debouncedSearchQuery !== searchQuery}
              />
            </div>
          )}

          {/* Empty state */}
          {!initialLoading && !hasSearchQuery && (
            <div className="text-center py-8 px-4 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
              <Search className="mx-auto w-12 h-12 text-slate-600 mb-3" />
              <h4 className="text-lg font-semibold text-slate-300 mb-2">Börja söka</h4>
              <p className="text-sm text-slate-500">
                Skriv in söktermer för att hitta ärenden snabbt.<br />
                Du kan söka på titel, kund, adress, tekniker, status m.m.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Case Modal */}
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCase(null);
        }} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase as any} 
      />
    </>
  );
};

export default CaseSearchCard;
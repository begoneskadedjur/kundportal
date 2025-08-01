// 📁 src/pages/coordinator/CaseSearch.tsx
// ⭐ Dedikerad söksida för ärenden med avancerade filter ⭐

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/shared';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow } from '../../types/database';
import { 
  Search, 
  Filter, 
  Calendar,
  User,
  MapPin,
  Tag,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Phone,
  Mail,
  ExternalLink,
  Building2,
  Home,
  Euro,
  Bug,
  CheckCircle,
  CircleX,
  CircleDot,
  Edit3
} from 'lucide-react';
import { formatAddress } from '../../utils/addressFormatter';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';

interface FilterState {
  searchQuery: string;
  status: string[];
  assignedTechnician: string[];
  dateRange: {
    start: string;
    end: string;
  };
  caseType: string[];
  priority: string[];
}

const defaultFilters: FilterState = {
  searchQuery: '',
  status: [],
  assignedTechnician: [],
  dateRange: { start: '', end: '' },
  caseType: [],
  priority: []
};

const statusOptions = [
  'Öppen', 'Bokad', 'Bokat', 'Offert skickad', 'Offert signerad - boka in',
  'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'
];

const priorityOptions = ['Låg', 'Normal', 'Hög', 'Akut'];

// Hjälpfunktioner
const extractPrice = (caseItem: BeGoneCaseRow): number | null => {
  // Först försök med det direkta pris-fältet
  if (caseItem.pris && typeof caseItem.pris === 'number') {
    return caseItem.pris;
  }
  
  // Sedan försök med price-fältet om det finns
  if ((caseItem as any).price && typeof (caseItem as any).price === 'number') {
    return (caseItem as any).price;
  }
  
  // Om det är en sträng, försök parsa
  if (caseItem.pris && typeof caseItem.pris === 'string') {
    const numericValue = parseFloat(caseItem.pris.replace(/[^\d.-]/g, ''));
    return isNaN(numericValue) ? null : numericValue;
  }
  
  return null;
};

const formatPrice = (price: number | null): string => {
  if (!price) return '';
  return new Intl.NumberFormat('sv-SE').format(price);
};

const getStatusColor = (status: string): string => {
  const completedStatuses = ['Avslutat', 'Stängt - slasklogg'];
  const inProgressStatuses = ['Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'];
  const pendingStatuses = ['Öppen', 'Offert skickad', 'Offert signerad - boka in', 'Privatperson - review'];
  
  if (completedStatuses.includes(status)) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (inProgressStatuses.includes(status)) {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  } else if (pendingStatuses.includes(status)) {
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
};

const getStatusIcon = (status: string) => {
  const completedStatuses = ['Avslutat', 'Stängt - slasklogg'];
  const inProgressStatuses = ['Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'];
  
  if (completedStatuses.includes(status)) {
    return CheckCircle;
  } else if (inProgressStatuses.includes(status)) {
    return CircleDot;
  }
  return CircleX;
};

type SortField = 'title' | 'kontaktperson' | 'status' | 'primary_assignee_name' | 'created_at' | 'completed_date' | 'pris' | 'case_type';
type SortDirection = 'asc' | 'desc';

export default function CaseSearch() {
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);

  // Hämta data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [privateCases, businessCases, technicianData] = await Promise.all([
        supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('business_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('technicians').select('id, name').eq('is_active', true).order('name')
      ]);

      if (privateCases.error) throw privateCases.error;
      if (businessCases.error) throw businessCases.error;
      if (technicianData.error) throw technicianData.error;

      const combinedCases = [
        ...(privateCases.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCases.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ];

      setAllCases(combinedCases as BeGoneCaseRow[]);
      setTechnicians(technicianData.data || []);
    } catch (err: any) {
      console.error('Fel vid hämtning av data:', err);
      setError(`Kunde inte ladda data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Sorteringsfunktioner
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  // Filtrera ärenden
  const filteredCases = useMemo(() => {
    return allCases.filter(caseItem => {
      // Textsökning
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchFields = [
          caseItem.title,
          caseItem.kontaktperson,
          caseItem.primary_assignee_name,
          typeof caseItem.adress === 'string' ? caseItem.adress : JSON.stringify(caseItem.adress),
          caseItem.beskrivning,
          caseItem.skadedjur
        ].filter(Boolean);
        
        if (!searchFields.some(field => field?.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(caseItem.status)) {
        return false;
      }

      // Tekniker filter
      if (filters.assignedTechnician.length > 0) {
        const technicianIds = [
          caseItem.primary_assignee_id,
          caseItem.secondary_assignee_id,
          caseItem.tertiary_assignee_id
        ].filter(Boolean);
        
        if (!technicianIds.some(id => filters.assignedTechnician.includes(id!))) {
          return false;
        }
      }

      // Datum filter
      if (filters.dateRange.start && caseItem.created_at) {
        if (new Date(caseItem.created_at) < new Date(filters.dateRange.start)) {
          return false;
        }
      }
      if (filters.dateRange.end && caseItem.created_at) {
        if (new Date(caseItem.created_at) > new Date(filters.dateRange.end)) {
          return false;
        }
      }

      // Ärendetyp filter
      if (filters.caseType.length > 0 && !filters.caseType.includes(caseItem.case_type)) {
        return false;
      }

      return true;
    });
  }, [allCases, filters]);

  // Sortera ärenden
  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'title':
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        case 'kontaktperson':
          aValue = a.kontaktperson || '';
          bValue = b.kontaktperson || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'primary_assignee_name':
          aValue = a.primary_assignee_name || '';
          bValue = b.primary_assignee_name || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'completed_date':
          aValue = a.completed_date ? new Date(a.completed_date) : new Date(0);
          bValue = b.completed_date ? new Date(b.completed_date) : new Date(0);
          break;
        case 'pris':
          aValue = extractPrice(a) || 0;
          bValue = extractPrice(b) || 0;
          break;
        case 'case_type':
          aValue = a.case_type || '';
          bValue = b.case_type || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCases, sortField, sortDirection]);

  // Paginering
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCases.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCases, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedCases.length / itemsPerPage);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Återställ till första sidan vid ny filtrering
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  };

  const toggleArrayFilter = (key: 'status' | 'assignedTechnician' | 'caseType' | 'priority', value: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const handleEditCase = (caseItem: BeGoneCaseRow) => {
    setSelectedCase(caseItem);
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setSelectedCase(null);
  };

  const handleCaseUpdate = (updatedCase: any) => {
    // Uppdatera listan med det uppdaterade ärendet
    setAllCases(prevCases => 
      prevCases.map(c => c.id === updatedCase.id ? { ...c, ...updatedCase } : c)
    );
    handleCloseEditModal();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <PageHeader title="Sök Ärenden" showBackButton={true} />
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-6 h-6 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin"></div>
              Laddar ärenden...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <PageHeader title="Sök Ärenden" showBackButton={true} />

        {error && (
          <Card className="mb-6">
            <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Ett fel uppstod</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Sökbar och filter */}
        <Card className="mb-6">
          <div className="space-y-4">
            {/* Huvudsökning */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Sök på titel, kund, adress, tekniker, beskrivning..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter('searchQuery', e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-white placeholder-slate-500"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filter
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {/* Expanderade filter */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                {/* Status filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {statusOptions.map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={() => toggleArrayFilter('status', status)}
                          className="mr-2 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-400">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tekniker filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tekniker</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {technicians.map(tech => (
                      <label key={tech.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.assignedTechnician.includes(tech.id)}
                          onChange={() => toggleArrayFilter('assignedTechnician', tech.id)}
                          className="mr-2 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-400">{tech.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Ärendetyp filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ärendetyp</label>
                  <div className="space-y-1">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.caseType.includes('private')}
                        onChange={() => toggleArrayFilter('caseType', 'private')}
                        className="mr-2 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-400">Privat</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.caseType.includes('business')}
                        onChange={() => toggleArrayFilter('caseType', 'business')}
                        className="mr-2 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-400">Företag</span>
                    </label>
                  </div>
                </div>

                {/* Datumfilter */}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Skapad mellan</label>
                  <div className="flex gap-4">
                    <input
                      type="date"
                      value={filters.dateRange.start}
                      onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-slate-400 flex items-center">till</span>
                    <input
                      type="date"
                      value={filters.dateRange.end}
                      onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Rensa filter */}
                <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                  <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    Rensa alla filter
                  </Button>
                </div>
              </div>
            )}

            {/* Resultat-statistik */}
            <div className="flex items-center justify-between text-sm text-slate-400">
              <div>
                Visar {paginatedCases.length} av {sortedCases.length} ärenden
                {filters.searchQuery && ` för "${filters.searchQuery}"`}
              </div>
              <div>
                Sida {currentPage} av {totalPages}
              </div>
            </div>
          </div>
        </Card>

        {/* Resultat */}
        <Card>
          {paginatedCases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Inga ärenden hittades</h3>
              <p className="text-slate-500">Prova att justera dina filter eller sökterm</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Tabellhuvud */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-slate-800/30 border-b border-slate-700 text-sm font-medium text-slate-300">
                <button 
                  className="col-span-3 text-left flex items-center gap-2 hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('title')}
                >
                  Ärende & Kund
                  {getSortIcon('title')}
                </button>
                <button 
                  className="col-span-1 text-center flex items-center justify-center gap-1 hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('case_type')}
                >
                  Typ
                  {getSortIcon('case_type')}
                </button>
                <button 
                  className="col-span-2 text-left flex items-center gap-2 hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  Status
                  {getSortIcon('status')}
                </button>
                <button 
                  className="col-span-2 text-left flex items-center gap-2 hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('primary_assignee_name')}
                >
                  Tekniker
                  {getSortIcon('primary_assignee_name')}
                </button>
                <div className="col-span-1 text-center">Skadedjur</div>
                <button 
                  className="col-span-1 text-center flex items-center justify-center gap-1 hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('pris')}
                >
                  Pris
                  {getSortIcon('pris')}
                </button>
                <button 
                  className="col-span-1 text-center flex items-center justify-center gap-1 hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  Datum
                  {getSortIcon('created_at')}
                </button>
                <div className="col-span-1 text-center">Åtgärd</div>
              </div>

              {/* Ärendenlista */}
              <div className="divide-y divide-slate-800">
                {paginatedCases.map((caseItem, index) => {
                  const StatusIcon = getStatusIcon(caseItem.status);
                  const price = extractPrice(caseItem);
                  
                  return (
                    <div
                      key={caseItem.id}
                      className={`grid grid-cols-12 gap-4 p-4 hover:bg-slate-800/20 transition-colors ${
                        index % 2 === 0 ? 'bg-slate-900/20' : ''
                      }`}
                    >
                      {/* Ärende & Kund */}
                      <div className="col-span-3 space-y-1">
                        <h3 className="font-medium text-white text-sm truncate" title={caseItem.title}>
                          {caseItem.title}
                        </h3>
                        {caseItem.kontaktperson && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <User className="w-3 h-3" />
                            <span className="truncate">{caseItem.kontaktperson}</span>
                          </div>
                        )}
                        {(caseItem.kontakt_telefon || caseItem.kontakt_email) && (
                          <div className="flex items-center gap-2 text-xs">
                            {caseItem.kontakt_telefon && (
                              <a 
                                href={`tel:${caseItem.kontakt_telefon}`}
                                className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
                                title={caseItem.kontakt_telefon}
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
                            {caseItem.kontakt_email && (
                              <a 
                                href={`mailto:${caseItem.kontakt_email}`}
                                className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
                                title={caseItem.kontakt_email}
                              >
                                <Mail className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                        {caseItem.adress && (
                          <div className="flex items-start gap-1 text-xs text-slate-500" title={formatAddress(caseItem.adress)}>
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="truncate">{formatAddress(caseItem.adress)}</span>
                          </div>
                        )}
                      </div>

                      {/* Typ */}
                      <div className="col-span-1 flex justify-center items-start pt-1">
                        {caseItem.case_type === 'private' ? (
                          <Home className="w-4 h-4 text-emerald-400" title="Privat" />
                        ) : (
                          <Building2 className="w-4 h-4 text-blue-400" title="Företag" />
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="truncate">{caseItem.status}</span>
                        </div>
                      </div>

                      {/* Tekniker */}
                      <div className="col-span-2 space-y-1">
                        {caseItem.primary_assignee_name ? (
                          <>
                            <div className="text-sm text-slate-300 truncate" title={caseItem.primary_assignee_name}>
                              {caseItem.primary_assignee_name}
                            </div>
                            {(caseItem.secondary_assignee_name || caseItem.tertiary_assignee_name) && (
                              <div className="text-xs text-slate-500 truncate">
                                + {[caseItem.secondary_assignee_name, caseItem.tertiary_assignee_name]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Ej tilldelad</span>
                        )}
                      </div>

                      {/* Skadedjur */}
                      <div className="col-span-1 flex justify-center items-start pt-1">
                        {caseItem.skadedjur ? (
                          <div className="group relative">
                            <Bug className="w-4 h-4 text-orange-400" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {caseItem.skadedjur}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </div>

                      {/* Pris */}
                      <div className="col-span-1 text-center">
                        {price ? (
                          <div className="flex items-center justify-center gap-1 text-emerald-400 text-sm font-medium">
                            <Euro className="w-3 h-3" />
                            <span>{formatPrice(price)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </div>

                      {/* Datum */}
                      <div className="col-span-1 text-center space-y-1">
                        <div className="text-xs text-slate-400">
                          {new Date(caseItem.created_at).toLocaleDateString('sv-SE', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                        {caseItem.completed_date && (
                          <div className="text-xs text-emerald-400">
                            ✓ {new Date(caseItem.completed_date).toLocaleDateString('sv-SE', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                        )}
                      </div>

                      {/* Åtgärd */}
                      <div className="col-span-1 flex justify-center items-start pt-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="p-1 h-7 w-7 hover:scale-110 transition-transform"
                          onClick={() => handleEditCase(caseItem)}
                          title="Redigera ärende"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Paginering */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Föregående
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Nästa
            </Button>
          </div>
        )}

        {/* EditCaseModal */}
        {selectedCase && (
          <EditCaseModal
            isOpen={editModalOpen}
            onClose={handleCloseEditModal}
            onSuccess={handleCaseUpdate}
            caseData={selectedCase as any} // Konvertera till rätt typ
          />
        )}
      </div>
    </div>
  );
}
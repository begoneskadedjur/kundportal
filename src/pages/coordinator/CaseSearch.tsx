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
  CircleDot
} from 'lucide-react';
import { formatAddress } from '../../utils/addressFormatter';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

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
const extractPrice = (priceData: any): string | null => {
  if (!priceData) return null;
  
  if (typeof priceData === 'string') {
    try {
      const parsed = JSON.parse(priceData);
      return parsed.value || null;
    } catch {
      // Om det inte går att parsa som JSON, försök extrahera nummer från strängen
      const match = priceData.match(/(\d+[\d\s,]*)/);
      return match ? match[1].replace(/\s/g, '') : null;
    }
  }
  
  if (typeof priceData === 'object' && priceData.value) {
    return priceData.value;
  }
  
  return null;
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

export default function CaseSearch() {
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

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

  // Paginering
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCases, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

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
                Visar {paginatedCases.length} av {filteredCases.length} ärenden
                {filters.searchQuery && ` för "${filters.searchQuery}"`}
              </div>
              <div>
                Sida {currentPage} av {totalPages}
              </div>
            </div>
          </div>
        </Card>

        {/* Resultat */}
        <div className="space-y-3">
          {paginatedCases.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">Inga ärenden hittades</h3>
                <p className="text-slate-500">Prova att justera dina filter eller sökterm</p>
              </div>
            </Card>
          ) : (
            paginatedCases.map(caseItem => {
              const StatusIcon = getStatusIcon(caseItem.status);
              const price = extractPrice(caseItem.pris);
              
              return (
                <Card key={caseItem.id} className="hover:border-emerald-500/30 transition-colors">
                  <div className="p-6">
                    {/* Header med titel och huvudinfo */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          {/* Ärendetyp ikon */}
                          <div className="flex-shrink-0 mt-1">
                            {caseItem.case_type === 'private' ? (
                              <Home className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Building2 className="w-5 h-5 text-blue-400" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">{caseItem.title}</h3>
                            
                            {/* Status badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                                <StatusIcon className="w-3 h-3" />
                                {caseItem.status}
                              </div>
                              
                              {/* Ärendetyp badge */}
                              <div className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs">
                                <Tag className="w-3 h-3" />
                                {caseItem.case_type === 'private' ? 'Privat' : 'Företag'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Pris och åtgärder */}
                      <div className="flex items-start gap-3">
                        {price && (
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <Euro className="w-4 h-4" />
                              {price} kr
                            </div>
                            <div className="text-xs text-slate-500">Pris</div>
                          </div>
                        )}
                        
                        <Button variant="outline" size="sm" className="flex-shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Huvudinformation i rutnät */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                      {/* Kontaktperson */}
                      {caseItem.kontaktperson && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-slate-300 font-medium">
                            <User className="w-4 h-4 text-emerald-400" />
                            {caseItem.kontaktperson}
                          </div>
                          <div className="ml-6 space-y-1">
                            {caseItem.kontakt_telefon && (
                              <div className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 cursor-pointer transition-colors">
                                <Phone className="w-3 h-3" />
                                <a href={`tel:${caseItem.kontakt_telefon}`}>{caseItem.kontakt_telefon}</a>
                              </div>
                            )}
                            {caseItem.kontakt_email && (
                              <div className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 cursor-pointer transition-colors">
                                <Mail className="w-3 h-3" />
                                <a href={`mailto:${caseItem.kontakt_email}`}>{caseItem.kontakt_email}</a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Adress */}
                      {caseItem.adress && (
                        <div className="space-y-1">
                          <div className="flex items-start gap-2 text-slate-300">
                            <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              {formatAddress(caseItem.adress)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tekniker */}
                      {caseItem.primary_assignee_name && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-slate-300 font-medium">
                            <User className="w-4 h-4 text-blue-400" />
                            Tekniker
                          </div>
                          <div className="ml-6">
                            <div className="text-sm text-slate-300">{caseItem.primary_assignee_name}</div>
                            {(caseItem.secondary_assignee_name || caseItem.tertiary_assignee_name) && (
                              <div className="text-xs text-slate-500">
                                + {[caseItem.secondary_assignee_name, caseItem.tertiary_assignee_name]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Datum information */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-300 font-medium">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          Datum
                        </div>
                        <div className="ml-6 space-y-1">
                          <div className="text-sm text-slate-400">
                            <span className="text-slate-500">Skapad:</span> {new Date(caseItem.created_at).toLocaleDateString('sv-SE')}
                          </div>
                          {caseItem.start_date && (
                            <div className="text-sm text-slate-400">
                              <span className="text-slate-500">Start:</span> {new Date(caseItem.start_date).toLocaleDateString('sv-SE')}
                            </div>
                          )}
                          {caseItem.completed_date && (
                            <div className="text-sm text-emerald-400">
                              <span className="text-slate-500">Avslutad:</span> {new Date(caseItem.completed_date).toLocaleDateString('sv-SE')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Skadedjur */}
                    {caseItem.skadedjur && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <Bug className="w-4 h-4 text-orange-400" />
                          <span className="text-slate-400 text-sm">Skadedjur:</span>
                          <span className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-sm font-medium border border-orange-500/20">
                            {caseItem.skadedjur}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Beskrivning */}
                    {caseItem.beskrivning && (
                      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                        <div className="flex items-start gap-2 mb-2">
                          <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-400 text-sm font-medium">Beskrivning</span>
                        </div>
                        <p className="text-sm text-slate-300 ml-6 leading-relaxed">
                          {caseItem.beskrivning}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

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
      </div>
    </div>
  );
}
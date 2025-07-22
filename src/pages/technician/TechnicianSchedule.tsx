// 📁 src/pages/technician/TechnicianSchedule.tsx - REFAKTORERAD OCH KORRIGERAD

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import svLocale from '@fullcalendar/core/locales/sv'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { 
  ArrowLeft, Calendar, Phone, MapPin, Clock, Filter, X, User, Users,
  TrendingUp, Target, Search, ChevronRight, AlertCircle
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import '../../styles/FullCalendar.css'

interface ScheduledCase {
  id: string; title: string; case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string; start_date: string; end_date?: string; description?: string; status: string;
  case_price?: number; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; adress?: any;
  primary_assignee_id?: string; secondary_assignee_id?: string; tertiary_assignee_id?: string;
  primary_assignee_name?: string; secondary_assignee_name?: string; tertiary_assignee_name?: string;
  technician_role?: 'primary' | 'secondary' | 'tertiary';
}

const getResponsiveInitialView = () => {
  if (typeof window === 'undefined') return 'timeGridWeek';
  const width = window.innerWidth;
  if (width < 640) return 'listDay';
  if (width < 1024) return 'timeGridDay';
  return 'timeGridWeek';
};

const getResponsiveHeaderToolbar = () => {
  if (typeof window === 'undefined') return { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay' };
  const width = window.innerWidth;
  if (width < 640) return { left: 'prev,next', center: 'title', right: 'listDay,timeGridDay,timeGridWeek,dayGridMonth' };
  if (width < 1024) return { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,listDay,dayGridMonth' };
  return { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay' };
};

const ALL_STATUSES = [ 'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat' ];
const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));

const getStatusColorClasses = (status: string) => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('avslutat')) return 'bg-green-900/50 text-green-300 border-green-700';
  if (lowerStatus.startsWith('återbesök')) return 'bg-cyan-900/50 text-cyan-300 border-cyan-700';
  if (lowerStatus.includes('bokad') || lowerStatus.includes('signerad')) return 'bg-blue-900/50 text-blue-300 border-blue-700';
  if (lowerStatus.includes('öppen') || lowerStatus.includes('offert skickad')) return 'bg-yellow-900/50 text-yellow-300 border-yellow-700';
  if (lowerStatus.includes('review')) return 'bg-purple-900/50 text-purple-300 border-purple-700';
  if (lowerStatus.includes('stängt')) return 'bg-slate-700/50 text-slate-400 border-slate-600';
  return 'bg-slate-800/50 text-slate-400 border-slate-700';
};

const getStatusBadgeColor = (status: string) => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('avslutat')) return 'bg-green-500 text-white';
  if (lowerStatus.startsWith('återbesök')) return 'bg-cyan-500 text-white';
  if (lowerStatus.includes('bokad') || lowerStatus.includes('signerad')) return 'bg-blue-500 text-white';
  if (lowerStatus.includes('öppen') || lowerStatus.includes('offert skickad')) return 'bg-yellow-500 text-black';
  if (lowerStatus.includes('review')) return 'bg-purple-500 text-white';
  if (lowerStatus.includes('stängt')) return 'bg-slate-500 text-white';
  return 'bg-slate-600 text-white';
};

const formatAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') { try { const p = JSON.parse(address); return p.formatted_address || address; } catch (e) { return address; } }
  return '';
};

const getTechnicianRoleIcon = (role: 'primary' | 'secondary' | 'tertiary') => {
  switch (role) {
    case 'primary': return <User className="w-3 h-3 text-blue-400" title="Primär tekniker" />;
    case 'secondary': return <Users className="w-3 h-3 text-green-400" title="Sekundär tekniker" />;
    case 'tertiary': return <Users className="w-3 h-3 text-purple-400" title="Tertiär tekniker" />;
  }
};

const findNextCase = (cases: ScheduledCase[]) => {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const futureOrTodayCases = cases
        .filter(c => new Date(c.start_date) >= todayStart)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    return futureOrTodayCases.find(c => new Date(c.start_date) > now) || futureOrTodayCases[0];
};

export default function TechnicianSchedule() {
  const { profile, isTechnician } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<ScheduledCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [calendarView, setCalendarView] = useState(getResponsiveInitialView());
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [showFilters, setShowFilters] = useState(false);
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'private' | 'business' | 'contract'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ScheduledCase | null>(null);

  useEffect(() => {
    const handleResize = () => setCalendarView(getResponsiveInitialView());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchScheduledCases(profile.technician_id);
    }
  }, [isTechnician, profile?.technician_id]);

  const fetchScheduledCases = async (technicianId: string) => {
    setLoading(true);
    setError(null);
    try {
      const commonFields = `id, title, kontaktperson, start_date, created_at, description, status, telefon_kontaktperson, e_post_kontaktperson, skadedjur, adress, primary_assignee_id, secondary_assignee_id, tertiary_assignee_id, primary_assignee_name, secondary_assignee_name, tertiary_assignee_name`;
      
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select(`${commonFields}, pris`).or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        supabase.from('business_cases').select(`${commonFields}, pris, org_nr`).or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        supabase.from('cases').select('id, title, created_date, description, status, case_type, adress:address_formatted').eq('assigned_technician_id', technicianId)
      ]);
      
      const processResults = (result: PromiseSettledResult<any>, type: 'private' | 'business' | 'contract'): Partial<ScheduledCase>[] => {
        if (result.status === 'fulfilled' && result.value.data) {
          return result.value.data.map((c: any) => {
            let technicianRole: 'primary' | 'secondary' | 'tertiary' = 'primary';
            if (type !== 'contract') {
              if (c.secondary_assignee_id === technicianId) technicianRole = 'secondary';
              else if (c.tertiary_assignee_id === technicianId) technicianRole = 'tertiary';
            }
            return { ...c, start_date: c.start_date || c.created_date || c.created_at, case_price: c.pris, case_type: type, technician_role };
          });
        }
        return [];
      };

      const allFetchedCases = [
        ...processResults(privateResult, 'private'),
        ...processResults(businessResult, 'business'),
        ...processResults(contractResult, 'contract')
      ];
      
      const casesWithDates = allFetchedCases.filter(c => c.start_date);
      setAllCases(casesWithDates as ScheduledCase[]);
    } catch (err: any) {
      setError(err.message || 'Kunde inte hämta schemalagda ärenden');
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = useMemo(() => {
    return allCases.filter(case_ => {
      if (!activeStatuses.has(case_.status)) return false;
      if (caseTypeFilter !== 'all' && case_.case_type !== caseTypeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          case_.title.toLowerCase().includes(query) ||
          (case_.kontaktperson || '').toLowerCase().includes(query) ||
          (case_.skadedjur || '').toLowerCase().includes(query) ||
          formatAddress(case_.adress).toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allCases, activeStatuses, caseTypeFilter, searchQuery]);

  const quickStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysCases = filteredCases.filter(c => new Date(c.start_date).toISOString().split('T')[0] === today);
    const completedToday = todaysCases.filter(c => c.status?.toLowerCase().includes('avslutat')).length;
    const todaysRevenue = todaysCases.filter(c => c.status?.toLowerCase().includes('avslutat')).reduce((sum, c) => sum + (c.case_price || 0), 0);
    const nextCase = findNextCase(filteredCases.filter(c => !c.status?.toLowerCase().includes('avslutat')));
    
    return {
      todayTotal: todaysCases.length,
      todayCompleted: completedToday,
      todaysRevenue,
      totalFiltered: filteredCases.length,
      nextCase,
    };
  }, [filteredCases]);

  const calendarEvents = useMemo(() => {
    const casesToDisplay = calendarView === 'listDay'
      ? filteredCases.filter(c => new Date(c.start_date).toISOString().split('T')[0] === new Date().toISOString().split('T')[0])
      : filteredCases;

    return casesToDisplay.map(case_ => ({
      id: case_.id,
      title: case_.title,
      start: new Date(case_.start_date),
      end: new Date(new Date(case_.start_date).getTime() + 2 * 60 * 60 * 1000),
      extendedProps: { ...case_ },
      className: `!border ${getStatusColorClasses(case_.status)}`
    }));
  }, [filteredCases, calendarView]);
  
  const handleEventClick = (clickInfo: any) => {
    setSelectedCase(clickInfo.event.extendedProps as ScheduledCase);
    setIsEditModalOpen(true);
  };
  
  const handleUpdateSuccess = (updatedCase: ScheduledCase) => {
    setAllCases(currentCases => currentCases.map(c => (c.id === updatedCase.id ? updatedCase : c)));
  };
  
  const renderEventContent = (eventInfo: any) => {
    const { case_type, kontaktperson, adress, telefon_kontaktperson, skadedjur, technician_role, case_price, status } = eventInfo.event.extendedProps;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const isList = eventInfo.view.type.includes('list');

    if (isList) {
      return (
        <div className="w-full p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors duration-200 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-medium flex items-center gap-2">{case_type === 'private' ? '👤 Privat' : case_type === 'business' ? '🏢 Företag' : '📄 Avtal'}</span>
            <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadgeColor(status)}`}>{status}</span>
          </div>
          <div className="mb-3">
            <h3 className="text-xl font-bold text-white mb-1">{eventInfo.event.title}</h3>
            <div className="flex items-center gap-2 text-slate-400"><Clock className="w-4 h-4" /><span>{new Date(eventInfo.event.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span></div>
          </div>
          <div className="flex items-start gap-2 mb-4"><MapPin className="w-4 h-4 text-slate-400 mt-1" /><span className="text-slate-300 leading-relaxed">{formatAddress(adress)}</span></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {telefon_kontaktperson && <a href={`tel:${telefon_kontaktperson}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"><Phone className="w-4 h-4" /><span>Ring</span></a>}
              {adress && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(adress))}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"><MapPin className="w-4 h-4" /><span>Navigera</span></a>}
            </div>
            <Button size="sm" variant="primary" onClick={e => { e.stopPropagation(); handleEventClick(eventInfo); }} className="flex items-center gap-2"><span>Öppna</span><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`p-2 text-sm overflow-hidden h-full flex flex-col justify-between ${getStatusColorClasses(status).split(' ')[0]} ${isMobile ? 'text-xs' : ''}`}>
        <div className="flex-grow">
          <p className={`${isMobile ? 'text-xs' : 'text-xs'} opacity-80`}>{case_type === 'private' ? '👤' : case_type === 'business' ? '🏢' : '📄'} {!isMobile && (case_type === 'private' ? ' Privat' : case_type === 'business' ? ' Företag' : ' Avtal')}</p>
          <p className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} text-white mb-1 truncate`}>{eventInfo.event.title}</p>
          {!isMobile && <p className="truncate text-xs opacity-90"><span className="font-semibold">Kund:</span> {kontaktperson || 'Okänd'}</p>}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium">{eventInfo.timeText}</span>
          </div>
          {!isMobile && <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColorClasses(status)}`}>{status}</span>}
        </div>
      </div>
    );
  };
  
  const toggleStatus = (status: string) => {
    const newActiveStatuses = new Set(activeStatuses);
    newActiveStatuses.has(status) ? newActiveStatuses.delete(status) : newActiveStatuses.add(status);
    setActiveStatuses(newActiveStatuses);
  };

  const resetFilters = () => {
    setActiveStatuses(new Set(DEFAULT_ACTIVE_STATUSES));
    setCaseTypeFilter('all');
    setSearchQuery('');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-purple-500/10 p-1.5 sm:p-2 rounded-lg"><Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" /></div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Mitt Schema</h1>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400">
                  <span>{quickStats.totalFiltered} ärenden</span>
                  {quickStats.todayTotal > 0 && <><span>•</span><span className="text-blue-400">{quickStats.todayCompleted}/{quickStats.todayTotal} idag</span></>}
                  {quickStats.todaysRevenue > 0 && <><span>•</span><span className="text-green-400">{quickStats.todaysRevenue.toLocaleString()}kr</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={showSearch ? "primary" : "secondary"} onClick={() => setShowSearch(!showSearch)} size="sm"><Search className="w-4 h-4" /><span className="hidden sm:inline ml-2">Sök</span></Button>
              <Button variant={showFilters ? "primary" : "secondary"} onClick={() => setShowFilters(!showFilters)} size="sm"><Filter className="w-4 h-4 sm:mr-2"/><span className="hidden sm:inline">Filter</span>{filteredCases.length < allCases.length && <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">{filteredCases.length}</span>}</Button>
              <Button variant="secondary" onClick={() => navigate('/technician/dashboard')} size="sm"><ArrowLeft className="w-4 h-4 sm:mr-2"/><span className="hidden sm:inline">Tillbaka</span></Button>
            </div>
          </div>
          {quickStats.nextCase && (
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0"><div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-blue-400" /></div></div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-blue-300">Nästa ärende</p>
                  <p className="text-white font-semibold truncate">{quickStats.nextCase.title}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400"><span>{new Date(quickStats.nextCase.start_date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span><span>•</span><span>{quickStats.nextCase.kontaktperson || 'Okänd kund'}</span></div>
                </div>
                <Button size="sm" variant="primary" onClick={() => { setSelectedCase(quickStats.nextCase!); setIsEditModalOpen(true); }}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-3 sm:p-4">
        {error && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"><p className="text-red-400 text-sm">{error}</p></div>}
        {showSearch && (
          <Card className="p-4 mb-4 bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="flex-grow relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Sök efter ärende, kund, skadedjur, adress..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setShowSearch(false); }}><X className="w-4 h-4" /></Button>
            </div>
            {searchQuery && <p className="mt-2 text-sm text-slate-400">Visar {filteredCases.length} resultat för "{searchQuery}"</p>}
          </Card>
        )}
        {showFilters && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Filter</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveStatuses(new Set(ALL_STATUSES))}>Alla</Button>
                <Button size="sm" variant="ghost" onClick={resetFilters}>Återställ</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowFilters(false)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Ärendetyp</label>
              <div className="flex gap-2">
                {[{ value: 'all', label: 'Alla' }, { value: 'private', label: 'Privat' }, { value: 'business', label: 'Företag' }, { value: 'contract', label: 'Avtal' }].map(type => (<Button key={type.value} size="sm" variant={caseTypeFilter === type.value ? "primary" : "secondary"} onClick={() => setCaseTypeFilter(type.value as any)}>{type.label}</Button>))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status ({activeStatuses.size}/{ALL_STATUSES.length})</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {ALL_STATUSES.map(status => (<label key={status} className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={activeStatuses.has(status)} onChange={() => toggleStatus(status)} className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" /><span className={`text-sm ${activeStatuses.has(status) ? 'text-white' : 'text-slate-400'}`}>{status}</span></label>))}
              </div>
            </div>
          </Card>
        )}
        <div className="calendar-container bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={calendarView}
            headerToolbar={getResponsiveHeaderToolbar()}
            events={calendarEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            locale={svLocale}
            buttonText={{ today: 'idag', month: 'månad', week: 'vecka', day: 'dag', list: 'lista' }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="19:00:00"
            height="auto"
            dayMaxEvents={true}
            handleWindowResize={true}
          />
        </div>
      </main>
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase} 
      />
    </div>
  );
}
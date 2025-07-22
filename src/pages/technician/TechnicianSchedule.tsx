// 📁 src/pages/technician/TechnicianSchedule.tsx - MOBILOPTIMERAD UTAN DAGENS ÄRENDEN-KORT

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
  TrendingUp, Zap, Target
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

// ✅ RESPONSIVA CALENDAR VIEWS BASERAT PÅ SKÄRMSTORLEK
const getResponsiveInitialView = () => {
  if (typeof window === 'undefined') return 'timeGridWeek';
  
  const width = window.innerWidth;
  if (width < 640) return 'listDay'; // Mobil: dagens lista
  if (width < 1024) return 'timeGridDay'; // Tablet: dagens timmar
  return 'timeGridWeek'; // Desktop: vecka
};

// ✅ RESPONSIVA HEADER TOOLBAR
const getResponsiveHeaderToolbar = () => {
  if (typeof window === 'undefined') return {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay'
  };
  
  const width = window.innerWidth;
  if (width < 640) {
    // Mobil: Lista som standard + månadsvy för planering
    return {
      left: 'prev,next',
      center: 'title',
      right: 'today,listDay,dayGridMonth'
    };
  }
  if (width < 1024) {
    // Tablet: Dag och lista + månadsvy
    return {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridDay,listDay,dayGridMonth'
    };
  }
  // Desktop: Alla vyer
  return {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay'
  };
};

const ALL_STATUSES = [
  'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in',
  'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'
];

const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => 
  !status.includes('Avslutat') && !status.includes('Stängt')
);

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
  if (typeof address === 'string') { 
    try { 
      const p = JSON.parse(address); 
      return p.formatted_address || address; 
    } catch (e) { 
      return address; 
    } 
  }
  return '';
};

const getTechnicianRoleIcon = (role: 'primary' | 'secondary' | 'tertiary') => {
  switch (role) {
    case 'primary': return <User className="w-3 h-3 text-blue-400" title="Primär tekniker" />;
    case 'secondary': return <Users className="w-3 h-3 text-green-400" title="Sekundär tekniker" />;
    case 'tertiary': return <Users className="w-3 h-3 text-purple-400" title="Tertiär tekniker" />;
  }
};

export default function TechnicianSchedule() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<ScheduledCase[]>([])
  const [error, setError] = useState<string | null>(null)

  const [calendarView, setCalendarView] = useState(getResponsiveInitialView())

  // Filter states
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES))
  const [showFilters, setShowFilters] = useState(false)
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'private' | 'business' | 'contract'>('all')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<ScheduledCase | null>(null)

  // ✅ RESPONSIVE WINDOW RESIZE HANDLER
  useEffect(() => {
    const handleResize = () => {
      const newView = getResponsiveInitialView();
      if (newView !== calendarView) {
        setCalendarView(newView);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calendarView]);

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchScheduledCases(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  const fetchScheduledCases = async (technicianId: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Fetching cases for technician:', technicianId);
      
      const commonFields = `
        id, title, kontaktperson, start_date, created_at, description, status, 
        telefon_kontaktperson, e_post_kontaktperson, skadedjur, adress,
        primary_assignee_id, secondary_assignee_id, tertiary_assignee_id,
        primary_assignee_name, secondary_assignee_name, tertiary_assignee_name
      `;
      
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase
          .from('private_cases')
          .select(`${commonFields}, pris`)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        
        supabase
          .from('business_cases')
          .select(`${commonFields}, pris, org_nr`)
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        
        supabase
          .from('cases')
          .select('id, title, created_date, description, status, case_type, adress:address_formatted')
          .eq('assigned_technician_id', technicianId)
      ]);
      
      const allCases: Partial<ScheduledCase>[] = [];
      
      // Process private cases
      if (privateResult.status === 'fulfilled' && privateResult.value.data) {
        allCases.push(...privateResult.value.data.map((c: any) => {
          let technicianRole: 'primary' | 'secondary' | 'tertiary' = 'primary';
          if (c.secondary_assignee_id === technicianId) technicianRole = 'secondary';
          else if (c.tertiary_assignee_id === technicianId) technicianRole = 'tertiary';
          
          return {
            ...c,
            start_date: c.start_date || c.created_at,
            case_price: c.pris,
            case_type: 'private' as const,
            technician_role: technicianRole
          };
        }));
      }
      
      // Process business cases
      if (businessResult.status === 'fulfilled' && businessResult.value.data) {
        allCases.push(...businessResult.value.data.map((c: any) => {
          let technicianRole: 'primary' | 'secondary' | 'tertiary' = 'primary';
          if (c.secondary_assignee_id === technicianId) technicianRole = 'secondary';
          else if (c.tertiary_assignee_id === technicianId) technicianRole = 'tertiary';
          
          return {
            ...c,
            start_date: c.start_date || c.created_at,
            case_price: c.pris,
            case_type: 'business' as const,
            technician_role: technicianRole
          };
        }));
      }
      
      // Process contract cases
      if (contractResult.status === 'fulfilled' && contractResult.value.data) {
        allCases.push(...contractResult.value.data.map((c: any) => ({
          ...c,
          start_date: c.created_date,
          case_type: c.case_type || 'contract',
          technician_role: 'primary' as const
        })));
      }
      
      const casesWithDates = allCases.filter(c => c.start_date);
      
      console.log('📊 Fetched cases:', {
        total: casesWithDates.length,
        private: casesWithDates.filter(c => c.case_type === 'private').length,
        business: casesWithDates.filter(c => c.case_type === 'business').length,
        contract: casesWithDates.filter(c => c.case_type === 'contract').length
      });
      
      setCases(casesWithDates as ScheduledCase[]);
    } catch (err: any) {
      console.error('❌ Error fetching cases:', err);
      setError(err.message || 'Kunde inte hämta schemalagda ärenden')
    } finally {
      setLoading(false)
    }
  }

  // ✅ STATISTIK FÖR HEADER (KOMPAKT)
  const quickStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    let filteredCases = cases;
    if (activeStatuses.size < ALL_STATUSES.length) {
      filteredCases = filteredCases.filter(case_ => activeStatuses.has(case_.status));
    }
    if (caseTypeFilter !== 'all') {
      filteredCases = filteredCases.filter(case_ => case_.case_type === caseTypeFilter);
    }
    
    const todaysCases = filteredCases.filter(case_ => {
      const caseDate = new Date(case_.start_date).toISOString().split('T')[0];
      return caseDate === today;
    });
    
    const completedToday = todaysCases.filter(c => 
      c.status?.toLowerCase().includes('avslutat')
    ).length;
    
    const todaysRevenue = todaysCases
      .filter(c => c.status?.toLowerCase().includes('avslutat'))
      .reduce((sum, c) => sum + (c.case_price || 0), 0);
    
    return {
      todayTotal: todaysCases.length,
      todayCompleted: completedToday,
      todayRevenue: todaysRevenue,
      totalFiltered: filteredCases.length
    };
  }, [cases, activeStatuses, caseTypeFilter]);

  // Filtrerade calendar events
  const calendarEvents = useMemo(() => {
    let filteredCases = cases;
    
    if (activeStatuses.size < ALL_STATUSES.length) {
      filteredCases = filteredCases.filter(case_ => activeStatuses.has(case_.status));
    }
    
    if (caseTypeFilter !== 'all') {
      filteredCases = filteredCases.filter(case_ => case_.case_type === caseTypeFilter);
    }
    
    return filteredCases.map(case_ => {
      const startDate = new Date(case_.start_date);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      return {
        id: case_.id,
        title: case_.title,
        start: startDate,
        end: endDate,
        extendedProps: { ...case_ },
        className: `!border ${getStatusColorClasses(case_.status)}`
      }
    });
  }, [cases, activeStatuses, caseTypeFilter]);
  
  // ✅ MOBILOPTIMERAD EVENT RENDERING MED FÖRBÄTTRAD LISTVY
  const renderEventContent = (eventInfo: any) => {
    const { 
      case_type, kontaktperson, adress, telefon_kontaktperson, skadedjur, 
      technician_role, primary_assignee_name, secondary_assignee_name, tertiary_assignee_name,
      case_price, status
    } = eventInfo.event.extendedProps;
    
    const isMobile = window.innerWidth < 640;
    const isList = eventInfo.view.type.includes('list');
    
    // ✅ FÖRBÄTTRAD LISTVY FÖR MOBIL
    if (isList) {
      return (
        <div className="w-full p-3 sm:p-4">
          {/* Header med case type och status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {case_type === 'private' ? '👤 Privatperson' : case_type === 'business' ? '🏢 Företag' : '📄 Avtal'}
              </span>
              {technician_role && technician_role !== 'primary' && (
                <div className="flex items-center gap-1">
                  {getTechnicianRoleIcon(technician_role)}
                  <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                    {technician_role === 'secondary' ? '2:a tekniker' : '3:e tekniker'}
                  </span>
                </div>
              )}
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(status)}`}>
              {status}
            </span>
          </div>
          
          {/* Ärendetitel */}
          <h3 className="text-lg font-bold text-white mb-2">{eventInfo.event.title}</h3>
          
          {/* Kundinfo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">
                <span className="font-medium">Kund:</span> {kontaktperson || 'Okänd'}
              </span>
            </div>
            {case_price && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium">
                  {case_price.toLocaleString()} kr
                </span>
              </div>
            )}
          </div>
          
          {/* Adress och skadedjur */}
          <div className="space-y-2 mb-3 text-sm">
            {adress && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <span className="text-slate-300">
                  <span className="font-medium">Adress:</span> {formatAddress(adress)}
                </span>
              </div>
            )}
            {skadedjur && (
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-400" />
                <span className="text-slate-300">
                  <span className="font-medium">Skadedjur:</span>
                  <span className="ml-1 bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">
                    {skadedjur}
                  </span>
                </span>
              </div>
            )}
          </div>
          
          {/* Team info för multi-tekniker */}
          {(secondary_assignee_name || tertiary_assignee_name) && (
            <div className="mb-3 p-2 bg-slate-800/50 rounded border border-slate-700">
              <p className="text-sm font-medium text-blue-300 mb-1">Team:</p>
              <div className="text-sm space-y-1">
                {primary_assignee_name && (
                  <p className="flex items-center gap-2">
                    <User className="w-3 h-3 text-blue-400" />
                    <span>1. {primary_assignee_name}</span>
                  </p>
                )}
                {secondary_assignee_name && (
                  <p className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-green-400" />
                    <span>2. {secondary_assignee_name}</span>
                  </p>
                )}
                {tertiary_assignee_name && (
                  <p className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-purple-400" />
                    <span>3. {tertiary_assignee_name}</span>
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Åtgärdsknappar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {telefon_kontaktperson && (
                <a 
                  href={`tel:${telefon_kontaktperson}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span className="hidden sm:inline">Ring</span>
                </a>
              )}
              {adress && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(adress))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  <span className="hidden sm:inline">Navigera</span>
                </a>
              )}
            </div>
            <Button 
              size="sm" 
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCase(eventInfo.event.extendedProps as ScheduledCase);
                setIsEditModalOpen(true);
              }}
            >
              Öppna ärende
            </Button>
          </div>
        </div>
      );
    }
    
    // ✅ STANDARD CALENDAR EVENT (VECKA/DAG/MÅNAD)
    return (
      <div className={`p-2 text-sm overflow-hidden h-full flex flex-col justify-between ${getStatusColorClasses(status).split(' ')[0]} ${isMobile ? 'text-xs' : ''}`}>
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-1">
            <p className={`${isMobile ? 'text-xs' : 'text-xs'} opacity-80`}>
              {case_type === 'private' ? '👤' : case_type === 'business' ? '🏢' : '📄'}
              {!isMobile && (case_type === 'private' ? ' Privatperson' : case_type === 'business' ? ' Företag' : ' Avtal')}
            </p>
            {technician_role && !isMobile && (
              <div className="flex items-center gap-1">
                {getTechnicianRoleIcon(technician_role)}
                <span className="text-xs opacity-70">
                  {technician_role === 'primary' ? '1:a' : technician_role === 'secondary' ? '2:a' : '3:e'}
                </span>
              </div>
            )}
          </div>
          
          <p className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} text-white mb-1 ${isMobile ? 'truncate' : ''}`}>
            {eventInfo.event.title}
          </p>
          
          {!isMobile && (
            <div className="space-y-1 text-xs opacity-90">
              <p className="flex items-center gap-1.5">
                <Clock className="w-3 h-3"/>
                <span>{eventInfo.timeText}</span>
              </p>
              
              <p className="truncate">
                <span className="font-semibold">Kund:</span> {kontaktperson || 'Okänd'}
              </p>
              
              {skadedjur && (
                <p className="flex items-center gap-1.5">
                  <span className="font-semibold">Skadedjur:</span>
                  <span className="bg-slate-700/50 px-1.5 py-0.5 rounded">{skadedjur}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1">
            {telefon_kontaktperson && (
              <a href={`tel:${telefon_kontaktperson}`} 
                 onClick={(e) => e.stopPropagation()} 
                 className="text-blue-400 hover:text-blue-300 transition-colors" 
                 title={`Ring ${kontaktperson}`}>
                <Phone className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
              </a>
            )}
            {adress && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(adress))}`} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 onClick={(e) => e.stopPropagation()} 
                 className="text-green-400 hover:text-green-300 transition-colors" 
                 title="Navigera till adress">
                <MapPin className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
              </a>
            )}
          </div>
          
          {!isMobile && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColorClasses(status)}`}>
              {status}
            </span>
          )}
        </div>
      </div>
    )
  }

  const handleEventClick = (clickInfo: any) => {
    setSelectedCase(clickInfo.event.extendedProps as ScheduledCase);
    setIsEditModalOpen(true);
  }
  
  const handleUpdateSuccess = (updatedCase: Partial<ScheduledCase>) => {
    setCases(currentCases => currentCases.map(c => c.id === selectedCase?.id ? { ...c, ...updatedCase } : c));
  }

  // Filter handlers
  const toggleStatus = (status: string) => {
    const newActiveStatuses = new Set(activeStatuses);
    if (newActiveStatuses.has(status)) {
      newActiveStatuses.delete(status);
    } else {
      newActiveStatuses.add(status);
    }
    setActiveStatuses(newActiveStatuses);
  };

  const resetFilters = () => {
    setActiveStatuses(new Set(DEFAULT_ACTIVE_STATUSES));
    setCaseTypeFilter('all');
  };

  const selectAllStatuses = () => {
    setActiveStatuses(new Set(ALL_STATUSES));
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ✅ KOMPAKT HEADER MED SMART STATISTIK */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-purple-500/10 p-1.5 sm:p-2 rounded-lg">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Mitt Schema</h1>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400">
                  <span>{quickStats.totalFiltered} ärenden</span>
                  {quickStats.todayTotal > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-blue-400">{quickStats.todayCompleted}/{quickStats.todayTotal} idag</span>
                    </>
                  )}
                  {quickStats.todayRevenue > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-green-400">{quickStats.todayRevenue.toLocaleString()}kr</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant={showFilters ? "primary" : "secondary"} 
                onClick={() => setShowFilters(!showFilters)}
                size="sm"
              >
                <Filter className="w-4 h-4 sm:mr-2"/>
                <span className="hidden sm:inline">Filter</span>
                {quickStats.totalFiltered < cases.length && (
                  <span className="ml-1 sm:ml-2 bg-blue-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                    {quickStats.totalFiltered}
                  </span>
                )}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/technician/dashboard')} size="sm">
                <ArrowLeft className="w-4 h-4 sm:mr-2"/>
                <span className="hidden sm:inline">Tillbaka</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-3 sm:p-4">
        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        {/* ✅ RESPONSIV FILTER PANEL */}
        {showFilters && (
          <Card className="p-3 sm:p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Filter</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={selectAllStatuses}>
                  <span className="hidden sm:inline">Visa alla</span>
                  <span className="sm:hidden">Alla</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  <span className="hidden sm:inline">Återställ</span>
                  <span className="sm:hidden">Reset</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowFilters(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Case Type Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Ärendetyp</label>
              <div className="flex gap-1 sm:gap-2">
                {[
                  { value: 'all', label: 'Alla' },
                  { value: 'private', label: 'Privat' },
                  { value: 'business', label: 'Företag' },
                  { value: 'contract', label: 'Avtal' }
                ].map(type => (
                  <Button
                    key={type.value}
                    size="sm"
                    variant={caseTypeFilter === type.value ? "primary" : "secondary"}
                    onClick={() => setCaseTypeFilter(type.value as any)}
                    className="text-xs sm:text-sm"
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status ({activeStatuses.size}/{ALL_STATUSES.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {ALL_STATUSES.map(status => (
                  <label key={status} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeStatuses.has(status)}
                      onChange={() => toggleStatus(status)}
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span className={`text-xs sm:text-sm ${activeStatuses.has(status) ? 'text-white' : 'text-slate-400'}`}>
                      {status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* ✅ FÖRBÄTTRAD RESPONSIV CALENDAR */}
        <div className="p-2 sm:p-4 bg-slate-900/50 rounded-lg border border-slate-800">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={calendarView}
            headerToolbar={getResponsiveHeaderToolbar()}
            events={calendarEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            locale={svLocale}
            buttonText={{ 
              today: 'idag', 
              month: window.innerWidth < 640 ? 'mån' : 'månad', 
              week: window.innerWidth < 640 ? 'v' : 'vecka', 
              day: window.innerWidth < 640 ? 'd' : 'dag', 
              list: window.innerWidth < 640 ? 'lista' : 'lista' 
            }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="19:00:00"
            height="auto"
            eventMinHeight={window.innerWidth < 640 ? 60 : 140}
            dayMaxEvents={window.innerWidth < 640 ? 2 : true}
            moreLinkClick="popover"
            // ✅ MOBILSPECIFIKA INSTÄLLNINGAR
            aspectRatio={window.innerWidth < 640 ? 1.2 : 1.35}
            handleWindowResize={true}
            stickyHeaderDates={true}
            // ✅ AUTOMATISKT FOKUS PÅ IDAG
            initialDate={new Date()}
            // ✅ FÖRBÄTTRAD NAVIGATION
            navLinks={true}
            selectable={false}
            selectMirror={false}
            // ✅ RESPONSIVA EVENT STYLING
            eventClassNames={(arg) => {
              const baseClasses = ['calendar-event'];
              if (window.innerWidth < 640) {
                baseClasses.push('mobile-event');
              }
              return baseClasses;
            }}
            // ✅ FÖRBÄTTRAR LISTVY SPACING
            listDayFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
            listDaySideFormat={false}
          />
        </div>
      </main>

      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase as any} 
      />
      
      {/* ✅ FÖRBÄTTRAD CUSTOM CSS FÖR MOBIL CALENDAR */}
      <style jsx>{`
        @media (max-width: 640px) {
          .fc-toolbar {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .fc-toolbar-chunk {
            display: flex;
            justify-content: center;
          }
          
          .fc-button {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
            border-radius: 0.375rem;
          }
          
          .fc-button-group .fc-button {
            border-radius: 0;
          }
          
          .fc-button-group .fc-button:first-child {
            border-radius: 0.375rem 0 0 0.375rem;
          }
          
          .fc-button-group .fc-button:last-child {
            border-radius: 0 0.375rem 0.375rem 0;
          }
          
          .fc-list-event {
            padding: 0;
            border: none !important;
            background: transparent !important;
          }
          
          .fc-list-event-dot {
            display: none;
          }
          
          .fc-list-event:hover {
            background: rgba(51, 65, 85, 0.3) !important;
          }
          
          .fc-daygrid-event {
            font-size: 0.75rem;
            padding: 1px 2px;
          }
          
          .mobile-event {
            min-height: 40px !important;
          }
          
          .fc-event-main {
            padding: 2px;
          }
          
          .fc-list-day-cushion {
            padding: 0.5rem 1rem;
            background: rgba(30, 41, 59, 0.8);
            border-radius: 0.5rem;
            margin: 0.5rem 0;
          }
          
          .fc-list-empty {
            padding: 2rem;
            text-align: center;
            color: rgb(148, 163, 184);
          }
        }
        
        @media (max-width: 1024px) {
          .fc-toolbar-title {
            font-size: 1.25rem;
          }
        }
        
        /* ✅ FÖRBÄTTRAD LISTVY STYLING */
        .fc-list-event-title {
          padding: 0 !important;
        }
        
        .fc-list-event-time {
          display: none; /* Dölj standard tid eftersom vi visar den i custom content */
        }
        
        .fc-list-day {
          background: rgba(30, 41, 59, 0.5);
        }
        
        .fc-list-day-text {
          font-weight: 600;
          color: white;
        }
        
        .fc-list-day-side-text {
          color: rgb(148, 163, 184);
        }
        
        /* ✅ CALENDAR EVENT HOVER EFFEKTER */
        .fc-event:hover {
          transform: scale(1.02);
          transition: transform 0.2s ease;
          z-index: 10;
        }
        
        .fc-list-event:hover .fc-list-event-title {
          background: rgba(59, 130, 246, 0.1) !important;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  )
}
// 📁 src/pages/technician/TechnicianSchedule.tsx - MED STATUSFILTER & MULTI-TEKNIKER SUPPORT

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
import { ArrowLeft, Calendar, Phone, MapPin, Clock, Filter, X, User, Users } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import '../../styles/FullCalendar.css'

interface ScheduledCase {
  id: string; title: string; case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string; start_date: string; end_date?: string; description?: string; status: string;
  case_price?: number; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; adress?: any;
  // ✅ NYA FÄLT FÖR MULTI-TEKNIKER SUPPORT
  primary_assignee_id?: string; secondary_assignee_id?: string; tertiary_assignee_id?: string;
  primary_assignee_name?: string; secondary_assignee_name?: string; tertiary_assignee_name?: string;
  technician_role?: 'primary' | 'secondary' | 'tertiary'; // Vilken roll den inloggade teknikern har
}

// ✅ ALLA BEGONE STATUSAR FÖR FILTRERING
const ALL_STATUSES = [
  'Öppen',
  'Bokad', 
  'Offert skickad',
  'Offert signerad - boka in',
  'Återbesök 1',
  'Återbesök 2', 
  'Återbesök 3',
  'Återbesök 4',
  'Återbesök 5',
  'Privatperson - review',
  'Stängt - slasklogg',
  'Avslutat'
];

// ✅ DEFAULT AKTIVA STATUSAR (allt utom avslutade)
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

// ✅ HELPER FUNKTION FÖR TEKNIKER-ROLL IKON
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

  // ✅ FILTER STATES
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES))
  const [showFilters, setShowFilters] = useState(false)
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'private' | 'business' | 'contract'>('all')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<ScheduledCase | null>(null)

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchScheduledCases(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  // ✅ FÖRBÄTTRAD DATAHÄMTNING MED MULTI-TEKNIKER SUPPORT
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
      
      // ✅ HÄMTA FRÅN ALLA POSITIONER (PRIMÄR, SEKUNDÄR, TERTIÄR)
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
      
      // ✅ PROCESS PRIVATE CASES MED TEKNIKER-ROLL DETECTION
      if (privateResult.status === 'fulfilled' && privateResult.value.data) {
        allCases.push(...privateResult.value.data.map((c: any) => {
          // Bestäm tekniker-roll
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
      
      // ✅ PROCESS BUSINESS CASES MED TEKNIKER-ROLL DETECTION
      if (businessResult.status === 'fulfilled' && businessResult.value.data) {
        allCases.push(...businessResult.value.data.map((c: any) => {
          // Bestäm tekniker-roll
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
      
      // ✅ PROCESS CONTRACT CASES
      if (contractResult.status === 'fulfilled' && contractResult.value.data) {
        allCases.push(...contractResult.value.data.map((c: any) => ({
          ...c,
          start_date: c.created_date,
          case_type: c.case_type || 'contract',
          technician_role: 'primary' as const // Avtal har bara en tekniker
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

  // ✅ FILTRERADE CALENDAR EVENTS
  const calendarEvents = useMemo(() => {
    let filteredCases = cases;
    
    // Filter på status
    if (activeStatuses.size < ALL_STATUSES.length) {
      filteredCases = filteredCases.filter(case_ => activeStatuses.has(case_.status));
    }
    
    // Filter på case type
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
  
  // ✅ FÖRBÄTTRAD EVENT RENDERING MED TEKNIKER-ROLL
  const renderEventContent = (eventInfo: any) => {
    const { 
      case_type, kontaktperson, adress, telefon_kontaktperson, skadedjur, 
      technician_role, primary_assignee_name, secondary_assignee_name, tertiary_assignee_name 
    } = eventInfo.event.extendedProps;
    
    return (
      <div className={`p-2 text-sm overflow-hidden h-full flex flex-col justify-between ${getStatusColorClasses(eventInfo.event.extendedProps.status).split(' ')[0]}`}>
        <div className="flex-grow">
          {/* Header med case type och tekniker-roll */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs opacity-80">{case_type === 'private' ? '👤 Privatperson' : case_type === 'business' ? '🏢 Företag' : '📄 Avtal'}</p>
            {technician_role && (
              <div className="flex items-center gap-1">
                {getTechnicianRoleIcon(technician_role)}
                <span className="text-xs opacity-70">
                  {technician_role === 'primary' ? '1:a' : technician_role === 'secondary' ? '2:a' : '3:e'}
                </span>
              </div>
            )}
          </div>
          
          <p className="font-bold text-sm text-white mb-2">{eventInfo.event.title}</p>
          
          <div className="space-y-1 text-xs opacity-90">
            <p className="flex items-center gap-1.5">
              <Clock className="w-3 h-3"/>
              <span>{eventInfo.timeText}</span>
            </p>
            
            <p className="truncate">
              <span className="font-semibold">Kund:</span> {kontaktperson || 'Okänd'}
            </p>
            
            <p className="truncate">
              <span className="font-semibold">Adress:</span> {formatAddress(adress) || 'Saknas'}
            </p>
            
            <p className="flex items-center gap-1.5">
              <span className="font-semibold">Skadedjur:</span>
              <span className="bg-slate-700/50 px-1.5 py-0.5 rounded">{skadedjur || 'Okänt'}</span>
            </p>
          </div>
          
          {/* Team info för multi-tekniker ärenden */}
          {(secondary_assignee_name || tertiary_assignee_name) && (
            <div className="mt-2 p-1 bg-slate-800/50 rounded text-xs">
              <p className="font-semibold text-blue-300">Team:</p>
              {primary_assignee_name && <p>1. {primary_assignee_name}</p>}
              {secondary_assignee_name && <p>2. {secondary_assignee_name}</p>}
              {tertiary_assignee_name && <p>3. {tertiary_assignee_name}</p>}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {telefon_kontaktperson && (
              <a href={`tel:${telefon_kontaktperson}`} 
                 onClick={(e) => e.stopPropagation()} 
                 className="text-blue-400 hover:text-blue-300 transition-colors" 
                 title={`Ring ${kontaktperson}`}>
                <Phone className="w-4 h-4" />
              </a>
            )}
            {adress && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(adress))}`} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 onClick={(e) => e.stopPropagation()} 
                 className="text-green-400 hover:text-green-300 transition-colors" 
                 title="Navigera till adress">
                <MapPin className="w-4 h-4" />
              </a>
            )}
          </div>
          
          {/* Status badge */}
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColorClasses(eventInfo.event.extendedProps.status)}`}>
            {eventInfo.event.extendedProps.status}
          </span>
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

  // ✅ FILTER HANDLERS
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

  const filteredCasesCount = calendarEvents.length;
  const totalCasesCount = cases.length;

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mitt Schema</h1>
              <p className="text-sm text-slate-400">
                Kalenderöversikt över bokade ärenden ({filteredCasesCount}/{totalCasesCount})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant={showFilters ? "primary" : "secondary"} 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2"/>
              Filter
              {filteredCasesCount < totalCasesCount && (
                <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {filteredCasesCount}
                </span>
              )}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/technician/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2"/>Tillbaka
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        {/* ✅ FILTER PANEL */}
        {showFilters && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Filter</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={selectAllStatuses}>
                  Visa alla
                </Button>
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Återställ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowFilters(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Case Type Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Ärendetyp</label>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Alla' },
                  { value: 'private', label: 'Privatperson' },
                  { value: 'business', label: 'Företag' },
                  { value: 'contract', label: 'Avtal' }
                ].map(type => (
                  <Button
                    key={type.value}
                    size="sm"
                    variant={caseTypeFilter === type.value ? "primary" : "secondary"}
                    onClick={() => setCaseTypeFilter(type.value as any)}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {ALL_STATUSES.map(status => (
                  <label key={status} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeStatuses.has(status)}
                      onChange={() => toggleStatus(status)}
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${activeStatuses.has(status) ? 'text-white' : 'text-slate-400'}`}>
                      {status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        )}

        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            }}
            events={calendarEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            locale={svLocale}
            buttonText={{ today: 'idag', month: 'månad', week: 'vecka', day: 'dag', list: 'lista' }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="19:00:00"
            height="auto"
            eventMinHeight={140} // Ökat för att rymma mer information
            dayMaxEvents={true}
          />
        </div>
      </main>

      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase as any} 
      />
    </div>
  )
}
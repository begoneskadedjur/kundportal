// 📁 src/pages/technician/TechnicianSchedule.tsx
// ⭐ REVOLUTIONERAD VERSION - FOKUS PÅ MOBIL UX & MODERN UI ⭐
// Denna version omstrukturerar hela sidan för att prioritera "Dagens Ärenden".
// - Mobil: En dedikerad, supersnabb agenda-vy för den aktuella dagen.
// - Desktop: En elegant två-panels-layout med en månadskalender för navigation och en detaljerad dag-agenda.
// - Arkitektur: Logik för att rendera ärenden är separerad från FullCalendar för renare kod och bättre prestanda.
// - UX: Optimerad för tekniker i fält med tydliga åtgärdsknappar och omedelbar överblick.

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import svLocale from '@fullcalendar/core/locales/sv'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Calendar, Phone, MapPin, ChevronLeft, ChevronRight, User, Users, Clock, AlertCircle, Navigation, Search, Filter, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import '../../styles/FullCalendar.css'

// Interfaces (behålls från originalet)
interface ScheduledCase {
  id: string; title: string; case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string; start_date: string; end_date?: string; description?: string; status: string;
  case_price?: number; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; adress?: any;
  primary_assignee_name?: string; secondary_assignee_name?: string;
  technician_role?: 'primary' | 'secondary' | 'tertiary';
}

// Hjälpfunktioner (optimerade & behållna)
const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('avslutat')) return { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700/50' };
  if (lowerStatus.startsWith('återbesök')) return { bg: 'bg-cyan-900/50', text: 'text-cyan-300', border: 'border-cyan-700/50' };
  if (lowerStatus.includes('bokad') || lowerStatus.includes('signerad')) return { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-700/50' };
  if (lowerStatus.includes('öppen') || lowerStatus.includes('offert skickad')) return { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700/50' };
  if (lowerStatus.includes('review')) return { bg: 'bg-purple-900/50', text: 'text-purple-300', border: 'border-purple-700/50' };
  return { bg: 'bg-slate-800/50', text: 'text-slate-400', border: 'border-slate-700/50' };
};

const formatAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') {
    try { const p = JSON.parse(address); return p.formatted_address || address; }
    catch (e) { return address; }
  }
  return '';
};

const getCaseTypeIcon = (caseType: 'private' | 'business' | 'contract') => {
  const props = { className: "w-4 h-4" };
  switch (caseType) {
    case 'private': return <User {...props} color="#60a5fa" />; // text-blue-400
    case 'business': return <Users {...props} color="#4ade80" />; // text-green-400
    case 'contract': return <Clock {...props} color="#c084fc" />; // text-purple-400
  }
};

const getCaseTypeText = (caseType: 'private' | 'business' | 'contract') => {
  return { private: 'Privatperson', business: 'Företag', contract: 'Avtal' }[caseType];
};

const ALL_STATUSES = [
  'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in',
  'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'
];

const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => 
  !status.includes('Avslutat') && !status.includes('Stängt')
);

// ⭐ Ny, dedikerad komponent för ett enskilt ärendekort i agendan ⭐
const AgendaCaseItem = ({ caseData, onOpen }: { caseData: ScheduledCase, onOpen: (caseData: ScheduledCase) => void }) => {
  const { status, title, kontaktperson, start_date, case_type, adress, telefon_kontaktperson, skadedjur, case_price, secondary_assignee_name } = caseData;
  const colors = getStatusColor(status);
  const fullAddress = formatAddress(adress);
  const timeStr = new Date(start_date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className={`bg-slate-900 border ${colors.border} rounded-xl overflow-hidden shadow-lg hover:shadow-blue-500/10 transition-shadow duration-300`}
    >
      {/* KORT-HEADER */}
      <div className={`px-4 py-3 flex items-center justify-between border-b ${colors.border} ${colors.bg}`}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-white">{timeStr}</span>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${colors.border} bg-slate-950/50 ${colors.text}`}>{status}</span>
        </div>
        {getCaseTypeIcon(case_type)}
      </div>

      {/* KORT-INNEHÅLL */}
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-bold text-white leading-tight">{title}</h3>
        
        <div className="text-sm space-y-2 text-slate-300">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <span>{kontaktperson || "Okänd kund"}</span>
            {secondary_assignee_name && (
              <span className="flex items-center gap-1.5 ml-auto text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">
                <Users className="w-3 h-3"/> Med: {secondary_assignee_name.split(' ')[0]}
              </span>
            )}
          </div>
          {fullAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
              <span>{fullAddress}</span>
            </div>
          )}
          {skadedjur && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-500" />
              <span><span className="font-medium text-slate-400">Ärende:</span> {skadedjur}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* KORT-ÅTGÄRDER */}
      <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {telefon_kontaktperson && (
            <a href={`tel:${telefon_kontaktperson}`} onClick={e => e.stopPropagation()} className="p-2 bg-blue-500/10 text-blue-400 rounded-full hover:bg-blue-500/20 transition-colors">
              <Phone className="w-5 h-5" />
            </a>
          )}
          {fullAddress && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-2 bg-green-500/10 text-green-400 rounded-full hover:bg-green-500/20 transition-colors">
              <Navigation className="w-5 h-5" />
            </a>
          )}
        </div>
        <Button size="sm" variant="primary" onClick={() => onOpen(caseData)}>
          Öppna ärende <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
};

export default function TechnicianSchedule() {
  const { profile, isTechnician } = useAuth();
  const navigate = useNavigate();

  // State-hantering
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ScheduledCase[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ScheduledCase | null>(null);
  
  // Filtrering & sök-state
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'agenda' | 'month' | 'week'>('agenda');

  // Datainhämtning
  const fetchScheduledCases = useCallback(async (technicianId: string) => {
    setLoading(true);
    // ... (samma datainhämtningslogik som i originalet, ingen ändring behövs här)
    try {
      const commonFields = `id, title, kontaktperson, start_date, created_at, description, status, telefon_kontaktperson, e_post_kontaktperson, skadedjur, adress, primary_assignee_id, secondary_assignee_id, tertiary_assignee_id, primary_assignee_name, secondary_assignee_name, tertiary_assignee_name`;
      const [privateResult, businessResult] = await Promise.all([
        supabase.from('private_cases').select(`${commonFields}, pris`).or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        supabase.from('business_cases').select(`${commonFields}, pris, org_nr`).or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
      ]);
      const allCases: Partial<ScheduledCase>[] = [];
      if (privateResult.data) allCases.push(...privateResult.data.map((c: any) => ({...c, start_date: c.start_date || c.created_at, case_price: c.pris, case_type: 'private' as const, technician_role: c.secondary_assignee_id === technicianId ? 'secondary' : 'primary' })));
      if (businessResult.data) allCases.push(...businessResult.data.map((c: any) => ({...c, start_date: c.start_date || c.created_at, case_price: c.pris, case_type: 'business' as const, technician_role: c.secondary_assignee_id === technicianId ? 'secondary' : 'primary' })));
      setCases(allCases.filter(c => c.start_date) as ScheduledCase[]);
    } catch(err) { console.error(err) }
    finally { setLoading(false) }
  }, []);

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchScheduledCases(profile.technician_id);
    }
  }, [isTechnician, profile?.technician_id, fetchScheduledCases]);

  // Filtrering av ärenden baserat på aktivt filter och sökning
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesStatus = activeStatuses.has(c.status);
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query ||
        c.title.toLowerCase().includes(query) ||
        c.kontaktperson?.toLowerCase().includes(query) ||
        formatAddress(c.adress).toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [cases, activeStatuses, searchQuery]);
  
  // Ärenden för den valda dagen i agendan, sorterade efter tid
  const casesForSelectedDay = useMemo(() => {
    return filteredCases.filter(c => 
      new Date(c.start_date).toDateString() === selectedDate.toDateString()
    ).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [filteredCases, selectedDate]);
  
  // Formattera ärenden för FullCalendar (används nu endast för kalendervyerna)
  const calendarEvents = useMemo(() => {
    return filteredCases.map(c => ({
      id: c.id,
      title: c.title,
      start: new Date(c.start_date),
      end: new Date(new Date(c.start_date).getTime() + 2 * 60 * 60 * 1000), // Anta 2h
      extendedProps: c,
      className: getStatusColor(c.status).bg.replace('bg-', 'event-') + ' border-l-4 ' + getStatusColor(c.status).border.replace('border-', 'border-')
    }));
  }, [filteredCases]);

  const handleDayChange = (offset: number) => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + offset);
      return newDate;
    });
  };

  const handleOpenModal = (caseData: ScheduledCase) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };
  
  const handleUpdateSuccess = (updatedCase: Partial<ScheduledCase>) => {
    fetchScheduledCases(profile!.technician_id!);
    setIsEditModalOpen(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Mitt Schema</h1>
              <p className="text-sm text-slate-400">{profile?.display_name}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/technician/dashboard')} size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ⭐ NY LAYOUT: TVÅ-PANELS FÖR DESKTOP, FLIKAR FÖR MOBIL */}
      <div className="flex-grow max-w-screen-2xl mx-auto w-full p-2 sm:p-4 flex lg:flex-row flex-col gap-4">
        
        {/* VÄNSTER PANEL (KALENDER-NAVIGATOR) - Syns bara på desktop */}
        <aside className="hidden lg:block lg:w-1/3 xl:w-1/4">
          <Card className="p-0 bg-slate-900/50 border-slate-800 sticky top-[76px]">
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              locale={svLocale}
              headerToolbar={false}
              height="auto"
              dateClick={(arg) => setSelectedDate(arg.date)}
              dayCellClassNames={({ date }) => date.toDateString() === selectedDate.toDateString() ? 'day-selected' : ''}
            />
          </Card>
        </aside>

        {/* HÖGER PANEL (AGENDA / KALENDER) - Huvudinnehåll */}
        <main className="flex-grow w-full lg:w-2/3 xl:w-3/4">
          {/* Mobilvy-väljare */}
          <div className="lg:hidden mb-4 p-1 bg-slate-800 rounded-lg flex gap-1">
            {(['agenda', 'month'] as const).map(view => (
              <Button
                key={view}
                variant={mobileView === view ? 'primary' : 'ghost'}
                onClick={() => setMobileView(view)}
                className="w-full"
              >
                {view === 'agenda' ? 'Dagens Ärenden' : 'Månad'}
              </Button>
            ))}
          </div>

          {/* Sök och filter */}
          <div className="mb-4 flex gap-2">
            <div className="flex-grow relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Sök på kund eller adress..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Renderar antingen Agendan eller Kalendern baserat på vy */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mobileView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* ⭐ HUVUDVY: DAGENS ÄRENDEN (AGENDA) */}
              <div className={(mobileView === 'agenda' || window.innerWidth >= 1024) ? 'block' : 'hidden'}>
                <header className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    {selectedDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h2>
                  <div className="flex items-center gap-1">
                    <Button variant="secondary" size="icon" onClick={() => handleDayChange(-1)}><ChevronLeft className="w-5 h-5"/></Button>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedDate(new Date())}>Idag</Button>
                    <Button variant="secondary" size="icon" onClick={() => handleDayChange(1)}><ChevronRight className="w-5 h-5"/></Button>
                  </div>
                </header>

                <div className="space-y-3">
                  <AnimatePresence>
                    {casesForSelectedDay.length > 0 ? (
                      casesForSelectedDay.map(caseData => (
                        <AgendaCaseItem key={caseData.id} caseData={caseData} onOpen={handleOpenModal} />
                      ))
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 px-4 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                        <Calendar className="mx-auto w-12 h-12 text-slate-600 mb-2" />
                        <h3 className="text-lg font-semibold text-slate-300">Inga ärenden</h3>
                        <p className="text-slate-500">Du har inga schemalagda ärenden för denna dag.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* FullCalendar-vy (används för månad/vecka på mobil) */}
              <div className={(mobileView !== 'agenda' && window.innerWidth < 1024) ? 'block' : 'hidden'}>
                <Card className="p-0 bg-slate-900/50 border-slate-800">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
                    initialView={mobileView === 'month' ? 'dayGridMonth' : 'timeGridWeek'}
                    events={calendarEvents}
                    locale={svLocale}
                    headerToolbar={{ left: 'title', center: '', right: 'prev,next' }}
                    height="auto"
                    eventClick={info => handleOpenModal(info.event.extendedProps as ScheduledCase)}
                  />
                </Card>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase} 
      />
    </div>
  )
}
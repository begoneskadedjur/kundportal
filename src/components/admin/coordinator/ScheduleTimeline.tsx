// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.9 - FIXAR UI-BUGG FÖR VY-VÄXLARE ⭐

import React, { useMemo, useRef, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import svLocale from '@fullcalendar/core/locales/sv';
import { BeGoneCaseRow, Technician } from '../../../types/database';

import type { EventContentArg } from '@fullcalendar/core';
import type { EventClickArg } from '@fullcalendar/interaction';
import { Absence } from '../../../pages/coordinator/CoordinatorSchedule';
import { Users } from 'lucide-react';

import '../../../styles/FullCalendar.css';

interface ScheduleTimelineProps {
  technicians: Technician[];
  cases: BeGoneCaseRow[];
  absences: Absence[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const ls = status?.toLowerCase() || '';
    if (ls.includes('avslutat')) return { bg: 'bg-green-600', text: 'text-white', border: 'border-green-700' };
    if (ls.startsWith('återbesök')) return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' };
    if (ls.includes('signerad')) return { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' };
    if (ls.includes('offert')) return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' };
    if (ls.includes('bokad') || ls.includes('bokat')) return { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-600' };
    if (ls.includes('review')) return { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-700' };
    if (ls.includes('stängt')) return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' };
    return { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-600' };
};

const renderEventContent = (eventInfo: EventContentArg) => {
    const props = eventInfo.event.extendedProps;

    if (props.type === 'absence') {
        return (
             <div className="w-full h-full p-2 flex items-center justify-start overflow-hidden bg-slate-700/80 border-l-4 border-slate-600 rounded-sm cursor-not-allowed"
                style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)' }}
                title={`${props.reason} (${new Date(props.start_date).toLocaleDateString('sv-SE')} - ${new Date(props.end_date).toLocaleDateString('sv-SE')})`}>
                <p className="font-bold text-sm text-white truncate">{props.reason}</p>
            </div>
        );
    }
    
    const caseData = props as BeGoneCaseRow;
    const colors = getStatusColor(caseData.status);
    const formatTime = (date: Date | null) => date ? date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
    const startTime = formatTime(eventInfo.event.start);
    const endTime = formatTime(eventInfo.event.end);
    const timeSpan = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || '');

    const allTechnicians = [
        caseData.primary_assignee_name,
        caseData.secondary_assignee_name,
        caseData.tertiary_assignee_name
    ].filter(Boolean);

    return (
        <div className={`w-full h-full p-2 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm cursor-pointer hover:opacity-90 transition-all shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
                <p className={`font-bold text-xs leading-tight truncate ${colors.text}`}>{eventInfo.event.title}</p>
                {timeSpan && <span className={`text-xs font-mono ${colors.text} opacity-90`}>{timeSpan}</span>}
            </div>
            
            <div className={`flex items-center gap-1.5 text-xs ${colors.text} opacity-80 truncate`}>
                <Users size={12} className="shrink-0"/>
                <span className="truncate">{allTechnicians.join(', ')}</span>
            </div>

            {caseData.skadedjur && <p className={`text-xs ${colors.text} opacity-70 truncate mt-1`}>{caseData.skadedjur}</p>}
        </div>
    );
};

// Hjälpfunktioner för datumformatering
const formatDateRange = (date: Date, view: 'day' | 'week' | 'month'): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  if (view === 'day') {
    return date.toLocaleDateString('sv-SE', options);
  } else if (view === 'week') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1); // Måndag
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Söndag
    
    const startStr = weekStart.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    const endStr = weekEnd.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Vecka ${getWeekNumber(date)} • ${startStr} - ${endStr}`;
  } else {
    return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
  }
};

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

export default function ScheduleTimeline({ technicians, cases, absences, onCaseClick }: ScheduleTimelineProps) {
  
  const calendarRef = useRef<FullCalendar>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  
  const calendarResources = useMemo(() => technicians.map(tech => ({ id: tech.id, title: tech.name })), [technicians]);

  const calendarEvents = useMemo(() => {
    const caseEvents = cases.flatMap(c => {
        if (!c.start_date || !c.due_date) return [];
        const assignees = [
            { id: c.primary_assignee_id, name: c.primary_assignee_name, role: 'primary' },
            { id: c.secondary_assignee_id, name: c.secondary_assignee_name, role: 'secondary' },
            { id: c.tertiary_assignee_id, name: c.tertiary_assignee_name, role: 'tertiary' }
        ].filter(a => a.id);
        if (assignees.length === 0) return [];
        return assignees.map(assignee => ({
            id: `${c.id}-${assignee.role}`,
            resourceId: assignee.id,
            title: c.title,
            start: new Date(c.start_date!).toISOString(),
            end: new Date(c.due_date!).toISOString(),
            extendedProps: { ...c, type: 'case' },
            backgroundColor: 'transparent',
            borderColor: 'transparent'
        }));
    });
    const absenceEvents = absences.map(a => ({
        id: `absence-${a.id}`,
        resourceId: a.technician_id,
        title: a.reason,
        start: new Date(a.start_date).toISOString(),
        end: new Date(a.end_date).toISOString(),
        extendedProps: { ...a, type: 'absence' },
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        editable: false,
    }));
    return [...caseEvents, ...absenceEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [cases, absences]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (clickInfo.event.extendedProps.type === 'case') {
      onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
    }
  };

  // Synkronisera kalendern med vår state
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.on('datesSet', (dateInfo) => {
        setCurrentDate(dateInfo.start);
      });
    }
  }, []);

  const changeView = (viewName: string) => {
    const viewMap: Record<string, 'day' | 'week' | 'month'> = {
      'resourceTimelineDay': 'day',
      'resourceTimelineWeek': 'week',
      'resourceTimelineMonth': 'month'
    };
    setCurrentView(viewMap[viewName] || 'day');
    calendarRef.current?.getApi().changeView(viewName);
  };
  
  const navigateCalendar = (direction: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if(api) { 
      direction === 'today' ? api.today() : api[direction]();
    }
  };

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <div className="bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
          {/* Ny datumvisning inspirerad av modalernas design */}
          <div className="px-6 py-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                      <div className="text-center">
                          <h2 className="text-3xl font-bold text-white">
                              {formatDateRange(currentDate, currentView).split('•')[0]}
                          </h2>
                          {currentView === 'week' && (
                              <p className="text-sm text-slate-400 mt-1">
                                  {formatDateRange(currentDate, currentView).split('•')[1]}
                              </p>
                          )}
                      </div>
                      
                      {/* Idag-indikator */}
                      {currentView === 'day' && new Date().toDateString() === currentDate.toDateString() && (
                          <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm font-medium rounded-full">
                              Idag
                          </span>
                      )}
                  </div>
                  
                  {/* Navigeringskontroller */}
                  <div className="flex items-center gap-4">
                      <div className="flex bg-slate-700/50 rounded-lg p-1">
                          <button 
                              onClick={() => changeView('resourceTimelineDay')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                  currentView === 'day' 
                                      ? 'bg-slate-600 text-white shadow-sm' 
                                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                              }`}
                          >
                              Dag
                          </button>
                          <button 
                              onClick={() => changeView('resourceTimelineWeek')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                  currentView === 'week' 
                                      ? 'bg-slate-600 text-white shadow-sm' 
                                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                              }`}
                          >
                              Vecka
                          </button>
                          <button 
                              onClick={() => changeView('resourceTimelineMonth')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                  currentView === 'month' 
                                      ? 'bg-slate-600 text-white shadow-sm' 
                                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                              }`}
                          >
                              Månad
                          </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <button 
                              onClick={() => navigateCalendar('prev')} 
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                              title="Föregående"
                          >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                          </button>
                          <button 
                              onClick={() => navigateCalendar('today')} 
                              className="px-4 py-2 text-sm font-medium bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 rounded-lg transition-all"
                          >
                              Idag
                          </button>
                          <button 
                              onClick={() => navigateCalendar('next')} 
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                              title="Nästa"
                          >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
          
          {/* Statusförklaring */}
          <div className="px-6 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">Schema Timeline</h3>
              <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-gray-500 rounded-sm"></div>
                      <span className="text-slate-400">Öppen</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                      <span className="text-slate-400">Bokat</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
                      <span className="text-slate-400">Offert</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                      <span className="text-slate-400">Signerad</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                      <span className="text-slate-400">Återbesök</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-green-600 rounded-sm"></div>
                      <span className="text-slate-400">Avslutat</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex-grow p-4">
        <FullCalendar
          ref={calendarRef}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          locale={svLocale}
          headerToolbar={{left: '', center: '', right: ''}}
          initialView="resourceTimelineDay"
          resources={calendarResources}
          events={calendarEvents}
          eventClick={handleEventClick}
          height="100%"
          resourceAreaHeaderContent="Tekniker"
          resourceAreaWidth="15%"
          slotMinWidth={60}
          nowIndicator={true}
          views={{
            resourceTimelineDay: { slotDuration: '01:00:00', slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false }, slotLabelInterval: '02:00:00' },
            resourceTimelineWeek: { slotDuration: { days: 1 }, slotLabelFormat: { weekday: 'short', day: 'numeric', month: 'numeric' } },
            resourceTimelineMonth: { slotDuration: { days: 1 }, slotLabelFormat: { day: 'numeric' } }
          }}
          eventContent={renderEventContent}
          slotMinTime="06:00:00"
          slotMaxTime="19:00:00"
          scrollTime="07:00:00"
          expandRows={true}
          editable={false}
          eventMinHeight={70}
        />
      </div>
    </div>
  );
}
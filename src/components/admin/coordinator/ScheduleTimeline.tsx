// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.6 - TIDSSPANN OCH NY FÄRGKODNING ENLIGT STATUSAR ⭐

import React, { useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import svLocale from '@fullcalendar/core/locales/sv';
import { BeGoneCaseRow, Technician } from '../../../types/database';

// Importera typerna korrekt
import type { EventContentArg } from '@fullcalendar/core';
import type { EventClickArg } from '@fullcalendar/interaction';

import '../../../styles/FullCalendar.css';

interface ScheduleTimelineProps {
  technicians: Technician[];
  cases: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

// ✅ NY FÄRGKODNING ENLIGT STATUSAR
const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const ls = status?.toLowerCase() || '';
    
    // Avslutat = Grön
    if (ls.includes('avslutat')) {
        return { bg: 'bg-green-600', text: 'text-white', border: 'border-green-700' };
    }
    
    // Alla återbesök = Blå
    if (ls.startsWith('återbesök')) {
        return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' };
    }
    
    // Offert signerad - boka in = Ljusgrön
    if (ls.includes('signerad') && ls.includes('boka')) {
        return { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' };
    }
    
    // Offert skickad = Orange
    if (ls.includes('offert') && ls.includes('skickad')) {
        return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' };
    }
    
    // Bokad = Gul
    if (ls.includes('bokad')) {
        return { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-600' };
    }
    
    // Privatperson - review = Lila
    if (ls.includes('review')) {
        return { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-700' };
    }
    
    // Stängt - slasklogg = Röd
    if (ls.includes('stängt') || ls.includes('slasklogg')) {
        return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' };
    }
    
    // Öppen = Grå (default)
    return { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-600' };
};

const renderEventContent = (eventInfo: EventContentArg) => {
    const caseData = eventInfo.event.extendedProps as BeGoneCaseRow;
    const colors = getStatusColor(caseData.status);
    
    // ✅ VISA TIDSSPANN: START - SLUT
    const formatTime = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    };
    
    const startTime = formatTime(eventInfo.event.start);
    const endTime = formatTime(eventInfo.event.end);
    const timeSpan = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || '');

    return (
        <div className={`w-full h-full p-2 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm cursor-pointer hover:opacity-90 transition-all shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
                <p className={`font-bold text-xs leading-tight truncate ${colors.text}`}>
                    {eventInfo.event.title}
                </p>
                {timeSpan && (
                    <span className={`text-xs font-mono ${colors.text} opacity-90`}>
                        {timeSpan}
                    </span>
                )}
            </div>
            
            {caseData.kontaktperson && (
                <p className={`text-xs ${colors.text} opacity-80 truncate`}>
                    {caseData.kontaktperson}
                </p>
            )}
            
            {caseData.skadedjur && (
                <p className={`text-xs ${colors.text} opacity-70 truncate`}>
                    {caseData.skadedjur}
                </p>
            )}
            
            {/* Status-badge */}
            <div className="mt-1">
                <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${colors.text} opacity-60 bg-black bg-opacity-20`}>
                    {caseData.status}
                </span>
            </div>
        </div>
    );
};

export default function ScheduleTimeline({ technicians, cases, onCaseClick }: ScheduleTimelineProps) {
  
  // ✅ USEREF FÖR SÄKER KALENDER-KONTROLL
  const calendarRef = useRef<FullCalendar>(null);
  
  const calendarResources = useMemo(() => {
    return technicians.map(tech => ({
      id: tech.id,
      title: tech.name,
    }));
  }, [technicians]);

  const calendarEvents = useMemo(() => {
    return cases
      .filter(c => c.primary_assignee_id && (c.start_date || c.due_date)) // Endast schemalagda ärenden
      .map(c => {
        // ✅ HANTERA TIDSSPANN KORREKT
        let eventStart: string;
        let eventEnd: string;
        
        if (c.start_date && c.due_date) {
          // Båda datum finns - använd som tidsspann
          eventStart = new Date(c.start_date).toISOString();
          eventEnd = new Date(c.due_date).toISOString();
        } else if (c.start_date) {
          // Endast startdatum - ge 2 timmars default
          const start = new Date(c.start_date);
          eventStart = start.toISOString();
          start.setHours(start.getHours() + 2);
          eventEnd = start.toISOString();
        } else if (c.due_date) {
          // Endast slutdatum - ge 2 timmar bakåt
          const end = new Date(c.due_date);
          eventEnd = end.toISOString();
          end.setHours(end.getHours() - 2);
          eventStart = end.toISOString();
        } else {
          // Inget datum - använd nu + 2 timmar
          const now = new Date();
          eventStart = now.toISOString();
          now.setHours(now.getHours() + 2);
          eventEnd = now.toISOString();
        }

        return {
          id: c.id,
          resourceId: c.primary_assignee_id,
          title: c.title,
          start: eventStart,
          end: eventEnd,
          extendedProps: c,
          // Låt vår renderEventContent hantera färger
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit'
        };
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()); // ✅ Sortera efter starttid
  }, [cases]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
  };

  // ✅ VY-VÄXLINGSFUNKTIONER
  const changeView = (viewName: string) => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(viewName);
    }
  };

  const navigateCalendar = (direction: 'prev' | 'next' | 'today') => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      if (direction === 'today') {
        calendarApi.today();
      } else {
        calendarApi[direction]();
      }
    }
  };

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      {/* ✅ ANPASSAD HEADER MED VY-KNAPPAR */}
      <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Schema Timeline</h2>
            
            {/* ✅ STATUS-FÄRGGUIDE */}
            <div className="hidden xl:flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-500 rounded"></div>
                <span className="text-slate-300">Öppen</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-slate-300">Bokad</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-slate-300">Offert</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                <span className="text-slate-300">Signerad</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span className="text-slate-300">Återbesök</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-600 rounded"></div>
                <span className="text-slate-300">Avslutat</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Vy-väljare */}
            <div className="flex bg-slate-700 rounded-lg p-1">
              <button 
                onClick={() => changeView('resourceTimelineDay')}
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-600 rounded-md transition-colors"
              >
                Dag
              </button>
              <button 
                onClick={() => changeView('resourceTimelineWeek')}
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-600 rounded-md transition-colors"
              >
                Vecka
              </button>
              <button 
                onClick={() => changeView('resourceTimelineMonth')}
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-600 rounded-md transition-colors"
              >
                Månad
              </button>
            </div>
            
            {/* Navigeringsknappar */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => navigateCalendar('prev')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                title="Föregående"
              >
                ←
              </button>
              <button 
                onClick={() => navigateCalendar('today')}
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
              >
                Idag
              </button>
              <button 
                onClick={() => navigateCalendar('next')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                title="Nästa"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ FULLCALENDAR MED MINIMAL HEADER */}
      <div className="flex-grow p-4">
        <FullCalendar
          ref={calendarRef}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          locale={svLocale}

          // ✅ MINIMAL HEADER - ENDAST TITEL
          headerToolbar={{
            left: '',
            center: 'title',
            right: '',
          }}
          
          // ✅ SVENSKA KNAPPTEXTER
          buttonText={{
            today: 'Idag',
            month: 'Månad',
            week: 'Vecka',
            day: 'Dag'
          }}
          
          initialView="resourceTimelineDay" // Starta med dagsvyn för bäst detaljnivå
          
          resources={calendarResources}
          events={calendarEvents}
          eventClick={handleEventClick}
          
          height="100%"
          resourceAreaHeaderContent="Tekniker"
          resourceAreaWidth="15%" // Lite mindre för mer schemayta
          
          // ✅ FÖRBÄTTRADE INSTÄLLNINGAR FÖR TIDSVISNING
          slotMinWidth={60}            // Bredd på tids-slots
          nowIndicator={true}          // Röd linje för nuvarande tid
          
          // ✅ FÖRBÄTTRADE VY-INSTÄLLNINGAR
          views={{
            resourceTimelineDay: {
              slotDuration: '01:00:00',
              slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
              slotLabelInterval: '02:00:00'
            },
            resourceTimelineWeek: {
              slotDuration: { days: 1 },
              slotLabelFormat: { weekday: 'short', day: 'numeric', month: 'numeric' },
              dayHeaderFormat: { weekday: 'short', day: 'numeric' }
            },
            resourceTimelineMonth: {
              slotDuration: { days: 1 },
              slotLabelFormat: { day: 'numeric' },
              dayHeaderFormat: { day: 'numeric' }
            }
          }}
          
          eventContent={renderEventContent}
          
          // ✅ VISA ARBETSTIDER
          slotMinTime="06:00:00"
          slotMaxTime="19:00:00"
          scrollTime="07:00:00" // Scrolla till arbetsdagens början
          
          // ✅ GRUNDLÄGGANDE INSTÄLLNINGAR
          weekends={true}              // Visa helger
          hiddenDays={[]}              // Dölj inga dagar
          expandRows={true}            // Expandera rader
          
          noEventsContent="Inga bokade ärenden att visa"
          defaultTimedEventDuration="02:00"
          
          // ✅ INTERAKTIVITET
          editable={false}
          selectable={true}
          selectMirror={true}
          eventInteractionEnabled={true}
          displayEventTime={false}     // Vi visar tid i vår egen renderEventContent
          displayEventEnd={false}
          eventMinHeight={80}          // Lite högre för att få plats med all info
        />
      </div>
    </div>
  );
}
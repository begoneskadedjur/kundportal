// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.5 - UPPDATERAD MED VY-VÄXLING OCH FÖRBÄTTRAD HEADER ⭐

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

const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const ls = status?.toLowerCase() || '';
    if (ls.includes('avslutat')) return { bg: 'bg-green-900/60', text: 'text-green-300', border: 'border-green-600' };
    if (ls.startsWith('återbesök')) return { bg: 'bg-cyan-900/60', text: 'text-cyan-300', border: 'border-cyan-600' };
    if (ls.includes('bokad') || ls.includes('signerad')) return { bg: 'bg-blue-900/60', text: 'text-blue-300', border: 'border-blue-600' };
    if (ls.includes('öppen') || ls.includes('offert')) return { bg: 'bg-yellow-900/60', text: 'text-yellow-300', border: 'border-yellow-600' };
    if (ls.includes('review')) return { bg: 'bg-purple-900/60', text: 'text-purple-300', border: 'border-purple-600' };
    return { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' };
};

const renderEventContent = (eventInfo: EventContentArg) => {
    const caseData = eventInfo.event.extendedProps as BeGoneCaseRow;
    const colors = getStatusColor(caseData.status);
    const startTime = eventInfo.event.start ? eventInfo.event.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div className={`w-full h-full p-2 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm cursor-pointer hover:brightness-125 transition-all`}>
            <div className="flex items-center justify-between mb-1">
                <p className={`font-bold text-xs leading-tight truncate ${colors.text}`}>{eventInfo.event.title}</p>
                {startTime && <span className="text-xs text-slate-400 font-mono">{startTime}</span>}
            </div>
            {caseData.kontaktperson && <p className="text-xs text-slate-400 truncate">{caseData.kontaktperson}</p>}
            {caseData.skadedjur && <p className="text-xs text-slate-500 truncate">{caseData.skadedjur}</p>}
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
    return cases.map(c => {
        // Säkerställer att det finns ett giltigt startdatum att rendera
        const eventStart = c.start_date ? new Date(c.start_date).toISOString() : new Date().toISOString();
        let eventEnd = c.due_date ? new Date(c.due_date).toISOString() : undefined;

        // Om det bara finns ett startdatum, ge det en standardlängd på 2 timmar
        if (c.start_date && !c.due_date) {
            const start = new Date(c.start_date);
            start.setHours(start.getHours() + 2);
            eventEnd = start.toISOString();
        }

        return {
          id: c.id,
          resourceId: c.primary_assignee_id,
          title: c.title,
          start: eventStart,
          end: eventEnd,
          extendedProps: c,
          // Vi sätter färg via eventContent istället för dessa
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
    });
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
          <h2 className="text-lg font-semibold text-white">Schema Timeline</h2>
          
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
          displayEventTime={true}
          displayEventEnd={false}
        />
      </div>
    </div>
  );
}
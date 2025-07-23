// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.5 - KORRIGERADE TYP-IMPORTER + DATUM-HANTERING FÖR TIMESTAMPTZ ⭐

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import svLocale from '@fullcalendar/core/locales/sv';
import { BeGoneCaseRow, Technician, toFullCalendarDate } from '../../../types/database';

// ✅ FIX: Korrigerade importer för FullCalendar typer (6.1.18)
import type { EventContentArg, EventClickArg } from '@fullcalendar/core';

import '../../../styles/FullCalendar.css'; // Säkerställ att denna fil finns

interface ScheduleTimelineProps {
  technicians: Technician[];
  cases: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

// Hjälpfunktion för att färglägga ärenden baserat på status
const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const ls = status?.toLowerCase() || '';
    if (ls.includes('avslutat')) return { bg: 'bg-green-900/60', text: 'text-green-300', border: 'border-green-600' };
    if (ls.startsWith('återbesök')) return { bg: 'bg-cyan-900/60', text: 'text-cyan-300', border: 'border-cyan-600' };
    if (ls.includes('bokad') || ls.includes('signerad')) return { bg: 'bg-blue-900/60', text: 'text-blue-300', border: 'border-blue-600' };
    if (ls.includes('öppen') || ls.includes('offert')) return { bg: 'bg-yellow-900/60', text: 'text-yellow-300', border: 'border-yellow-600' };
    if (ls.includes('review')) return { bg: 'bg-purple-900/60', text: 'text-purple-300', border: 'border-purple-600' };
    return { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' };
};

// Anpassad funktion för att rendera innehållet i varje ärende-kort
const renderEventContent = (eventInfo: EventContentArg) => {
    const caseData = eventInfo.event.extendedProps as BeGoneCaseRow;
    const colors = getStatusColor(caseData.status);

    // Formatera tid för visning
    const startTime = eventInfo.event.start ? 
      eventInfo.event.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div className={`w-full h-full p-2 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm cursor-pointer hover:brightness-125 transition-all`}>
            <div className="flex items-center justify-between mb-1">
                <p className={`font-bold text-xs leading-tight truncate ${colors.text}`}>{eventInfo.event.title}</p>
                {startTime && <span className="text-xs text-slate-400">{startTime}</span>}
            </div>
            {caseData.kontaktperson && <p className="text-xs text-slate-400 truncate">{caseData.kontaktperson}</p>}
            {caseData.skadedjur && <p className="text-xs text-slate-500 truncate">{caseData.skadedjur}</p>}
        </div>
    );
};

export default function ScheduleTimeline({ technicians, cases, onCaseClick }: ScheduleTimelineProps) {
  
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
        // ✅ Använd hjälpfunktionen för att konvertera timestamptz till ISO-format
        const startDate = toFullCalendarDate(c.start_date);
        const endDate = toFullCalendarDate(c.due_date);
        
        // Om inget startdatum, använd due_date som start
        const eventStart = startDate || endDate;
        
        // Om bara startdatum finns, sätt slutdatum 2 timmar senare
        let eventEnd = endDate;
        if (startDate && !endDate) {
          const start = new Date(c.start_date!);
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
          backgroundColor: 'transparent', // Låt vår custom styling hantera färger
          borderColor: 'transparent',
          textColor: 'inherit'
        };
      })
      .filter(event => event.start); // Filtrera bort events utan startdatum
  }, [cases]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
  };

  return (
    <div className="p-4 h-full w-full bg-slate-900">
      <FullCalendar
        // Licensnyckel för utvecklingsmiljö
        schedulerLicenseKey="GPL-MY-PROJECT-IS-OPEN-SOURCE"
        
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        locale={svLocale}

        // Korrekt header med alla knappar
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth',
        }}
        
        initialView="resourceTimelineWeek"
        
        resources={calendarResources}
        events={calendarEvents}
        eventClick={handleEventClick}
        
        height="100%"
        resourceAreaHeaderContent="Tekniker"
        resourceAreaWidth="20%"
        slotMinWidth={120} // Lite bredare för bättre läsbarhet
        eventContent={renderEventContent}
        
        noEventsContent="Inga bokade ärenden att visa"
        defaultTimedEventDuration="02:00" // Standard 2 timmar
        
        // ✅ Bättre tidsformat för svenska användare
        views={{
            resourceTimelineWeek: {
                slotLabelFormat: { weekday: 'short', day: 'numeric', month: 'numeric' }
            },
            resourceTimelineDay: {
                slotLabelFormat: { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
            },
            resourceTimelineMonth: {
                slotLabelFormat: { day: 'numeric' }
            }
        }}
        
        // Starta scrollning vid 08:00
        scrollTime={'08:00:00'}
        
        // Begränsa arbetstid
        slotMinTime={'06:00:00'}
        slotMaxTime={'20:00:00'}
        
        // Bättre responsivitet
        dayMinWidth={150}
        expandRows={true}
        
        // Tillåt event-interaktion
        editable={false} // Vi hanterar redigering via modal
        selectable={false}
        
        // Bättre UX
        eventInteractionEnabled={true}
        displayEventTime={true}
        displayEventEnd={false} // Visa bara starttid för att spara plats
      />
    </div>
  );
}
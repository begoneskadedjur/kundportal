// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 1.0 - INTERAKTIV TIDSLINJE MED FULLCALENDAR ⭐

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import svLocale from '@fullcalendar/core/locales/sv';
import { BeGoneCaseRow, Technician } from '../../../types/database';
import { EventClickArg, EventContentArg } from '@fullcalendar/core';
import '../../../styles/FullCalendar.css'; // Återanvänder er befintliga FullCalendar-styling

interface ScheduleTimelineProps {
  technicians: Technician[];
  cases: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

// HJÄLPFUNKTION: Kopierad från TechnicianSchedule för att kunna färglägga events.
// Notera att Tailwind's JIT-compiler måste kunna "se" dessa klassnamn för att de ska fungera.
const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const ls = status?.toLowerCase() || '';
    if (ls.includes('avslutat')) return { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700' };
    if (ls.startsWith('återbesök')) return { bg: 'bg-cyan-900/50', text: 'text-cyan-300', border: 'border-cyan-700' };
    if (ls.includes('bokad') || ls.includes('signerad')) return { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-700' };
    if (ls.includes('öppen') || ls.includes('offert')) return { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700' };
    if (ls.includes('review')) return { bg: 'bg-purple-900/50', text: 'text-purple-300', border: 'border-purple-700' };
    return { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' };
};

// Komponent för att rendera innehållet i varje ärende-event
const renderEventContent = (eventInfo: EventContentArg) => {
    const caseData = eventInfo.event.extendedProps as BeGoneCaseRow;
    const colors = getStatusColor(caseData.status);

    return (
        <div className={`w-full h-full p-1.5 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm`}>
            <p className={`font-bold text-sm leading-tight truncate ${colors.text}`}>{eventInfo.event.title}</p>
            {caseData.kontaktperson && <p className="text-xs text-slate-400 truncate">{caseData.kontaktperson}</p>}
        </div>
    );
};


export default function ScheduleTimeline({ technicians, cases, onCaseClick }: ScheduleTimelineProps) {
  // Omvandla våra tekniker till FullCalendars "Resource"-format.
  // useMemo används för prestanda, så att detta inte räknas om vid varje render.
  const calendarResources = useMemo(() => {
    return technicians.map(tech => ({
      id: tech.id,
      title: tech.name,
    }));
  }, [technicians]);

  // Omvandla våra ärenden till FullCalendars "Event"-format.
  const calendarEvents = useMemo(() => {
    return cases.map(c => ({
      id: c.id,
      resourceId: c.primary_assignee_id, // Detta kopplar ärendet till en tekniker!
      title: c.title,
      start: c.start_date!,
      end: c.due_date || c.start_date!, // Säkerställ att det alltid finns ett slutdatum
      extendedProps: c, // Här sparar vi all originaldata från ärendet
    }));
  }, [cases]);

  // Hanterar klick på ett ärende i kalendern.
  const handleEventClick = (clickInfo: EventClickArg) => {
    onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
  };

  return (
    <div className="p-4 h-full w-full bg-slate-900">
      {/* 
        FullCalendar kräver en licensnyckel för resourceTimeline-vyn. 
        "GPL-TO-REMOVE-THE-WARNING" kan användas under utveckling.
        För kommersiellt bruk, besök https://fullcalendar.io/license
      */}
      <FullCalendar
        schedulerLicenseKey="GPL-TO-REMOVE-THE-WARNING"
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineWeek"
        locale={svLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth',
        }}
        
        // Data
        resources={calendarResources}
        events={calendarEvents}

        // Interaktion
        eventClick={handleEventClick}
        
        // Utseende & Layout
        height="100%"
        resourceAreaHeaderContent="Tekniker"
        resourceAreaWidth="20%"
        slotMinWidth={120} // Minsta bredd för en dagskolumn
        eventContent={renderEventContent} // Använder vår anpassade render-funktion
        views={{
            resourceTimelineWeek: {
                slotLabelFormat: { weekday: 'short', day: 'numeric', month: 'numeric' }
            },
            resourceTimelineDay: {
                slotLabelFormat: { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
            }
        }}
        scrollTime={'08:00:00'} // Centrerar vyn kring arbetstidens början
      />
    </div>
  );
}
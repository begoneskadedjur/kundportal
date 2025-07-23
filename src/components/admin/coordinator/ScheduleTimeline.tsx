// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.1 - ROBUST OCH ANVÄNDARVÄNLIG TIDSLINJE ⭐

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

// HJÄLPFUNKTION: Förfinad färgkodning av status
const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const ls = status?.toLowerCase() || '';
    if (ls.includes('avslutat')) return { bg: 'bg-green-900/60', text: 'text-green-300', border: 'border-green-600' };
    if (ls.startsWith('återbesök')) return { bg: 'bg-cyan-900/60', text: 'text-cyan-300', border: 'border-cyan-600' };
    if (ls.includes('bokad') || ls.includes('signerad')) return { bg: 'bg-blue-900/60', text: 'text-blue-300', border: 'border-blue-600' };
    if (ls.includes('öppen') || ls.includes('offert')) return { bg: 'bg-yellow-900/60', text: 'text-yellow-300', border: 'border-yellow-600' };
    if (ls.includes('review')) return { bg: 'bg-purple-900/60', text: 'text-purple-300', border: 'border-purple-600' };
    return { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' };
};

// Anpassad rendering för varje ärende-kort i kalendern
const renderEventContent = (eventInfo: EventContentArg) => {
    const caseData = eventInfo.event.extendedProps as BeGoneCaseRow;
    const colors = getStatusColor(caseData.status);

    return (
        <div className={`w-full h-full p-2 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm cursor-pointer hover:brightness-125 transition-all`}>
            <p className={`font-bold text-sm leading-tight truncate ${colors.text}`}>{eventInfo.event.title}</p>
            {caseData.kontaktperson && <p className="text-xs text-slate-400 truncate">{caseData.kontaktperson}</p>}
        </div>
    );
};


export default function ScheduleTimeline({ technicians, cases, onCaseClick }: ScheduleTimelineProps) {
  // Omvandla tekniker till FullCalendars "Resource"-format
  const calendarResources = useMemo(() => {
    return technicians.map(tech => ({
      id: tech.id,
      title: tech.name,
    }));
  }, [technicians]);

  // Omvandla ärenden till FullCalendars "Event"-format
  const calendarEvents = useMemo(() => {
    return cases.map(c => ({
      id: c.id,
      resourceId: c.primary_assignee_id,
      title: c.title,
      start: c.start_date!,
      end: c.due_date, // Om due_date är null, hanterar FullCalendar det korrekt med defaultEventMinutes
      extendedProps: c,
    }));
  }, [cases]);

  // Hantera klick på ett ärende
  const handleEventClick = (clickInfo: EventClickArg) => {
    onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
  };

  return (
    <div className="p-4 h-full w-full bg-slate-900">
      <FullCalendar
        // Licensnyckel för att ta bort varningsmeddelandet under utveckling
        schedulerLicenseKey="GPL-TO-REMOVE-THE-WARNING"
        
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        locale={svLocale}

        // Standardvy är nu "resourceTimelineWeek"
        initialView="resourceTimelineWeek"

        // Komplett header med navigeringsknappar och vy-bytare
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
        slotMinWidth={100}
        eventContent={renderEventContent} // Använder vår anpassade render-funktion

        // ✅ NYTT: Visar ett meddelande om inga ärenden finns för den valda perioden
        noEventsContent="Inga bokade ärenden att visa"
        
        // ✅ NYTT: Ger endags-ärenden (utan slutdatum) en standardlängd så de syns tydligt
        defaultTimedEventDuration="02:00" // 2 timmar

        views={{
            resourceTimelineWeek: {
                slotLabelFormat: { weekday: 'short', day: 'numeric', month: 'numeric' }
            },
            resourceTimelineDay: {
                slotLabelFormat: { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
            }
        }}
        scrollTime={'08:00:00'}
      />
    </div>
  );
}
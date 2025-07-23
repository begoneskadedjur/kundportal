// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.3 - KORRIGERADE TYP-IMPORTER FÖR ATT LÖSA BUILD-FEL ⭐

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import svLocale from '@fullcalendar/core/locales/sv';
import { BeGoneCaseRow, Technician } from '../../../types/database';

// ✅ FIX: Importerar typer från rätt paket för att lösa build-fel.
import type { EventContentArg } from '@fullcalendar/core';
import type { EventClickArg } from '@fullcalendar/interaction';

import '../../../styles/FullCalendar.css'; // Säkerställ att denna fil finns och är korrekt

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

    return (
        <div className={`w-full h-full p-2 flex flex-col justify-center overflow-hidden ${colors.bg} border-l-4 ${colors.border} rounded-sm cursor-pointer hover:brightness-125 transition-all`}>
            <p className={`font-bold text-sm leading-tight truncate ${colors.text}`}>{eventInfo.event.title}</p>
            {caseData.kontaktperson && <p className="text-xs text-slate-400 truncate">{caseData.kontaktperson}</p>}
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
    return cases.map(c => ({
      id: c.id,
      resourceId: c.primary_assignee_id,
      title: c.title,
      start: c.start_date!,
      end: c.due_date,
      extendedProps: c,
    }));
  }, [cases]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
  };

  return (
    <div className="p-4 h-full w-full bg-slate-900">
      <FullCalendar
        // Licensnyckel för utvecklingsmiljö
        schedulerLicenseKey="GPL-TO-REMOVE-THE-WARNING"
        
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
        slotMinWidth={100}
        eventContent={renderEventContent}
        
        noEventsContent="Inga bokade ärenden att visa"
        defaultTimedEventDuration="02:00"

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
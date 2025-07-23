// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.4 - DEFINITIV LÖSNING & UI-FÖRBÄTTRINGAR ⭐

import React, { useMemo } from 'react';
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

  return (
    <div className="p-4 h-full w-full bg-slate-900">
      <FullCalendar
        schedulerLicenseKey="GPL-TO-REMOVE-THE-WARNING"
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        locale={svLocale}

        // ✅ KORREKT HEADER MED ALLA KNAPPAR OCH VY-VÄLJARE
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth',
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
            slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false }
          },
          resourceTimelineWeek: {
            slotDuration: { days: 1 },
            slotLabelFormat: { weekday: 'short', day: 'numeric', month: 'numeric' }
          },
        }}
        
        eventContent={renderEventContent}
        
        // ✅ VISA ARBETSTIDER
        slotMinTime="06:00:00"
        slotMaxTime="19:00:00"
        scrollTime="07:00:00" // Scrolla till arbetsdagens början
        
        noEventsContent="Inga bokade ärenden att visa"
      />
    </div>
  );
}
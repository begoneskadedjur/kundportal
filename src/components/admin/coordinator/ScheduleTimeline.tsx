// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.6 - FIXADE HEADERS FÖR ALLA DAGAR ⭐

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import svLocale from '@fullcalendar/core/locales/sv';
import { BeGoneCaseRow, Technician, toFullCalendarDate } from '../../../types/database';

import type { EventContentArg, EventClickArg } from '@fullcalendar/core';
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
      .filter(c => c.primary_assignee_id && (c.start_date || c.due_date))
      .map(c => {
        const startDate = toFullCalendarDate(c.start_date);
        const endDate = toFullCalendarDate(c.due_date);
        
        const eventStart = startDate || endDate;
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
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit'
        };
      })
      .filter(event => event.start);
  }, [cases]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    onCaseClick(clickInfo.event.extendedProps as BeGoneCaseRow);
  };

  return (
    <div className="p-4 h-full w-full bg-slate-900">
      <FullCalendar
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        locale={svLocale}

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
        
        // ✅ KRITISKA INSTÄLLNINGAR FÖR ATT VISA ALLA DAGAR
        slotMinWidth={100}           // Bredare slots
        slotDuration="1:00:00"       // 1-timmes intervall
        slotLabelInterval="1:00:00"  // Visa varje timme
        
        // ✅ TVINGA VISA ALLA DAGAR I VECKAN
        dayMinWidth={80}             // Minsta bredd per dag
        expandRows={true}            // Expandera rader
        nowIndicator={true}          // Visa nuvarande tid
        
        // ✅ BÄTTRE TIDSFORMAT OCH INTERVALL
        views={{
          resourceTimelineWeek: {
            type: 'resourceTimelineWeek',
            slotDuration: '01:00:00',        // 1 timme per slot
            slotLabelFormat: {               // Format för tid-labels
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            },
            slotLabelInterval: '02:00:00',   // Visa label varannan timme
            dayHeaderFormat: {               // Format för dag-headers
              weekday: 'short',
              day: 'numeric',
              month: 'numeric'
            }
          },
          resourceTimelineDay: {
            type: 'resourceTimelineDay',
            slotDuration: '00:30:00',        // 30 min per slot
            slotLabelFormat: {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            },
            slotLabelInterval: '01:00:00'    // Visa label varje timme
          },
          resourceTimelineMonth: {
            type: 'resourceTimelineMonth',
            slotDuration: '1.00:00:00',      // 1 dag per slot
            slotLabelFormat: {
              day: 'numeric'
            }
          }
        }}
        
        eventContent={renderEventContent}
        
        // ✅ ARBETSTIDER - VISA HELA ARBETSDAGEN
        slotMinTime="07:00:00"       // Börja 07:00
        slotMaxTime="19:00:00"       // Sluta 19:00
        scrollTime="08:00:00"        // Scrolla till 08:00
        
        // ✅ VISA HELGER OCH ALLA DAGAR
        weekends={true}              // Visa helger
        hiddenDays={[]}              // Dölj inga dagar
        
        // ✅ GRUNDLÄGGANDE INSTÄLLNINGAR
        noEventsContent="Inga bokade ärenden att visa"
        defaultTimedEventDuration="02:00"
        editable={false}
        selectable={true}            // Tillåt markering av tidsslots
        selectMirror={true}          // Visa selection feedback
        
        // ✅ EVENT-INSTÄLLNINGAR
        eventInteractionEnabled={true}
        displayEventTime={true}
        displayEventEnd={false}
        eventMinHeight={40}          // Minsta höjd för events
        
        // ✅ TVINGA KOMPAKT LAYOUT
        resourceOrder="title"        // Sortera tekniker alfabetiskt
        resourceAreaColumns={[       // Endast namn-kolumn
          {
            headerContent: 'Tekniker',
            field: 'title',
            width: '100%'
          }
        ]}
      />
    </div>
  );
}
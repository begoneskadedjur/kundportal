// 📁 src/components/admin/coordinator/ScheduleTimeline.tsx
// ⭐ VERSION 2.9 - FIXAR UI-BUGG FÖR VY-VÄXLARE ⭐

import React, { useMemo, useRef } from 'react';
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

export default function ScheduleTimeline({ technicians, cases, absences, onCaseClick }: ScheduleTimelineProps) {
  
  const calendarRef = useRef<FullCalendar>(null);
  
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

  const changeView = (viewName: string) => {
    calendarRef.current?.getApi().changeView(viewName);
  };
  const navigateCalendar = (direction: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if(api) { direction === 'today' ? api.today() : api[direction](); }
  };

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-white">Schema Timeline</h2>
                  <div className="hidden xl:flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-500 rounded"></div><span className="text-slate-300">Öppen</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded"></div><span className="text-slate-300">Bokat</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500 rounded"></div><span className="text-slate-300">Offert</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div><span className="text-slate-300">Signerad</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded"></div><span className="text-slate-300">Återbesök</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-600 rounded"></div><span className="text-slate-300">Avslutat</span></div>
                  </div>
              </div>
              <div className="flex items-center gap-4">
                  {/* ✅ FÖRBÄTTRING: "flex-shrink-0" förhindrar att knapparna trycks ihop på mindre skärmar. */}
                  <div className="flex bg-slate-700 rounded-lg p-1 flex-shrink-0">
                      <button onClick={() => changeView('resourceTimelineDay')} className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-600 rounded-md transition-colors">Dag</button>
                      <button onClick={() => changeView('resourceTimelineWeek')} className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-600 rounded-md transition-colors">Vecka</button>
                      <button onClick={() => changeView('resourceTimelineMonth')} className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-600 rounded-md transition-colors">Månad</button>
                  </div>
                  <div className="flex items-center gap-1">
                      <button onClick={() => navigateCalendar('prev')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors" title="Föregående">←</button>
                      <button onClick={() => navigateCalendar('today')} className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">Idag</button>
                      <button onClick={() => navigateCalendar('next')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors" title="Nästa">→</button>
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
          headerToolbar={{left: '', center: 'title', right: ''}}
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
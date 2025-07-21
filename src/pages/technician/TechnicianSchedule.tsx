// 📁 src/pages/technician/TechnicianSchedule.tsx

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import svLocale from '@fullcalendar/core/locales/sv'; // Importera svenska språket

import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { ArrowLeft, User, Building2, Calendar } from 'lucide-react'
import Button from '../../components/ui/Button'

// Samma interface som tidigare men med start_date som potentiell timestamp
interface ScheduledCase {
  id: string;
  title: string;
  case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string;
  start_date: string; // Detta kommer nu vara en fullständig timestamp-sträng
}

export default function TechnicianSchedule() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<ScheduledCase[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchScheduledCases(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  const fetchScheduledCases = async (technicianId: string) => {
    setLoading(true)
    setError(null)
    try {
      const selectQuery = 'id, title, case_type, kontaktperson, start_date'
      
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select(selectQuery).eq('primary_assignee_id', technicianId).not('start_date', 'is', null),
        supabase.from('business_cases').select(selectQuery).eq('primary_assignee_id', technicianId).not('start_date', 'is', null),
        supabase.from('cases').select('id, title, case_type, kontaktperson, created_date as start_date').eq('assigned_technician_id', technicianId).not('created_date', 'is', null) // Antagande för avtalskunder
      ]);

      const allCases = [
        ...(privateResult.status === 'fulfilled' ? privateResult.value.data || [] : []),
        ...(businessResult.status === 'fulfilled' ? businessResult.value.data || [] : []),
        ...(contractResult.status === 'fulfilled' ? contractResult.value.data || [] : [])
      ];
      
      setCases(allCases as ScheduledCase[])
    } catch (err: any) {
      setError(err.message || 'Kunde inte hämta schemalagda ärenden')
    } finally {
      setLoading(false)
    }
  }

  const calendarEvents = useMemo(() => {
    return cases.map(case_ => ({
      id: case_.id,
      title: case_.title,
      start: case_.start_date, // FullCalendar förstår "2024-12-04T09:00:00.000Z"
      extendedProps: {
        case_type: case_.case_type,
        kontaktperson: case_.kontaktperson,
      },
      backgroundColor: case_.case_type === 'private' ? '#3b82f6' : '#8b5cf6',
      borderColor: case_.case_type === 'private' ? '#3b82f6' : '#8b5cf6',
    }));
  }, [cases]);
  
  const renderEventContent = (eventInfo: any) => {
    const { case_type, kontaktperson } = eventInfo.event.extendedProps;
    return (
      <div className="p-1 text-xs overflow-hidden h-full">
        <b className="text-white">{eventInfo.timeText}</b>
        <p className="whitespace-nowrap overflow-hidden text-ellipsis text-white">{eventInfo.event.title}</p>
        <div className="flex items-center gap-1 mt-1 opacity-80 text-slate-200">
          {case_type === 'private' ? <User className="w-3 h-3"/> : <Building2 className="w-3 h-3"/>}
          <span>{kontaktperson || 'Okänd'}</span>
        </div>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-2 rounded-lg"><Calendar className="w-6 h-6 text-purple-500" /></div>
              <div><h1 className="text-2xl font-bold text-white">Mitt Schema</h1><p className="text-sm text-slate-400">Kalenderöversikt över bokade ärenden</p></div>
            </div>
            <Button variant="secondary" onClick={() => navigate('/technician/dashboard')}><ArrowLeft className="w-4 h-4 mr-2"/>Tillbaka</Button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-4">
        {error && <p className="text-red-400">{error}</p>}
        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            }}
            events={calendarEvents}
            eventContent={renderEventContent}
            locale={svLocale} // Använd svenska
            buttonText={{ today: 'idag', month: 'månad', week: 'vecka', day: 'dag', list: 'lista' }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="19:00:00"
            height="auto" // Låt kalendern anpassa sin höjd
          />
        </div>
      </main>
    </div>
  )
}
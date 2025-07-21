// 📁 src/pages/technician/TechnicianSchedule.tsx - UPPDATERAD MED STYLING OCH FUNKTIONALITET

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import svLocale from '@fullcalendar/core/locales/sv'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { ArrowLeft, User, Building2, Calendar } from 'lucide-react'
import Button from '../../components/ui/Button'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'

// ✅ Importera den nya CSS-filen för att styla kalendern
import '../../styles/FullCalendar.css'

interface ScheduledCase {
  id: string; title: string; case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string; start_date: string; description?: string; status: string;
  case_price?: number; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string;
}

export default function TechnicianSchedule() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<ScheduledCase[]>([])
  const [error, setError] = useState<string | null>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<ScheduledCase | null>(null)

  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchScheduledCases(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  const fetchScheduledCases = async (technicianId: string) => {
    setLoading(true)
    setError(null)
    try {
      const selectQuery = 'id, title, case_type, kontaktperson, start_date, description, status, pris, telefon_kontaktperson, e_post_kontaktperson, skadedjur, org_nr'
      
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select(selectQuery).eq('primary_assignee_id', technicianId).not('start_date', 'is', null),
        supabase.from('business_cases').select(selectQuery).eq('primary_assignee_id', technicianId).not('start_date', 'is', null),
        supabase.from('cases').select('id, title, case_type, kontaktperson, created_date as start_date, description, status').eq('assigned_technician_id', technicianId).not('created_date', 'is', null)
      ]);

      const allCases = [
        ...(privateResult.status === 'fulfilled' ? privateResult.value.data?.map(c => ({...c, case_price: (c as any).pris})) || [] : []),
        ...(businessResult.status === 'fulfilled' ? businessResult.value.data?.map(c => ({...c, case_price: (c as any).pris})) || [] : []),
        ...(contractResult.status === 'fulfilled' ? contractResult.value.data || [] : [])
      ];
      
      // ✅ FELSÖKNING: Logga datan som hämtats
      console.log('Hämtade ärenden för kalender:', allCases);
      
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
      start: case_.start_date,
      extendedProps: { ...case_ },
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

  const handleEventClick = (clickInfo: any) => {
    setSelectedCase(clickInfo.event.extendedProps as ScheduledCase);
    setIsEditModalOpen(true);
  }
  
  const handleUpdateSuccess = (updatedCase: Partial<ScheduledCase>) => {
    setCases(currentCases => currentCases.map(c => c.id === selectedCase?.id ? { ...c, ...updatedCase } : c));
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
        {error && <p className="text-red-400 p-4 bg-red-500/10 rounded-lg">{error}</p>}
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
            eventClick={handleEventClick} // ✅ Öppna modal vid klick
            locale={svLocale}
            buttonText={{ today: 'idag', month: 'månad', week: 'vecka', day: 'dag', list: 'lista' }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="19:00:00"
            height="auto"
          />
        </div>
      </main>

      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase as any} 
      />
    </div>
  )
}
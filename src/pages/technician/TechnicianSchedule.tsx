// 📁 src/pages/technician/TechnicianSchedule.tsx - SLUTGILTIG VERSION MED FALLBACK-DATUM

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
import { ArrowLeft, User, Building2, Calendar, FileText } from 'lucide-react'
import Button from '../../components/ui/Button'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
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

  // ✅ UPPDATERAD FUNKTION MED FALLBACK-LOGIK
  const fetchScheduledCases = async (technicianId: string) => {
    setLoading(true)
    setError(null)
    try {
      // Hämta created_at för att använda som fallback
      const commonFields = 'id, title, kontaktperson, start_date, created_at, description, status, telefon_kontaktperson, e_post_kontaktperson, skadedjur'
      
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select(`${commonFields}, pris`).eq('primary_assignee_id', technicianId),
        supabase.from('business_cases').select(`${commonFields}, pris, org_nr`).eq('primary_assignee_id', technicianId),
        supabase.from('cases').select('id, title, kontaktperson, created_date, description, status, case_type').eq('assigned_technician_id', technicianId)
      ]);
      
      const allCases: Partial<ScheduledCase>[] = [];

      if (privateResult.status === 'fulfilled' && privateResult.value.data) {
        allCases.push(...privateResult.value.data.map((c: any) => ({ 
          ...c, 
          start_date: c.start_date || c.created_at, // Använd created_at om start_date är null
          case_price: c.pris, 
          case_type: 'private' 
        })));
      }
      if (businessResult.status === 'fulfilled' && businessResult.value.data) {
        allCases.push(...businessResult.value.data.map((c: any) => ({ 
          ...c, 
          start_date: c.start_date || c.created_at, // Använd created_at om start_date är null
          case_price: c.pris, 
          case_type: 'business' 
        })));
      }
      if (contractResult.status === 'fulfilled' && contractResult.value.data) {
        allCases.push(...contractResult.value.data.map((c: any) => ({ 
          ...c, 
          start_date: c.created_date, // Denna tabell använder created_date som start
          case_type: c.case_type || 'contract' 
        })));
      }
      
      // Säkerställ att vi bara försöker rendera ärenden som faktiskt har ett datum
      const casesWithDates = allCases.filter(c => c.start_date);
      
      console.log(`Hämtade ${allCases.length} ärenden, ${casesWithDates.length} har ett datum och kommer visas.`, casesWithDates);
      setCases(casesWithDates as ScheduledCase[])

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
      backgroundColor: case_.case_type === 'private' ? '#3b82f6' : case_.case_type === 'business' ? '#8b5cf6' : '#10b981',
      borderColor: case_.case_type === 'private' ? '#3b82f6' : case_.case_type === 'business' ? '#8b5cf6' : '#10b981',
    }));
  }, [cases]);
  
  const renderEventContent = (eventInfo: any) => {
    const { case_type, kontaktperson } = eventInfo.event.extendedProps;
    return (
      <div className="p-1 text-xs overflow-hidden h-full">
        <b className="text-white">{eventInfo.timeText}</b>
        <p className="whitespace-nowrap overflow-hidden text-ellipsis text-white">{eventInfo.event.title}</p>
        <div className="flex items-center gap-1 mt-1 opacity-80 text-slate-200">
          {case_type === 'private' ? <User className="w-3 h-3"/> : case_type === 'business' ? <Building2 className="w-3 h-3"/> : <FileText className="w-3 h-3"/>}
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
            eventClick={handleEventClick}
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
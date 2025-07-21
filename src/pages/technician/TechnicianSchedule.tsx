// 📁 src/pages/technician/TechnicianSchedule.tsx - SLUTGILTIG VERSION MED NY DESIGN & BUGFIX

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
import { ArrowLeft, User, Building2, Calendar, FileText, Phone, MapPin } from 'lucide-react'
import Button from '../../components/ui/Button'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import '../../styles/FullCalendar.css'

interface ScheduledCase {
  id: string; title: string; case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string; start_date: string; description?: string; status: string;
  case_price?: number; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; adress?: any;
}

const getStatusColorClasses = (status: string) => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('avslutat')) return 'bg-green-500/10 text-green-400 border-green-500/50';
  if (lowerStatus.startsWith('återbesök')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50';
  if (lowerStatus.includes('bokad')) return 'bg-blue-500/10 text-blue-400 border-blue-500/50';
  if (lowerStatus.includes('öppen')) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50';
  return 'bg-slate-700/20 text-slate-400 border-slate-600/50';
};

const formatAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') { try { const p = JSON.parse(address); return p.formatted_address || address; } catch (e) { return address; } }
  return '';
};

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
    setLoading(true);
    setError(null);
    try {
      const commonFields = 'id, title, kontaktperson, start_date, created_at, description, status, telefon_kontaktperson, e_post_kontaktperson, skadedjur, adress'
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select(`${commonFields}, pris`).eq('primary_assignee_id', technicianId),
        supabase.from('business_cases').select(`${commonFields}, pris, org_nr`).eq('primary_assignee_id', technicianId),
        // ✅ KORRIGERAD: 'adress' heter 'address_formatted' i databasen. Vi ger den ett alias 'adress' för konsekvens.
        supabase.from('cases').select('id, title, created_date, description, status, case_type, address_formatted as adress').eq('assigned_technician_id', technicianId)
      ]);
      
      const allCases: Partial<ScheduledCase>[] = [];
      if (privateResult.status === 'fulfilled' && privateResult.value.data) { allCases.push(...privateResult.value.data.map((c: any) => ({ ...c, start_date: c.start_date || c.created_at, case_price: c.pris, case_type: 'private' }))); }
      if (businessResult.status === 'fulfilled' && businessResult.value.data) { allCases.push(...businessResult.value.data.map((c: any) => ({ ...c, start_date: c.start_date || c.created_at, case_price: c.pris, case_type: 'business' }))); }
      if (contractResult.status === 'fulfilled' && contractResult.value.data) { allCases.push(...contractResult.value.data.map((c: any) => ({ ...c, start_date: c.created_date, case_type: c.case_type || 'contract' }))); }
      
      const casesWithDates = allCases.filter(c => c.start_date);
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
      className: getStatusColorClasses(case_.status).split(' ')[2] // Använd border-färg för status
    }));
  }, [cases]);
  
  const renderEventContent = (eventInfo: any) => {
    const { case_type, kontaktperson, status, adress, telefon_kontaktperson } = eventInfo.event.extendedProps;
    const isMonthView = eventInfo.view.type === 'dayGridMonth';

    if (isMonthView) {
      return (
        <div className="p-1 text-xs overflow-hidden h-full fc-event-main-monthly">
          <b className="fc-event-time">{eventInfo.timeText}</b>
          <span className="fc-event-title">{eventInfo.event.title}</span>
        </div>
      )
    }

    return (
      <div className="p-2 text-xs overflow-hidden h-full flex flex-col justify-between fc-event-main-detailed">
        <div>
          <div className="flex justify-between items-center">
            <b className="text-white text-sm">{eventInfo.timeText}</b>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColorClasses(status)}`}>{status}</span>
          </div>
          <p className="font-semibold text-md text-white my-1">{eventInfo.event.title}</p>
          <p className="flex items-center gap-1.5 mt-2 text-slate-300">
            {case_type === 'private' ? <User className="w-4 h-4"/> : <Building2 className="w-4 h-4"/>}
            <span>{kontaktperson || 'Okänd'}</span>
          </p>
          <p className="flex items-center gap-1.5 mt-1 text-slate-300">
            <MapPin className="w-4 h-4"/>
            <span>{formatAddress(adress) || 'Adress saknas'}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 mt-3">
            {telefon_kontaktperson && (
                <a href={`tel:${telefon_kontaktperson}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors" title="Ring kund">
                    <Phone className="w-4 h-4" /> Ring
                </a>
            )}
            {adress && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(adress))}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors" title="Navigera till adress">
                    <MapPin className="w-4 h-4" /> Navigera
                </a>
            )}
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
            eventMinHeight={75} 
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
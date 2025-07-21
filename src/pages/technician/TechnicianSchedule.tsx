// 📁 src/pages/technician/TechnicianSchedule.tsx - KOMPLETT OCH KORREKT VERSION

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
import { ArrowLeft, User, Building2, Calendar, FileText, Phone, MapPin, Clock } from 'lucide-react'
import Button from '../../components/ui/Button'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import '../../styles/FullCalendar.css'

interface ScheduledCase {
  id: string; title: string; case_type: 'private' | 'business' | 'contract';
  kontaktperson?: string; start_date: string; end_date?: string; description?: string; status: string;
  case_price?: number; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; adress?: any;
}

const getStatusColorClasses = (status: string) => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('avslutat')) return 'bg-green-900/50 text-green-300 border-green-700';
  if (lowerStatus.startsWith('återbesök')) return 'bg-cyan-900/50 text-cyan-300 border-cyan-700';
  if (lowerStatus.includes('bokad')) return 'bg-blue-900/50 text-blue-300 border-blue-700';
  if (lowerStatus.includes('öppen')) return 'bg-yellow-900/50 text-yellow-300 border-yellow-700';
  return 'bg-slate-800/50 text-slate-400 border-slate-700';
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
        supabase.from('cases').select('id, title, created_date, description, status, case_type, adress:address_formatted').eq('assigned_technician_id', technicianId)
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
    return cases.map(case_ => {
      const startDate = new Date(case_.start_date);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      return {
        id: case_.id,
        title: case_.title,
        start: startDate,
        end: endDate,
        extendedProps: { ...case_ },
        className: `!border ${getStatusColorClasses(case_.status)}`
      }
    });
  }, [cases]);
  
  const renderEventContent = (eventInfo: any) => {
    const { case_type, kontaktperson, adress, telefon_kontaktperson, skadedjur } = eventInfo.event.extendedProps;
    
    // Samma detaljerade vy används nu i alla lägen (månad, vecka, dag)
    return (
      <div className={`p-2 text-sm overflow-hidden h-full flex flex-col justify-between ${getStatusColorClasses(eventInfo.event.extendedProps.status).split(' ')[0]}`}>
        <div className="flex-grow">
          <p className="text-xs opacity-80">{case_type === 'private' ? 'Privatperson' : 'Företag'}</p>
          <p className="font-bold text-md text-white -mt-1">{eventInfo.event.title}</p>
          
          <p className="flex items-center gap-1.5 text-xs mt-2 opacity-90">
            <Clock className="w-3 h-3"/>
            <span>{eventInfo.timeText}</span>
          </p>
          <p className="text-xs mt-1 opacity-90">
            <span className="font-semibold">Adress:</span> {formatAddress(adress) || 'Saknas'}
          </p>
          <p className="flex items-center gap-1.5 text-xs mt-1 opacity-90">
            <span className="font-semibold">Skadedjur:</span>
            <span className="bg-slate-700/50 px-1.5 py-0.5 rounded">{skadedjur || 'Okänt'}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 mt-2 self-end">
            {telefon_kontaktperson && (
                <a href={`tel:${telefon_kontaktperson}`} onClick={(e) => e.stopPropagation()} className="hover:text-white transition-colors" title={`Ring ${kontaktperson}`}>
                    <Phone className="w-5 h-5" />
                </a>
            )}
            {adress && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(adress))}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-white transition-colors" title="Navigera till adress">
                    <MapPin className="w-5 h-5" />
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
              <div>
                <h1 className="text-2xl font-bold text-white">Mitt Schema</h1>
                <p className="text-sm text-slate-400">Kalenderöversikt över bokade ärenden</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => navigate('/technician/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2"/>Tillbaka
            </Button>
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
            eventMinHeight={120} // Ökat för att rymma mer information
            dayMaxEvents={true} // Förhindrar att månadsvyn blir för hög
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
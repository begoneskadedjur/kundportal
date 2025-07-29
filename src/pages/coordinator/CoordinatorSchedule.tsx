// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 2.7 - IMPLEMENTERAR KORREKT ARBETSFLÖDE FÖR "ÄRENDEN ATT BOKA IN" ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician, isScheduledCase } from '../../types/database';

import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import CreateCaseModal from '../../components/admin/coordinator/CreateCaseModal';
import CreateAbsenceModal from '../../components/admin/coordinator/CreateAbsenceModal';
import Button from '../../components/ui/Button';

import { LayoutGrid, Plus, CalendarOff, ArrowLeft, LogOut } from 'lucide-react';
import { PageHeader } from '../../components/shared';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export interface Absence {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

const ALL_STATUSES = ['Öppen', 'Bokad', 'Bokat', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];
const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));

export default function CoordinatorSchedule() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); // Sätt loading här för att täcka hela hämtningen
      const [techniciansResult, privateCasesResult, businessCasesResult, absencesResult] = await Promise.all([
        supabase.from('technicians').select('*').eq('is_active', true).order('name'),
        supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('business_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('technician_absences').select('*')
      ]);

      if (techniciansResult.error) throw techniciansResult.error;
      if (privateCasesResult.error) throw privateCasesResult.error;
      if (businessCasesResult.error) throw businessCasesResult.error;
      if (absencesResult.error) throw absencesResult.error;

      const fetchedTechnicians = techniciansResult.data || [];
      setTechnicians(fetchedTechnicians);
      setAbsences(absencesResult.data || []);

      const combinedCases = [
        ...(privateCasesResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ];
      
      setAllCases(combinedCases as BeGoneCaseRow[]);

      if (selectedTechnicianIds.size === 0 && fetchedTechnicians.length > 0) {
        const defaultSelected = fetchedTechnicians.filter(t => t.role === 'Skadedjurstekniker').map(t => t.id);
        setSelectedTechnicianIds(new Set(defaultSelected));
      }

    } catch (err) {
      console.error("Fel vid datahämtning för koordinatorvyn:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTechnicianIds.size]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const scheduledCases = useMemo(() => allCases.filter(isScheduledCase), [allCases]);

  const actionableCases = useMemo(() => {
    return allCases.filter(c => c.status === 'Offert signerad - boka in');
  }, [allCases]);

  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      if (!activeStatuses.has(c.status)) return false;
      if (selectedTechnicianIds.size > 0) {
        const caseTechnicians = [c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id].filter(Boolean);
        if (caseTechnicians.length > 0 && !caseTechnicians.some(id => selectedTechnicianIds.has(id!))) {
          return false;
        }
      }
      const query = searchQuery.toLowerCase();
      if (query) {
        return (c.title?.toLowerCase() || '').includes(query) || (c.kontaktperson?.toLowerCase() || '').includes(query) || (c.adress?.toString().toLowerCase() || '').includes(query);
      }
      return true;
    });
  }, [scheduledCases, activeStatuses, selectedTechnicianIds, searchQuery]);
  
  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };
  
  // ✅ NY HANDLER: Öppnar SKAPA-modalen med förifylld data för att BOKA IN ett ärende.
  const handleScheduleActionableCase = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsCreateModalOpen(true);
  };

  const handleUpdateSuccess = () => { setIsEditModalOpen(false); fetchData(); };
  const handleCreateSuccess = () => { setIsCreateModalOpen(false); setSelectedCase(null); fetchData(); }; // Nollställ selectedCase
  const handleAbsenceCreateSuccess = () => { setIsAbsenceModalOpen(false); fetchData(); };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner text="Laddar schema..." /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-screen-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/koordinator/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Tillbaka
              </Button>
              <LayoutGrid className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-white">Koordinator - Schemaöversikt</h1>
                <p className="text-sm text-slate-400">{filteredScheduledCases.length} schemalagda • {actionableCases.length} att boka in • {technicians.length} tekniker</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={() => { setSelectedCase(null); setIsCreateModalOpen(true); }} variant="primary"><Plus className="w-4 h-4 mr-2" />Skapa Nytt Ärende</Button>
                <Button onClick={() => setIsAbsenceModalOpen(true)} variant="secondary" title="Registrera frånvaro"><CalendarOff className="w-4 h-4" /></Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate('/login');
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logga ut
                </Button>
            </div>
          </div>
        </header>

        <div className="flex-grow max-w-screen-3xl mx-auto w-full flex flex-row h-[calc(100vh-65px)]">
          <aside className="w-1/4 xl:w-1/5 min-w-[320px] flex flex-col h-full">
            <ScheduleControlPanel
              technicians={technicians}
              actionableCases={actionableCases}
              activeStatuses={activeStatuses}
              setActiveStatuses={setActiveStatuses}
              selectedTechnicianIds={selectedTechnicianIds}
              setSelectedTechnicianIds={setSelectedTechnicianIds}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onCaseClick={handleScheduleActionableCase} // ✅ Använder den nya, korrekta handlern.
            />
          </aside>
          
          <main className="w-3/4 xl:w-4/5 flex-grow h-full">
            <ScheduleTimeline
              technicians={technicians.filter(t => selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id))}
              cases={filteredScheduledCases}
              absences={absences}
              onCaseClick={handleOpenCaseModal}
              onUpdate={fetchData}
            />
          </main>
        </div>
      </div>
      
      <EditCaseModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleUpdateSuccess} caseData={selectedCase as any} technicians={technicians} />
      {/* ✅ Skickar nu med "initialCaseData" till CreateCaseModal */}
      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setSelectedCase(null); }} onSuccess={handleCreateSuccess} technicians={technicians} initialCaseData={selectedCase} />
      <CreateAbsenceModal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} onSuccess={handleAbsenceCreateSuccess} technicians={technicians} />
    </>
  );
}
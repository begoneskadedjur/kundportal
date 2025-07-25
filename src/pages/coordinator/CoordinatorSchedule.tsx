// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 2.5 - FÖRVALJER TEKNIKER BASERAT PÅ ROLL ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician, isUnplannedCase, isScheduledCase } from '../../types/database';

import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import CreateCaseModal from '../../components/admin/coordinator/CreateCaseModal';
import CreateAbsenceModal from '../../components/admin/coordinator/CreateAbsenceModal';
import Button from '../../components/ui/Button';

import { LayoutGrid, Plus, CalendarOff } from 'lucide-react';

export interface Absence {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

const ALL_STATUSES = ['Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];
const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));

export default function CoordinatorSchedule() {
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

      // ✅ SÄTT KORREKTA TEKNIKER SOM VALDA SOM STANDARD (BARA VID FÖRSTA LADDNINGEN)
      if (selectedTechnicianIds.size === 0 && fetchedTechnicians.length > 0) {
        const defaultSelected = fetchedTechnicians
          .filter(t => t.role === 'Skadedjurstekniker')
          .map(t => t.id);
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
  const unplannedCases = useMemo(() => {
    return allCases.filter(c => isUnplannedCase(c) && !c.status.includes('Avslutat') && !c.status.includes('Stängt'));
  }, [allCases]);

  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      if (!activeStatuses.has(c.status)) return false;
      if (selectedTechnicianIds.size > 0 && c.primary_assignee_id && !selectedTechnicianIds.has(c.primary_assignee_id)) return false;
      const query = searchQuery.toLowerCase();
      if (query) {
        return (c.title?.toLowerCase() || '').includes(query) ||
               (c.kontaktperson?.toLowerCase() || '').includes(query) ||
               (c.adress?.toString().toLowerCase() || '').includes(query);
      }
      return true;
    });
  }, [scheduledCases, activeStatuses, selectedTechnicianIds, searchQuery]);
  
  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => { setIsEditModalOpen(false); fetchData(); };
  const handleCreateSuccess = () => { setIsCreateModalOpen(false); fetchData(); };
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
                <LayoutGrid className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-white">Koordinator - Schemaöversikt</h1>
                <p className="text-sm text-slate-400">{filteredScheduledCases.length} schemalagda • {unplannedCases.length} oplanerade • {technicians.length} tekniker</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={() => setIsCreateModalOpen(true)} variant="primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Skapa Nytt Ärende
                </Button>
                <Button onClick={() => setIsAbsenceModalOpen(true)} variant="secondary" title="Registrera frånvaro för en tekniker">
                    <CalendarOff className="w-4 h-4" />
                </Button>
            </div>
          </div>
        </header>

        <div className="flex-grow max-w-screen-3xl mx-auto w-full flex flex-row h-[calc(100vh-65px)]">
          <aside className="w-1/4 xl:w-1/5 min-w-[320px] flex flex-col h-full">
            <ScheduleControlPanel
              technicians={technicians}
              unplannedCases={unplannedCases}
              activeStatuses={activeStatuses}
              setActiveStatuses={setActiveStatuses}
              selectedTechnicianIds={selectedTechnicianIds}
              setSelectedTechnicianIds={setSelectedTechnicianIds}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onCaseClick={handleOpenCaseModal}
            />
          </aside>
          
          <main className="w-3/4 xl:w-4/5 flex-grow h-full">
            <ScheduleTimeline
              technicians={technicians.filter(t => selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id))}
              cases={filteredScheduledCases}
              absences={absences}
              onCaseClick={handleOpenCaseModal}
            />
          </main>
        </div>
      </div>
      
      <EditCaseModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleUpdateSuccess} caseData={selectedCase as any} />
      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} technicians={technicians} />
      <CreateAbsenceModal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} onSuccess={handleAbsenceCreateSuccess} technicians={technicians} />
    </>
  );
}
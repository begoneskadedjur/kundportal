// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 2.3 - INTEGRERAD MED "SKAPA FRÅNVARO"-MODAL ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician, isUnplannedCase, isScheduledCase } from '../../types/database';

// ✅ IMPORTERAR ALLA RIKTIGA KOMPONENTER
import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import CreateCaseModal from '../../components/admin/coordinator/CreateCaseModal';
import CreateAbsenceModal from '../../components/admin/coordinator/CreateAbsenceModal'; // ✅ NYTT: Importera frånvaro-modalen
import Button from '../../components/ui/Button';

import { LayoutGrid, Plus, CalendarOff } from 'lucide-react'; // ✅ NYTT: Importera CalendarOff-ikonen

const ALL_STATUSES = ['Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];
const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));

export default function CoordinatorSchedule() {
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // States för modaler
  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false); // ✅ NYTT: State för frånvaro-modalen

  const fetchData = useCallback(async () => {
    try {
      // Hämta tekniker
      const techniciansResult = await supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // Hämta privatärenden
      const privateCasesResult = await supabase
        .from('private_cases')
        .select('*')
        .order('created_at', { ascending: false });

      // Hämta företagsärenden
      const businessCasesResult = await supabase
        .from('business_cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (techniciansResult.error) throw techniciansResult.error;
      if (privateCasesResult.error) throw privateCasesResult.error;
      if (businessCasesResult.error) throw businessCasesResult.error;

      setTechnicians(techniciansResult.data || []);
      
      const combinedCases = [
        ...(privateCasesResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ];
      
      setAllCases(combinedCases as BeGoneCaseRow[]);

      if (selectedTechnicianIds.size === 0) {
        setSelectedTechnicianIds(new Set(techniciansResult.data?.map(t => t.id) || []));
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

  // --- Befintlig logik för filtrering (oförändrad) ---
  const scheduledCases = useMemo(() => allCases.filter(isScheduledCase), [allCases]);
  const unplannedCases = useMemo(() => {
    return allCases.filter(c => isUnplannedCase(c) && !c.status.includes('Avslutat') && !c.status.includes('Stängt'));
  }, [allCases]);

  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      const matchesStatus = activeStatuses.has(c.status);
      if (!matchesStatus) return false;
      if (selectedTechnicianIds.size > 0 && c.primary_assignee_id && !selectedTechnicianIds.has(c.primary_assignee_id)) return false;
      const query = searchQuery.toLowerCase();
      if (query) {
        let fullAddress = '';
        if (typeof c.adress === 'object' && c.adress?.formatted_address) fullAddress = c.adress.formatted_address.toLowerCase();
        else if (typeof c.adress === 'string') fullAddress = c.adress.toLowerCase();
        const contactPerson = c.kontaktperson?.toLowerCase() || '';
        const title = c.title.toLowerCase();
        const assigneeName = c.primary_assignee_name?.toLowerCase() || '';
        const pestType = c.skadedjur?.toLowerCase() || '';
        return title.includes(query) || contactPerson.includes(query) || fullAddress.includes(query) || assigneeName.includes(query) || pestType.includes(query);
      }
      return true;
    });
  }, [scheduledCases, activeStatuses, selectedTechnicianIds, searchQuery]);

  const filteredUnplannedCases = useMemo(() => {
    return unplannedCases.filter(c => {
      const matchesStatus = activeStatuses.has(c.status);
      if (!matchesStatus) return false;
      const query = searchQuery.toLowerCase();
      if (query) {
        let fullAddress = '';
        if (typeof c.adress === 'object' && c.adress?.formatted_address) fullAddress = c.adress.formatted_address.toLowerCase();
        else if (typeof c.adress === 'string') fullAddress = c.adress.toLowerCase();
        const contactPerson = c.kontaktperson?.toLowerCase() || '';
        const title = c.title.toLowerCase();
        const pestType = c.skadedjur?.toLowerCase() || '';
        return title.includes(query) || contactPerson.includes(query) || fullAddress.includes(query) || pestType.includes(query);
      }
      return true;
    });
  }, [unplannedCases, activeStatuses, searchQuery]);
  // --- Slut på filtreringslogik ---

  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    fetchData();
  };
  
  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchData();
  };
  
  // ✅ NYTT: Hanterare för när en ny frånvaro har skapats
  const handleAbsenceCreateSuccess = () => {
    setIsAbsenceModalOpen(false); // Stäng modalen
    fetchData(); // Ladda om all data för att säkerställa att allt är up-to-date
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar schema..." />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        {/* Header med statistik och nya knappar */}
        <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-screen-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg">
                <LayoutGrid className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Koordinator - Schemaöversikt</h1>
                <p className="text-sm text-slate-400">
                  {filteredScheduledCases.length} schemalagda • {filteredUnplannedCases.length} oplanerade • {technicians.length} tekniker
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              {/* Snabb-statistik */}
              <div className="hidden lg:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">{filteredScheduledCases.length}</div>
                  <div className="text-slate-400">Schemalagda</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">{filteredUnplannedCases.length}</div>
                  <div className="text-slate-400">Oplanerade</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">{selectedTechnicianIds.size}</div>
                  <div className="text-slate-400">Tekniker</div>
                </div>
              </div>

              {/* ✅ UPPDATERAD KNAPP-GRUPP */}
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
          </div>
        </header>

        {/* Huvudlayout med sidopanel och schema (oförändrad) */}
        <div className="flex-grow max-w-screen-3xl mx-auto w-full flex flex-row h-[calc(100vh-65px)]">
          <aside className="w-1/4 xl:w-1/5 min-w-[320px] flex flex-col h-full">
            <ScheduleControlPanel
              technicians={technicians}
              unplannedCases={filteredUnplannedCases}
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
              technicians={technicians.filter(t => 
                selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id)
              )}
              cases={filteredScheduledCases}
              onCaseClick={handleOpenCaseModal}
            />
          </main>
        </div>
      </div>
      
      {/* Modal för att redigera befintliga ärenden */}
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase as any} 
      />

      {/* Modal för att skapa nya ärenden */}
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        technicians={technicians}
      />

      {/* ✅ NYTT: Modal för att registrera frånvaro */}
      <CreateAbsenceModal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        onSuccess={handleAbsenceCreateSuccess}
        technicians={technicians}
      />
    </>
  );
}
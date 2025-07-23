// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 2.0 - SLUTLIG VERSION MED AKTIV TIDSINJE ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician } from '../../types/database';

// ✅ NYTT: Importerar ALLA riktiga komponenter
import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';

import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import { LayoutGrid } from 'lucide-react';

// ❌ BORTTAGET: Alla platshållare är nu borttagna från denna fil.

const ALL_STATUSES = ['Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];
const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));


export default function CoordinatorSchedule() {
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [techniciansResult, privateCasesResult, businessCasesResult] = await Promise.all([
        supabase.from('technicians').select('*').eq('is_active', true),
        supabase.from('private_cases').select('*'), // Tar alla, filtrerar oplanerade i minnet
        supabase.from('business_cases').select('*')
      ]);

      if (techniciansResult.error) throw techniciansResult.error;
      if (privateCasesResult.error) throw privateCasesResult.error;
      if (businessCasesResult.error) throw businessCasesResult.error;

      setTechnicians(techniciansResult.data || []);
      
      const combinedCases = [
        ...(privateCasesResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ];
      
      setAllCases(combinedCases as BeGoneCaseRow[]);

    } catch (err) {
      console.error("Fel vid datahämtning för koordinatorvyn:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const scheduledCases = useMemo(() => {
    return allCases.filter(c => !!c.start_date);
  },[allCases]);

  const unplannedCases = useMemo(() => {
    // Filtrera bort ärenden med status som indikerar att de är stängda
    return allCases.filter(c => !c.start_date && !c.status.includes('Avslutat') && !c.status.includes('Stängt'));
  }, [allCases]);

  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      const matchesStatus = activeStatuses.has(c.status);
      if (!matchesStatus) return false;

      if (selectedTechnicianIds.size > 0 && !selectedTechnicianIds.has(c.primary_assignee_id!)) {
        return false;
      }
      
      const query = searchQuery.toLowerCase();
      if (query) {
        const fullAddress = typeof c.adress === 'object' && c.adress?.formatted_address ? c.adress.formatted_address.toLowerCase() : '';
        const contactPerson = c.kontaktperson?.toLowerCase() || '';
        const title = c.title.toLowerCase();
        
        return title.includes(query) || contactPerson.includes(query) || fullAddress.includes(query);
      }
      return true;
    });
  }, [scheduledCases, activeStatuses, selectedTechnicianIds, searchQuery]);

  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    fetchData();
  };
  
  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner text="Laddar schema..." /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-screen-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg"><LayoutGrid className="w-6 h-6 text-blue-400" /></div>
              <div>
                <h1 className="text-xl font-bold text-white">Koordinator - Schemaöversikt</h1>
                <p className="text-sm text-slate-400">Överblick över alla tekniker och ärenden</p>
              </div>
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
              onCaseClick={handleOpenCaseModal}
            />
          </main>
        </div>
      </div>
      
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase as any} 
      />
    </>
  );
}
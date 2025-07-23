// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 2.1 - UPPDATERAD FÖR NYA DATABASE TYPER OCH TIMESTAMPTZ ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician, isUnplannedCase, isScheduledCase } from '../../types/database';

// ✅ IMPORTERAR ALLA RIKTIGA KOMPONENTER
import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';

import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import { LayoutGrid } from 'lucide-react';

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
      // ✅ Hämta tekniker med alla kolumner inklusive abax_vehicle_id
      const techniciansResult = await supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // ✅ Hämta private_cases med alla kolumner inklusive commissionskolumner
      const privateCasesResult = await supabase
        .from('private_cases')
        .select('*')
        .order('created_at', { ascending: false });

      // ✅ Hämta business_cases med alla kolumner inklusive commissionskolumner  
      const businessCasesResult = await supabase
        .from('business_cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (techniciansResult.error) throw techniciansResult.error;
      if (privateCasesResult.error) throw privateCasesResult.error;
      if (businessCasesResult.error) throw businessCasesResult.error;

      setTechnicians(techniciansResult.data || []);
      
      // ✅ Kombinera ärenden med case_type markering
      const combinedCases = [
        ...(privateCasesResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ];
      
      setAllCases(combinedCases as BeGoneCaseRow[]);

      // ✅ Sätt alla tekniker som valda som standard
      setSelectedTechnicianIds(new Set(techniciansResult.data?.map(t => t.id) || []));

    } catch (err) {
      console.error("Fel vid datahämtning för koordinatorvyn:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ✅ Använd hjälpfunktionerna från database.ts för att separera ärenden
  const scheduledCases = useMemo(() => {
    return allCases.filter(isScheduledCase);
  }, [allCases]);

  const unplannedCases = useMemo(() => {
    // ✅ Filtrera oplanerade ärenden och exkludera stängda
    return allCases.filter(c => {
      const isUnplanned = isUnplannedCase(c);
      const isNotClosed = !c.status.includes('Avslutat') && !c.status.includes('Stängt');
      return isUnplanned && isNotClosed;
    });
  }, [allCases]);

  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      // Status-filter
      const matchesStatus = activeStatuses.has(c.status);
      if (!matchesStatus) return false;

      // Tekniker-filter
      if (selectedTechnicianIds.size > 0 && c.primary_assignee_id) {
        if (!selectedTechnicianIds.has(c.primary_assignee_id)) {
          return false;
        }
      }
      
      // Sök-filter
      const query = searchQuery.toLowerCase();
      if (query) {
        // ✅ Hantera adress som kan vara objekt eller string
        let fullAddress = '';
        if (typeof c.adress === 'object' && c.adress?.formatted_address) {
          fullAddress = c.adress.formatted_address.toLowerCase();
        } else if (typeof c.adress === 'string') {
          fullAddress = c.adress.toLowerCase();
        }
        
        const contactPerson = c.kontaktperson?.toLowerCase() || '';
        const title = c.title.toLowerCase();
        const assigneeName = c.primary_assignee_name?.toLowerCase() || '';
        const pestType = c.skadedjur?.toLowerCase() || '';
        
        return title.includes(query) || 
               contactPerson.includes(query) || 
               fullAddress.includes(query) ||
               assigneeName.includes(query) ||
               pestType.includes(query);
      }
      
      return true;
    });
  }, [scheduledCases, activeStatuses, selectedTechnicianIds, searchQuery]);

  const filteredUnplannedCases = useMemo(() => {
    return unplannedCases.filter(c => {
      // Status-filter för oplanerade
      const matchesStatus = activeStatuses.has(c.status);
      if (!matchesStatus) return false;
      
      // Sök-filter för oplanerade
      const query = searchQuery.toLowerCase();
      if (query) {
        let fullAddress = '';
        if (typeof c.adress === 'object' && c.adress?.formatted_address) {
          fullAddress = c.adress.formatted_address.toLowerCase();
        } else if (typeof c.adress === 'string') {
          fullAddress = c.adress.toLowerCase();
        }
        
        const contactPerson = c.kontaktperson?.toLowerCase() || '';
        const title = c.title.toLowerCase();
        const pestType = c.skadedjur?.toLowerCase() || '';
        
        return title.includes(query) || 
               contactPerson.includes(query) || 
               fullAddress.includes(query) ||
               pestType.includes(query);
      }
      
      return true;
    });
  }, [unplannedCases, activeStatuses, searchQuery]);

  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    fetchData(); // Ladda om data efter uppdatering
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
        {/* ✅ Header med statistik */}
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
            
            {/* ✅ Snabb-statistik */}
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
          </div>
        </header>

        {/* ✅ Huvudlayout med sidopanel och schema */}
        <div className="flex-grow max-w-screen-3xl mx-auto w-full flex flex-row h-[calc(100vh-65px)]">
          {/* Vänster sidopanel */}
          <aside className="w-1/4 xl:w-1/5 min-w-[320px] flex flex-col h-full">
            <ScheduleControlPanel
              technicians={technicians}
              unplannedCases={filteredUnplannedCases} // ✅ Använd filtrerade oplanerade
              activeStatuses={activeStatuses}
              setActiveStatuses={setActiveStatuses}
              selectedTechnicianIds={selectedTechnicianIds}
              setSelectedTechnicianIds={setSelectedTechnicianIds}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onCaseClick={handleOpenCaseModal}
            />
          </aside>
          
          {/* Höger huvudområde med tidslinjen */}
          <main className="w-3/4 xl:w-4/5 flex-grow h-full">
            <ScheduleTimeline
              technicians={technicians.filter(t => 
                selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id)
              )}
              cases={filteredScheduledCases} // ✅ Använd filtrerade schemalagda
              onCaseClick={handleOpenCaseModal}
            />
          </main>
        </div>
      </div>
      
      {/* ✅ Modal för ärendedetaljer */}
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase as any} 
      />
    </>
  );
}
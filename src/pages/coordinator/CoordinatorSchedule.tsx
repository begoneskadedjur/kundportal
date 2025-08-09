// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 3.1 - Hybrid system med ClickUp och avtalskundärenden ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician, isScheduledCase } from '../../types/database';
import { Case } from '../../types/cases';

// Komponenter för schemat
import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';
import PendingRequestsPanel from '../../components/coordinator/PendingRequestsPanel';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

// Modaler
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import CreateCaseModal from '../../components/admin/coordinator/CreateCaseModal';
import CreateAbsenceModal from '../../components/admin/coordinator/CreateAbsenceModal';
import AbsenceDetailsModal from '../../components/admin/coordinator/AbsenceDetailsModal';

import Button from '../../components/ui/Button';
import { usePendingCases } from '../../hooks/usePendingCases';

import { LayoutGrid, CalendarOff, ArrowLeft, LogOut, FileText, Menu, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GlobalCoordinatorChat from '../../components/coordinator/GlobalCoordinatorChat';

export interface Absence {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  notes?: string;
}

const ALL_STATUSES = ['Öppen', 'Bokad', 'Bokat', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];
const DEFAULT_ACTIVE_STATUSES = ALL_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));

export default function CoordinatorSchedule() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]); // Alla schemalagda ärenden
  const [contractCases, setContractCases] = useState<Case[]>([]); // Avtalskundärenden
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [isAbsenceDetailsModalOpen, setIsAbsenceDetailsModalOpen] = useState(false);
  
  // Use the pending cases hook för sidebar
  const { pendingCases, urgentCount, oldRequestsCount, totalCount, refresh: refreshPending } = usePendingCases();

  // Adapter för att konvertera Case till BeGoneCaseRow-liknande format
  const adaptCaseToBeGoneRow = (contractCase: Case): BeGoneCaseRow => {
    return {
      id: contractCase.id,
      case_id: contractCase.case_number,
      title: contractCase.title,
      status: contractCase.status === 'scheduled' ? 'Bokad' : 
              contractCase.status === 'in_progress' ? 'Pågående' : 
              contractCase.status === 'completed' ? 'Avslutat' : 'Öppen',
      priority: contractCase.priority,
      adress: contractCase.address,
      kontaktperson: contractCase.contact_person,
      telefon: contractCase.contact_phone,
      email: contractCase.contact_email,
      start_date: contractCase.scheduled_start,
      end_date: contractCase.scheduled_end,
      primary_assignee_id: contractCase.primary_technician_id,
      secondary_assignee_id: null,
      tertiary_assignee_id: null,
      case_type: 'contract' as const,
      description: contractCase.description,
      price: contractCase.price,
      created_at: contractCase.created_at,
      updated_at: contractCase.updated_at
    } as BeGoneCaseRow;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Hämta alla data parallellt
      const [techniciansResult, privateCasesResult, businessCasesResult, contractCasesResult, absencesResult] = await Promise.all([
        supabase.from('technicians').select('*').eq('is_active', true).order('name'),
        supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('business_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('cases').select('*').in('status', ['scheduled', 'in_progress', 'completed']).order('created_at', { ascending: false }),
        supabase.from('technician_absences').select('*')
      ]);

      if (techniciansResult.error) throw techniciansResult.error;
      if (privateCasesResult.error) throw privateCasesResult.error;
      if (businessCasesResult.error) throw businessCasesResult.error;
      if (contractCasesResult.error) throw contractCasesResult.error;
      if (absencesResult.error) throw absencesResult.error;

      const fetchedTechnicians = techniciansResult.data || [];
      setTechnicians(fetchedTechnicians);
      setAbsences(absencesResult.data || []);
      setContractCases(contractCasesResult.data || []);

      // Kombinera alla ärenden för schemat
      const combinedCases = [
        ...(privateCasesResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, case_type: 'business' as const })),
        ...(contractCasesResult.data || []).map(adaptCaseToBeGoneRow)
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

  // Filtrera schemalagda ärenden (från båda systemen)
  const scheduledCases = useMemo(() => allCases.filter(isScheduledCase), [allCases]);

  // Ärenden som behöver bokas in (från ClickUp)
  const actionableCases = useMemo(() => {
    return allCases.filter(c => c.status === 'Offert signerad - boka in');
  }, [allCases]);

  // Filtrera baserat på status, tekniker och sökning
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
        return (c.title?.toLowerCase() || '').includes(query) || 
               (c.kontaktperson?.toLowerCase() || '').includes(query) || 
               (c.adress?.toString().toLowerCase() || '').includes(query);
      }
      return true;
    });
  }, [scheduledCases, activeStatuses, selectedTechnicianIds, searchQuery]);
  
  // Hantera klick på ClickUp-ärende
  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };
  
  // Hantera schemaläggning av ClickUp-ärende som ska bokas in
  const handleScheduleActionableCase = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsCreateModalOpen(true);
  };

  // Hantera schemaläggning av avtalskundärende från sidebar
  const handleSchedulePendingCase = (caseData: Case) => {
    // Konvertera till BeGoneCaseRow-format för modal
    const adaptedCase = adaptCaseToBeGoneRow(caseData);
    setSelectedCase(adaptedCase);
    setIsCreateModalOpen(true);
  };

  const handleUpdateSuccess = () => { 
    setIsEditModalOpen(false); 
    fetchData(); 
  };
  
  const handleCreateSuccess = () => { 
    setIsCreateModalOpen(false); 
    setSelectedCase(null); 
    fetchData();
    refreshPending(); // Uppdatera sidebar
  };
  
  const handleAbsenceCreateSuccess = () => { 
    setIsAbsenceModalOpen(false); 
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                className="flex items-center gap-2 relative"
              >
                {showSidebar ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                {!showSidebar && totalCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {totalCount}
                  </span>
                )}
              </Button>
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
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span>{filteredScheduledCases.length} schemalagda</span>
                  {actionableCases.length > 0 && (
                    <>
                      <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                      <span>{actionableCases.length} att boka in</span>
                    </>
                  )}
                  {totalCount > 0 && (
                    <>
                      <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                      <span className="flex items-center gap-1">
                        {urgentCount > 0 && (
                          <AlertCircle className="w-3 h-3 text-red-400 animate-pulse" />
                        )}
                        {totalCount} avtalsförfrågningar
                      </span>
                    </>
                  )}
                  <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                  <span>{technicians.length} tekniker</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={() => { setSelectedCase(null); setIsCreateModalOpen(true); }} variant="primary"><FileText className="w-4 h-4 mr-2" />+ Nytt ärende</Button>
                <Button onClick={() => setIsAbsenceModalOpen(true)} variant="secondary"><CalendarOff className="w-4 h-4 mr-2" />+ Frånvaro</Button>
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
          {/* Avtalskundärenden Sidebar */}
          <aside className={`
            ${showSidebar ? 'w-96' : 'w-0'}
            transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
          `}>
            <PendingRequestsPanel
              onScheduleClick={handleSchedulePendingCase}
              className="h-full"
            />
          </aside>
          
          {/* ClickUp Control Panel */}
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
              onCaseClick={handleScheduleActionableCase}
            />
          </aside>
          
          {/* Main Schedule Timeline */}
          <main className="w-3/4 xl:w-4/5 flex-grow h-full">
            <ScheduleTimeline
              technicians={technicians.filter(t => selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id))}
              cases={filteredScheduledCases}
              absences={absences}
              onCaseClick={handleOpenCaseModal}
              onAbsenceClick={(absence) => {
                setSelectedAbsence(absence);
                setIsAbsenceDetailsModalOpen(true);
              }}
              onUpdate={fetchData}
            />
          </main>
        </div>
      </div>
      
      {/* Edit Modal för befintliga ärenden */}
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase as any} 
        technicians={technicians} 
      />
      
      {/* Create Modal för nya/schemaläggning */}
      <CreateCaseModal 
        isOpen={isCreateModalOpen} 
        onClose={() => { 
          setIsCreateModalOpen(false); 
          setSelectedCase(null); 
        }} 
        onSuccess={handleCreateSuccess} 
        technicians={technicians} 
        initialCaseData={selectedCase} 
      />
      <CreateAbsenceModal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} onSuccess={handleAbsenceCreateSuccess} technicians={technicians} />
      <AbsenceDetailsModal 
        isOpen={isAbsenceDetailsModalOpen} 
        onClose={() => {
          setIsAbsenceDetailsModalOpen(false);
          setSelectedAbsence(null);
        }} 
        absence={selectedAbsence}
        technicianName={selectedAbsence ? technicians.find(t => t.id === selectedAbsence.technician_id)?.name : undefined}
      />
      
      {/* Global Coordinator Chat */}
      <GlobalCoordinatorChat 
        currentPage="schedule"
        contextData={{
          technicians,
          scheduledCases: filteredScheduledCases,
          actionableCases: [...actionableCases, ...pendingCases.map(adaptCaseToBeGoneRow)],
          absences
        }}
      />
    </>
  );
}
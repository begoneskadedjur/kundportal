// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 3.2 - Dismiss-funktion för actionable cases ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BeGoneCaseRow, Technician, isScheduledCase } from '../../types/database';
import { Case } from '../../types/cases';

// Komponenter för schemat
import ScheduleControlPanel from '../../components/admin/coordinator/ScheduleControlPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';
import PendingRequestsNotifier from '../../components/coordinator/PendingRequestsNotifier';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

// Modaler
import EditCaseModal from '../../components/admin/technicians/EditCaseModal';
import EditContractCaseModal from '../../components/coordinator/EditContractCaseModal';
import InspectionCaseModal from '../../components/coordinator/InspectionCaseModal';
import CreateCaseModal from '../../components/admin/coordinator/CreateCaseModal';
import CreateAbsenceModal from '../../components/admin/coordinator/CreateAbsenceModal';
import AbsenceDetailsModal from '../../components/admin/coordinator/AbsenceDetailsModal';

import Button from '../../components/ui/Button';

import { LayoutGrid, CalendarOff, ArrowLeft, LogOut, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GlobalCoordinatorChat from '../../components/coordinator/GlobalCoordinatorChat';
import toast from 'react-hot-toast';

export interface Absence {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  notes?: string;
}

import { ALL_VALID_STATUSES } from '../../types/database';

const DEFAULT_ACTIVE_STATUSES = ALL_VALID_STATUSES.filter(status => !status.includes('Avslutat') && !status.includes('Stängt'));

export default function CoordinatorSchedule() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]); // Alla schemalagda ärenden
  const [contractCases, setContractCases] = useState<Case[]>([]); // Avtalskundärenden
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES));
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [selectedContractCase, setSelectedContractCase] = useState<Case | null>(null);
  const [selectedInspectionCase, setSelectedInspectionCase] = useState<Case | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditContractModalOpen, setIsEditContractModalOpen] = useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [isAbsenceDetailsModalOpen, setIsAbsenceDetailsModalOpen] = useState(false);
  const [openCommunicationOnLoad, setOpenCommunicationOnLoad] = useState(false);

  // Adapter för att konvertera Case till BeGoneCaseRow-liknande format
  const adaptCaseToBeGoneRow = (contractCase: Case & { customer?: any }): BeGoneCaseRow => {
    // Hämta customer data om den finns
    const customer = contractCase.customer || (contractCase as any).customer_data;
    
    // För multisite-kunder, inkludera enhetsnamn i titeln
    let displayTitle = contractCase.title;
    if (customer?.is_multisite && customer?.site_name) {
      displayTitle = `${contractCase.title} - ${customer.site_name}`;
    } else if (customer?.is_multisite && customer?.company_name) {
      displayTitle = `${contractCase.title} - ${customer.company_name}`;
    }
    
    return {
      id: contractCase.id,
      case_id: contractCase.case_number,
      title: displayTitle,
      status: contractCase.status, // Använd status direkt från databasen
      priority: contractCase.priority,
      // Prioritera customer-data över case-data för kontaktuppgifter
      adress: customer?.contact_address || (contractCase as any).address_formatted,
      kontaktperson: customer?.contact_person || contractCase.contact_person,
      telefon: customer?.contact_phone || contractCase.contact_phone,
      email: customer?.contact_email || contractCase.contact_email,
      
      // VIKTIGT: Mappa korrekt datetime-fält från cases-tabellen
      start_date: contractCase.scheduled_start,
      due_date: contractCase.scheduled_end,
      
      // Tekniker-mappning från cases-tabellen  
      primary_assignee_id: contractCase.primary_technician_id,
      primary_assignee_name: contractCase.primary_technician_name || null,
      primary_assignee_email: contractCase.primary_technician_email || null,
      secondary_assignee_id: null,
      secondary_assignee_name: null,
      secondary_assignee_email: null,
      tertiary_assignee_id: null,
      tertiary_assignee_name: null,
      tertiary_assignee_email: null,
      
      case_type: 'contract' as const,
      description: contractCase.description,
      price: contractCase.price,
      created_at: contractCase.created_at,
      updated_at: contractCase.updated_at,
      
      // Skadedjur från avtalsärenden
      skadedjur: contractCase.pest_type,
      annat_skadedjur: (contractCase as any).other_pest_type || null,
      pest_type: contractCase.pest_type,
      other_pest_type: (contractCase as any).other_pest_type,
      
      organization_number: customer?.organization_number || null,
      customer_id: contractCase.customer_id,
      // Beställare/kund info från customer
      bestallare: customer?.company_name || null,
      faktura_email: customer?.billing_email || customer?.contact_email || null,
      faktura_adress: customer?.billing_address || customer?.contact_address || null,
      // Inkludera parent_customer_id för multisite-enheter
      parent_customer_id: customer?.parent_customer_id || null
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
        supabase.from('cases').select('*, customer:customers(*)').in('status', ALL_VALID_STATUSES).order('created_at', { ascending: false }),
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

  // Hantera öppning av specifikt ärende från notifikation/intern administration
  useEffect(() => {
    const openCaseId = searchParams.get('openCase');
    const caseType = searchParams.get('caseType');

    if (!openCaseId || allCases.length === 0) return;

    // Hitta ärendet i listan
    const foundCase = allCases.find(c => c.id === openCaseId);

    if (foundCase) {
      // Öppna modal med kommunikationsfliken
      setOpenCommunicationOnLoad(true);

      if (foundCase.case_type === 'contract') {
        const contractCase = contractCases.find(c => c.id === foundCase.id);
        if (contractCase) {
          setSelectedContractCase(contractCase);
          setIsEditContractModalOpen(true);
        }
      } else {
        setSelectedCase(foundCase);
        setIsEditModalOpen(true);
      }

      // Rensa URL-parametrar
      setSearchParams({});
    } else if (!loading) {
      // Ärendet finns inte - rensa params
      setSearchParams({});
    }
  }, [searchParams, allCases, contractCases, loading]);

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
  
  // Hantera klick på ärende - öppna rätt modal beroende på ärendetyp
  const handleOpenCaseModal = (caseData: BeGoneCaseRow) => {
    if (caseData.case_type === 'contract') {
      // För avtalsärenden, hitta det ursprungliga Case-objektet
      const contractCase = contractCases.find(c => c.id === caseData.id);
      if (contractCase) {
        // Kolla om det är ett stationskontroll-ärende
        if (contractCase.service_type === 'inspection') {
          setSelectedInspectionCase(contractCase);
          setIsInspectionModalOpen(true);
        } else {
          // Vanligt avtalsärende (servicebesök)
          setSelectedContractCase(contractCase);
          setIsEditContractModalOpen(true);
        }
      }
    } else {
      // För ClickUp-ärenden, använd standard EditCaseModal
      setSelectedCase(caseData);
      setIsEditModalOpen(true);
    }
  };
  
  // Hantera schemaläggning av ClickUp-ärende som ska bokas in
  const handleScheduleActionableCase = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsCreateModalOpen(true);
  };

  // Hantera schemaläggning av avtalskundärende från sidebar
  const handleSchedulePendingCase = (caseData: Case & { customer?: any }) => {
    // Konvertera till BeGoneCaseRow-format för modal med customer data
    const adaptedCase = adaptCaseToBeGoneRow(caseData);
    setSelectedCase(adaptedCase);
    setIsCreateModalOpen(true);
  };

  // ✅ Dismiss actionable case - ändra status så den försvinner från listan
  const handleDismissCase = async (caseData: BeGoneCaseRow) => {
    try {
      // Bestäm rätt tabell baserat på case_type
      const tableName = caseData.case_type === 'business' ? 'business_cases' : 'private_cases';

      // Uppdatera status till "Stängt - slasklogg" (avvisad)
      const { error } = await supabase
        .from(tableName)
        .update({ status: 'Stängt - slasklogg' })
        .eq('id', caseData.id);

      if (error) throw error;

      // Uppdatera lokalt state för omedelbar feedback
      setAllCases(prev => prev.map(c =>
        c.id === caseData.id ? { ...c, status: 'Stängt - slasklogg' } : c
      ));

      toast.success(`Ärendet "${caseData.title}" har tagits bort från listan`);
    } catch (err) {
      console.error('Fel vid borttagning av avisering:', err);
      toast.error('Kunde inte ta bort aviseringen. Försök igen.');
      throw err; // Re-throw för att uppdatera dismiss-knappens laddningstillstånd
    }
  };

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    setIsEditContractModalOpen(false);
    setIsInspectionModalOpen(false);
    setSelectedInspectionCase(null);
    fetchData();
  };
  
  const handleCreateSuccess = () => { 
    setIsCreateModalOpen(false); 
    setSelectedCase(null); 
    fetchData();
  };
  
  const handleAbsenceCreateSuccess = () => { 
    setIsAbsenceModalOpen(false); 
    fetchData(); 
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><LoadingSpinner text="Laddar schema..." /></div>;
  }

  return (
    <>
      <div className="text-white flex flex-col h-[calc(100vh-3rem)]">
        <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 z-10">
          <div className="max-w-screen-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-white">Schemaöversikt</h1>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span>{filteredScheduledCases.length} schemalagda</span>
                  {actionableCases.length > 0 && (
                    <>
                      <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                      <span>{actionableCases.length} att boka in</span>
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
            </div>
          </div>
        </header>

        <div className="flex-grow max-w-screen-3xl mx-auto w-full flex flex-row h-full overflow-hidden">
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
              onDismissCase={handleDismissCase}
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
      
      {/* Edit Modal för ClickUp-ärenden */}
      <EditCaseModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setOpenCommunicationOnLoad(false);
        }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase as any}
        technicians={technicians}
        openCommunicationOnLoad={openCommunicationOnLoad}
      />
      
      {/* Edit Modal för avtalsärenden */}
      <EditContractCaseModal
        isOpen={isEditContractModalOpen}
        onClose={() => {
          setIsEditContractModalOpen(false);
          setSelectedContractCase(null);
          setOpenCommunicationOnLoad(false);
        }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedContractCase}
      />

      {/* Inspection Modal för stationskontroll-ärenden */}
      <InspectionCaseModal
        isOpen={isInspectionModalOpen}
        onClose={() => {
          setIsInspectionModalOpen(false);
          setSelectedInspectionCase(null);
        }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedInspectionCase}
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
      
      {/* Pending Requests Notifier - Diskret modul för avtalskundärenden */}
      <PendingRequestsNotifier
        onScheduleClick={handleSchedulePendingCase}
      />
      
      {/* Global Coordinator Chat */}
      <GlobalCoordinatorChat 
        currentPage="schedule"
        contextData={{
          technicians,
          scheduledCases: filteredScheduledCases,
          actionableCases: actionableCases,
          absences
        }}
      />
    </>
  );
}
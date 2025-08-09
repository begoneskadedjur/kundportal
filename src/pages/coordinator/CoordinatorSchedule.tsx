// 📁 src/pages/coordinator/CoordinatorSchedule.tsx
// ⭐ VERSION 3.0 - Updated with new database structure and pending requests sidebar ⭐

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Case } from '../../types/cases';
import PendingRequestsPanel from '../../components/coordinator/PendingRequestsPanel';
import ScheduleTimeline from '../../components/admin/coordinator/ScheduleTimeline';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
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

export interface Technician {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  work_schedule?: any;
}

export default function CoordinatorSchedule() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [isAbsenceDetailsModalOpen, setIsAbsenceDetailsModalOpen] = useState(false);
  
  // Use the pending cases hook
  const { pendingCases, urgentCount, oldRequestsCount, totalCount, refresh: refreshPending } = usePendingCases();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [techniciansResult, casesResult, absencesResult] = await Promise.all([
        supabase.from('technicians').select('*').eq('is_active', true).order('name'),
        supabase.from('cases').select('*').neq('status', 'requested').order('created_at', { ascending: false }),
        supabase.from('technician_absences').select('*')
      ]);

      if (techniciansResult.error) throw techniciansResult.error;
      if (casesResult.error) throw casesResult.error;
      if (absencesResult.error) throw absencesResult.error;

      const fetchedTechnicians = techniciansResult.data || [];
      setTechnicians(fetchedTechnicians);
      setAbsences(absencesResult.data || []);
      setCases(casesResult.data || []);

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

  // Filter scheduled cases (not requested status)
  const scheduledCases = useMemo(() => {
    return cases.filter(c => c.status === 'scheduled' || c.status === 'in_progress' || c.status === 'completed');
  }, [cases]);

  // Filter cases by search and selected technicians
  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      if (selectedTechnicianIds.size > 0 && c.primary_technician_id) {
        if (!selectedTechnicianIds.has(c.primary_technician_id)) {
          return false;
        }
      }
      const query = searchQuery.toLowerCase();
      if (query) {
        return (c.title?.toLowerCase() || '').includes(query) || 
               (c.contact_person?.toLowerCase() || '').includes(query) || 
               (c.address?.formatted_address?.toLowerCase() || '').includes(query);
      }
      return true;
    });
  }, [scheduledCases, selectedTechnicianIds, searchQuery]);
  
  // Handle scheduling a pending request
  const handleSchedulePendingCase = (caseData: Case) => {
    setSelectedCase(caseData);
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = () => { 
    setIsCreateModalOpen(false); 
    setSelectedCase(null); 
    fetchData();
    refreshPending();
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
                  {totalCount > 0 && (
                    <>
                      <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                      <span className="flex items-center gap-1">
                        {urgentCount > 0 && (
                          <AlertCircle className="w-3 h-3 text-red-400 animate-pulse" />
                        )}
                        {totalCount} väntande
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
          {/* Pending Requests Sidebar */}
          <aside className={`
            ${showSidebar ? 'w-96' : 'w-0'}
            transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
          `}>
            <PendingRequestsPanel
              onScheduleClick={handleSchedulePendingCase}
              className="h-full"
            />
          </aside>
          
          {/* Main Schedule View */}
          <main className="flex-1 h-full overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Search and Filter Controls */}
              <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Sök ärenden..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <select
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    onChange={(e) => {
                      if (e.target.value === 'all') {
                        setSelectedTechnicianIds(new Set());
                      } else {
                        setSelectedTechnicianIds(new Set([e.target.value]));
                      }
                    }}
                  >
                    <option value="all">Alla tekniker</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Schedule Timeline */}
              <div className="flex-1 overflow-auto">
                <ScheduleTimeline
                  technicians={technicians.filter(t => selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id))}
                  cases={filteredScheduledCases as any}
                  absences={absences}
                  onCaseClick={(caseData) => {
                    setSelectedCase(caseData as any);
                    setIsCreateModalOpen(true);
                  }}
                  onAbsenceClick={(absence) => {
                    setSelectedAbsence(absence);
                    setIsAbsenceDetailsModalOpen(true);
                  }}
                  onUpdate={fetchData}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Create/Edit Case Modal */}
      <CreateCaseModal 
        isOpen={isCreateModalOpen} 
        onClose={() => { 
          setIsCreateModalOpen(false); 
          setSelectedCase(null); 
        }} 
        onSuccess={handleCreateSuccess} 
        technicians={technicians} 
        initialCaseData={selectedCase as any} 
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
          actionableCases: actionableCases,
          absences
        }}
      />
    </>
  );
}
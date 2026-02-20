// CoordinatorScheduleV2.tsx — Egenbyggd schemavy (ersätter FullCalendar)
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BeGoneCaseRow, Technician, isScheduledCase, ALL_VALID_STATUSES } from '../../types/database'
import { Case } from '../../types/cases'
import { AnimatePresence } from 'framer-motion'

// V2 komponenter
import { ScheduleHeader, type ViewMode } from '../../components/coordinator/schedule-v2/ScheduleHeader'
import { ScheduleGrid } from '../../components/coordinator/schedule-v2/ScheduleGrid'
import { ActionableCasesDrawer } from '../../components/coordinator/schedule-v2/ActionableCasesDrawer'
import type { Absence } from '../../components/coordinator/schedule-v2/AbsenceBlock'

// Befintliga modaler (återanvänds rakt av)
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import EditContractCaseModal from '../../components/coordinator/EditContractCaseModal'
import InspectionCaseModal from '../../components/coordinator/InspectionCaseModal'
import CreateCaseModal from '../../components/admin/coordinator/CreateCaseModal'
import CreateAbsenceModal from '../../components/admin/coordinator/CreateAbsenceModal'
import AbsenceDetailsModal from '../../components/admin/coordinator/AbsenceDetailsModal'
import PendingRequestsNotifier from '../../components/coordinator/PendingRequestsNotifier'
import GlobalCoordinatorChat from '../../components/coordinator/GlobalCoordinatorChat'

const DEFAULT_ACTIVE_STATUSES = ALL_VALID_STATUSES.filter(
  s => !s.includes('Avslutat') && !s.includes('Stängt')
)

/** Skeleton-loading som matchar ScheduleGrid-layouten */
function ScheduleSkeleton() {
  const rows = 6 // Placeholder-tekniker
  return (
    <div className="flex flex-1 overflow-hidden animate-pulse">
      {/* Teknikerkolumn */}
      <div className="flex-shrink-0 border-r border-slate-700/50" style={{ width: 224 }}>
        <div className="border-b border-slate-700/50 bg-slate-900/95 h-8" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 border-b border-slate-800/60" style={{ height: 88 }}>
            <div className="w-1 self-stretch rounded-full bg-slate-700/50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-slate-800/60 rounded" />
              <div className="h-2 w-16 bg-slate-800/40 rounded" />
              <div className="h-1 w-full bg-slate-800/30 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      {/* Grid-area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-8 bg-slate-900/95 border-b border-slate-700/50" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="border-b border-slate-800/60 relative" style={{ height: 88 }}>
            {/* Subtila vertikala linjer */}
            {Array.from({ length: 14 }, (_, h) => (
              <div key={h} className="absolute top-0 h-full border-l border-slate-800/20" style={{ left: h * 120 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CoordinatorScheduleV2() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([])
  const [contractCases, setContractCases] = useState<Case[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set())
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES))

  // Vy-state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('day')

  // Modal-state
  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null)
  const [selectedContractCase, setSelectedContractCase] = useState<Case | null>(null)
  const [selectedInspectionCase, setSelectedInspectionCase] = useState<Case | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEditContractModalOpen, setIsEditContractModalOpen] = useState(false)
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false)
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)
  const [isAbsenceDetailsModalOpen, setIsAbsenceDetailsModalOpen] = useState(false)
  const [openCommunicationOnLoad, setOpenCommunicationOnLoad] = useState(false)
  const [isActionableDrawerOpen, setIsActionableDrawerOpen] = useState(false)

  // ─── Data-fetching (identisk med befintlig CoordinatorSchedule) ───

  const adaptCaseToBeGoneRow = (contractCase: Case & { customer?: any }): BeGoneCaseRow => {
    const customer = contractCase.customer || (contractCase as any).customer_data
    let displayTitle = contractCase.title
    if (customer?.is_multisite && customer?.site_name) {
      displayTitle = `${contractCase.title} - ${customer.site_name}`
    } else if (customer?.is_multisite && customer?.company_name) {
      displayTitle = `${contractCase.title} - ${customer.company_name}`
    }
    return {
      id: contractCase.id,
      case_id: contractCase.case_number,
      title: displayTitle,
      status: contractCase.status,
      priority: contractCase.priority,
      adress: customer?.contact_address || (contractCase as any).address_formatted,
      kontaktperson: customer?.contact_person || contractCase.contact_person,
      telefon: customer?.contact_phone || contractCase.contact_phone,
      email: customer?.contact_email || contractCase.contact_email,
      start_date: contractCase.scheduled_start,
      due_date: contractCase.scheduled_end,
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
      skadedjur: contractCase.pest_type,
      annat_skadedjur: (contractCase as any).other_pest_type || null,
      pest_type: contractCase.pest_type,
      other_pest_type: (contractCase as any).other_pest_type,
      organization_number: customer?.organization_number || null,
      customer_id: contractCase.customer_id,
      bestallare: customer?.company_name || null,
      faktura_email: customer?.billing_email || customer?.contact_email || null,
      faktura_adress: customer?.billing_address || customer?.contact_address || null,
      parent_customer_id: customer?.parent_customer_id || null,
    } as BeGoneCaseRow
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [techResult, privateResult, businessResult, contractResult, absenceResult] = await Promise.all([
        supabase.from('technicians').select('*').eq('is_active', true).order('name'),
        supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('business_cases').select('*').order('created_at', { ascending: false }),
        supabase.from('cases').select('*, customer:customers(*)').in('status', ALL_VALID_STATUSES).order('created_at', { ascending: false }),
        supabase.from('technician_absences').select('*'),
      ])

      if (techResult.error) throw techResult.error
      if (privateResult.error) throw privateResult.error
      if (businessResult.error) throw businessResult.error
      if (contractResult.error) throw contractResult.error
      if (absenceResult.error) throw absenceResult.error

      const fetchedTechnicians = techResult.data || []
      setTechnicians(fetchedTechnicians)
      setAbsences(absenceResult.data || [])
      setContractCases(contractResult.data || [])

      const combinedCases = [
        ...(privateResult.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessResult.data || []).map(c => ({ ...c, case_type: 'business' as const })),
        ...(contractResult.data || []).map(adaptCaseToBeGoneRow),
      ]
      setAllCases(combinedCases as BeGoneCaseRow[])

      if (selectedTechnicianIds.size === 0 && fetchedTechnicians.length > 0) {
        const defaultSelected = fetchedTechnicians.filter(t => t.role === 'Skadedjurstekniker').map(t => t.id)
        setSelectedTechnicianIds(new Set(defaultSelected))
      }
    } catch (err) {
      console.error('Fel vid datahämtning:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedTechnicianIds.size])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Öppna ärende från URL-param ───

  useEffect(() => {
    const openCaseId = searchParams.get('openCase')
    if (!openCaseId || allCases.length === 0) return
    const foundCase = allCases.find(c => c.id === openCaseId)
    if (foundCase) {
      setOpenCommunicationOnLoad(true)
      if (foundCase.case_type === 'contract') {
        const cc = contractCases.find(c => c.id === foundCase.id)
        if (cc) { setSelectedContractCase(cc); setIsEditContractModalOpen(true) }
      } else {
        setSelectedCase(foundCase); setIsEditModalOpen(true)
      }
      setSearchParams({})
    } else if (!loading) {
      setSearchParams({})
    }
  }, [searchParams, allCases, contractCases, loading])

  // ─── Filtrerade ärenden ───

  const scheduledCases = useMemo(() => allCases.filter(isScheduledCase), [allCases])
  const actionableCases = useMemo(() => allCases.filter(c => c.status === 'Offert signerad - boka in'), [allCases])

  const filteredScheduledCases = useMemo(() => {
    return scheduledCases.filter(c => {
      if (!activeStatuses.has(c.status)) return false
      if (selectedTechnicianIds.size > 0) {
        const ids = [c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id].filter(Boolean)
        if (ids.length > 0 && !ids.some(id => selectedTechnicianIds.has(id!))) return false
      }
      return true
    })
  }, [scheduledCases, activeStatuses, selectedTechnicianIds])

  // Filtrerade tekniker (bara valda)
  const filteredTechnicians = useMemo(
    () => technicians.filter(t => selectedTechnicianIds.size === 0 || selectedTechnicianIds.has(t.id)),
    [technicians, selectedTechnicianIds]
  )

  // ─── Modal-hantering ───

  const handleOpenCaseModal = useCallback((caseData: BeGoneCaseRow) => {
    if (caseData.case_type === 'contract') {
      const cc = contractCases.find(c => c.id === caseData.id)
      if (cc) {
        if (cc.service_type === 'inspection') {
          setSelectedInspectionCase(cc); setIsInspectionModalOpen(true)
        } else {
          setSelectedContractCase(cc); setIsEditContractModalOpen(true)
        }
      }
    } else {
      setSelectedCase(caseData); setIsEditModalOpen(true)
    }
  }, [contractCases])

  const handleSchedulePendingCase = (caseData: Case & { customer?: any }) => {
    const adaptedCase = adaptCaseToBeGoneRow(caseData)
    setSelectedCase(adaptedCase)
    setIsCreateModalOpen(true)
  }

  const handleScheduleFromDrawer = useCallback((caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData)
    setIsCreateModalOpen(true)
    setIsActionableDrawerOpen(false)
  }, [])

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false)
    setIsEditContractModalOpen(false)
    setIsInspectionModalOpen(false)
    setSelectedInspectionCase(null)
    fetchData()
  }

  const handleAbsenceClick = useCallback((a: Absence) => {
    setSelectedAbsence(a); setIsAbsenceDetailsModalOpen(true)
  }, [])

  const handleCreateSuccess = () => { setIsCreateModalOpen(false); setSelectedCase(null); fetchData() }
  const handleAbsenceCreateSuccess = () => { setIsAbsenceModalOpen(false); fetchData() }

  // ─── Render ───

  return (
    <>
      <div className="text-white flex flex-col h-[calc(100vh-3rem)]">
        <ScheduleHeader
          currentDate={currentDate}
          viewMode={viewMode}
          onChangeDate={setCurrentDate}
          onChangeView={setViewMode}
          onCreateCase={() => { setSelectedCase(null); setIsCreateModalOpen(true) }}
          onCreateAbsence={() => setIsAbsenceModalOpen(true)}
          stats={{
            scheduled: filteredScheduledCases.length,
            toBook: actionableCases.length,
            technicians: filteredTechnicians.length,
          }}
          activeStatuses={activeStatuses}
          setActiveStatuses={setActiveStatuses}
          defaultStatuses={new Set(DEFAULT_ACTIVE_STATUSES)}
          technicians={technicians}
          selectedTechnicianIds={selectedTechnicianIds}
          setSelectedTechnicianIds={setSelectedTechnicianIds}
          isActionableOpen={isActionableDrawerOpen}
          onToggleActionable={() => setIsActionableDrawerOpen(v => !v)}
        />

        <AnimatePresence>
          {isActionableDrawerOpen && (
            <ActionableCasesDrawer
              cases={actionableCases}
              onScheduleCase={handleScheduleFromDrawer}
              onClose={() => setIsActionableDrawerOpen(false)}
            />
          )}
        </AnimatePresence>

        {loading ? (
          <ScheduleSkeleton />
        ) : (
          <ScheduleGrid
            technicians={filteredTechnicians}
            cases={filteredScheduledCases}
            absences={absences}
            currentDate={currentDate}
            viewMode={viewMode}
            onCaseClick={handleOpenCaseModal}
            onAbsenceClick={handleAbsenceClick}
          />
        )}
      </div>

      {/* Modaler — identiska med befintlig sida */}
      <EditCaseModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setOpenCommunicationOnLoad(false) }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase as any}
        technicians={technicians}
        openCommunicationOnLoad={openCommunicationOnLoad}
      />
      <EditContractCaseModal
        isOpen={isEditContractModalOpen}
        onClose={() => { setIsEditContractModalOpen(false); setSelectedContractCase(null); setOpenCommunicationOnLoad(false) }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedContractCase}
      />
      <InspectionCaseModal
        isOpen={isInspectionModalOpen}
        onClose={() => { setIsInspectionModalOpen(false); setSelectedInspectionCase(null) }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedInspectionCase}
      />
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setSelectedCase(null) }}
        onSuccess={handleCreateSuccess}
        technicians={technicians}
        initialCaseData={selectedCase}
      />
      <CreateAbsenceModal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        onSuccess={handleAbsenceCreateSuccess}
        technicians={technicians}
      />
      <AbsenceDetailsModal
        isOpen={isAbsenceDetailsModalOpen}
        onClose={() => { setIsAbsenceDetailsModalOpen(false); setSelectedAbsence(null) }}
        absence={selectedAbsence}
        technicianName={selectedAbsence ? technicians.find(t => t.id === selectedAbsence.technician_id)?.name : undefined}
      />
      <PendingRequestsNotifier onScheduleClick={handleSchedulePendingCase} />
      <GlobalCoordinatorChat
        currentPage="schedule"
        contextData={{ technicians, scheduledCases: filteredScheduledCases, actionableCases, absences }}
      />
    </>
  )
}

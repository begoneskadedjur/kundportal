// CoordinatorSchedule.tsx — Egenbyggd schemavy
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BeGoneCaseRow, Technician, isScheduledCase, ALL_VALID_STATUSES } from '../../types/database'
import { Case } from '../../types/cases'
import { AnimatePresence } from 'framer-motion'

// Schema-komponenter
import { ScheduleHeader, type ViewMode, type CaseType } from '../../components/coordinator/schedule/ScheduleHeader'
import { ScheduleGrid } from '../../components/coordinator/schedule/ScheduleGrid'
import { ActionableCasesDrawer } from '../../components/coordinator/schedule/ActionableCasesDrawer'
import { CasePipelineService } from '../../services/casePipelineService'
import type { CoordinatorCaseAction } from '../../types/casePipeline'
import type { Absence } from '../../components/coordinator/schedule/AbsenceBlock'

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

export default function CoordinatorSchedule() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([])
  const [contractCases, setContractCases] = useState<Case[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set())
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_STATUSES))

  // Refs för att undvika dubbel fetch-loop
  const selectedTechRef = useRef(selectedTechnicianIds)
  selectedTechRef.current = selectedTechnicianIds
  const isInitialLoad = useRef(true)

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
  const [caseTypeForCreate, setCaseTypeForCreate] = useState<CaseType | null>(null)
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false)
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)
  const [isAbsenceDetailsModalOpen, setIsAbsenceDetailsModalOpen] = useState(false)
  const [openCommunicationOnLoad, setOpenCommunicationOnLoad] = useState(false)
  const [isActionableDrawerOpen, setIsActionableDrawerOpen] = useState(false)
  const [actionMap, setActionMap] = useState<Record<string, CoordinatorCaseAction>>({})

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
      oneflow_contract_id: contractCase.oneflow_contract_id || null,
    } as BeGoneCaseRow
  }

  const fetchData = useCallback(async () => {
    try {
      if (isInitialLoad.current) setLoading(true)

      const [techResult, privateResult, businessResult, contractResult, absenceResult, signedOffersResult] = await Promise.all([
        supabase.from('technicians').select('*').eq('is_active', true).order('name'),
        supabase.from('private_cases').select(`
          id, title, status, priority, start_date, due_date, created_at, updated_at,
          adress, kontaktperson, skadedjur, annat_skadedjur,
          e_post_kontaktperson, telefon_kontaktperson, personnummer, pris,
          primary_assignee_id, primary_assignee_name, primary_assignee_email,
          secondary_assignee_id, secondary_assignee_name, secondary_assignee_email,
          tertiary_assignee_id, tertiary_assignee_name, tertiary_assignee_email,
          description, rapport, r_rot_rut, r_fastighetsbeteckning,
          r_arbetskostnad, r_material_utrustning, r_servicebil,
          reklamation, vaggloss_angade_rum, case_number,
          material_cost, time_spent_minutes, work_started_at,
          parent_case_id, created_by_technician_id, created_by_technician_name
        `).in('status', ALL_VALID_STATUSES).order('created_at', { ascending: false }),
        supabase.from('business_cases').select(`
          id, title, status, priority, start_date, due_date, created_at, updated_at,
          adress, kontaktperson, skadedjur, annat_skadedjur, bestallare, company_name,
          e_post_kontaktperson, telefon_kontaktperson, org_nr, pris,
          e_post_faktura, markning_faktura,
          primary_assignee_id, primary_assignee_name, primary_assignee_email,
          secondary_assignee_id, secondary_assignee_name, secondary_assignee_email,
          tertiary_assignee_id, tertiary_assignee_name, tertiary_assignee_email,
          description, rapport, reklamation, vaggloss_angade_rum, case_number,
          material_cost, time_spent_minutes, work_started_at,
          parent_case_id, created_by_technician_id, created_by_technician_name
        `).in('status', ALL_VALID_STATUSES).order('created_at', { ascending: false }),
        supabase.from('cases').select(`
          *, customer:customers(
            company_name, contact_address, contact_person, contact_phone,
            contact_email, billing_email, billing_address,
            organization_number, parent_customer_id, site_name, is_multisite
          )
        `).in('status', ALL_VALID_STATUSES).order('created_at', { ascending: false }),
        supabase.from('technician_absences').select('*'),
        // Hämta signerade offerter för att berika private/business cases med oneflow_contract_id
        supabase.from('contracts')
          .select('source_id, oneflow_contract_id')
          .eq('type', 'offer')
          .eq('status', 'signed')
          .not('source_id', 'is', null),
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

      // Lookup-map: source_id → oneflow_contract_id (för att berika private/business cases)
      const offerMap = new Map(
        (signedOffersResult.data || []).map(o => [o.source_id, o.oneflow_contract_id])
      )

      const combinedCases = [
        ...(privateResult.data || []).map(c => ({ ...c, case_type: 'private' as const, oneflow_contract_id: offerMap.get(c.id) || null })),
        ...(businessResult.data || []).map(c => ({ ...c, case_type: 'business' as const, oneflow_contract_id: offerMap.get(c.id) || null })),
        ...(contractResult.data || []).map(adaptCaseToBeGoneRow),
      ]
      setAllCases(combinedCases as BeGoneCaseRow[])

      if (selectedTechRef.current.size === 0 && fetchedTechnicians.length > 0) {
        const defaultSelected = fetchedTechnicians.filter(t => t.role === 'Skadedjurstekniker').map(t => t.id)
        setSelectedTechnicianIds(new Set(defaultSelected))
      }
    } catch (err) {
      console.error('Fel vid datahämtning:', err)
    } finally {
      setLoading(false)
      isInitialLoad.current = false
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Öppna ärende från URL-param ───

  useEffect(() => {
    const openCaseId = searchParams.get('openCase')
    const scheduleCaseId = searchParams.get('scheduleCase')

    // Öppna bokningsmodulen (CreateCaseModal) från Offerthantering "Boka"-knapp
    if (scheduleCaseId && allCases.length > 0) {
      const foundCase = allCases.find(c => c.id === scheduleCaseId)
      if (foundCase) {
        setSelectedCase(foundCase)
        setIsCreateModalOpen(true)
      }
      setSearchParams({})
      return
    }

    // Öppna EditCaseModal med kommunikationspanel (från Historik-knapp)
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
  const actionableCases = useMemo(() =>
    allCases.filter(c => c.status === 'Offert signerad - boka in' && c.oneflow_contract_id),
    [allCases]
  )

  // Hämta coordinator actions för "att boka in"-ärenden
  useEffect(() => {
    if (actionableCases.length === 0) return
    const ids = actionableCases.map(c => c.id)
    CasePipelineService.getActionsForCases(ids)
      .then(setActionMap)
      .catch(err => console.warn('Kunde inte hämta coordinator actions:', err))
  }, [actionableCases])

  const handleActionUpdate = useCallback((caseId: string, action: CoordinatorCaseAction) => {
    setActionMap(prev => ({ ...prev, [caseId]: action }))
  }, [])

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

  const handleOpenHistory = useCallback((caseData: BeGoneCaseRow) => {
    setOpenCommunicationOnLoad(true)
    handleOpenCaseModal(caseData)
  }, [handleOpenCaseModal])

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
          onCreateCase={(type) => { setSelectedCase(null); setCaseTypeForCreate(type); setIsCreateModalOpen(true) }}
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
              actionMap={actionMap}
              onScheduleCase={handleScheduleFromDrawer}
              onActionUpdate={handleActionUpdate}
              onOpenHistory={handleOpenHistory}
              onOpenCase={handleOpenCaseModal}
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
        onClose={() => { setIsCreateModalOpen(false); setSelectedCase(null); setCaseTypeForCreate(null) }}
        onSuccess={handleCreateSuccess}
        technicians={technicians}
        initialCaseData={selectedCase}
        initialCaseType={caseTypeForCreate}
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

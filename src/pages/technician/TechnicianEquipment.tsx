// src/pages/technician/TechnicianEquipment.tsx
// Omdesignad: Enhetlig vy utan utomhus/inomhus-tabbar
// Visar kunder med utplacerade stationer (expanderbara rader)
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  getEquipmentTypeLabel
} from '../../types/database'
import { EquipmentService, CustomerStationSummary } from '../../services/equipmentService'
import { ContractService } from '../../services/contractService'
import { EquipmentPlacementForm, type FormData as EquipmentFormData } from '../../components/shared/equipment/EquipmentPlacementForm'
import type { ExistingStation } from '../../components/shared/equipment/MapLocationPicker'
import {
  Plus,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
  Check,
  Wrench,
  Home
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AllCustomersList } from '../../components/technician/AllCustomersList'
import { InspectionOverviewTab } from '../../components/technician/InspectionOverviewTab'
import { CollapsibleMapSection } from '../../components/technician/CollapsibleMapSection'
import { AddStationWizard } from '../../components/technician/AddStationWizard'
import { RecurringScheduleWizardWithContract as RecurringScheduleWizard } from '../../components/technician/RecurringScheduleWizardWithContract'
import { ScheduleInfoPanel } from '../../components/technician/ScheduleInfoPanel'
import { EditScheduleModal } from '../../components/technician/EditScheduleModal'
import { getRecurringSchedulesByCustomer } from '../../services/recurringScheduleService'
import type { BatchScheduleUnit } from '../../types/recurringSchedule'
import type { OutdoorInspectionWithRelations } from '../../types/inspectionSession'
import { CasePreparationService } from '../../services/casePreparationService'
import type { PreparationUnit } from '../../types/casePreparations'
import { CaseBillingService } from '../../services/caseBillingService'
import { AddonStationBillingService } from '../../services/addonStationBillingService'
import { PriceListService } from '../../services/priceListService'
import { toLocalISOStringWithOffset } from '../../utils/dateHelpers'

// Faktureringssammanfattning vid "Färdig med etablering".
// Tilläggsstationerna har en EGEN rad (markör is_addon_station_line, synkad
// via RPC) med den flaggade tjänsten — Etableringskostnad-raden (ärendets
// primärtjänst, 0 kr-norm) visas men rörs aldrig av denna logik.
interface EstablishmentSummaryState {
  caseId: string
  customerId: string
  customerName: string
  serviceItems: { id: string; name: string; quantity: number; unitPrice: number }[]
  addonItemId: string | null
  addonCount: number
  quantityDraft: number
  // Redigerbart pris (kr/st) på tilläggsraden — förifylls från radens pris
  // eller aktuellt listpris
  priceDraft: number
  // Aktuellt listpris (avtals-/kundprislista): pris under detta räknas som
  // rabatt och går genom rabattgodkännande-flödet
  listPrice: number
}

interface Customer {
  id: string
  company_name: string
  contact_address: string | null
}

type EquipmentTab = 'kunder' | 'karta' | 'kontroller'

const EQUIPMENT_TABS: { value: EquipmentTab; label: string }[] = [
  { value: 'kunder', label: 'Kunder' },
  { value: 'karta', label: 'Karta' },
  { value: 'kontroller', label: 'Kontroller' }
]

export default function TechnicianEquipment() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Aktiv tabb i URL:en så att bakåtknapp och delade länkar fungerar
  const tabParam = searchParams.get('tab')
  const activeTab: EquipmentTab =
    tabParam === 'karta' || tabParam === 'kontroller' ? tabParam : 'kunder'

  const setActiveTab = (tab: EquipmentTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      next.delete('customer')
      return next
    }, { replace: true })
  }

  // State
  const [allEquipment, setAllEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [allCustomers, setAllCustomers] = useState<CustomerStationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentPlacementWithRelations | null>(null)
  const [outdoorInspections, setOutdoorInspections] = useState<OutdoorInspectionWithRelations[]>([])
  const [previewPosition, setPreviewPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [wizardCustomerId, setWizardCustomerId] = useState<string | null>(null)
  const [wizardAutoIndoor, setWizardAutoIndoor] = useState(false)

  // Batch-placering state
  const [batchCount, setBatchCount] = useState(0)
  const [batchCustomerName, setBatchCustomerName] = useState('')
  const [showSuccessState, setShowSuccessState] = useState(false)
  const [formResetKey, setFormResetKey] = useState(0)
  const [lastEquipmentType, setLastEquipmentType] = useState<EquipmentType | null>(null)
  const [lastUsedMap, setLastUsedMap] = useState(false)
  // Kopiera från föregående station: preparat + mängd + märkning följer med i batchen
  const [lastPreparation, setLastPreparation] = useState<{ id: string; quantity: number | null; unit: PreparationUnit } | null>(null)
  const [lastIsAddon, setLastIsAddon] = useState(false)

  // Recurring schedule prompt
  const [showSchedulePrompt, setShowSchedulePrompt] = useState(false)
  const [schedulePromptCustomerId, setSchedulePromptCustomerId] = useState<string | null>(null)
  const [schedulePromptCustomerName, setSchedulePromptCustomerName] = useState('')
  const [showScheduleWizard, setShowScheduleWizard] = useState(false)

  // Batch-schemaläggning (från kundlistan)
  const [batchScheduleUnits, setBatchScheduleUnits] = useState<BatchScheduleUnit[]>([])

  // Schema-info panel (bottom sheet / sidopanel)
  const [schedulePanelTarget, setSchedulePanelTarget] = useState<{
    customerId: string
    customerName: string
    sites?: { customerId: string; siteName: string }[]
  } | null>(null)

  // Schema-redigering
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null)

  // Faktureringssammanfattning vid "Färdig med etablering"
  const [establishmentSummary, setEstablishmentSummary] = useState<EstablishmentSummaryState | null>(null)
  const [finishingEstablishment, setFinishingEstablishment] = useState(false)

  // Borttagningsdialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    equipment: EquipmentPlacementWithRelations
  } | null>(null)
  const [deleteType, setDeleteType] = useState<'removed' | 'missing' | 'damaged' | 'permanent'>('removed')

  // Hämta tekniker-ID från profil
  const technicianId = profile?.technician_id || ''

  const customerParamHandled = useRef(false)

  // Cache för avtalsuppslag per kund (batch-placering, se handleFormSubmit)
  const resolvedContractCache = useRef<Map<string, string | null>>(new Map())

  // Beräkna statistik baserat på teknikerns placeringar
  const stats = useMemo(() => {
    const outdoorEquipment = allEquipment.filter(e => e.latitude && e.longitude)
    const byStatus: Record<string, number> = {}
    outdoorEquipment.forEach(e => {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1
    })

    // Räkna totalt antal stationer från alla kunder
    const totalIndoor = allCustomers.reduce((sum, c) => sum + c.indoor_count, 0)

    return {
      total: outdoorEquipment.length + totalIndoor,
      outdoor: outdoorEquipment.length,
      indoor: totalIndoor,
      byStatus,
      customerCount: allCustomers.length
    }
  }, [allEquipment, allCustomers])

  // Befintliga stationer för vald kund — visas på kartväljaren under placering
  const customerExistingStations = useMemo<ExistingStation[]>(() => {
    const cid = wizardCustomerId
    if (!cid) return []

    const customerStations = allEquipment.filter(
      e => e.customer_id === cid && e.latitude && e.longitude
    )

    const sorted = [...customerStations].sort((a, b) =>
      new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
    )

    return sorted.map((e, i) => ({
      id: e.id,
      latitude: e.latitude,
      longitude: e.longitude,
      number: i + 1,
      equipment_type: e.equipment_type,
      color: e.station_type_data?.color || undefined
    }))
  }, [allEquipment, wizardCustomerId])

  // Hämta alla teknikerns placeringar och kunder med stationer vid mount
  useEffect(() => {
    const fetchData = async () => {
      if (!technicianId) {
        setLoading(false)
        return
      }

      try {
        console.log('Hämtar all utrustning och kunder för tekniker:', technicianId)
        const [equipmentData, customerData] = await Promise.all([
          EquipmentService.getEquipmentByTechnician(technicianId),
          EquipmentService.getCustomerStationSummaries(technicianId)
        ])
        setAllEquipment(equipmentData)
        setAllCustomers(customerData)
      } catch (error) {
        console.error('Fel vid hämtning av utrustning:', error)
        toast.error('Kunde inte hämta utrustning')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [technicianId])

  // Hämta alla kunder för wizard/formulär
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customerList = await EquipmentService.getCustomersForDropdown()
        setCustomers(customerList)
      } catch (error) {
        console.error('Fel vid hämtning av kunder:', error)
      }
    }
    fetchCustomers()
  }, [])

  // ?customer=<id> i URL kommer från "Gå till utplacering" i etableringsärendet.
  // Beslut 2026-08-19: öppna ALLTID etableringswizarden med kunden förfylld —
  // teknikern kommer hit för att placera ut något, oavsett om kunden redan har stationer.
  useEffect(() => {
    const customerId = searchParams.get('customer')
    if (!customerId) return
    if (customerParamHandled.current) return
    customerParamHandled.current = true
    setWizardCustomerId(customerId)
    setIsWizardOpen(true)
  }, [searchParams])

  // Uppdatera utrustning i bakgrunden — blankar INTE sidan med spinner,
  // viktigt mitt i batch-placeringsflödet där refreshData anropas per station
  const refreshData = useCallback(async () => {
    if (!technicianId) return

    setRefreshing(true)
    try {
      const [equipmentData, customerData] = await Promise.all([
        EquipmentService.getEquipmentByTechnician(technicianId),
        EquipmentService.getCustomerStationSummaries(technicianId)
      ])
      setAllEquipment(equipmentData)
      setAllCustomers(customerData)
    } catch (error) {
      console.error('Fel vid uppdatering av utrustning:', error)
    } finally {
      setRefreshing(false)
    }
  }, [technicianId])

  // Hantera klick på FAB
  const handleFabClick = () => {
    setIsWizardOpen(true)
  }

  // Hantera wizard complete
  const handleWizardComplete = (customerId: string, type: 'outdoor' | 'indoor') => {
    setWizardCustomerId(customerId)
    setEditingEquipment(null)
    setPreviewPosition(null)
    setBatchCount(0)
    setBatchCustomerName(customers.find(c => c.id === customerId)?.company_name || '')
    setShowSuccessState(false)
    setFormResetKey(0)
    setLastEquipmentType(null)
    setLastUsedMap(false)
    setLastPreparation(null)
    setLastIsAddon(false)
    setIsFormOpen(true)
    // För inomhus hanteras det i modalen via IndoorEquipmentView
  }

  // Hantera kundklick i listan — navigera till kunddetaljsidan
  const handleOpenCustomerDetails = (customer: CustomerStationSummary) => {
    navigate(`/technician/equipment/customer/${customer.customer_id}`)
  }

  // Hantera ny placering
  const handleFormSubmit = async (formData: EquipmentFormData) => {
    const customerId = wizardCustomerId || formData.customer_id
    if (!customerId || !technicianId) {
      toast.error('Välj en kund först')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingEquipment) {
        // Uppdatera befintlig
        const result = await EquipmentService.updateEquipment(editingEquipment.id, {
          equipment_type: formData.equipment_type,
          serial_number: formData.serial_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          comment: formData.comment || null,
          status: formData.status,
          is_addon: formData.is_addon
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        // Ladda upp foto om nytt
        if (formData.photo) {
          const photoResult = await EquipmentService.uploadEquipmentPhoto(
            editingEquipment.id,
            formData.photo
          )
          if (!photoResult.success) {
            console.error('Foto kunde inte laddas upp:', photoResult.error)
          }
        }

        toast.success('Utrustning uppdaterad')
      } else {
        // Multi-kontrakt-refaktor (Fas 8d): auto-resolva contract_id från
        // kundens aktiva kontrakt. Vid >1 avtal väljs det första — admin kan
        // sedan flytta utrustning till rätt avtal via CustomerEquipmentDualView.
        // Synth-rader (id 'synth-...') sparas inte. Cachas per kund så
        // batch-placering inte gör samma avtalsuppslag för varje station.
        let resolvedContractId: string | null = null
        if (resolvedContractCache.current.has(customerId)) {
          resolvedContractId = resolvedContractCache.current.get(customerId) ?? null
        } else {
          try {
            const contracts = await ContractService.getActiveContracts(customerId)
            const real = contracts.filter(c => !c.id.startsWith('synth-'))
            resolvedContractId = real[0]?.id ?? null
          } catch {
            resolvedContractId = null
          }
          resolvedContractCache.current.set(customerId, resolvedContractId)
        }

        // Skapa ny
        const result = await EquipmentService.createEquipment({
          customer_id: customerId,
          contract_id: resolvedContractId,
          placed_by_technician_id: technicianId,
          equipment_type: formData.equipment_type,
          serial_number: formData.serial_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          comment: formData.comment || null,
          status: 'active',
          is_addon: formData.is_addon
        })

        if (!result.success || !result.equipment) {
          throw new Error(result.error)
        }

        // Ladda upp foto om valt
        if (formData.photo) {
          const photoResult = await EquipmentService.uploadEquipmentPhoto(
            result.equipment.id,
            formData.photo
          )
          if (!photoResult.success) {
            console.error('Foto kunde inte laddas upp:', photoResult.error)
          }
        }

        // Spara preparat + bakgrundssynka etableringsradens antal mot öppet etableringsärende
        if ((formData.preparation_id && formData.preparation_quantity) || formData.is_addon) {
          try {
            const { data: establishmentCase, error: caseError } = await supabase
              .from('cases')
              .select('id, created_at')
              .eq('customer_id', customerId)
              .eq('service_type', 'establishment')
              .not('status', 'ilike', '%avslutat%')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (caseError) throw caseError

            if (establishmentCase) {
              if (formData.preparation_id && formData.preparation_quantity) {
                await CasePreparationService.addPreparation({
                  case_id: establishmentCase.id,
                  case_type: 'contract',
                  preparation_id: formData.preparation_id,
                  quantity: formData.preparation_quantity,
                  unit: formData.preparation_unit || 'g',
                  applied_by_technician_id: profile?.technician_id || undefined,
                  applied_by_technician_name: profile?.full_name || profile?.email || undefined
                })
              }
            } else if (formData.preparation_id && formData.preparation_quantity) {
              toast.error('Inget öppet etableringsärende hittades — preparatet sparades inte på ärendet')
            }
          } catch (prepError) {
            console.error('Kunde inte uppdatera etableringsärendet vid placering:', prepError)
            toast.error('Placeringen sparades men etableringsärendet kunde inte uppdateras')
          }
        }

        // Bakgrundssynka tilläggsraden på öppet etableringsärende (RPC —
        // vikarie-säker, atomär, hittar ärendet själv). Ekonomi-fliken
        // speglar alltid verkligheten; "Färdig" blir en ren bekräftelse.
        if (formData.is_addon) {
          await AddonStationBillingService.syncAddonEstablishmentLine(
            customerId,
            technicianId || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (profile as any)?.full_name || profile?.email || null
          )
        }

        toast.success('Utrustning placerad!')
      }

      if (editingEquipment) {
        // Redigering — stäng formulär
        setIsFormOpen(false)
        setEditingEquipment(null)
        setPreviewPosition(null)
        setWizardCustomerId(null)
        setBatchCount(0)
        setBatchCustomerName('')
        await refreshData()
      } else {
        // Ny station — visa success-state för batch-placering
        const customerName = customers.find(c => c.id === customerId)?.company_name
          || allCustomers.find(c => c.customer_id === customerId)?.customer_name
          || ''
        setBatchCustomerName(customerName)
        setBatchCount(prev => prev + 1)
        setLastEquipmentType(formData.equipment_type)
        setLastUsedMap(true)
        setLastPreparation(
          formData.preparation_id
            ? { id: formData.preparation_id, quantity: formData.preparation_quantity ?? null, unit: formData.preparation_unit || 'g' }
            : null
        )
        setLastIsAddon(formData.is_addon)
        setShowSuccessState(true)
        setEditingEquipment(null)
        setPreviewPosition(null)
        // Behåll wizardCustomerId och isFormOpen!
        refreshData() // Uppdatera i bakgrunden (utan await)
      }
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara utrustning')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hantera borttagning. Borttagsregler: avtalsstationer (is_addon=false) kan
  // tekniker bara flytta eller markera försvunnen/skadad — "Borttagen" och
  // permanent radering är förbehållet tilläggsstationer (admin har full rätt
  // via sina egna vyer). Kontakta kontoret vid avtalsförändringar.
  const handleDeleteEquipment = (equipment: EquipmentPlacementWithRelations) => {
    setDeleteConfirm({ id: equipment.id, equipment })
    setDeleteType(equipment.is_addon ? 'removed' : 'missing')
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      if (deleteType === 'permanent') {
        const result = await EquipmentService.deleteEquipment(deleteConfirm.id)
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success('Utrustning permanent raderad')
      } else {
        const statusLabels = {
          removed: 'borttagen',
          missing: 'försvunnen',
          damaged: 'skadad'
        }
        const result = await EquipmentService.updateEquipmentStatus(
          deleteConfirm.id,
          deleteType,
          technicianId
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success(`Utrustning markerad som ${statusLabels[deleteType]}`)
      }

      // Synka NER tilläggsraden på öppet etableringsärende när en
      // tilläggsstation tas bort under pågående etablering
      if (deleteConfirm.equipment.is_addon) {
        await AddonStationBillingService.syncAddonEstablishmentLine(
          deleteConfirm.equipment.customer_id,
          technicianId || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (profile as any)?.full_name || profile?.email || null
        )
      }

      setDeleteConfirm(null)
      await refreshData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Kunde inte uppdatera utrustning')
    }
  }

  // Hantera GPS-fångst
  const handleLocationCapture = (lat: number, lng: number) => {
    setPreviewPosition({ lat, lng })
  }

  // Batch-placering: placera ytterligare en station
  const handlePlaceAnother = () => {
    setShowSuccessState(false)
    setEditingEquipment(null)
    setPreviewPosition(null)
    setFormResetKey(prev => prev + 1) // Tvinga ommontering av formuläret
  }

  // Byt till inomhusplacering från success-state
  const handleGoIndoor = () => {
    const customerId = wizardCustomerId
    setShowSuccessState(false)
    setIsFormOpen(false)
    setEditingEquipment(null)
    setPreviewPosition(null)
    if (customerId) {
      setWizardCustomerId(customerId)
      setWizardAutoIndoor(true)
      setIsWizardOpen(true)
    }
  }

  // Byt från inomhus till utomhus-placering (anropas från AddStationWizard)
  const handleSwitchToOutdoor = (customerId: string) => {
    setIsWizardOpen(false)
    setWizardAutoIndoor(false)
    setWizardCustomerId(customerId)
    setBatchCustomerName(customers.find(c => c.id === customerId)?.company_name || '')
    setShowSuccessState(false)
    setFormResetKey(prev => prev + 1)
    setIsFormOpen(true)
  }

  // Stäng etableringsärendet (RLS-verifierat: 0 uppdaterade rader = behörighet saknas)
  const closeEstablishmentCase = async (caseId: string): Promise<boolean> => {
    const { data: updatedRows, error: updateError } = await supabase
      .from('cases')
      .update({ status: 'Avslutat', completed_date: toLocalISOStringWithOffset() })
      .eq('id', caseId)
      .select('id')

    if (updateError || !updatedRows || updatedRows.length === 0) {
      console.error('Kunde inte avsluta etableringsärende:', updateError)
      toast.error('Etableringsärendet kunde inte avslutas — det kan vara tilldelat en annan tekniker')
      return false
    }
    return true
  }

  // Färdig med etablering (delad väg för utomhus- och inomhusflödet):
  // hämtar öppet etableringsärende, förifyller antal på etableringsraden från
  // tilläggsstationer placerade sedan ärendet öppnades (server-side räkning,
  // klarar flerdagarsetableringar) och visar faktureringssammanfattning när
  // det finns något att fakturera. Vid 0 kr och inga tilläggsstationer stängs
  // ärendet som tidigare utan faktureringsinfo.
  const finishEstablishment = async (customerId: string, customerName: string) => {
    const { data: openCase, error: openCaseError } = await supabase
      .from('cases')
      .select('id, created_at')
      .eq('customer_id', customerId)
      .eq('service_type', 'establishment')
      .not('status', 'ilike', '%avslutat%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openCaseError) {
      console.error('Kunde inte hämta etableringsärende:', openCaseError)
      toast.error('Kunde inte hämta etableringsärendet — status uppdaterades inte')
    }

    if (!openCase?.id) {
      refreshData()
      await checkAndPromptSchedule(customerId, customerName)
      return
    }

    // AVSLUTSSPÄRR (lärdom från BE-0008655): stäng ALDRIG etableringsärendet
    // tyst när inga stationer placerats sedan det öppnades. X-knappen på
    // placeringsformuläret går via denna väg — utan spärren stängdes ärendet
    // innan teknikern hunnit placera, och senare placeringar tappade tyst
    // både preparat- och faktureringskoppling.
    try {
      const placedTotal = await AddonStationBillingService.countStationsPlacedSince(
        customerId,
        openCase.created_at,
        false
      )
      if (placedTotal === 0) {
        const closeAnyway = window.confirm(
          'Inga stationer har placerats i denna etablering ännu.\n\nOK = avsluta etableringsärendet ändå.\nAvbryt = ärendet förblir öppet så du kan placera stationer senare.'
        )
        if (!closeAnyway) {
          toast('Etableringsärendet är fortfarande öppet — placera stationer och avsluta sedan', { icon: 'ℹ️' })
          refreshData()
          return
        }
      }
    } catch (err) {
      // Spärrkollen får inte blockera flödet — vid fel fortsätter vi som vanligt
      console.error('Kunde inte räkna placerade stationer för avslutsspärren:', err)
    }

    let serviceItems: EstablishmentSummaryState['serviceItems'] = []
    let addonItemId: string | null = null
    let addonCount = 0
    let priceDraft = 0
    let listPrice = 0
    let quantityDraft = 0
    try {
      // Synka tilläggsraden atomärt (RPC skapar/uppdaterar med färsk räkning)
      // så dialogen alltid visar verkligheten — även om bakgrundssynk missats
      const sync = await AddonStationBillingService.syncAddonEstablishmentLine(
        customerId,
        technicianId || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any)?.full_name || profile?.email || null
      )
      if (sync?.open_count && sync.open_count > 1) {
        toast('Obs: kunden har flera öppna etableringsärenden — kontrollera att rätt ärende stängs', { icon: '⚠️', duration: 8000 })
      }

      // Aktuellt listpris för den flaggade tjänsten (re-resolvas vid varje
      // dialogöppning — prislistan kan ha ändrats under en flerdagarsetablering)
      const service = await AddonStationBillingService.getAddonStationService()
      if (service) {
        const effective = await PriceListService.getEffectiveServicePrice(service.id, customerId)
        listPrice = effective?.price ?? service.base_price ?? 0
      }

      const items = await CaseBillingService.getCaseBillingItems(openCase.id, 'contract')
      const serviceRows = items.filter(i => i.item_type === 'service')
      serviceItems = serviceRows.map(i => ({
        id: i.id,
        name: i.service_name || i.article_name || 'Tjänst',
        quantity: i.quantity,
        unitPrice: i.discounted_price ?? i.unit_price
      }))
      // Tilläggsraden identifieras via markören — ALDRIG via namn
      // (namnmatchning träffar t.ex. "Avetablering avtal")
      const addonRow = serviceRows.find(i => i.is_addon_station_line === true)
      addonItemId = addonRow?.id || null
      addonCount = sync?.count ?? addonRow?.quantity ?? 0
      quantityDraft = addonRow?.quantity ?? 0
      const rowPrice = addonRow ? (addonRow.discounted_price ?? addonRow.unit_price) : 0
      priceDraft = rowPrice > 0 ? rowPrice : listPrice
    } catch (err) {
      // Sväljs INTE: utan underlag skulle ärendet stängas utan fakturering och
      // pending-raderna stranda osynligt i case_billing_items
      console.error('Kunde inte hämta faktureringsunderlag för etableringen:', err)
      toast.error('Kunde inte hämta faktureringsunderlaget — ärendet lämnas öppet. Försök igen eller kontakta kontoret.')
      return
    }

    const total = serviceItems.reduce((sum, i) =>
      sum + (i.id === addonItemId ? priceDraft * quantityDraft : i.unitPrice * i.quantity), 0)

    if (total <= 0 && addonCount === 0) {
      // Vanlig avtalsetablering utan tillägg: stäng som tidigare, ingen faktureringsinfo
      await closeEstablishmentCase(openCase.id)
      refreshData()
      await checkAndPromptSchedule(customerId, customerName)
      return
    }

    setEstablishmentSummary({
      caseId: openCase.id,
      customerId,
      customerName,
      serviceItems,
      addonItemId,
      addonCount,
      quantityDraft,
      priceDraft,
      listPrice
    })
  }

  // Bekräfta faktureringssammanfattningen: uppdatera antal, stäng ärendet och
  // kör faktureringskedjan (hoppar över faktura vid 0 kr — beslutat beteende)
  const confirmFinishEstablishment = async () => {
    if (!establishmentSummary) return
    const s = establishmentSummary
    setFinishingEstablishment(true)
    try {
      // Säkerställ att tilläggsraden finns (bakgrundssynk kan ha fallerat i fält)
      let addonItemId = s.addonItemId
      if (!addonItemId && s.quantityDraft > 0) {
        const sync = await AddonStationBillingService.syncAddonEstablishmentLine(
          s.customerId,
          technicianId || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (profile as any)?.full_name || profile?.email || null
        )
        addonItemId = sync?.row_id ?? null
      }

      // Uppdatera tilläggsradens antal och pris om något ändrats. Pris UNDER
      // listpris bokförs som rabatt (discount_percent + requires_approval) så
      // rabattgodkännande-flödet inte kan kringgås; pris uppåt är fritt.
      const originalRow = s.serviceItems.find(i => i.id === addonItemId)
      const priceChanged = !originalRow || originalRow.unitPrice !== s.priceDraft
      const qtyChanged = !originalRow || originalRow.quantity !== s.quantityDraft
      if (addonItemId && (priceChanged || qtyChanged)) {
        let unitPrice = s.priceDraft
        let discountPercent = 0
        if (s.listPrice > 0 && s.priceDraft < s.listPrice) {
          unitPrice = s.listPrice
          discountPercent = Math.round((1 - s.priceDraft / s.listPrice) * 10000) / 100
        }
        const { error } = await supabase
          .from('case_billing_items')
          .update({
            quantity: s.quantityDraft,
            unit_price: unitPrice,
            discount_percent: discountPercent,
            discounted_price: s.priceDraft,
            total_price: s.priceDraft * s.quantityDraft,
            requires_approval: discountPercent > 0
          })
          .eq('id', addonItemId)
        if (error) {
          console.error('Kunde inte uppdatera tilläggsraden:', error)
          toast.error('Tilläggsraden kunde inte uppdateras — kontrollera raden i ärendet')
        } else if (discountPercent > 0) {
          toast(`Priset ${s.priceDraft} kr är under listpriset ${s.listPrice} kr — raden går till rabattgodkännande`, { icon: 'ℹ️', duration: 8000 })
        }
      }

      const closed = await closeEstablishmentCase(s.caseId)

      if (closed) {
        // Fakturering i egen try/catch — får aldrig blockera avslutet
        try {
          const billing = await AddonStationBillingService.completeContractCaseBilling({
            caseId: s.caseId,
            customerId: s.customerId,
            technicianId: technicianId || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            technicianName: (profile as any)?.full_name || profile?.email || null,
            workPerformed: 'Etablering av stationer'
          })
          if (billing.invoiceError) {
            toast.error(`Fakturan kunde inte skapas: ${billing.invoiceError}. Raderna ligger kvar — kontoret fakturerar från Merförsäljning.`, { duration: 10000 })
          } else if (billing.itemsCreated > 0) {
            toast.success(`Etablering avslutad — ${billing.itemsCreated} rad(er) skickade till fakturering (${billing.totalAmount} kr)`)
          } else if (billing.skippedZeroTotal) {
            toast.success('Etablering avslutad. Raderna är 0 kr — ingen faktura skapades.')
          } else {
            toast.success('Etablering avslutad!')
          }
        } catch (billingErr) {
          console.error('Fakturering vid etableringsavslut misslyckades:', billingErr)
          toast.error('Faktureringen misslyckades — raderna ligger kvar, kontoret fakturerar från Merförsäljning.', { duration: 10000 })
        }
      }

      setEstablishmentSummary(null)
      refreshData()
      await checkAndPromptSchedule(s.customerId, s.customerName)
    } finally {
      setFinishingEstablishment(false)
    }
  }

  // Avsluta etablering från inomhusflödet
  const handleFinishEstablishmentFromIndoor = async (customerId: string) => {
    setIsWizardOpen(false)
    setWizardAutoIndoor(false)
    setWizardCustomerId(null)
    const name = customers.find(c => c.id === customerId)?.company_name
      || allCustomers.find(c => c.customer_id === customerId)?.customer_name
      || ''
    await finishEstablishment(customerId, name)
  }

  // Check om en kund saknar schema och visa prompt
  const checkAndPromptSchedule = async (customerId: string, customerName: string) => {
    try {
      const schedules = await getRecurringSchedulesByCustomer(customerId)
      const hasActive = schedules.some(s => s.status === 'active')
      if (!hasActive) {
        setSchedulePromptCustomerId(customerId)
        setSchedulePromptCustomerName(customerName)
        setShowSchedulePrompt(true)
      }
    } catch (e) {
      // Silently fail - don't block the user
    }
  }

  // Batch-placering: klar, stäng allt
  const handleFinishBatch = async () => {
    const finishedCustomerId = wizardCustomerId
    const finishedCustomerName = batchCustomerName

    setShowSuccessState(false)
    setIsFormOpen(false)
    setEditingEquipment(null)
    setOutdoorInspections([])
    setPreviewPosition(null)
    setWizardCustomerId(null)
    setBatchCount(0)
    setBatchCustomerName('')
    setLastEquipmentType(null)
    setLastUsedMap(false)
    setLastPreparation(null)
    setLastIsAddon(false)

    if (finishedCustomerId) {
      await finishEstablishment(finishedCustomerId, finishedCustomerName)
    }
  }

  // Hantera batch-schemaläggning från kundlistan
  const handleScheduleFromList = (targets: CustomerStationSummary[]) => {
    if (targets.length === 0) return

    const units: BatchScheduleUnit[] = targets.map(t => ({
      customerId: t.customer_id,
      customerName: t.customer_name,
      address: t.customer_address,
      durationMinutes: 60
    }))

    if (units.length === 1) {
      // Enkel kund — öppna wizard direkt
      setSchedulePromptCustomerId(units[0].customerId)
      setSchedulePromptCustomerName(units[0].customerName)
      setShowScheduleWizard(true)
    } else {
      // Batch — öppna wizard med alla enheter
      setBatchScheduleUnits(units)
      setSchedulePromptCustomerId(units[0].customerId)
      setSchedulePromptCustomerName(units[0].customerName)
      setShowScheduleWizard(true)
    }
  }

  // Hantera wizard completion
  const handleScheduleWizardComplete = (totalSessions: number) => {
    if (batchScheduleUnits.length > 1) {
      toast.success(`${totalSessions} kontrolltillfällen skapade för ${batchScheduleUnits.length} enheter`)
    }
    setBatchScheduleUnits([])
    setShowScheduleWizard(false)
    setSchedulePromptCustomerId(null)
  }

  // Hantera klick på karta — navigera till kundens detaljsida
  const handleEquipmentClick = (equipment: EquipmentPlacementWithRelations) => {
    if (equipment.customer_id) {
      navigate(`/technician/equipment/customer/${equipment.customer_id}`)
    }
  }

  return (
    <div className="text-white flex flex-col pb-24 md:pb-8">
      {/* Huvudinnehåll */}
      <div className="flex-grow max-w-screen-2xl mx-auto w-full p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500">
                <Wrench className="w-6 h-6 text-[#fff]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Utrustning</h1>
                <p className="text-slate-400 text-sm">Stationer, kunder och kontroller</p>
              </div>
            </div>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors w-full sm:w-auto disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>

          {/* Tabbar: Kunder / Karta / Kontroller */}
          <div className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700/50 rounded-xl mt-4 w-full sm:w-auto sm:inline-flex">
            {EQUIPMENT_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 sm:flex-none sm:px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.value
                    ? 'bg-[#20c58f] text-[#fff]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400">Laddar stationer och kunder...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab: Kunder — kompakt statistik + kundlista */}
            {activeTab === 'kunder' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Stationer totalt', value: stats.total },
                    { label: 'Utomhus', value: stats.outdoor },
                    { label: 'Inomhus', value: stats.indoor },
                    { label: 'Kunder', value: stats.customerCount }
                  ].map(s => (
                    <div key={s.label} className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                      <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                      <p className="text-xs text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Kunder med stationer
                  </h2>
                  <AllCustomersList
                    customers={allCustomers}
                    loading={loading}
                    onOpenCustomerDetails={handleOpenCustomerDetails}
                    onSchedule={(targets) => handleScheduleFromList(targets)}
                    onOpenSchedulePanel={(customerId, customerName, sites) => {
                      setSchedulePanelTarget({ customerId, customerName, sites })
                    }}
                  />
                </div>
              </>
            )}

            {/* Tab: Karta — statistik + karta över alla teknikerns stationer */}
            {activeTab === 'karta' && (
              <CollapsibleMapSection
                equipment={allEquipment}
                stats={stats}
                onEquipmentClick={handleEquipmentClick}
                defaultExpanded={true}
              />
            )}

            {/* Tab: Kontroller — överblick över inbokade stationskontroller */}
            {activeTab === 'kontroller' && (
              <InspectionOverviewTab
                technicianId={technicianId}
                customers={allCustomers}
                onOpenSchedulePanel={(customerId, customerName) => {
                  setSchedulePanelTarget({ customerId, customerName })
                }}
              />
            )}
          </div>
        )}

        {/* Wizard för att lägga till station */}
        <AddStationWizard
          isOpen={isWizardOpen}
          onClose={() => { setIsWizardOpen(false); setWizardAutoIndoor(false) }}
          onComplete={handleWizardComplete}
          technicianId={technicianId}
          preselectedCustomerId={wizardCustomerId}
          autoSelectIndoor={wizardAutoIndoor}
          onSwitchToOutdoor={handleSwitchToOutdoor}
          onFinishEstablishment={handleFinishEstablishmentFromIndoor}
          onIndoorFinished={(customerId) => {
            setWizardAutoIndoor(false)
            refreshData()
          }}
        />

        {/* Formulär-modal */}
        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-slate-900 rounded-t-2xl md:rounded-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {showSuccessState ? (
                  /* Success-state för batch-placering */
                  <div className="p-8 flex flex-col items-center text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4"
                    >
                      <Check className="w-8 h-8 text-emerald-400" />
                    </motion.div>

                    <h3 className="text-lg font-semibold text-white mb-1">
                      Station placerad!
                    </h3>
                    <p className="text-slate-400 text-sm mb-1">
                      {batchCustomerName}
                    </p>
                    <p className="text-slate-500 text-xs mb-6">
                      {batchCount} {batchCount === 1 ? 'station' : 'stationer'} placerade denna session
                    </p>

                    <div className="w-full space-y-3">
                      <button
                        onClick={handlePlaceAnother}
                        className="w-full py-3 px-4 bg-[#20c58f] hover:bg-[#1ab07f] text-[#fff] font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Placera fler utomhus
                      </button>
                      <button
                        onClick={handleGoIndoor}
                        className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Home className="w-5 h-5" />
                        Placera inomhus
                      </button>
                      <button
                        onClick={handleFinishBatch}
                        className="w-full py-3 px-4 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Färdig med etablering
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-700">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-white">
                          {editingEquipment ? 'Redigera utrustning' : 'Ny utrustningsplacering'}
                        </h2>
                        {batchCount > 0 && !editingEquipment && (
                          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                            Station #{batchCount + 1}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleFinishBatch}
                        className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    {/* Formulär */}
                    <div className="p-6">
                      <EquipmentPlacementForm
                        key={formResetKey}
                        customerId={wizardCustomerId || ''}
                        technicianId={technicianId}
                        existingEquipment={editingEquipment}
                        initialEquipmentType={lastEquipmentType || undefined}
                        autoShowMap={lastUsedMap}
                        initialPreparation={lastPreparation}
                        initialIsAddon={lastIsAddon}
                        existingStations={customerExistingStations}
                        inspections={editingEquipment ? outdoorInspections : []}
                        onSubmit={handleFormSubmit}
                        onCancel={handleFinishBatch}
                        onLocationCapture={handleLocationCapture}
                        isSubmitting={isSubmitting}
                        customers={customers}
                        onCustomerChange={(id) => setWizardCustomerId(id)}
                        showCustomerPicker={!editingEquipment && !wizardCustomerId}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Faktureringssammanfattning vid "Färdig med etablering" */}
        <AnimatePresence>
          {establishmentSummary && (() => {
            const s = establishmentSummary
            const total = s.serviceItems.reduce((sum, i) =>
              sum + (i.id === s.addonItemId ? s.priceDraft * s.quantityDraft : i.unitPrice * i.quantity), 0)
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Stäng ärende och skicka följande för fakturering
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">{s.customerName}</p>

                  {s.addonCount > 0 && (
                    <p className="text-xs text-violet-400 mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      {s.addonCount} tilläggsstation{s.addonCount === 1 ? '' : 'er'} placerade i denna etablering
                    </p>
                  )}

                  <div className="space-y-2 mb-3">
                    {s.serviceItems.map(item => {
                      const isEtablering = item.id === s.addonItemId
                      const qty = isEtablering ? s.quantityDraft : item.quantity
                      const price = isEtablering ? s.priceDraft : item.unitPrice
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/30 border border-slate-700 rounded-xl">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-200 truncate">{item.name}</p>
                            {isEtablering ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <input
                                  type="number"
                                  min={0}
                                  value={s.priceDraft}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value)
                                    setEstablishmentSummary(prev => prev
                                      ? { ...prev, priceDraft: Number.isFinite(v) && v >= 0 ? v : 0 }
                                      : prev)
                                  }}
                                  className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                                />
                                <span className="text-xs text-slate-400">kr/st</span>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">{item.unitPrice.toLocaleString('sv-SE')} kr/st</p>
                            )}
                          </div>
                          {isEtablering ? (
                            <input
                              type="number"
                              min={1}
                              value={s.quantityDraft}
                              onChange={(e) => {
                                const v = parseInt(e.target.value)
                                setEstablishmentSummary(prev => prev
                                  ? { ...prev, quantityDraft: Number.isFinite(v) && v > 0 ? v : 1 }
                                  : prev)
                              }}
                              className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                            />
                          ) : (
                            <span className="text-sm text-slate-300 tabular-nums">{qty} st</span>
                          )}
                          <span className="text-sm text-slate-200 tabular-nums w-20 text-right">
                            {(price * qty).toLocaleString('sv-SE')} kr
                          </span>
                        </div>
                      )
                    })}
                    {s.serviceItems.length === 0 && (
                      <p className="text-sm text-slate-400 px-1">Inga tjänsterader på ärendet.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-1 pb-3 border-b border-slate-700/50 mb-3">
                    <span className="text-sm font-medium text-slate-300">Totalt (exkl. moms)</span>
                    <span className="text-base font-semibold text-white tabular-nums">{total.toLocaleString('sv-SE')} kr</span>
                  </div>

                  {total <= 0 && (
                    <p className="text-xs text-amber-400 mb-3">
                      Totalen är 0 kr — ärendet stängs utan att någon faktura skapas.
                      {s.addonCount > 0 ? ' Ange pris per station ovan, eller lägg tilläggsstations-tjänsten i kundens avtalsprislista för automatiskt pris.' : ''}
                    </p>
                  )}
                  {s.listPrice > 0 && s.addonItemId && s.priceDraft < s.listPrice && (
                    <p className="text-xs text-amber-400 mb-3">
                      Priset är under listpriset ({s.listPrice.toLocaleString('sv-SE')} kr/st) — raden går till rabattgodkännande.
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEstablishmentSummary(null)
                        toast('Etableringsärendet är fortfarande öppet', { icon: 'ℹ️' })
                      }}
                      disabled={finishingEstablishment}
                      className="flex-1 px-4 py-3 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-60"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={confirmFinishEstablishment}
                      disabled={finishingEstablishment}
                      className="flex-1 px-4 py-3 rounded-xl bg-[#20c58f] hover:bg-[#1ab07f] text-[#fff] font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {finishingEstablishment && <Loader2 className="w-4 h-4 animate-spin" />}
                      {total > 0 ? 'Stäng & fakturera' : 'Stäng ärende'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )
          })()}
        </AnimatePresence>

        {/* Bekräftelse-dialog för borttagning */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Ta bort utrustning
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {deleteConfirm.equipment.serial_number
                        ? `Serienr: ${deleteConfirm.equipment.serial_number}`
                        : getEquipmentTypeLabel(deleteConfirm.equipment.equipment_type)}
                    </p>
                  </div>
                </div>

                {/* Val mellan statusar */}
                <div className="space-y-2 mb-6">
                  {/* Avtalsstationer kan inte tas bort av tekniker */}
                  {!deleteConfirm.equipment.is_addon && (
                    <p className="text-xs text-slate-400 px-1 pb-1">
                      Stationen ingår i avtalet och kan bara flyttas eller markeras
                      försvunnen/skadad. Kontakta kontoret om den ska tas bort.
                    </p>
                  )}
                  {/* Borttagen — endast tilläggsstationer */}
                  {deleteConfirm.equipment.is_addon && (
                  <button
                    onClick={() => setDeleteType('removed')}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      deleteType === 'removed'
                        ? 'border-slate-400 bg-slate-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        deleteType === 'removed' ? 'border-slate-400' : 'border-slate-600'
                      }`}>
                        {deleteType === 'removed' && (
                          <div className="w-2 h-2 rounded-full bg-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">Borttagen</p>
                        <p className="text-xs text-slate-400">Utrustning har plockats bort</p>
                      </div>
                    </div>
                  </button>
                  )}

                  {/* Försvunnen */}
                  <button
                    onClick={() => setDeleteType('missing')}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      deleteType === 'missing'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        deleteType === 'missing' ? 'border-amber-500' : 'border-slate-600'
                      }`}>
                        {deleteType === 'missing' && (
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">Försvunnen</p>
                        <p className="text-xs text-slate-400">Kunde inte hittas på platsen</p>
                      </div>
                    </div>
                  </button>

                  {/* Skadad */}
                  <button
                    onClick={() => setDeleteType('damaged')}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      deleteType === 'damaged'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        deleteType === 'damaged' ? 'border-red-500' : 'border-slate-600'
                      }`}>
                        {deleteType === 'damaged' && (
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">Skadad & ur funktion</p>
                        <p className="text-xs text-slate-400">Trasig, behöver bytas</p>
                      </div>
                    </div>
                  </button>

                  {/* Separator + permanent radering — endast tilläggsstationer */}
                  {deleteConfirm.equipment.is_addon && (
                  <>
                  <div className="border-t border-slate-700 my-3" />

                  <button
                    onClick={() => setDeleteType('permanent')}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      deleteType === 'permanent'
                        ? 'border-red-600 bg-red-600/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        deleteType === 'permanent' ? 'border-red-600' : 'border-slate-600'
                      }`}>
                        {deleteType === 'permanent' && (
                          <div className="w-2 h-2 rounded-full bg-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-red-400 text-sm">Radera permanent</p>
                        <p className="text-xs text-slate-400">Tas bort helt, kan ej återställas</p>
                      </div>
                    </div>
                  </button>
                  </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-3 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={confirmDelete}
                    className={`flex-1 px-4 py-3 rounded-xl text-white font-medium transition-colors ${
                      deleteType === 'permanent'
                        ? 'bg-red-600 hover:bg-red-700'
                        : deleteType === 'damaged'
                          ? 'bg-red-500 hover:bg-red-600'
                          : deleteType === 'missing'
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-slate-500 hover:bg-slate-600'
                    }`}
                  >
                    {deleteType === 'permanent' ? 'Radera' : 'Bekräfta'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lightbox för fullskärmsvisning av foto */}
        <AnimatePresence>
          {lightboxImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
              onClick={() => setLightboxImage(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
              >
                <img
                  src={lightboxImage}
                  alt="Utrustningsfoto"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
                <button
                  onClick={() => setLightboxImage(null)}
                  className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB-knapp för ny placering */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleFabClick}
        className="fixed bottom-24 lg:bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-600 transition-colors"
        style={{ touchAction: 'none' }}
      >
        <Plus className="w-8 h-8 text-white" />
      </motion.button>

      {/* Prompt: schedule recurring inspections after station placement */}
      <AnimatePresence>
        {showSchedulePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowSchedulePrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-semibold text-lg mb-2">Återkommande kontroller</h3>
              <p className="text-slate-400 text-sm mb-5">
                Vill du schemalägga återkommande kontroller för {schedulePromptCustomerName}?
                Du kan även göra detta senare under kundens schema-flik.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSchedulePrompt(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
                >
                  Senare
                </button>
                <button
                  onClick={() => {
                    setShowSchedulePrompt(false)
                    setShowScheduleWizard(true)
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#20c58f] hover:bg-[#1ab07f] text-[#fff] text-sm font-medium rounded-lg transition"
                >
                  Ja, schemalägg
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recurring Schedule Wizard */}
      {showScheduleWizard && schedulePromptCustomerId && (
        <RecurringScheduleWizard
          isOpen={showScheduleWizard}
          onClose={() => {
            setShowScheduleWizard(false)
            setSchedulePromptCustomerId(null)
            setBatchScheduleUnits([])
          }}
          onComplete={handleScheduleWizardComplete}
          customerId={schedulePromptCustomerId}
          customerName={schedulePromptCustomerName}
          technicianId={technicianId}
          batchUnits={batchScheduleUnits.length > 1 ? batchScheduleUnits : undefined}
          contractStartDate={allCustomers.find(c => c.customer_id === schedulePromptCustomerId)?.contract_start_date}
          contractEndDate={allCustomers.find(c => c.customer_id === schedulePromptCustomerId)?.contract_end_date}
        />
      )}

      {/* Schema-info panel (bottom sheet / sidopanel) */}
      <ScheduleInfoPanel
        isOpen={!!schedulePanelTarget}
        onClose={() => setSchedulePanelTarget(null)}
        customerId={schedulePanelTarget?.customerId ?? ''}
        customerName={schedulePanelTarget?.customerName ?? ''}
        siteCustomerIds={schedulePanelTarget?.sites}
        onEditSchedule={(scheduleId) => {
          setEditScheduleId(scheduleId)
        }}
      />

      {/* Schema-redigeringsmodal */}
      <EditScheduleModal
        isOpen={!!editScheduleId}
        onClose={() => setEditScheduleId(null)}
        onUpdated={() => {
          setEditScheduleId(null)
          // Re-open panel to refresh data
          if (schedulePanelTarget) {
            const target = { ...schedulePanelTarget }
            setSchedulePanelTarget(null)
            setTimeout(() => setSchedulePanelTarget(target), 100)
          }
        }}
        scheduleId={editScheduleId ?? ''}
      />
    </div>
  )
}

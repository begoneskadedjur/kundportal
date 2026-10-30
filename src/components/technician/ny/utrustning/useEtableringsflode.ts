// src/components/technician/ny/utrustning/useEtableringsflode.ts
//
// Etableringsflödet för nya arbetsvyns Utrustning: placera stationer
// (AddStationWizard: Kund, Typ, Placera), batch-placering utomhus och
// Färdig med etablering med faktureringssammanfattning.
//
// KOPIA, INTE OMSKRIVNING. Logiken är kopierad ordagrant från
// src/pages/technician/TechnicianEquipment.tsx (gamla sidan, orörd) eftersom
// den ligger inbakad som lokalt state i sidkomponenten och inte är exporterad:
//   - tilläggspriser per kund            TechnicianEquipment.tsx:170-194
//   - befintliga/andra kunders stationer TechnicianEquipment.tsx:250-294
//   - kundlistan till wizarden           TechnicianEquipment.tsx:330-341
//   - handleWizardComplete               TechnicianEquipment.tsx:380-396
//   - handleFormSubmit (skapa/redigera)  TechnicianEquipment.tsx:403-604
//   - handlePlaceAnother/GoIndoor/SwitchToOutdoor  TechnicianEquipment.tsx:611-642
//   - closeEstablishmentCase             TechnicianEquipment.tsx:644-667
//   - finishEstablishment                TechnicianEquipment.tsx:669-824
//   - confirmFinishEstablishment         TechnicianEquipment.tsx:826-927
//   - handleFinishEstablishmentFromIndoor TechnicianEquipment.tsx:929-938
//   - checkAndPromptSchedule             TechnicianEquipment.tsx:940-953
//   - handleFinishBatch                  TechnicianEquipment.tsx:955-977
//   - handleScheduleFromList/WizardComplete TechnicianEquipment.tsx:979-1012
// Samma servicefunktioner i samma ordning. Skillnader: tankstreck i
// toasttexterna är bytta mot punkt eller komma (svensk UI-standard), emoji-ikonerna
// i toasterna är borttagna, window.confirm-texten i avslutsspärren är oförändrad,
// och två ref-spärrar (avslutPagar, bekraftarPagar) hindrar att Färdig med
// etablering eller Stäng och fakturera körs två gånger parallellt (nya sidan har
// fler ingångar till avslutet än gamla). Krysset och Avbryt i Placera station stänger
// bara rutan (handleCloseSheet, 2026-10-24); gamla sidan avslutar etableringen där.
// Ändras gamla sidans fakturalogik ska den här filen ändras likadant.

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import type { EquipmentPlacementInsert, EquipmentPlacementWithRelations, EquipmentType } from '../../../../types/database'
import { EquipmentService, type CustomerStationSummary } from '../../../../services/equipmentService'
import { ContractService } from '../../../../services/contractService'
import type { FormData as EquipmentFormData } from '../../../shared/equipment/EquipmentPlacementForm'
import type { ExistingStation } from '../../../shared/equipment/MapLocationPicker'
import { getRecurringSchedulesByCustomer } from '../../../../services/recurringScheduleService'
import type { BatchScheduleUnit } from '../../../../types/recurringSchedule'
import { CasePreparationService } from '../../../../services/casePreparationService'
import type { PreparationUnit } from '../../../../types/casePreparations'
import { CaseBillingService } from '../../../../services/caseBillingService'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import type { AddonBillingModel, AddonPrices } from '../../../../types/addonStations'
import { hasNewAddons } from '../../../../types/addonStations'
import { useAddonLabourStep } from '../../../../hooks/useAddonLabourStep'
import { PriceListService } from '../../../../services/priceListService'
import { toLocalISOStringWithOffset } from '../../../../utils/dateHelpers'

// Faktureringssammanfattning vid "Färdig med etablering" (TechnicianEquipment.tsx:52-72).
// Tilläggsstationerna har en EGEN rad (markör is_addon_station_line, synkad
// via RPC) med den flaggade tjänsten. Etableringskostnad-raden (ärendets
// primärtjänst, 0 kr-norm) visas men rörs aldrig av denna logik.
export interface EstablishmentSummaryState {
  caseId: string
  customerId: string
  customerName: string
  serviceItems: { id: string; name: string; quantity: number; unitPrice: number; isAddonLabour?: boolean }[]
  addonItemId: string | null
  addonCount: number
  quantityDraft: number
  // Redigerbart pris (kr/st) på tilläggsraden, förifylls från radens pris
  // eller aktuellt listpris
  priceDraft: number
  // Aktuellt listpris (avtals-/kundprislista): pris under detta räknas som
  // rabatt och går genom rabattgodkännande-flödet
  listPrice: number
  // Systematisk avslutstext till ärendets work_report (fakturans Utfört arbete)
  workReport: string
}

export interface WizardCustomer {
  id: string
  company_name: string
  contact_address: string | null
}

interface Params {
  technicianId: string
  /** Teknikerns namn ur technicians-tabellen, aldrig e-postadressen */
  technicianName: string | null
  /** Alla stationer hos teknikerns kunder (oavsett Alla/Mina), för kartväljaren */
  fetchedEquipment: EquipmentPlacementWithRelations[]
  /** Kundsammanfattningarna (namn och avtalsdatum till schemawizarden) */
  allCustomers: CustomerStationSummary[]
  /** Uppdatera sidans data i bakgrunden */
  refreshData: () => void | Promise<void>
}

export function useEtableringsflode({ technicianId, technicianName, fetchedEquipment, allCustomers, refreshData }: Params) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentPlacementWithRelations | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customers, setCustomers] = useState<WizardCustomer[]>([])

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
  const [lastAddonModel, setLastAddonModel] = useState<AddonBillingModel | null>(null)
  // Produkten följer med i batchen (samma stationstyp per definition)
  const [lastArticleId, setLastArticleId] = useState<string | null>(null)
  // Priser för tilläggsstationer ur kundens prislista (laddas per kund i batchen)
  const [addonPrices, setAddonPrices] = useState<AddonPrices | null>(null)
  const [addonPricesLoading, setAddonPricesLoading] = useState(false)
  useEffect(() => {
    if (!wizardCustomerId) { setAddonPrices(null); return }
    let cancelled = false
    setAddonPricesLoading(true)
    const run = async () => {
      let typeId: string | null = null
      if (lastEquipmentType) {
        const { data } = await supabase
          .from('station_types')
          .select('id')
          .eq('code', lastEquipmentType)
          .maybeSingle()
        typeId = data?.id ?? null
      }
      const p = await AddonStationBillingService.getAddonPrices(wizardCustomerId, typeId)
      if (!cancelled) setAddonPrices(p)
    }
    run()
      .catch(() => { if (!cancelled) setAddonPrices(null) })
      .finally(() => { if (!cancelled) setAddonPricesLoading(false) })
    return () => { cancelled = true }
  }, [wizardCustomerId, lastEquipmentType])

  // Återkommande schema efter etablering
  const [showSchedulePrompt, setShowSchedulePrompt] = useState(false)
  const [schedulePromptCustomerId, setSchedulePromptCustomerId] = useState<string | null>(null)
  const [schedulePromptCustomerName, setSchedulePromptCustomerName] = useState('')
  const [showScheduleWizard, setShowScheduleWizard] = useState(false)

  // Batch-schemaläggning (från kundlistan)
  const [batchScheduleUnits, setBatchScheduleUnits] = useState<BatchScheduleUnit[]>([])

  // Faktureringssammanfattning vid "Färdig med etablering"
  const [establishmentSummary, setEstablishmentSummary] = useState<EstablishmentSummaryState | null>(null)
  const [finishingEstablishment, setFinishingEstablishment] = useState(false)
  // Arbetstid för att hantera tilläggen (bara vid nya per år/per månad-tillägg).
  // Pro rata-raderna synkas i finishEstablishment innan dialogen öppnas.
  const addonLabourStep = useAddonLabourStep({
    caseId: establishmentSummary?.caseId ?? null,
    enabled: !!establishmentSummary,
  })

  // Cache för avtalsuppslag per kund (batch-placering, se handleFormSubmit)
  const resolvedContractCache = useRef<Map<string, string | null>>(new Map())
  // Kunder där teknikern redan fått veta vilket av flera öppna
  // etableringsärenden stationerna kopplas till (visas en gång per kund)
  const flerArendenVisade = useRef<Set<string>>(new Set())

  // Befintliga stationer för vald kund, visas på kartväljaren under placering.
  // Läser ALLTID ur hela hämtningen, oavsett Alla/Mina: kollegans stationer
  // måste synas på kartan så man inte placerar ovanpå dem.
  const customerExistingStations = useMemo<ExistingStation[]>(() => {
    const cid = wizardCustomerId
    if (!cid) return []

    const customerStations = fetchedEquipment.filter(
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
      color: e.station_type_data?.color || undefined,
      icon: e.article?.icon ?? null
    }))
  }, [fetchedEquipment, wizardCustomerId])

  // Andra kunders stationer som kontext på kartväljaren: nedtonade, bara de
  // som ligger i kartvyn, och kan döljas med knappen på kartan.
  const otherCustomerStations = useMemo<ExistingStation[]>(() => {
    const cid = wizardCustomerId
    if (!cid) return []
    return fetchedEquipment
      .filter(e => e.customer_id !== cid && e.latitude && e.longitude && e.status !== 'removed')
      .map(e => ({
        id: e.id,
        latitude: e.latitude,
        longitude: e.longitude,
        number: 0,
        equipment_type: e.equipment_type,
        color: e.station_type_data?.color || undefined,
        customerName: e.customer?.company_name || undefined
      }))
  }, [fetchedEquipment, wizardCustomerId])

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

  const customerName = (customerId: string) =>
    customers.find(c => c.id === customerId)?.company_name
    || allCustomers.find(c => c.customer_id === customerId)?.customer_name
    || ''

  /**
   * Öppna wizarden. Med kund: förvald på kunden (samma som ?customer= och "Gå till utplacering").
   * null = välj kund i wizarden (knappen Placera station), utelämnad = behåll senaste kund.
   */
  const openWizard = (customerId?: string | null, indoor = false) => {
    if (customerId !== undefined) setWizardCustomerId(customerId)
    setWizardAutoIndoor(indoor)
    setIsWizardOpen(true)
  }

  const closeWizard = () => { setIsWizardOpen(false); setWizardAutoIndoor(false) }

  // Hantera wizard complete
  const handleWizardComplete = (customerId: string) => {
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
    setLastArticleId(null)
    setIsFormOpen(true)
    // För inomhus hanteras det i wizarden via planritningssteget
  }

  // Hantera ny placering (och redigering)
  const handleFormSubmit = async (formData: EquipmentFormData) => {
    // FormData saknar customer_id i typen (undefined i praktiken), kunden kommer från wizarden
    const customerId = wizardCustomerId || (formData as { customer_id?: string }).customer_id
    if (!customerId || !technicianId) {
      toast.error('Välj en kund först')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingEquipment) {
        // Typen skickas inte: den byts bara via Byt typ
        // (RPC change_station_type, som sätter station_type_id)
        const result = await EquipmentService.updateEquipment(editingEquipment.id, {
          serial_number: formData.serial_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          comment: formData.comment || null,
          status: formData.status,
          is_addon: formData.is_addon,
          addon_billing_model: formData.is_addon ? (formData.addon_billing_model ?? 'per_round') : null,
          article_id: formData.article_id ?? null
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        if (formData.photo) {
          const photoResult = await EquipmentService.uploadEquipmentPhoto(
            editingEquipment.id,
            formData.photo
          )
          if (!photoResult.success) {
            console.error('Foto kunde inte laddas upp:', photoResult.error)
          }
        }

        // Redigering ändrar tilläggsläget lika ofta som utsättningen gör:
        // markeras en befintlig station som tillägg i efterhand måste § 5
        // och pro rata följa med, annars ligger den osynlig till nästa synk.
        if (formData.is_addon || editingEquipment.is_addon) {
          const missing = await AddonStationBillingService.syncAfterStationChange(
            customerId,
            formData.is_addon ? formData.addon_billing_model : editingEquipment.addon_billing_model,
            technicianId || null,
            technicianName
          )
          const warning = AddonStationBillingService.priceMissingMessage(missing)
          if (warning) toast.error(warning, { duration: 8000 })
        }

        toast.success('Utrustning uppdaterad')
      } else {
        // Multi-kontrakt-refaktor (Fas 8d): auto-resolva contract_id från
        // kundens aktiva kontrakt. Vid >1 avtal väljs det första. Synth-rader
        // (id 'synth-...') sparas inte. Cachas per kund så batch-placering
        // inte gör samma avtalsuppslag för varje station.
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

        // Stationen kopplas till etableringsärendet den sätts ut på
        // (placed_case_id). Samma ärendeuppslag som preparatet nedan, nu före
        // utsättningen; fel här stoppar aldrig utsättningen.
        const behoverArende = !!((formData.preparation_id && formData.preparation_quantity) || formData.is_addon)
        const placering = behoverArende
          ? await AddonStationBillingService.findOpenEstablishmentCase(customerId)
          : null

        const result = await EquipmentService.createEquipment({
          customer_id: customerId,
          contract_id: resolvedContractId,
          placed_case_id: placering?.case?.id ?? null,
          placed_by_technician_id: technicianId,
          equipment_type: formData.equipment_type,
          serial_number: formData.serial_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          comment: formData.comment || null,
          status: 'active',
          is_addon: formData.is_addon,
          addon_billing_model: formData.is_addon ? (formData.addon_billing_model ?? 'per_round') : null,
          article_id: formData.article_id ?? null,
          // Preparat sparas även på stationen, kontrollflödet förväljer det
          preparation_id: formData.preparation_id || null,
          preparation_quantity: formData.preparation_quantity ?? null,
          preparation_unit: formData.preparation_id ? (formData.preparation_unit || 'g') : null
          // Samma fält som gamla sidan. Typen kräver status_updated_by och photo_path,
          // som databasen fyller själv, därför typas objektet här.
        } as EquipmentPlacementInsert)

        if (!result.success || !result.equipment) {
          throw new Error(result.error)
        }

        if (formData.photo) {
          const photoResult = await EquipmentService.uploadEquipmentPhoto(
            result.equipment.id,
            formData.photo
          )
          if (!photoResult.success) {
            console.error('Foto kunde inte laddas upp:', photoResult.error)
          }
        }

        // Spara preparat på öppet etableringsärende
        if (behoverArende) {
          try {
            if (placering?.error) throw placering.error
            const establishmentCase = placering?.case ?? null

            if (establishmentCase) {
              if (formData.preparation_id && formData.preparation_quantity) {
                await CasePreparationService.addPreparation({
                  case_id: establishmentCase.id,
                  case_type: 'contract',
                  preparation_id: formData.preparation_id,
                  quantity: formData.preparation_quantity,
                  unit: formData.preparation_unit || 'g',
                  applied_by_technician_id: technicianId || undefined,
                  applied_by_technician_name: technicianName ?? undefined
                })
              }
            } else if (formData.preparation_id && formData.preparation_quantity) {
              toast.error('Inget öppet etableringsärende hittades. Preparatet sparades inte på ärendet.')
            }
          } catch (prepError) {
            console.error('Kunde inte uppdatera etableringsärendet vid placering:', prepError)
            toast.error('Placeringen sparades men etableringsärendet kunde inte uppdateras')
          }
        }

        // Bakgrundssynka tilläggsraden på öppet etableringsärende (RPC,
        // vikarie-säker, atomär, hittar ärendet själv). Ekonomi-fliken
        // speglar alltid verkligheten; "Färdig" blir en ren bekräftelse.
        if (formData.is_addon) {
          const missing = await AddonStationBillingService.syncAfterStationChange(
            customerId,
            formData.addon_billing_model,
            technicianId || null,
            technicianName
          )
          const warning = AddonStationBillingService.priceMissingMessage(missing)
          if (warning) toast.error(warning, { duration: 8000 })
          const arendeText = AddonStationBillingService.placementCaseMessage(
            placering?.openCount ?? 0,
            placering?.case?.case_number
          )
          if (arendeText && !flerArendenVisade.current.has(customerId)) {
            flerArendenVisade.current.add(customerId)
            toast(arendeText, { duration: 8000 })
          }
        }

        toast.success('Utrustning placerad!')
      }

      if (editingEquipment) {
        setIsFormOpen(false)
        setEditingEquipment(null)
        setPreviewPosition(null)
        setWizardCustomerId(null)
        setBatchCount(0)
        setBatchCustomerName('')
        await refreshData()
      } else {
        // Ny station: visa klart-läget för batch-placering
        setBatchCustomerName(customerName(customerId))
        setBatchCount(prev => prev + 1)
        setLastEquipmentType(formData.equipment_type)
        setLastUsedMap(true)
        setLastPreparation(
          formData.preparation_id
            ? { id: formData.preparation_id, quantity: formData.preparation_quantity ?? null, unit: formData.preparation_unit || 'g' }
            : null
        )
        setLastIsAddon(formData.is_addon)
        setLastAddonModel(formData.is_addon ? formData.addon_billing_model : null)
        setLastArticleId(formData.article_id ?? null)
        setShowSuccessState(true)
        setEditingEquipment(null)
        setPreviewPosition(null)
        // Behåll wizardCustomerId och isFormOpen
        refreshData() // Uppdatera i bakgrunden (utan await)
      }
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara utrustning')
    } finally {
      setIsSubmitting(false)
    }
  }

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

  // Byt till inomhusplacering från klart-läget
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

  // Stäng etableringsärendet (RLS-verifierat: 0 uppdaterade rader = behörighet saknas).
  // workReport: systematisk avslutstext med Kommentar från tekniker. Fältet döljs för
  // teknikern i nya vyn (2026-10-26); finns redan text (t.ex. från kontoret) läggs
  // avslutstexten under, den skriver aldrig över.
  const closeEstablishmentCase = async (caseId: string, workReport?: string): Promise<boolean> => {
    // Klockan startade vid Framme i ärendet: räkna in tiden och stoppa den
    const { data: tidRad } = await supabase
      .from('cases')
      .select('work_started_at, time_spent_minutes')
      .eq('id', caseId)
      .maybeSingle()
    const klocka = tidRad?.work_started_at
      ? {
          work_started_at: null,
          time_spent_minutes: (tidRad.time_spent_minutes || 0)
            + Math.max(0, Math.floor((Date.now() - new Date(tidRad.work_started_at).getTime()) / 60000)),
        }
      : {}
    const { data: updatedRows, error: updateError } = await supabase
      .from('cases')
      .update({ status: 'Avslutat', completed_date: toLocalISOStringWithOffset(), ...klocka })
      .eq('id', caseId)
      .select('id, work_report')

    if (updateError || !updatedRows || updatedRows.length === 0) {
      console.error('Kunde inte avsluta etableringsärende:', updateError)
      toast.error('Etableringsärendet kunde inte avslutas. Det kan vara tilldelat en annan tekniker.')
      return false
    }

    if (workReport) {
      // Förra avslutets automatiska text (ärendet öppnat igen) ersätts
      const tidigare = (updatedRows[0] as { work_report?: string | null }).work_report?.trim() || ''
      const befintlig = /^Etablering: \d+ station/.test(tidigare) ? '' : tidigare
      const { error: reportError } = await supabase
        .from('cases')
        .update({ work_report: befintlig ? `${befintlig}\n\n${workReport}` : workReport })
        .eq('id', caseId)
      if (reportError) console.warn('Kunde inte skriva auto-arbetsrapport:', reportError)
    }
    return true
  }

  // Kolla om en kund saknar schema och visa frågan
  const checkAndPromptSchedule = async (customerId: string, name: string) => {
    try {
      const schedules = await getRecurringSchedulesByCustomer(customerId)
      const hasActive = schedules.some(s => s.status === 'active')
      if (!hasActive) {
        setSchedulePromptCustomerId(customerId)
        setSchedulePromptCustomerName(name)
        setShowSchedulePrompt(true)
      }
    } catch {
      // Får aldrig blockera teknikern
    }
  }

  // Färdig med etablering (delad väg för utomhus- och inomhusflödet):
  // hämtar öppet etableringsärende, förifyller antal på etableringsraden från
  // tilläggsstationer placerade sedan ärendet öppnades (server-side räkning,
  // klarar flerdagarsetableringar) och visar faktureringssammanfattning när
  // det finns något att fakturera. Vid 0 kr och inga tilläggsstationer stängs
  // ärendet som tidigare utan faktureringsinfo.
  // Spärr mot dubbelstart: rutan Pågående etablering, wizardens inomhusavslut och
  // formulärets X/Färdig går alla hit. Ett andra anrop medan ett pågår ignoreras,
  // så ärendet aldrig hämtas, synkas och stängs två gånger parallellt.
  // Kommentar från tekniker krävs (2026-10-26): utan kommentar öppnas frågan
  // (kommentarFraga, KommentarDialog i EtableringsFlode) och avslutet fortsätter därifrån.
  const avslutPagar = useRef(false)
  const [kommentarFraga, setKommentarFraga] = useState<{ customerId: string; name: string } | null>(null)
  const finishEstablishment = async (customerId: string, name: string, kommentar?: string) => {
    if (!kommentar?.trim()) {
      setKommentarFraga({ customerId, name })
      return
    }
    if (avslutPagar.current) return
    avslutPagar.current = true
    try {
      await finishEstablishmentInner(customerId, name, kommentar.trim())
    } finally {
      avslutPagar.current = false
    }
  }

  const finishEstablishmentInner = async (customerId: string, name: string, kommentar: string) => {
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
      toast.error('Kunde inte hämta etableringsärendet. Status uppdaterades inte.')
    }

    if (!openCase?.id) {
      refreshData()
      await checkAndPromptSchedule(customerId, name)
      return
    }

    // AVSLUTSSPÄRR (lärdom från BE-0008655): stäng ALDRIG etableringsärendet
    // tyst när inga stationer placerats sedan det öppnades.
    let placedTotal = 0
    try {
      placedTotal = await AddonStationBillingService.countStationsPlacedSince(
        customerId,
        openCase.created_at,
        false
      )
      if (placedTotal === 0) {
        const closeAnyway = window.confirm(
          'Inga stationer har placerats i denna etablering ännu.\n\nOK = avsluta etableringsärendet ändå.\nAvbryt = ärendet förblir öppet så du kan placera stationer senare.'
        )
        if (!closeAnyway) {
          toast('Etableringsärendet är fortfarande öppet. Placera stationer och avsluta sedan.')
          refreshData()
          return
        }
      }
    } catch (err) {
      // Spärrkollen får inte blockera flödet, vid fel fortsätter vi som vanligt
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
      // så dialogen alltid visar verkligheten, även om bakgrundssynk missats
      const sync = await AddonStationBillingService.syncAddonEstablishmentLine(
        customerId,
        technicianId || null,
        technicianName
      )
      // Per år/månad: § 5-rader på avtalet + pro rata-rad på ärendet
      await AddonStationBillingService.syncAddonPeriodLines(customerId)
      await AddonStationBillingService.syncAddonProrataLine(
        customerId,
        technicianId || null,
        technicianName
      )
      if (sync?.open_count && sync.open_count > 1) {
        toast('Obs: kunden har flera öppna etableringsärenden. Kontrollera att rätt ärende stängs.', { duration: 8000 })
      }

      // Aktuellt listpris för den flaggade tjänsten (re-resolvas vid varje
      // dialogöppning, prislistan kan ha ändrats under en flerdagarsetablering)
      const service = await AddonStationBillingService.getAddonStationService()
      if (service) {
        const effective = await PriceListService.getEffectiveServicePrice(service.id, customerId)
        listPrice = effective?.price ?? service.base_price ?? 0
      }

      const items = await CaseBillingService.getCaseBillingItems(openCase.id, 'contract')
      // Rader som ingår i avtalet (§ 4, covered_by_contract) faktureras aldrig
      // av avslutskedjan och ska inte heller visas eller räknas här
      const serviceRows = items.filter(i => i.item_type === 'service' && !i.covered_by_contract)
      serviceItems = serviceRows.map(i => ({
        id: i.id,
        name: i.service_name || i.article_name || 'Tjänst',
        quantity: i.quantity,
        unitPrice: i.discounted_price ?? i.unit_price,
        // Arbetstiden för tilläggen räknas av avslutssteget när det visas
        isAddonLabour: i.is_addon_labour_line === true
      }))
      // Tilläggsraden identifieras via markören, ALDRIG via namn
      // (namnmatchning träffar t.ex. "Avetablering avtal")
      const addonRow = serviceRows.find(i => i.is_addon_station_line === true)
      addonItemId = addonRow?.id || null
      addonCount = await AddonStationBillingService.countStationsPlacedSince(customerId, openCase.created_at, true)
      quantityDraft = addonRow?.quantity ?? 0
      const rowPrice = addonRow ? (addonRow.discounted_price ?? addonRow.unit_price) : 0
      priceDraft = rowPrice > 0 ? rowPrice : listPrice
    } catch (err) {
      // Sväljs INTE: utan underlag skulle ärendet stängas utan fakturering och
      // pending-raderna stranda osynligt i case_billing_items
      console.error('Kunde inte hämta faktureringsunderlag för etableringen:', err)
      toast.error('Kunde inte hämta faktureringsunderlaget. Ärendet lämnas öppet. Försök igen eller kontakta kontoret.')
      return
    }

    const total = serviceItems.reduce((sum, i) =>
      sum + (i.id === addonItemId ? priceDraft * quantityDraft : i.unitPrice * i.quantity), 0)

    // Systematisk arbetsrapport (fakturans "Utfört arbete")
    const workReport =
      `Etablering: ${placedTotal} station${placedTotal === 1 ? '' : 'er'} utplacerad${placedTotal === 1 ? '' : 'e'}` +
      (addonCount > 0
        ? `, varav ${addonCount} tilläggsstation${addonCount === 1 ? '' : 'er'} utöver avtal enligt överenskommelse med kund.`
        : '.') +
      `\nKommentar från tekniker: ${kommentar}`

    // Nya tillägg per år/per månad ska alltid få frågan om arbetstid
    let newAddons = false
    if (total <= 0 && addonCount === 0) {
      try {
        newAddons = hasNewAddons(await AddonStationBillingService.getCompletionSummary(openCase.id))
      } catch { /* underlaget får aldrig blockera avslutet */ }
    }

    if (total <= 0 && addonCount === 0 && !newAddons) {
      // Vanlig avtalsetablering utan tillägg: stäng som tidigare, ingen faktureringsinfo
      await closeEstablishmentCase(openCase.id, workReport)
      refreshData()
      await checkAndPromptSchedule(customerId, name)
      return
    }

    setEstablishmentSummary({
      caseId: openCase.id,
      customerId,
      customerName: name,
      serviceItems,
      addonItemId,
      addonCount,
      quantityDraft,
      priceDraft,
      listPrice,
      workReport
    })
  }

  // Bekräfta faktureringssammanfattningen: uppdatera antal, stäng ärendet och
  // kör faktureringskedjan (hoppar över faktura vid 0 kr, beslutat beteende)
  // Spärr mot dubbelklick på Stäng och fakturera innan knappen hunnit bli inaktiv,
  // så faktureringskedjan aldrig körs två gånger för samma ärende
  const bekraftarPagar = useRef(false)
  const confirmFinishEstablishment = async () => {
    if (!establishmentSummary || bekraftarPagar.current) return
    const s = establishmentSummary
    // Arbetstid för tilläggen: fel i valet stoppar här så teknikern kan rätta
    if (addonLabourStep.visible) {
      const labourError = addonLabourStep.validate()
      if (labourError) {
        toast.error(labourError)
        return
      }
    }
    bekraftarPagar.current = true
    setFinishingEstablishment(true)
    try {
      // Teknikerns timmar sparas som förslag FÖRE faktureringen så att
      // arbetstiden för resten av avtalets år kommer med på etableringsfakturan.
      // Fel här blockerar aldrig avslutet.
      if (addonLabourStep.visible) {
        const labour = await addonLabourStep.save()
        if (!labour.saved && labour.message) {
          toast.error(labour.message, { duration: 10000 })
        }
      }

      // Säkerställ att tilläggsraden finns (bakgrundssynk kan ha fallerat i fält)
      let addonItemId = s.addonItemId
      if (!addonItemId && s.quantityDraft > 0) {
        const sync = await AddonStationBillingService.syncAddonEstablishmentLine(
          s.customerId,
          technicianId || null,
          technicianName
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
          toast.error('Tilläggsraden kunde inte uppdateras. Kontrollera raden i ärendet.')
        } else if (discountPercent > 0) {
          toast(`Priset ${s.priceDraft} kr är under listpriset ${s.listPrice} kr. Raden går till rabattgodkännande.`, { duration: 8000 })
        }
      }

      const closed = await closeEstablishmentCase(s.caseId, s.workReport)

      if (closed) {
        // Fakturering i egen try/catch, får aldrig blockera avslutet
        try {
          const billing = await AddonStationBillingService.completeContractCaseBilling({
            caseId: s.caseId,
            customerId: s.customerId,
            technicianId: technicianId || null,
            technicianName: technicianName,
            workPerformed: s.workReport
          })
          if (billing.invoiceError) {
            toast.error(`Fakturan kunde inte skapas: ${billing.invoiceError}. Raderna ligger kvar och kontoret fakturerar från Merförsäljning.`, { duration: 10000 })
          } else if (billing.itemsCreated > 0) {
            toast.success(`Etablering avslutad. ${billing.itemsCreated} rad(er) skickade till fakturering (${billing.totalAmount} kr)`)
          } else if (billing.skippedZeroTotal) {
            toast.success('Etablering avslutad. Raderna är 0 kr, ingen faktura skapades.')
          } else {
            toast.success('Etablering avslutad!')
          }
        } catch (billingErr) {
          console.error('Fakturering vid etableringsavslut misslyckades:', billingErr)
          toast.error('Faktureringen misslyckades. Raderna ligger kvar och kontoret fakturerar från Merförsäljning.', { duration: 10000 })
        }
      }

      setEstablishmentSummary(null)
      refreshData()
      await checkAndPromptSchedule(s.customerId, s.customerName)
    } finally {
      bekraftarPagar.current = false
      setFinishingEstablishment(false)
    }
  }

  const cancelEstablishmentSummary = () => {
    setEstablishmentSummary(null)
    toast('Etableringsärendet är fortfarande öppet')
  }

  // Avsluta etablering från inomhusflödet
  const handleFinishEstablishmentFromIndoor = async (customerId: string) => {
    setIsWizardOpen(false)
    setWizardAutoIndoor(false)
    setWizardCustomerId(null)
    await finishEstablishment(customerId, customerName(customerId))
  }

  // Avsluta etablering direkt (rutan Pågående etablering). Samma väg som
  // handleFinishBatch utan att någon placering pågår i formuläret.
  const finishEstablishmentFor = async (customerId: string, name?: string, kommentar?: string) => {
    await finishEstablishment(customerId, name || customerName(customerId), kommentar)
  }

  // Frågan om Kommentar från tekniker (avslut från formuläret och inomhusflödet)
  const avbrytKommentar = () => setKommentarFraga(null)
  const bekraftaKommentar = async (kommentar: string) => {
    const fraga = kommentarFraga
    setKommentarFraga(null)
    if (fraga) await finishEstablishment(fraga.customerId, fraga.name, kommentar)
  }

  // Krysset och Avbryt i Placera station: stänger bara rutan (2026-10-24).
  // Etableringsärendet stängs aldrig här, bara med Färdig med etablering.
  const handleCloseSheet = () => {
    const placerade = batchCount
    nollstallPlacering()
    if (placerade > 0) {
      toast('Etableringen är fortfarande öppen. Avsluta den med Färdig med etablering i rutan Pågående etablering när du är klar.')
    }
  }

  const nollstallPlacering = () => {
    setShowSuccessState(false)
    setIsFormOpen(false)
    setEditingEquipment(null)
    setPreviewPosition(null)
    setWizardCustomerId(null)
    setBatchCount(0)
    setBatchCustomerName('')
    setLastEquipmentType(null)
    setLastUsedMap(false)
    setLastPreparation(null)
    setLastIsAddon(false)
    setLastArticleId(null)
  }

  // Batch-placering: klar, stäng allt
  const handleFinishBatch = async () => {
    const finishedCustomerId = wizardCustomerId
    const finishedCustomerName = batchCustomerName

    setShowSuccessState(false)
    setIsFormOpen(false)
    setEditingEquipment(null)
    setPreviewPosition(null)
    setWizardCustomerId(null)
    setBatchCount(0)
    setBatchCustomerName('')
    setLastEquipmentType(null)
    setLastUsedMap(false)
    setLastPreparation(null)
    setLastIsAddon(false)
    setLastArticleId(null)

    if (finishedCustomerId) {
      await finishEstablishment(finishedCustomerId, finishedCustomerName)
    }
  }

  // Batch-schemaläggning från kundlistan
  const handleScheduleFromList = (targets: CustomerStationSummary[]) => {
    if (targets.length === 0) return

    const units: BatchScheduleUnit[] = targets.map(t => ({
      customerId: t.customer_id,
      customerName: t.customer_name,
      address: t.customer_address,
      durationMinutes: 60
    }))

    if (units.length === 1) {
      setSchedulePromptCustomerId(units[0].customerId)
      setSchedulePromptCustomerName(units[0].customerName)
      setShowScheduleWizard(true)
    } else {
      setBatchScheduleUnits(units)
      setSchedulePromptCustomerId(units[0].customerId)
      setSchedulePromptCustomerName(units[0].customerName)
      setShowScheduleWizard(true)
    }
  }

  const handleScheduleWizardComplete = (totalSessions: number) => {
    if (batchScheduleUnits.length > 1) {
      toast.success(`${totalSessions} kontrolltillfällen skapade för ${batchScheduleUnits.length} enheter`)
    }
    setBatchScheduleUnits([])
    setShowScheduleWizard(false)
    setSchedulePromptCustomerId(null)
  }

  const closeScheduleWizard = () => {
    setShowScheduleWizard(false)
    setSchedulePromptCustomerId(null)
    setBatchScheduleUnits([])
  }

  return {
    technicianId,
    customers,
    // wizard
    isWizardOpen, wizardCustomerId, wizardAutoIndoor, openWizard, closeWizard, setWizardCustomerId,
    setWizardAutoIndoor, handleWizardComplete, handleSwitchToOutdoor, handleFinishEstablishmentFromIndoor,
    // formulär
    isFormOpen, editingEquipment, isSubmitting, showSuccessState, formResetKey, batchCount, batchCustomerName,
    lastEquipmentType, lastUsedMap, lastPreparation, lastIsAddon, lastAddonModel, lastArticleId,
    addonPrices, addonPricesLoading, customerExistingStations, otherCustomerStations, previewPosition,
    handleFormSubmit, handleLocationCapture, handlePlaceAnother, handleGoIndoor, handleFinishBatch, handleCloseSheet,
    // avslut
    establishmentSummary, setEstablishmentSummary, finishingEstablishment, addonLabourStep,
    confirmFinishEstablishment, cancelEstablishmentSummary, finishEstablishmentFor,
    kommentarFraga, avbrytKommentar, bekraftaKommentar,
    // schema
    showSchedulePrompt, setShowSchedulePrompt, schedulePromptCustomerId, schedulePromptCustomerName,
    showScheduleWizard, setShowScheduleWizard, batchScheduleUnits, handleScheduleFromList,
    handleScheduleWizardComplete, closeScheduleWizard,
  }
}

export type Etableringsflode = ReturnType<typeof useEtableringsflode>

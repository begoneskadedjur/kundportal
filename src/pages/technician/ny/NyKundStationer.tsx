// src/pages/technician/ny/NyKundStationer.tsx
// Kundens stationer i nya arbetsvyn: /technician/equipment/customer/:customerId
// Layout (skisserna KundStationerDator, KundStationerLista, KundStationerMobil):
//  Dator  kundhuvud med Stationskarta PDF och Placera ny station, kartan med
//         listan i en kolumn bredvid. Vald station (på kartan eller i listan)
//         fälls ut till arket i listan och markeras blå på kartan. Fliken Lista
//         är tabeller per plats (ute och varje planritning), arket står till höger.
//  Telefon som förut: kartan och arket nedifrån.
// (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx). Gamla
// TechnicianCustomerStationsPage.tsx och CustomerStationsModal.tsx är orörda.
//
// ─── INVENTERING: gamla kundsidans funktioner och var de finns här ───────────
// TechnicianCustomerStationsPage.tsx
//  Kunden hämtas (identitet, multisite, avtalsdatum)          → här, samma select
//  Kunden hittades inte + Till kundlistan                     → här, tomt läge
//  Tillbaka till Utrustning (nu Stationer)                    → här, ikonknapp överst
//  ?tab=outdoor|indoor|schedule styr startfliken              → här, outdoor=Karta, indoor=Planritning,
//                                                               schedule=Schema (nya värden karta|lista|planritning|schema går också)
//  Lägg till station → /technician/equipment?customer=<id>    → här, Placera ny station öppnar wizarden förvald
//                                                               på kunden direkt på sidan (samma EtableringsFlode)
// CustomerStationsModal.tsx (page-läge)
//  Ring, Mejla, Navigera                                      → här, sidhuvudets knappar
//  Hälsa (andel stationer med avvikelse)                      → här, statusrad i sidhuvudet
//  Flikar Utomhus/Inomhus/Schema med antal                    → Vaxel Karta/Lista/Planritning/Schema
//  Utomhuskarta med nummer, klick öppnar stationen            → Karta (EquipmentMap, isolerad behållare)
//  Utomhus- och inomhuslistor                                 → Lista (en lista, ute och per planritning)
//  Utomhusdetalj (EquipmentDetailSheet) + historik            → StationArk (Historik i verktygsraden)
//  Redigera utomhus (EquipmentPlacementForm, updateEquipment, foto, syncAfterStationChange)
//                                                             → Ändra uppgifter, kopia av CustomerStationsModal.tsx:1144-1188
//  Inomhusdetalj (IndoorStationDetailSheet) + historik        → StationArk
//  Redigera inomhus (IndoorStationForm, updateStation) och Ta bort med regler
//    (avtalsstation nekas, betald tilläggsstation kräver andra klick)
//                                                             → Ändra uppgifter, kopia av CustomerStationsModal.tsx:1038-1082
//  Byt typ (onTypeChanged i formulären, RPC change_station_type) → Byt typ i StationArk (ChangeStationTypeModal)
//                                                               och kvar i Ändra uppgifter
//  Planritningar med markörer                                 → Planritning (FloorPlanViewer)
//  Ladda upp planritning, Byt bild, Ta bort planritning       → Planritning, kopia av CustomerStationsModal.tsx:320-353, 385-408
//  Inomhusplacering på planritning (typ → klick → formulär)   → Placera på planritning öppnar wizarden i inomhusläge
//                                                               (AddStationWizard, som också sparar preparat och synkar tillägg)
//  Schema: RecurringScheduleManagement + RecurringScheduleWizard → Schema
// NYTT
//  Flytta ute och inne (RelocateBar via EquipmentMap/FloorPlanViewer), kopia av
//    StationInspectionPanel.tsx:1137-1180                       → StationArk Flytta
//  Hämta upp tilläggsstation med betald-spärr                  → StationArk Hämta upp
//  Stationskarta-PDF (api/generate-station-map-pdf)            → sidhuvudets knapp
//  Pågående etablering hos kunden med Färdig med etablering   → överst när den finns
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import type { EquipmentPlacementWithRelations } from '../../../types/database'
import type {
  CreateFloorPlanInput,
  FloorPlanWithRelations,
  IndoorStationInspectionWithRelations,
  IndoorStationWithRelations,
  UpdateIndoorStationInput,
} from '../../../types/indoor'
import type { OutdoorInspectionWithRelations } from '../../../types/inspectionSession'
import type { AddonPrices } from '../../../types/addonStations'
import { EquipmentService, type CustomerStationSummary } from '../../../services/equipmentService'
import { FloorPlanService, ALLOWED_FLOOR_PLAN_TYPES } from '../../../services/floorPlanService'
import { IndoorStationService } from '../../../services/indoorStationService'
import { AddonStationBillingService } from '../../../services/addonStationBillingService'
import { StationMapService } from '../../../services/stationMapService'
import { getOutdoorInspectionsByStation } from '../../../services/inspectionSessionService'
import { numberStations } from '../../../shared/stationNumbering'
import { isGuardedAddonStation } from '../../../hooks/useAddonRemovalGuard'
import { calculateHealthStatusWithPercentage } from '../../../components/shared/StationHealthBadge'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { EquipmentMap } from '../../../components/shared/equipment/EquipmentMap'
import { EquipmentPlacementForm, type FormData as EquipmentFormData } from '../../../components/shared/equipment/EquipmentPlacementForm'
import { FloorPlanViewer } from '../../../components/shared/indoor/FloorPlanViewer'
import { FloorPlanUploadForm } from '../../../components/shared/indoor/FloorPlanUploadForm'
import { IndoorStationForm } from '../../../components/shared/indoor/IndoorStationForm'
import StationTypeTile from '../../../components/shared/stations/StationTypeTile'
import { ChangeStationTypeModal } from '../../../components/shared/stations/ChangeStationTypeSheet'
import { RecurringScheduleManagement } from '../../../components/technician/RecurringScheduleManagement'
import { RecurringScheduleWizardWithContract as RecurringScheduleWizard } from '../../../components/technician/RecurringScheduleWizardWithContract'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { StatusPunkt } from '../../../components/technician/ny/besokUi'
import { navigeraUrl, telUrl } from '../../../services/teknikerDagService'
import { Vaxel } from '../../../components/technician/ny/utrustning/Vaxel'
import { StationArk, type ValdStation } from '../../../components/technician/ny/utrustning/StationArk'
import { PagaendeEtablering } from '../../../components/technician/ny/utrustning/PagaendeEtablering'
import { usePagaendeEtableringar } from '../../../components/technician/ny/utrustning/usePagaendeEtableringar'
import { EtableringsFlode } from '../../../components/technician/ny/utrustning/EtableringsFlode'
import { useEtableringsflode } from '../../../components/technician/ny/utrustning/useEtableringsflode'
import { useSenasteKontroller } from '../../../components/technician/ny/utrustning/useSenasteKontroller'
import { useArDator } from '../../../components/technician/ny/arenden/useArDator'
import {
  IKONKNAPP, KNAPP_PRIMAR, KNAPP_SEKUNDAR, KORT, RADKNAPP, antalText, datum, halsa, stationStatus, typInfo,
} from '../../../components/technician/ny/utrustning/utrustningUi'

type Flik = 'karta' | 'lista' | 'planritning' | 'schema'

function flikUrUrl(v: string | null): Flik | null {
  switch (v) {
    case 'outdoor': case 'karta': return 'karta'
    case 'indoor': case 'planritning': return 'planritning'
    case 'schedule': case 'schema': return 'schema'
    case 'lista': return 'lista'
    default: return null
  }
}

interface Kontakt {
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
}

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Placera ny station', text: 'Öppnar placeringen direkt på den här kunden. Välj ute eller inne och sätt ut stationen.', mal: 'kund-placera' },
  { rubrik: 'Karta, Lista, Planritning och Schema', text: 'Karta visar stationerna ute. Lista visar alla. Planritning visar stationerna inne. Schema visar kontrollerna.', mal: 'kund-flikar' },
  { rubrik: 'Tryck på en station', text: 'På kartan eller i listan. Då kan du flytta den, byta typ, se historiken och hämta upp tilläggsstationer. På datorn fälls den ut i listan bredvid kartan.', mal: 'kund-innehall' },
  { rubrik: 'Stationskarta', text: 'Laddar ned stationskartan som PDF, samma som kunden kan ta ut i sin portal.', mal: 'kund-pdf' },
]

export default function NyKundStationer() {
  const { customerId = '' } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useAuth()
  const technicianId = profile?.technician_id || ''
  const technicianName = profile?.technicians?.name?.trim() || null

  const [kund, setKund] = useState<CustomerStationSummary | null>(null)
  const [kontakt, setKontakt] = useState<Kontakt | null>(null)
  const [laddar, setLaddar] = useState(true)
  const [hittades, setHittades] = useState(true)
  const [ute, setUte] = useState<EquipmentPlacementWithRelations[]>([])
  const [inne, setInne] = useState<IndoorStationWithRelations[]>([])
  const [planer, setPlaner] = useState<FloorPlanWithRelations[]>([])
  const [valdPlanId, setValdPlanId] = useState<string | null>(null)
  const [planStationer, setPlanStationer] = useState<IndoorStationWithRelations[]>([])
  const [allaTeknikerStationer, setAllaTeknikerStationer] = useState<EquipmentPlacementWithRelations[]>([])
  const [visaUpphamtade, setVisaUpphamtade] = useState(false)
  const [visaMig, setVisaMig] = useState(false)
  const [pdfLaddar, setPdfLaddar] = useState(false)
  const [addonPrices, setAddonPrices] = useState<AddonPrices | null>(null)
  const [addonPricesLoading, setAddonPricesLoading] = useState(false)

  // Station som är vald, flyttas, byter typ eller ändras
  const [vald, setVald] = useState<ValdStation | null>(null)
  const [flyttar, setFlyttar] = useState<ValdStation | null>(null)
  const [bytTyp, setBytTyp] = useState<ValdStation | null>(null)
  const [andrar, setAndrar] = useState<ValdStation | null>(null)
  const [andrarHistorik, setAndrarHistorik] = useState<{ ute: OutdoorInspectionWithRelations[]; inne: IndoorStationInspectionWithRelations[] }>({ ute: [], inne: [] })
  const [sparar, setSparar] = useState(false)
  const [visaUppladdning, setVisaUppladdning] = useState(false)
  const [visaSchemaWizard, setVisaSchemaWizard] = useState(false)
  const [schemaNyckel, setSchemaNyckel] = useState(0)
  const [byterBild, setByterBild] = useState(false)
  const bytBildRef = useRef<HTMLInputElement>(null)
  const ytaRef = useRef<HTMLDivElement>(null)

  // ── Hämtning ──
  useEffect(() => {
    if (!customerId) return
    let avbruten = false
    const run = async () => {
      setLaddar(true)
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_address, organization_number, organization_id, parent_customer_id, is_multisite, site_type, site_name, contract_start_date, contract_end_date, contact_person, contact_email, contact_phone')
        .eq('id', customerId)
        .single()
      if (avbruten) return
      if (error || !data) { setHittades(false); setLaddar(false); return }
      setHittades(true)
      setKontakt({ contact_person: data.contact_person, contact_email: data.contact_email, contact_phone: data.contact_phone, contact_address: data.contact_address })
      setKund({
        customer_id: data.id,
        customer_name: data.company_name,
        customer_address: data.contact_address,
        organization_number: data.organization_number,
        outdoor_count: 0, indoor_count: 0, own_outdoor_count: 0, own_indoor_count: 0,
        technician_names: [], health_status: 'excellent', latest_inspection_date: null, latest_inspector_name: null,
        organization_id: data.organization_id,
        parent_customer_id: data.parent_customer_id,
        is_multisite: data.is_multisite || false,
        site_type: data.site_type,
        site_name: data.site_name,
        contract_start_date: data.contract_start_date,
        contract_end_date: data.contract_end_date,
      })
    }
    run().catch(e => { console.error('Kunde inte hämta kunden:', e); if (!avbruten) setHittades(false) })
    return () => { avbruten = true }
  }, [customerId])

  const laddaStationer = useCallback(async () => {
    if (!customerId) return
    try {
      const [{ outdoor, indoor }, planLista] = await Promise.all([
        EquipmentService.getStationsByCustomer(customerId),
        FloorPlanService.getFloorPlansByCustomer(customerId).catch(e => {
          console.error('Fel vid hämtning av planritningar:', e)
          return [] as FloorPlanWithRelations[]
        }),
      ])
      setUte(outdoor)
      setInne(indoor as IndoorStationWithRelations[])
      setPlaner(planLista)
      setValdPlanId(prev => (prev && planLista.some(p => p.id === prev) ? prev : planLista[0]?.id ?? null))
    } catch (e) {
      console.error('Fel vid laddning av kunddata:', e)
      toast.error('Kunde inte ladda kundens stationer')
    } finally {
      setLaddar(false)
    }
  }, [customerId])

  useEffect(() => { void laddaStationer() }, [laddaStationer])

  const laddaPlan = useCallback(async (planId: string | null) => {
    if (!planId) { setPlanStationer([]); return }
    try {
      setPlanStationer(await IndoorStationService.getStationsByFloorPlan(planId))
    } catch (e) {
      console.error('Fel vid hämtning av stationer för planritning:', e)
    }
  }, [])
  useEffect(() => { void laddaPlan(valdPlanId) }, [valdPlanId, laddaPlan])

  // Alla stationer hos teknikerns kunder, för kartväljaren i placeringen
  const laddaTeknikerStationer = useCallback(async () => {
    if (!technicianId) return
    try { setAllaTeknikerStationer(await EquipmentService.getEquipmentByTechnician(technicianId)) } catch { /* bara kontext på kartan */ }
  }, [technicianId])
  useEffect(() => { void laddaTeknikerStationer() }, [laddaTeknikerStationer])

  // Tilläggspriser till Ändra uppgifter (modellväljaren behöver dem)
  useEffect(() => {
    if (!customerId) return
    let avbruten = false
    setAddonPricesLoading(true)
    AddonStationBillingService.getAddonPrices(customerId)
      .then(p => { if (!avbruten) setAddonPrices(p) })
      .catch(() => { if (!avbruten) setAddonPrices(null) })
      .finally(() => { if (!avbruten) setAddonPricesLoading(false) })
    return () => { avbruten = true }
  }, [customerId])

  const pagaende = usePagaendeEtableringar(technicianId)
  const laddaPagaende = pagaende.ladda
  const kundensEtablering = pagaende.rader.filter(r => r.customerId === customerId)

  const laddaOm = useCallback(async () => {
    await laddaStationer()
    await laddaPlan(valdPlanId)
    void laddaTeknikerStationer()
    void laddaPagaende()
  }, [laddaStationer, laddaPlan, valdPlanId, laddaTeknikerStationer, laddaPagaende])

  const kundLista = useMemo(() => (kund ? [kund] : []), [kund])
  const flode = useEtableringsflode({
    technicianId, technicianName, fetchedEquipment: allaTeknikerStationer, allCustomers: kundLista, refreshData: laddaOm,
  })

  // ── Härledda värden ──
  const aktivaUte = useMemo(() => ute.filter(s => s.status !== 'removed'), [ute])
  const aktivaInne = useMemo(() => inne.filter(s => s.status !== 'removed'), [inne])
  const uteNummer = useMemo(() => numberStations(ute), [ute])
  const inneNummer = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of planer) numberStations(inne.filter(s => s.floor_plan_id === p.id)).forEach((n, id) => m.set(id, n))
    return m
  }, [inne, planer])
  const valdPlan = planer.find(p => p.id === valdPlanId) ?? null
  const upphamtade = ute.length + inne.length - aktivaUte.length - aktivaInne.length
  const halsoInfo = calculateHealthStatusWithPercentage([...aktivaUte, ...aktivaInne])
  const h = halsa(halsoInfo.status)

  const urlFlik = flikUrUrl(searchParams.get('tab'))
  const flik: Flik = urlFlik ?? (aktivaUte.length === 0 && aktivaInne.length > 0 ? 'planritning' : 'karta')
  const setFlik = (f: Flik) => {
    // Ett valt ark hör till fliken det öppnades i
    if (f !== flik) setVald(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', f); return n }, { replace: true })
  }

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: kund?.customer_name, onVisaMig: oppnaVisaMig })

  const nummerFor = (v: ValdStation | null) => (v ? (v.typ === 'ute' ? uteNummer.get(v.station.id) : inneNummer.get(v.station.id)) ?? null : null)
  const planNamnFor = (v: ValdStation | null) => (v?.typ === 'inne' ? planer.find(p => p.id === v.station.floor_plan_id)?.name ?? null : null)
  const antalPaPlatsen = (v: ValdStation | null) => (!v ? undefined : v.typ === 'ute'
    ? aktivaUte.length
    : aktivaInne.filter(s => s.floor_plan_id === v.station.floor_plan_id).length)

  // Dator: arket fälls ut i listan bredvid kartan (ute) eller står till höger
  // om tabellerna (Lista). Telefon och planritningen: arket som förut.
  const arDator = useArDator()
  const inlineArk = arDator && !!vald && ((flik === 'karta' && vald.typ === 'ute') || flik === 'lista')

  // Senaste kontroll per station i fliken Lista
  const uteIds = useMemo(() => ute.map(s => s.id), [ute])
  const inneIds = useMemo(() => inne.map(s => s.id), [inne])
  const senasteKontroll = useSenasteKontroller(uteIds, inneIds, flik === 'lista')

  // Listan bredvid kartan följer valet: den valda raden rullas fram
  const listaRef = useRef<HTMLUListElement>(null)
  const valdId = vald?.station.id
  useEffect(() => {
    if (!valdId || !arDator) return
    const t = window.setTimeout(() => {
      listaRef.current?.querySelector(`[data-station="${valdId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 60)
    return () => window.clearTimeout(t)
  }, [valdId, arDator])

  // ── Flytta (kopia av StationInspectionPanel.tsx:1137-1180) ──
  const flyttaUte = async (lat: number, lng: number) => {
    if (!flyttar || flyttar.typ !== 'ute') return
    try {
      const { error } = await supabase.from('equipment_placements').update({ latitude: lat, longitude: lng }).eq('id', flyttar.station.id)
      if (error) throw error
      setUte(prev => prev.map(s => (s.id === flyttar.station.id ? { ...s, latitude: lat, longitude: lng } : s)))
      toast.success('Stationen är flyttad')
      setFlyttar(null)
    } catch (err) {
      console.error('Kunde inte flytta stationen:', err)
      toast.error('Kunde inte flytta stationen')
    }
  }
  const flyttaInne = async (x: number, y: number) => {
    if (!flyttar || flyttar.typ !== 'inne') return
    try {
      const { error } = await supabase.from('indoor_stations').update({ position_x_percent: x, position_y_percent: y }).eq('id', flyttar.station.id)
      if (error) throw error
      setPlanStationer(prev => prev.map(s => (s.id === flyttar.station.id ? { ...s, position_x_percent: x, position_y_percent: y } : s)))
      setInne(prev => prev.map(s => (s.id === flyttar.station.id ? { ...s, position_x_percent: x, position_y_percent: y } : s)))
      toast.success('Stationen är flyttad')
      setFlyttar(null)
    } catch (err) {
      console.error('Kunde inte flytta stationen:', err)
      toast.error('Kunde inte flytta stationen')
    }
  }
  const startaFlytt = (v: ValdStation) => {
    setVald(null)
    setFlyttar(v)
    if (v.typ === 'ute') setFlik('karta')
    else { setValdPlanId(v.station.floor_plan_id); setFlik('planritning') }
    setTimeout(() => ytaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  // ── Ändra uppgifter ──
  const oppnaAndra = async (v: ValdStation) => {
    setVald(null)
    setAndrar(v)
    setAndrarHistorik({ ute: [], inne: [] })
    try {
      if (v.typ === 'ute') setAndrarHistorik({ ute: await getOutdoorInspectionsByStation(v.station.id), inne: [] })
      else setAndrarHistorik({ ute: [], inne: await IndoorStationService.getInspectionsByStation(v.station.id) })
    } catch (e) { console.error('Fel vid laddning av inspektioner:', e) }
  }

  // Kopia av CustomerStationsModal.tsx:1144-1188 (utomhus, spara)
  const sparaUte = async (formData: EquipmentFormData) => {
    if (!andrar || andrar.typ !== 'ute') return
    const station = andrar.station
    try {
      setSparar(true)
      // Typen skickas inte: den byts bara via Byt typ (RPC change_station_type)
      const result = await EquipmentService.updateEquipment(station.id, {
        serial_number: formData.serial_number || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        comment: formData.comment || null,
        status: formData.status,
        is_addon: formData.is_addon,
        addon_billing_model: formData.is_addon ? (formData.addon_billing_model ?? 'per_round') : null,
        article_id: formData.article_id ?? null,
      })
      if (!result.success) throw new Error(result.error)
      if (formData.photo) await EquipmentService.uploadEquipmentPhoto(station.id, formData.photo)
      if (formData.is_addon || station.is_addon) {
        const missing = await AddonStationBillingService.syncAfterStationChange(
          station.customer_id,
          formData.is_addon ? formData.addon_billing_model : station.addon_billing_model,
          technicianId || null,
          technicianName
        )
        const warning = AddonStationBillingService.priceMissingMessage(missing)
        if (warning) toast.error(warning, { duration: 8000 })
      }
      toast.success('Utrustning uppdaterad')
      setAndrar(null)
      await laddaStationer()
    } catch {
      toast.error('Kunde inte uppdatera utrustning')
    } finally {
      setSparar(false)
    }
  }

  // Kopia av CustomerStationsModal.tsx:1044-1080 (inomhus, spara och ta bort)
  const sparaInne = async (input: UpdateIndoorStationInput) => {
    if (!andrar || andrar.typ !== 'inne') return
    try {
      setSparar(true)
      await IndoorStationService.updateStation(andrar.station.id, input, technicianId || undefined)
      toast.success('Station uppdaterad')
      setAndrar(null)
      await laddaStationer()
      await laddaPlan(valdPlanId)
    } catch {
      toast.error('Kunde inte uppdatera station')
    } finally {
      setSparar(false)
    }
  }
  const taBortInne = async () => {
    if (!andrar || andrar.typ !== 'inne') return
    const station = andrar.station
    // Borttagsregler: avtalsstationer tas inte bort av tekniker
    if (!station.is_addon) {
      toast.error('Stationen ingår i avtalet och kan inte tas bort. Kontakta kontoret.')
      return
    }
    if (!isGuardedAddonStation(station) && !confirm('Är du säker på att du vill ta bort denna station?')) return
    try {
      await IndoorStationService.deleteStation(station.id)
      toast.success('Station borttagen')
      setAndrar(null)
      await laddaStationer()
      await laddaPlan(valdPlanId)
    } catch {
      toast.error('Kunde inte ta bort station')
    }
  }

  // ── Planritningar (kopia av CustomerStationsModal.tsx:320-353 och 385-408) ──
  const laddaUppPlan = async (input: CreateFloorPlanInput) => {
    setSparar(true)
    try {
      const ny = await FloorPlanService.createFloorPlan(input, profile?.id)
      toast.success('Planritningen är uppladdad')
      setVisaUppladdning(false)
      await laddaStationer()
      setValdPlanId(ny.id)
      setFlik('planritning')
    } catch (error) {
      console.error('Fel vid uppladdning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ladda upp planritning')
    } finally {
      setSparar(false)
    }
  }
  const bytBild = async (planId: string, file: File) => {
    setByterBild(true)
    try {
      await FloorPlanService.replaceFloorPlanImage(planId, file)
      toast.success('Bilden är utbytt')
      await laddaStationer()
    } catch (error) {
      console.error('Fel vid byte av bild:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte byta bild')
    } finally {
      setByterBild(false)
      if (bytBildRef.current) bytBildRef.current.value = ''
    }
  }
  const taBortPlan = async (plan: FloorPlanWithRelations) => {
    const antal = inne.filter(s => s.floor_plan_id === plan.id).length
    const msg = antal > 0
      ? `Är du säker? Planritningen "${plan.name}" och ${antal} station${antal === 1 ? '' : 'er'} kommer att raderas permanent.`
      : `Är du säker på att du vill ta bort planritningen "${plan.name}"?`
    if (!confirm(msg)) return
    try {
      await FloorPlanService.deleteFloorPlan(plan.id)
      toast.success('Planritningen är borttagen')
      await laddaStationer()
    } catch (error) {
      console.error('Fel vid borttagning av planritning:', error)
      toast.error('Kunde inte ta bort planritning')
    }
  }

  const laddaNerKarta = async () => {
    setPdfLaddar(true)
    try {
      await StationMapService.downloadStationMap(customerId)
    } catch (e) {
      console.error('Stationskartan kunde inte skapas:', e)
      toast.error(e instanceof Error ? e.message : 'Stationskartan kunde inte skapas')
    } finally {
      setPdfLaddar(false)
    }
  }

  const fardig = async (cid: string, namn: string) => { await flode.finishEstablishmentFor(cid, namn) }

  // ── Rendering ──
  if (!laddar && !hittades) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <div className={`${KORT} p-6 text-center`}>
          <Icon name="allman.foretag" size={32} className="mx-auto text-slate-600" />
          <h2 className="mt-2 text-lg font-semibold text-white">Kunden hittades inte</h2>
          <p className="text-[15px] text-slate-400 mt-1">Kontrollera länken eller gå tillbaka till kundlistan.</p>
          <Link to="/technician/equipment" className={`mt-4 inline-flex ${KNAPP_PRIMAR}`}>Till kundlistan</Link>
        </div>
      </div>
    )
  }

  if (laddar || !kund) {
    return <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar kundens stationer..." /></div>
  }

  const valdArk = (v: ValdStation) => (
    <StationArk
      inline
      vald={v}
      nummer={nummerFor(v)}
      antalPaPlatsen={antalPaPlatsen(v)}
      planNamn={planNamnFor(v)}
      customerId={customerId}
      technicianId={technicianId}
      technicianName={technicianName}
      onClose={() => setVald(null)}
      onFlytta={startaFlytt}
      onBytTyp={(x) => { setVald(null); setBytTyp(x) }}
      onAndra={oppnaAndra}
      onAndrad={() => { void laddaOm() }}
    />
  )

  const listaRad = (v: ValdStation, nr: number | undefined) => {
    const t = typInfo(v.station)
    const st = stationStatus(v.station.status)
    const aktiv = v.station.status !== 'removed'
    const ar = vald?.station.id === v.station.id
    if (ar && inlineArk && flik === 'karta') return <li key={v.station.id} data-station={v.station.id}>{valdArk(v)}</li>
    return (
      <li key={v.station.id} data-station={v.station.id}>
        <button
          type="button"
          onClick={() => setVald(v)}
          aria-label={`Station ${nr ?? ''}, ${t.namn}${v.station.is_addon ? ', tillägg' : ''}, ${st.text}`}
          className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[60px] text-left hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${aktiv ? '' : 'opacity-60'} ${ar ? 'bg-slate-800/60' : ''}`}
        >
          <StationTypeTile size={40} color={t.farg} icon={t.ikon} addon={v.station.is_addon === true && aktiv} />
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold text-white">{nr ? `Station ${nr}` : 'Utan nummer'}</span>
              {v.typ === 'inne' && v.station.station_number && (
                <span className="text-[12px] font-mono text-slate-500 truncate">{v.station.station_number}</span>
              )}
            </span>
            <span className="block text-[13px] text-slate-400 truncate">
              {t.namn}{v.station.is_addon ? ', tillägg' : ''}
            </span>
          </span>
          <StatusPunkt ton={st.ton}>{st.text}</StatusPunkt>
          <Icon name="allman.chevron" size={16} className="text-slate-500 flex-shrink-0" />
        </button>
      </li>
    )
  }

  // Dator: tabellrad i fliken Lista (Nummer, Typ, Status, Senaste kontroll, Placerad av, Öppna)
  const TABELL = 'lg:grid lg:grid-cols-[150px_minmax(0,1fr)_130px_130px_minmax(0,160px)_44px] lg:items-center lg:gap-3'
  const tabellRad = (v: ValdStation, nr: number | undefined) => {
    const t = typInfo(v.station)
    const st = stationStatus(v.station.status)
    const aktiv = v.station.status !== 'removed'
    const ar = vald?.station.id === v.station.id
    const sk = senasteKontroll.get(v.station.id)
    return (
      <li key={v.station.id} role="row" className={`${TABELL} px-3 py-2 min-h-[56px] ${aktiv ? '' : 'opacity-60'} ${ar ? 'bg-[#20c58f]/10' : ''}`}>
        <span role="cell" className="flex items-center gap-2.5 min-w-0">
          <StationTypeTile size={32} color={t.farg} icon={t.ikon} addon={v.station.is_addon === true && aktiv} title={t.namn} />
          <span className="text-[15px] font-semibold text-white">{nr ? `Station ${nr}` : 'Utan nummer'}</span>
        </span>
        <span role="cell" className="block text-[13px] text-slate-300 truncate">
          {t.namn}{v.station.is_addon ? ', tillägg' : ''}
          {v.typ === 'inne' && v.station.station_number && <span className="font-mono text-slate-500">, {v.station.station_number}</span>}
        </span>
        <span role="cell"><StatusPunkt ton={st.ton}>{st.text}</StatusPunkt></span>
        <span role="cell" className={`font-mono text-[13px] ${sk ? 'text-slate-300' : 'text-slate-500'}`}>{sk ? datum(sk) : 'Ingen än'}</span>
        <span role="cell" className="block text-[13px] text-slate-400 truncate">{v.station.technician?.name ?? ''}</span>
        <span role="cell" className="flex justify-end">
          <button type="button" onClick={() => setVald(v)} className={IKONKNAPP} aria-label={`Öppna station ${nr ?? ''}, ${t.namn}`} title="Öppna">
            <Icon name="allman.chevron" size={20} />
          </button>
        </span>
      </li>
    )
  }

  const uteLista = (visaUpphamtade ? ute : aktivaUte).slice().sort((a, b) => (uteNummer.get(a.id) ?? 9999) - (uteNummer.get(b.id) ?? 9999))
  const uteListaAktiva = aktivaUte.slice().sort((a, b) => (uteNummer.get(a.id) ?? 9999) - (uteNummer.get(b.id) ?? 9999))
  const kontaktKnapp = `${KNAPP_SEKUNDAR} px-2 lg:h-11 lg:px-3 lg:text-sm`
  const tabellHuvud = (
    <div role="row" className={`${TABELL} px-3 py-2 border-b border-slate-700/60 bg-slate-800/40 text-[12px] font-semibold text-slate-400`}>
      <span role="columnheader">Nummer</span>
      <span role="columnheader">Typ</span>
      <span role="columnheader">Status</span>
      <span role="columnheader">Senaste kontroll</span>
      <span role="columnheader">Placerad av</span>
      <span role="columnheader" className="sr-only">Öppna</span>
    </div>
  )

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4 pb-8">
      {/* Kunden */}
      <section className={`${KORT} p-4 lg:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button type="button" onClick={() => navigate('/technician/equipment')} className={`${IKONKNAPP} -ml-2`} aria-label="Tillbaka till Stationer" title="Stationer">
              <Icon name="allman.chevron" size={20} className="rotate-180" />
            </button>
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-xl font-bold text-white leading-snug break-words">{kund.customer_name}</h2>
              {kund.customer_address && <p className="text-[15px] text-slate-400">{kund.customer_address}</p>}
              {kontakt?.contact_person && <p className="text-[13px] text-slate-500">Kontakt: {kontakt.contact_person}</p>}
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[13px] text-slate-300">
                <span className="inline-flex items-center gap-1"><Icon name="station.ute" size={16} className="text-slate-500" />{antalText(aktivaUte.length, 'ute', 'ute')}</span>
                <span className="inline-flex items-center gap-1"><Icon name="station.inne" size={16} className="text-slate-500" />{antalText(aktivaInne.length, 'inne', 'inne')}</span>
                {aktivaUte.length + aktivaInne.length > 0 && (
                  <StatusPunkt ton={h.ton === 'rod' ? 'gul' : h.ton}>
                    {halsoInfo.problematicCount > 0 ? `${halsoInfo.problematicCount} med avvikelse` : h.text}
                  </StatusPunkt>
                )}
              </p>
            </div>
            <button
              type="button"
              data-genomgang="kund-pdf"
              onClick={laddaNerKarta}
              disabled={pdfLaddar}
              className={`lg:hidden ${IKONKNAPP}`}
              aria-label="Ladda ned stationskarta som PDF"
              title="Stationskarta, PDF"
            >
              <Icon name={pdfLaddar ? 'allman.laddar' : 'utrustning.stationskarta'} size={24} className={pdfLaddar ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                data-genomgang="kund-pdf"
                onClick={laddaNerKarta}
                disabled={pdfLaddar}
                className={RADKNAPP}
                aria-label="Ladda ned stationskarta som PDF"
              >
                <Icon name={pdfLaddar ? 'allman.laddar' : 'utrustning.stationskarta'} size={20} className={pdfLaddar ? 'animate-spin' : ''} />
                Stationskarta, PDF
              </button>
              {kundensEtablering.length === 0 && (
                <button type="button" data-genomgang="kund-placera" onClick={() => flode.openWizard(customerId)} className={`${KNAPP_PRIMAR} h-12`}>
                  <Icon name="falt.nystation" size={20} />
                  Placera ny station
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 lg:flex gap-2">
              {kontakt?.contact_phone ? (
                <a href={telUrl(kontakt.contact_phone)} className={kontaktKnapp}><Icon name="kontakt.telefon" size={20} />Ring</a>
              ) : <span className={`${kontaktKnapp} opacity-40`} aria-disabled="true"><Icon name="kontakt.telefon" size={20} />Ring</span>}
              {kontakt?.contact_email ? (
                <a href={`mailto:${kontakt.contact_email}`} className={kontaktKnapp}><Icon name="kontakt.mejl" size={20} />Mejla</a>
              ) : <span className={`${kontaktKnapp} opacity-40`} aria-disabled="true"><Icon name="kontakt.mejl" size={20} />Mejla</span>}
              <a
                href={aktivaUte[0] ? `https://www.google.com/maps/dir/?api=1&destination=${aktivaUte[0].latitude},${aktivaUte[0].longitude}` : navigeraUrl(kund.customer_address || kund.customer_name)}
                target="_blank"
                rel="noopener noreferrer"
                className={kontaktKnapp}
              >
                <Icon name="falt.navigera" size={20} />Navigera
              </a>
            </div>
          </div>
        </div>
      </section>

      <PagaendeEtablering
        rader={kundensEtablering}
        onPlacera={(cid) => flode.openWizard(cid)}
        onFardig={fardig}
      />

      {kundensEtablering.length === 0 && (
        <button type="button" data-genomgang="kund-placera" onClick={() => flode.openWizard(customerId)} className={`lg:hidden w-full ${KNAPP_PRIMAR}`}>
          <Icon name="falt.nystation" size={20} />
          Placera ny station
        </button>
      )}

      <div data-genomgang="kund-flikar" className="lg:max-w-2xl">
        <Vaxel<Flik>
          etikett="Visa stationerna som"
          valt={flik}
          onVal={setFlik}
          val={[
            { varde: 'karta', text: 'Karta', ikon: 'falt.karta', antal: aktivaUte.length },
            { varde: 'lista', text: 'Lista', ikon: 'allman.lista', antal: aktivaUte.length + aktivaInne.length },
            { varde: 'planritning', text: 'Planritning', kort: 'Ritning', ikon: 'utrustning.planritning', antal: planer.length },
            { varde: 'schema', text: 'Schema', ikon: 'kund.schema' },
          ]}
        />
      </div>

      <div data-genomgang="kund-innehall" ref={ytaRef}>
        {/* Karta, på datorn med listan bredvid */}
        {flik === 'karta' && (
          aktivaUte.length === 0 ? (
            <TomtLage ikon="station.ute" text="Inga stationer utomhus hos kunden än." knapp="Placera station utomhus" onKnapp={() => flode.openWizard(customerId)} />
          ) : (
            <div className="space-y-2">
              <HjalpText id="kund-karta" rubrik="Stationer utomhus" niva="h3">
                Siffran är stationens nummer. Tryck på en station för att flytta, byta typ eller se historiken.
              </HjalpText>
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 lg:items-start">
                {/* isolate: Google Maps-lagren får inte hamna över sidhuvud och meny */}
                <div className="relative isolate z-0 min-w-0 rounded-2xl overflow-hidden border border-slate-700/60 h-[min(62dvh,560px)] lg:h-[max(520px,calc(100dvh-17rem))]">
                  <EquipmentMap
                    showProductIcons
                    equipment={aktivaUte}
                    stationNumbers={uteNummer}
                    onEquipmentClick={(eq) => { if (!flyttar) setVald({ typ: 'ute', station: eq }) }}
                    height="100%"
                    showControls={true}
                    showFitAllButton
                    readOnly={true}
                    enableClustering={false}
                    showNumbers={true}
                    highlightedStationId={arDator && !flyttar && vald?.typ === 'ute' ? vald.station.id : null}
                    relocatingStationId={flyttar?.typ === 'ute' ? flyttar.station.id : null}
                    relocatingStationName={flyttar?.typ === 'ute' ? `station ${uteNummer.get(flyttar.station.id) ?? ''}`.trim() : null}
                    onRelocateClick={flyttaUte}
                    onCancelRelocate={() => setFlyttar(null)}
                  />
                </div>
                {arDator && (
                  <aside aria-labelledby="kund-listan-rubrik" className={`${KORT} overflow-hidden flex flex-col h-[max(520px,calc(100dvh-17rem))]`}>
                    <div className="px-3.5 py-3 border-b border-slate-700/60">
                      <h3 id="kund-listan-rubrik" className="flex items-center gap-2 text-[15px] font-semibold text-white">
                        <Icon name="allman.lista" size={20} className="text-slate-400" />
                        Listan
                        <span className="text-sm font-medium text-slate-400 tabular-nums">{aktivaUte.length} ute</span>
                      </h3>
                      <p className="text-[13px] text-slate-400">Följer kartan. Vald station fälls ut här.</p>
                    </div>
                    <ul ref={listaRef} className="flex-1 overflow-y-auto divide-y divide-slate-700/60">
                      {uteListaAktiva.map(s => listaRad({ typ: 'ute', station: s }, uteNummer.get(s.id)))}
                    </ul>
                  </aside>
                )}
              </div>
            </div>
          )
        )}

        {/* Lista: tabeller per plats, på datorn med arket till höger */}
        {flik === 'lista' && (
          <div className={inlineArk ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-4 lg:items-start' : ''}>
            <div className="space-y-5 min-w-0">
              {aktivaUte.length + aktivaInne.length === 0 && upphamtade === 0 ? (
                <TomtLage ikon="arende.station" text="Kunden har inga stationer än." knapp="Placera station" onKnapp={() => flode.openWizard(customerId)} />
              ) : (
                <>
                  <HjalpText id="kund-lista" rubrik="Lista" utanRubrik>
                    Tryck på en station för att öppna den. Arket har samma verktyg som på kartan.
                  </HjalpText>
                  {uteLista.length > 0 && (
                    <section aria-labelledby="lista-ute" className="space-y-2">
                      <h3 id="lista-ute" className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Icon name="station.ute" size={16} className="text-slate-400" />Utomhus
                        <span className="font-medium text-slate-400 tabular-nums">{uteLista.length}</span>
                      </h3>
                      {arDator ? (
                        <div role="table" aria-label="Stationer utomhus" className={`${KORT} overflow-hidden`}>
                          {tabellHuvud}
                          <ul className="divide-y divide-slate-700/60">
                            {uteLista.map(s => tabellRad({ typ: 'ute', station: s }, uteNummer.get(s.id)))}
                          </ul>
                        </div>
                      ) : (
                        <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>
                          {uteLista.map(s => listaRad({ typ: 'ute', station: s }, uteNummer.get(s.id)))}
                        </ul>
                      )}
                    </section>
                  )}
                  {planer.map(p => {
                    const lista = inne
                      .filter(s => s.floor_plan_id === p.id && (visaUpphamtade || s.status !== 'removed'))
                      .sort((a, b) => (inneNummer.get(a.id) ?? 9999) - (inneNummer.get(b.id) ?? 9999))
                    if (lista.length === 0) return null
                    const namn = p.building_name ? `${p.building_name}, ${p.name}` : p.name
                    return (
                      <section key={p.id} aria-labelledby={`lista-${p.id}`} className="space-y-2">
                        <h3 id={`lista-${p.id}`} className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Icon name="utrustning.planritning" size={16} className="text-slate-400" />
                          {namn}
                          <span className="font-medium text-slate-400 tabular-nums">{lista.length}</span>
                        </h3>
                        {arDator ? (
                          <div role="table" aria-label={namn} className={`${KORT} overflow-hidden`}>
                            {tabellHuvud}
                            <ul className="divide-y divide-slate-700/60">
                              {lista.map(s => tabellRad({ typ: 'inne', station: s }, inneNummer.get(s.id)))}
                            </ul>
                          </div>
                        ) : (
                          <ul className={`${KORT} divide-y divide-slate-700/60 overflow-hidden`}>
                            {lista.map(s => listaRad({ typ: 'inne', station: s }, inneNummer.get(s.id)))}
                          </ul>
                        )}
                      </section>
                    )
                  })}
                  {upphamtade > 0 && (
                    <button type="button" onClick={() => setVisaUpphamtade(v => !v)} className="min-h-[44px] px-1 text-sm font-medium text-slate-300 hover:text-white">
                      {visaUpphamtade ? 'Dölj upphämtade' : `Visa upphämtade (${upphamtade})`}
                    </button>
                  )}
                </>
              )}
            </div>
            {inlineArk && vald && (
              <div className={`${KORT} hidden lg:block sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto`}>
                {valdArk(vald)}
              </div>
            )}
          </div>
        )}

        {/* Planritning */}
        {flik === 'planritning' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {planer.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setFlyttar(null); setValdPlanId(p.id) }}
                  aria-pressed={p.id === valdPlanId}
                  className={`flex-shrink-0 h-11 px-3 rounded-xl text-sm font-medium whitespace-nowrap border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                    p.id === valdPlanId ? 'border-[#20c58f] bg-[#20c58f]/10 text-white' : 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {p.building_name ? `${p.building_name}, ${p.name}` : p.name}
                  <span className="ml-1.5 text-slate-500 tabular-nums">{inne.filter(s => s.floor_plan_id === p.id && s.status !== 'removed').length}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setVisaUppladdning(true)}
                className="flex-shrink-0 h-11 px-3 rounded-xl text-sm font-medium border border-dashed border-slate-600 text-[#20c58f] hover:bg-[#20c58f]/10 flex items-center gap-1.5"
              >
                <Icon name="rapport.ladda-upp" size={16} />
                Ny planritning
              </button>
            </div>

            {planer.length === 0 ? (
              <TomtLage ikon="utrustning.planritning" text="Inga planritningar uppladdade." knapp="Ladda upp planritning" onKnapp={() => setVisaUppladdning(true)} />
            ) : valdPlan && (
              <>
                <div className="relative isolate z-0 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900">
                  {valdPlan.image_url ? (
                    <FloorPlanViewer
                      showProductIcons
                      imageUrl={valdPlan.image_url}
                      imageWidth={valdPlan.image_width}
                      imageHeight={valdPlan.image_height}
                      stations={planStationer.filter(s => s.status !== 'removed')}
                      placementMode="view"
                      onStationClick={(s) => { if (!flyttar) setVald({ typ: 'inne', station: s }) }}
                      onImageClick={flyttaInne}
                      onCancelPlacement={() => setFlyttar(null)}
                      height="min(62dvh, 560px)"
                      showNumbers={true}
                      relocatingStationId={flyttar?.typ === 'inne' ? flyttar.station.id : null}
                      relocatingStationName={flyttar?.typ === 'inne' ? `station ${inneNummer.get(flyttar.station.id) ?? ''}`.trim() : null}
                    />
                  ) : (
                    <div className="h-60 flex items-center justify-center text-slate-500">
                      <Icon name="utrustning.planritning" size={32} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => flode.openWizard(customerId, true)} className={`flex-1 sm:flex-none ${KNAPP_PRIMAR}`}>
                    <Icon name="utrustning.placera" size={20} />
                    Placera på planritning
                  </button>
                  <button
                    type="button"
                    onClick={() => bytBildRef.current?.click()}
                    disabled={byterBild}
                    className={`${IKONKNAPP} w-[52px] h-[52px] border border-slate-700`}
                    aria-label={`Byt bild på ${valdPlan.name}`}
                    title="Byt bild"
                  >
                    <Icon name={byterBild ? 'allman.laddar' : 'utrustning.bytbild'} size={24} className={byterBild ? 'animate-spin' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => taBortPlan(valdPlan)}
                    className={`${IKONKNAPP} w-[52px] h-[52px] border border-slate-700 hover:text-red-400`}
                    aria-label={`Ta bort planritningen ${valdPlan.name}`}
                    title="Ta bort planritning"
                  >
                    <Icon name="allman.radera" size={24} />
                  </button>
                </div>
                <input
                  ref={bytBildRef}
                  type="file"
                  accept={ALLOWED_FLOOR_PLAN_TYPES.join(',')}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && valdPlan) void bytBild(valdPlan.id, file)
                  }}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}

        {/* Schema */}
        {flik === 'schema' && (
          <div className={`${KORT} p-3`}>
            <RecurringScheduleManagement
              key={schemaNyckel}
              customerId={kund.customer_id}
              technicianId={technicianId}
              onCreateNew={() => setVisaSchemaWizard(true)}
            />
          </div>
        )}
      </div>

      {(kund.contract_start_date || kund.contract_end_date) && flik === 'schema' && (
        <p className="text-[13px] text-slate-500">
          Avtalet {kund.contract_start_date ? `från ${datum(kund.contract_start_date)}` : ''}{kund.contract_end_date ? ` till ${datum(kund.contract_end_date)}` : ''}
        </p>
      )}

      {/* Stationens ark: på telefon och för planritningen som ark över sidan, på datorn inline ovan */}
      <StationArk
        vald={inlineArk ? null : vald}
        nummer={nummerFor(vald)}
        antalPaPlatsen={antalPaPlatsen(vald)}
        planNamn={planNamnFor(vald)}
        customerId={customerId}
        technicianId={technicianId}
        technicianName={technicianName}
        onClose={() => setVald(null)}
        onFlytta={startaFlytt}
        onBytTyp={(v) => { setVald(null); setBytTyp(v) }}
        onAndra={oppnaAndra}
        onAndrad={() => { void laddaOm() }}
      />

      {/* Byt typ (RPC change_station_type) */}
      {bytTyp && (() => {
        const s = bytTyp.station
        const t = typInfo(s)
        const nr = nummerFor(bytTyp)
        return (
          <ChangeStationTypeModal
            isOpen={true}
            station={{
              id: s.id,
              kind: bytTyp.typ === 'ute' ? 'outdoor' : 'indoor',
              typeId: s.station_type_data?.id ?? s.station_type_id ?? null,
              typeName: t.namn,
              typeColor: s.station_type_data?.color ?? null,
              typeIcon: s.station_type_data?.icon ?? null,
              is_addon: s.is_addon,
              addon_billing_model: s.addon_billing_model,
              addon_contract_mode: s.addon_contract_mode,
              article_id: s.article_id,
              serial_number: bytTyp.typ === 'ute' ? bytTyp.station.serial_number : null,
              label: nr ? `Station ${nr}` : t.namn,
            }}
            onChanged={(_result, newType) => {
              toast.success(`Typen är ändrad till ${newType.name}`)
              setBytTyp(null)
              void laddaOm()
            }}
            onCancel={() => setBytTyp(null)}
          />
        )
      })()}

      {/* Ändra uppgifter: samma formulär som gamla kundsidan */}
      {andrar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={() => setAndrar(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ändra stationens uppgifter"
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl pb-[env(safe-area-inset-bottom)]"
          >
            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-900">
              <h2 className="flex-1 text-lg font-semibold text-white truncate">
                Ändra {nummerFor(andrar) ? `station ${nummerFor(andrar)}` : 'station'}
              </h2>
              <button type="button" onClick={() => setAndrar(null)} className={IKONKNAPP} aria-label="Stäng">
                <Icon name="allman.stang" size={20} />
              </button>
            </div>
            <div className="p-4">
              {andrar.typ === 'ute' ? (
                <EquipmentPlacementForm
                  customerId={customerId}
                  technicianId={technicianId}
                  existingEquipment={andrar.station}
                  inspections={andrarHistorik.ute}
                  onTypeChanged={() => { void laddaOm() }}
                  onSubmit={sparaUte}
                  onCancel={() => setAndrar(null)}
                  isSubmitting={sparar}
                  addonPrices={addonPrices}
                  addonPricesLoading={addonPricesLoading}
                  showCustomerPicker={false}
                />
              ) : (
                <IndoorStationForm
                  floorPlanId={andrar.station.floor_plan_id}
                  position={{ x: andrar.station.position_x_percent, y: andrar.station.position_y_percent }}
                  existingStation={andrar.station}
                  inspections={andrarHistorik.inne}
                  addonPrices={addonPrices}
                  addonPricesLoading={addonPricesLoading}
                  onTypeChanged={() => { void laddaOm() }}
                  onSubmit={async (input) => { await sparaInne(input as UpdateIndoorStationInput) }}
                  onCancel={() => setAndrar(null)}
                  onDelete={taBortInne}
                  isSubmitting={sparar}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ladda upp planritning */}
      {visaUppladdning && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={() => setVisaUppladdning(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-slate-800 rounded-t-3xl sm:rounded-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <FloorPlanUploadForm
              customerId={kund.customer_id}
              customerName={kund.customer_name}
              existingBuildings={[...new Set(planer.map(p => p.building_name).filter(Boolean))] as string[]}
              onSubmit={laddaUppPlan}
              onCancel={() => setVisaUppladdning(false)}
              isSubmitting={sparar}
            />
          </div>
        </div>
      )}

      {visaSchemaWizard && (
        <RecurringScheduleWizard
          isOpen={visaSchemaWizard}
          onClose={() => setVisaSchemaWizard(false)}
          onComplete={() => {
            setVisaSchemaWizard(false)
            setSchemaNyckel(k => k + 1) // läs om schemat
          }}
          customerId={kund.customer_id}
          customerName={kund.customer_name}
          technicianId={technicianId}
          contractStartDate={kund.contract_start_date}
          contractEndDate={kund.contract_end_date}
        />
      )}

      <EtableringsFlode
        flode={flode}
        allCustomers={kundLista}
        onIndoorFinished={() => { void laddaOm() }}
        onTypeChanged={() => { void laddaOm() }}
      />

      <Genomgang id="ny-kund-stationer-2" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />
    </div>
  )
}

function TomtLage({ ikon, text, knapp, onKnapp }: { ikon: 'station.ute' | 'arende.station' | 'utrustning.planritning'; text: string; knapp: string; onKnapp: () => void }) {
  return (
    <div className={`${KORT} p-6 text-center`}>
      <Icon name={ikon} size={32} className="mx-auto text-slate-600" />
      <p className="mt-2 text-[15px] text-slate-300">{text}</p>
      <button type="button" onClick={onKnapp} className={`mt-4 inline-flex ${KNAPP_SEKUNDAR}`}>
        <Icon name="allman.plus" size={20} />
        {knapp}
      </button>
    </div>
  )
}

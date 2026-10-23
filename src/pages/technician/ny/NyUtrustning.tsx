// src/pages/technician/ny/NyUtrustning.tsx
// Utrustning i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
// Gamla TechnicianEquipment.tsx är orörd och gäller för alla andra.
//
// ─── INVENTERING: gamla sidans funktioner och var de finns här ───────────────
// TechnicianEquipment.tsx
//  Hämtning av alla stationer + kundsammanfattningar (scope all)  → här, ladda()
//  Alla/Mina (localStorage technician-equipment-station-scope)     → här, samma nyckel, växeln ovanför kundlistan
//  Statistik (totalt, ute, inne, kunder)                            → sidhuvudets underrubrik + kartfliken (CollapsibleMapSection stats)
//  Flikar Kunder / Karta / Kontroller i ?tab=                       → här, Vaxel, samma ?tab=kunder|karta|kontroller
//  Uppdatera-knappen                                                → här, ikonknapp bredvid Placera station
//  FAB Placera station (wizard utan kund)                           → här, knappen Placera station
//  ?customer=<id> öppnar wizarden förvald (Gå till utplacering)     → här, samma parameter och samma engångsvakt
//  AddStationWizard (Kund → Typ → Placera, inomhus i wizarden)      → EtableringsFlode (återanvänd komponent)
//  Placeringsformulär utomhus + batch (Placera fler/inomhus/Färdig) → EtableringsFlode + useEtableringsflode (kopia)
//  handleFormSubmit: avtalsuppslag, createEquipment, foto, preparat på etableringsärendet,
//    syncAfterStationChange + prissaknadsvarning                    → useEtableringsflode (kopia, källrader i filen)
//  Färdig med etablering: avslutsspärr, syncAddonEstablishmentLine, syncAddonPeriodLines,
//    syncAddonProrataLine, listpris, faktureringssammanfattning, rabatt mot listpris,
//    arbetstid för tillägg (AddonLabourStep), closeEstablishmentCase, auto-arbetsrapport,
//    completeContractCaseBilling, checkAndPromptSchedule           → useEtableringsflode + EtableringsFlode (kopia)
//  Fråga om återkommande kontroller + RecurringScheduleWizard       → EtableringsFlode
//  Kundlista (AllCustomersList/ExpandableCustomerRow/MultisiteOrgRow): sök, sortering,
//    multisite-grupper, Schemalägg (en, alla, valda enheter), schemapanelen → KundLista (ny)
//  Kundklick → /technician/equipment/customer/:id                   → KundLista, samma route (NyKundStationer)
//  ScheduleInfoPanel + EditScheduleModal (öppnas igen efter ändring) → här, återanvända
//  Kartfliken: CollapsibleMapSection med fokuskund (följer wizardens kund), typfilter,
//    andra kunder nedtonade, klick → kundsidan                      → här, återanvänd i isolerad behållare
//  Kontrollfliken: InspectionOverviewTab                            → här, återanvänd
//  Lightbox (oanvänd i gamla sidan, editingEquipment sätts aldrig)  → utelämnad, ingen funktion tappas
//  NYTT: Pågående etablering (öppna etableringsärenden som startat) → PagaendeEtablering överst
//
// TechnicianCustomerStationsPage.tsx + CustomerStationsModal.tsx   → NyKundStationer.tsx (egen inventering där)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import type { EquipmentPlacementWithRelations } from '../../../types/database'
import { EquipmentService, type CustomerStationSummary, type StationScope } from '../../../services/equipmentService'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { CollapsibleMapSection } from '../../../components/technician/CollapsibleMapSection'
import { InspectionOverviewTab } from '../../../components/technician/InspectionOverviewTab'
import { ScheduleInfoPanel } from '../../../components/technician/ScheduleInfoPanel'
import { EditScheduleModal } from '../../../components/technician/EditScheduleModal'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { Vaxel } from '../../../components/technician/ny/utrustning/Vaxel'
import { KundLista, type Sortering, type TypRad } from '../../../components/technician/ny/utrustning/KundLista'
import { PagaendeEtablering } from '../../../components/technician/ny/utrustning/PagaendeEtablering'
import { usePagaendeEtableringar } from '../../../components/technician/ny/utrustning/usePagaendeEtableringar'
import { EtableringsFlode } from '../../../components/technician/ny/utrustning/EtableringsFlode'
import { useEtableringsflode } from '../../../components/technician/ny/utrustning/useEtableringsflode'
import { IKONKNAPP, KNAPP_PRIMAR, typInfo } from '../../../components/technician/ny/utrustning/utrustningUi'

// Samma nyckel som gamla sidan, så valet följer med mellan vyerna
const STATION_SCOPE_STORAGE_KEY = 'technician-equipment-station-scope'
const SORT_NYCKEL = 'ny-utrustning-sortering'

type Flik = 'kunder' | 'karta' | 'kontroller'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Placera station', text: 'Här placerar du ut nya stationer. Du väljer kund, ute eller inne och sedan platsen.', mal: 'utr-placera' },
  { rubrik: 'Pågående etablering', text: 'När du har en etablering igång syns den överst. Tryck Färdig med etablering när alla stationer är ute.', mal: 'utr-etablering' },
  { rubrik: 'Kunder, Karta och Kontroller', text: 'Kunder listar alla kunder med stationer. Karta visar stationerna. Kontroller visar inbokade stationskontroller.', mal: 'utr-flikar' },
  { rubrik: 'Alla eller Mina', text: 'Alla visar kunder där någon i teamet placerat stationer. Mina visar bara kunder där du själv placerat.', mal: 'utr-omfang' },
  { rubrik: 'Tryck på en kund', text: 'Då ser du kundens stationer på karta, i lista och på planritningar. Där flyttar du, byter typ och hämtar upp.', mal: 'utr-kunder' },
]

function lasScope(): StationScope {
  try { return localStorage.getItem(STATION_SCOPE_STORAGE_KEY) === 'own' ? 'own' : 'all' } catch { return 'all' }
}
function lasSortering(): Sortering {
  try {
    const v = localStorage.getItem(SORT_NYCKEL)
    return v === 'count' || v === 'health' || v === 'recent' ? v : 'name'
  } catch { return 'name' }
}

export default function NyUtrustning() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const technicianId = profile?.technician_id || ''
  const technicianName = profile?.technicians?.name?.trim() || null

  const tabParam = searchParams.get('tab')
  const flik: Flik = tabParam === 'karta' || tabParam === 'kontroller' ? tabParam : 'kunder'
  const setFlik = (t: Flik) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', t)
      next.delete('customer')
      return next
    }, { replace: true })
  }

  const [fetchedEquipment, setFetchedEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [fetchedCustomers, setFetchedCustomers] = useState<CustomerStationSummary[]>([])
  const [laddar, setLaddar] = useState(true)
  const [uppdaterar, setUppdaterar] = useState(false)
  const [scope, setScope] = useState<StationScope>(lasScope)
  const [sok, setSok] = useState('')
  const [sortering, setSorteringState] = useState<Sortering>(lasSortering)
  const [visaMig, setVisaMig] = useState(false)
  const [avslutar, setAvslutar] = useState<string | null>(null)

  const setScopeOchSpara = (s: StationScope) => {
    setScope(s)
    try { localStorage.setItem(STATION_SCOPE_STORAGE_KEY, s) } catch { /* privat läge */ }
  }
  const setSortering = (s: Sortering) => {
    setSorteringState(s)
    try { localStorage.setItem(SORT_NYCKEL, s) } catch { /* privat läge */ }
  }

  const pagaende = usePagaendeEtableringar(technicianId)
  const laddaPagaende = pagaende.ladda

  // Uppdatera i bakgrunden, blankar aldrig sidan (viktigt mitt i batch-placering)
  const refreshData = useCallback(async () => {
    if (!technicianId) { setLaddar(false); return }
    setUppdaterar(true)
    try {
      const [eq, kunder] = await Promise.all([
        EquipmentService.getEquipmentByTechnician(technicianId),
        EquipmentService.getCustomerStationSummaries(technicianId),
      ])
      setFetchedEquipment(eq)
      setFetchedCustomers(kunder)
    } catch (e) {
      console.error('Fel vid hämtning av utrustning:', e)
      toast.error('Kunde inte hämta utrustning')
    } finally {
      setUppdaterar(false)
      setLaddar(false)
    }
    void laddaPagaende()
  }, [technicianId, laddaPagaende])

  useEffect(() => { void refreshData() }, [refreshData])

  const allEquipment = useMemo(
    () => scope === 'own' ? fetchedEquipment.filter(e => e.placed_by_technician_id === technicianId) : fetchedEquipment,
    [fetchedEquipment, scope, technicianId]
  )
  // I läget Mina visas kunder där teknikern placerat något, men antalen är kundens totala
  const allCustomers = useMemo(
    () => scope === 'own' ? fetchedCustomers.filter(c => c.own_outdoor_count + c.own_indoor_count > 0) : fetchedCustomers,
    [fetchedCustomers, scope]
  )

  const flode = useEtableringsflode({ technicianId, technicianName, fetchedEquipment, allCustomers, refreshData })
  const { openWizard } = flode

  // ?customer=<id> kommer från "Gå till utplacering" i etableringsärendet.
  // Öppna ALLTID etableringswizarden med kunden förfylld (beslut 2026-08-19).
  const customerParamHandled = useRef(false)
  useEffect(() => {
    const cid = searchParams.get('customer')
    if (!cid || customerParamHandled.current) return
    customerParamHandled.current = true
    openWizard(cid)
  }, [searchParams, openWizard])

  // Kartfliken följer pågående placering: wizardens kund blir fokuskund
  const [mapFocusCustomerId, setMapFocusCustomerId] = useState<string | null>(null)
  const wizardKund = flode.wizardCustomerId
  useEffect(() => { if (wizardKund) setMapFocusCustomerId(wizardKund) }, [wizardKund])

  const stats = useMemo(() => {
    const ute = allEquipment.filter(e => e.latitude && e.longitude)
    const byStatus: Record<string, number> = {}
    ute.forEach(e => { byStatus[e.status] = (byStatus[e.status] || 0) + 1 })
    const inne = allCustomers.reduce((s, c) => s + c.indoor_count, 0)
    return { total: ute.length + inne, outdoor: ute.length, indoor: inne, byStatus, customerCount: allCustomers.length }
  }, [allEquipment, allCustomers])

  // Kartfliken visar alltid teknikerns egna stationer (placerade av teknikern),
  // oavsett valet Alla/Mina i kundlistan (Christian 2026-10-23).
  const kartEquipment = useMemo(
    () => fetchedEquipment.filter(e => e.placed_by_technician_id === technicianId),
    [fetchedEquipment, technicianId]
  )
  const kartStats = useMemo(() => {
    const ute = kartEquipment.filter(e => e.latitude && e.longitude)
    const byStatus: Record<string, number> = {}
    ute.forEach(e => { byStatus[e.status] = (byStatus[e.status] || 0) + 1 })
    const egnaKunder = fetchedCustomers.filter(c => c.own_outdoor_count + c.own_indoor_count > 0)
    const inne = egnaKunder.reduce((s, c) => s + c.own_indoor_count, 0)
    return { total: ute.length + inne, outdoor: ute.length, indoor: inne, byStatus, customerCount: egnaKunder.length }
  }, [kartEquipment, fetchedCustomers])

  // Utomhustyper per kund (färgpunkter i kundlistan), aktiva stationer
  const typerPerKund = useMemo(() => {
    const m = new Map<string, Map<string, TypRad>>()
    for (const e of fetchedEquipment) {
      if (e.status === 'removed') continue
      const t = typInfo(e)
      const k = m.get(e.customer_id) ?? new Map<string, TypRad>()
      const rad = k.get(t.namn) ?? { namn: t.namn, farg: t.farg, antal: 0 }
      rad.antal++
      k.set(t.namn, rad)
      m.set(e.customer_id, k)
    }
    const ut = new Map<string, TypRad[]>()
    m.forEach((v, k) => ut.set(k, Array.from(v.values()).sort((a, b) => b.antal - a.antal)))
    return ut
  }, [fetchedEquipment])

  // Antal kunder som i gamla listan (multisite räknas som en)
  const kundAntal = useMemo(() => {
    const orgar = new Set(allCustomers.filter(c => c.is_multisite && c.organization_id).map(c => c.organization_id))
    return orgar.size + allCustomers.filter(c => !c.is_multisite || !c.organization_id).length
  }, [allCustomers])
  const stationAntal = allCustomers.reduce((s, c) => s + c.outdoor_count + c.indoor_count, 0)

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({
    underrubrik: laddar ? undefined : `${kundAntal} ${kundAntal === 1 ? 'kund' : 'kunder'}, ${stationAntal} stationer`,
    onVisaMig: oppnaVisaMig,
  })

  // Schemapanelen och schemaredigering (som gamla sidan)
  const [schedulePanelTarget, setSchedulePanelTarget] = useState<{
    customerId: string
    customerName: string
    sites?: { customerId: string; siteName: string }[]
  } | null>(null)
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null)

  const fardig = async (customerId: string, kund: string) => {
    setAvslutar(customerId)
    try { await flode.finishEstablishmentFor(customerId, kund) } finally { setAvslutar(null) }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-5 pb-8">
      <PagaendeEtablering
        rader={pagaende.rader}
        onPlacera={(cid) => openWizard(cid)}
        onFardig={fardig}
        avslutar={avslutar}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-genomgang="utr-placera"
          onClick={() => openWizard(null)}
          className={`flex-1 sm:flex-none ${KNAPP_PRIMAR}`}
        >
          <Icon name="falt.nystation" size={20} />
          Placera station
        </button>
        <div className="hidden sm:block flex-1" />
        <button
          type="button"
          onClick={() => { void refreshData() }}
          disabled={uppdaterar}
          className={`${IKONKNAPP} w-[52px] h-[52px] border border-slate-700`}
          aria-label="Uppdatera"
          title="Uppdatera"
        >
          <Icon name="utrustning.uppdatera" size={24} className={uppdaterar ? 'animate-spin' : ''} />
        </button>
      </div>

      <div data-genomgang="utr-flikar">
        <Vaxel<Flik>
          etikett="Visa"
          valt={flik}
          onVal={setFlik}
          val={[
            { varde: 'kunder', text: 'Kunder', ikon: 'allman.foretag' },
            { varde: 'karta', text: 'Karta', ikon: 'falt.karta' },
            { varde: 'kontroller', text: 'Kontroller', ikon: 'utrustning.kontroller' },
          ]}
        />
      </div>

      {laddar ? (
        <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar stationer och kunder..." /></div>
      ) : (
        <>
          {flik === 'kunder' && (
            <section aria-labelledby="hjalp-utr-kunder-rubrik" className="space-y-3">
              <HjalpText
                id="utr-kunder"
                rubrik="Kunder med stationer"
                hoger={
                  <div data-genomgang="utr-omfang" role="tablist" aria-label="Vems stationer" className="flex rounded-xl bg-slate-900 border border-slate-700 p-0.5">
                    {([['all', 'Alla'], ['own', 'Mina']] as Array<[StationScope, string]>).map(([v, t]) => (
                      <button
                        key={v}
                        type="button"
                        role="tab"
                        aria-selected={scope === v}
                        onClick={() => setScopeOchSpara(v)}
                        className={`h-10 min-w-[64px] px-3 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${scope === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                }
              >
                Tryck på en kund för att se stationerna. Antalen är kundens alla stationer, även i läget Mina.
              </HjalpText>
              <KundLista
                kunder={allCustomers}
                typerPerKund={typerPerKund}
                sok={sok}
                onSok={setSok}
                sortering={sortering}
                onSortering={setSortering}
                onSchemapanel={(customerId, customerName, sites) => setSchedulePanelTarget({ customerId, customerName, sites })}
                onSchemalagg={flode.handleScheduleFromList}
              />
            </section>
          )}

          {flik === 'karta' && (
            // isolate: Google Maps-lagren har höga z-index och får inte hamna över sidhuvud och meny
            <div className="relative isolate z-0">
              <CollapsibleMapSection
                equipment={kartEquipment}
                stats={kartStats}
                rubrik="Utplacerat av mig"
                onEquipmentClick={(e) => { if (e.customer_id) navigate(`/technician/equipment/customer/${e.customer_id}`) }}
                defaultExpanded={true}
                focusCustomerId={mapFocusCustomerId}
                onFocusCustomerChange={setMapFocusCustomerId}
              />
            </div>
          )}

          {flik === 'kontroller' && (
            <InspectionOverviewTab
              technicianId={technicianId}
              customers={allCustomers}
              onOpenSchedulePanel={(customerId, customerName) => setSchedulePanelTarget({ customerId, customerName })}
            />
          )}
        </>
      )}

      <EtableringsFlode
        flode={flode}
        allCustomers={allCustomers}
        onIndoorFinished={() => { void refreshData() }}
        onTypeChanged={() => { void refreshData() }}
      />

      <ScheduleInfoPanel
        isOpen={!!schedulePanelTarget}
        onClose={() => setSchedulePanelTarget(null)}
        customerId={schedulePanelTarget?.customerId ?? ''}
        customerName={schedulePanelTarget?.customerName ?? ''}
        siteCustomerIds={schedulePanelTarget?.sites}
        onEditSchedule={(scheduleId) => setEditScheduleId(scheduleId)}
      />
      <EditScheduleModal
        isOpen={!!editScheduleId}
        onClose={() => setEditScheduleId(null)}
        onUpdated={() => {
          setEditScheduleId(null)
          // Öppna panelen igen så att den läser om schemat
          if (schedulePanelTarget) {
            const target = { ...schedulePanelTarget }
            setSchedulePanelTarget(null)
            setTimeout(() => setSchedulePanelTarget(target), 100)
          }
        }}
        scheduleId={editScheduleId ?? ''}
      />

      {!laddar && (
        <Genomgang
          id="ny-utrustning"
          steg={pagaende.rader.length > 0 ? GENOMGANG : GENOMGANG.filter(s => s.mal !== 'utr-etablering')}
          tvinga={visaMig}
          onStang={() => setVisaMig(false)}
        />
      )}
    </div>
  )
}

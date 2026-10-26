// src/pages/technician/ny/NyUtrustning.tsx
// Stationer (tidigare Utrustning) i nya arbetsvyn, /technician/equipment
// (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx). Gamla TechnicianEquipment.tsx
// är orörd och gäller för alla andra.
//
// Layout (skisserna Main, KartaDator, UtrustningMobil, UtrustningKontroller, KartaMobil):
//  Dator  verktygsrad med Uppdatera och EN primär Placera station, huvudyta med
//         flikarna och sidokolumnen Att göra (ca 360 px). I kartläget fälls Att
//         göra ihop till en smal list med antalen (valet sparas i webbläsaren).
//  Telefon Att göra som kompakt lista överst, flytande Placera station ovanför
//         bottenmenyn. I kartläget en rad med antalen ovanför flikarna.
//
// ─── INVENTERING: gamla sidans funktioner och var de finns här ───────────────
// TechnicianEquipment.tsx
//  Hämtning av alla stationer + kundsammanfattningar (scope all)  → här, ladda()
//  Alla/Mina (localStorage technician-equipment-station-scope)     → här, samma nyckel, i kundlistans verktygsrad
//  Statistik (totalt, ute, inne, kunder)                            → sidhuvudets underrubrik + kartfliken (CollapsibleMapSection stats)
//  Flikar Kunder / Karta / Kontroller i ?tab=                       → här, Vaxel, samma ?tab=kunder|karta|kontroller
//  Uppdatera-knappen                                                → här, verktygsraden (dator) och bredvid flikarna (telefon)
//  FAB Placera station (wizard utan kund)                           → här, Placera station (verktygsrad eller flytande knapp)
//  ?customer=<id> öppnar wizarden förvald (Gå till utplacering)     → här, samma parameter och samma engångsvakt
//  AddStationWizard, placering, batch, Färdig med etablering,
//    fakturering och spärrar                                        → EtableringsFlode + useEtableringsflode (oförändrade)
//  Kundlista (AllCustomersList/ExpandableCustomerRow/MultisiteOrgRow): sök, sortering,
//    multisite-grupper, Schemalägg (en, alla, valda enheter), schemapanelen → KundLista
//  Kundklick → /technician/equipment/customer/:id                   → KundLista, samma route (NyKundStationer)
//  ScheduleInfoPanel + EditScheduleModal (öppnas igen efter ändring) → här, återanvända
//  Kartfliken: CollapsibleMapSection med fokuskund (följer wizardens kund), typfilter,
//    andra kunder nedtonade, klick → kundsidan                      → här, återanvänd i isolerad behållare
//  Kontrollfliken: InspectionOverviewTab (Hantera = schemapanelen)  → KontrollerFlik (Boka om = schemapanelen,
//                                                                     Öppna = kontrollens ärende), samma data
//  Lightbox (oanvänd i gamla sidan, editingEquipment sätts aldrig)  → utelämnad, ingen funktion tappas
//  NYTT: Att göra (pågående etableringar + kontroller)              → AttGora, sidokolumn eller lista överst
// TechnicianCustomerStationsPage.tsx + CustomerStationsModal.tsx   → NyKundStationer.tsx (egen inventering där)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import type { EquipmentPlacementWithRelations } from '../../../types/database'
import { EquipmentService, type CustomerStationSummary, type StationScope } from '../../../services/equipmentService'
import type { BookedInspection } from '../../../services/technicianEquipmentService'
import { klockslag, svenskDag } from '../../../services/teknikerDagService'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { CollapsibleMapSection } from '../../../components/technician/CollapsibleMapSection'
import { ScheduleInfoPanel } from '../../../components/technician/ScheduleInfoPanel'
import { EditScheduleModal } from '../../../components/technician/EditScheduleModal'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { Vaxel } from '../../../components/technician/ny/utrustning/Vaxel'
import { KundLista, type Sortering, type TypRad } from '../../../components/technician/ny/utrustning/KundLista'
import { AttGoraKolumn, AttGoraList, AttGoraRad, AttGoraTelefon } from '../../../components/technician/ny/utrustning/AttGora'
import { etableringInfo } from '../../../components/technician/ny/utrustning/etableringInfo'
import { KontrollerFlik } from '../../../components/technician/ny/utrustning/KontrollerFlik'
import { usePagaendeEtableringar } from '../../../components/technician/ny/utrustning/usePagaendeEtableringar'
import { useKontrollData } from '../../../components/technician/ny/utrustning/useKontrollData'
import { EtableringsFlode } from '../../../components/technician/ny/utrustning/EtableringsFlode'
import { useEtableringsflode } from '../../../components/technician/ny/utrustning/useEtableringsflode'
import { IKONKNAPP, KNAPP_PRIMAR, RADKNAPP, typInfo } from '../../../components/technician/ny/utrustning/utrustningUi'

// Samma nyckel som gamla sidan, så valet följer med mellan vyerna
const STATION_SCOPE_STORAGE_KEY = 'technician-equipment-station-scope'
const SORT_NYCKEL = 'ny-utrustning-sortering'
// Att göra i kartläget på datorn: hopfälld eller utfälld, sparas per webbläsare
const ATTGORA_KARTA_NYCKEL = 'ny-stationer-attgora-karta'

type Flik = 'kunder' | 'karta' | 'kontroller'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Placera station', text: 'Här placerar du ut nya stationer. Du väljer kund, ute eller inne och sedan platsen.', mal: 'utr-placera' },
  { rubrik: 'Att göra', text: 'Här står pågående etableringar och kontroller som väntar. En etablering utan stationer efter 30 dagar blir gul, kontrollera då ärendet.', mal: 'utr-attgora' },
  { rubrik: 'Pågående etablering', text: 'Raden visar hur många av avtalets stationer som är ute. Tryck Avsluta etablering när alla är placerade. Då stängs ärendet och tilläggsstationer faktureras.', mal: 'utr-etablering' },
  { rubrik: 'Kunder, Karta och Kontroller', text: 'Kunder listar alla kunder med stationer. Karta visar stationerna du själv placerat. Kontroller visar försenade och bokade kontroller och kunder utan schema.', mal: 'utr-flikar' },
  { rubrik: 'Alla eller Mina', text: 'Alla visar kunder där någon i teamet placerat stationer. Mina visar bara kunder där du själv placerat.', mal: 'utr-omfang' },
  { rubrik: 'Tryck på en kund', text: 'Då ser du kundens stationer på karta, i lista och på planritningar. Där flyttar du, byter typ och hämtar upp. Schema öppnar kundens kontroller.', mal: 'utr-kunder' },
]

function lasScope(): StationScope {
  try { return localStorage.getItem(STATION_SCOPE_STORAGE_KEY) === 'own' ? 'own' : 'all' } catch { return 'all' }
}
function lasSortering(): Sortering {
  try {
    const v = localStorage.getItem(SORT_NYCKEL)
    return v === 'count' || v === 'health' || v === 'recent' || v === 'schema' ? v : 'name'
  } catch { return 'name' }
}
function lasAttGoraKarta(): boolean {
  try { return localStorage.getItem(ATTGORA_KARTA_NYCKEL) === 'oppen' } catch { return false }
}

export default function NyUtrustning() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const technicianId = profile?.technician_id || ''
  const technicianName = profile?.technicians?.name?.trim() || null

  const tabParam = searchParams.get('tab')
  const flik: Flik = tabParam === 'karta' || tabParam === 'kontroller' ? tabParam : 'kunder'
  const setFlik = useCallback((t: Flik) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', t)
      next.delete('customer')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const [fetchedEquipment, setFetchedEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [fetchedCustomers, setFetchedCustomers] = useState<CustomerStationSummary[]>([])
  const [laddar, setLaddar] = useState(true)
  const [uppdaterar, setUppdaterar] = useState(false)
  const [uppdaterad, setUppdaterad] = useState<string | null>(null)
  const [scope, setScope] = useState<StationScope>(lasScope)
  const [sok, setSok] = useState('')
  const [sortering, setSorteringState] = useState<Sortering>(lasSortering)
  const [visaMig, setVisaMig] = useState(false)
  const [avslutar, setAvslutar] = useState<string | null>(null)
  const [oppetArende, setOppetArende] = useState<ArendeRef | null>(null)
  const [attGoraKarta, setAttGoraKartaState] = useState<boolean>(lasAttGoraKarta)
  const [attGoraTelefonKarta, setAttGoraTelefonKarta] = useState(false)

  const setScopeOchSpara = (s: StationScope) => {
    setScope(s)
    try { localStorage.setItem(STATION_SCOPE_STORAGE_KEY, s) } catch { /* privat läge */ }
  }
  const setSortering = (s: Sortering) => {
    setSorteringState(s)
    try { localStorage.setItem(SORT_NYCKEL, s) } catch { /* privat läge */ }
  }
  const setAttGoraKarta = (oppen: boolean) => {
    setAttGoraKartaState(oppen)
    try { localStorage.setItem(ATTGORA_KARTA_NYCKEL, oppen ? 'oppen' : 'stangd') } catch { /* privat läge */ }
  }

  const pagaende = usePagaendeEtableringar(technicianId)
  const laddaPagaende = pagaende.ladda

  // Kontrollerna hämtas en gång för sidan och delas av Att göra, Kunder och Kontroller
  const kundIds = useMemo(() => fetchedCustomers.map(c => c.customer_id), [fetchedCustomers])
  const kontroll = useKontrollData(technicianId, kundIds)
  // Ref så att Uppdatera når senaste laddaren utan att själv byta identitet
  const laddaKontrollRef = useRef(kontroll.ladda)
  useEffect(() => { laddaKontrollRef.current = kontroll.ladda }, [kontroll.ladda])

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
      setUppdaterad(klockslag(new Date()))
    } catch (e) {
      console.error('Fel vid hämtning av stationer:', e)
      toast.error('Kunde inte hämta stationerna')
    } finally {
      setUppdaterar(false)
      setLaddar(false)
    }
    void laddaPagaende()
    void laddaKontrollRef.current()
  }, [technicianId, laddaPagaende])

  useEffect(() => { void refreshData() }, [refreshData])

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

  // Utomhustyper per kund (typrutor i kundlistan), aktiva stationer
  const typerPerKund = useMemo(() => {
    const m = new Map<string, Map<string, TypRad>>()
    for (const e of fetchedEquipment) {
      if (e.status === 'removed') continue
      const t = typInfo(e)
      const k = m.get(e.customer_id) ?? new Map<string, TypRad>()
      const rad = k.get(t.namn) ?? { namn: t.namn, farg: t.farg, ikon: t.ikon, antal: 0 }
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

  // Kunder i listan som saknar aktivt schema (samma urval som gamla kontrollfliken)
  const saknarSchema = useMemo(
    () => (kontroll.medSchema ? allCustomers.filter(c => !kontroll.medSchema!.has(c.customer_id)) : []),
    [allCustomers, kontroll.medSchema]
  )
  const etableringar = useMemo(() => {
    const idag = svenskDag()
    return pagaende.rader.map(r => etableringInfo(r, idag))
  }, [pagaende.rader])
  const etableringKunder = useMemo(() => new Set(pagaende.rader.map(r => r.customerId)), [pagaende.rader])

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

  const fardig = async (customerId: string, kund: string, kommentar: string) => {
    setAvslutar(customerId)
    try { await flode.finishEstablishmentFor(customerId, kund, kommentar) } finally { setAvslutar(null) }
  }
  const visaKontroller = () => {
    setFlik('kontroller')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const oppnaKontroll = (i: BookedInspection) => {
    if (i.case_id) setOppetArende({ kalla: 'cases', id: i.case_id })
    else navigate(`/technician/equipment/customer/${i.customer_id}?tab=schema`)
  }

  const etableringProps = {
    etableringar,
    onPlacera: (cid: string) => openWizard(cid),
    onFardig: fardig,
    onOppnaArende: (caseId: string) => setOppetArende({ kalla: 'cases', id: caseId }),
    avslutar,
  }

  const kartlage = flik === 'karta'
  const sidokolumnBred = !kartlage || attGoraKarta

  const omfang = (
    <div data-genomgang="utr-omfang" role="tablist" aria-label="Vems stationer" className="flex rounded-xl bg-slate-900 border border-slate-700 p-0.5 flex-shrink-0">
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
  )

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4 pb-28 lg:pb-8">
      {/* Dator: verktygsrad. Rubriken Stationer står i layoutens sidhuvud. */}
      <div className="hidden lg:flex items-center justify-end gap-2">
        {uppdaterad && <span className="text-[13px] text-slate-400">Uppdaterad {uppdaterad}</span>}
        <button type="button" onClick={() => { void refreshData() }} disabled={uppdaterar} className={RADKNAPP}>
          <Icon name="utrustning.uppdatera" size={20} className={uppdaterar ? 'animate-spin' : ''} />
          Uppdatera
        </button>
        <button type="button" data-genomgang="utr-placera" onClick={() => openWizard(null)} className={`${KNAPP_PRIMAR} h-12`}>
          <Icon name="falt.nystation" size={20} />
          Placera station
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-6 items-start ${sidokolumnBred ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-[minmax(0,1fr)_76px]'}`}>
        <div className="min-w-0 space-y-4">
          {/* Telefon och smal dator: Att göra överst */}
          {!laddar && (
            <div className="xl:hidden space-y-3" data-genomgang="utr-attgora">
              {kartlage && !attGoraTelefonKarta ? (
                <AttGoraRad etableringar={etableringar} kontroll={kontroll} onVisa={() => setAttGoraTelefonKarta(true)} />
              ) : (
                <AttGoraTelefon {...etableringProps} kontroll={kontroll} onVisaKontroller={visaKontroller} />
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div data-genomgang="utr-flikar" className="flex-1 sm:flex-none sm:min-w-[420px]">
              <Vaxel<Flik>
                etikett="Visa"
                valt={flik}
                onVal={setFlik}
                val={[
                  { varde: 'kunder', text: 'Kunder', ikon: 'allman.foretag' },
                  { varde: 'karta', text: 'Karta', ikon: 'falt.karta' },
                  {
                    varde: 'kontroller', text: 'Kontroller', ikon: 'utrustning.kontroller',
                    antal: kontroll.grupper.forsenade.length > 0 ? kontroll.grupper.forsenade.length : undefined,
                    antalVarning: true,
                  },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => { void refreshData() }}
              disabled={uppdaterar}
              className={`lg:hidden ${IKONKNAPP} border border-slate-700`}
              aria-label="Uppdatera"
              title="Uppdatera"
            >
              <Icon name="utrustning.uppdatera" size={20} className={uppdaterar ? 'animate-spin' : ''} />
            </button>
          </div>

          {laddar ? (
            <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar stationer och kunder..." /></div>
          ) : (
            <>
              {flik === 'kunder' && (
                <section aria-label="Kunder med stationer" className="space-y-3">
                  <KundLista
                    kunder={allCustomers}
                    typerPerKund={typerPerKund}
                    kontrollPerKund={kontroll.perKund}
                    medSchema={kontroll.medSchema}
                    sok={sok}
                    onSok={setSok}
                    sortering={sortering}
                    onSortering={setSortering}
                    omfang={omfang}
                    onSchemapanel={(customerId, customerName, sites) => setSchedulePanelTarget({ customerId, customerName, sites })}
                    onSchemalagg={flode.handleScheduleFromList}
                  />
                  <HjalpText id="utr-kunder" rubrik="Kunder med stationer" utanRubrik>
                    Tryck på en kund för att se stationerna på karta, i lista och på planritningar. Antalen är kundens alla stationer, även i läget Mina.
                  </HjalpText>
                </section>
              )}

              {flik === 'karta' && (
                <section aria-label="Karta över mina stationer" className="space-y-2">
                  <HjalpText id="utr-karta" rubrik="Karta" utanRubrik>
                    Kartan visar stationerna du själv har placerat, oavsett Alla eller Mina.
                  </HjalpText>
                  {/* isolate: Google Maps-lagren har höga z-index och får inte hamna över sidhuvud och meny */}
                  <div className="relative isolate z-0">
                    <CollapsibleMapSection
                      equipment={kartEquipment}
                      stats={kartStats}
                      rubrik="Utplacerat av mig"
                      onEquipmentClick={(e) => { if (e.customer_id) navigate(`/technician/equipment/customer/${e.customer_id}`) }}
                      defaultExpanded={true}
                      focusCustomerId={mapFocusCustomerId}
                      onFocusCustomerChange={setMapFocusCustomerId}
                      showFitAllButton
                    />
                  </div>
                </section>
              )}

              {flik === 'kontroller' && (
                <KontrollerFlik
                  kontroll={kontroll}
                  saknarSchema={saknarSchema}
                  etableringKunder={etableringKunder}
                  onBokaOm={(customerId, customerName) => setSchedulePanelTarget({ customerId, customerName })}
                  onOppna={oppnaKontroll}
                  onSchemalagg={flode.handleScheduleFromList}
                />
              )}
            </>
          )}
        </div>

        {/* Dator: sidokolumnen Att göra, hopfälld till en list i kartläget */}
        {!laddar && (
          <div className="hidden xl:block sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain -m-1 p-1" data-genomgang="utr-attgora">
            {sidokolumnBred ? (
              <AttGoraKolumn
                {...etableringProps}
                kontroll={kontroll}
                saknarSchema={saknarSchema}
                onVisaKontroller={visaKontroller}
                onDolj={kartlage ? () => setAttGoraKarta(false) : undefined}
              />
            ) : (
              <AttGoraList
                etableringar={etableringar}
                kontroll={kontroll}
                saknarSchema={saknarSchema}
                onVisa={() => setAttGoraKarta(true)}
                onVisaKontroller={visaKontroller}
              />
            )}
          </div>
        )}
      </div>

      {/* Telefon: flytande Placera station ovanför bottenmenyn */}
      <button
        type="button"
        data-genomgang="utr-placera"
        onClick={() => openWizard(null)}
        className={`lg:hidden fixed right-4 z-30 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] shadow-lg shadow-black/30 ${KNAPP_PRIMAR}`}
      >
        <Icon name="falt.nystation" size={20} />
        Placera station
      </button>

      <EtableringsFlode
        flode={flode}
        allCustomers={allCustomers}
        onIndoorFinished={() => { void refreshData() }}
        onTypeChanged={() => { void refreshData() }}
      />

      <ScheduleInfoPanel
        isOpen={!!schedulePanelTarget}
        onClose={() => { setSchedulePanelTarget(null); void laddaKontrollRef.current() }}
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
          void laddaKontrollRef.current()
          // Öppna panelen igen så att den läser om schemat
          if (schedulePanelTarget) {
            const target = { ...schedulePanelTarget }
            setSchedulePanelTarget(null)
            setTimeout(() => setSchedulePanelTarget(target), 100)
          }
        }}
        scheduleId={editScheduleId ?? ''}
      />

      <OppnaArende arende={oppetArende} onClose={() => setOppetArende(null)} onSaved={() => { void refreshData() }} />

      {!laddar && (
        <Genomgang
          id="ny-stationer"
          steg={pagaende.rader.length > 0 ? GENOMGANG : GENOMGANG.filter(s => s.mal !== 'utr-etablering')}
          tvinga={visaMig}
          onStang={() => setVisaMig(false)}
        />
      )}
    </div>
  )
}

// src/pages/shared/SpecialReportEditorPage.tsx
// Redigeraren för en specialrapport (/technician|/koordinator/specialrapporter/:id).
// Desktop (från lg): rapportens delar | redigering | levande förhandsvisning
// ("Så ser kunden rapporten") som byggs från lokalt tillstånd. Förhandsvisningen
// blir egen högerspalt bara när redigeringen ändå får minst 520 px (sidans bredd
// mäts med ResizeObserver, appens sidomeny kan vara utfälld). Annars öppnar
// "Visa som kund" i rubrikraden den i en utfällbar panel ovanpå.
// Mobil: fast flikrad längst ned med Delar, Redigera och Visa som kund.
// Allt sparas löpande, per fält med ~600 ms fördröjning.
// Ligger under pages/shared eftersom samma sida används av tekniker,
// koordinator och admin (via koordinatorns sökväg).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, MoreVertical } from 'lucide-react'
import Select from '../../components/ui/Select'
import { Icon } from '../../components/icons/Icon'
import { SpecialReportService, nextSectionColor } from '../../services/specialReportService'
import {
  EVENT_TYPES,
  SECTION_LABELS,
  type LatLng,
  type SpecialReport,
  type SpecialReportBlockType,
  type SpecialReportDocType,
  type SpecialReportEvent,
  type SpecialReportEventType,
  type SpecialReportFull,
  type SpecialReportMapView,
  type SpecialReportSection,
  type SpecialReportSectionLabel,
} from '../../types/specialReport'
import AreaMapEditor from '../../components/shared/specialReports/AreaMapEditor'
import SectionEditor from '../../components/shared/specialReports/SectionEditor'
import SendSpecialReportModal from '../../components/shared/specialReports/SendSpecialReportModal'
import MobileAddEventSheet from '../../components/shared/specialReports/MobileAddEventSheet'
import AddSectionModal from '../../components/shared/specialReports/AddSectionModal'
import ReportPreview, { Bladdring } from '../../components/shared/specialReports/ReportPreview'
import PolishReviewModal from '../../components/shared/specialReports/PolishReviewModal'
import type { EventPatch, FullSection, PolishTarget, SectionOps } from '../../components/shared/specialReports/sectionOps'
import { POLISH_MAX_CHARS, POLISH_MAX_FIELDS, type PolishChange, type PolishField } from '../../types/textPolish'
import {
  DOC_TYPES,
  PRIMAR_KNAPP,
  SEKUNDAR_KNAPP,
  SNYGGA_KNAPP,
  TEXTFALT,
  byggSidor,
  fargForDel,
  idagISO,
  klarAttSkicka,
  klockslag,
  laddaNed,
  senastAndrad,
  sidaForVy,
  useArDesktop,
  useDebouncedSaver,
  useSpecialReportBase,
  type KlarMal,
} from '../../components/shared/specialReports/specialReportUtils'

/** 'om' | 'oversikt' | 'samm' | en dels id */
type Vy = string
type MobilFlik = 'delar' | 'redigera' | 'kund'

/** Knapparna i rubrikraden: bara ikon på smala skärmar, text från md (Skicka från sm) */
const HUVUD_KNAPP = SEKUNDAR_KNAPP.replace('px-4', 'w-11 md:w-auto md:px-3.5')
/** Snygga till hela rapporten: grön ram och text, bara ikon under xl */
const SNYGGA_HELA_KNAPP = SEKUNDAR_KNAPP
  .replace('px-4', 'w-11 xl:w-auto xl:px-3.5')
  .replace('border-slate-700 text-slate-200', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold')

/** Rapportens textfält som Snygga till kan ändra (fältets id i granskningen) */
type RapportTextFalt = 'intro' | 'assessment' | 'recommendations'
const RAPPORT_TEXT_NAMN: Record<RapportTextFalt, string> = {
  intro: 'Inledning',
  assessment: 'Bedömning',
  recommendations: 'Rekommendationer',
}
const SKICKA_KNAPP = PRIMAR_KNAPP.replace('px-4', 'w-11 sm:w-auto sm:px-4')

/** Redigeringen ska alltid få minst så här mycket bredd när förhandsvisningen är spalt */
const MIN_REDIGERING = 520

/** Delarnas spalt och förhandsvisningens spalt (0 = ingen spalt, panel i stället) */
function spaltBredder(rotBredd: number): { delar: number; forhand: number } {
  const delar = rotBredd >= 1280 ? 300 : 264
  if (rotBredd - delar - 460 >= MIN_REDIGERING + 80) return { delar, forhand: 460 }
  if (rotBredd - delar - 380 >= MIN_REDIGERING) return { delar, forhand: 380 }
  return { delar, forhand: 0 }
}

const felText = (e: unknown, reserv: string) => (e instanceof Error ? e.message : reserv)
const sorteraSektioner = (s: FullSection[]) => [...s].sort((a, b) => a.position - b.position)

/** Block som en ny del får, per typ */
const NYA_BLOCK: Record<SpecialReportSectionLabel, SpecialReportBlockType[]> = {
  omrade: ['map', 'text', 'events'],
  besok: ['text', 'events'],
  underlev: ['text', 'events'],
  fritt: ['text', 'images'],
}

export default function SpecialReportEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const base = useSpecialReportBase()
  const [searchParams, setSearchParams] = useSearchParams()
  const saver = useDebouncedSaver(600)
  const arDesktop = useArDesktop()

  const [report, setReport] = useState<SpecialReportFull | null>(null)
  const [laddarFel, setLaddarFel] = useState<string | null>(null)
  const [vy, setVy] = useState<Vy>('oversikt')
  const [mobilFlik, setMobilFlik] = useState<MobilFlik>('delar')
  const [visaSkicka, setVisaSkicka] = useState(false)
  const [visaNyHandelse, setVisaNyHandelse] = useState(false)
  const [visaLaggTill, setVisaLaggTill] = useState(false)
  const [hamtarPdf, setHamtarPdf] = useState(false)
  // Förhandsvisningen som utfällbar panel (desktop utan plats för spalten)
  const [visaPanel, setVisaPanel] = useState(false)
  // Snygga till: fälten som läses igenom och vad granskningsrutan heter
  const [polish, setPolish] = useState<{ fields: PolishField[]; scopeLabel: string } | null>(null)
  // Senaste rapporten, för Ångra efter Snygga till (toasten har en gammal closure)
  const reportRef = useRef<SpecialReportFull | null>(null)
  useEffect(() => { reportRef.current = report }, [report])
  // Hindrar dubbla delar vid dubbelklick (Lägg till del, Skapa en del per besök)
  const skaparDelRef = useRef(false)

  // Fältet som har fokus (data-falt) och en begäran att flytta fokus dit
  const [fokus, setFokus] = useState<string | null>(null)
  const [fokusFalt, setFokusFalt] = useState<{ falt: string; token: number } | null>(null)
  // Ny del: rubrikfältet får fokus direkt
  const [nyDelId, setNyDelId] = useState<string | null>(null)
  const rotRef = useRef<HTMLDivElement | null>(null)

  // Sidans bredd (inom appens layout), avgör om förhandsvisningen får en egen spalt.
  // Callback-ref eftersom behållaren monteras först när rapporten är hämtad
  const [rotBredd, setRotBredd] = useState(0)
  const observatorRef = useRef<ResizeObserver | null>(null)
  const satRot = useCallback((el: HTMLDivElement | null) => {
    rotRef.current = el
    observatorRef.current?.disconnect()
    observatorRef.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    setRotBredd(Math.round(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(poster => {
      const post = poster[0]
      if (post) setRotBredd(Math.round(post.contentRect.width))
    })
    ro.observe(el)
    observatorRef.current = ro
  }, [])
  useEffect(() => () => observatorRef.current?.disconnect(), [])
  const bredder = spaltBredder(rotBredd)
  const forhandSomSpalt = arDesktop && bredder.forhand > 0
  const forhandSomPanel = arDesktop && !forhandSomSpalt

  // Panelen stängs när spalten får plats igen eller när vi lämnar desktop
  useEffect(() => {
    if (!forhandSomPanel) setVisaPanel(false)
  }, [forhandSomPanel])

  // Escape stänger panelen
  useEffect(() => {
    if (!visaPanel) return
    const stang = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisaPanel(false) }
    document.addEventListener('keydown', stang)
    return () => document.removeEventListener('keydown', stang)
  }, [visaPanel])

  // Karta: valt område, rit- och fokusbegäran, nyss ritad del som ska namnges.
  // Utsnittet sparas bara när översiktskartan är med i rapporten (map_view satt)
  const [kartValt, setKartValt] = useState<string | null>(null)
  const [ritBegaran, setRitBegaran] = useState<{ sectionId: string | null; token: number } | null>(null)
  const [fokusBegaran, setFokusBegaran] = useState<{ sectionId: string; token: number } | null>(null)
  const [namnger, setNamnger] = useState<string | null>(null)
  const kartVyRef = useRef<(() => SpecialReportMapView | null) | null>(null)

  // Dra och släpp och flyttmenyn i listan
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [menyFor, setMenyFor] = useState<string | null>(null)
  const radRefs = useRef(new Map<string, HTMLButtonElement>())

  const reportId = report?.id

  // ── Laddning ──
  const { flush: sparaVantande, harVantande, andringsNr } = saver
  const ladda = useCallback(async (forsta = false) => {
    if (!id) return
    try {
      // Spara det som väntar först. Ändras något under hämtningen hämtas det igen,
      // annars skulle serverns svar skriva över text som just skrivits. Räknaren
      // fångar även en ändring som hann sparas klart medan hämtningen pågick
      let r: SpecialReportFull | null = null
      for (let forsok = 0; forsok < 5; forsok++) {
        await sparaVantande()
        const fore = andringsNr()
        const hamtad = await SpecialReportService.get(id)
        if (!harVantande() && andringsNr() === fore) { r = hamtad; break }
      }
      // Användaren skriver fortfarande: behåll det lokala, nästa laddning tar resten
      if (!r) return
      const sorterad = { ...r, sections: sorteraSektioner(r.sections) }
      setReport(sorterad)
      if (forsta) {
        const harOmraden = sorterad.sections.some(s => s.area && s.area.length >= 3)
        setVy(!harOmraden && !sorterad.map_view && sorterad.sections.length > 0 ? sorterad.sections[0].id : 'oversikt')
      }
    } catch (e) {
      if (forsta) setLaddarFel(felText(e, 'Kunde inte hämta rapporten'))
      else toast.error(felText(e, 'Kunde inte uppdatera rapporten'))
    }
  }, [id, sparaVantande, harVantande, andringsNr])

  useEffect(() => { void ladda(true) }, [ladda])

  // ?skicka=1 från listan öppnar utskicket direkt
  useEffect(() => {
    if (report && searchParams.get('skicka') === '1') {
      setVisaSkicka(true)
      searchParams.delete('skicka')
      setSearchParams(searchParams, { replace: true })
    }
  }, [report, searchParams, setSearchParams])

  useEffect(() => {
    if (report) document.title = `${report.title} - Specialrapport`
  }, [report])

  const sektioner = useMemo(() => report?.sections ?? [], [report])
  // Kartans vy av delarna, ny bara när nummer, rubrik, färg eller område ändras
  const kartSektioner = useMemo(
    () => sektioner.map((s, i) => ({ id: s.id, nr: i + 1, title: s.title, area: s.area, color: fargForDel(s.color, i) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(sektioner.map(s => [s.id, s.title, s.area, s.color]))],
  )

  // ── Fokus: flytta skrivmarkören till ett fält (klick i förhandsvisningen, Klar att skicka) ──
  useEffect(() => {
    if (!fokusFalt) return
    let ram = 0
    const prova = (kvar: number) => {
      ram = requestAnimationFrame(() => {
        const el = rotRef.current?.querySelector<HTMLElement>(`[data-falt="${fokusFalt.falt}"]`)
        if (!el || el.offsetParent === null) {
          // Fältet finns inte än (vyn monteras): försök några bilder till, sedan
          // släpps begäran så att fokus inte hoppar dit långt senare
          if (kvar > 0) prova(kvar - 1)
          else setFokusFalt(null)
          return
        }
        const mal = el.matches('input, textarea, select, button')
          ? el
          : el.querySelector<HTMLElement>('input:not([disabled]), textarea, select, button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        mal?.focus({ preventScroll: true })
        setFokus(fokusFalt.falt)
        setFokusFalt(null)
      })
    }
    prova(30)
    return () => cancelAnimationFrame(ram)
  }, [fokusFalt])

  /** Vilket fält användaren arbetar i, från närmaste data-falt */
  const folj = (e: { target: EventTarget }) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-falt]')
    const falt = el?.getAttribute('data-falt')
    if (falt) setFokus(falt)
  }

  // Flyttmenyn stängs vid klick utanför och Escape
  useEffect(() => {
    if (!menyFor) return
    const stang = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof PointerEvent && (e.target as HTMLElement | null)?.closest('[data-flyttmeny]')) return
      setMenyFor(null)
    }
    document.addEventListener('pointerdown', stang)
    document.addEventListener('keydown', stang)
    return () => {
      document.removeEventListener('pointerdown', stang)
      document.removeEventListener('keydown', stang)
    }
  }, [menyFor])

  // ── Lokala uppdateringar ──
  const andraRapport = useCallback((patch: Partial<SpecialReport>) => {
    setReport(r => (r ? { ...r, ...patch } : r))
  }, [])

  const andraSektion = useCallback((sectionId: string, fn: (s: FullSection) => FullSection) => {
    setReport(r => (r ? { ...r, sections: r.sections.map(s => (s.id === sectionId ? fn(s) : s)) } : r))
  }, [])

  const sparfel = useCallback((e: unknown) => toast.error(felText(e, 'Kunde inte spara')), [])

  type RapportFalt = 'title' | 'doc_type' | 'intro' | 'assessment' | 'recommendations' | 'map_view'
  const sparaRapportFalt = useCallback(<K extends RapportFalt>(falt: K, varde: SpecialReport[K]) => {
    if (!reportId) return
    andraRapport({ [falt]: varde } as Partial<SpecialReport>)
    // Tom rubrik sparas inte (tjänsten kräver en), det senast sparade gäller
    if (falt === 'title' && !String(varde ?? '').trim()) { saver.cancel(`rapport:${falt}`); return }
    saver.schedule(`rapport:${falt}`, () => SpecialReportService.updateReport(reportId, { [falt]: varde } as Partial<Pick<SpecialReport, RapportFalt>>), sparfel)
  }, [reportId, andraRapport, saver, sparfel])

  // ── Navigering i redigeraren ──
  const gaTill = useCallback((nyVy: Vy, falt: string | null = null) => {
    setVy(nyVy)
    setRitBegaran(null)
    setFokusBegaran(null)
    setNamnger(null)
    setNyDelId(null)
    if (nyVy !== 'oversikt') setKartValt(null)
    setMobilFlik('redigera')
    setFokus(falt)
    setFokusFalt(falt ? { falt, token: Date.now() } : null)
  }, [])

  const gaTillMal = (mal: KlarMal) => {
    if ('laggTillDel' in mal) setVisaLaggTill(true)
    else gaTill(mal.vy, mal.falt)
  }

  // ── Delar ──
  // Nästa lediga färg räknas från det lokala tillståndet (färgbyten som inte hunnit
  // sparas räknas med), med samma reserv som visas för delar utan färg
  const nastaFarg = () => nextSectionColor(sektioner.map((s, i) => fargForDel(s.color, i)))

  const laggTillDel = async (label: SpecialReportSectionLabel) => {
    if (!reportId || skaparDelRef.current) return
    if (label === 'omrade') {
      // Område: kartan öppnas och ritningen startar, delen skapas när området är klart
      setVisaLaggTill(false)
      gaTill('oversikt')
      setRitBegaran({ sectionId: null, token: Date.now() })
      return
    }
    skaparDelRef.current = true
    try {
      const s = await SpecialReportService.addSection(reportId, { title: '', label, blocks: NYA_BLOCK[label], color: nastaFarg() })
      setReport(r => (r ? { ...r, sections: [...r.sections, s] } : r))
      setVisaLaggTill(false)
      gaTill(s.id)
      setNyDelId(s.id)
    } catch (e) {
      toast.error(felText(e, 'Kunde inte lägga till delen'))
    } finally {
      skaparDelRef.current = false
    }
  }

  const skapaDelPerBesok = async () => {
    if (!reportId || skaparDelRef.current) return
    skaparDelRef.current = true
    try {
      // Färgbyten som väntar ska vara sparade, tjänsten väljer färg ur databasen
      await saver.flush()
      const nya = await SpecialReportService.createSectionsForVisits(reportId)
      if (nya.length === 0) { toast('Alla besök finns redan i rapporten'); return }
      setReport(r => {
        if (!r) return r
        const finns = new Set(r.sections.map(s => s.id))
        return { ...r, sections: sorteraSektioner([...r.sections, ...nya.filter(s => !finns.has(s.id))]) }
      })
      setVisaLaggTill(false)
      gaTill(nya[0].id)
      toast.success(nya.length === 1 ? 'En del skapades för besöket' : `${nya.length} delar skapades, en per besök`)
    } catch (e) {
      toast.error(felText(e, 'Kunde inte skapa delarna'))
    } finally {
      skaparDelRef.current = false
    }
  }

  const skapaOmradesDel = async (area: LatLng[]) => {
    if (!reportId || skaparDelRef.current) return
    skaparDelRef.current = true
    try {
      const s = await SpecialReportService.addSection(reportId, { title: '', label: 'omrade', area, blocks: NYA_BLOCK.omrade, color: nastaFarg() })
      setReport(r => (r ? { ...r, sections: [...r.sections, s] } : r))
      // Kvar på kartan: rutan "Vad heter området?" tar namn och färg
      setKartValt(s.id)
      setNamnger(s.id)
    } catch (e) {
      toast.error(felText(e, 'Kunde inte skapa delen'))
    } finally {
      skaparDelRef.current = false
    }
  }

  const sparaOrdning = (lista: FullSection[]) => {
    if (!reportId) return
    const ordnad = lista.map((s, i) => ({ ...s, position: i }))
    setReport(r => (r ? { ...r, sections: ordnad } : r))
    saver.now(() => SpecialReportService.reorderSections(reportId, ordnad.map(s => s.id))).catch(sparfel)
  }

  const flytta = (franId: string | null, tillId: string) => {
    setDragId(null)
    setOverId(null)
    if (!franId || franId === tillId) return
    const lista = sektioner.slice()
    const [flyttad] = lista.splice(lista.findIndex(s => s.id === franId), 1)
    const till = lista.findIndex(s => s.id === tillId)
    lista.splice(till < 0 ? lista.length : till, 0, flyttad)
    sparaOrdning(lista)
  }

  const flyttaSteg = (sectionId: string, steg: -1 | 1) => {
    const i = sektioner.findIndex(s => s.id === sectionId)
    const j = i + steg
    if (i < 0 || j < 0 || j >= sektioner.length) return
    const lista = sektioner.slice()
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    sparaOrdning(lista)
    requestAnimationFrame(() => radRefs.current.get(sectionId)?.focus())
  }

  // ── Handlingar för delvyn ──
  const ops: SectionOps = {
    updateSection: (sectionId, patch) => {
      andraSektion(sectionId, s => ({ ...s, ...patch }))
      ;(Object.keys(patch) as (keyof typeof patch)[]).forEach(k => {
        const delpatch = { [k]: patch[k] } as Partial<Pick<SpecialReportSection, 'title' | 'subtitle' | 'label' | 'area' | 'color'>>
        saver.schedule(`sektion:${sectionId}:${k}`, () => SpecialReportService.updateSection(sectionId, delpatch), sparfel)
      })
    },
    deleteSection: async sectionId => {
      try {
        await saver.now(() => SpecialReportService.deleteSection(sectionId))
        setReport(r => (r ? { ...r, sections: r.sections.filter(s => s.id !== sectionId) } : r))
        gaTill('oversikt')
        setMobilFlik('delar')
        toast.success('Delen är borttagen')
      } catch (e) {
        toast.error(felText(e, 'Kunde inte ta bort delen'))
      }
    },
    addBlock: async (sectionId, type: SpecialReportBlockType) => {
      try {
        const b = await SpecialReportService.addBlock(sectionId, type)
        andraSektion(sectionId, s => ({ ...s, blocks: [...s.blocks, b] }))
      } catch (e) {
        toast.error(felText(e, 'Kunde inte lägga till blocket'))
      }
    },
    updateBlockText: (sectionId, blockId, text) => {
      andraSektion(sectionId, s => ({ ...s, blocks: s.blocks.map(b => (b.id === blockId ? { ...b, content: { ...b.content, text } } : b)) }))
      saver.schedule(`block:${blockId}`, () => SpecialReportService.updateBlock(blockId, { text }), sparfel)
    },
    deleteBlock: async (sectionId, blockId) => {
      try {
        await saver.now(() => SpecialReportService.deleteBlock(blockId))
        andraSektion(sectionId, s => ({ ...s, blocks: s.blocks.filter(b => b.id !== blockId) }))
      } catch (e) {
        toast.error(felText(e, 'Kunde inte ta bort blocket'))
      }
    },
    moveBlock: (sectionId, blockId, steg) => {
      const s = sektioner.find(x => x.id === sectionId)
      if (!s) return
      const lista = [...s.blocks].sort((a, b) => a.position - b.position)
      const i = lista.findIndex(b => b.id === blockId)
      const j = i + steg
      if (i < 0 || j < 0 || j >= lista.length) return
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
      const ordnad = lista.map((b, n) => ({ ...b, position: n }))
      andraSektion(sectionId, x => ({ ...x, blocks: ordnad }))
      saver.now(() => SpecialReportService.reorderBlocks(sectionId, ordnad.map(b => b.id))).catch(sparfel)
    },
    addEvent: async (sectionId, type: SpecialReportEventType) => {
      try {
        let ev: SpecialReportEvent | null = null
        await saver.now(async () => {
          ev = await SpecialReportService.addEvent(sectionId, {
            event_date: idagISO(),
            type,
            title: EVENT_TYPES[type].defaultTitle,
            description: null,
          })
        })
        const ny = ev as SpecialReportEvent | null
        if (ny) andraSektion(sectionId, s => ({ ...s, events: [...s.events, ny] }))
        return ny
      } catch (e) {
        toast.error(felText(e, 'Kunde inte lägga till händelsen'))
        return null
      }
    },
    updateEvent: (sectionId, eventId, patch: EventPatch) => {
      andraSektion(sectionId, s => ({ ...s, events: s.events.map(e => (e.id === eventId ? { ...e, ...patch } : e)) }))
      ;(Object.keys(patch) as (keyof EventPatch)[]).forEach(k => {
        const delpatch = { [k]: patch[k] } as EventPatch
        const ogiltig = (k === 'title' && !(patch.title ?? '').trim())
          || (k === 'event_date' && !/^\d{4}-\d{2}-\d{2}$/.test(patch.event_date ?? ''))
        if (ogiltig) { saver.cancel(`handelse:${eventId}:${k}`); return }
        saver.schedule(`handelse:${eventId}:${k}`, () => SpecialReportService.updateEvent(eventId, delpatch), sparfel)
      })
    },
    deleteEvent: async (sectionId, eventId) => {
      try {
        await saver.now(() => SpecialReportService.deleteEvent(eventId))
        andraSektion(sectionId, s => ({ ...s, events: s.events.filter(e => e.id !== eventId) }))
      } catch (e) {
        toast.error(felText(e, 'Kunde inte ta bort händelsen'))
      }
    },
    eventsImported: (sectionId, events) => {
      andraSektion(sectionId, s => ({ ...s, events: [...s.events, ...events] }))
    },
    uploadImages: async (sectionId, files) => {
      if (!reportId) return
      let fel = 0
      for (const fil of files) {
        try {
          const bild = await SpecialReportService.uploadImage(reportId, sectionId, fil)
          andraSektion(sectionId, s => ({ ...s, images: [...s.images, bild] }))
        } catch (e) {
          fel += 1
          if (fel === 1) toast.error(felText(e, 'Kunde inte ladda upp bilden'))
        }
      }
      if (fel > 1) toast.error(`${fel} bilder kunde inte laddas upp`)
    },
    updateImageCaption: (sectionId, imageId, caption) => {
      andraSektion(sectionId, s => ({ ...s, images: s.images.map(b => (b.id === imageId ? { ...b, caption } : b)) }))
      saver.schedule(`bild:${imageId}`, () => SpecialReportService.updateImage(imageId, { caption: caption || null }), sparfel)
    },
    deleteImage: async (sectionId, imageId) => {
      try {
        await saver.now(() => SpecialReportService.deleteImage(imageId))
        andraSektion(sectionId, s => ({ ...s, images: s.images.filter(b => b.id !== imageId) }))
      } catch (e) {
        toast.error(felText(e, 'Kunde inte ta bort bilden'))
      }
    },
    showArea: sectionId => {
      gaTill('oversikt')
      setKartValt(sectionId)
      setFokusBegaran({ sectionId, token: Date.now() })
    },
    drawArea: sectionId => {
      gaTill('oversikt')
      setKartValt(sectionId)
      setRitBegaran({ sectionId, token: Date.now() })
    },
  }

  // ── Snygga till ──
  // Fältens id: rapport:<fält>, del:<del>:title|subtitle, block:<del>:<block>,
  // handelse:<del>:<händelse>:title|description, bild:<del>:<bild>
  const polishKontext = useMemo(
    () => ({ customerName: report?.customer_name ?? null, address: report?.address ?? null }),
    [report?.customer_name, report?.address],
  )

  /** Fälten som ett Snygga till-val läser igenom, i rapportens ordning. Tomma fält hoppas över */
  const samlaFalt = (mal: PolishTarget): { fields: PolishField[]; scopeLabel: string } => {
    const r = report
    if (!r) return { fields: [], scopeLabel: '' }
    const falt: PolishField[] = []
    const lagg = (id: string, label: string, text: string | null | undefined) => {
      if (text && text.trim()) falt.push({ id, label, text })
    }
    const rapportFalt = (k: RapportTextFalt) => lagg(`rapport:${k}`, RAPPORT_TEXT_NAMN[k], r[k])
    const delFalt = (s: FullSection, i: number, vad: 'hela' | 'text' | 'handelser' | 'bilder', blockId?: string) => {
      const prefix = `Del ${i + 1} · ${s.title.trim() || 'Utan rubrik'}`
      const block = [...s.blocks].sort((a, b) => a.position - b.position)
      if (vad === 'hela') {
        lagg(`del:${s.id}:title`, `${prefix} · Rubrik`, s.title)
        lagg(`del:${s.id}:subtitle`, `${prefix} · Underrubrik`, s.subtitle)
      }
      const textblock = block.filter(b => b.type === 'text')
      for (const b of block) {
        if (b.type === 'text' && (vad === 'hela' || (vad === 'text' && b.id === blockId))) {
          const n = textblock.length > 1 ? ` ${textblock.indexOf(b) + 1}` : ''
          lagg(`block:${s.id}:${b.id}`, `${prefix} · Text${n}`, b.content.text)
        }
        if (b.type === 'events' && (vad === 'hela' || vad === 'handelser')) {
          const handelser = [...s.events].sort((a, b2) => a.event_date.localeCompare(b2.event_date) || a.created_at.localeCompare(b2.created_at))
          for (const ev of handelser) {
            const namn = `${prefix} · Händelse ${ev.event_date}`
            lagg(`handelse:${s.id}:${ev.id}:title`, `${namn} · Rubrik`, ev.title)
            lagg(`handelse:${s.id}:${ev.id}:description`, `${namn} · Beskrivning`, ev.description)
          }
        }
        if (b.type === 'images' && (vad === 'hela' || vad === 'bilder')) {
          const bilder = [...s.images].sort((a, b2) => a.position - b2.position)
          bilder.forEach((bild, n) => lagg(`bild:${s.id}:${bild.id}`, `${prefix} · Bildtext ${n + 1}`, bild.caption))
        }
      }
      return prefix
    }

    switch (mal.typ) {
      case 'hela':
        rapportFalt('intro')
        sektioner.forEach((s, i) => delFalt(s, i, 'hela'))
        rapportFalt('assessment')
        rapportFalt('recommendations')
        return { fields: falt, scopeLabel: 'Hela rapporten' }
      case 'om':
        rapportFalt('intro')
        return { fields: falt, scopeLabel: 'Om rapporten · Inledning' }
      case 'samm':
        rapportFalt('assessment')
        rapportFalt('recommendations')
        return { fields: falt, scopeLabel: 'Bedömning och åtgärder' }
      default: {
        const i = sektioner.findIndex(s => s.id === mal.sectionId)
        if (i < 0) return { fields: [], scopeLabel: '' }
        const vad = mal.typ === 'block' ? 'text' : mal.typ
        const prefix = delFalt(sektioner[i], i, vad, mal.typ === 'block' ? mal.blockId : undefined)
        const namn = mal.typ === 'block' ? 'Text' : mal.typ === 'handelser' ? 'Händelser' : 'Bildtexter'
        return { fields: falt, scopeLabel: `${prefix} · ${namn}` }
      }
    }
  }

  const oppnaPolish = (mal: PolishTarget) => {
    const { fields, scopeLabel } = samlaFalt(mal)
    if (fields.length === 0) {
      toast('Det finns ingen text att snygga till här')
      return
    }
    const tecken = fields.reduce((n, f) => n + f.text.length, 0)
    if (fields.length > POLISH_MAX_FIELDS || tecken > POLISH_MAX_CHARS) {
      toast.error(mal.typ === 'hela'
        ? 'Rapporten har för mycket text för en genomläsning. Snygga till en del i taget.'
        : 'Det är för mycket text för en genomläsning. Dela upp texten och försök igen.')
      return
    }
    setPolish({ fields, scopeLabel })
  }

  /** Fältets aktuella text i redigeraren, null om fältet inte finns längre */
  const lasFalt = (id: string, r: SpecialReportFull | null = report): string | null => {
    if (!r) return null
    const [typ, a, b, c] = id.split(':')
    if (typ === 'rapport') return (r[a as RapportTextFalt] as string | null) ?? ''
    const s = r.sections.find(x => x.id === a)
    if (!s) return null
    if (typ === 'del') return b === 'title' ? s.title : s.subtitle ?? ''
    if (typ === 'block') {
      const blk = s.blocks.find(x => x.id === b)
      return blk ? blk.content.text ?? '' : null
    }
    if (typ === 'handelse') {
      const ev = s.events.find(x => x.id === b)
      return ev ? (c === 'title' ? ev.title : ev.description ?? '') : null
    }
    if (typ === 'bild') {
      const bild = s.images.find(x => x.id === b)
      return bild ? bild.caption ?? '' : null
    }
    return null
  }

  /** Skriver fältet via samma sparväg som när man skriver (fördröjd sparning och förhandsvisning följer med) */
  const skrivFalt = (id: string, text: string) => {
    const [typ, a, b, c] = id.split(':')
    if (typ === 'rapport') sparaRapportFalt(a as RapportTextFalt, text || null)
    else if (typ === 'del') ops.updateSection(a, b === 'title' ? { title: text } : { subtitle: text || null })
    else if (typ === 'block') ops.updateBlockText(a, b, text)
    else if (typ === 'handelse') ops.updateEvent(a, b, c === 'title' ? { title: text } : { description: text || null })
    else if (typ === 'bild') ops.updateImageCaption(a, b, text)
  }

  const tillampaPolish = (falt: PolishField[], valda: PolishChange[]) => {
    const original: { id: string; text: string; ny: string }[] = []
    let antal = 0
    let andrade = 0
    for (const f of falt) {
      const egna = valda.filter(c => c.fieldId === f.id)
      if (egna.length === 0) continue
      // Texten får inte ha ändrats sedan genomläsningen, annars hamnar ändringarna fel
      if (lasFalt(f.id) !== f.text) { andrade += 1; continue }
      let text = f.text
      for (const c of [...egna].sort((x, y) => y.start - x.start || y.end - x.end)) {
        text = text.slice(0, c.start) + c.to + text.slice(c.end)
      }
      original.push({ id: f.id, text: f.text, ny: text })
      skrivFalt(f.id, text)
      antal += egna.length
    }
    setPolish(null)
    if (andrade > 0) toast.error('Texten har ändrats sedan genomläsningen, kör Snygga till igen', { duration: 6000 })
    if (antal === 0) return
    toast(t => (
      <span className="flex items-center gap-3">
        <Icon name="allman.bock" size={20} className="flex-shrink-0 text-[#20c58f]" />
        <span className="text-sm">{antal === 1 ? '1 ändring gjord' : `${antal} ändringar gjorda`}</span>
        <button
          type="button"
          onClick={() => {
            // Fält som skrivits i efter Snygga till lämnas orörda, annars försvinner det nya
            const senare = original.filter(o => lasFalt(o.id, reportRef.current) !== o.ny)
            original.filter(o => !senare.includes(o)).forEach(o => skrivFalt(o.id, o.text))
            toast.dismiss(t.id)
            if (senare.length === 0) toast.success('Ändringarna är ångrade')
            else toast.error(`${senare.length === 1 ? 'Ett fält har' : `${senare.length} fält har`} ändrats efteråt och ångrades inte`, { duration: 6000 })
          }}
          className="h-11 rounded-lg border border-slate-600 px-3 text-sm hover:bg-slate-800"
        >
          Ångra
        </button>
      </span>
    ), { duration: 10000 })
  }

  // ── PDF ──
  const laddaNedPdf = async () => {
    if (!reportId) return
    setHamtarPdf(true)
    try {
      await saver.flush()
      const { url, filename } = await SpecialReportService.downloadPdf(reportId)
      await laddaNed(url, filename)
    } catch (e) {
      toast.error(felText(e, 'Kunde inte ta fram PDF:en'))
    } finally {
      setHamtarPdf(false)
    }
  }

  // ── Översiktskartan med i rapporten ──
  const vaxlaOversikt = (med: boolean) => {
    if (!med) {
      sparaRapportFalt('map_view', null)
      return
    }
    const v = kartVyRef.current?.()
    if (v) sparaRapportFalt('map_view', v)
  }

  // ── Laddning och fel ──
  if (laddarFel) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Icon name="rapport.rapport" size={32} className="mx-auto mb-2 text-slate-500" />
        <p className="text-sm text-slate-300">{laddarFel}</p>
        <button type="button" onClick={() => navigate(base)} className="mt-4 text-sm text-[#20c58f] hover:underline">Till specialrapporterna</button>
      </div>
    )
  }
  if (!report) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const aktuellIndex = sektioner.findIndex(s => s.id === vy)
  const aktuell = aktuellIndex >= 0 ? sektioner[aktuellIndex] : null
  const antalOmraden = sektioner.filter(s => s.area && s.area.length >= 3).length
  const klar = klarAttSkicka(report)
  const klarAntal = klar.filter(p => p.klar).length
  const sidor = byggSidor(report)
  const sidIndex = sidaForVy(sidor, vy)

  const statusText = saver.status === 'sparar'
    ? 'Sparar...'
    : saver.status === 'fel'
      ? 'Kunde inte spara'
      : saver.status === 'sparad' && saver.sparadTid
        ? `Sparad ${klockslag(saver.sparadTid)}`
        : `Sparad ${senastAndrad(report.updated_at).replace('I dag ', '')}`
  const statusPunkt = saver.status === 'fel' ? 'bg-red-500' : saver.status === 'sparar' ? 'bg-amber-400' : 'bg-[#20c58f]'

  const listKnapp = (aktiv: boolean) =>
    `flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors ${
      aktiv ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'
    }`

  const adressDelar = (report.address ?? '').split(',').map(x => x.trim()).filter(Boolean)

  return (
    <div ref={satRot} className="flex w-full min-w-0 flex-col lg:h-[calc(100dvh-3rem)]">
      {/* ── Rubrikrad ── */}
      <header className="flex min-w-0 flex-shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 py-2 pl-1 pr-3 sm:gap-2.5 sm:pl-2 sm:pr-5">
        <button
          type="button"
          aria-label={mobilFlik !== 'delar' && !arDesktop ? 'Tillbaka till delarna' : 'Tillbaka till rapporterna'}
          onClick={() => (mobilFlik !== 'delar' && !arDesktop ? setMobilFlik('delar') : navigate(base))}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
        >
          <Icon name="rapport.tillbaka" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Rapportens titel"
            data-falt="rapport:title"
            value={report.title}
            onChange={e => sparaRapportFalt('title', e.target.value)}
            onFocus={() => setFokus('rapport:title')}
            className="w-full truncate rounded bg-transparent text-base font-bold text-white outline-none focus:ring-2 focus:ring-[#20c58f]/40 sm:text-[17px]"
          />
          <p className="flex items-center gap-2 truncate text-xs text-slate-400">
            <span className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${statusPunkt}`} />
            <span className="truncate">{statusText} · {report.doc_type} · version {report.current_version} pågår</span>
          </p>
        </div>
        <button
          type="button"
          aria-label="Snygga till hela rapporten"
          title="Snygga till hela rapporten"
          onClick={() => oppnaPolish({ typ: 'hela' })}
          className={SNYGGA_HELA_KNAPP}
        >
          <Icon name="rapport.snygga" size={20} />
          <span className="hidden xl:inline">Snygga till hela rapporten</span>
        </button>
        {/* Visa som kund: mobilen byter flik, desktop utan spalt fäller ut panelen */}
        {!forhandSomSpalt && (
          <button
            type="button"
            aria-label="Visa som kund"
            aria-expanded={forhandSomPanel ? visaPanel : undefined}
            title="Visa som kund"
            onClick={() => (forhandSomPanel ? setVisaPanel(v => !v) : setMobilFlik('kund'))}
            className={HUVUD_KNAPP}
          >
            <Icon name="rapport.forhandsgranska" size={20} />
            <span className="hidden md:inline">Visa som kund</span>
          </button>
        )}
        <button
          type="button"
          aria-label="Ladda ner PDF"
          title="Ladda ner PDF"
          onClick={laddaNedPdf}
          disabled={hamtarPdf}
          className={HUVUD_KNAPP}
        >
          {hamtarPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.ladda" size={20} />}
          <span className="hidden md:inline">Ladda ner PDF</span>
        </button>
        <button type="button" aria-label="Skicka till kund" onClick={() => setVisaSkicka(true)} className={SKICKA_KNAPP}>
          <Icon name="rapport.skicka" size={20} />
          <span className="hidden sm:inline">Skicka till kund</span>
        </button>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* ── Rapportens delar ── */}
        <aside
          className={`${mobilFlik === 'delar' ? 'flex' : 'hidden'} w-full flex-col gap-3.5 overflow-y-auto border-slate-800 p-4 pb-48 lg:flex lg:flex-shrink-0 lg:border-r lg:pb-4`}
          style={arDesktop ? { width: bredder.delar } : undefined}
        >
          {/* Klar att skicka */}
          <div className="space-y-2 rounded-xl border border-[#20c58f]/30 bg-[#20c58f]/5 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-white">Klar att skicka</span>
              <span className="text-xs text-[#20c58f]">{klarAntal} av {klar.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#20c58f]/20" role="progressbar" aria-valuemin={0} aria-valuemax={klar.length} aria-valuenow={klarAntal} aria-label="Klar att skicka">
              <div className="h-1.5 rounded-full bg-[#20c58f] transition-all" style={{ width: `${(klarAntal / klar.length) * 100}%` }} />
            </div>
            <ul>
              {klar.map(p => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => gaTillMal(p.mal)}
                    className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-1 text-left text-xs hover:bg-slate-800/60 lg:min-h-[32px] ${p.klar ? 'text-slate-300' : 'text-slate-400'}`}
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${p.klar ? 'bg-[#20c58f]' : 'bg-slate-600'}`} aria-hidden="true" />
                    {p.text}
                    <span className="sr-only">{p.klar ? ', klar' : ', saknas'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500">Rapportens delar</span>
            <span className="hidden text-[11px] text-slate-600 lg:inline">Dra för att ändra ordning</span>
          </div>

          <nav className="flex flex-col gap-1.5" aria-label="Rapportens delar">
            <button type="button" onClick={() => gaTill('om')} className={listKnapp(vy === 'om')}>
              <Icon name="rapport.rapport" size={20} className="flex-shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">Om rapporten</span>
                <span className="block text-[11px] text-slate-400">Kund, adress och inledning</span>
              </span>
            </button>
            <button type="button" onClick={() => gaTill('oversikt')} className={listKnapp(vy === 'oversikt')}>
              <Icon name="rapport.karta" size={20} className="flex-shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">Översiktskarta</span>
                <span className="block text-[11px] text-slate-400">
                  {antalOmraden} {antalOmraden === 1 ? 'område' : 'områden'}{report.map_view ? '' : ' · inte med i rapporten'}
                </span>
              </span>
            </button>

            {sektioner.map((s, i) => {
              const vald = vy === s.id
              const farg = fargForDel(s.color, i)
              const markerad = overId === s.id && dragId && dragId !== s.id
              const harOmrade = !!s.area && s.area.length >= 3
              const visaRitaOmrade = !harOmrade && !!report.map_view
              const namn = s.title.trim()
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={e => {
                    try { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move' } catch { /* äldre webbläsare */ }
                    setDragId(s.id)
                  }}
                  onDragOver={e => { e.preventDefault(); if (overId !== s.id) setOverId(s.id) }}
                  onDrop={e => { e.preventDefault(); flytta(dragId, s.id) }}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  className={`relative flex min-h-[52px] items-center rounded-xl border-[1.5px] transition-colors ${
                    vald ? '' : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'
                  } ${markerad ? 'border-t-2 border-t-[#20c58f]' : ''} ${dragId === s.id ? 'opacity-40' : ''}`}
                  style={vald ? { borderColor: farg, background: `${farg}1a` } : undefined}
                >
                  {/* Hela raden är knappen; "Rita område" och menyn ligger ovanpå */}
                  <button
                    ref={el => { if (el) radRefs.current.set(s.id, el); else radRefs.current.delete(s.id) }}
                    type="button"
                    onClick={() => gaTill(s.id)}
                    onKeyDown={e => {
                      if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); flyttaSteg(s.id, -1) }
                      if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); flyttaSteg(s.id, 1) }
                    }}
                    aria-label={`Del ${i + 1}, ${namn || 'utan rubrik'}. Alt och pil upp eller ned flyttar.`}
                    aria-current={vald ? 'true' : undefined}
                    className="absolute inset-0 cursor-grab rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
                  />
                  <span className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-1.5">
                    <Icon name="rapport.dra" size={16} className="hidden flex-shrink-0 text-slate-600 lg:block" />
                    <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-[#fff]" style={{ background: farg }}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${namn ? 'text-white' : 'text-slate-500'}`}>{namn || 'Utan rubrik'}</span>
                      {visaRitaOmrade ? (
                        <span className="flex items-center gap-1 text-[11px] text-amber-400">
                          Ingen plats ritad ·
                          <button
                            type="button"
                            onClick={() => ops.drawArea(s.id)}
                            className="pointer-events-auto relative z-10 -my-2 py-2 font-semibold underline-offset-2 hover:underline"
                          >
                            Rita område
                          </button>
                        </span>
                      ) : (
                        <span className="block truncate text-[11px] text-slate-400">
                          {SECTION_LABELS[s.label]} · {s.events.length} {s.events.length === 1 ? 'händelse' : 'händelser'}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="relative z-10 flex-shrink-0" data-flyttmeny>
                    <button
                      type="button"
                      aria-label={`Fler val för del ${i + 1}`}
                      aria-haspopup="menu"
                      aria-expanded={menyFor === s.id}
                      onClick={() => setMenyFor(m => (m === s.id ? null : s.id))}
                      className="flex h-11 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menyFor === s.id && (
                      <span role="menu" className="absolute right-0 top-full z-30 mt-1 flex w-44 flex-col rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl shadow-black/40">
                        <button
                          type="button"
                          role="menuitem"
                          disabled={i === 0}
                          onClick={() => { setMenyFor(null); flyttaSteg(s.id, -1) }}
                          className="flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                        >
                          Flytta upp
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={i === sektioner.length - 1}
                          onClick={() => { setMenyFor(null); flyttaSteg(s.id, 1) }}
                          className="flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                        >
                          Flytta ned
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => setVisaLaggTill(true)}
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-slate-600 px-3 text-sm text-slate-300 hover:border-[#20c58f] hover:text-white"
            >
              <Icon name="allman.plus" size={20} />
              Lägg till del
            </button>

            <button type="button" onClick={() => gaTill('samm')} className={listKnapp(vy === 'samm')}>
              <Icon name="allman.bock" size={20} className="flex-shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">Bedömning och åtgärder</span>
                <span className="block text-[11px] text-slate-400">Din slutsats till kunden</span>
              </span>
            </button>
          </nav>
        </aside>

        {/* ── Redigering ── */}
        <main
          className={`${mobilFlik === 'redigera' ? 'block' : 'hidden'} min-w-0 flex-1 overflow-y-auto p-4 pb-48 lg:block lg:px-6 lg:py-5 lg:pb-8`}
          onFocus={folj}
          onPointerDownCapture={folj}
        >
          {vy === 'oversikt' && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Översiktskarta</h2>
                  <p className="text-sm text-slate-400">
                    {sektioner.length > 0
                      ? `${antalOmraden} av ${sektioner.length} ${sektioner.length === 1 ? 'del' : 'delar'} har ett ritat område. Varje område får sin egen färg, i kartan och i rapporten.`
                      : 'Rita ett område, så blir det en egen del. Kartan är valfri.'}
                  </p>
                </div>
                <label className="flex min-h-[44px] items-center gap-2.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!report.map_view}
                    onChange={e => vaxlaOversikt(e.target.checked)}
                    className="h-[18px] w-[18px] rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  Med i rapporten
                </label>
              </div>
              <AreaMapEditor
                sections={kartSektioner}
                selectedId={kartValt}
                mapView={report.map_view}
                address={report.address}
                onSelect={sectionId => gaTill(sectionId)}
                onCreateArea={skapaOmradesDel}
                onUpdateArea={(sectionId, area) => ops.updateSection(sectionId, { area })}
                onMapViewChange={v => sparaRapportFalt('map_view', v)}
                saveView={!!report.map_view}
                drawRequest={ritBegaran}
                focusRequest={fokusBegaran}
                currentViewRef={kartVyRef}
                namingSectionId={namnger}
                onNamingSave={(sectionId, titel) => {
                  if (titel.trim()) ops.updateSection(sectionId, { title: titel })
                  gaTill(sectionId)
                }}
                onNamingSkip={() => setNamnger(null)}
                onColorChange={(sectionId, farg) => ops.updateSection(sectionId, { color: farg })}
                className="h-[60dvh] min-h-[360px] lg:h-[calc(100dvh-14rem)] lg:min-h-[420px]"
              />
            </div>
          )}

          {vy === 'om' && (
            <div className="max-w-[720px] space-y-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-white">Om rapporten</h2>
                  <p className="text-sm text-slate-400">Det här står först i rapporten. Kund, kontakt och adress hämtas från ärendet.</p>
                </div>
                <button type="button" aria-label="Snygga till inledningen" title="Snygga till inledningen" onClick={() => oppnaPolish({ typ: 'om' })} className={SNYGGA_KNAPP}>
                  <Icon name="rapport.snygga" size={16} />
                  <span className="hidden sm:inline">Snygga till</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3.5">
                  <span className="text-xs text-slate-400">Kund</span>
                  <span className="text-[15px] font-semibold text-white break-words">{report.customer_name || 'Okänd kund'}</span>
                  {report.customer_number ? (
                    <span className="text-sm text-slate-300">Kundnummer <span className="font-mono">{report.customer_number}</span></span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-amber-400">
                      <span className="h-[7px] w-[7px] rounded-full bg-amber-400" />
                      Kundnummer saknas i Fortnox
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3.5">
                  <span className="text-xs text-slate-400">Ärende</span>
                  <span className="font-mono text-[15px] font-semibold text-white">{report.case_number || 'Saknas'}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3.5">
                  <span className="text-xs text-slate-400">Kontaktperson</span>
                  <span className="text-[15px] font-semibold text-white break-words">{report.contact_name || 'Saknas'}</span>
                  {report.contact_email && (
                    <a href={`mailto:${report.contact_email}`} className="truncate text-sm text-[#20c58f] hover:underline">{report.contact_email}</a>
                  )}
                  {report.contact_phone && (
                    <a href={`tel:${report.contact_phone.replace(/\s+/g, '')}`} className="text-sm text-[#20c58f] hover:underline">{report.contact_phone}</a>
                  )}
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3.5">
                  <span className="text-xs text-slate-400">Adress</span>
                  <span className="text-[15px] font-semibold text-white break-words">{adressDelar[0] || 'Saknas'}</span>
                  {adressDelar.length > 1 && <span className="text-sm text-slate-300">{adressDelar.slice(1).join(', ')}</span>}
                </div>
              </div>
              <div data-falt="rapport:doc_type">
                <span className="block text-sm text-slate-300 mb-1">Typ av rapport</span>
                <Select
                  value={report.doc_type}
                  onChange={v => sparaRapportFalt('doc_type', v as SpecialReportDocType)}
                  options={DOC_TYPES.map(d => ({ value: d, label: d }))}
                  className="max-w-xs"
                />
                <span className="mt-1 block text-xs text-slate-500">Står överst på första sidan.</span>
              </div>
              <label className="block" data-falt="rapport:intro">
                <span className="block text-sm text-slate-300 mb-1">Inledning</span>
                <textarea
                  value={report.intro ?? ''}
                  onChange={e => sparaRapportFalt('intro', e.target.value || null)}
                  rows={4}
                  placeholder="Kort om uppdraget: vad kunden bad om och vad rapporten omfattar."
                  className={TEXTFALT}
                />
              </label>
            </div>
          )}

          {vy === 'samm' && (
            <div className="max-w-[640px] space-y-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-white">Bedömning och åtgärder</h2>
                  <p className="text-sm text-slate-400">Din slutsats till kunden.</p>
                </div>
                <button type="button" aria-label="Snygga till bedömning och rekommendationer" title="Snygga till bedömning och rekommendationer" onClick={() => oppnaPolish({ typ: 'samm' })} className={SNYGGA_KNAPP}>
                  <Icon name="rapport.snygga" size={16} />
                  <span className="hidden sm:inline">Snygga till</span>
                </button>
              </div>
              <label className="block" data-falt="rapport:assessment">
                <span className="block text-sm text-slate-300 mb-1">Bedömning</span>
                <textarea
                  value={report.assessment ?? ''}
                  onChange={e => sparaRapportFalt('assessment', e.target.value || null)}
                  rows={5}
                  placeholder="Hur ser läget ut nu, och hur har det utvecklats?"
                  className={TEXTFALT}
                />
              </label>
              <label className="block" data-falt="rapport:recommendations">
                <span className="block text-sm text-slate-300 mb-1">Rekommendationer till kunden</span>
                <textarea
                  value={report.recommendations ?? ''}
                  onChange={e => sparaRapportFalt('recommendations', e.target.value || null)}
                  rows={5}
                  placeholder="Vad kunden själv kan göra för att hålla problemet borta."
                  className={TEXTFALT}
                />
              </label>
            </div>
          )}

          {aktuell && (
            <div className="max-w-[640px]">
              <SectionEditor
                key={aktuell.id}
                reportId={report.id}
                section={aktuell}
                nr={aktuellIndex + 1}
                color={fargForDel(aktuell.color, aktuellIndex)}
                ops={ops}
                fokus={fokus}
                autoFokusRubrik={nyDelId === aktuell.id}
                onPolish={oppnaPolish}
              />
            </div>
          )}
        </main>

        {/* ── Så ser kunden rapporten: egen spalt när redigeringen ändå får plats ── */}
        {forhandSomSpalt && (
          <aside
            className="flex flex-shrink-0 flex-col items-center gap-2 overflow-y-auto border-l border-slate-800 bg-slate-950/40 px-4 py-4"
            style={{ width: bredder.forhand }}
          >
            <ReportPreview
              report={report}
              vy={vy}
              fokus={fokus}
              onValj={(nyVy, falt) => gaTill(nyVy, falt)}
              onBladdra={nyVy => gaTill(nyVy)}
            />
            <span className="text-[11px] text-slate-500">Tryck på något på sidan för att redigera det</span>
          </aside>
        )}

        {/* ── Så ser kunden rapporten: utfällbar panel när spalten inte får plats ── */}
        {forhandSomPanel && visaPanel && (
          <>
            <div className="fixed inset-0 z-50 bg-black/40" aria-hidden="true" onClick={() => setVisaPanel(false)} />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Så ser kunden rapporten"
              className="fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col border-l border-slate-800 bg-slate-950 shadow-2xl shadow-black/50"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 py-2 pl-4 pr-2">
                <span className="text-sm font-semibold text-white">Visa som kund</span>
                <button
                  type="button"
                  aria-label="Stäng förhandsvisningen"
                  title="Stäng"
                  onClick={() => setVisaPanel(false)}
                  autoFocus
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
                >
                  <Icon name="allman.stang" size={20} />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-5 py-4">
                <ReportPreview
                  report={report}
                  vy={vy}
                  fokus={fokus}
                  onValj={(nyVy, falt) => { setVisaPanel(false); gaTill(nyVy, falt) }}
                  onBladdra={nyVy => gaTill(nyVy)}
                />
                <span className="text-[11px] text-slate-500">Tryck på något på sidan för att redigera det</span>
              </div>
            </aside>
          </>
        )}

        {/* ── Mobil: Visa som kund i helskärm ── */}
        {!arDesktop && mobilFlik === 'kund' && (
          <section className="flex w-full flex-col items-center gap-3 px-4 pb-48 pt-2" aria-label="Så ser kunden rapporten">
            <div className="flex w-full items-center justify-between">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                {sidor[sidIndex].farg && (
                  <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] text-[11px] font-extrabold text-[#fff]" style={{ background: sidor[sidIndex].farg }}>
                    {sidor[sidIndex].nr}
                  </span>
                )}
                <span className="truncate">{sidor[sidIndex].namn}</span>
              </span>
              <Bladdring sidor={sidor} index={sidIndex} onBladdra={nyVy => { gaTill(nyVy); setMobilFlik('kund') }} stor />
            </div>
            <ReportPreview
              report={report}
              vy={vy}
              fokus={null}
              onValj={(nyVy, falt) => gaTill(nyVy, falt)}
              onBladdra={nyVy => { gaTill(nyVy); setMobilFlik('kund') }}
              visaHuvud={false}
            />
            <button type="button" onClick={() => setMobilFlik('redigera')} className={SEKUNDAR_KNAPP}>
              <Icon name="allman.anteckning" size={16} />
              Redigera den här delen
            </button>
          </section>
        )}
      </div>

      {/* Mobil: Ny händelse nås alltid utom i förhandsvisningen */}
      {!arDesktop && mobilFlik !== 'kund' && (
        <button
          type="button"
          onClick={() => setVisaNyHandelse(true)}
          className={`${PRIMAR_KNAPP} fixed bottom-[140px] right-4 z-30 h-[52px] px-5 shadow-lg shadow-black/40`}
        >
          <Icon name="allman.plus" size={20} />
          Ny händelse
        </button>
      )}

      {/* Mobil: flikrad ovanför appens egen meny */}
      {!arDesktop && (
        <nav role="tablist" aria-label="Läge" className="fixed inset-x-0 bottom-16 z-30 grid grid-cols-3 border-t border-slate-800 bg-slate-900">
          {([
            ['delar', 'Delar', 'allman.lista'],
            ['redigera', 'Redigera', 'allman.anteckning'],
            ['kund', 'Visa som kund', 'rapport.forhandsgranska'],
          ] as const).map(([flik, namn, ikon]) => {
            const aktiv = mobilFlik === flik
            return (
              <button
                key={flik}
                type="button"
                role="tab"
                aria-selected={aktiv}
                onClick={() => setMobilFlik(flik)}
                className={`flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] ${aktiv ? 'font-bold text-[#20c58f]' : 'text-slate-400'}`}
              >
                <Icon name={ikon} size={20} />
                {namn}
              </button>
            )
          })}
        </nav>
      )}

      <AddSectionModal
        isOpen={visaLaggTill}
        onClose={() => setVisaLaggTill(false)}
        reportId={report.id}
        onChoose={laggTillDel}
        onCreatePerVisit={skapaDelPerBesok}
      />
      <SendSpecialReportModal
        isOpen={visaSkicka}
        onClose={() => setVisaSkicka(false)}
        report={report}
        onSent={() => { void ladda() }}
        beforeRender={() => saver.flush()}
      />
      <PolishReviewModal
        isOpen={!!polish}
        onClose={() => setPolish(null)}
        scopeLabel={polish?.scopeLabel ?? ''}
        fields={polish?.fields ?? []}
        context={polishKontext}
        glossaryHref={base.startsWith('/technician') ? null : '/koordinator/ordlista'}
        onApply={tillampaPolish}
      />
      <MobileAddEventSheet
        isOpen={visaNyHandelse}
        onClose={() => setVisaNyHandelse(false)}
        reportId={report.id}
        reportTitle={report.title}
        caseNumber={report.case_number}
        sections={sektioner}
        preferredSectionId={aktuell?.id ?? null}
        onSaved={() => { void ladda() }}
      />
    </div>
  )
}

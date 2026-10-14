// src/pages/shared/SpecialReportEditorPage.tsx
// Redigeraren för en specialrapport (/technician|/koordinator/specialrapporter/:id).
// Desktop: tre kolumner, struktur (312 px) | innehåll | rapportens sidor (248 px).
// Mobil: en kolumn där strukturen är startvyn och "Ny händelse" alltid nås.
// Allt sparas löpande, per fält med ~600 ms fördröjning.
// Ligger under pages/shared eftersom samma sida används av tekniker,
// koordinator och admin (via koordinatorns sökväg).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Select from '../../components/ui/Select'
import { Icon } from '../../components/icons/Icon'
import { SpecialReportService } from '../../services/specialReportService'
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
} from '../../types/specialReport'
import AreaMapEditor from '../../components/shared/specialReports/AreaMapEditor'
import SectionEditor from '../../components/shared/specialReports/SectionEditor'
import SendSpecialReportModal from '../../components/shared/specialReports/SendSpecialReportModal'
import MobileAddEventSheet from '../../components/shared/specialReports/MobileAddEventSheet'
import type { EventPatch, FullSection, SectionOps } from '../../components/shared/specialReports/sectionOps'
import {
  DOC_TYPES,
  IKON_KNAPP,
  PRIMAR_KNAPP,
  TEXTFALT,
  idagISO,
  klockslag,
  laddaNed,
  oppnaINyFlik,
  senastAndrad,
  useDebouncedSaver,
  useSpecialReportBase,
} from '../../components/shared/specialReports/specialReportUtils'

type Vy = 'forsatt' | 'oversikt' | 'samm' | string

const felText = (e: unknown, reserv: string) => (e instanceof Error ? e.message : reserv)
const sorteraSektioner = (s: FullSection[]) => [...s].sort((a, b) => a.position - b.position)

export default function SpecialReportEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const base = useSpecialReportBase()
  const [searchParams, setSearchParams] = useSearchParams()
  const saver = useDebouncedSaver(600)

  const [report, setReport] = useState<SpecialReportFull | null>(null)
  const [laddarFel, setLaddarFel] = useState<string | null>(null)
  const [vy, setVy] = useState<Vy>('oversikt')
  const [mobilInnehall, setMobilInnehall] = useState(false)
  const [visaSkicka, setVisaSkicka] = useState(false)
  const [visaNyHandelse, setVisaNyHandelse] = useState(false)
  const [hamtarPdf, setHamtarPdf] = useState<'forhand' | 'ladda' | null>(null)
  const [laggerSektion, setLaggerSektion] = useState(false)

  // Karta: valt område, rit- och fokusbegäran. Utsnittet sparas bara när
  // översiktskartan är med i rapporten (map_view satt)
  const [kartValt, setKartValt] = useState<string | null>(null)
  const [ritBegaran, setRitBegaran] = useState<{ sectionId: string | null; token: number } | null>(null)
  const [fokusBegaran, setFokusBegaran] = useState<{ sectionId: string; token: number } | null>(null)
  const kartVyRef = useRef<(() => SpecialReportMapView | null) | null>(null)

  // Dra och släpp i strukturen
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const radRefs = useRef(new Map<string, HTMLButtonElement>())

  const reportId = report?.id

  // ── Laddning ──
  const { flush: sparaVantande, harVantande } = saver
  const ladda = useCallback(async (forsta = false) => {
    if (!id) return
    try {
      // Spara det som väntar först. Ändras något under hämtningen hämtas det igen,
      // annars skulle serverns svar skriva över text som just skrivits
      let r: SpecialReportFull | null = null
      for (let forsok = 0; forsok < 5; forsok++) {
        await sparaVantande()
        const hamtad = await SpecialReportService.get(id)
        if (!harVantande()) { r = hamtad; break }
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
  }, [id, sparaVantande, harVantande])

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
  // Kartans vy av sektionerna, ny bara när nummer, rubrik eller område ändras
  const kartSektioner = useMemo(
    () => sektioner.map((s, i) => ({ id: s.id, nr: i + 1, title: s.title, area: s.area })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(sektioner.map(s => [s.id, s.title, s.area]))],
  )

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
  const gaTill = useCallback((nyVy: Vy) => {
    setVy(nyVy)
    setRitBegaran(null)
    setFokusBegaran(null)
    if (nyVy !== 'oversikt') setKartValt(null)
    setMobilInnehall(true)
  }, [])

  // ── Sektioner ──
  const laggTillSektion = async () => {
    if (!reportId) return
    setLaggerSektion(true)
    try {
      const s = await SpecialReportService.addSection(reportId, { title: 'Ny sektion', label: 'fritt', blocks: ['text'] })
      setReport(r => (r ? { ...r, sections: [...r.sections, s] } : r))
      gaTill(s.id)
    } catch (e) {
      toast.error(felText(e, 'Kunde inte lägga till sektionen'))
    } finally {
      setLaggerSektion(false)
    }
  }

  const skapaOmradesSektion = async (area: LatLng[]) => {
    if (!reportId) return
    try {
      const s = await SpecialReportService.addSection(reportId, { title: 'Nytt område', label: 'omrade', area, blocks: ['map', 'events'] })
      setReport(r => (r ? { ...r, sections: [...r.sections, s] } : r))
      gaTill(s.id)
      toast.success('Området blev en ny sektion')
    } catch (e) {
      toast.error(felText(e, 'Kunde inte skapa sektionen'))
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

  // ── Handlingar för sektionsvyn ──
  const ops: SectionOps = {
    updateSection: (sectionId, patch) => {
      andraSektion(sectionId, s => ({ ...s, ...patch }))
      ;(Object.keys(patch) as (keyof typeof patch)[]).forEach(k => {
        const delpatch = { [k]: patch[k] } as Partial<Pick<SpecialReportSection, 'title' | 'subtitle' | 'label' | 'area'>>
        if (k === 'title' && !(patch.title ?? '').trim()) { saver.cancel(`sektion:${sectionId}:${k}`); return }
        saver.schedule(`sektion:${sectionId}:${k}`,() => SpecialReportService.updateSection(sectionId, delpatch), sparfel)
      })
    },
    deleteSection: async sectionId => {
      try {
        await saver.now(() => SpecialReportService.deleteSection(sectionId))
        setReport(r => (r ? { ...r, sections: r.sections.filter(s => s.id !== sectionId) } : r))
        gaTill('oversikt')
        setMobilInnehall(false)
        toast.success('Sektionen är borttagen')
      } catch (e) {
        toast.error(felText(e, 'Kunde inte ta bort sektionen'))
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

  // ── PDF ──
  const forhandsgranska = async () => {
    if (!reportId) return
    setHamtarPdf('forhand')
    try {
      await oppnaINyFlik(async () => {
        await saver.flush()
        return (await SpecialReportService.downloadPdf(reportId)).url
      })
    } catch (e) {
      toast.error(felText(e, 'Kunde inte ta fram PDF:en'))
    } finally {
      setHamtarPdf(null)
    }
  }

  const laddaNedPdf = async () => {
    if (!reportId) return
    setHamtarPdf('ladda')
    try {
      await saver.flush()
      const { url, filename } = await SpecialReportService.downloadPdf(reportId)
      await laddaNed(url, filename)
    } catch (e) {
      toast.error(felText(e, 'Kunde inte ta fram PDF:en'))
    } finally {
      setHamtarPdf(null)
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

  const aktuell = sektioner.find(s => s.id === vy) ?? null
  const aktuellNr = aktuell ? sektioner.indexOf(aktuell) + 1 : 0
  const antalOmraden = sektioner.filter(s => s.area && s.area.length >= 3).length
  const allaDatum = sektioner.flatMap(s => s.events.map(e => e.event_date)).sort()
  const period = allaDatum.length ? `${allaDatum[0]} till ${allaDatum[allaDatum.length - 1]}` : 'Inga händelser än'

  const statusText = saver.status === 'sparar'
    ? 'Sparar...'
    : saver.status === 'fel'
      ? 'Kunde inte spara'
      : saver.status === 'sparad' && saver.sparadTid
        ? `Sparad ${klockslag(saver.sparadTid)}`
        : `Sparad ${senastAndrad(report.updated_at).replace('I dag ', '')}`
  const statusPunkt = saver.status === 'fel' ? 'bg-red-500' : saver.status === 'sparar' ? 'bg-amber-400' : 'bg-[#20c58f]'

  const sidor = [
    { key: 'forsatt', namn: 'Försättssida', karta: false },
    ...(report.map_view ? [{ key: 'oversikt', namn: 'Översikt', karta: true }] : []),
    ...sektioner.map((s, i) => ({ key: s.id, namn: `${i + 1}. ${s.title}`, karta: !!s.area && s.area.length >= 3 })),
    { key: 'samm', namn: 'Bedömning', karta: false },
  ]

  const strukturKnapp = (aktiv: boolean) =>
    `flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm transition-colors ${
      aktiv ? 'border-[#20c58f] bg-[#20c58f]/10 text-white' : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-600'
    }`

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3rem)]">
      {/* ── Rubrikrad ── */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 py-2 pl-1 pr-3 sm:gap-3 sm:pl-2 sm:pr-5">
        <button
          type="button"
          aria-label={mobilInnehall ? 'Tillbaka till strukturen' : 'Tillbaka till rapporterna'}
          onClick={() => (mobilInnehall && window.innerWidth < 1024 ? setMobilInnehall(false) : navigate(base))}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
        >
          <Icon name="rapport.tillbaka" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Rapportens titel"
            value={report.title}
            onChange={e => sparaRapportFalt('title', e.target.value)}
            className="w-full truncate rounded bg-transparent text-base font-bold text-white outline-none focus:ring-2 focus:ring-[#20c58f]/40 sm:text-[17px]"
          />
          <p className="flex items-center gap-2 truncate text-xs text-slate-400">
            <span className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${statusPunkt}`} />
            <span className="truncate">{statusText} · version {report.current_version} pågår</span>
          </p>
        </div>
        <button type="button" aria-label="Förhandsgranska" title="Förhandsgranska" onClick={forhandsgranska} disabled={hamtarPdf !== null} className={`${IKON_KNAPP} hidden sm:inline-flex`}>
          {hamtarPdf === 'forhand' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.forhandsgranska" size={20} />}
        </button>
        <button type="button" aria-label="Ladda ned PDF" title="Ladda ned PDF" onClick={laddaNedPdf} disabled={hamtarPdf !== null} className={IKON_KNAPP}>
          {hamtarPdf === 'ladda' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.ladda" size={20} />}
        </button>
        <button type="button" onClick={() => setVisaSkicka(true)} className={PRIMAR_KNAPP}>
          <Icon name="rapport.skicka" size={20} />
          <span className="sm:hidden">Skicka</span>
          <span className="hidden sm:inline">Skicka till kund</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Struktur ── */}
        <aside className={`${mobilInnehall ? 'hidden' : 'flex'} w-full flex-col gap-3.5 overflow-y-auto border-slate-800 p-4 pb-32 lg:flex lg:w-[312px] lg:flex-shrink-0 lg:border-r lg:pb-4`}>
          <div className="flex gap-3 rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#20c58f]/15 text-[#20c58f]">
              <Icon name="rapport.lank" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{report.customer_name || 'Okänd kund'}</span>
              <span className="block truncate font-mono text-xs text-slate-400">
                {[report.case_number, report.customer_number ? `kundnr ${report.customer_number}` : null].filter(Boolean).join(' · ')}
              </span>
              {report.contact_name && <span className="block truncate text-xs text-slate-500">{report.contact_name}</span>}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500">Struktur</span>
            <span className="hidden text-[11px] text-slate-600 lg:inline">Dra för att ändra ordning</span>
          </div>

          <nav className="flex flex-col gap-1.5" aria-label="Rapportens struktur">
            <button type="button" onClick={() => gaTill('forsatt')} className={strukturKnapp(vy === 'forsatt')}>
              <Icon name="rapport.rapport" size={20} className="text-slate-400" />
              <span className="flex-1">Försättssida</span>
            </button>
            <button type="button" onClick={() => gaTill('oversikt')} className={strukturKnapp(vy === 'oversikt')}>
              <Icon name="rapport.karta" size={20} className="text-slate-400" />
              <span className="flex-1">Översiktskarta</span>
              <span className="text-[11px] text-slate-500">{antalOmraden} {antalOmraden === 1 ? 'område' : 'områden'}</span>
            </button>

            {sektioner.map((s, i) => {
              const vald = vy === s.id
              const markerad = overId === s.id && dragId && dragId !== s.id
              return (
                <button
                  key={s.id}
                  ref={el => { if (el) radRefs.current.set(s.id, el); else radRefs.current.delete(s.id) }}
                  type="button"
                  draggable
                  onDragStart={e => {
                    try { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move' } catch { /* äldre webbläsare */ }
                    setDragId(s.id)
                  }}
                  onDragOver={e => { e.preventDefault(); if (overId !== s.id) setOverId(s.id) }}
                  onDrop={e => { e.preventDefault(); flytta(dragId, s.id) }}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  onClick={() => gaTill(s.id)}
                  onKeyDown={e => {
                    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); flyttaSteg(s.id, -1) }
                    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); flyttaSteg(s.id, 1) }
                  }}
                  aria-label={`${i + 1} ${s.title}. Alt och pil upp eller ned flyttar.`}
                  className={`flex min-h-[52px] w-full cursor-grab items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-2.5 text-left transition-colors ${
                    vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'
                  } ${markerad ? 'border-t-2 border-t-[#20c58f]' : ''} ${dragId === s.id ? 'opacity-40' : ''}`}
                >
                  <Icon name="rapport.dra" size={16} className="flex-shrink-0 text-slate-600" />
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${vald ? 'bg-[#20c58f] text-[#04140d]' : 'bg-slate-800 text-slate-200'}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{s.title || 'Utan rubrik'}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {SECTION_LABELS[s.label]} · {s.events.length} {s.events.length === 1 ? 'händelse' : 'händelser'}
                    </span>
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              onClick={laggTillSektion}
              disabled={laggerSektion}
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-dashed border-slate-600 px-3 text-sm text-slate-400 hover:border-[#20c58f] hover:text-slate-200"
            >
              {laggerSektion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="allman.plus" size={20} />}
              Lägg till sektion
            </button>

            <button type="button" onClick={() => gaTill('samm')} className={strukturKnapp(vy === 'samm')}>
              <Icon name="allman.bock" size={20} className="text-slate-400" />
              <span className="flex-1">Bedömning och åtgärder</span>
            </button>
          </nav>
        </aside>

        {/* ── Innehåll ── */}
        <main className={`${mobilInnehall ? 'block' : 'hidden'} min-w-0 flex-1 overflow-y-auto p-4 pb-32 lg:block lg:px-6 lg:py-5 lg:pb-8`}>
          {vy === 'oversikt' && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Översiktskarta</h2>
                  <p className="text-sm text-slate-400">Rita ett område, så blir det en egen sektion. Tryck på ett område för att öppna sektionen. Kartan är valfri.</p>
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
                onCreateArea={skapaOmradesSektion}
                onUpdateArea={(sectionId, area) => ops.updateSection(sectionId, { area })}
                onMapViewChange={v => sparaRapportFalt('map_view', v)}
                saveView={!!report.map_view}
                drawRequest={ritBegaran}
                focusRequest={fokusBegaran}
                currentViewRef={kartVyRef}
                className="h-[60dvh] min-h-[360px] lg:h-[calc(100dvh-14rem)] lg:min-h-[420px]"
              />
            </div>
          )}

          {vy === 'forsatt' && (
            <div className="max-w-2xl space-y-3.5">
              <div>
                <h2 className="text-xl font-semibold text-white">Försättssida</h2>
                <p className="text-sm text-slate-400">Hämtas från ärendet när rapporten skapades. Perioden räknas fram ur händelsernas datum.</p>
              </div>
              <dl className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                {[
                  ['Kund', report.customer_name || 'Okänd kund'],
                  ['Kundnummer och ärende', [report.customer_number, report.case_number].filter(Boolean).join(' · ') || 'Saknas'],
                  ['Kontakt', [report.contact_name, report.contact_email, report.contact_phone].filter(Boolean).join(', ') || 'Saknas'],
                  ['Adress', report.address || 'Saknas'],
                  ['Period', period],
                  ['Sektioner', `${sektioner.length} st`],
                  ['Version', String(report.current_version)],
                ].map(([etikett, varde]) => (
                  <div key={etikett} className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-3">
                    <dt className="text-slate-400">{etikett}</dt>
                    <dd className="text-white break-words">{varde}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <span className="block text-xs font-medium text-slate-400 mb-1">Dokumenttyp</span>
                <Select
                  value={report.doc_type}
                  onChange={v => sparaRapportFalt('doc_type', v as SpecialReportDocType)}
                  options={DOC_TYPES.map(d => ({ value: d, label: d }))}
                  className="max-w-xs"
                />
              </div>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">Inledning</span>
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
            <div className="max-w-3xl space-y-3.5">
              <h2 className="text-xl font-semibold text-white">Bedömning och åtgärder</h2>
              <label className="block">
                <span className="block text-sm text-slate-300 mb-1">Bedömning</span>
                <textarea
                  value={report.assessment ?? ''}
                  onChange={e => sparaRapportFalt('assessment', e.target.value || null)}
                  rows={5}
                  placeholder="Hur ser läget ut nu, och hur har det utvecklats?"
                  className={TEXTFALT}
                />
              </label>
              <label className="block">
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
            <SectionEditor key={aktuell.id} reportId={report.id} section={aktuell} nr={aktuellNr} ops={ops} />
          )}
        </main>

        {/* ── Rapportens sidor ── */}
        <aside className="hidden w-[248px] flex-shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 bg-slate-950/40 p-4 xl:flex">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500">Rapporten</span>
            <span className="text-xs text-slate-400">{sidor.length} sidor</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {sidor.map(p => {
              const aktiv = p.key === vy
              return (
                <button key={p.key} type="button" onClick={() => gaTill(p.key)} className="flex flex-col gap-1 text-left" aria-label={`Gå till ${p.namn}`}>
                  <span className={`flex h-[120px] flex-col gap-1 rounded border-2 bg-slate-50 p-2 ${aktiv ? 'border-[#20c58f]' : 'border-transparent'}`}>
                    <span className="h-[3px] w-[22px] bg-[#20c58f]" />
                    <span className="h-[5px] w-[78%] rounded-sm bg-slate-800" />
                    {p.karta && <span className="h-[38px] rounded-sm bg-[#b9c4b5]" />}
                    <span className="h-[3px] w-[92%] bg-slate-300" />
                    <span className="h-[3px] w-[86%] bg-slate-300" />
                    <span className="h-[3px] w-[60%] bg-slate-300" />
                  </span>
                  <span className={`truncate text-[11px] ${aktiv ? 'text-[#20c58f]' : 'text-slate-400'}`}>{p.namn}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={forhandsgranska}
            disabled={hamtarPdf !== null}
            className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm text-slate-200 hover:bg-slate-800"
          >
            {hamtarPdf === 'forhand' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.forhandsgranska" size={16} />}
            Förhandsgranska
          </button>
        </aside>
      </div>

      {/* Mobil: Ny händelse nås alltid */}
      <button
        type="button"
        onClick={() => setVisaNyHandelse(true)}
        className={`${PRIMAR_KNAPP} fixed bottom-[88px] right-4 z-30 h-[52px] px-5 shadow-lg shadow-black/40 lg:hidden`}
      >
        <Icon name="allman.plus" size={20} />
        Ny händelse
      </button>

      <SendSpecialReportModal
        isOpen={visaSkicka}
        onClose={() => setVisaSkicka(false)}
        report={report}
        onSent={() => { void ladda() }}
        beforeRender={() => saver.flush()}
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

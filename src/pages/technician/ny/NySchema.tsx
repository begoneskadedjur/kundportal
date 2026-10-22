// src/pages/technician/ny/NySchema.tsx
// Schemat i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx). Alla andra
// får gamla TechnicianSchedule oförändrad.
//
// Lägen: Dag, Vecka och Månad. Telefonen börjar på Dag med veckoremsan överst, datorn på
// Vecka som rutnät med sidopanel (valt besök, hoppkalender, filter).
//
// Data: samma tre källor som gamla vyn (cases, private_cases, business_cases där teknikern
// är tekniker 1 till 3, deleted_at null, legacy_archived_at null för ClickUp-ärendena),
// hämtade en gång via useAllaArenden. Arbetsschemat och frånvaron läses som i gamla vyn.
//
// Djuplänkar som gamla vyn: ?openCase=<id>&caseType=<private|business|...>&comm=0.
// Utan comm=0 öppnas kommunikationen direkt (notiser). Dessutom ?dag=YYYY-MM-DD och
// ?vy=dag|vecka|manad.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import ReportModal from '../../../components/admin/technicians/ReportModal'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { RestidRad } from '../../../components/technician/ny/RestidRad'
import { DagTidslinje } from '../../../components/technician/ny/schema/DagTidslinje'
import { VeckoRemsa, VeckoNav } from '../../../components/technician/ny/schema/VeckoRemsa'
import { VeckoRutnat } from '../../../components/technician/ny/schema/VeckoRutnat'
import { ManadKalender, ManadNav } from '../../../components/technician/ny/schema/ManadKalender'
import { FilterArk, SchemaFilterInnehall } from '../../../components/technician/ny/schema/SchemaFilter'
import { SokTraffar, VeckoLista } from '../../../components/technician/ny/schema/SchemaListor'
import { ValtBesok } from '../../../components/technician/ny/schema/ValtBesok'
import { VyVal, type SchemaVy } from '../../../components/technician/ny/schema/SchemaDelar'
import { useKortid, type KortidPar } from '../../../components/technician/ny/schema/useKortid'
import {
  belastning, dagRubrik, filterArAndrat, laggTillManader, luckor, manadRubrik, matcharSok, standardFilter, syns,
  timText, veckansDagar, veckonummer, veckoSpann, varaktighet,
  type Belastning, type Franvaro, type SchemaFilter,
} from '../../../components/technician/ny/schema/schemaLogik'
import { useAllaArenden } from '../../../hooks/useTeknikerBesok'
import { useMapsKlar, useMinPosition, useRestid } from '../../../hooks/useRestid'
import type { WorkSchedule } from '../../../types/database'
import {
  arAvtalsbesok, hamtaStationsantal, klockslag, laggTillDagar, nastaBesok, svenskDag, type DagBesok,
} from '../../../services/teknikerDagService'

const DATOR = '(min-width: 1024px)'

function arDatorNu(): boolean {
  try { return window.matchMedia(DATOR).matches } catch { return false }
}

function useArDator(): boolean {
  const [dator, setDator] = useState(arDatorNu)
  useEffect(() => {
    let mq: MediaQueryList
    try { mq = window.matchMedia(DATOR) } catch { return }
    const lyssna = () => setDator(mq.matches)
    mq.addEventListener('change', lyssna)
    return () => mq.removeEventListener('change', lyssna)
  }, [])
  return dator
}

const GENOMGANG_MOBIL: GenomgangSteg[] = [
  { rubrik: 'Veckan överst', text: 'Siffran är antal besök den dagen och punkten visar hur full dagen är. Tryck på en dag för att se den, svep åt sidan för nästa vecka.', mal: 'schema-remsa' },
  { rubrik: 'Dag, Vecka och Månad', text: 'Byt läge här. Månad visar hela månaden, tryck på en dag för att öppna den.', mal: 'schema-vy' },
  { rubrik: 'Dagen i tidsordning', text: 'Mellan besöken står körtiden och de lediga stunderna. Tryck på ett besök för Navigera, Ring och Öppna.', mal: 'schema-dag' },
  { rubrik: 'Sök och filter', text: 'Sök hittar dina ärenden på alla datum. Filtret väljer vilka typer och statusar som visas.', mal: 'schema-sok' },
]

const GENOMGANG_DATOR: GenomgangSteg[] = [
  { rubrik: 'Veckan', text: 'Besöken ligger i tid. Överst står hur många av dagens arbetstimmar som är bokade. Tryck på en dag för att se den som dag.', mal: 'schema-vecka' },
  { rubrik: 'Valt besök', text: 'Tryck på ett besök så visas det här, med Öppna ärendet, Navigera och Ring.', mal: 'schema-valt' },
  { rubrik: 'Dag, Vecka och Månad', text: 'Byt läge här. Pilarna går en dag, en vecka eller en månad i taget.', mal: 'schema-vy' },
  { rubrik: 'Sök och filter', text: 'Sök hittar dina ärenden på alla datum. Filtret i panelen väljer typer och statusar.', mal: 'schema-sok' },
]

function giltigDag(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

function startVy(v: string | null): SchemaVy {
  if (v === 'dag' || v === 'vecka' || v === 'manad') return v
  return arDatorNu() ? 'vecka' : 'dag'
}

const IKONKNAPP = 'relative w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'

export default function NySchema() {
  const { profile } = useAuth()
  const minId = profile?.technician_id ?? null
  const [params, setParams] = useSearchParams()
  const arDator = useArDator()
  const { besok: alla, laddar, fel, ladda } = useAllaArenden()

  const [nu, setNu] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNu(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const idag = svenskDag(nu)

  const [vy, setVy] = useState<SchemaVy>(() => startVy(params.get('vy')))
  const [valdDag, setValdDag] = useState<string>(() => {
    const p = params.get('dag')
    if (p === 'imorgon') return laggTillDagar(svenskDag(), 1)
    return giltigDag(p) ?? svenskDag()
  })
  const [manad, setManad] = useState<string>(valdDag)
  const [valdNyckel, setValdNyckel] = useState<string | null>(null)
  const [sok, setSok] = useState('')
  const [filter, setFilter] = useState<SchemaFilter>(standardFilter)
  const [filterOppet, setFilterOppet] = useState(false)
  const [statistik, setStatistik] = useState(false)
  const [oppet, setOppet] = useState<ArendeRef | null>(null)
  const [kommunikation, setKommunikation] = useState(false)
  const [visaMig, setVisaMig] = useState(false)
  const [ws, setWs] = useState<WorkSchedule | null>(null)
  const [franvaro, setFranvaro] = useState<Franvaro[]>([])
  const [uppdaterad, setUppdaterad] = useState<Date | null>(null)
  const [stationer, setStationer] = useState<Map<string, number>>(new Map())
  const [uppdaterar, setUppdaterar] = useState(false)

  // Arbetsschema och frånvaro, samma hämtning som gamla vyn
  const laddaSchema = useCallback(async () => {
    if (!minId) return
    const [schemaRes, franRes] = await Promise.all([
      supabase.from('technicians').select('work_schedule').eq('id', minId).single(),
      supabase.from('technician_absences').select('*').eq('technician_id', minId),
    ])
    if (schemaRes.data?.work_schedule) setWs(schemaRes.data.work_schedule as WorkSchedule)
    if (franRes.data) setFranvaro(franRes.data as Franvaro[])
  }, [minId])
  useEffect(() => { void laddaSchema() }, [laddaSchema])

  useEffect(() => { if (!laddar) setUppdaterad(new Date()) }, [laddar])

  const uppdatera = async () => {
    if (uppdaterar) return
    setUppdaterar(true)
    try { await Promise.all([ladda(), laddaSchema()]) } finally { setUppdaterar(false) }
  }

  // ─── Djuplänkar (notiser, bokningsmejl, ärendekommentarer) ───
  useEffect(() => {
    const id = params.get('openCase')
    if (!id) return
    if (laddar) return
    const ct = params.get('caseType')
    const kalla = ct === 'private' || ct === 'business' ? ct : null
    const b = alla.find(x => x.id === id && (!kalla || x.kalla === kalla)) ?? alla.find(x => x.id === id)
    if (b) {
      if (b.dag) { setValdDag(b.dag); setManad(b.dag) }
      setValdNyckel(b.nyckel)
      // comm=0 öppnar bara ärendet (bokningsmejl), annars kommunikationen (notiser)
      setKommunikation(params.get('comm') !== '0')
      setOppet({ kalla: b.kalla, id: b.id })
    }
    setParams(p => {
      for (const k of ['openCase', 'caseType', 'comm', 'tab']) p.delete(k)
      return p
    }, { replace: true })
  }, [params, alla, laddar, setParams])

  // ─── Urval ───
  const allaPerDag = useMemo(() => {
    const m = new Map<string, DagBesok[]>()
    for (const b of alla) {
      if (!b.dag) continue
      const l = m.get(b.dag)
      if (l) l.push(b); else m.set(b.dag, [b])
    }
    return m
  }, [alla])

  const synligaPerDag = useMemo(() => {
    const m = new Map<string, DagBesok[]>()
    for (const [dag, lista] of allaPerDag) {
      const s = lista.filter(b => syns(b, filter))
      if (s.length) m.set(dag, s)
    }
    return m
  }, [allaPerDag, filter])

  const belastningFor = useMemo(() => {
    const cache = new Map<string, Belastning>()
    return (dag: string) => {
      let b = cache.get(dag)
      if (!b) { b = belastning(dag, allaPerDag.get(dag) ?? [], ws, franvaro); cache.set(dag, b) }
      return b
    }
  }, [allaPerDag, ws, franvaro])

  const antalFor = useCallback((dag: string) => synligaPerDag.get(dag)?.length ?? 0, [synligaPerDag])

  const veckoDagar = useMemo(() => veckansDagar(valdDag), [valdDag])
  const dagensSynliga = useMemo(() => synligaPerDag.get(valdDag) ?? [], [synligaPerDag, valdDag])
  const nasta = valdDag === idag ? nastaBesok(dagensSynliga, nu) : null

  const q = sok.trim().toLowerCase()
  const soker = q.length >= 2
  const traffar = useMemo(() => (soker ? alla.filter(b => b.dag && syns(b, filter) && matcharSok(b, q)) : []), [soker, alla, filter, q])

  // Valt besök: valt av teknikern, annars nästa idag eller första kommande en senare dag
  const valt = useMemo(() => {
    if (valdNyckel) {
      const b = alla.find(x => x.nyckel === valdNyckel)
      if (b && syns(b, filter)) return b
    }
    if (valdDag === idag) return nasta
    if (valdDag > idag) return dagensSynliga.find(b => !b.avslutad) ?? null
    return null
  }, [valdNyckel, alla, filter, valdDag, idag, nasta, dagensSynliga])

  // ─── Körtid ───
  const { klar: mapsKlar } = useMapsKlar()
  const kortidDagar = useMemo(() => {
    if (soker) return []
    if (vy === 'vecka' && arDator) return veckoDagar.filter(d => d >= idag)
    if (vy === 'dag' && valdDag >= idag) return [valdDag]
    return []
  }, [soker, vy, arDator, veckoDagar, idag, valdDag])

  const kortidPar = useMemo(() => {
    const par: KortidPar[] = []
    for (const dag of kortidDagar) {
      const l = synligaPerDag.get(dag) ?? []
      for (let i = 1; i < l.length; i++) {
        const a = l[i - 1].adress.trim()
        const b = l[i].adress.trim()
        if (a && b && a.toLowerCase() !== b.toLowerCase()) par.push({ nyckel: l[i].nyckel, fran: a, till: b })
      }
    }
    return par
  }, [kortidDagar, synligaPerDag])
  const kortid = useKortid(kortidPar, mapsKlar)

  // Dagens första besök: körtid från bilen eller telefonen
  const forsta = dagensSynliga[0]
  const posAktiv = !soker && vy === 'dag' && valdDag === idag && !!forsta && !forsta.avslutad && !!forsta.adress
  const { position } = useMinPosition(posAktiv)
  const forstaRestid = useRestid(position, posAktiv ? forsta?.adress : null, mapsKlar)
  const forstaRad = posAktiv && forstaRestid && position ? (
    <div className="pl-3.5 py-1.5 border-l-2 border-dashed border-slate-600">
      <RestidRad restid={forstaRestid} position={position} />
    </div>
  ) : null

  // ─── Stationsantal för veckans kontrollbesök och etableringar ───
  const kundIds = useMemo(() => {
    const ids = new Set<string>()
    for (const d of veckoDagar) for (const b of allaPerDag.get(d) ?? []) if (arAvtalsbesok(b) && b.customerId) ids.add(b.customerId)
    return [...ids].sort().join(',')
  }, [veckoDagar, allaPerDag])
  useEffect(() => {
    if (!kundIds) return
    let avbruten = false
    hamtaStationsantal(kundIds.split(',')).then(m => {
      if (avbruten) return
      setStationer(prev => { const n = new Map(prev); for (const [k, v] of m) n.set(k, v); return n })
    })
    return () => { avbruten = true }
  }, [kundIds])

  // ─── Navigering ───
  const valjDag = (dag: string) => { setValdDag(dag); setManad(dag); setValdNyckel(null) }
  const visaDag = (dag: string) => { setVy('dag'); setSok(''); valjDag(dag) }
  const tillIdag = () => valjDag(idag)
  const steg = (n: number) => {
    if (vy === 'manad') { setManad(m => laggTillManader(m, n)); return }
    valjDag(laggTillDagar(valdDag, vy === 'vecka' ? 7 * n : n))
  }
  const bytVy = (v: SchemaVy) => { setVy(v); setManad(valdDag) }
  const oppna = (b: DagBesok) => { setKommunikation(false); setOppet({ kalla: b.kalla, id: b.id }) }
  const valjBesok = (b: DagBesok) => {
    setValdNyckel(b.nyckel)
    if (b.dag && b.dag !== valdDag) setValdDag(b.dag)
  }

  // ─── Sidhuvud ───
  const veckaSumma = useMemo(() => {
    let antal = 0, bokade = 0, kapacitet = 0
    for (const d of veckoDagar) {
      antal += antalFor(d)
      const b = belastningFor(d)
      if (b.niva !== 'ledig' && b.niva !== 'franvaro') { bokade += b.bokadeTim; kapacitet += b.kapacitetTim }
    }
    return { antal, bokade, kapacitet }
  }, [veckoDagar, antalFor, belastningFor])

  const underrubrik = laddar && alla.length === 0 ? undefined
    : vy === 'dag' ? `${dagRubrik(valdDag)}, ${antalFor(valdDag)} besök`
    : vy === 'vecka' ? `Vecka ${veckonummer(valdDag)}, ${veckaSumma.antal} besök, ${timText(veckaSumma.bokade)} av ${timText(veckaSumma.kapacitet)} arbetstimmar bokade`
    : manadRubrik(manad)
  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik, onVisaMig: oppnaVisaMig })

  // Mest ledig tid resten av veckan (datorns vecka)
  const mestLedig = useMemo(() => {
    let bast: { dag: string; start: Date; slut: Date } | null = null
    for (const d of veckoDagar) {
      if (d < idag) continue
      for (const l of luckor(d, allaPerDag.get(d) ?? [], ws, franvaro, 60)) {
        const start = d === idag && l.start < nu ? nu : l.start
        if (l.slut.getTime() - start.getTime() < 30 * 60_000) continue
        if (!bast || l.slut.getTime() - start.getTime() > bast.slut.getTime() - bast.start.getTime()) bast = { dag: d, start, slut: l.slut }
      }
    }
    return bast
  }, [veckoDagar, idag, allaPerDag, ws, franvaro, nu])

  const dagensLuckor = useMemo(
    () => luckor(valdDag, allaPerDag.get(valdDag) ?? [], ws, franvaro).filter(l => valdDag !== idag || l.slut > nu),
    [valdDag, allaPerDag, ws, franvaro, idag, nu],
  )

  const oppnaFranRapport = (c: { id: string }) => {
    const t = (c as { case_type?: string }).case_type
    setStatistik(false)
    setKommunikation(false)
    setOppet({ kalla: t === 'business' ? 'business' : t === 'private' ? 'private' : 'cases', id: c.id })
  }

  const filterAndrat = filterArAndrat(filter)

  const sokFalt = (
    <label data-genomgang="schema-sok" className="relative flex-1 min-w-0 block">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
        <Icon name="allman.sok" size={20} />
      </span>
      <input
        type="search"
        value={sok}
        onChange={e => setSok(e.target.value)}
        placeholder="Sök kund, adress eller ärendenummer"
        aria-label="Sök i alla dina ärenden, alla datum"
        className="w-full h-11 pl-11 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
      />
    </label>
  )

  const statistikKnapp = (
    <button type="button" onClick={() => setStatistik(true)} className={IKONKNAPP} aria-label="Statistik och rapport" title="Statistik">
      <Icon name="allman.statistik" size={20} />
    </button>
  )

  const uppdateraRad = (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] text-slate-400">{uppdaterad ? `Uppdaterad ${klockslag(uppdaterad)}` : ''}</p>
      <button type="button" onClick={uppdatera} disabled={uppdaterar} className="h-11 px-3 flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <Icon name="allman.aterstall" size={16} className={uppdaterar ? 'animate-spin' : ''} />
        Uppdatera
      </button>
    </div>
  )

  const tidslinje = (fallUt: boolean) => (
    <div data-genomgang="schema-dag">
      <DagTidslinje
        dag={valdDag}
        idag={idag}
        nu={nu}
        besok={dagensSynliga}
        alla={allaPerDag.get(valdDag) ?? []}
        ws={ws}
        franvaro={franvaro}
        valdNyckel={valt?.nyckel ?? null}
        nastaNyckel={nasta?.nyckel ?? null}
        onValj={nyckel => setValdNyckel(nyckel)}
        onOppna={oppna}
        kortid={kortid}
        forstaRad={forstaRad}
        stationer={stationer}
        minId={minId}
        fallUtVald={fallUt}
      />
    </div>
  )

  const laddarForsta = laddar && alla.length === 0

  // ─── Telefon ───
  const mobil = (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        {sokFalt}
        <button type="button" onClick={() => setFilterOppet(true)} className={IKONKNAPP} aria-label={filterAndrat ? 'Filter, filter valda' : 'Filter, inga filter valda'} data-genomgang="schema-filter">
          <Icon name="allman.filter" size={20} />
          {filterAndrat && <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#20c58f] border-2 border-slate-900" />}
        </button>
        {statistikKnapp}
      </div>

      {soker ? (
        <SokTraffar traffar={traffar} fraga={sok.trim()} idag={idag} onOppna={oppna} onRensa={() => setSok('')} onVisaDag={visaDag} />
      ) : (
        <>
          <VyVal vy={vy} onVy={bytVy} />

          {vy === 'dag' && (
            <>
              <VeckoRemsa
                valdDag={valdDag}
                idag={idag}
                belastningFor={belastningFor}
                luckor={dagensLuckor}
                onValjDag={valjDag}
                onBytVecka={n => valjDag(laggTillDagar(valdDag, 7 * n))}
                onIdag={tillIdag}
              />
              <HjalpText id="schema-dag" rubrik="Dagen i tidsordning" niva="h3">
                Mellan besöken står körtiden med bil och de lediga stunderna. Tryck på ett besök för Navigera, Ring och Öppna.
              </HjalpText>
              {tidslinje(true)}
            </>
          )}

          {vy === 'vecka' && (
            <>
              <VeckoNav valdDag={valdDag} onBytVecka={n => valjDag(laggTillDagar(valdDag, 7 * n))} onIdag={tillIdag} />
              <VeckoLista dagar={veckoDagar} idag={idag} besokPerDag={synligaPerDag} belastningFor={belastningFor} onOppna={oppna} onVisaDag={visaDag} />
            </>
          )}

          {vy === 'manad' && (
            <>
              <div className="flex items-center justify-between gap-2">
                <ManadNav manad={manad} onBytManad={n => setManad(m => laggTillManader(m, n))} />
                <button type="button" onClick={tillIdag} className="h-11 px-3 flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
                  <Icon name="falt.idag" size={16} />Idag
                </button>
              </div>
              <ManadKalender manad={manad} valdDag={valdDag} idag={idag} belastningFor={belastningFor} antalFor={antalFor} onValjDag={visaDag} onBytManad={n => setManad(m => laggTillManader(m, n))} />
              <p className="text-[13px] text-slate-400">Siffran är antal besök och punkten hur full dagen är. Tryck på en dag för att se den.</p>
            </>
          )}
        </>
      )}

      {uppdateraRad}
    </div>
  )

  // ─── Dator ───
  const rubrikDator = vy === 'dag' ? dagRubrik(valdDag) : vy === 'vecka' ? `Vecka ${veckonummer(valdDag)}, ${veckoSpann(valdDag, true)}` : manadRubrik(manad)
  const stegEtikett = vy === 'dag' ? 'dagen' : vy === 'vecka' ? 'veckan' : 'månaden'
  const dator = (
    <div className="max-w-[1600px] mx-auto p-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label={`Förra ${stegEtikett}`} onClick={() => steg(-1)} className={IKONKNAPP}>
            <Icon name="allman.chevron-vanster" size={20} />
          </button>
          <button type="button" onClick={tillIdag} className="h-11 px-3 flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
            <Icon name="falt.idag" size={16} />Idag
          </button>
          <button type="button" aria-label={`Nästa ${stegEtikett}`} onClick={() => steg(1)} className={IKONKNAPP}>
            <Icon name="allman.chevron" size={20} />
          </button>
          <h2 className="ml-1 mr-auto text-lg font-semibold text-white">{soker ? 'Sökträffar' : rubrikDator}</h2>
          <VyVal vy={vy} onVy={v => { setSok(''); bytVy(v) }} />
          <div className="w-72">{sokFalt}</div>
          <span className="text-[13px] text-slate-400">{uppdaterad ? `Uppdaterad ${klockslag(uppdaterad)}` : ''}</span>
          <button type="button" onClick={uppdatera} disabled={uppdaterar} className={IKONKNAPP} aria-label="Uppdatera" title="Uppdatera">
            <Icon name="allman.aterstall" size={20} className={uppdaterar ? 'animate-spin' : ''} />
          </button>
          {statistikKnapp}
        </div>

        {soker ? (
          <SokTraffar traffar={traffar} fraga={sok.trim()} idag={idag} onOppna={oppna} onRensa={() => setSok('')} onVisaDag={visaDag} />
        ) : vy === 'vecka' ? (
          <>
            <HjalpText id="schema-vecka" rubrik="Så läser du veckan" niva="h3">
              Under varje dag står hur många av dagens arbetstimmar som är bokade. Arbetstiden räknas från ditt arbetsschema och din frånvaro. Mellan besöken står körtiden med bil.
            </HjalpText>
            <VeckoRutnat
              dagar={veckoDagar}
              idag={idag}
              nu={nu}
              besokPerDag={synligaPerDag}
              allaPerDag={allaPerDag}
              ws={ws}
              franvaro={franvaro}
              belastningFor={belastningFor}
              valdNyckel={valt?.nyckel ?? null}
              onValj={valjBesok}
              onVisaDag={visaDag}
              kortid={kortid}
              stationer={stationer}
            />
            {mestLedig && (
              <p className="flex items-center gap-2 text-[13px] text-slate-400">
                <Icon name="allman.klocka" size={16} />
                Mest ledig tid resten av veckan: {mestLedig.dag === idag ? 'idag' : dagRubrik(mestLedig.dag).toLowerCase()} {klockslag(mestLedig.start)} till {klockslag(mestLedig.slut)}, {varaktighet((mestLedig.slut.getTime() - mestLedig.start.getTime()) / 60_000)}.
              </p>
            )}
          </>
        ) : vy === 'dag' ? (
          <div className="max-w-3xl">{tidslinje(false)}</div>
        ) : (
          <ManadKalender manad={manad} valdDag={valdDag} idag={idag} belastningFor={belastningFor} antalFor={antalFor} onValjDag={visaDag} onBytManad={n => setManad(m => laggTillManader(m, n))} />
        )}
      </div>

      <aside aria-label="Valt besök, datum och filter" className="grid gap-4 grid-cols-2 xl:grid-cols-1 items-start">
        <ValtBesok
          besok={valt}
          idag={idag}
          kortid={valt ? kortid.get(valt.nyckel) : null}
          stationer={valt?.customerId ? stationer.get(valt.customerId) : undefined}
          minId={minId}
          onOppna={oppna}
        />
        <section aria-labelledby="schema-hoppa" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id="schema-hoppa" className="flex items-center gap-2 text-sm font-semibold text-white">
              <Icon name="allman.kalender" size={16} className="text-slate-400" />
              Hoppa till datum
            </h3>
            <ManadNav liten manad={manad} onBytManad={n => setManad(m => laggTillManader(m, n))} />
          </div>
          <ManadKalender
            liten
            markeraVecka={vy === 'vecka'}
            manad={manad}
            valdDag={valdDag}
            idag={idag}
            belastningFor={belastningFor}
            antalFor={antalFor}
            onValjDag={dag => { setSok(''); valjDag(dag) }}
            onBytManad={n => setManad(m => laggTillManader(m, n))}
          />
          <p className="text-xs text-slate-400">{vy === 'vecka' ? 'Välj en dag för att visa dess vecka.' : 'Välj en dag för att visa den.'}</p>
        </section>
        <section aria-labelledby="schema-visa" data-genomgang="schema-filter" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 space-y-2">
          <h3 id="schema-visa" className="flex items-center gap-2 text-sm font-semibold text-white">
            <Icon name="allman.filter" size={16} className="text-slate-400" />
            Visa
          </h3>
          <SchemaFilterInnehall filter={filter} onFilter={setFilter} />
        </section>
      </aside>
    </div>
  )

  return (
    <>
      {laddarForsta ? (
        <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar ditt schema..." /></div>
      ) : fel ? (
        <div className="max-w-xl mx-auto p-4">
          <div className="rounded-2xl bg-slate-900 border border-red-500/40 p-4">
            <p className="text-white font-medium">{fel}</p>
            <button type="button" onClick={ladda} className="mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800">Försök igen</button>
          </div>
        </div>
      ) : arDator ? dator : mobil}

      <FilterArk oppen={filterOppet && !arDator} onClose={() => setFilterOppet(false)} filter={filter} onFilter={setFilter} />
      <OppnaArende
        arende={oppet}
        onClose={() => { setOppet(null); setKommunikation(false) }}
        onSaved={ladda}
        oppnaKommunikation={kommunikation}
      />
      {minId && (
        <ReportModal isOpen={statistik} onClose={() => setStatistik(false)} technicianId={minId} onOpenCase={oppnaFranRapport} />
      )}
      {!laddarForsta && (
        <Genomgang id={arDator ? 'ny-schema-dator' : 'ny-schema'} steg={arDator ? GENOMGANG_DATOR : GENOMGANG_MOBIL} tvinga={visaMig} onStang={() => setVisaMig(false)} />
      )}
    </>
  )
}

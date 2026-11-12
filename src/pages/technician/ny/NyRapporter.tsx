// src/pages/technician/ny/NyRapporter.tsx
// Mina rapporter i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
//
// Avslutade ärenden där inloggad tekniker är tekniker 1, 2 eller 3, alla typer
// utom egenkontroll (som saknar ärenderapport). Sök på kund eller ärendenummer,
// period 30 dagar, 90 dagar eller 12 månader (standard 30), filter på typ,
// grupperat per månad. Rapportfunktionerna körs bara för ärendet man arbetar med
// (RapportForArende), aldrig för hela listan.
//
// Telefon: varje rad har Ladda ned och Skicka. Skicka öppnar valet till kunden
// (adressen visas, bekräftas i ett ark) eller till mig.
// Dator: tabellik lista och vald rapport i en högerpanel med Ladda ned PDF
// (stationskontroll även Excel), Skicka till kund med adressfält och bekräftelse,
// Skicka till mig och Öppna ärendet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icon } from '../../../components/icons/Icon'
import Portal from '../../../components/ui/Portal'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { useArDator } from '../../../components/technician/ny/arenden/useArDator'
import { TomtLage } from '../../../components/technician/ny/arenden/ArendeSektion'
import { kortDatum, manadText } from '../../../components/technician/ny/arenden/arendeLogik'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { StatusPunkt } from '../../../components/technician/ny/besokUi'
import { svenskDag } from '../../../services/teknikerDagService'
import { hamtaRapporter } from '../../../components/technician/ny/rapporter/rapportData'
import { RapportForArende } from '../../../components/technician/ny/rapporter/RapportForArende'
import { SkickaTillKundArk } from '../../../components/technician/ny/rapporter/SkickaTillKundArk'
import type { RapportHandlingar } from '../../../components/technician/ny/rapporter/rapportHandlingar'
import {
  PERIOD_VAL, RAPPORT_NAMN, TYP_FILTER_VAL, arGiltigEpost, filtreraRapporter, grupperaPerManad, periodFran,
  type RapportPeriod, type RapportRad, type RapportTypFilter,
} from '../../../components/technician/ny/rapporter/rapportLogik'

const FOKUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
const IKONKNAPP = `w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50 ${FOKUS}`
const IKONKNAPP_PRIMAR = `w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#20c58f] text-[#04281c] hover:bg-[#1bb07f] disabled:opacity-50 ${FOKUS}`
const PANELKNAPP = `w-full h-11 px-3.5 flex items-center gap-2.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${FOKUS}`

type Atgard = { rad: RapportRad; vad: 'ladda' | 'skicka' }

export default function NyRapporter() {
  const { profile } = useAuth()
  const tek = profile?.technician_id ?? null
  const arDator = useArDator()
  const idag = svenskDag()

  const [period, setPeriod] = useState<RapportPeriod>('30')
  const [sok, setSok] = useState('')
  const [typ, setTyp] = useState<RapportTypFilter>('alla')
  const [rader, setRader] = useState<RapportRad[]>([])
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)
  const [valdNyckel, setValdNyckel] = useState<string | null>(null)
  const [atgard, setAtgard] = useState<Atgard | null>(null)
  const [oppet, setOppet] = useState<ArendeRef | null>(null)

  const ladda = useCallback(async () => {
    if (!tek) { setLaddar(false); setFel('Ditt konto är inte kopplat till en tekniker'); return }
    setLaddar(true)
    try {
      setRader(await hamtaRapporter(tek, periodFran(period, svenskDag())))
      setFel(null)
    } catch (e) {
      console.error('[NyRapporter]', e)
      setFel('Kunde inte hämta dina rapporter')
    } finally {
      setLaddar(false)
    }
  }, [tek, period])

  useEffect(() => { void ladda() }, [ladda])

  const synliga = useMemo(() => filtreraRapporter(rader, sok, typ), [rader, sok, typ])
  const manader = useMemo(() => grupperaPerManad(synliga), [synliga])
  const valt = arDator ? (synliga.find(r => r.nyckel === valdNyckel) ?? synliga[0] ?? null) : null

  useNySidhuvud({ underrubrik: 'Avslutade ärenden där du är tekniker 1, 2 eller 3' })

  const periodText = PERIOD_VAL.find(p => p.id === period)?.lang ?? ''
  const avslutaAtgard = useCallback(() => setAtgard(null), [])

  return (
    <div className="max-w-[1500px] mx-auto p-4 lg:p-6 space-y-4">
      <HjalpText id="rapporter-sida" rubrik="Dina rapporter">
        Inget skickas av sig självt. Här skickar du rapporten till kunden eller dig själv, eller laddar ned den. Du ser bara ärenden där du var tekniker.
      </HjalpText>

      {/* Sök, period och typ */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
        <label className="flex items-center gap-2 h-11 lg:w-80 px-3 rounded-xl border border-slate-700 bg-slate-900 text-slate-400 focus-within:border-[#20c58f]/60">
          <Icon name="allman.sok" size={20} />
          <span className="sr-only">Sök kund eller ärendenummer</span>
          <input
            type="search"
            value={sok}
            onChange={e => setSok(e.target.value)}
            placeholder="Sök kund eller ärendenummer"
            className="flex-1 min-w-0 bg-transparent border-0 text-[15px] text-white placeholder-slate-500 focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <div role="group" aria-label="Period" className="flex-1 lg:flex-none grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-800">
            {PERIOD_VAL.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`h-9 px-1 lg:px-3 whitespace-nowrap rounded-lg text-[13px] lg:text-sm transition-colors ${FOKUS} ${
                  period === p.id ? 'bg-slate-900 border border-slate-600 text-white font-semibold' : 'border border-transparent text-slate-300 hover:text-white font-medium'
                }`}
              >
                <span className="lg:hidden">{p.kort}</span>
                <span className="hidden lg:inline">{p.lang}</span>
              </button>
            ))}
          </div>
          <label className="relative flex-shrink-0">
            <span className="sr-only">Typ av ärende</span>
            <select
              value={typ}
              onChange={e => setTyp(e.target.value as RapportTypFilter)}
              className={`h-11 max-w-[8.5rem] lg:max-w-none pl-3 pr-8 rounded-xl border bg-slate-900 text-sm font-semibold appearance-none ${FOKUS} ${
                typ !== 'alla' ? 'border-[#20c58f]/60 text-white' : 'border-slate-700 text-slate-300'
              }`}
            >
              {TYP_FILTER_VAL.map(t => <option key={t.id} value={t.id}>{t.text}</option>)}
            </select>
            <Icon name="allman.chevron" size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
          </label>
        </div>
      </div>

      {laddar && rader.length === 0 ? (
        <div role="status" className="space-y-2">
          <span className="sr-only">Hämtar dina rapporter</span>
          {[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-800/70 animate-pulse" />)}
        </div>
      ) : fel ? (
        <div className="max-w-xl rounded-2xl bg-slate-900 border border-red-500/40 p-4">
          <p className="text-white font-medium">{fel}</p>
          <button type="button" onClick={() => { void ladda() }} className={`mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800 ${FOKUS}`}>Försök igen</button>
        </div>
      ) : synliga.length === 0 ? (
        rader.length > 0
          ? <TomtLage rubrik="Inga träffar" text="Inga rapporter matchar sökningen eller typen." />
          : <TomtLage rubrik="Inga avslutade ärenden" text={`Du har inga avslutade ärenden de senaste ${periodText}. Välj en längre period för att se äldre.`} />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
          <div className="min-w-0 space-y-5" aria-busy={laddar}>
            {arDator && (
              <div aria-hidden="true" className="grid grid-cols-[110px_76px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_96px] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Ärende</span><span>Datum</span><span>Kund</span><span>Tjänst och rapport</span><span>Kundens e-post</span><span className="text-right">Rapport</span>
              </div>
            )}
            {manader.map(m => (
              <section key={m.manad} aria-label={manadText(m.manad)} className="space-y-2">
                <h2 className="px-1 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {manadText(m.manad)}
                  <span className="font-mono text-slate-500">{m.rader.length}</span>
                </h2>
                <ul className={arDator ? 'rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden' : 'space-y-2'}>
                  {m.rader.map(r => arDator ? (
                    <DatorRad
                      key={r.nyckel}
                      rad={r}
                      idag={idag}
                      vald={valt?.nyckel === r.nyckel}
                      upptagen={atgard?.rad.nyckel === r.nyckel}
                      onValj={() => setValdNyckel(r.nyckel)}
                      onLadda={() => { setValdNyckel(r.nyckel); setAtgard({ rad: r, vad: 'ladda' }) }}
                      onSkicka={() => { setValdNyckel(r.nyckel); setAtgard({ rad: r, vad: 'skicka' }) }}
                    />
                  ) : (
                    <TelefonRad
                      key={r.nyckel}
                      rad={r}
                      idag={idag}
                      upptagen={atgard?.rad.nyckel === r.nyckel}
                      onLadda={() => setAtgard({ rad: r, vad: 'ladda' })}
                      onSkicka={() => setAtgard({ rad: r, vad: 'skicka' })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {arDator && (
            <aside aria-label="Vald rapport" className="sticky top-4">
              {valt
                ? <RapportForArende key={valt.nyckel} rad={valt}>{(rapport, laddarRapport) => (
                    <Panel rad={valt} idag={idag} rapport={rapport} laddar={laddarRapport} onOppna={() => setOppet({ kalla: valt.kalla, id: valt.id })} />
                  )}</RapportForArende>
                : null}
            </aside>
          )}
        </div>
      )}

      {/* Ladda ned eller Skicka från en rad: rapportfunktionen körs bara för det ärendet */}
      {atgard && (
        <RapportForArende key={`${atgard.rad.nyckel}:${atgard.vad}`} rad={atgard.rad}>
          {(rapport, laddarRapport) => (
            <RadAtgard atgard={atgard} rapport={rapport} laddar={laddarRapport} onKlar={avslutaAtgard} />
          )}
        </RapportForArende>
      )}

      <OppnaArende arende={oppet} onClose={() => setOppet(null)} onSaved={() => { void ladda() }} />
    </div>
  )
}

// ─── Rader ───

function TelefonRad({ rad: r, idag, upptagen, onLadda, onSkicka }: {
  rad: RapportRad; idag: string; upptagen: boolean; onLadda: () => void; onSkicka: () => void
}) {
  return (
    <li className="rounded-2xl bg-slate-900 border border-slate-700/60 p-3 flex items-center gap-2.5">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="flex gap-2 text-[13px] text-slate-400">
          {r.arendenummer && <span className="font-mono">{r.arendenummer}</span>}
          <span>{kortDatum(r.dag, idag)}</span>
        </p>
        <p className="text-[15px] font-semibold text-white truncate" data-kund>{r.kund}</p>
        <p className="text-sm text-slate-300 truncate">{r.tjanst} · {RAPPORT_NAMN[r.sort]}</p>
        <p className="text-[13px] text-slate-400 truncate" data-epost>{r.kundEpost ?? 'Kunden saknar e-post'}</p>
      </div>
      <button type="button" onClick={onLadda} disabled={upptagen} aria-label={`Ladda ned rapporten för ${r.arendenummer ?? r.kund}`} className={IKONKNAPP}>
        {upptagen ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="rapport.ladda" size={20} />}
      </button>
      <button type="button" onClick={onSkicka} disabled={upptagen} aria-label={`Skicka rapporten för ${r.arendenummer ?? r.kund}`} className={IKONKNAPP_PRIMAR}>
        <Icon name="rapport.skicka" size={20} />
      </button>
    </li>
  )
}

function DatorRad({ rad: r, idag, vald, upptagen, onValj, onLadda, onSkicka }: {
  rad: RapportRad; idag: string; vald: boolean; upptagen: boolean; onValj: () => void; onLadda: () => void; onSkicka: () => void
}) {
  return (
    <li
      onClick={onValj}
      className={`grid grid-cols-[110px_76px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_96px] gap-3 items-center px-3 py-2.5 text-sm cursor-pointer transition-colors ${
        vald ? 'bg-[#20c58f]/10' : 'hover:bg-slate-800/60'
      }`}
    >
      <button type="button" onClick={e => { e.stopPropagation(); onValj() }} aria-pressed={vald} className={`text-left font-mono text-[13px] text-slate-300 rounded ${FOKUS}`}>
        {r.arendenummer ?? 'Utan nummer'}
      </button>
      <span className="text-[13px] text-slate-400">{kortDatum(r.dag, idag)}</span>
      <span className="font-semibold text-white truncate" data-kund>{r.kund}</span>
      <span className="text-slate-300 truncate">{r.tjanst} · {RAPPORT_NAMN[r.sort]}</span>
      <span className="text-[13px] text-slate-400 truncate" data-epost>{r.kundEpost ?? 'Saknas'}</span>
      <span className="flex justify-end gap-1.5">
        <button type="button" onClick={e => { e.stopPropagation(); onLadda() }} disabled={upptagen} aria-label={`Ladda ned rapporten för ${r.arendenummer ?? r.kund}`} className={IKONKNAPP.replace('w-11 h-11', 'w-10 h-10')}>
          {upptagen ? <Icon name="allman.laddar" size={16} className="animate-spin" /> : <Icon name="rapport.ladda" size={16} />}
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onSkicka() }} disabled={upptagen} aria-label={`Skicka rapporten för ${r.arendenummer ?? r.kund}`} className={IKONKNAPP_PRIMAR.replace('w-11 h-11', 'w-10 h-10')}>
          <Icon name="rapport.skicka" size={16} />
        </button>
      </span>
    </li>
  )
}

// ─── Åtgärd från en rad ───

/** Ladda ned startar när rapporten är redo. Skicka visar valet till kunden eller till mig. */
function RadAtgard({ atgard, rapport, laddar, onKlar }: {
  atgard: Atgard; rapport: RapportHandlingar | null; laddar: boolean; onKlar: () => void
}) {
  const startad = useRef(false)

  useEffect(() => {
    if (atgard.vad !== 'ladda' || startad.current || laddar) return
    startad.current = true
    if (!rapport) { onKlar(); return }
    void rapport.laddaNed().finally(onKlar)
  }, [atgard.vad, rapport, laddar, onKlar])

  if (atgard.vad === 'ladda') return null
  return <SkickaValArk rad={atgard.rad} rapport={rapport} laddar={laddar} onStang={onKlar} />
}

function SkickaValArk({ rad, rapport, laddar, onStang }: {
  rad: RapportRad; rapport: RapportHandlingar | null; laddar: boolean; onStang: () => void
}) {
  const [bekrafta, setBekrafta] = useState(false)
  const [skickar, setSkickar] = useState(false)
  const stangRef = useRef<HTMLButtonElement>(null)
  const kundEpost = rapport?.kundEpost ?? rad.kundEpost
  const upptagen = laddar || skickar || !!rapport?.upptagen

  useEffect(() => {
    stangRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !bekrafta) onStang() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [bekrafta, onStang])

  const tillMig = async () => {
    if (!rapport) return
    setSkickar(true)
    const ok = await rapport.skickaTillMig()
    setSkickar(false)
    if (ok) onStang()
  }
  const tillKund = async () => {
    if (!rapport || !kundEpost) return
    setSkickar(true)
    const ok = await rapport.skickaTillKund(kundEpost)
    setSkickar(false)
    if (ok) onStang()
  }
  const avbrytBekrafta = useCallback(() => setBekrafta(false), [])

  if (bekrafta && rapport && kundEpost) {
    return (
      <SkickaTillKundArk
        oppen
        rapportNamn={rapport.rapportNamn}
        arendenummer={rapport.arendenummer}
        epost={kundEpost}
        tidigare={rapport.tidigareTillKund}
        skickar={skickar}
        onAvbryt={avbrytBekrafta}
        onSkicka={() => { void tillKund() }}
      />
    )
  }

  const VAL = `w-full flex items-center gap-3 px-2 py-3 min-h-[64px] rounded-xl text-left hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${FOKUS}`
  return (
    <Portal>
      <div className="fixed inset-0 z-[10000] pointer-events-auto flex items-end lg:items-center justify-center">
        <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" onClick={onStang} />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="skicka-val-rubrik"
          className="relative w-full lg:max-w-md bg-slate-900 border-t lg:border border-slate-700 rounded-t-3xl lg:rounded-2xl shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <span aria-hidden="true" className="lg:hidden block mx-auto mt-2 w-10 h-1 rounded-full bg-slate-600" />
          <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
            <div className="min-w-0">
              <h2 id="skicka-val-rubrik" className="text-lg font-semibold text-white">Skicka rapporten</h2>
              <p className="text-sm text-slate-400 truncate">{[rad.arendenummer, RAPPORT_NAMN[rad.sort]].filter(Boolean).join(', ')}</p>
            </div>
            <button ref={stangRef} type="button" onClick={onStang} aria-label="Stäng" className={`w-11 h-11 -mr-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 ${FOKUS}`}>
              <Icon name="allman.stang" size={20} />
            </button>
          </header>
          {laddar && (
            <p className="px-4 pb-1 flex items-center gap-2 text-sm text-slate-400">
              <Icon name="allman.laddar" size={16} className="animate-spin" />Hämtar rapporten...
            </p>
          )}
          {!laddar && !rapport && <p className="px-4 pb-2 text-sm text-amber-300">Rapporten kunde inte hämtas. Öppna ärendet och försök där.</p>}
          <ul className="px-3 space-y-1">
            <li>
              <button type="button" onClick={() => setBekrafta(true)} disabled={upptagen || !rapport || !kundEpost || !rapport.kanSkapas} className={VAL}>
                <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#20c58f]/10 text-[#20c58f] flex items-center justify-center"><Icon name="rapport.skicka" size={24} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-white">Till kunden</span>
                  <span className="block text-sm text-slate-400 truncate" data-epost>{kundEpost ?? 'Kunden saknar e-post i ärendet'}</span>
                </span>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => { void tillMig() }} disabled={upptagen || !rapport || !rapport.minEpost || !rapport.kanSkapas} className={VAL}>
                <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center">
                  {skickar ? <Icon name="allman.laddar" size={24} className="animate-spin" /> : <Icon name="rapport.person" size={24} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-white">Till mig</span>
                  <span className="block text-sm text-slate-400 truncate">{rapport?.minEpost ?? 'Ditt konto saknar e-post'}</span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </Portal>
  )
}

// ─── Datorns högerpanel ───

function Panel({ rad: r, idag, rapport, laddar, onOppna }: {
  rad: RapportRad; idag: string; rapport: RapportHandlingar | null; laddar: boolean; onOppna: () => void
}) {
  const [mottagare, setMottagare] = useState(r.kundEpost ?? '')
  const [bekrafta, setBekrafta] = useState(false)
  const [skickar, setSkickar] = useState(false)
  const avbryt = useCallback(() => setBekrafta(false), [])

  useEffect(() => { setMottagare(rapport?.kundEpost ?? r.kundEpost ?? '') }, [rapport?.kundEpost, r.kundEpost])

  const upptagen = laddar || skickar || !!rapport?.upptagen || !rapport?.kanSkapas
  const giltig = arGiltigEpost(mottagare)
  const andrad = !!mottagare.trim() && mottagare.trim().toLowerCase() !== (rapport?.kundEpost ?? '').toLowerCase()

  const skicka = async () => {
    if (!rapport || !giltig) return
    setSkickar(true)
    const ok = await rapport.skickaTillKund(mottagare.trim())
    setSkickar(false)
    if (ok) setBekrafta(false)
  }

  return (
    <section aria-labelledby="rapport-vald-rubrik" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-[13px] text-slate-400">
          {r.arendenummer && <span className="font-mono">{r.arendenummer}</span>}{r.arendenummer ? ', ' : ''}avslutat {kortDatum(r.dag, idag)}
        </p>
        <h2 id="rapport-vald-rubrik" className="text-lg font-semibold text-white leading-snug" data-kund>{r.kund}</h2>
        <p className="text-sm text-slate-300">{r.tjanst}</p>
      </div>

      {laddar ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Icon name="allman.laddar" size={16} className="animate-spin" />Hämtar rapporten...</p>
      ) : !rapport ? (
        <StatusPunkt ton="gul">{r.sort === 'kontroll' ? 'Ingen avslutad kontrollrunda hittades' : 'Rapporten kunde inte hämtas'}</StatusPunkt>
      ) : rapport.tidigareTillKund ? (
        <StatusPunkt ton="gron">{rapport.tidigareTillKund}</StatusPunkt>
      ) : (
        <StatusPunkt ton="gron">{rapport.rapportNamn} klar att skicka eller ladda ned</StatusPunkt>
      )}

      <div className="space-y-2">
        <button type="button" onClick={() => { void rapport?.laddaNed() }} disabled={upptagen || !rapport} className={PANELKNAPP}>
          {rapport?.upptagen ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="rapport.ladda" size={20} />}
          Ladda ned PDF
        </button>
        {rapport?.laddaNedExcel && (
          <button type="button" onClick={() => { void rapport.laddaNedExcel?.() }} disabled={upptagen} className={PANELKNAPP}>
            <Icon name="upphandling.excel" size={20} />
            Ladda ned Excel
          </button>
        )}
      </div>

      <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 space-y-2">
        <label htmlFor="rapport-mottagare" className="block text-[13px] font-medium text-slate-300">Skicka till kund</label>
        <input
          id="rapport-mottagare"
          type="email"
          value={mottagare}
          onChange={e => setMottagare(e.target.value)}
          placeholder="namn@foretag.se"
          data-epost
          className="w-full h-10 px-3 rounded-lg border border-slate-600 bg-slate-950/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        />
        {mottagare && !giltig && <p className="text-[13px] text-red-400">Ange en giltig e-postadress.</p>}
        {andrad && giltig && <p className="text-[13px] text-slate-400">Adressen gäller bara det här utskicket. Ärendet ändras inte.</p>}
        <button
          type="button"
          onClick={() => setBekrafta(true)}
          disabled={upptagen || !rapport || !giltig}
          className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#20c58f] text-[#04281c] text-sm font-semibold hover:bg-[#1bb07f] disabled:opacity-50 disabled:cursor-not-allowed ${FOKUS}`}
        >
          <Icon name="rapport.skicka" size={16} />
          Skicka till kunden
        </button>
      </div>

      <button type="button" onClick={() => { void rapport?.skickaTillMig() }} disabled={upptagen || !rapport?.minEpost} className={PANELKNAPP}>
        <Icon name="rapport.person" size={20} />
        <span className="flex-1 min-w-0 text-left truncate">Skicka till mig{rapport?.minEpost ? <span className="font-normal text-slate-400">, {rapport.minEpost}</span> : null}</span>
      </button>

      <button type="button" onClick={onOppna} className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#20c58f] hover:bg-slate-800 ${FOKUS}`}>
        <Icon name="arende.arende" size={16} />
        Öppna ärendet
      </button>

      {rapport && (
        <SkickaTillKundArk
          oppen={bekrafta}
          rapportNamn={rapport.rapportNamn}
          arendenummer={rapport.arendenummer}
          epost={mottagare.trim()}
          tidigare={rapport.tidigareTillKund}
          adressHjalp={andrad ? 'Adressen du skrev gäller bara det här utskicket.' : undefined}
          skickar={skickar}
          onAvbryt={avbryt}
          onSkicka={() => { void skicka() }}
        />
      )}
    </section>
  )
}

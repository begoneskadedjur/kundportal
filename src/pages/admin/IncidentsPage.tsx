// src/pages/admin/IncidentsPage.tsx
// Tillbud och avvikelser, samma sida för admin, koordinator, tekniker och säljare
// (/<roll>/tillbud-avvikelser). Ombyggd 2026-10-24 efter nya sidornas mönster.
//
// Tre lägen:
//   Rapportera      formuläret först, för den som bara vill rapportera snabbt
//   Mina rapporter  rapporter jag har skickat eller står som berörd i, med status
//   Registret       bara för mottagare (incident_recipients): alla rapporter man ser,
//                   grupperade efter status, med filter, export och utredning
// Insyn styrs av RLS: mottagare ser rapporter av sina typer, övriga bara rapporter de
// rapporterat eller är berörda i. Utreda och radera kan den som tar emot typen.
//
// Dator: listan och vald rapport bredvid varandra. Telefon: tryck öppnar rapporten.
// Djuplänkar: ?new=1 (&caseId=<id>) öppnar formuläret med ärendet kopplat,
// ?rapport=<id> väljer en rapport (mejlet till mottagarna).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNyArbetsvy } from '../../hooks/useNyArbetsvy'
import { useNySidhuvud } from '../../components/technician/ny/layout/NySidhuvud'
import { useArDator } from '../../components/technician/ny/arenden/useArDator'
import { Genomgang, type GenomgangSteg } from '../../components/technician/ny/hjalp/Genomgang'
import { Icon } from '../../components/icons/Icon'
import { IKONKNAPP, KNAPP_PRIMAR, KNAPP_SEKUNDAR } from '../../components/fragor/fragorUi'
import { IncidentRecipientService } from '../../services/incidentRecipientService'
import { ALL_INCIDENT_TYPES, INCIDENT_STATUS_CONFIG, type CaseIncident, type IncidentStatus, type IncidentType } from '../../types/caseIncidents'
import TillbudFormular from '../../components/tillbud/TillbudFormular'
import TillbudLista, { type TillbudGrupp } from '../../components/tillbud/TillbudLista'
import TillbudDetalj from '../../components/tillbud/TillbudDetalj'
import {
  arMin, exporteraCsv, forsenad, laggTillDag, matcharSok, sortera, svenskMidnatt, typText,
  type Anstalld, type KoppladArende,
} from '../../components/tillbud/tillbudLogik'

type Lage = 'rapportera' | 'mina' | 'register'

const SELECT =
  'h-11 w-full px-3 rounded-xl border border-slate-600 bg-slate-900 text-[15px] text-white focus:outline-none focus:border-[#20c58f] focus-visible:ring-2 focus-visible:ring-[#20c58f]'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Tre lägen', text: 'Rapportera är formuläret. Mina rapporter visar det du har skickat och där du står som berörd, med status. Tar du emot rapporter finns också Registret.', mal: 'tillbud-lagen' },
  { rubrik: 'Välj typ', text: 'Oj! Tillbud när det kunde ha gått illa, Aj! Olycka när någon skadades och Hmm Avvikelse när något avvek från rutinen.', mal: 'tillbud-typ' },
  { rubrik: 'Skicka', text: 'Skriv vad som hände och tryck Skicka rapport. De som tar emot typen får en notis och ett mejl direkt.', mal: 'tillbud-skicka' },
]

export default function IncidentsPage() {
  const { user, profile, isTechnician } = useAuth()
  const { aktiv: nyAktiv } = useNyArbetsvy()
  const arDator = useArDator()
  const [params, setParams] = useSearchParams()
  const technicianId = profile?.technician_id || null
  const rapportor = profile?.display_name || profile?.email || 'Okänd'

  const [mottagarTyper, setMottagarTyper] = useState<Set<IncidentType>>(new Set())
  const [typerKlara, setTyperKlara] = useState(false)
  const arMottagare = mottagarTyper.size > 0

  const [rapporter, setRapporter] = useState<CaseIncident[]>([])
  const [laddar, setLaddar] = useState(true)
  const [harLaddat, setHarLaddat] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [anstallda, setAnstallda] = useState<Anstalld[]>([])
  const [lankatArende, setLankatArende] = useState<KoppladArende | null>(null)
  const [lage, setLage] = useState<Lage | null>(() => (params.get('new') === '1' ? 'rapportera' : null))
  const [visaMig, setVisaMig] = useState(false)

  // Filter i Registret
  const [sok, setSok] = useState('')
  const [filterTyp, setFilterTyp] = useState<'' | IncidentType>('')
  const [filterStatus, setFilterStatus] = useState<'' | IncidentStatus>('')
  const [fran, setFran] = useState('')
  const [till, setTill] = useState('')

  const valdId = params.get('rapport')

  const sattParam = useCallback((andra: (p: URLSearchParams) => void) => {
    setParams(prev => {
      const p = new URLSearchParams(prev)
      andra(p)
      return p
    }, { replace: true })
  }, [setParams])

  const valj = useCallback((id: string | null) => {
    sattParam(p => { if (id) p.set('rapport', id); else p.delete('rapport') })
  }, [sattParam])

  // ─── Data ───

  useEffect(() => {
    if (!user?.id) return
    IncidentRecipientService.getRecipientTypes(user.id)
      .then(setMottagarTyper)
      .catch(() => setMottagarTyper(new Set()))
      .finally(() => setTyperKlara(true))
  }, [user?.id])

  useEffect(() => {
    supabase.from('technicians').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setAnstallda(data) })
  }, [])

  const hamta = useCallback(async () => {
    setLaddar(true)
    try {
      const { data, error } = await supabase
        .from('case_incidents')
        .select('*, incident_employees(*)')
        .order('occurred_at', { ascending: false })
      if (error) throw error
      setRapporter(sortera((data || []) as CaseIncident[]))
      setFel(null)
    } catch (err) {
      console.error('Kunde inte hämta rapporterna:', err)
      setFel('Kunde inte hämta rapporterna. Försök igen.')
    } finally {
      setLaddar(false)
      setHarLaddat(true)
    }
  }, [])

  useEffect(() => { hamta() }, [hamta])

  // ?new=1 (&caseId=) öppnar formuläret, med ärendet kopplat om det går att läsa
  useEffect(() => {
    if (params.get('new') !== '1') return
    const caseId = params.get('caseId')
    setLage('rapportera')
    sattParam(p => { p.delete('new'); p.delete('caseId'); p.delete('caseType') })
    if (!caseId) return
    // Avbryts inte vid omkörning: parametrarna tas bort ovan, vilket kör om effekten
    ;(async () => {
      const { data: pc } = await supabase.from('private_cases').select('id, title, case_number').eq('id', caseId).maybeSingle()
      if (pc) { setLankatArende({ id: pc.id, typ: 'private', kund: pc.title || 'Ärende', nummer: pc.case_number, rad: '' }); return }
      const { data: bc } = await supabase.from('business_cases').select('id, title, case_number, company_name').eq('id', caseId).maybeSingle()
      if (bc) { setLankatArende({ id: bc.id, typ: 'business', kund: bc.company_name || bc.title || 'Ärende', nummer: bc.case_number, rad: '' }); return }
      const { data: c } = await supabase.from('cases').select('id, title, case_number').eq('id', caseId).maybeSingle()
      if (c) setLankatArende({ id: c.id, typ: 'contract', kund: c.title || 'Ärende', nummer: c.case_number, rad: '' })
    })().catch(err => console.error('Kunde inte hämta ärendet för rapporten:', err))
  }, [params, sattParam])

  // ─── Urval ───

  const kanHantera = useCallback((i: CaseIncident) => mottagarTyper.has(i.type), [mottagarTyper])

  const mina = useMemo(
    () => (arMottagare ? rapporter.filter(i => arMin(i, user?.id, technicianId)) : rapporter),
    [arMottagare, rapporter, user?.id, technicianId],
  )
  const attHantera = useMemo(() => rapporter.filter(i => i.status === 'ny' && mottagarTyper.has(i.type)).length, [rapporter, mottagarTyper])
  const forsenade = useMemo(() => rapporter.filter(i => mottagarTyper.has(i.type) && forsenad(i)).length, [rapporter, mottagarTyper])
  const minaPagar = mina.filter(i => i.status !== 'avslutad').length

  // Startläge när datan finns: mottagare med nya rapporter landar i Registret,
  // en djuplänk till en rapport i rätt lista, annars formuläret
  useEffect(() => {
    if (lage || !typerKlara || !harLaddat) return
    if (valdId) {
      const i = rapporter.find(r => r.id === valdId)
      setLage(i && arMottagare && (kanHantera(i) || !arMin(i, user?.id, technicianId)) ? 'register' : 'mina')
      return
    }
    setLage(arMottagare && attHantera > 0 ? 'register' : 'rapportera')
  }, [lage, typerKlara, harLaddat, valdId, rapporter, arMottagare, attHantera, user?.id, technicianId, kanHantera])

  // Tekniker och säljare utan mottagaruppdrag har inget register
  useEffect(() => {
    if (typerKlara && !arMottagare && lage === 'register') setLage('mina')
  }, [typerKlara, arMottagare, lage])

  const filtrerade = useMemo(() => rapporter.filter(i => {
    if (!matcharSok(i, sok)) return false
    if (filterTyp && i.type !== filterTyp) return false
    if (filterStatus && i.status !== filterStatus) return false
    const t = new Date(i.occurred_at).getTime()
    if (fran && t < new Date(svenskMidnatt(fran)).getTime()) return false
    if (till && t >= new Date(svenskMidnatt(laggTillDag(till, 1))).getTime()) return false
    return true
  }), [rapporter, sok, filterTyp, filterStatus, fran, till])
  const filterAktivt = !!(sok || filterTyp || filterStatus || fran || till)

  const grupper: TillbudGrupp[] = useMemo(() => {
    if (lage === 'register') {
      const av = (s: IncidentStatus) => filtrerade.filter(i => i.status === s)
      const ut: TillbudGrupp[] = [
        { nyckel: 'ny', rubrik: 'Nya', ikon: 'falt.attgora', ikonFarg: 'text-amber-500', rader: av('ny'),
          beskrivning: 'Ingen har börjat utreda dem. Tryck på en rapport för att utreda och åtgärda.' },
        { nyckel: 'utreds', rubrik: 'Under utredning', ikon: 'tillbud.utredning', ikonFarg: 'text-sky-400', rader: av('under_utredning'),
          beskrivning: 'Orsaken utreds. Nästa steg är en beslutad åtgärd med ansvarig och datum.' },
        { nyckel: 'atgardad', rubrik: 'Åtgärdade, väntar på uppföljning', ikon: 'rapport.atgarder', ikonFarg: 'text-[#20c58f]', rader: av('atgardad'),
          beskrivning: 'Följ upp att åtgärden fungerade. Därefter kan rapporten avslutas.' },
        { nyckel: 'avslutad', rubrik: 'Avslutade', ikon: 'falt.klart', rader: av('avslutad'), hopfalld: !filterAktivt,
          beskrivning: 'Klara rapporter, senaste först.' },
      ]
      return filterAktivt ? ut.filter(g => g.rader.length > 0) : ut
    }
    return [
      { nyckel: 'pagar', rubrik: 'Pågår', ikon: 'tillbud.utredning', ikonFarg: 'text-amber-500', rader: mina.filter(i => i.status !== 'avslutad'),
        beskrivning: 'Rapporter som väntar på utredning, utreds eller följs upp. Den som tar emot rapporten ändrar statusen.' },
      { nyckel: 'klara', rubrik: 'Avslutade', ikon: 'falt.klart', rader: mina.filter(i => i.status === 'avslutad'), hopfalld: true,
        beskrivning: 'Utredda och uppföljda rapporter.' },
    ]
  }, [lage, filtrerade, filterAktivt, mina])

  const lista = lage === 'register' ? filtrerade : mina
  const vald = useMemo(() => (valdId ? rapporter.find(r => r.id === valdId) || null : null), [rapporter, valdId])

  // En länk till en rapport man inte ser
  useEffect(() => {
    if (!harLaddat || laddar || !valdId || vald) return
    toast.error('Rapporten finns inte, eller så har du inte behörighet att se den')
    valj(null)
  }, [harLaddat, laddar, valdId, vald, valj])

  const sammanfattning = arMottagare
    ? `${attHantera} ${attHantera === 1 ? 'ny rapport' : 'nya rapporter'} att hantera${forsenade ? `, ${forsenade} försenade åtgärder` : ''}`
    : `${minaPagar} ${minaPagar === 1 ? 'rapport pågår' : 'rapporter pågår'}`

  const oppnaVisaMig = useCallback(() => { setLage('rapportera'); setVisaMig(true) }, [])
  useNySidhuvud({ underrubrik: harLaddat ? sammanfattning : undefined, onVisaMig: oppnaVisaMig })

  const bytLage = (l: Lage) => { setLage(l); valj(null) }
  const aktivtLage: Lage = lage ?? 'rapportera'
  const klar = typerKlara && harLaddat && lage !== null

  // ─── Rendering ───

  const flikar: { v: Lage; text: string; antal?: number }[] = [
    { v: 'rapportera', text: 'Rapportera' },
    { v: 'mina', text: 'Mina rapporter', antal: mina.length },
    ...(arMottagare ? [{ v: 'register' as Lage, text: 'Registret', antal: rapporter.length }] : []),
  ]

  const detalj = vald && aktivtLage !== 'rapportera' ? (
    <TillbudDetalj
      key={`${vald.id}:${vald.updated_at}`}
      incident={vald}
      kanHantera={kanHantera(vald)}
      hanterare={rapportor}
      anstallda={anstallda}
      onTillbaka={arDator ? undefined : () => valj(null)}
      onAndrad={hamta}
      onRaderad={() => { valj(null); hamta() }}
    />
  ) : null
  const visaListan = arDator || !detalj

  const tomtMina = (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 flex flex-col items-center text-center gap-2">
      <Icon name="tillbud.register" size={32} className="text-slate-500" />
      <p className="text-[17px] font-semibold text-white">Inga rapporter än</p>
      <p className="max-w-md text-[15px] text-slate-400">Rapporter du skickar och rapporter där du står som berörd hamnar här, med status.</p>
      <button type="button" onClick={() => bytLage('rapportera')} className={`${KNAPP_PRIMAR} mt-2`}>
        <Icon name="allman.plus" size={20} />
        Rapportera en händelse
      </button>
    </div>
  )

  return (
    <div className="max-w-[1500px] mx-auto p-4 lg:p-6 flex flex-col gap-5">
      {visaListan && (
        <header className="flex flex-col gap-1">
          {!nyAktiv && <h1 className="text-2xl font-bold text-white leading-tight">Tillbud & Avvikelser</h1>}
          <p className="text-[15px] text-slate-300">
            {harLaddat && arMottagare ? (
              <>
                <strong className={`font-semibold ${attHantera > 0 ? 'text-amber-500' : 'text-slate-200'}`}>
                  {attHantera} {attHantera === 1 ? 'ny rapport' : 'nya rapporter'} att hantera
                </strong>
                {forsenade > 0 && <span className="text-red-400">, {forsenade} försenade åtgärder</span>}
              </>
            ) : 'Oj, aj eller hmm? Rapportera direkt, stort som smått.'}
          </p>
        </header>
      )}

      {visaListan && (
        <div data-genomgang="tillbud-lagen" role="tablist" aria-label="Visa" className="flex gap-5 sm:gap-6 border-b border-slate-700 overflow-x-auto">
          {flikar.map(f => (
            <button
              key={f.v}
              type="button"
              role="tab"
              aria-selected={aktivtLage === f.v}
              onClick={() => bytLage(f.v)}
              className={`min-h-[44px] -mb-px flex-shrink-0 flex items-center gap-1.5 border-b-2 text-[15px] font-semibold whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                aktivtLage === f.v ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {f.text}
              {f.antal !== undefined && harLaddat && <span className="font-medium text-slate-400">{f.antal}</span>}
              {f.v === 'register' && attHantera > 0 && <span aria-label={`${attHantera} nya`} className="w-2 h-2 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>
      )}

      {!klar ? (
        <div className="flex items-center gap-2 py-10 justify-center text-[15px] text-slate-400" role="status">
          <Icon name="allman.laddar" size={20} className="animate-spin" />
          Hämtar rapporterna...
        </div>
      ) : (
        <>
          {/* Formuläret ligger kvar monterat, så det man skrivit finns kvar */}
          <div role="tabpanel" aria-label="Rapportera" className={aktivtLage === 'rapportera' ? 'max-w-3xl w-full' : 'hidden'}>
            <TillbudFormular
              anstallda={anstallda}
              minTeknikerId={isTechnician ? technicianId : null}
              rapportor={rapportor}
              lankatArende={lankatArende}
              onSkickad={hamta}
              onVisaMina={() => bytLage('mina')}
            />
          </div>

          {aktivtLage !== 'rapportera' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] gap-6 items-start">
              {visaListan && (
                <div role="tabpanel" aria-label={aktivtLage === 'register' ? 'Registret' : 'Mina rapporter'} className="flex flex-col gap-5 min-w-0">
                  {aktivtLage === 'register' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <label className="flex-1 min-w-0 h-11 flex items-center gap-2 px-3 rounded-xl border border-slate-600 bg-slate-900 text-slate-400 focus-within:border-[#20c58f]">
                          <Icon name="allman.sok" size={20} />
                          <span className="sr-only">Sök i registret</span>
                          <input
                            type="search"
                            value={sok}
                            onChange={e => setSok(e.target.value)}
                            placeholder="Sök beskrivning, person eller åtgärd"
                            className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-slate-500 focus:outline-none"
                          />
                        </label>
                        <button type="button" onClick={() => exporteraCsv(filtrerade)} disabled={filtrerade.length === 0} className={KNAPP_SEKUNDAR} title="Exportera registret till Excel">
                          <Icon name="rapport.hamta" size={20} />
                          <span className="hidden sm:inline">Exportera</span>
                          <span className="sr-only sm:hidden">Exportera</span>
                        </button>
                      </div>
                      <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <legend className="sr-only">Filter</legend>
                        <label className="flex flex-col gap-1 text-sm text-slate-400 min-w-0">
                          Typ
                          <select value={filterTyp} onChange={e => setFilterTyp(e.target.value as '' | IncidentType)} className={SELECT}>
                            <option value="">Alla typer</option>
                            {ALL_INCIDENT_TYPES.map(t => <option key={t} value={t}>{typText(t)}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-400 min-w-0">
                          Status
                          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as '' | IncidentStatus)} className={SELECT}>
                            <option value="">Alla statusar</option>
                            {(Object.keys(INCIDENT_STATUS_CONFIG) as IncidentStatus[]).map(s => <option key={s} value={s}>{INCIDENT_STATUS_CONFIG[s].label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-400 min-w-0">
                          Från
                          <input type="date" value={fran} max={till || undefined} onChange={e => setFran(e.target.value)} className={SELECT} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-400 min-w-0">
                          Till
                          <input type="date" value={till} min={fran || undefined} onChange={e => setTill(e.target.value)} className={SELECT} />
                        </label>
                      </fieldset>
                      {filterAktivt && (
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span>{filtrerade.length} av {rapporter.length} rapporter</span>
                          <button type="button" onClick={() => { setSok(''); setFilterTyp(''); setFilterStatus(''); setFran(''); setTill('') }} className="min-h-[44px] px-2 font-medium text-[#20c58f] hover:underline">
                            Rensa filter
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {fel && (
                    <div role="alert" className="rounded-2xl border border-red-500/40 bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <p className="flex-1 text-[15px] text-red-400">{fel}</p>
                      <button type="button" onClick={hamta} className={KNAPP_SEKUNDAR}>Försök igen</button>
                    </div>
                  )}

                  {aktivtLage === 'mina' && mina.length === 0 && !fel ? tomtMina : (
                    lista.length === 0 && aktivtLage === 'register' && filterAktivt ? (
                      <p className="text-[15px] text-slate-400">Inga rapporter matchar filtret.</p>
                    ) : (
                      <TillbudLista grupper={grupper} valdId={vald?.id || null} onValj={i => valj(i.id)} kanHantera={kanHantera} />
                    )
                  )}

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <button type="button" onClick={hamta} disabled={laddar} aria-label="Uppdatera listan" className={IKONKNAPP}>
                      <Icon name="utrustning.uppdatera" size={20} className={laddar ? 'animate-spin' : ''} />
                    </button>
                    {aktivtLage === 'mina'
                      ? 'Du ser rapporter du har skickat och rapporter där du står som berörd.'
                      : 'Du ser alla rapporter av de typer du tar emot, och dina egna.'}
                  </div>
                </div>
              )}

              {(arDator || detalj) && (
                <div className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
                  {detalj || (
                    <div className="hidden lg:flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-dashed border-slate-700 p-10">
                      <Icon name="tillbud.register" size={32} className="text-slate-500" />
                      <p className="text-[15px] text-slate-400">
                        {aktivtLage === 'register' ? 'Välj en rapport i listan för att se och utreda den.' : 'Välj en rapport i listan för att se den och hur långt den kommit.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {nyAktiv && klar && (
        <Genomgang id="ny-tillbud" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />
      )}
    </div>
  )
}

// src/components/tillbud/TillbudFormular.tsx
// Rapportera ett tillbud, en olycka eller en avvikelse. Fyra steg: vad hände,
// beskriv (med bilder), när och vem, koppla till ärende (valfritt). Formuläret ligger kvar
// monterat när man byter flik, så det man skrivit finns kvar.
//
// Koppla till ärende: teknikern får sina besök i går och i dag som förslag och kan
// söka bland sina privat-, företags- och avtalsärenden (samma RPC som söklådan,
// global_search, som bara visar teknikerns egna). Kontoret söker bland alla.
// Säljaren har inga ärenden i global_search och söker direkt i privat- och
// företagsärenden, där RLS avgör vad som syns.

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Icon } from '../icons/Icon'
import { IKONKNAPP, KNAPP_PRIMAR, KNAPP_SEKUNDAR } from '../fragor/fragorUi'
import { ALL_INCIDENT_TYPES, INCIDENT_TYPE_CONFIG, type IncidentType } from '../../types/caseIncidents'
import { hamtaBesok } from '../../services/teknikerDagService'
import type { RpcCase } from '../shared/search/searchModel'
import {
  TON_RAM, TON_TEXT, TYP_IKON, TYP_TON, datumTid, idagSvensk, laggTillDag, lokaltTillTidsstampel, nuLokalt,
  rapporteradText, type Anstalld, type KoppladArende,
} from './tillbudLogik'
import { ETIKETT, FALT, StegRubrik, TEXTRUTA, VALFRITT } from './tillbudUi'
import { BildValjare, laddaUppBilder } from './TillbudBilder'

interface Props {
  anstallda: Anstalld[]
  /** Teknikerns id: förvald som berörd och går inte att ta bort */
  minTeknikerId: string | null
  rapportor: string
  /** Ärende ur länken (?caseId=), hämtat av sidan */
  lankatArende: KoppladArende | null
  onSkickad: () => void
  onVisaMina: () => void
}

const ARENDE_IKON = { contract: 'kund.avtal', business: 'allman.foretag', private: 'arende.privat' } as const

const ARENDE_TYP_TEXT: Record<KoppladArende['typ'], string> = { contract: 'Avtal', business: 'Företag', private: 'Privat' }

export default function TillbudFormular({ anstallda, minTeknikerId, rapportor, lankatArende, onSkickad, onVisaMina }: Props) {
  const { user, activeView } = useAuth()
  const [typ, setTyp] = useState<IncidentType>('tillbud')
  const [beskrivning, setBeskrivning] = useState('')
  const [direkt, setDirekt] = useState('')
  const [tid, setTid] = useState(() => nuLokalt())
  const [berorda, setBerorda] = useState<Anstalld[]>([])
  const [arende, setArende] = useState<KoppladArende | null>(null)
  const [arendeSok, setArendeSok] = useState('')
  const [traffar, setTraffar] = useState<KoppladArende[]>([])
  const [soker, setSoker] = useState(false)
  const [forslag, setForslag] = useState<KoppladArende[]>([])
  const [bilder, setBilder] = useState<File[]>([])
  const [skickar, setSkickar] = useState(false)
  const [skickad, setSkickad] = useState<IncidentType | null>(null)
  const beskrivningRef = useRef<HTMLTextAreaElement>(null)

  // Teknikern är förvald som berörd
  const mig = useMemo(() => (minTeknikerId ? anstallda.find(a => a.id === minTeknikerId) || null : null), [anstallda, minTeknikerId])
  useEffect(() => {
    if (mig && berorda.length === 0 && !skickad) setBerorda([mig])
  }, [mig, berorda.length, skickad])

  // Ärendet ur länken
  useEffect(() => {
    if (lankatArende) setArende(lankatArende)
  }, [lankatArende])

  // Förslag: teknikerns besök i går och i dag
  useEffect(() => {
    if (!minTeknikerId) { setForslag([]); return }
    let avbruten = false
    const idag = idagSvensk()
    hamtaBesok(minTeknikerId, laggTillDag(idag, -1), idag)
      .then(lista => {
        if (avbruten) return
        const sorterad = [...lista].sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0))
        setForslag(sorterad.slice(0, 6).map(b => ({
          id: b.id,
          typ: b.kalla === 'cases' ? 'contract' : b.kalla,
          kund: b.kund,
          nummer: b.arendenummer,
          rad: [b.start ? datumTid(b.start.toISOString()) : null, b.skadedjur, b.adress].filter(Boolean).join(', '),
        })))
      })
      .catch(() => { if (!avbruten) setForslag([]) })
    return () => { avbruten = true }
  }, [minTeknikerId])

  // Sök ärende
  useEffect(() => {
    const q = arendeSok.trim()
    if (q.length < 2) { setTraffar([]); setSoker(false); return }
    let avbruten = false
    setSoker(true)
    const t = setTimeout(async () => {
      try {
        let lista: KoppladArende[] = []
        if (activeView === 'säljare') {
          // Säljaren: privat- och företagsärenden direkt, RLS avgör
          const sokText = q.replace(/[%,()]/g, ' ')
          for (const tabell of ['private_cases', 'business_cases'] as const) {
            const { data } = await supabase.from(tabell)
              .select('id, title, case_number')
              .or(`title.ilike.%${sokText}%,case_number.ilike.%${sokText}%`)
              .limit(5)
            lista.push(...(data || []).map(c => ({
              id: c.id as string,
              typ: (tabell === 'private_cases' ? 'private' : 'business') as KoppladArende['typ'],
              kund: (c.title as string) || 'Ärende',
              nummer: (c.case_number as string | null) ?? null,
              rad: '',
            })))
          }
        } else {
          const { data, error } = await supabase.rpc('global_search', {
            p_query: q, p_portal: activeView, p_include_archived: false, p_limit: 8,
          })
          if (error) throw error
          const cases = ((data as { cases?: RpcCase[] } | null)?.cases || [])
          lista = cases.map(c => ({
            id: c.id,
            typ: c.case_type,
            kund: c.customer_name || c.title || 'Ärende',
            nummer: c.number,
            rad: [c.date ? datumTid(c.date).slice(0, 10) : null, c.pest, c.address].filter(Boolean).join(', '),
          }))
        }
        if (!avbruten) setTraffar(lista.slice(0, 8))
      } catch (e) {
        console.error('[TillbudFormular] sök ärende', e)
        if (!avbruten) setTraffar([])
      } finally {
        if (!avbruten) setSoker(false)
      }
    }, 250)
    return () => { avbruten = true; clearTimeout(t) }
  }, [arendeSok, activeView])

  const ledigaAnstallda = anstallda.filter(a => !berorda.some(b => b.id === a.id))
  const kanSkicka = beskrivning.trim().length > 0 && berorda.length > 0 && !skickar
  const saknas = !beskrivning.trim() ? 'Skriv vad som hände för att kunna skicka.' : berorda.length === 0 ? 'Lägg till minst en berörd anställd för att kunna skicka.' : ''

  const tomt = () => {
    setTyp('tillbud'); setBeskrivning(''); setDirekt(''); setTid(nuLokalt())
    setBerorda(mig ? [mig] : []); setArende(null); setArendeSok(''); setTraffar([]); setBilder([])
  }

  const skicka = async () => {
    if (!beskrivning.trim()) { toast.error('Skriv vad som hände'); return }
    if (berorda.length === 0) { toast.error('Lägg till minst en berörd anställd'); return }
    if (!tid) { toast.error('Ange när händelsen inträffade'); return }
    const tidpunkt = lokaltTillTidsstampel(tid)
    if (new Date(tidpunkt).getTime() > Date.now() + 60_000) { toast.error('Tiden kan inte vara senare än nu'); return }

    setSkickar(true)
    try {
      const forsta = berorda[0]
      const { data: ny, error } = await supabase
        .from('case_incidents')
        .insert({
          type: typ,
          description: beskrivning.trim(),
          immediate_action: direkt.trim() || null,
          occurred_at: tidpunkt,
          reported_by_id: user?.id || null,
          reported_by_name: rapportor,
          technician_id: forsta.id,
          technician_name: forsta.name,
          case_id: arende?.id || null,
          case_type: arende?.typ || null,
        })
        .select('id')
        .single()
      if (error) throw error

      if (ny?.id) {
        const { error: empErr } = await supabase.from('incident_employees').insert(
          berorda.map(e => ({ incident_id: ny.id, technician_id: e.id, technician_name: e.name })),
        )
        if (empErr) console.error('Kunde inte spara berörda:', empErr)

        // Bilderna före notisen, så att mottagarna ser dem när de öppnar rapporten
        if (bilder.length > 0) {
          const fel = await laddaUppBilder(ny.id, bilder)
          if (fel > 0) toast.error(`${fel === bilder.length ? 'Bilderna' : `${fel} av ${bilder.length} bilder`} gick inte att ladda upp. Lägg till dem i rapporten under Mina rapporter.`)
        }

        // Notis och mejl till mottagarna av typen. Får inte stoppa rapporten.
        apiFetch('/api/notify-incident', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident_id: ny.id }),
        }).catch(err => console.error('Kunde inte meddela mottagarna:', err))
      }

      toast.success(rapporteradText(typ))
      setSkickad(typ)
      tomt()
      onSkickad()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Kunde inte spara rapporten:', err)
      toast.error('Kunde inte spara. Det du skrivit ligger kvar.')
    } finally {
      setSkickar(false)
    }
  }

  // ─── Tack-läget efter skickad rapport ───
  if (skickad) {
    return (
      <section aria-live="polite" className="rounded-2xl border border-[#20c58f]/40 bg-slate-900 p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-full bg-[#20c58f]/15 text-[#20c58f] flex items-center justify-center">
            <Icon name="allman.bock" size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{rapporteradText(skickad)}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-300">
              Tack. De som tar emot {skickad === 'olycka' ? 'olyckor' : skickad === 'tillbud' ? 'tillbud' : 'avvikelser'} har fått en notis och ett mejl.
              Rapporten ligger under Mina rapporter med status Ny, och där ser du när den utreds och avslutas.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={onVisaMina} className={KNAPP_PRIMAR}>
            <Icon name="allman.lista" size={20} />
            Se mina rapporter
          </button>
          <button type="button" onClick={() => { setSkickad(null); setTimeout(() => beskrivningRef.current?.focus(), 50) }} className={KNAPP_SEKUNDAR}>
            <Icon name="allman.plus" size={20} />
            Rapportera en till
          </button>
        </div>
      </section>
    )
  }

  const arendeRad = (a: KoppladArende, onKlick: () => void) => (
    <li key={`${a.typ}:${a.id}`}>
      <button
        type="button"
        onClick={onKlick}
        className="w-full min-h-[56px] flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-left hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      >
        <Icon name={ARENDE_IKON[a.typ]} size={20} className="text-slate-400 flex-shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-white truncate">
            {a.kund}{a.nummer && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{a.nummer}</span>}
          </span>
          <span className="block text-sm text-slate-400 truncate">{[ARENDE_TYP_TEXT[a.typ], a.rad].filter(Boolean).join(', ')}</span>
        </span>
        <Icon name="allman.plus" size={20} className="text-slate-400 flex-shrink-0" />
      </button>
    </li>
  )

  return (
    <form
      onSubmit={e => { e.preventDefault(); skicka() }}
      className="rounded-2xl border border-slate-700 bg-slate-900 flex flex-col"
      aria-labelledby="tillbud-form-rubrik"
    >
      <header className="px-5 pt-4 pb-3 border-b border-slate-700/60">
        <h2 id="tillbud-form-rubrik" className="text-lg font-semibold text-white">Rapportera en händelse</h2>
        <p className="text-sm text-slate-400">Stort som smått. Rapportera hellre en gång för mycket. Syftet är aldrig att peka ut någon.</p>
      </header>

      <div className="px-5 py-5 flex flex-col gap-7">
        {/* 1. Vad hände? */}
        <section className="flex flex-col gap-3">
          <StegRubrik nr={1}>Vad hände?</StegRubrik>
          <div data-genomgang="tillbud-typ" role="radiogroup" aria-label="Typ av händelse" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ALL_INCIDENT_TYPES.map(t => {
              const c = INCIDENT_TYPE_CONFIG[t]
              const vald = typ === t
              const ton = TYP_TON[t]
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={vald}
                  onClick={() => setTyp(t)}
                  className={`w-full min-h-[72px] flex sm:flex-col items-start gap-3 sm:gap-1.5 p-3 rounded-xl border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                    vald ? TON_RAM[ton] : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  <span className={`flex items-center gap-2 flex-shrink-0 ${vald ? TON_TEXT[ton] : 'text-slate-300'}`}>
                    <Icon name={TYP_IKON[t]} size={24} />
                    <span className="sm:hidden text-[17px] font-extrabold leading-none w-9">{c.exclamation}</span>
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-semibold ${vald ? TON_TEXT[ton] : 'text-white'}`}>
                      <span className="hidden sm:inline font-extrabold mr-1.5">{c.exclamation}</span>{c.label}
                    </span>
                    <span className="block text-sm leading-snug text-slate-400">{c.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {typ === 'olycka' && (
            <div role="note" className="flex items-start gap-3 p-3 rounded-xl border border-red-500/40 bg-red-500/10">
              <Icon name="tillbud.myndighet" size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed text-slate-200">
                Vid allvarlig skada: ring 112 först. Vid allvarlig olycka eller allvarligt tillbud ska arbetsgivaren utan dröjsmål anmäla till Arbetsmiljöverket på{' '}
                <a href="https://anmalarbetsskada.se" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-red-400 underline underline-offset-2">
                  anmalarbetsskada.se<Icon name="rapport.oppna" size={16} />
                </a>
              </p>
            </div>
          )}
        </section>

        {/* 2. Beskriv */}
        <section className="flex flex-col gap-4">
          <StegRubrik nr={2}>Beskriv</StegRubrik>
          <div>
            <label htmlFor="tillbud-vad" className={ETIKETT}>Vad har hänt? <span className="text-red-400" aria-hidden="true">*</span></label>
            <textarea
              id="tillbud-vad"
              ref={beskrivningRef}
              value={beskrivning}
              onChange={e => setBeskrivning(e.target.value)}
              rows={4}
              required
              placeholder="Vad hände, var och hur?"
              className={TEXTRUTA}
            />
          </div>
          <div>
            <label htmlFor="tillbud-direkt" className={ETIKETT}>Vad har ni redan gjort? <span className={VALFRITT}>(valfritt)</span></label>
            <textarea
              id="tillbud-direkt"
              value={direkt}
              onChange={e => setDirekt(e.target.value)}
              rows={2}
              placeholder="Till exempel sanerat platsen, uppsökt vårdcentral eller kontaktat kunden"
              className={TEXTRUTA}
            />
          </div>
          <div>
            <span className={ETIKETT}>Bilder <span className={VALFRITT}>(valfritt)</span></span>
            <BildValjare filer={bilder} onAndra={setBilder} disabled={skickar} />
          </div>
        </section>

        {/* 3. När och vem */}
        <section className="flex flex-col gap-4">
          <StegRubrik nr={3}>När och vem</StegRubrik>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tillbud-tid" className={ETIKETT}>När inträffade händelsen?</label>
              <input
                id="tillbud-tid"
                type="datetime-local"
                value={tid}
                max={nuLokalt()}
                onChange={e => setTid(e.target.value)}
                className={FALT}
              />
            </div>
            <div>
              <span className={ETIKETT}>Rapportör</span>
              <p className="min-h-[44px] flex items-center gap-2 px-3 rounded-xl border border-slate-700/60 bg-slate-800/40 text-[15px] text-slate-300">
                <Icon name="rapport.person" size={20} className="text-slate-500" />
                {rapportor}
              </p>
            </div>
          </div>

          <div>
            <span id="tillbud-berorda" className={ETIKETT}>Berörda anställda <span className="text-red-400" aria-hidden="true">*</span></span>
            {berorda.length > 0 && (
              <ul aria-labelledby="tillbud-berorda" className="flex flex-col gap-1 mb-2">
                {berorda.map(b => {
                  const last = !!minTeknikerId && b.id === minTeknikerId
                  return (
                    <li key={b.id} className="flex items-center gap-3 pl-3 pr-1 min-h-[48px] rounded-xl border border-slate-700 bg-slate-800/40">
                      <Icon name="rapport.person" size={20} className="text-slate-400 flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-[15px] text-white truncate">{b.name}{last && <span className="ml-2 text-sm text-slate-400">du</span>}</span>
                      {!last && (
                        <button type="button" onClick={() => setBerorda(p => p.filter(x => x.id !== b.id))} aria-label={`Ta bort ${b.name}`} className={IKONKNAPP}>
                          <Icon name="allman.stang" size={20} />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {ledigaAnstallda.length > 0 && (
              <label className="block">
                <span className="sr-only">Lägg till berörd</span>
                <select
                  value=""
                  onChange={e => {
                    const a = anstallda.find(x => x.id === e.target.value)
                    if (a) setBerorda(p => [...p, a])
                  }}
                  className={FALT}
                >
                  <option value="">{berorda.length === 0 ? 'Välj den det gäller' : 'Lägg till fler berörda'}</option>
                  {ledigaAnstallda.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
            {minTeknikerId && <p className="mt-1.5 text-sm text-slate-400">Du står med som berörd. Var fler med? Lägg till dem.</p>}
          </div>
        </section>

        {/* 4. Koppla till ärende */}
        <section className="flex flex-col gap-3">
          <StegRubrik nr={4}>Koppla till ärende <span className={`text-sm ${VALFRITT}`}>(valfritt)</span></StegRubrik>
          {arende ? (
            <div className="flex items-center gap-3 pl-3 pr-1 py-2 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/5">
              <Icon name={ARENDE_IKON[arende.typ]} size={20} className="text-slate-300 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-white truncate">
                  {arende.kund}{arende.nummer && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{arende.nummer}</span>}
                </span>
                <span className="block text-sm text-slate-400 truncate">{[ARENDE_TYP_TEXT[arende.typ], arende.rad].filter(Boolean).join(', ')}</span>
              </span>
              <button type="button" onClick={() => setArende(null)} aria-label="Ta bort kopplingen" className={IKONKNAPP}>
                <Icon name="allman.stang" size={20} />
              </button>
            </div>
          ) : (
            <>
              <label className="h-11 flex items-center gap-2 px-3 rounded-xl border border-slate-600 bg-slate-950 text-slate-400 focus-within:border-[#20c58f]">
                <Icon name="allman.sok" size={20} />
                <span className="sr-only">Sök ärende</span>
                <input
                  type="search"
                  value={arendeSok}
                  onChange={e => setArendeSok(e.target.value)}
                  placeholder={minTeknikerId && activeView === 'technician' ? 'Sök bland dina ärenden: kund, adress eller nummer' : 'Sök ärende: kund, adress eller nummer'}
                  className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-slate-500 focus:outline-none"
                />
                {soker && <Icon name="allman.laddar" size={20} className="animate-spin" />}
              </label>
              {arendeSok.trim().length >= 2 ? (
                traffar.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">{traffar.map(a => arendeRad(a, () => { setArende(a); setArendeSok('') }))}</ul>
                ) : !soker ? (
                  <p className="text-sm text-slate-400">Inga ärenden hittades. Kopplingen är valfri, du kan skicka utan den.</p>
                ) : null
              ) : forslag.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-slate-400">Dina besök i går och i dag:</p>
                  <ul className="flex flex-col gap-1.5">{forslag.map(a => arendeRad(a, () => setArende(a)))}</ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <footer className="px-5 py-4 border-t border-slate-700/60 flex flex-col gap-2">
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={tomt} disabled={skickar} className={KNAPP_SEKUNDAR}>
            Töm formuläret
          </button>
          <button data-genomgang="tillbud-skicka" type="submit" disabled={!kanSkicka} className={`${KNAPP_PRIMAR} sm:min-w-[180px]`}>
            {skickar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="rapport.skicka" size={20} />}
            Skicka rapport
          </button>
        </div>
        {saknas && <p className="text-sm text-slate-400 sm:text-right">{saknas}</p>}
      </footer>
    </form>
  )
}

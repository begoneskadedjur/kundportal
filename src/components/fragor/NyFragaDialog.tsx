// src/components/fragor/NyFragaDialog.tsx
// Ny fråga eller uppdrag: fyra steg (till vem, om vilket ärende, vad det gäller, bild
// eller fil). Tråden sparas som en rotkommentar i ärendets kommunikation med samma kod
// som panelen (skickaKommentar), så den syns i ärendet och i mottagarnas inkorg.
// Mottagare: en eller flera personer, en roll (admin, koordinator, tekniker) eller alla.
// Portas till #modal-root med pointerEvents auto, så den fungerar även ovanpå en Modal.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Icon } from '../icons/Icon'
import { skickaKommentar } from '../../hooks/useCaseComments'
import type { TrackedMention } from '../../hooks/useMentions'
import type { AuthorRole, CaseType } from '../../types/communication'
import type { InkorgArende } from '../../services/communicationService'
import { hamtaBesok, laggTillDagar, svenskDag } from '../../services/teknikerDagService'
import type { RpcCase } from '../shared/search/searchModel'
import { datumTid, fornamn, ROLL_ETIKETT, type Roll } from './fragorLogik'
import { useMig } from '../../hooks/useFragorOchUppdrag'
import { giltigaFiler, TILLATNA_TYPER } from './filer'
import { IKONKNAPP, Initial, KNAPP_PRIMAR, KNAPP_SEKUNDAR } from './fragorUi'

interface Props {
  oppen: boolean
  onClose: () => void
  /** Anropas med rotkommentarens id när tråden skapats */
  onSkickad?: (rotId: string, caseId: string, caseType: CaseType) => void
  /** Extra förslag på ärenden, t.ex. ärenden ur inkorgen */
  forslag?: InkorgArende[]
}

interface Kollega {
  id: string
  namn: string
  roll: Roll
}

interface ValtArende {
  id: string
  typ: CaseType
  kund: string
  nummer: string | null
  rad: string
}

type MottagarTyp = 'personer' | 'roll' | 'alla'

const ROLL_TOKEN: Record<Roll, string> = { admin: '@admin', koordinator: '@koordinator', technician: '@tekniker' }

function listaText(delar: string[]): string {
  if (delar.length <= 1) return delar[0] || ''
  return `${delar.slice(0, -1).join(', ')} och ${delar[delar.length - 1]}`
}

export default function NyFragaDialog({ oppen, onClose, onSkickad, forslag = [] }: Props) {
  const { profile, activeView } = useAuth()
  const mig = useMig()
  const [typ, setTyp] = useState<MottagarTyp>('personer')
  const [kollegor, setKollegor] = useState<Kollega[]>([])
  const [valda, setValda] = useState<Kollega[]>([])
  const [roller, setRoller] = useState<Roll[]>([])
  const [personSok, setPersonSok] = useState('')
  const [arende, setArende] = useState<ValtArende | null>(null)
  const [arendeSok, setArendeSok] = useState('')
  const [traffar, setTraffar] = useState<ValtArende[]>([])
  const [soker, setSoker] = useState(false)
  const [dagens, setDagens] = useState<ValtArende[]>([])
  const [text, setText] = useState('')
  const [filer, setFiler] = useState<File[]>([])
  const [skickar, setSkickar] = useState(false)
  const forstaRef = useRef<HTMLButtonElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const filRef = useRef<HTMLInputElement>(null)

  // Återställ när dialogen öppnas. onClose läses via ref, så att en ny funktion från
  // föräldern inte nollställer det man skrivit.
  const stangRef = useRef(onClose)
  stangRef.current = onClose
  useEffect(() => {
    if (!oppen) return
    setTyp('personer'); setValda([]); setRoller([]); setPersonSok('')
    setArende(null); setArendeSok(''); setTraffar([]); setText(''); setFiler([])
    setTimeout(() => forstaRef.current?.focus(), 50)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') stangRef.current() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [oppen])

  // Kollegor: aktiva interna konton
  useEffect(() => {
    if (!oppen || !mig) return
    let avbruten = false
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, role, technicians(name)')
        .eq('is_active', true)
        .in('role', ['admin', 'koordinator', 'technician'])
        .neq('id', mig.id)
      if (avbruten) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista: Kollega[] = ((data as any[]) || []).map(p => {
        const tek = Array.isArray(p.technicians) ? p.technicians[0] : p.technicians
        return { id: p.id, namn: p.display_name || tek?.name || '', roll: p.role as Roll }
      }).filter(k => k.namn)
      lista.sort((a, b) => a.namn.localeCompare(b.namn, 'sv'))
      setKollegor(lista)
    })()
    return () => { avbruten = true }
  }, [oppen, mig])

  // Förslag: mina ärenden i dag och i morgon (tekniker), plus ärenden ur inkorgen
  const techId = profile?.technician_id
  useEffect(() => {
    if (!oppen) return
    if (!techId) { setDagens([]); return }
    let avbruten = false
    const idag = svenskDag()
    hamtaBesok(techId, idag, laggTillDagar(idag, 1))
      .then(lista => {
        if (avbruten) return
        setDagens(lista.slice(0, 8).map(b => ({
          id: b.id,
          typ: b.kalla === 'cases' ? 'contract' : b.kalla,
          kund: b.kund,
          nummer: b.arendenummer,
          rad: [b.start ? datumTid(b.start.toISOString()) : null, b.skadedjur, b.adress].filter(Boolean).join(', '),
        })))
      })
      .catch(() => { if (!avbruten) setDagens([]) })
    return () => { avbruten = true }
  }, [oppen, techId])

  const forslagLista: ValtArende[] = useMemo(() => {
    const ut = [...dagens]
    for (const a of forslag) {
      if (ut.some(x => x.id === a.id)) continue
      ut.push({ id: a.id, typ: a.typ, kund: a.kund, nummer: a.nummer, rad: [a.skadedjur, a.adress].filter(Boolean).join(', ') })
      if (ut.length >= 8) break
    }
    return ut
  }, [dagens, forslag])

  // Sök ärende: samma RPC som söklådan, rollen avgör vad som syns
  useEffect(() => {
    const q = arendeSok.trim()
    if (!oppen || q.length < 2) { setTraffar([]); setSoker(false); return }
    let avbruten = false
    setSoker(true)
    const portal = activeView === 'säljare' ? 'technician' : activeView
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('global_search', {
          p_query: q, p_portal: portal, p_include_archived: false, p_limit: 8,
        })
        if (error) throw error
        if (avbruten) return
        const cases = ((data as { cases?: RpcCase[] } | null)?.cases || [])
        setTraffar(cases.map(c => ({
          id: c.id,
          typ: c.case_type,
          kund: c.customer_name || c.title || 'Ärende',
          nummer: c.number,
          rad: [c.date ? datumTid(c.date).slice(0, 10) : null, c.pest, c.address].filter(Boolean).join(', '),
        })))
      } catch (e) {
        console.error('[NyFragaDialog] sök', e)
        if (!avbruten) setTraffar([])
      } finally {
        if (!avbruten) setSoker(false)
      }
    }, 250)
    return () => { avbruten = true; clearTimeout(t) }
  }, [arendeSok, oppen, activeView])

  const kollegaTraffar = useMemo(() => {
    const q = personSok.trim().toLowerCase()
    return kollegor
      .filter(k => !valda.some(v => v.id === k.id))
      .filter(k => !q || k.namn.toLowerCase().includes(q))
      .slice(0, q ? 8 : 6)
  }, [kollegor, valda, personSok])

  const antalPerRoll = useMemo(() => {
    const m: Record<Roll, number> = { admin: 0, koordinator: 0, technician: 0 }
    for (const k of kollegor) if (m[k.roll] !== undefined) m[k.roll]++
    return m
  }, [kollegor])

  const mottagare: string[] =
    typ === 'alla' ? ['alla']
      : typ === 'roll' ? roller.map(r => (r === 'technician' ? 'alla tekniker' : r === 'koordinator' ? 'koordinatorerna' : 'admin'))
      : valda.map(v => fornamn(v.namn))
  const harMottagare = mottagare.length > 0
  const kanSkicka = harMottagare && !!arende && text.trim().length > 0 && !skickar

  const skicka = async () => {
    if (!kanSkicka || !mig || !arende || !profile) return
    setSkickar(true)
    try {
      const namningar: TrackedMention[] = []
      const tokens: string[] = []
      if (typ === 'alla') {
        namningar.push({ type: 'all', userId: '', displayName: '@alla' })
        tokens.push('@alla')
      } else if (typ === 'roll') {
        for (const r of roller) {
          namningar.push({ type: 'role', userId: '', role: r, displayName: ROLL_TOKEN[r] })
          tokens.push(ROLL_TOKEN[r])
        }
      } else {
        for (const v of valda) {
          namningar.push({ type: 'user', userId: v.id, displayName: v.namn })
          tokens.push(`@${v.namn}`)
        }
      }
      const kommentar = await skickaKommentar({
        userId: mig.id,
        role: (profile.role as AuthorRole) || 'technician',
        caseId: arende.id,
        caseType: arende.typ,
        caseTitle: arende.kund,
        content: `${tokens.join(' ')} ${text.trim()}`,
        attachments: filer,
        mentions: namningar,
        parentCommentId: null,
      })
      toast.success(`Skickat till ${listaText(mottagare)}`)
      onSkickad?.(kommentar.id, arende.id, arende.typ)
      onClose()
    } catch (e) {
      console.error('[NyFragaDialog] skicka', e)
      toast.error('Kunde inte skicka. Försök igen.')
    } finally {
      setSkickar(false)
    }
  }

  if (!oppen) return null

  const valKort = (aktiv: boolean) =>
    `w-full min-h-[64px] flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
      aktiv ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
    }`

  const stegRubrik = (n: number, t: string) => (
    <h3 className="flex items-center gap-2 text-base font-semibold text-white">
      <span aria-hidden="true" className="w-7 h-7 rounded-full border border-slate-600 text-sm font-semibold text-slate-300 flex items-center justify-center font-mono">{n}</span>
      {t}
    </h3>
  )

  const arendeRad = (a: ValtArende, onKlick: () => void) => (
    <li key={`${a.typ}:${a.id}`}>
      <button type="button" onClick={onKlick} className={valKort(false)}>
        <Icon name={a.typ === 'contract' ? 'kund.avtal' : a.typ === 'business' ? 'allman.foretag' : 'arende.privat'} size={20} className="text-slate-400 flex-shrink-0" />
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-white truncate">
            {a.kund}{a.nummer && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{a.nummer}</span>}
          </span>
          {a.rad && <span className="block text-sm text-slate-400 truncate">{a.rad}</span>}
        </span>
      </button>
    </li>
  )

  const innehall = (
    <div className="fixed inset-0 z-[120] flex items-end lg:items-center justify-center" style={{ pointerEvents: 'auto' }}>
      <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ny-fraga-rubrik"
        className="relative w-full lg:max-w-2xl max-h-[94vh] flex flex-col bg-slate-900 border-t lg:border border-slate-700 rounded-t-3xl lg:rounded-2xl shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-700/60">
          <div>
            <h2 id="ny-fraga-rubrik" className="text-lg font-semibold text-white">Ny fråga eller uppdrag</h2>
            <p className="text-sm text-slate-400">Den du skickar till får en notis och ser tråden under Väntar på dig.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Stäng" className={IKONKNAPP}>
            <Icon name="allman.stang" size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {/* 1. Till vem */}
          <section className="flex flex-col gap-3">
            {stegRubrik(1, 'Till vem?')}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Mottagare">
              <button ref={forstaRef} type="button" role="radio" aria-checked={typ === 'personer'} onClick={() => setTyp('personer')} className={valKort(typ === 'personer')}>
                <Icon name="rapport.person" size={20} className="text-slate-300 flex-shrink-0" />
                <span><span className="block text-[15px] font-semibold text-white">En kollega</span><span className="block text-sm text-slate-400">En eller flera personer</span></span>
              </button>
              <button type="button" role="radio" aria-checked={typ === 'roll'} onClick={() => setTyp('roll')} className={valKort(typ === 'roll')}>
                <Icon name="dok.omnamnd" size={20} className="text-slate-300 flex-shrink-0" />
                <span><span className="block text-[15px] font-semibold text-white">En roll</span><span className="block text-sm text-slate-400">Admin, koordinator eller tekniker</span></span>
              </button>
              <button type="button" role="radio" aria-checked={typ === 'alla'} onClick={() => setTyp('alla')} className={valKort(typ === 'alla')}>
                <Icon name="allman.foretag" size={20} className="text-slate-300 flex-shrink-0" />
                <span><span className="block text-[15px] font-semibold text-white">Alla</span><span className="block text-sm text-slate-400">För kännedom, {kollegor.length} personer</span></span>
              </button>
            </div>

            {typ === 'personer' && (
              <div className="flex flex-col gap-2">
                {valda.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {valda.map(v => (
                      <li key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/5">
                        <Initial namn={v.namn} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-medium text-white truncate">{v.namn}</span>
                          <span className="block text-sm text-slate-400">{ROLL_ETIKETT[v.roll]}</span>
                        </span>
                        <button type="button" className={IKONKNAPP} aria-label={`Ta bort ${v.namn}`} onClick={() => setValda(p => p.filter(x => x.id !== v.id))}>
                          <Icon name="allman.stang" size={20} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="h-11 flex items-center gap-2 px-3 rounded-xl border border-slate-600 bg-slate-950 text-slate-400 focus-within:border-[#20c58f]">
                  <Icon name="allman.sok" size={20} />
                  <span className="sr-only">Sök kollega</span>
                  <input
                    type="search"
                    value={personSok}
                    onChange={e => setPersonSok(e.target.value)}
                    placeholder="Sök kollega"
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-slate-500 focus:outline-none"
                  />
                </label>
                <ul className="flex flex-col gap-1">
                  {kollegaTraffar.map(k => (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={() => { setValda(p => [...p, k]); setPersonSok('') }}
                        className="w-full min-h-[48px] flex items-center gap-3 px-3 py-1.5 rounded-xl text-left hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                      >
                        <Initial namn={k.namn} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] text-white truncate">{k.namn}</span>
                          <span className="block text-sm text-slate-400">{ROLL_ETIKETT[k.roll]}</span>
                        </span>
                        <Icon name="allman.plus" size={20} className="text-slate-400" />
                      </button>
                    </li>
                  ))}
                  {kollegaTraffar.length === 0 && personSok && (
                    <li className="px-3 py-2 text-sm text-slate-400">Ingen kollega heter så.</li>
                  )}
                </ul>
              </div>
            )}

            {typ === 'roll' && (
              <ul className="flex flex-col gap-1" aria-label="Roller">
                {(['admin', 'koordinator', 'technician'] as Roll[]).map(r => {
                  const vald = roller.includes(r)
                  return (
                    <li key={r}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={vald}
                        onClick={() => setRoller(p => (vald ? p.filter(x => x !== r) : [...p, r]))}
                        className={valKort(vald)}
                      >
                        <span aria-hidden="true" className={`w-6 h-6 flex-shrink-0 rounded-md border flex items-center justify-center ${vald ? 'border-[#20c58f] bg-[#20c58f] text-[#04281c]' : 'border-slate-500'}`}>
                          {vald && <Icon name="allman.bock" size={16} />}
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-white">{ROLL_ETIKETT[r]}</span>
                          <span className="block text-sm text-slate-400">{antalPerRoll[r]} personer</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* 2. Ärende */}
          <section className="flex flex-col gap-3">
            {stegRubrik(2, 'Om vilket ärende?')}
            <p className="text-sm text-slate-400">Tråden sparas i ärendet, så den som öppnar ärendet ser den också. Kunden ser den aldrig.</p>
            {arende ? (
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/5">
                <Icon name={arende.typ === 'contract' ? 'kund.avtal' : arende.typ === 'business' ? 'allman.foretag' : 'arende.privat'} size={20} className="text-slate-300 flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-white truncate">
                    {arende.kund}{arende.nummer && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{arende.nummer}</span>}
                  </span>
                  {arende.rad && <span className="block text-sm text-slate-400 truncate">{arende.rad}</span>}
                </span>
                <button type="button" className={KNAPP_SEKUNDAR} onClick={() => setArende(null)}>Byt ärende</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="h-11 flex items-center gap-2 px-3 rounded-xl border border-slate-600 bg-slate-950 text-slate-400 focus-within:border-[#20c58f]">
                  <Icon name="allman.sok" size={20} />
                  <span className="sr-only">Sök ärende</span>
                  <input
                    type="search"
                    value={arendeSok}
                    onChange={e => setArendeSok(e.target.value)}
                    placeholder="Sök på ärendenummer, kund eller adress"
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-slate-500 focus:outline-none"
                  />
                  {soker && <Icon name="allman.laddar" size={16} className="animate-spin" />}
                </label>
                {arendeSok.trim().length >= 2 ? (
                  <ul className="flex flex-col gap-1">
                    {traffar.map(a => arendeRad(a, () => setArende(a)))}
                    {!soker && traffar.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Inga ärenden hittades.</li>}
                  </ul>
                ) : forslagLista.length > 0 ? (
                  <>
                    <p className="text-sm text-slate-400">{techId ? 'Förslag: dina ärenden i dag och i morgon.' : 'Förslag: ärenden du nyligen skrivit om.'} Sök för andra.</p>
                    <ul className="flex flex-col gap-1">{forslagLista.map(a => arendeRad(a, () => setArende(a)))}</ul>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Sök på kund, adress eller ärendenummer.</p>
                )}
              </div>
            )}
          </section>

          {/* 3. Text */}
          <section className="flex flex-col gap-2">
            {stegRubrik(3, 'Vad gäller det?')}
            <label htmlFor="ny-fraga-text" className="text-sm font-medium text-slate-300">Meddelande</label>
            <textarea
              id="ny-fraga-text"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              className="w-full px-3 py-3 rounded-xl border border-slate-600 bg-slate-950 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f]"
            />
            <p className="text-sm text-slate-400">Skriv som om du ringde: vad behöver du, och till när.</p>
          </section>

          {/* 4. Bild eller fil */}
          <section className="flex flex-col gap-2">
            {stegRubrik(4, 'Bild eller fil')}
            <p className="text-sm text-slate-400">Valfritt. Bilder och PDF upp till 5 MB.</p>
            <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { setFiler(p => [...p, ...giltigaFiler(e.target.files)]); e.target.value = '' }} />
            <input ref={filRef} type="file" accept={TILLATNA_TYPER.join(',')} multiple className="hidden" onChange={e => { setFiler(p => [...p, ...giltigaFiler(e.target.files)]); e.target.value = '' }} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={KNAPP_SEKUNDAR} onClick={() => kameraRef.current?.click()}>
                <Icon name="allman.foto" size={20} />
                Ta bild
              </button>
              <button type="button" className={KNAPP_SEKUNDAR} onClick={() => filRef.current?.click()}>
                <Icon name="rapport.gem" size={20} />
                Välj fil
              </button>
            </div>
            {filer.length > 0 && (
              <ul className="flex flex-col gap-1">
                {filer.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-slate-300">
                    <Icon name={f.type.startsWith('image/') ? 'allman.foto' : 'rapport.gem'} size={16} className="text-slate-400" />
                    <span className="truncate flex-1">{f.name}</span>
                    <button type="button" className={IKONKNAPP} aria-label={`Ta bort ${f.name}`} onClick={() => setFiler(p => p.filter((_, j) => j !== i))}>
                      <Icon name="allman.stang" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 px-5 py-4 border-t border-slate-700/60 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-sm text-slate-400 sm:flex-1">
            {harMottagare
              ? `${listaText(mottagare).charAt(0).toUpperCase()}${listaText(mottagare).slice(1)} får en notis direkt.`
              : 'Välj vem som ska få frågan.'}
          </p>
          <div className="flex gap-2">
            <button type="button" className={`${KNAPP_SEKUNDAR} flex-1 sm:flex-none`} onClick={onClose}>Avbryt</button>
            <button type="button" className={`${KNAPP_PRIMAR} flex-1 sm:flex-none`} onClick={skicka} disabled={!kanSkicka}>
              <Icon name={skickar ? 'allman.laddar' : 'rapport.skicka'} size={20} className={skickar ? 'animate-spin' : ''} />
              {harMottagare ? `Skicka till ${listaText(mottagare)}` : 'Skicka'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )

  return createPortal(innehall, document.getElementById('modal-root') ?? document.body)
}

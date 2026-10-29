// FranvaroModal.tsx — Skapa, ändra och ta bort frånvaro i koordinatorschemat (3.108.0)
// Ersätter CreateAbsenceModal och AbsenceDetailsModal. Frånvaro för flera
// tekniker sparas som en rad per tekniker med samma group_id och hanteras här
// som en händelse. Bekräftelsen för Ta bort ligger i modalen.

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../../icons/Icon'
import Portal from '../../ui/Portal'
import type { Technician } from '../../../types/database'
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'
import { FRANVARO_TYPER, FRANVARO_GRUPP_TEXT, franvaroTyp, alfa, type FranvaroGrupp } from '../../../utils/franvaroTyper'
import type { Absence } from './AbsenceBlock'

/** Det modalen behöver av ett ärende för krockvarningen */
export interface KrockArende {
  id: string
  title?: string | null
  start_date?: string | null
  due_date?: string | null
  primary_assignee_id?: string | null
  secondary_assignee_id?: string | null
  tertiary_assignee_id?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  technicians: Technician[]
  /** All frånvaro i schemat, för gruppens rader och krockar */
  absences: Absence[]
  /** Bokade ärenden, för krockvarningen */
  cases: KrockArende[]
  /** Öppnad frånvaro. null = ny */
  absence: Absence | null
  /** Datum för ny frånvaro, normalt schemats valda dag */
  defaultDate?: Date
}

const pad = (n: number) => String(n).padStart(2, '0')
const datumStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const tidStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
/** Svensk väggtid i webbläsaren */
const lokal = (datum: string, tid: string) => new Date(`${datum}T${tid}:00`)
const laggTillDag = (datum: string, n: number) => { const d = lokal(datum, '12:00'); d.setDate(d.getDate() + n); return datumStr(d) }

const DAG_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }

const INPUT = 'w-full h-10 px-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f]'
const SEKTION = 'bg-slate-800/30 border border-slate-700 rounded-xl p-3'
const ETIKETT = 'text-xs font-medium text-slate-400 uppercase tracking-wide'
const KNAPP = 'h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] disabled:opacity-50 disabled:cursor-not-allowed'
const PRIMAR = `${KNAPP} bg-[#20c58f] text-[#04281c] hover:bg-[#1bb07f]`
const SEKUNDAR = `${KNAPP} border border-slate-600 bg-slate-900 text-white hover:bg-slate-800`
const FARA = `${KNAPP} text-red-400 hover:bg-red-500/10`

export default function FranvaroModal({ isOpen, onClose, onSaved, technicians, absences, cases, absence, defaultDate }: Props) {
  // Gruppens rader (eller bara den öppnade)
  const medlemmar = useMemo<Absence[]>(() => {
    if (!absence) return []
    if (!absence.group_id) return [absence]
    const rader = absences.filter(a => a.group_id === absence.group_id)
    return rader.length > 0 ? rader : [absence]
  }, [absence, absences])
  const arNy = !absence
  const arGrupp = medlemmar.length > 1

  const [typ, setTyp] = useState('Möte')
  const [rubrik, setRubrik] = useState('')
  const [anteckning, setAnteckning] = useState('')
  const [heldag, setHeldag] = useState(false)
  const [startDatum, setStartDatum] = useState('')
  const [slutDatum, setSlutDatum] = useState('')
  const [annanSlutdag, setAnnanSlutdag] = useState(false)
  const [fran, setFran] = useState('08:00')
  const [till, setTill] = useState('09:00')
  const [valda, setValda] = useState<Set<string>>(new Set())
  const [sparar, setSparar] = useState(false)
  const [bekraftaBort, setBekraftaBort] = useState(false)
  const [visaTyper, setVisaTyper] = useState(false)
  const stangRef = useRef<HTMLButtonElement>(null)

  // Fyll formuläret när modalen öppnas
  useEffect(() => {
    if (!isOpen) return
    setBekraftaBort(false)
    setSparar(false)
    if (!absence) {
      const d = datumStr(defaultDate ?? new Date())
      setTyp('Möte'); setRubrik(''); setAnteckning('')
      setHeldag(false); setStartDatum(d); setSlutDatum(d); setAnnanSlutdag(false)
      setFran('08:00'); setTill('09:00'); setValda(new Set()); setVisaTyper(true)
      return
    }
    const s = new Date(absence.start_date)
    const e = new Date(absence.end_date)
    const helStart = tidStr(s) === '00:00'
    const helSlut = tidStr(e) === '23:59' || (tidStr(e) === '00:00' && e > s)
    const hel = helStart && helSlut
    const slutDag = hel && tidStr(e) === '00:00' ? laggTillDag(datumStr(e), -1) : datumStr(e)
    setTyp(absence.reason || 'Övrigt')
    setRubrik(absence.title ?? '')
    setAnteckning(absence.notes ?? '')
    setHeldag(hel)
    setStartDatum(datumStr(s))
    setSlutDatum(slutDag)
    setAnnanSlutdag(!hel && slutDag !== datumStr(s))
    setFran(hel ? '08:00' : tidStr(s))
    setTill(hel ? '17:00' : tidStr(e))
    setValda(new Set(medlemmar.map(m => m.technician_id)))
    setVisaTyper(false)
    // medlemmar följer absence; ingen ny ifyllning när listan laddas om
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, absence?.id])

  useEffect(() => {
    if (!isOpen) return
    stangRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sparar) onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [isOpen, onClose, sparar])

  // Tidsintervallet som formuläret beskriver
  const intervall = useMemo(() => {
    if (!startDatum) return null
    const slutDag = heldag || annanSlutdag ? (slutDatum || startDatum) : startDatum
    const start = lokal(startDatum, heldag ? '00:00' : fran)
    const slut = lokal(slutDag, heldag ? '23:59' : till)
    if (isNaN(start.getTime()) || isNaN(slut.getTime())) return null
    return { start, slut }
  }, [startDatum, slutDatum, heldag, annanSlutdag, fran, till])

  const egnaIds = useMemo(() => new Set(medlemmar.map(m => m.id)), [medlemmar])

  // Krockar per tekniker: bokade ärenden och annan frånvaro i intervallet
  const krockar = useMemo(() => {
    const map = new Map<string, string>()
    if (!intervall) return map
    const s = intervall.start.getTime()
    const e = intervall.slut.getTime()
    for (const t of technicians) {
      const arenden = cases.filter(c => {
        if (c.primary_assignee_id !== t.id && c.secondary_assignee_id !== t.id && c.tertiary_assignee_id !== t.id) return false
        const cs = new Date(c.start_date || c.due_date || '').getTime()
        const ce = new Date(c.due_date || c.start_date || '').getTime()
        return !isNaN(cs) && cs < e && ce > s
      })
      if (arenden.length > 0) {
        const forsta = new Date(arenden[0].start_date || arenden[0].due_date || '')
        map.set(t.id, arenden.length === 1 ? `Ärende ${tidStr(forsta)}` : `${arenden.length} ärenden`)
        continue
      }
      const annan = absences.find(a => a.technician_id === t.id && !egnaIds.has(a.id)
        && new Date(a.start_date).getTime() < e && new Date(a.end_date).getTime() > s)
      if (annan) map.set(t.id, franvaroTyp(annan.reason).kort)
    }
    return map
  }, [intervall, technicians, cases, absences, egnaIds])

  if (!isOpen) return null

  const vald = franvaroTyp(typ)
  const antal = valda.size
  const tekNamn = (id: string) => technicians.find(t => t.id === id)?.name ?? 'Okänd tekniker'
  // Tekniker som inte längre är aktiva men ligger i gruppen ska också synas
  const listade: { id: string; name: string }[] = [
    ...technicians.map(t => ({ id: t.id, name: t.name })),
    ...medlemmar.filter(m => !technicians.some(t => t.id === m.technician_id)).map(m => ({ id: m.technician_id, name: 'Inaktiv tekniker' })),
  ]

  const vaxla = (id: string) => setValda(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const underrubrik = (() => {
    if (arNy) return `${vald.kort}, ${FRANVARO_GRUPP_TEXT[vald.grupp].toLowerCase()}`
    if (!intervall) return vald.kort
    const s = intervall.start, e = intervall.slut
    const dag = s.toLocaleDateString('sv-SE', DAG_FORMAT)
    const vem = arGrupp ? `${medlemmar.length} tekniker` : tekNamn(medlemmar[0].technician_id)
    if (heldag) {
      return datumStr(s) === datumStr(e) ? `${vem} · ${dag}, hela dagen` : `${vem} · ${datumStr(s)} till ${datumStr(e)}`
    }
    if (datumStr(s) !== datumStr(e)) return `${vem} · ${datumStr(s)} ${tidStr(s)} till ${datumStr(e)} ${tidStr(e)}`
    return `${vem} · ${dag}, ${tidStr(s)} till ${tidStr(e)}`
  })()

  async function spara() {
    if (!intervall) { toast.error('Välj datum'); return }
    if (intervall.slut <= intervall.start) { toast.error('Sluttiden måste vara efter starttiden'); return }
    if (antal === 0) { toast.error(arNy ? 'Välj minst en tekniker' : 'Välj minst en tekniker, eller ta bort frånvaron'); return }

    const falt = {
      start_date: toLocalISOStringWithOffset(intervall.start),
      end_date: toLocalISOStringWithOffset(intervall.slut),
      reason: typ,
      title: rubrik.trim() || null,
      notes: anteckning.trim() || null,
    }
    setSparar(true)
    try {
      const fanns = new Set(medlemmar.map(m => m.technician_id))
      const behall = medlemmar.filter(m => valda.has(m.technician_id))
      const tasBort = medlemmar.filter(m => !valda.has(m.technician_id))
      const nya = [...valda].filter(id => !fanns.has(id))
      const groupId = antal > 1 ? (absence?.group_id ?? crypto.randomUUID()) : null

      if (tasBort.length > 0) {
        const { error } = await supabase.from('technician_absences').delete().in('id', tasBort.map(m => m.id))
        if (error) throw error
      }
      if (behall.length > 0) {
        const { error } = await supabase.from('technician_absences').update({ ...falt, group_id: groupId }).in('id', behall.map(m => m.id))
        if (error) throw error
      }
      if (nya.length > 0) {
        const { error } = await supabase.from('technician_absences').insert(nya.map(id => ({ ...falt, technician_id: id, group_id: groupId })))
        if (error) throw error
      }

      toast.success(arNy
        ? (antal === 1 ? `${vald.kort} inlagd` : `${vald.kort} inlagd för ${antal} tekniker`)
        : 'Ändringen är sparad')
      onSaved()
      onClose()
    } catch (err) {
      console.error('Kunde inte spara frånvaron:', err)
      toast.error('Kunde inte spara frånvaron. Försök igen.')
      setSparar(false)
    }
  }

  async function taBort() {
    setSparar(true)
    try {
      const { error } = await supabase.from('technician_absences').delete().in('id', medlemmar.map(m => m.id))
      if (error) throw error
      toast.success(arGrupp ? `${franvaroRubrikText()} borttagen för ${medlemmar.length} tekniker` : `${franvaroRubrikText()} borttagen`)
      onSaved()
      onClose()
    } catch (err) {
      console.error('Kunde inte ta bort frånvaron:', err)
      toast.error('Kunde inte ta bort frånvaron. Försök igen.')
      setSparar(false)
    }
  }

  function franvaroRubrikText() {
    return absence?.title?.trim() || franvaroTyp(absence?.reason).kort
  }

  const rubrikText = arNy ? 'Ny frånvaro' : (rubrik.trim() || vald.kort)
  const sparaText = arNy
    ? (antal > 1 ? `Lägg in för ${antal} tekniker` : 'Lägg in')
    : (antal > 1 ? `Spara för ${antal}` : 'Spara')

  const typRutor = (grupp: FranvaroGrupp) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
      {FRANVARO_TYPER.filter(t => t.grupp === grupp).map(t => {
        const aktiv = t.id === typ
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={aktiv}
            onClick={() => { setTyp(t.id); if (!arNy) setVisaTyper(false) }}
            title={t.beskrivning}
            className={`min-h-16 px-1 py-2 flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium text-center leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]
              ${aktiv ? 'border-[#20c58f] bg-[#20c58f]/10 text-white ring-1 ring-[#20c58f]' : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'}`}
          >
            <span style={{ color: t.farg }}><Icon name={t.ikon} size={20} /></span>
            {t.kort}
          </button>
        )
      })}
    </div>
  )

  return (
    <Portal>
      <div className="fixed inset-0 z-[120] pointer-events-auto flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" onClick={() => { if (!sparar) onClose() }} />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="franvaro-rubrik"
          className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl text-white"
        >
          <header className="flex items-start gap-3 px-4 pt-4 pb-3">
            <span
              className="w-11 h-11 flex-none flex items-center justify-center rounded-xl"
              style={{ color: vald.farg, backgroundColor: `${vald.farg}${alfa(0.15)}` }}
            >
              <Icon name={arGrupp && !arNy ? 'bokning.team' : vald.ikon} size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="franvaro-rubrik" className="text-lg font-semibold leading-tight truncate">{rubrikText}</h2>
              <p className="text-[13px] text-slate-400 mt-0.5">{underrubrik}</p>
            </div>
            <button
              ref={stangRef}
              type="button"
              onClick={onClose}
              disabled={sparar}
              aria-label="Stäng"
              className="w-11 h-11 -mr-1 -mt-1 flex-none flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <Icon name="allman.stang" size={20} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {/* Typ */}
            <div className={SEKTION}>
              <div className="flex items-center justify-between mb-2">
                <span className={ETIKETT}>Typ</span>
              </div>
              {visaTyper ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">{FRANVARO_GRUPP_TEXT.tjanst}</p>
                  {typRutor('tjanst')}
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide pt-1">{FRANVARO_GRUPP_TEXT.ledig}</p>
                  {typRutor('ledig')}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setVisaTyper(true)}
                  className="w-full h-10 px-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 text-sm hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                >
                  <span className="flex items-center gap-2">
                    <span style={{ color: vald.farg }}><Icon name={vald.ikon} size={20} /></span>
                    {vald.kort}
                    <span className="text-slate-500">· {FRANVARO_GRUPP_TEXT[vald.grupp].toLowerCase()}</span>
                  </span>
                  <span className="text-xs text-slate-400">Byt</span>
                </button>
              )}
            </div>

            {/* Rubrik */}
            <div className={SEKTION}>
              <label htmlFor="franvaro-rubrik-falt" className={`${ETIKETT} block mb-2`}>Rubrik i schemat</label>
              <input
                id="franvaro-rubrik-falt"
                value={rubrik}
                onChange={e => setRubrik(e.target.value)}
                placeholder={vald.kort}
                maxLength={60}
                className={`${INPUT} font-sans`}
              />
              <p className="text-xs text-slate-500 mt-1.5">Visas på blocket. Lämnas den tom står typen där.</p>
            </div>

            {/* När */}
            <div className={SEKTION}>
              <span className={`${ETIKETT} block mb-2`}>När</span>
              {heldag ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="franvaro-start" className="block text-xs font-medium text-slate-400 mb-1">Första dagen</label>
                    <input id="franvaro-start" type="date" value={startDatum} className={INPUT}
                      onChange={e => { setStartDatum(e.target.value); if (slutDatum < e.target.value) setSlutDatum(e.target.value) }} />
                  </div>
                  <div>
                    <label htmlFor="franvaro-slut" className="block text-xs font-medium text-slate-400 mb-1">Sista dagen</label>
                    <input id="franvaro-slut" type="date" value={slutDatum} min={startDatum} className={INPUT} onChange={e => setSlutDatum(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr] gap-2">
                    <div className="col-span-2 sm:col-span-1">
                      <label htmlFor="franvaro-start" className="block text-xs font-medium text-slate-400 mb-1">{annanSlutdag ? 'Startar' : 'Datum'}</label>
                      <input id="franvaro-start" type="date" value={startDatum} className={INPUT}
                        onChange={e => { setStartDatum(e.target.value); if (!annanSlutdag || slutDatum < e.target.value) setSlutDatum(e.target.value) }} />
                    </div>
                    <div>
                      <label htmlFor="franvaro-fran" className="block text-xs font-medium text-slate-400 mb-1">Från</label>
                      <input id="franvaro-fran" type="time" step={900} value={fran} className={INPUT} onChange={e => setFran(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="franvaro-till" className="block text-xs font-medium text-slate-400 mb-1">Till</label>
                      <input id="franvaro-till" type="time" step={900} value={till} className={INPUT} onChange={e => setTill(e.target.value)} />
                    </div>
                  </div>
                  {annanSlutdag ? (
                    <div className="grid grid-cols-2 sm:grid-cols-[1.4fr_2fr] gap-2 items-end">
                      <div className="col-span-2 sm:col-span-1">
                        <label htmlFor="franvaro-slut" className="block text-xs font-medium text-slate-400 mb-1">Slutar</label>
                        <input id="franvaro-slut" type="date" value={slutDatum} min={startDatum} className={INPUT} onChange={e => setSlutDatum(e.target.value)} />
                      </div>
                      <button type="button" onClick={() => { setAnnanSlutdag(false); setSlutDatum(startDatum) }} className="h-10 text-left text-[13px] font-semibold text-[#20c58f]">
                        Samma dag
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAnnanSlutdag(true)} className="text-[13px] font-semibold text-[#20c58f]">
                      Slutar en annan dag
                    </button>
                  )}
                </div>
              )}
              <label className="mt-3 flex items-center gap-3 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  role="switch"
                  checked={heldag}
                  onChange={e => { setHeldag(e.target.checked); if (e.target.checked && slutDatum < startDatum) setSlutDatum(startDatum) }}
                  className="peer sr-only"
                />
                <span aria-hidden="true" className="relative w-9 h-[22px] flex-none rounded-full bg-slate-700 peer-checked:bg-[#20c58f] peer-focus-visible:ring-2 peer-focus-visible:ring-[#20c58f] transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:left-[17px]" />
                Hela dagar
              </label>
            </div>

            {/* Tekniker */}
            <div className={SEKTION}>
              <div className="flex items-center justify-between mb-2">
                <span className={ETIKETT}>{arNy ? 'Tekniker' : 'Gäller'}</span>
                <button
                  type="button"
                  onClick={() => setValda(antal === listade.length ? new Set() : new Set(listade.map(t => t.id)))}
                  className="text-[13px] font-semibold text-[#20c58f] px-1 py-1"
                >
                  {antal === listade.length ? 'Rensa' : 'Välj alla'}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto -mx-1 space-y-0.5">
                {listade.map(t => {
                  const pa = valda.has(t.id)
                  const krock = pa ? krockar.get(t.id) : undefined
                  return (
                    <label key={t.id} className="flex items-center gap-3 min-h-10 px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-800/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#20c58f]">
                      <input type="checkbox" checked={pa} onChange={() => vaxla(t.id)} className="sr-only" />
                      <span aria-hidden="true" className={`w-5 h-5 flex-none flex items-center justify-center rounded-md border ${pa ? 'bg-[#20c58f] border-[#20c58f] text-[#04281c]' : 'border-slate-600 text-transparent'}`}>
                        <Icon name="allman.bock" size={16} strokeWidth={2.2} />
                      </span>
                      <span className="text-sm text-white truncate">{t.name}</span>
                      {krock && (
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{krock}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${antal > 0 ? 'bg-[#20c58f]' : 'bg-slate-500'}`} />
                {antal === 0 ? 'Ingen vald' : antal === 1 ? '1 vald' : `${antal} valda, blir ett gemensamt block`}
              </p>
              {!arNy && arGrupp && (
                <p className="text-xs text-slate-500 mt-1">Bocka ur en tekniker för att ta bort frånvaron bara för den personen.</p>
              )}
              {krockar.size > 0 && [...valda].some(id => krockar.has(id)) && (
                <p className="text-xs text-slate-500 mt-1">Krockar stoppar inte. Flytta ärendet om tiden ska gälla.</p>
              )}
            </div>

            {/* Anteckning */}
            <div className={SEKTION}>
              <label htmlFor="franvaro-anteckning" className={`${ETIKETT} block mb-2`}>Anteckning</label>
              <textarea
                id="franvaro-anteckning"
                value={anteckning}
                onChange={e => setAnteckning(e.target.value)}
                rows={2}
                placeholder="Frivilligt"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
            </div>
          </div>

          {bekraftaBort ? (
            <div className="border-t border-slate-700 bg-red-500/10 px-4 py-3 space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="text-sm">
                <strong>{arGrupp ? `Ta bort ${franvaroRubrikText().toLowerCase()} för alla ${medlemmar.length} tekniker?` : `Ta bort ${franvaroRubrikText().toLowerCase()}?`}</strong>
                <br />
                <span className="text-slate-300">Tiden blir bokningsbar igen.</span>
              </p>
              <div className="flex justify-end gap-2 flex-wrap">
                <button type="button" onClick={() => setBekraftaBort(false)} disabled={sparar} className={SEKUNDAR}>Avbryt</button>
                <button type="button" onClick={taBort} disabled={sparar} className={`${KNAPP} bg-red-600 text-white hover:bg-red-500`}>
                  <Icon name="allman.radera" size={20} />
                  {arGrupp ? 'Ta bort för alla' : 'Ta bort'}
                </button>
              </div>
            </div>
          ) : (
            <footer className="flex items-center gap-2 border-t border-slate-700/50 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              {!arNy && (
                <button type="button" onClick={() => setBekraftaBort(true)} disabled={sparar} className={FARA}>
                  <Icon name="allman.radera" size={20} />
                  Ta bort
                </button>
              )}
              <span className="flex-1" />
              <button type="button" onClick={onClose} disabled={sparar} className={`${SEKUNDAR} hidden sm:inline-flex`}>Avbryt</button>
              <button type="button" onClick={spara} disabled={sparar} className={`${PRIMAR} flex-1 sm:flex-none`}>
                <Icon name={sparar ? 'allman.laddar' : 'allman.bock'} size={20} className={sparar ? 'animate-spin' : undefined} />
                {sparaText}
              </button>
            </footer>
          )}
        </section>
      </div>
    </Portal>
  )
}

/** Frågan när ett gruppblock dras till en ny tid */
export function FranvaroFlyttaDialog({ fraga, onAlla, onBaraEn, onAvbryt, sparar }: {
  fraga: { rubrik: string; nyTid: string; antal: number; teknikerNamn: string } | null
  onAlla: () => void
  onBaraEn: () => void
  onAvbryt: () => void
  sparar: boolean
}) {
  const allaRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!fraga) return
    allaRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onAvbryt() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [fraga, onAvbryt])
  if (!fraga) return null
  return (
    <Portal>
      <div className="fixed inset-0 z-[120] pointer-events-auto flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/60" aria-hidden="true" onClick={onAvbryt} />
        <section role="dialog" aria-modal="true" aria-labelledby="flytta-rubrik" className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3 text-white">
          <div className="flex items-start gap-3">
            <span className="text-[#20c58f] mt-0.5"><Icon name="franvaro.flytta" size={24} /></span>
            <div>
              <h2 id="flytta-rubrik" className="text-base font-semibold">Flytta {fraga.rubrik.toLowerCase()} till {fraga.nyTid}?</h2>
              <p className="text-[13px] text-slate-400 mt-0.5">Gäller {fraga.antal} tekniker.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button ref={allaRef} type="button" onClick={onAlla} disabled={sparar} className={PRIMAR}>Flytta för alla {fraga.antal}</button>
            <button type="button" onClick={onBaraEn} disabled={sparar} className={SEKUNDAR}>Bara {fraga.teknikerNamn}</button>
            <button type="button" onClick={onAvbryt} disabled={sparar} className={`${KNAPP} text-slate-300 hover:bg-slate-800`}>Avbryt</button>
          </div>
        </section>
      </div>
    </Portal>
  )
}

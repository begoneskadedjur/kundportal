// src/components/shared/specialReports/MobileAddEventSheet.tsx
// Ny händelse i mobilen: välj del (förvald efter området telefonen står i,
// annars den senast använda), typ, datum, rubrik, beskrivning och foton.

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import { Icon } from '../../icons/Icon'
import { SpecialReportService } from '../../../services/specialReportService'
import { EVENT_TYPES, type SpecialReportEventType } from '../../../types/specialReport'
import type { FullSection } from './sectionOps'
import {
  EVENT_ICON,
  FALT,
  PRIMAR_KNAPP,
  TEXTFALT,
  fargForDel,
  idagISO,
  lasLokalt,
  punktIOmrade,
  skrivLokalt,
} from './specialReportUtils'

const TYPER = Object.keys(EVENT_TYPES) as SpecialReportEventType[]
const KORT: Partial<Record<SpecialReportEventType, string>> = { underlev: 'Underlev.' }

interface MobileAddEventSheetProps {
  isOpen: boolean
  onClose: () => void
  reportId: string
  reportTitle: string
  caseNumber: string | null
  sections: FullSection[]
  /** Föreslagen del om ingen position finns (t.ex. den som är öppen) */
  preferredSectionId?: string | null
  onSaved: () => void
}

export default function MobileAddEventSheet({
  isOpen, onClose, reportId, reportTitle, caseNumber, sections, preferredSectionId, onSaved,
}: MobileAddEventSheetProps) {
  const lagringsnyckel = `specialrapport:${reportId}:senaste-sektion`
  const [sektion, setSektion] = useState<string | null>(null)
  const [franPosition, setFranPosition] = useState(false)
  const [typ, setTyp] = useState<SpecialReportEventType | null>(null)
  const [datum, setDatum] = useState(idagISO())
  const [titel, setTitel] = useState('')
  const titelRord = useRef(false)
  const [beskrivning, setBeskrivning] = useState('')
  const [foton, setFoton] = useState<{ fil: File; url: string }[]>([])
  const [sparar, setSparar] = useState(false)
  const kameraRef = useRef<HTMLInputElement>(null)
  const fotonRef = useRef(foton)
  useEffect(() => { fotonRef.current = foton }, [foton])

  // Nollställ och föreslå del när arket öppnas
  useEffect(() => {
    if (!isOpen) return
    setTyp(null)
    setDatum(idagISO())
    setTitel('')
    titelRord.current = false
    setBeskrivning('')
    fotonRef.current.forEach(f => URL.revokeObjectURL(f.url))
    setFoton([])
    setFranPosition(false)

    const senaste = lasLokalt(lagringsnyckel)
    const reserv = [preferredSectionId, senaste].find(id => id && sections.some(s => s.id === id)) ?? sections[0]?.id ?? null
    setSektion(reserv)

    const medOmrade = sections.filter(s => s.area && s.area.length >= 3)
    if (!medOmrade.length || !('geolocation' in navigator)) return
    let aktuell = true
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!aktuell) return
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const traff = medOmrade.find(s => punktIOmrade(p, s.area!))
        if (traff) {
          setSektion(traff.id)
          setFranPosition(true)
        }
      },
      () => { /* ingen position: behåll reservvalet */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
    return () => { aktuell = false }
    // Förslaget görs bara när arket öppnas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Släpp förhandsvisningarna när arket avmonteras
  useEffect(() => () => { fotonRef.current.forEach(f => URL.revokeObjectURL(f.url)) }, [])

  const valjTyp = (t: SpecialReportEventType) => {
    setTyp(t)
    if (!titelRord.current) setTitel(EVENT_TYPES[t].defaultTitle)
  }

  const nyaFoton = (lista: FileList | null) => {
    const filer = Array.from(lista ?? []).filter(f => f.type.startsWith('image/'))
    setFoton(prev => [...prev, ...filer.map(fil => ({ fil, url: URL.createObjectURL(fil) }))])
    if (kameraRef.current) kameraRef.current.value = ''
  }

  const kanSpara = !!sektion && !!typ && titel.trim().length > 0 && !!datum && !sparar

  const spara = async () => {
    if (!sektion || !typ) return
    setSparar(true)
    try {
      const ev = await SpecialReportService.addEvent(sektion, {
        event_date: datum,
        type: typ,
        title: titel.trim(),
        description: beskrivning.trim() || null,
      })
      let fel = 0
      for (const f of foton) {
        try {
          await SpecialReportService.uploadImage(reportId, sektion, f.fil, { eventId: ev.id })
        } catch {
          fel += 1
        }
      }
      skrivLokalt(lagringsnyckel, sektion)
      if (fel) toast.error(`Händelsen sparades, men ${fel} foton kunde inte laddas upp`)
      else toast.success('Händelsen är sparad i rapporten')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara händelsen')
    } finally {
      setSparar(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ny händelse"
      subtitle={`${reportTitle}${caseNumber ? ` · ${caseNumber}` : ''}`}
      size="md"
      mobilHelskarm
      usePortal
      preventClose={sparar}
      footer={
        <div className="px-4 py-3">
          <button type="button" className={`${PRIMAR_KNAPP} w-full h-[52px] text-[15px]`} onClick={spara} disabled={!kanSpara}>
            {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="allman.bock" size={20} />}
            Spara i rapporten
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        {/* Del */}
        <section className="space-y-2">
          <p className="text-sm font-medium text-slate-300">Del</p>
          {sections.length === 0 ? (
            <p className="text-sm text-slate-500">Rapporten har inga delar än. Lägg till en del först.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {sections.map((s, i) => {
                const vald = sektion === s.id
                const farg = fargForDel(s.color, i)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={vald}
                    onClick={() => { setSektion(s.id); setFranPosition(false) }}
                    className={`flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] px-1 ${
                      vald ? 'text-white' : 'border-slate-700/60 bg-slate-800/40 text-slate-200'
                    }`}
                    style={vald ? { borderColor: farg, background: `${farg}1a` } : undefined}
                  >
                    <span className="text-lg font-extrabold" style={{ color: farg }}>{i + 1}</span>
                    <span className="w-full truncate text-center text-[11px] text-slate-400">{s.title.trim() || 'Utan rubrik'}</span>
                  </button>
                )
              })}
            </div>
          )}
          {franPosition && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-[#20c58f]"><Icon name="rapport.position" size={16} /></span>
              Föreslagen efter området du står i
            </p>
          )}
        </section>

        {/* Typ */}
        <section className="space-y-2">
          <p className="text-sm font-medium text-slate-300">Vad har du gjort?</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPER.map(t => {
              const vald = typ === t
              const farg = EVENT_TYPES[t].color
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={vald}
                  onClick={() => valjTyp(t)}
                  className="flex h-[66px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] text-xs text-slate-200"
                  style={vald ? { borderColor: farg, background: `${farg}1a` } : { borderColor: 'rgb(51 65 85 / 0.6)' }}
                >
                  <span style={{ color: farg }}><Icon name={EVENT_ICON[t]} size={20} /></span>
                  {KORT[t] ?? EVENT_TYPES[t].label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Text */}
        <section className="space-y-2.5">
          <label className="flex h-12 items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-slate-400">
            <Icon name="allman.kalender" size={16} />
            Datum
            <input
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              className="flex-1 bg-transparent text-right text-sm text-white outline-none"
            />
          </label>
          <input
            aria-label="Rubrik"
            placeholder="Rubrik"
            value={titel}
            onChange={e => { titelRord.current = true; setTitel(e.target.value) }}
            className={`${FALT} h-12 text-[15px]`}
          />
          <textarea
            aria-label="Beskrivning"
            placeholder="Vad gjorde du och vad såg du?"
            value={beskrivning}
            onChange={e => setBeskrivning(e.target.value)}
            rows={3}
            className={TEXTFALT}
          />
        </section>

        {/* Foton */}
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="Lägg till foton"
            title="Ta foto eller välj ur biblioteket"
            onClick={() => kameraRef.current?.click()}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-xl border-[1.5px] border-dashed border-slate-600 text-slate-300"
          >
            <Icon name="allman.foto" size={24} />
          </button>
          {foton.map((f, i) => (
            <div key={f.url} className="relative h-[72px] w-[72px] overflow-hidden rounded-xl bg-slate-800">
              <img src={f.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Ta bort foto ${i + 1}`}
                onClick={() => { URL.revokeObjectURL(f.url); setFoton(prev => prev.filter(x => x.url !== f.url)) }}
                className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1 text-[#fff]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/70"><Icon name="allman.stang" size={16} /></span>
              </button>
            </div>
          ))}
          {/* Utan capture: mobilen erbjuder både kamera och bildbibliotek */}
          <input ref={kameraRef} type="file" accept="image/*" multiple className="hidden" onChange={e => nyaFoton(e.target.files)} />
        </section>
      </div>
    </Modal>
  )
}

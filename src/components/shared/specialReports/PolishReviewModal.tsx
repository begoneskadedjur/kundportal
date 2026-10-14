// src/components/shared/specialReports/PolishReviewModal.tsx
// Granskningsrutan för Snygga till (3.52.0, skiss V3-Granska). Rutan skickar
// fälten till AI-genomläsningen när den öppnas och visar förslagen:
//   vänster  texten som den blir, borttaget rött överstruket, tillagt grönt,
//            nytt stycke markerat. Klick på en markering växlar ändringen.
//   höger    förslagen i grupper per kategori med kryssrutor. Formulering är
//            avbockad från början, övriga ikryssade.
// Inget ändras förrän användaren trycker Använd; själva tillämpningen sköter
// redigeraren (onApply) via de vanliga sparvägarna.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import { Icon } from '../../icons/Icon'
import { TextPolishService } from '../../../services/textPolishService'
import {
  POLISH_KINDS,
  POLISH_KIND_LABEL,
  type PolishChange,
  type PolishContext,
  type PolishField,
  type PolishKind,
  type PolishResponse,
} from '../../../types/textPolish'
import { PRIMAR_KNAPP, SEKUNDAR_KNAPP } from './specialReportUtils'

const KIND_FARG: Record<PolishKind, string> = {
  stavning: '#ef4444',
  versal: '#3b82f6',
  skiljetecken: '#64748b',
  stycke: '#8b5cf6',
  formulering: '#f59e0b',
}

const KRYSS = 'h-[18px] w-[18px] flex-shrink-0 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]'

interface PolishReviewModalProps {
  isOpen: boolean
  onClose: () => void
  /** Vad som läses igenom, till exempel "Del 2 · Grannhuset · Text" */
  scopeLabel: string
  /** Fälten som skickas, med texten som den ser ut när rutan öppnas */
  fields: PolishField[]
  context?: PolishContext
  /** Länk till ordlistan (bara för roller som har sidan) */
  glossaryHref: string | null
  /** Tillämpa de valda ändringarna. fields är texterna som lästes igenom */
  onApply: (fields: PolishField[], changes: PolishChange[]) => void
}

type Lage =
  | { typ: 'laddar' }
  | { typ: 'fel'; text: string }
  | { typ: 'klar'; svar: PolishResponse }

/** Kan förslaget läggas till i ordlistan: ett eller ett par ord med bokstäver */
const kanBliOrd = (c: PolishChange) =>
  c.kind === 'stavning' && /\p{L}/u.test(c.from) && c.from.trim() === c.from && c.from.length <= 60 && !/\n/.test(c.from)

export default function PolishReviewModal({ isOpen, onClose, scopeLabel, fields, context, glossaryHref, onApply }: PolishReviewModalProps) {
  const [lage, setLage] = useState<Lage>({ typ: 'laddar' })
  const [med, setMed] = useState<Record<string, boolean>>({})
  const [iOrdlista, setIOrdlista] = useState<Record<string, boolean>>({})
  const [laggerTill, setLaggerTill] = useState<string | null>(null)
  // Texterna som skickades, låsta när rutan öppnas
  const [skickade, setSkickade] = useState<PolishField[]>([])
  const korning = useRef(0)

  const kor = useCallback(async (falt: PolishField[]) => {
    const nr = ++korning.current
    setLage({ typ: 'laddar' })
    setMed({})
    setIOrdlista({})
    try {
      const svar = await TextPolishService.polish(falt, context)
      if (nr !== korning.current) return
      const start: Record<string, boolean> = {}
      svar.changes.forEach(c => { start[c.id] = c.kind !== 'formulering' })
      setMed(start)
      setLage({ typ: 'klar', svar })
    } catch (e) {
      if (nr !== korning.current) return
      setLage({ typ: 'fel', text: e instanceof Error ? e.message : 'Genomläsningen misslyckades. Försök igen.' })
    }
  }, [context])

  // Ny genomläsning varje gång rutan öppnas
  useEffect(() => {
    if (!isOpen) {
      korning.current++
      // Nollställ så att förra genomläsningen inte syns när rutan öppnas igen
      setLage({ typ: 'laddar' })
      setMed({})
      setIOrdlista({})
      setSkickade([])
      return
    }
    const falt = fields.map(f => ({ ...f }))
    setSkickade(falt)
    void kor(falt)
    // Bara när rutan öppnas: fälten låses vid öppningen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const svar = lage.typ === 'klar' ? lage.svar : null
  const forslag = useMemo(() => svar?.changes ?? [], [svar])
  const antalValda = forslag.filter(c => med[c.id]).length
  const flera = skickade.filter(f => forslag.some(c => c.fieldId === f.id)).length > 1
  const faltNamn = useMemo(() => new Map(skickade.map(f => [f.id, f.label])), [skickade])

  const vaxla = (id: string) => setMed(m => ({ ...m, [id]: !m[id] }))
  const satt = (ids: string[], v: boolean) => setMed(m => {
    const ny = { ...m }
    ids.forEach(id => { if (!iOrdlista[id]) ny[id] = v })
    return ny
  })

  const laggTillIOrdlista = async (c: PolishChange) => {
    setLaggerTill(c.id)
    try {
      await TextPolishService.addToGlossary(c.from)
      // Samma ord i andra förslag bockas också av
      const samma = forslag.filter(x => x.kind === 'stavning' && x.from.toLocaleLowerCase('sv-SE') === c.from.toLocaleLowerCase('sv-SE')).map(x => x.id)
      setIOrdlista(o => ({ ...o, ...Object.fromEntries(samma.map(id => [id, true])) }))
      setMed(m => ({ ...m, ...Object.fromEntries(samma.map(id => [id, false])) }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte lägga till ordet')
    } finally {
      setLaggerTill(null)
    }
  }

  const anvand = () => {
    const valda = forslag.filter(c => med[c.id])
    if (valda.length === 0) return
    onApply(skickade, valda)
  }

  const titel = (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
        <Icon name="rapport.snygga" size={24} />
      </span>
      <span className="min-w-0">
        <span className="block truncate">Snygga till texten</span>
        <span className="block truncate text-sm font-normal text-slate-400">{scopeLabel}. Inget ändras förrän du trycker Använd.</span>
      </span>
    </span>
  )

  const footer = (
    <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
      <span className="hidden flex-1 text-xs text-slate-400 sm:block">
        {lage.typ === 'klar' && forslag.length > 0 ? 'Tryck på en markering i texten för att välja bort den.' : ''}
      </span>
      <button type="button" onClick={onClose} className={`${SEKUNDAR_KNAPP} max-sm:flex-1`}>Avbryt</button>
      <button type="button" onClick={anvand} disabled={antalValda === 0} className={`${PRIMAR_KNAPP} max-sm:flex-1`}>
        <Icon name="allman.bock" size={20} />
        Använd {antalValda} {antalValda === 1 ? 'ändring' : 'ändringar'}
      </button>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titel} size="full" usePortal mobilHelskarm footer={footer}>
      {lage.typ === 'laddar' && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-semibold text-white">Läser igenom texten</p>
          <p className="text-xs text-slate-400">Det tar oftast några sekunder.</p>
        </div>
      )}

      {lage.typ === 'fel' && (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center" role="alert">
          <p className="max-w-md text-sm text-slate-300">{lage.text}</p>
          <button type="button" onClick={() => void kor(skickade)} className={SEKUNDAR_KNAPP}>Försök igen</button>
        </div>
      )}

      {svar && (
        <div className="flex flex-col lg:h-[min(640px,70dvh)] lg:flex-row">
          {/* ── Så blir texten ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 border-slate-700/50 p-4 lg:overflow-y-auto lg:border-r">
            {forslag.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Icon name="allman.bock" size={32} className="text-emerald-400" />
                <p className="text-sm font-semibold text-white">Texten ser bra ut, inget att ändra</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400">Så blir texten</span>
                  <span className="flex gap-3.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="bg-red-500/15 px-1 text-red-400 line-through">gammalt</span>tas bort</span>
                    <span className="flex items-center gap-1.5"><span className="bg-emerald-500/15 px-1 text-emerald-400">nytt</span>läggs till</span>
                  </span>
                </div>
                {skickade.filter(f => forslag.some(c => c.fieldId === f.id)).map(f => (
                  <div key={f.id} className="space-y-1.5">
                    {flera && <span className="block text-xs font-semibold text-slate-300">{f.label}</span>}
                    <TextMedForslag text={f.text} forslag={forslag.filter(c => c.fieldId === f.id)} med={med} onVaxla={vaxla} />
                  </div>
                ))}
              </>
            )}

            <SkyddatRuta svar={svar} glossaryHref={glossaryHref} onNavigera={onClose} />
          </div>

          {/* ── Förslagen ── */}
          {forslag.length > 0 && (
            <div className="flex w-full flex-shrink-0 flex-col lg:w-[420px] lg:overflow-y-auto">
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <span className="text-sm font-bold text-white">{antalValda} av {forslag.length} ändringar valda</span>
                <span className="flex">
                  <button type="button" onClick={() => satt(forslag.map(c => c.id), true)} className="h-11 px-2 text-xs text-emerald-400 hover:underline">Välj alla</button>
                  <button type="button" onClick={() => satt(forslag.map(c => c.id), false)} className="h-11 px-2 text-xs text-emerald-400 hover:underline">Inga</button>
                </span>
              </div>
              <div className="flex flex-col gap-2.5 px-3 pb-4">
                {POLISH_KINDS.map(kind => {
                  const rader = forslag.filter(c => c.kind === kind)
                  if (rader.length === 0) return null
                  const valda = rader.filter(c => med[c.id]).length
                  // Förslag som lagts till i ordlistan går inte att välja och räknas inte i gruppkrysset
                  const valbara = rader.filter(c => !iOrdlista[c.id])
                  const valdaValbara = valbara.filter(c => med[c.id]).length
                  const allaValda = valbara.length > 0 && valdaValbara === valbara.length
                  return (
                    <div key={kind} className="overflow-hidden rounded-xl border border-slate-700">
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 bg-slate-800/40 px-3">
                        <GruppKryss
                          alla={allaValda}
                          delvis={valdaValbara > 0 && !allaValda}
                          onChange={() => satt(valbara.map(c => c.id), !allaValda)}
                          label={`Alla förslag om ${POLISH_KIND_LABEL[kind].toLowerCase()}`}
                        />
                        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: KIND_FARG[kind] }} aria-hidden="true" />
                        <span className="flex-1 text-sm font-semibold text-white">{POLISH_KIND_LABEL[kind]}</span>
                        <span className="text-xs text-slate-400">{valda} av {rader.length}</span>
                      </label>
                      {rader.map(c => {
                        const tillagd = !!iOrdlista[c.id]
                        return (
                          <div key={c.id} className={`flex gap-2.5 border-t border-slate-700/50 px-3 py-2 ${tillagd ? 'opacity-60' : ''}`}>
                            <input
                              type="checkbox"
                              checked={!!med[c.id]}
                              disabled={tillagd}
                              onChange={() => vaxla(c.id)}
                              aria-label={`${c.reason}: ${visaFran(c)} till ${visaTill(c)}`}
                              className={`${KRYSS} mt-0.5`}
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                              {flera && <span className="truncate text-[11px] text-slate-500">{faltNamn.get(c.fieldId)}</span>}
                              <span className="break-words">
                                <span className="text-red-400 line-through">{visaFran(c)}</span>
                                <span className="text-slate-500"> till </span>
                                <span className="font-semibold text-emerald-400">{visaTill(c)}</span>
                              </span>
                              <span className="text-xs text-slate-400">{c.reason}</span>
                              {kanBliOrd(c) && !tillagd && (
                                <button
                                  type="button"
                                  onClick={() => laggTillIOrdlista(c)}
                                  disabled={laggerTill !== null}
                                  className="-my-1 flex h-11 items-center gap-1.5 self-start text-xs text-emerald-400 hover:underline disabled:opacity-60"
                                >
                                  {laggerTill === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="rapport.ordlista" size={16} />}
                                  Rätt stavat, lägg till i ordlistan
                                </button>
                              )}
                              {tillagd && <span className="text-xs text-emerald-400">Tillagt i ordlistan. Rättas aldrig igen.</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

const visaFran = (c: PolishChange) => (c.kind === 'stycke' ? 'mellanslag' : c.from === '' ? 'inget' : c.from.replace(/\n/g, '↵'))
const visaTill = (c: PolishChange) => (c.kind === 'stycke' ? 'nytt stycke' : c.to === '' ? 'inget' : c.to.replace(/\n/g, '↵'))

/** Gruppens kryssruta, delvis ikryssad när bara en del av förslagen är valda */
function GruppKryss({ alla, delvis, onChange, label }: { alla: boolean; delvis: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = delvis }, [delvis])
  return <input ref={ref} type="checkbox" checked={alla} onChange={onChange} aria-label={label} className={KRYSS} />
}

/** Fältets text med förslagen inlagda, valda som ändring och avvalda som understruket original */
function TextMedForslag({ text, forslag, med, onVaxla }: {
  text: string
  forslag: PolishChange[]
  med: Record<string, boolean>
  onVaxla: (id: string) => void
}) {
  const sorterade = [...forslag].sort((a, b) => a.start - b.start || a.end - b.end)
  const bitar: ReactNode[] = []
  let pos = 0
  sorterade.forEach(c => {
    if (c.start > pos) bitar.push(<span key={`t${pos}`}>{text.slice(pos, c.start)}</span>)
    const vald = !!med[c.id]
    const stycke = c.kind === 'stycke'
    bitar.push(
      <button
        key={c.id}
        type="button"
        onClick={() => onVaxla(c.id)}
        aria-pressed={vald}
        title={`${c.reason}. Tryck för att ${vald ? 'välja bort' : 'välja'}.`}
        className="inline rounded-[3px] p-0 text-left align-baseline [font:inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
      >
        {vald ? (
          <>
            {c.from !== '' && !stycke && <span className="bg-red-500/15 px-0.5 text-red-400 line-through">{c.from}</span>}
            {stycke ? (
              <>
                <span className="mx-0.5 bg-emerald-500/15 px-1 text-xs text-emerald-400">nytt stycke</span>
                {'\n\n'}
              </>
            ) : (
              c.to !== '' && <span className="bg-emerald-500/15 px-0.5 text-emerald-400">{c.to}</span>
            )}
          </>
        ) : (
          <span className="border-b-2 border-dotted border-slate-500">{stycke ? ' ' : c.from || ' '}</span>
        )}
      </button>,
    )
    pos = Math.max(pos, c.end)
  })
  if (pos < text.length) bitar.push(<span key={`t${pos}`}>{text.slice(pos)}</span>)
  return (
    <div className="whitespace-pre-wrap break-words rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3.5 text-[15px] leading-[1.85] text-slate-100">
      {bitar}
    </div>
  )
}

/** Rutan Skyddat: antal skyddade termer som förekom och stoppade förslag */
function SkyddatRuta({ svar, glossaryHref, onNavigera }: { svar: PolishResponse; glossaryHref: string | null; onNavigera: () => void }) {
  const termer = svar.protectedTerms
  const visade = termer.slice(0, 6)
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2.5 text-[13px] text-slate-300">
      <Icon name="rapport.skyddat" size={20} className="mt-px flex-shrink-0 text-emerald-400" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p>
          Skyddat:{' '}
          {termer.length > 0
            ? <>{termer.length} ord ur ordlistan ({visade.join(', ')}{termer.length > visade.length ? ` och ${termer.length - visade.length} till` : ''}) och alla siffror och datum.</>
            : 'alla siffror och datum, och ordlistans ord om de förekommer.'}
        </p>
        {svar.blocked.length > 0 && (
          <div>
            <p>{svar.blocked.length === 1 ? 'Ett förslag stoppades:' : `${svar.blocked.length} förslag stoppades:`}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
              {svar.blocked.slice(0, 8).map((b, i) => (
                <li key={i} className="break-words">
                  "{b.from || 'inget'}" till "{b.to.replace(/\n/g, '↵') || 'inget'}": {b.reason}
                </li>
              ))}
              {svar.blocked.length > 8 && <li>och {svar.blocked.length - 8} till</li>}
            </ul>
          </div>
        )}
        {glossaryHref && (
          <Link to={glossaryHref} onClick={onNavigera} className="inline-flex min-h-[44px] items-center gap-1.5 text-emerald-400 hover:underline">
            <Icon name="rapport.ordlista" size={16} />
            Ordlistan
          </Link>
        )}
      </div>
    </div>
  )
}

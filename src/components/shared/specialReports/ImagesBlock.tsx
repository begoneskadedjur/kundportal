// src/components/shared/specialReports/ImagesBlock.tsx
// Bildblocket. 3.55.0: ett tätt rutnät (fem i bredd på bred skärm, färre på
// smal) med miniatyr cirka 88 px hög och numret den får i rapporten, bildtext
// som litet fält och "Hör till: ..." som diskret val i händelsens färg. Sist i
// rutnätet en ruta för att ladda upp; "Ladda upp" finns också i blockets
// huvud (SectionEditor anropar valjRef). På mobil även direkt från kameran.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import ImageLightbox from '../ImageLightbox'
import { EVENT_TYPES, handelseOrdning } from '../../../types/specialReport'
import type { FullSection, SectionOps } from './sectionOps'
import { kortDatum } from './specialReportUtils'

interface ImagesBlockProps {
  section: FullSection
  ops: SectionOps
  /** Fylls med en funktion som öppnar filväljaren (knappen i blockets huvud) */
  valjRef?: RefObject<(() => void) | null>
}

export default function ImagesBlock({ section, ops, valjRef }: ImagesBlockProps) {
  const filRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const [laddar, setLaddar] = useState(0)
  const [visad, setVisad] = useState<number | null>(null)
  const [tarBort, setTarBort] = useState<string | null>(null)

  useEffect(() => {
    if (!valjRef) return
    valjRef.current = () => filRef.current?.click()
    return () => { valjRef.current = null }
  }, [valjRef])

  const bilder = useMemo(() => [...section.images].sort((a, b) => a.position - b.position), [section.images])
  const handelser = useMemo(() => [...section.events].sort(handelseOrdning), [section.events])
  const handelseFor = useMemo(() => new Map(section.events.map(e => [e.id, e])), [section.events])
  // Lightboxen visar bara bilder med URL, därför ett eget index per bild
  const visbara = bilder.filter(b => b.url)

  const valda = async (lista: FileList | null) => {
    const filer = Array.from(lista ?? [])
    if (filRef.current) filRef.current.value = ''
    if (kameraRef.current) kameraRef.current.value = ''
    if (!filer.length) return
    setLaddar(filer.length)
    try {
      await ops.uploadImages(section.id, filer)
    } finally {
      setLaddar(0)
    }
  }

  const taBort = async (id: string) => {
    setTarBort(id)
    try { await ops.deleteImage(section.id, id) } finally { setTarBort(null) }
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2.5 @sm:grid-cols-3 @lg:grid-cols-4 @2xl:grid-cols-5">
        {bilder.map((b, i) => {
          const ev = b.event_id ? handelseFor.get(b.event_id) : undefined
          const farg = ev ? (EVENT_TYPES[ev.type]?.color ?? '#94a3b8') : null
          const lightboxIndex = visbara.indexOf(b)
          return (
            <figure key={b.id} className="group flex min-w-0 flex-col gap-1">
              <div className="relative h-[88px] overflow-hidden rounded-md bg-slate-800" style={farg ? { boxShadow: `inset 0 0 0 2px ${farg}` } : undefined}>
                {b.url ? (
                  <button type="button" onClick={() => setVisad(lightboxIndex)} className="block h-full w-full" aria-label={`Visa bild ${i + 1}`}>
                    <img src={b.url} alt={b.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ) : (
                  <span className="flex h-full items-center justify-center text-slate-500"><Icon name="rapport.bilder" size={20} /></span>
                )}
                {/* Fasta färger: märket ligger på fotot i båda temana */}
                <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-[#0f172a]/80 px-1.5 py-px text-[10px] font-bold text-[#fff]">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => taBort(b.id)}
                  disabled={tarBort === b.id}
                  aria-label={`Ta bort bild ${i + 1}`}
                  title="Ta bort bilden"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-[#0f172a]/70 text-[#fff] opacity-0 transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                >
                  {tarBort === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon name="allman.radera" size={16} />}
                </button>
              </div>
              <input
                aria-label={`Bildtext för bild ${i + 1}`}
                placeholder="Bildtext"
                value={b.caption ?? ''}
                onChange={e => ops.updateImageCaption(section.id, b.id, e.target.value)}
                className="h-[26px] w-full rounded-md border border-slate-800 bg-transparent px-1.5 text-xs text-white placeholder-slate-500 focus:border-[#20c58f] focus:outline-none focus:ring-1 focus:ring-[#20c58f]/50"
              />
              <select
                aria-label={`Bild ${i + 1} hör till händelse`}
                value={b.event_id ?? ''}
                onChange={e => ops.updateImageEvent(section.id, b.id, e.target.value || null)}
                style={farg ? { color: farg } : undefined}
                className={`h-6 w-full min-w-0 cursor-pointer truncate rounded border-0 bg-transparent px-0 text-[11px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#20c58f]/60 ${farg ? 'font-medium' : 'text-slate-500'}`}
              >
                <option value="">Hör inte till någon händelse</option>
                {handelser.map(h => (
                  <option key={h.id} value={h.id}>
                    Hör till: {h.title.trim() || EVENT_TYPES[h.type]?.label || 'Utan rubrik'} {kortDatum(h.event_date)}
                  </option>
                ))}
              </select>
            </figure>
          )
        })}

        {laddar > 0 && Array.from({ length: laddar }).map((_, i) => (
          <div key={`laddar-${i}`} className="flex h-[88px] items-center justify-center rounded-md bg-slate-800/50">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ))}

        <button
          type="button"
          onClick={() => filRef.current?.click()}
          disabled={laddar > 0}
          className="flex h-[88px] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-slate-700 text-xs text-slate-400 transition-colors hover:border-[#20c58f] hover:text-white disabled:opacity-50"
        >
          <Icon name="allman.plus" size={20} />
          Lägg till
        </button>
        <button
          type="button"
          onClick={() => kameraRef.current?.click()}
          disabled={laddar > 0}
          className="flex h-[88px] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-slate-700 text-xs text-slate-400 hover:text-white disabled:opacity-50 sm:hidden"
        >
          <Icon name="allman.foto" size={20} />
          Ta foto
        </button>
      </div>

      {bilder.length === 0 && laddar === 0 && (
        <p className="text-xs text-slate-500">Inga bilder än. Ladda upp här, eller bifoga en bild direkt från en händelse.</p>
      )}

      <input ref={filRef} type="file" accept="image/*" multiple className="hidden" onChange={e => void valda(e.target.files)} />
      <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void valda(e.target.files)} />

      <ImageLightbox
        images={visbara.map(b => ({ url: b.url!, alt: b.caption ?? undefined }))}
        initialIndex={visad ?? 0}
        isOpen={visad !== null}
        onClose={() => setVisad(null)}
        title={section.title}
      />
    </div>
  )
}

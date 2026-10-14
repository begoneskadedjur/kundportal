// src/components/shared/specialReports/ImagesBlock.tsx
// Bildblocket (3.53.0): delens bilder som kort med "Bild N" (samma nummer som
// i rapporten), bildtext och valet "Hör till händelse". Kortets kant tar
// färgen från händelsen bilden hör till. Uppladdning av flera filer, och på
// mobil direkt från kameran.

import { useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import ImageLightbox from '../ImageLightbox'
import { EVENT_TYPES } from '../../../types/specialReport'
import type { FullSection, SectionOps } from './sectionOps'
import { SEKUNDAR_KNAPP, dagOchManad } from './specialReportUtils'

interface ImagesBlockProps {
  section: FullSection
  ops: SectionOps
}

export default function ImagesBlock({ section, ops }: ImagesBlockProps) {
  const filRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const [laddar, setLaddar] = useState(0)
  const [visad, setVisad] = useState<number | null>(null)
  const [tarBort, setTarBort] = useState<string | null>(null)

  const bilder = useMemo(() => [...section.images].sort((a, b) => a.position - b.position), [section.images])
  const handelser = useMemo(
    () => [...section.events].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.created_at.localeCompare(b.created_at)),
    [section.events],
  )
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
    <div className="space-y-3">
      {bilder.length === 0 && laddar === 0 && (
        <p className="rounded-2xl border-[1.5px] border-dashed border-slate-700 px-4 py-5 text-center text-sm text-slate-500">
          Inga bilder än. Ladda upp här, eller bifoga en bild direkt från en händelse.
        </p>
      )}

      {(bilder.length > 0 || laddar > 0) && (
        <div className="grid grid-cols-1 gap-3.5 @sm:grid-cols-2 @2xl:grid-cols-3">
          {bilder.map((b, i) => {
            const ev = b.event_id ? handelseFor.get(b.event_id) : undefined
            const farg = ev ? (EVENT_TYPES[ev.type]?.color ?? '#94a3b8') : null
            const lightboxIndex = visbara.indexOf(b)
            return (
              <figure
                key={b.id}
                className={`flex flex-col gap-2 rounded-2xl border-[1.5px] bg-slate-800/30 p-2 ${farg ? '' : 'border-slate-800'}`}
                style={farg ? { borderColor: `${farg}66` } : undefined}
              >
                <div className="relative h-[150px] overflow-hidden rounded-[10px] bg-slate-800">
                  {b.url ? (
                    <button type="button" onClick={() => setVisad(lightboxIndex)} className="block h-full w-full" aria-label={`Visa bild ${i + 1}`}>
                      <img src={b.url} alt={b.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ) : (
                    <span className="flex h-full items-center justify-center text-slate-500"><Icon name="rapport.bilder" size={24} /></span>
                  )}
                  {/* Fasta färger: märket ligger på fotot i båda temana */}
                  <span className="pointer-events-none absolute left-2 top-2 flex h-6 items-center rounded-[7px] bg-[#0f172a]/80 px-2 text-[11px] font-bold text-[#fff]">
                    Bild {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => taBort(b.id)}
                    disabled={tarBort === b.id}
                    aria-label={`Ta bort bild ${i + 1}`}
                    title="Ta bort bilden"
                    className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f172a]/70 text-[#fff] hover:bg-red-600"
                  >
                    {tarBort === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.radera" size={16} />}
                  </button>
                </div>
                <input
                  aria-label={`Bildtext för bild ${i + 1}`}
                  placeholder="Bildtext"
                  value={b.caption ?? ''}
                  onChange={e => ops.updateImageCaption(section.id, b.id, e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder-slate-500 focus:border-[#20c58f] focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
                />
                <label className="flex items-center gap-2">
                  <span style={farg ? { color: farg } : undefined} className={farg ? '' : 'text-slate-500'}>
                    <Icon name="rapport.gem" size={16} />
                  </span>
                  <span className="sr-only">Hör till händelse</span>
                  <select
                    value={b.event_id ?? ''}
                    onChange={e => ops.updateImageEvent(section.id, b.id, e.target.value || null)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 focus:border-[#20c58f] focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
                  >
                    <option value="">Inte kopplad till någon händelse</option>
                    {handelser.map(h => {
                      const { dag, manad } = dagOchManad(h.event_date)
                      return (
                        <option key={h.id} value={h.id}>
                          {EVENT_TYPES[h.type]?.label ?? h.type} {dag} {manad}: {h.title || 'Utan rubrik'}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </figure>
            )
          })}

          {laddar > 0 && Array.from({ length: laddar }).map((_, i) => (
            <div key={`laddar-${i}`} className="flex h-[150px] items-center justify-center rounded-2xl bg-slate-800/50">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => filRef.current?.click()} disabled={laddar > 0} className={SEKUNDAR_KNAPP}>
          <Icon name="rapport.ladda-upp" size={16} />
          Ladda upp bilder
        </button>
        <button type="button" onClick={() => kameraRef.current?.click()} disabled={laddar > 0} className={`${SEKUNDAR_KNAPP} sm:hidden`}>
          <Icon name="allman.foto" size={16} />
          Ta foto
        </button>
      </div>

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

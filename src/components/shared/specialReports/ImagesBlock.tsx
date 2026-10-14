// src/components/shared/specialReports/ImagesBlock.tsx
// Bildblocket: delens bilder som miniatyrer med bildtext. Uppladdning av
// flera filer, och på mobil direkt från kameran.

import { useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import ImageLightbox from '../ImageLightbox'
import type { FullSection, SectionOps } from './sectionOps'

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

  const valda = async (lista: FileList | null) => {
    const filer = Array.from(lista ?? []).filter(f => f.type.startsWith('image/'))
    if (!filer.length) return
    setLaddar(filer.length)
    try {
      await ops.uploadImages(section.id, filer)
    } finally {
      setLaddar(0)
      if (filRef.current) filRef.current.value = ''
      if (kameraRef.current) kameraRef.current.value = ''
    }
  }

  const taBort = async (id: string) => {
    setTarBort(id)
    try { await ops.deleteImage(section.id, id) } finally { setTarBort(null) }
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {bilder.map((b, i) => (
        <figure key={b.id} className="w-[calc(50%-5px)] sm:w-[150px] space-y-1">
          <div className="relative h-28 sm:h-[100px] overflow-hidden rounded-xl bg-slate-800">
            {b.url ? (
              <button type="button" onClick={() => setVisad(i)} className="block h-full w-full" aria-label={`Visa bild ${i + 1}`}>
                <img src={b.url} alt={b.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ) : (
              <span className="flex h-full items-center justify-center text-slate-500"><Icon name="rapport.bilder" size={24} /></span>
            )}
            <button
              type="button"
              onClick={() => taBort(b.id)}
              disabled={tarBort === b.id}
              aria-label="Ta bort bilden"
              className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950/70 text-[#fff] hover:bg-red-600"
            >
              {tarBort === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="allman.radera" size={16} />}
            </button>
          </div>
          <input
            aria-label="Bildtext"
            placeholder="Bildtext"
            defaultValue={b.caption ?? ''}
            onChange={e => ops.updateImageCaption(section.id, b.id, e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-700/60 bg-slate-800/40 px-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </figure>
      ))}

      {laddar > 0 && Array.from({ length: laddar }).map((_, i) => (
        <div key={`laddar-${i}`} className="flex h-28 w-[calc(50%-5px)] sm:h-[100px] sm:w-[150px] items-center justify-center rounded-xl bg-slate-800">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ))}

      <button
        type="button"
        onClick={() => filRef.current?.click()}
        disabled={laddar > 0}
        className="flex h-28 w-[calc(50%-5px)] sm:h-[100px] sm:w-[150px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-slate-600 text-xs text-slate-400 hover:border-[#20c58f] hover:text-slate-200"
      >
        <Icon name="rapport.bilder" size={20} />
        Lägg till bilder
      </button>
      <button
        type="button"
        onClick={() => kameraRef.current?.click()}
        disabled={laddar > 0}
        className="flex h-28 w-[calc(50%-5px)] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-slate-600 text-xs text-slate-400 hover:border-[#20c58f] sm:hidden"
      >
        <Icon name="allman.foto" size={20} />
        Ta foto
      </button>

      <input ref={filRef} type="file" accept="image/*" multiple className="hidden" onChange={e => valda(e.target.files)} />
      <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => valda(e.target.files)} />

      <ImageLightbox
        images={bilder.filter(b => b.url).map(b => ({ url: b.url!, alt: b.caption ?? undefined }))}
        initialIndex={visad ?? 0}
        isOpen={visad !== null}
        onClose={() => setVisad(null)}
        title={section.title}
      />
    </div>
  )
}

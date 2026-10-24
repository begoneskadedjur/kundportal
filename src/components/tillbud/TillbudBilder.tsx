// src/components/tillbud/TillbudBilder.tsx
// Bilder i tillbudsrapporter (2026-10-24). Filerna ligger i den privata bucketen
// incident-attachments under <rapportens id>/, en rad per bild i incident_attachments.
// Den som får se rapporten får se bilderna (can_view_incident); rapportören och
// mottagarna får lägga till. Bilderna visas med tidsbegränsade signerade adresser.

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { compressToWebP } from '../../utils/imageUtils'
import { Icon } from '../icons/Icon'
import { IKONKNAPP, KNAPP_SEKUNDAR } from '../fragor/fragorUi'

const BUCKET = 'incident-attachments'
export const MAX_BILDER = 6
const MAX_STORLEK = 10 * 1024 * 1024
const TYPER = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const GILTIG_SEKUNDER = 60 * 60

interface BildRad {
  id: string
  file_path: string
  file_name: string
  uploaded_by: string | null
}

/** Filtrerar bort det som inte är en bild eller är större än 10 MB, med meddelande */
export function giltigaBilder(lista: FileList | null, plats: number): File[] {
  if (!lista) return []
  const ok: File[] = []
  for (const f of Array.from(lista)) {
    if (!TYPER.includes(f.type)) { toast.error(`${f.name}: bara bilder`); continue }
    if (f.size > MAX_STORLEK) { toast.error(`${f.name}: bilden är större än 10 MB`); continue }
    if (ok.length >= plats) { toast.error(`Högst ${MAX_BILDER} bilder per rapport`); break }
    ok.push(f)
  }
  return ok
}

/** Laddar upp bilderna till rapporten. Returnerar hur många som inte gick att ladda upp. */
export async function laddaUppBilder(incidentId: string, filer: File[]): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  let fel = 0
  for (const fil of filer) {
    try {
      const blob = await compressToWebP(fil)
      const webp = blob.type === 'image/webp'
      const ext = webp ? 'webp' : (fil.name.split('.').pop() || 'jpg').toLowerCase()
      const sokvag = `${incidentId}/${crypto.randomUUID()}.${ext}`
      const typ = webp ? 'image/webp' : fil.type
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(sokvag, blob, { contentType: typ, upsert: false })
      if (upErr) throw upErr
      const { error: radErr } = await supabase.from('incident_attachments').insert({
        incident_id: incidentId,
        file_path: sokvag,
        file_name: fil.name,
        mime_type: typ,
        file_size: blob.size,
        uploaded_by: user?.id ?? null,
      })
      if (radErr) {
        await supabase.storage.from(BUCKET).remove([sokvag])
        throw radErr
      }
    } catch (err) {
      console.error('[TillbudBilder] uppladdning', err)
      fel++
    }
  }
  return fel
}

/** Tar bort rapportens filer innan rapporten raderas (raderna följer med rapporten) */
export async function raderaRapportensBilder(incidentId: string): Promise<void> {
  const { data } = await supabase.from('incident_attachments').select('file_path').eq('incident_id', incidentId)
  const sokvagar = (data || []).map(r => r.file_path as string)
  if (sokvagar.length > 0) await supabase.storage.from(BUCKET).remove(sokvagar)
}

/** Bilderna som väljs i formuläret, med förhandsvisning, innan rapporten skickas */
export function BildValjare({ filer, onAndra, disabled }: { filer: File[]; onAndra: (f: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [forhand, setForhand] = useState<string[]>([])

  useEffect(() => {
    const urls = filer.map(f => URL.createObjectURL(f))
    setForhand(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [filer])

  const plats = MAX_BILDER - filer.length

  return (
    <div className="flex flex-col gap-2">
      {filer.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {filer.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
              {forhand[i] && <img src={forhand[i]} alt={f.name} className="w-full h-full object-cover" />}
              <button
                type="button"
                onClick={() => onAndra(filer.filter((_, j) => j !== i))}
                disabled={disabled}
                aria-label={`Ta bort ${f.name}`}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-slate-950/80 text-white flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                <Icon name="allman.stang" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {plats > 0 && (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled} className={`${KNAPP_SEKUNDAR} self-start`}>
          <Icon name="allman.foto" size={20} />
          {filer.length === 0 ? 'Lägg till bilder' : 'Lägg till fler'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={e => { onAndra([...filer, ...giltigaBilder(e.target.files, plats)]); e.target.value = '' }}
      />
      <p className="text-sm text-slate-400">Högst {MAX_BILDER} bilder. Fota gärna platsen, skadan eller utrustningen.</p>
    </div>
  )
}

/** Rapportens bilder i detaljvyn. kanLagga = rapportören eller mottagare av typen. */
export function RapportensBilder({ incidentId, kanLagga, minUserId, kanTaBortAlla }: {
  incidentId: string
  kanLagga: boolean
  minUserId: string | null
  /** Mottagare av typen får ta bort alla bilder */
  kanTaBortAlla: boolean
}) {
  const [rader, setRader] = useState<BildRad[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [laddar, setLaddar] = useState(true)
  const [laddarUpp, setLaddarUpp] = useState(false)
  const [visad, setVisad] = useState<BildRad | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hamta = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('incident_attachments')
        .select('id, file_path, file_name, uploaded_by')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true })
      if (error) throw error
      const lista = (data || []) as BildRad[]
      setRader(lista)
      if (lista.length > 0) {
        const { data: signerade } = await supabase.storage.from(BUCKET).createSignedUrls(lista.map(r => r.file_path), GILTIG_SEKUNDER)
        const karta: Record<string, string> = {}
        for (const s of signerade || []) if (s.path && s.signedUrl) karta[s.path] = s.signedUrl
        setUrls(karta)
      } else {
        setUrls({})
      }
    } catch (err) {
      console.error('[TillbudBilder] hämta', err)
    } finally {
      setLaddar(false)
    }
  }, [incidentId])

  useEffect(() => { setLaddar(true); setVisad(null); hamta() }, [hamta])

  const laggTill = async (lista: FileList | null) => {
    const filer = giltigaBilder(lista, MAX_BILDER - rader.length)
    if (filer.length === 0) return
    setLaddarUpp(true)
    const fel = await laddaUppBilder(incidentId, filer)
    setLaddarUpp(false)
    if (fel > 0) toast.error(fel === filer.length ? 'Bilderna gick inte att ladda upp' : `${fel} av ${filer.length} bilder gick inte att ladda upp`)
    else toast.success(filer.length === 1 ? 'Bilden är tillagd' : 'Bilderna är tillagda')
    hamta()
  }

  const taBort = async (rad: BildRad) => {
    try {
      const { error, count } = await supabase.from('incident_attachments').delete({ count: 'exact' }).eq('id', rad.id)
      if (error) throw error
      if (!count) throw new Error('Du kan inte ta bort bilden')
      await supabase.storage.from(BUCKET).remove([rad.file_path])
      setVisad(null)
      toast.success('Bilden är borttagen')
      hamta()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort bilden')
    }
  }

  if (laddar) return null
  if (rader.length === 0 && !kanLagga) return null

  return (
    <section className="flex flex-col gap-2" aria-label="Bilder">
      <h3 className="text-sm font-medium text-slate-400">Bilder</h3>
      {rader.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {rader.map(r => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setVisad(r)}
                aria-label={`Visa ${r.file_name}`}
                className="block w-full aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                {urls[r.file_path]
                  ? <img src={urls[r.file_path]} alt={r.file_name} loading="lazy" className="w-full h-full object-cover" />
                  : <Icon name="allman.foto" size={24} className="m-auto text-slate-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {kanLagga && rader.length < MAX_BILDER && (
        <>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={laddarUpp} className={`${KNAPP_SEKUNDAR} self-start`}>
            {laddarUpp ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="allman.foto" size={20} />}
            {rader.length === 0 ? 'Lägg till bilder' : 'Lägg till fler'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { laggTill(e.target.files); e.target.value = '' }} />
        </>
      )}

      {visad && (
        <div role="dialog" aria-modal="true" aria-label={visad.file_name} className="fixed inset-0 z-[80] bg-slate-950/95 flex flex-col" onClick={() => setVisad(null)}>
          <div className="flex items-center justify-end gap-1 p-2" onClick={e => e.stopPropagation()}>
            {(kanTaBortAlla || (!!minUserId && visad.uploaded_by === minUserId)) && (
              <button type="button" onClick={() => taBort(visad)} aria-label="Ta bort bilden" className={`${IKONKNAPP} text-red-400`}>
                <Icon name="allman.radera" size={20} />
              </button>
            )}
            <button type="button" onClick={() => setVisad(null)} aria-label="Stäng" className={IKONKNAPP}>
              <Icon name="allman.stang" size={24} />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            {urls[visad.file_path] && (
              <img src={urls[visad.file_path]} alt={visad.file_name} className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

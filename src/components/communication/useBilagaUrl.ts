import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Bilagor i ärendekommunikationen ligger i den privata bucketen comment-attachments.
// Kommentarerna sparar den gamla publika adressen; här byts den mot en tidsbegränsad
// signerad adress som bara personal kan få (lagringspolicyn kräver intern användare).

const BUCKET = 'comment-attachments'
const GILTIG_SEKUNDER = 60 * 60
const cache = new Map<string, { url: string; galler: number }>()

export function bilagansSokvag(url: string): string | null {
  const markor = `/${BUCKET}/`
  const i = url.indexOf(markor)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + markor.length).split('?')[0])
}

async function signera(url: string): Promise<string> {
  const sokvag = bilagansSokvag(url)
  if (!sokvag) return url
  const traff = cache.get(sokvag)
  if (traff && traff.galler > Date.now()) return traff.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(sokvag, GILTIG_SEKUNDER)
  if (error || !data?.signedUrl) throw error ?? new Error('Ingen signerad adress')
  // Förnya en minut innan adressen slutar gälla
  cache.set(sokvag, { url: data.signedUrl, galler: Date.now() + (GILTIG_SEKUNDER - 60) * 1000 })
  return data.signedUrl
}

/** Signerad adress till en bilaga, null medan den hämtas eller om den inte gick att hämta. */
export function useBilagaUrl(url: string): string | null {
  const [signerad, setSignerad] = useState<string | null>(() => {
    const sokvag = bilagansSokvag(url)
    if (!sokvag) return url
    const traff = cache.get(sokvag)
    return traff && traff.galler > Date.now() ? traff.url : null
  })

  useEffect(() => {
    let aktiv = true
    signera(url)
      .then(u => { if (aktiv) setSignerad(u) })
      .catch(() => { if (aktiv) setSignerad(null) })
    return () => { aktiv = false }
  }, [url])

  return signerad
}

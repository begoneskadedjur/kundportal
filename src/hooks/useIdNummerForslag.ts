// src/hooks/useIdNummerForslag.ts
// Kundvalet i Skapa avtal eller offert (3.100.0): förslag ur kundregistret när
// ett fullständigt org- eller personnummer skrivs in i Motpart.

import { useEffect, useState } from 'react'
import { AvtalsKundService, type AvtalsKund } from '../services/avtalsKundService'
import { idNummerSiffror } from '../shared/avtalsKundKoppling'

/** Förslag på kunder med samma org- eller personnummer som det som skrivs in. */
export function useIdNummerForslag(orgNr: string, aktiv: boolean): AvtalsKund[] {
  const [forslag, setForslag] = useState<AvtalsKund[]>([])
  const siffror = aktiv ? idNummerSiffror(orgNr) : null
  useEffect(() => {
    if (!siffror) {
      setForslag([])
      return
    }
    let avbruten = false
    const t = window.setTimeout(() => {
      AvtalsKundService.forslagForIdNummer(siffror)
        .then((r) => { if (!avbruten) setForslag(r) })
        .catch(() => { if (!avbruten) setForslag([]) })
    }, 250)
    return () => { avbruten = true; window.clearTimeout(t) }
  }, [siffror])
  return forslag
}


// src/hooks/useTeknikerBesok.ts
// Hookar ovanpå teknikerDagService för nya arbetsvyn (Idag, Karta, Mina ärenden).

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { hamtaAllaArenden, hamtaBesok, type DagBesok } from '../services/teknikerDagService'

interface Resultat {
  besok: DagBesok[]
  laddar: boolean
  fel: string | null
  ladda: () => Promise<void>
}

function useHamtning(hamta: (tek: string) => Promise<DagBesok[]>, nyckel: string): Resultat {
  const { profile } = useAuth()
  const tek = profile?.technician_id ?? null
  const [besok, setBesok] = useState<DagBesok[]>([])
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)

  const ladda = useCallback(async () => {
    if (!tek) {
      setBesok([])
      setLaddar(false)
      setFel('Ditt konto är inte kopplat till en tekniker')
      return
    }
    setLaddar(true)
    try {
      setBesok(await hamta(tek))
      setFel(null)
    } catch (e) {
      console.error('[useTeknikerBesok]', e)
      setFel('Kunde inte hämta dina besök')
    } finally {
      setLaddar(false)
    }
    // hamta byts ut via nyckel, inte via referens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tek, nyckel])

  useEffect(() => { ladda() }, [ladda])

  return { besok, laddar, fel, ladda }
}

/** Besök från och med `fran` till och med `till` (YYYY-MM-DD i svensk tid) */
export function useBesok(fran: string, till: string): Resultat {
  return useHamtning(tek => hamtaBesok(tek, fran, till), `${fran}_${till}`)
}

/** Alla teknikerns ärenden, alla datum */
export function useAllaArenden(): Resultat {
  return useHamtning(tek => hamtaAllaArenden(tek), 'alla')
}

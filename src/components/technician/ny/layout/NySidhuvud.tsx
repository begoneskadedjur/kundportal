// src/components/technician/ny/layout/NySidhuvud.tsx
// Låter en sida i nya arbetsvyn sätta underrubrik och knappen Visa mig hur i
// layoutens sidhuvud. Rubriken kommer från nyNavConfig (NY_RUBRIKER).
//
//   useNySidhuvud({ underrubrik: 'Onsdag 22 oktober, 4 besök', onVisaMig: () => setVisaMig(true) })
//
// Utanför NyTeknikerLayout gör hooken ingenting.

/* eslint-disable react-refresh/only-export-components -- provider och hookar hör ihop */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface SidhuvudInfo {
  underrubrik?: string
  /** Gör rubrik och underrubrik till en länk, till exempel datumet på Idag till Schema */
  underrubrikLank?: string
  onVisaMig?: () => void
}

interface Ctx {
  info: SidhuvudInfo
  setInfo: (i: SidhuvudInfo) => void
}

const SidhuvudContext = createContext<Ctx | null>(null)

export function NySidhuvudProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SidhuvudInfo>({})
  return <SidhuvudContext.Provider value={{ info, setInfo }}>{children}</SidhuvudContext.Provider>
}

export function useSidhuvudInfo(): SidhuvudInfo {
  return useContext(SidhuvudContext)?.info ?? {}
}

export function useNySidhuvud(info: SidhuvudInfo): void {
  const ctx = useContext(SidhuvudContext)
  const setInfo = ctx?.setInfo
  const { underrubrik, underrubrikLank, onVisaMig } = info
  useEffect(() => {
    if (!setInfo) return
    setInfo({ underrubrik, underrubrikLank, onVisaMig })
    return () => setInfo({})
  }, [setInfo, underrubrik, underrubrikLank, onVisaMig])
}

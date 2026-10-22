// src/components/technician/ny/arenden/useArDator.ts
// Sann på datorbredd (minst 1024 px, Tailwinds lg), följer fönstrets storlek.

import { useEffect, useState } from 'react'

const DATOR = '(min-width: 1024px)'

function arDatorNu(): boolean {
  try { return window.matchMedia(DATOR).matches } catch { return false }
}

export function useArDator(): boolean {
  const [dator, setDator] = useState(arDatorNu)
  useEffect(() => {
    let mq: MediaQueryList
    try { mq = window.matchMedia(DATOR) } catch { return }
    const lyssna = () => setDator(mq.matches)
    mq.addEventListener('change', lyssna)
    return () => mq.removeEventListener('change', lyssna)
  }, [])
  return dator
}

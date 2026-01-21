// src/hooks/useDebounce.ts
// Debounce-hook för att fördröja uppdateringar (t.ex. sökfält)

import { useState, useEffect } from 'react'

/**
 * Debounce ett värde - returnerar värdet först efter att det varit stabilt
 * under den angivna fördröjningen.
 *
 * @param value Värdet att debouncera
 * @param delay Fördröjning i millisekunder (default 300ms)
 * @returns Det debouncerade värdet
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Sätt en timer för att uppdatera det debouncerade värdet
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Rensa timern om värdet ändras innan fördröjningen är klar
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce

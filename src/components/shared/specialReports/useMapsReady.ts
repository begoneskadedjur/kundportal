// src/components/shared/specialReports/useMapsReady.ts
// Laddar Google Maps via useGoogleMaps och väntar dessutom in skriptet om en
// annan komponent redan har lagt till det (useGoogleMaps sätter då aldrig
// isLoaded i den här instansen). Första komponenten som laddar skriptet
// bestämmer biblioteken, därför begärs samma som EquipmentMap plus geometry.

import { useEffect, useState } from 'react'
import { useGoogleMaps } from '../../../hooks/useGoogleMaps'

const LIBRARIES = ['marker', 'drawing', 'places', 'geometry']

export function useMapsReady(): { ready: boolean; error: string | null } {
  const { isLoaded, error } = useGoogleMaps({ libraries: LIBRARIES })
  const [polladKlar, setPolladKlar] = useState(false)

  useEffect(() => {
    if (isLoaded || polladKlar) return
    const t = setInterval(() => {
      if (typeof window !== 'undefined' && window.google?.maps?.Map) {
        setPolladKlar(true)
        clearInterval(t)
      }
    }, 300)
    return () => clearInterval(t)
  }, [isLoaded, polladKlar])

  return { ready: isLoaded || polladKlar, error }
}

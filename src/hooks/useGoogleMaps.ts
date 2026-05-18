// src/hooks/useGoogleMaps.ts
// Hook för att ladda Google Maps API — singleton-mönster förhindrar dubbelladding

import { useState, useEffect } from 'react';

interface GoogleMapsConfig {
  apiKey?: string;
  libraries?: string[];
}

// Module-level singleton — delas av alla instanser av hooken
let mapsScriptState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle'
const mapsLoadCallbacks: Array<() => void> = []

export function useGoogleMaps(config: GoogleMapsConfig = {}) {
  const [isLoaded, setIsLoaded] = useState(
    typeof window !== 'undefined' && !!window.google?.maps
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Redan laddat i denna instans eller globalt
    if (isLoaded) return
    if (mapsScriptState === 'loaded') {
      setIsLoaded(true)
      return
    }

    const onLoaded = () => setIsLoaded(true)
    const onError = () => setError('Kunde inte ladda Google Maps API. Kontrollera API-nyckel och internet.')

    // Laddning pågår redan — registrera callback och vänta
    if (mapsScriptState === 'loading') {
      mapsLoadCallbacks.push(onLoaded)
      return
    }

    // Första anropet — starta laddning
    const apiKey = config.apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    console.log('[useGoogleMaps] API key tillgänglig:', !!apiKey)

    if (!apiKey) {
      console.error('[useGoogleMaps] Ingen Google Maps API key hittad')
      setError('Google Maps API key saknas. Kontrollera miljövariabler.')
      return
    }

    mapsScriptState = 'loading'
    const libraries = config.libraries?.join(',') || 'geometry'

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}&loading=async`
    script.async = true
    script.defer = true

    script.onload = () => {
      console.log('[useGoogleMaps] Google Maps API laddad framgångsrikt')
      mapsScriptState = 'loaded'
      setIsLoaded(true)
      mapsLoadCallbacks.forEach(cb => cb())
      mapsLoadCallbacks.length = 0
    }

    script.onerror = (event) => {
      console.error('[useGoogleMaps] Fel vid laddning av Google Maps API:', event)
      mapsScriptState = 'error'
      onError()
    }

    // Lägg till script — tas INTE bort vid cleanup (Maps API ska leva kvar)
    document.head.appendChild(script)
  }, []) // Tom array — kör bara en gång per komponentinstans

  return {
    isLoaded,
    isLoading: mapsScriptState === 'loading',
    error
  }
}

// src/hooks/useGpsLocation.ts - Hook för GPS-positionshämtning
import { useState, useCallback, useRef } from 'react'

interface GpsState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  loading: boolean
  error: string | null
  warning: string | null
  timestamp: number | null
  positionType: 'gps' | 'network' | 'unknown' | null
}

interface UseGpsLocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  minAccuracy?: number // Minimum acceptabel noggrannhet i meter
}

interface GpsResult {
  latitude: number
  longitude: number
  accuracy: number
}

// Noggrannhetströsklar
const ACCURACY_THRESHOLDS = {
  EXCELLENT: 10,    // <10m = Utmärkt GPS
  GOOD: 30,         // <30m = Bra GPS
  ACCEPTABLE: 100,  // <100m = Acceptabelt
  POOR: 500,        // <500m = Dåligt (troligen nätverksbaserat)
  IP_BASED: 1000    // >1000m = Troligen IP-baserat
}

/**
 * Hook för att fånga GPS-position från enhetens geolocation API
 * Optimerad för mobilanvändning med hög precision
 */
export function useGpsLocation(options: UseGpsLocationOptions = {}) {
  const {
    enableHighAccuracy = true, // Hög precision för exakta placeringar
    timeout = 30000, // 30 sekunder timeout (ökat från 15)
    maximumAge = 0, // Alltid hämta färsk position
    minAccuracy = 100 // Varna om sämre än 100m
  } = options

  const [state, setState] = useState<GpsState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    warning: null,
    timestamp: null,
    positionType: null
  })

  const watchIdRef = useRef<number | null>(null)
  const bestPositionRef = useRef<GeolocationPosition | null>(null)

  /**
   * Avgör positionstyp baserat på noggrannhet
   */
  const getPositionType = (accuracy: number): 'gps' | 'network' | 'unknown' => {
    if (accuracy <= ACCURACY_THRESHOLDS.GOOD) return 'gps'
    if (accuracy <= ACCURACY_THRESHOLDS.POOR) return 'network'
    return 'unknown'
  }

  /**
   * Generera varning baserat på noggrannhet
   */
  const getAccuracyWarning = (accuracy: number): string | null => {
    if (accuracy > ACCURACY_THRESHOLDS.IP_BASED) {
      return 'Positionen verkar vara IP-baserad och kan vara helt fel. Vänta på GPS-signal eller kontrollera att GPS är aktiverat.'
    }
    if (accuracy > ACCURACY_THRESHOLDS.POOR) {
      return 'Låg noggrannhet. Positionen kan avvika flera hundra meter. Försök utomhus för bättre GPS-signal.'
    }
    if (accuracy > ACCURACY_THRESHOLDS.ACCEPTABLE) {
      return 'Måttlig noggrannhet. Vänta några sekunder för bättre GPS-signal.'
    }
    return null
  }

  /**
   * Fånga aktuell GPS-position med förbättrad precision
   * Försöker få bästa möjliga position inom timeout
   */
  const captureLocation = useCallback((): Promise<GpsResult> => {
    // Kontrollera om geolocation stöds
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation stöds inte i denna webbläsare'
      setState(prev => ({ ...prev, error: errorMsg }))
      return Promise.reject(new Error(errorMsg))
    }

    setState(prev => ({ ...prev, loading: true, error: null, warning: null }))
    bestPositionRef.current = null

    return new Promise<GpsResult>((resolve, reject) => {
      let resolved = false
      let timeoutId: NodeJS.Timeout

      // Använd watchPosition för att kontinuerligt förbättra positionen
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const currentAccuracy = position.coords.accuracy
          const bestAccuracy = bestPositionRef.current?.coords.accuracy ?? Infinity

          console.log('GPS-uppdatering:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: `${Math.round(currentAccuracy)}m`,
            isBetter: currentAccuracy < bestAccuracy
          })

          // Spara om det är bättre än tidigare
          if (currentAccuracy < bestAccuracy) {
            bestPositionRef.current = position

            // Uppdatera state med aktuell bästa position
            const positionType = getPositionType(currentAccuracy)
            const warning = getAccuracyWarning(currentAccuracy)

            setState(prev => ({
              ...prev,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: currentAccuracy,
              positionType,
              warning,
              timestamp: position.timestamp
            }))
          }

          // Om vi har tillräckligt bra noggrannhet, avsluta direkt
          if (currentAccuracy <= ACCURACY_THRESHOLDS.GOOD && !resolved) {
            resolved = true
            clearTimeout(timeoutId)
            navigator.geolocation.clearWatch(watchId)

            setState(prev => ({ ...prev, loading: false }))

            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: currentAccuracy
            })
          }
        },
        (error) => {
          if (resolved) return

          let errorMessage = 'Kunde inte hämta position'

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Åtkomst till plats nekad. Aktivera platsbehörighet i webbläsaren.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Platsinformation ej tillgänglig. Kontrollera att GPS är aktiverad.'
              break
            case error.TIMEOUT:
              errorMessage = 'Timeout vid hämtning av plats. Försök igen på en plats med bättre GPS-mottagning.'
              break
          }

          console.error('GPS-fel:', errorMessage, error)

          // Om vi har en position (även dålig), använd den
          if (bestPositionRef.current) {
            resolved = true
            clearTimeout(timeoutId)
            navigator.geolocation.clearWatch(watchId)

            const pos = bestPositionRef.current
            setState(prev => ({
              ...prev,
              loading: false,
              warning: getAccuracyWarning(pos.coords.accuracy)
            }))

            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            })
          } else {
            resolved = true
            clearTimeout(timeoutId)
            navigator.geolocation.clearWatch(watchId)

            setState(prev => ({
              ...prev,
              loading: false,
              error: errorMessage
            }))

            reject(new Error(errorMessage))
          }
        },
        {
          enableHighAccuracy: true, // Alltid försök med hög noggrannhet först
          timeout: timeout,
          maximumAge: 0 // Aldrig cachad position
        }
      )

      watchIdRef.current = watchId

      // Timeout - returnera bästa tillgängliga position
      timeoutId = setTimeout(() => {
        if (resolved) return
        resolved = true
        navigator.geolocation.clearWatch(watchId)

        if (bestPositionRef.current) {
          const pos = bestPositionRef.current
          const positionType = getPositionType(pos.coords.accuracy)
          const warning = getAccuracyWarning(pos.coords.accuracy)

          setState(prev => ({
            ...prev,
            loading: false,
            positionType,
            warning
          }))

          console.log('GPS timeout - använder bästa position:', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: `${Math.round(pos.coords.accuracy)}m`
          })

          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          })
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Kunde inte få GPS-position. Kontrollera att GPS är aktiverat och att du har godkänt platsbehörighet.'
          }))

          reject(new Error('Timeout utan position'))
        }
      }, timeout)
    })
  }, [timeout])

  /**
   * Stoppa pågående GPS-bevakning
   */
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  /**
   * Rensa sparad position
   */
  const clearLocation = useCallback(() => {
    stopWatching()
    setState({
      latitude: null,
      longitude: null,
      accuracy: null,
      loading: false,
      error: null,
      warning: null,
      timestamp: null,
      positionType: null
    })
    bestPositionRef.current = null
  }, [stopWatching])

  /**
   * Rensa endast felmeddelande
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  /**
   * Rensa varning
   */
  const clearWarning = useCallback(() => {
    setState(prev => ({ ...prev, warning: null }))
  }, [])

  /**
   * Manuellt sätt koordinater (för testning eller manuell inmatning)
   */
  const setManualLocation = useCallback((latitude: number, longitude: number) => {
    setState({
      latitude,
      longitude,
      accuracy: null, // Ingen accuracy vid manuell inmatning
      loading: false,
      error: null,
      warning: null,
      timestamp: Date.now(),
      positionType: null
    })
  }, [])

  /**
   * Beräkna kvalitetsindikator för position
   */
  const getAccuracyLevel = (): 'excellent' | 'good' | 'acceptable' | 'poor' | 'unknown' | null => {
    if (!state.accuracy) return null
    if (state.accuracy <= ACCURACY_THRESHOLDS.EXCELLENT) return 'excellent'
    if (state.accuracy <= ACCURACY_THRESHOLDS.GOOD) return 'good'
    if (state.accuracy <= ACCURACY_THRESHOLDS.ACCEPTABLE) return 'acceptable'
    return 'poor'
  }

  return {
    // State
    latitude: state.latitude,
    longitude: state.longitude,
    accuracy: state.accuracy,
    loading: state.loading,
    error: state.error,
    warning: state.warning,
    timestamp: state.timestamp,
    positionType: state.positionType,

    // Computed
    hasLocation: state.latitude !== null && state.longitude !== null,
    accuracyLevel: getAccuracyLevel(),
    isHighAccuracy: state.accuracy !== null && state.accuracy <= ACCURACY_THRESHOLDS.ACCEPTABLE,

    // Formaterad accuracy
    formattedAccuracy: state.accuracy
      ? `±${Math.round(state.accuracy)}m`
      : null,

    // Actions
    captureLocation,
    clearLocation,
    clearError,
    clearWarning,
    setManualLocation,
    stopWatching
  }
}

/**
 * Kontrollera om geolocation är tillgängligt
 */
export const isGeolocationAvailable = (): boolean => {
  return 'geolocation' in navigator
}

/**
 * Kontrollera behörighetsstatus för geolocation
 */
export const checkGeolocationPermission = async (): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> => {
  if (!navigator.permissions) {
    return 'unsupported'
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state as 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unsupported'
  }
}

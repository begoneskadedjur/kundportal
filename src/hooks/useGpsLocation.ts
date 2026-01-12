// src/hooks/useGpsLocation.ts - Hook för GPS-positionshämtning
import { useState, useCallback } from 'react'

interface GpsState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  loading: boolean
  error: string | null
  timestamp: number | null
}

interface UseGpsLocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

interface GpsResult {
  latitude: number
  longitude: number
  accuracy: number
}

/**
 * Hook för att fånga GPS-position från enhetens geolocation API
 * Optimerad för mobilanvändning med hög precision
 */
export function useGpsLocation(options: UseGpsLocationOptions = {}) {
  const {
    enableHighAccuracy = true, // Hög precision för exakta placeringar
    timeout = 15000, // 15 sekunder timeout
    maximumAge = 0 // Alltid hämta färsk position
  } = options

  const [state, setState] = useState<GpsState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    timestamp: null
  })

  /**
   * Fånga aktuell GPS-position
   * Returnerar Promise med koordinater
   */
  const captureLocation = useCallback((): Promise<GpsResult> => {
    // Kontrollera om geolocation stöds
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation stöds inte i denna webbläsare'
      setState(prev => ({ ...prev, error: errorMsg }))
      return Promise.reject(new Error(errorMsg))
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    return new Promise<GpsResult>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        // Lyckad position
        (position) => {
          const newState: GpsState = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            loading: false,
            error: null,
            timestamp: position.timestamp
          }
          setState(newState)

          console.log('GPS-position hämtad:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: `${Math.round(position.coords.accuracy)}m`
          })

          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        // Fel vid positionshämtning
        (error) => {
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
          setState(prev => ({
            ...prev,
            loading: false,
            error: errorMessage
          }))

          reject(new Error(errorMessage))
        },
        // Alternativ
        {
          enableHighAccuracy,
          timeout,
          maximumAge
        }
      )
    })
  }, [enableHighAccuracy, timeout, maximumAge])

  /**
   * Rensa sparad position
   */
  const clearLocation = useCallback(() => {
    setState({
      latitude: null,
      longitude: null,
      accuracy: null,
      loading: false,
      error: null,
      timestamp: null
    })
  }, [])

  /**
   * Rensa endast felmeddelande
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
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
      timestamp: Date.now()
    })
  }, [])

  return {
    // State
    latitude: state.latitude,
    longitude: state.longitude,
    accuracy: state.accuracy,
    loading: state.loading,
    error: state.error,
    timestamp: state.timestamp,

    // Computed
    hasLocation: state.latitude !== null && state.longitude !== null,

    // Formaterad accuracy
    formattedAccuracy: state.accuracy
      ? `±${Math.round(state.accuracy)}m`
      : null,

    // Actions
    captureLocation,
    clearLocation,
    clearError,
    setManualLocation
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

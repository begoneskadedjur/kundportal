// src/services/geocoding.ts
// Google Maps Geocoding Service för ClickUp Location Fields

export interface GeocodeResult {
  location: {
    lat: number
    lng: number
  }
  formatted_address: string
  place_id: string
}

export interface GeocodingError {
  success: false
  error: string
  originalAddress: string
}

export interface GeocodingSuccess {
  success: true
  result: GeocodeResult
  originalAddress: string
}

export type GeocodingResponse = GeocodingSuccess | GeocodingError

// Cache för att undvika onödiga API-anrop
const geocodeCache = new Map<string, GeocodeResult>()

/**
 * Geocoda en adress till koordinater med Google Maps API
 * Använder specifik VITE_GOOGLE_GEOCODING API-nyckel
 */
export async function geocodeAddress(address: string): Promise<GeocodingResponse> {
  if (!address || address.trim() === '') {
    return {
      success: false,
      error: 'Tom adress angiven',
      originalAddress: address
    }
  }

  const normalizedAddress = address.trim().toLowerCase()
  
  // Kontrollera cache först
  if (geocodeCache.has(normalizedAddress)) {
    const cachedResult = geocodeCache.get(normalizedAddress)!
    return {
      success: true,
      result: cachedResult,
      originalAddress: address
    }
  }

  try {
    // Använd specifik geocoding API-nyckel
    // I browser context används VITE_, i server context används vanlig env var
    const apiKey = typeof window !== 'undefined' 
      ? import.meta.env.VITE_GOOGLE_GEOCODING 
      : process.env.GOOGLE_GEOCODING
    
    if (!apiKey) {
      console.warn('[Geocoding] Google Geocoding API key missing. Add VITE_GOOGLE_GEOCODING to environment variables.')
      return {
        success: false,
        error: 'Google Geocoding API-nyckel saknas. Lägg till VITE_GOOGLE_GEOCODING i miljövariabler.',
        originalAddress: address
      }
    }

    const encodedAddress = encodeURIComponent(address)
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&language=sv&region=se`

    console.log(`[Geocoding] Geocoding address: "${address}"`)
    
    const response = await fetch(geocodeUrl)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.status === 'ZERO_RESULTS') {
      return {
        success: false,
        error: 'Ingen adress hittades för den angivna texten',
        originalAddress: address
      }
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      return {
        success: false,
        error: 'Google Maps API kvot överskrides - försök senare',
        originalAddress: address
      }
    }

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return {
        success: false,
        error: `Google Maps API fel: ${data.status} - ${data.error_message || 'Okänt fel'}`,
        originalAddress: address
      }
    }

    const result = data.results[0]
    const geocodeResult: GeocodeResult = {
      location: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      },
      formatted_address: result.formatted_address,
      place_id: result.place_id
    }

    // Spara i cache
    geocodeCache.set(normalizedAddress, geocodeResult)

    console.log(`[Geocoding] Success: "${address}" -> ${geocodeResult.location.lat}, ${geocodeResult.location.lng}`)

    return {
      success: true,
      result: geocodeResult,
      originalAddress: address
    }

  } catch (error) {
    console.error('[Geocoding] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel vid geocoding',
      originalAddress: address
    }
  }
}

/**
 * Sök adresser med Google Geocoding - returnerar flera resultat för val
 * Används av MapLocationPicker för interaktiv adressökning
 */
export async function searchAddresses(query: string, maxResults = 5): Promise<{
  success: boolean
  results: GeocodeResult[]
  error?: string
}> {
  if (!query || query.trim() === '') {
    return { success: false, results: [], error: 'Tom sökning' }
  }

  try {
    const apiKey = typeof window !== 'undefined'
      ? import.meta.env.VITE_GOOGLE_GEOCODING
      : process.env.GOOGLE_GEOCODING

    if (!apiKey) {
      return { success: false, results: [], error: 'Google Geocoding API-nyckel saknas' }
    }

    const encodedQuery = encodeURIComponent(query)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${apiKey}&language=sv&region=se`

    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()

    if (data.status === 'ZERO_RESULTS') {
      return { success: false, results: [], error: 'Ingen adress hittades' }
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return { success: false, results: [], error: data.error_message || 'Sökningen misslyckades' }
    }

    const results: GeocodeResult[] = data.results.slice(0, maxResults).map((r: any) => ({
      location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
      formatted_address: r.formatted_address,
      place_id: r.place_id
    }))

    return { success: true, results }
  } catch (error) {
    return { success: false, results: [], error: error instanceof Error ? error.message : 'Sökfel' }
  }
}

/**
 * Batch geocoding för flera adresser samtidigt
 * Använder Promise.allSettled för att hantera partiella fel
 */
export async function geocodeAddresses(addresses: string[]): Promise<GeocodingResponse[]> {
  if (addresses.length === 0) {
    return []
  }

  console.log(`[Geocoding] Batch geocoding ${addresses.length} addresses`)

  const promises = addresses.map(address => geocodeAddress(address))
  const results = await Promise.allSettled(promises)

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        success: false,
        error: `Promise rejected: ${result.reason}`,
        originalAddress: addresses[index]
      }
    }
  })
}

/**
 * Hjälpfunktion för att kontrollera om en adress redan är geocodad
 * (har koordinater i ClickUp format)
 */
export function isAddressGeocoded(address: any): boolean {
  if (!address) return false
  
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address)
      return isValidGeocodedAddress(parsed)
    } catch {
      return false
    }
  }

  return isValidGeocodedAddress(address)
}

/**
 * Validera att en adress har korrekt ClickUp location format
 */
function isValidGeocodedAddress(address: any): boolean {
  return (
    address &&
    typeof address === 'object' &&
    address.location &&
    typeof address.location.lat === 'number' &&
    typeof address.location.lng === 'number' &&
    typeof address.formatted_address === 'string' &&
    address.formatted_address.trim() !== ''
  )
}

/**
 * Rensa geocoding cache (för utveckling/debugging)
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear()
  console.log('[Geocoding] Cache cleared')
}

/**
 * Hämta cache-statistik
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: geocodeCache.size,
    keys: Array.from(geocodeCache.keys())
  }
}
// src/services/restidService.ts
// Restid till nästa stopp i nya arbetsvyn.
//
// Position: i första hand teknikerns egen bil via Abax (api/technician/my-vehicle-location,
// som bara svarar med den inloggades bil). I andra hand telefonens position, när bilen saknar
// Abax-ID, Abax inte svarar eller bilens position är för gammal. En parkerad bil rapporterar
// sällan, så dess senaste position gäller i upp till ett dygn; en bil som står som "i rörelse"
// men inte rapporterat på 30 minuter räknas som inaktuell (till exempel en enhet som slutat
// sända). Går telefonen inte heller att läsa används bilpositionen om den är högst ett dygn
// gammal, och källraden visar då hur gammal den är.
//
// Restid: Google Maps DistanceMatrixService i webbläsaren, bil med trafik just nu.
// Allt fel hanteras tyst: går det inte att räkna returneras null och inget visas.

import { apiFetch } from '../lib/api'

export type LatLng = { lat: number; lng: number }

export interface MinPosition extends LatLng {
  kalla: 'bil' | 'telefon'
  /** När positionen registrerades */
  tidpunkt: Date
  /** Bara bil: Abax säger att bilen står still */
  parkerad?: boolean
}

export interface Restid {
  minuter: number
  km: number
}

type BilSvar =
  | { kalla: 'abax'; lat: number; lng: number; tidpunkt: string | null; iRorelse: boolean; hastighet: number }
  | { kalla: null; skal: 'inget_fordon' | 'abax_fel' }

const BIL_MAX_ALDER_MS = 30 * 60_000
const PARKERAD_BIL_MAX_ALDER_MS = 24 * 60 * 60_000
const TELEFON_TIMEOUT_MS = 8_000
const POSITION_CACHE_MS = 60_000
const RESTID_CACHE_MS = 4 * 60_000

// ---------- Position ----------

let positionCache: { varde: MinPosition | null; hamtad: number } | null = null
let positionPagar: Promise<MinPosition | null> | null = null

async function hamtaBilPosition(): Promise<MinPosition | null> {
  try {
    const res = await apiFetch('/api/technician/my-vehicle-location', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as BilSvar
    if (data.kalla !== 'abax' || typeof data.lat !== 'number' || typeof data.lng !== 'number') return null
    const tid = data.tidpunkt ? new Date(data.tidpunkt) : null
    return {
      lat: data.lat,
      lng: data.lng,
      kalla: 'bil',
      // Saknas tidpunkt räknas positionen som gammal, så att telefonen får gå före
      tidpunkt: tid && !Number.isNaN(tid.getTime()) ? tid : new Date(0),
      parkerad: data.iRorelse === false,
    }
  } catch {
    return null
  }
}

function hamtaTelefonPosition(): Promise<MinPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise(resolve => {
    let klar = false
    const avsluta = (v: MinPosition | null) => { if (!klar) { klar = true; resolve(v) } }
    // Egen timer utöver geolocations timeout, eftersom väntan på tillståndsfrågan inte räknas där
    const timer = window.setTimeout(() => avsluta(null), TELEFON_TIMEOUT_MS)
    try {
      navigator.geolocation.getCurrentPosition(
        pos => {
          window.clearTimeout(timer)
          avsluta({ lat: pos.coords.latitude, lng: pos.coords.longitude, kalla: 'telefon', tidpunkt: new Date(pos.timestamp || Date.now()) })
        },
        () => { window.clearTimeout(timer); avsluta(null) },
        { enableHighAccuracy: true, timeout: TELEFON_TIMEOUT_MS, maximumAge: 60_000 },
      )
    } catch {
      window.clearTimeout(timer)
      avsluta(null)
    }
  })
}

async function lasPosition(): Promise<MinPosition | null> {
  const bil = await hamtaBilPosition()
  const bilAlder = bil ? Date.now() - bil.tidpunkt.getTime() : Infinity
  if (bil && (bilAlder <= BIL_MAX_ALDER_MS || (bil.parkerad && bilAlder <= PARKERAD_BIL_MAX_ALDER_MS))) return bil
  const telefon = await hamtaTelefonPosition()
  if (telefon) return telefon
  // Hellre en äldre bilposition med tiden utskriven än ingenting
  return bil && bil.tidpunkt.getTime() > 0 && bilAlder <= PARKERAD_BIL_MAX_ALDER_MS ? bil : null
}

/**
 * Teknikerns position, bilen först och telefonen som reserv. Sparas en minut i minnet
 * så att Idag och Karta delar samma läsning. tvinga = läs om direkt (Min position).
 */
export function hamtaMinPosition(tvinga = false): Promise<MinPosition | null> {
  if (!tvinga && positionCache && Date.now() - positionCache.hamtad < POSITION_CACHE_MS) {
    return Promise.resolve(positionCache.varde)
  }
  if (positionPagar) return positionPagar
  positionPagar = lasPosition()
    .then(varde => {
      positionCache = { varde, hamtad: Date.now() }
      return varde
    })
    .catch(() => null)
    .finally(() => { positionPagar = null })
  return positionPagar
}

/** Senast lästa position utan att fråga igen, för att rita direkt när en sida öppnas */
export function senastePosition(): MinPosition | null {
  return positionCache?.varde ?? null
}

// ---------- Restid ----------

const restidCache = new Map<string, { varde: Restid | null; hamtad: number }>()

function nyckel(fran: LatLng, till: string | LatLng): string {
  // Startpunkten avrundas till ungefär hundra meter, så att små rörelser inte räknas om
  const f = `${fran.lat.toFixed(3)},${fran.lng.toFixed(3)}`
  const t = typeof till === 'string' ? till.trim().toLowerCase() : `${till.lat.toFixed(5)},${till.lng.toFixed(5)}`
  return `${f}|${t}`
}

function fragaMatris(
  service: google.maps.DistanceMatrixService,
  fran: LatLng,
  till: string | LatLng,
  medTrafik: boolean,
): Promise<Restid | null> {
  return new Promise(resolve => {
    const req: google.maps.DistanceMatrixRequest = {
      origins: [fran],
      destinations: [till],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC,
      region: 'se',
    }
    if (medTrafik) {
      req.drivingOptions = { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS }
    }
    try {
      service.getDistanceMatrix(req, (svar, status) => {
        const el = svar?.rows?.[0]?.elements?.[0]
        if (status !== 'OK' || !el || el.status !== 'OK') {
          resolve(null)
          return
        }
        const sekunder = el.duration_in_traffic?.value ?? el.duration?.value
        const meter = el.distance?.value
        if (typeof sekunder !== 'number' || typeof meter !== 'number') {
          resolve(null)
          return
        }
        resolve({ minuter: Math.max(1, Math.round(sekunder / 60)), km: meter / 1000 })
      })
    } catch {
      resolve(null)
    }
  })
}

/**
 * Restid med bil från en position till en adress eller koordinat. Null när Google Maps inte
 * är laddat, adressen inte hittas eller tjänsten svarar med fel. Sparas fyra minuter per resa.
 */
export async function beraknaRestid(fran: LatLng, till: string | LatLng): Promise<Restid | null> {
  if (typeof till === 'string' && !till.trim()) return null
  if (typeof window === 'undefined' || !window.google?.maps?.DistanceMatrixService) return null

  const k = nyckel(fran, till)
  const sparad = restidCache.get(k)
  if (sparad && Date.now() - sparad.hamtad < RESTID_CACHE_MS) return sparad.varde

  const service = new google.maps.DistanceMatrixService()
  // Trafikuppgifter kan nekas beroende på nyckelns plan, försök då utan
  const varde = (await fragaMatris(service, fran, till, true)) ?? (await fragaMatris(service, fran, till, false))
  restidCache.set(k, { varde, hamtad: Date.now() })
  return varde
}

// ---------- Text ----------

/** "Ca 12 min med bil härifrån, 8,4 km" */
export function restidText(r: Restid): string {
  const tid = r.minuter < 60
    ? `${r.minuter} min`
    : `${Math.floor(r.minuter / 60)} h${r.minuter % 60 ? ` ${r.minuter % 60} min` : ''}`
  const km = r.km < 10 ? r.km.toFixed(1).replace('.', ',') : String(Math.round(r.km))
  return `Ca ${tid} med bil härifrån, ${km} km`
}

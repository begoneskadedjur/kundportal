// src/services/geokodService.ts
// Geokodning av adresser i webbläsaren för nya arbetsvyn (Karta och Schema).
//
// Ärenden och kunder har inga sparade koordinater (address-fälten är bara text), så
// adresserna geokodas med Google Geocoder och sparas i minnet under sessionen.
// Kartan och schemat delar samma minne, så en adress slås bara upp en gång.

export type LatLng = { lat: number; lng: number }

/** Geokodade adresser under sessionen. null = går inte att hitta, försök inte igen. */
export const geoCache = new Map<string, LatLng | null>()

export function geokoda(geocoder: google.maps.Geocoder, adress: string): Promise<LatLng | null> {
  if (geoCache.has(adress)) return Promise.resolve(geoCache.get(adress) ?? null)
  return new Promise(resolve => {
    geocoder.geocode({ address: adress, region: 'se' }, (res, status) => {
      if (status === 'OK' && res && res[0]) {
        const l = res[0].geometry.location
        const p = { lat: l.lat(), lng: l.lng() }
        geoCache.set(adress, p)
        resolve(p)
      } else {
        // OVER_QUERY_LIMIT sparas inte, så det går att försöka igen senare
        if (status !== 'OVER_QUERY_LIMIT') geoCache.set(adress, null)
        resolve(null)
      }
    })
  })
}

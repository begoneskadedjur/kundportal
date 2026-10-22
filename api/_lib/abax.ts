// api/_lib/abax.ts - Delade Abax-anrop (token och fordonspositioner)
// Samma anrop som api/technician-locations.ts gör. Den filen är orörd och har kvar
// sina egna kopior; den här modulen används av api/technician/my-vehicle-location.ts.
// Loggar aldrig nyckel, hemlighet eller token.

const ABAX_TOKEN_URL = 'https://identity.abax.cloud/connect/token'
const ABAX_LOCATIONS_URL = 'https://api.abax.cloud/v1/vehicles/locations'
const USER_AGENT = 'BeGone-Kundportal/1.0'

export interface AbaxFordonsposition {
  vehicleId: string
  lat: number
  lng: number
  /** ISO-tidpunkt från Abax när positionen registrerades */
  tidpunkt: string
  iRorelse: boolean
  /** km/h enligt Abax, 0 om uppgiften saknas */
  hastighet: number
}

/** Hämtar en åtkomsttoken med client credentials. Kastar vid fel. */
export async function getAbaxToken(): Promise<string> {
  const clientId = process.env.ABAX_CLIENT_ID
  const clientSecret = process.env.ABAX_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Abax-uppgifter saknas i miljön')

  const response = await fetch(ABAX_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'open_api open_api.vehicles',
    }),
  })

  if (!response.ok) {
    // Svarstexten kan innehålla detaljer om klienten, logga bara statusen
    throw new Error(`Abax-inloggningen misslyckades (${response.status})`)
  }

  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Abax svarade utan token')
  return data.access_token
}

/** Hämtar positioner för de angivna fordonen. Tom lista vid fel i Abax. */
export async function getAbaxVehicleLocations(token: string, vehicleIds: string[]): Promise<AbaxFordonsposition[]> {
  if (vehicleIds.length === 0) return []

  const response = await fetch(ABAX_LOCATIONS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: vehicleIds }),
  })

  if (!response.ok) {
    console.error('[abax] positionsanropet misslyckades', response.status)
    return []
  }

  const data = await response.json() as {
    items?: Array<{
      id: string
      location?: {
        latitude?: number
        longitude?: number
        speed?: number
        in_movement?: boolean
        timestamp?: string
      }
    }>
  }

  const ut: AbaxFordonsposition[] = []
  for (const item of data.items ?? []) {
    const l = item.location
    if (!l || typeof l.latitude !== 'number' || typeof l.longitude !== 'number') continue
    ut.push({
      vehicleId: item.id,
      lat: l.latitude,
      lng: l.longitude,
      tidpunkt: l.timestamp ?? '',
      iRorelse: l.in_movement === true,
      hastighet: typeof l.speed === 'number' ? l.speed : 0,
    })
  }
  return ut
}

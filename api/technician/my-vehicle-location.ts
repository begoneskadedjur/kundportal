// api/technician/my-vehicle-location.ts - Position för den inloggade teknikerns egen bil
// Används av nya arbetsvyn (restid till nästa stopp och bilmarkören på kartan).
//
// Behörighet: fordonet slås ALLTID upp via den inloggade användarens profiles.technician_id.
// Endpointen tar inga parametrar, så det går inte att fråga efter någon annans bil.
// Koordinatorns karta använder fortfarande api/technician-locations.ts.
//
// Svar (alltid 200 när anroparen är behörig):
//   { kalla: 'abax', lat, lng, tidpunkt, iRorelse, hastighet }
//   { kalla: null, skal: 'inget_fordon' }  ingen technician_id eller inget abax_vehicle_id
//   { kalla: null, skal: 'abax_fel' }      Abax svarade inte eller saknade position

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../_lib/auth'
import { getAbaxToken, getAbaxVehicleLocations } from '../_lib/abax'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Endast GET är tillåtet' })
  }

  // admin finns med eftersom en admin kan växla till teknikervyn med egen technician_id
  const auth = await requireAuth(req, res, ['technician', 'admin', 'koordinator'])
  if (!auth) return

  try {
    const { data: profil, error: profilFel } = await supabase
      .from('profiles')
      .select('technician_id')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (profilFel) {
      console.error('[my-vehicle-location] profilen kunde inte läsas', profilFel.message)
      return res.status(200).json({ kalla: null, skal: 'abax_fel' })
    }

    const technicianId = (profil?.technician_id as string | null | undefined) ?? null
    if (!technicianId) {
      return res.status(200).json({ kalla: null, skal: 'inget_fordon' })
    }

    const { data: tekniker, error: tekFel } = await supabase
      .from('technicians')
      .select('abax_vehicle_id')
      .eq('id', technicianId)
      .maybeSingle()

    if (tekFel) {
      console.error('[my-vehicle-location] teknikern kunde inte läsas', tekFel.message)
      return res.status(200).json({ kalla: null, skal: 'abax_fel' })
    }

    const vehicleId = ((tekniker?.abax_vehicle_id as string | null | undefined) ?? '').trim()
    if (!vehicleId) {
      return res.status(200).json({ kalla: null, skal: 'inget_fordon' })
    }

    const token = await getAbaxToken()
    const positioner = await getAbaxVehicleLocations(token, [vehicleId])
    const pos = positioner.find(p => p.vehicleId === vehicleId) ?? positioner[0]

    if (!pos) {
      return res.status(200).json({ kalla: null, skal: 'abax_fel' })
    }

    return res.status(200).json({
      kalla: 'abax',
      lat: pos.lat,
      lng: pos.lng,
      tidpunkt: pos.tidpunkt || null,
      iRorelse: pos.iRorelse,
      hastighet: pos.hastighet,
    })
  } catch (e) {
    console.error('[my-vehicle-location] fel', e instanceof Error ? e.message : 'okänt fel')
    return res.status(200).json({ kalla: null, skal: 'abax_fel' })
  }
}

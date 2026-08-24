// src/services/caseRoomService.ts
// Rum per ärende som riktiga datapunkter (case_rooms) för per rum-statistik.
// cases.room_number behålls som synkad visningssträng ("105, 107") så alla
// visningsytor (kundportal, PDF-rapporter) fungerar oförändrat. Denna service
// är ENDA skrivvägen — den håller rader och sträng i synk.

import { supabase } from '../lib/supabase'

export const MAX_ROOMS_PER_CASE = 3

/** Normalisera: trimma, ta bort tomma och dubbletter, max 3 */
export function normalizeRooms(rooms: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rooms) {
    const v = r.trim()
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
    if (out.length >= MAX_ROOMS_PER_CASE) break
  }
  return out
}

export function roomsToString(rooms: string[]): string | null {
  const n = normalizeRooms(rooms)
  return n.length > 0 ? n.join(', ') : null
}

export function roomsFromString(value: string | null | undefined): string[] {
  if (!value) return []
  return normalizeRooms(value.split(','))
}

export class CaseRoomService {
  /** Ersätt ärendets rumsrader och synka visningssträngen. Icke-fatal för anroparen. */
  static async syncFromString(
    caseId: string,
    customerId: string | null,
    roomString: string | null | undefined
  ): Promise<void> {
    try {
      const rooms = roomsFromString(roomString)
      await supabase.from('case_rooms').delete().eq('case_id', caseId)
      if (rooms.length > 0) {
        await supabase.from('case_rooms').insert(
          rooms.map((room, i) => ({
            case_id: caseId,
            customer_id: customerId,
            room_number: room,
            position: i + 1,
          }))
        )
      }
      await supabase.from('cases').update({ room_number: roomsToString(rooms) }).eq('id', caseId)
    } catch (err) {
      console.error('Kunde inte synka ärendets rum:', err)
    }
  }
}

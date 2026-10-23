// src/components/technician/ny/utrustning/useSenasteKontroller.ts
// Senaste kontrolldatum per station för kolumnen Senaste kontroll i kundens
// lista (NyKundStationer, fliken Lista). Läser bara station_id och
// inspected_at ur outdoor_station_inspections och indoor_station_inspections,
// samma tabeller som getOutdoorInspectionsByStation och
// IndoorStationService.getInspectionsByStation läser per station.
//
// Stationerna frågas i omgångar om 150 så att URL:en inte blir för lång hos
// kunder med hundratals stationer. Svaret är sorterat nyast först, så första
// raden per station är den senaste. Hämtas bara när listan visas.

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

const OMGANG = 150

async function senastePer(tabell: 'outdoor_station_inspections' | 'indoor_station_inspections', ids: string[]): Promise<Map<string, string>> {
  const ut = new Map<string, string>()
  for (let i = 0; i < ids.length; i += OMGANG) {
    const del = ids.slice(i, i + OMGANG)
    const { data, error } = await supabase
      .from(tabell)
      .select('station_id, inspected_at')
      .in('station_id', del)
      .order('inspected_at', { ascending: false })
    if (error) throw error
    for (const r of (data ?? []) as { station_id: string; inspected_at: string }[]) {
      if (!ut.has(r.station_id)) ut.set(r.station_id, r.inspected_at)
    }
  }
  return ut
}

export function useSenasteKontroller(uteIds: string[], inneIds: string[], aktiv: boolean): Map<string, string> {
  const [senaste, setSenaste] = useState<Map<string, string>>(new Map())
  const uteNyckel = uteIds.join(',')
  const inneNyckel = inneIds.join(',')

  useEffect(() => {
    if (!aktiv) return
    let avbruten = false
    const ute = uteNyckel ? uteNyckel.split(',') : []
    const inne = inneNyckel ? inneNyckel.split(',') : []
    Promise.all([senastePer('outdoor_station_inspections', ute), senastePer('indoor_station_inspections', inne)])
      .then(([u, i]) => {
        if (avbruten) return
        const m = new Map(u)
        i.forEach((v, k) => m.set(k, v))
        setSenaste(m)
      })
      .catch(e => console.error('Kunde inte hämta senaste kontrollerna:', e))
    return () => { avbruten = true }
  }, [uteNyckel, inneNyckel, aktiv])

  return senaste
}

// src/shared/stationNumbering.ts
// En regel för stationsnummer, delad av portalen och rapporterna:
// aktiva stationer numreras från 1, äldst först (placed_at, sedan id).
// Utomhus är en serie, varje planritning är en egen serie som börjar om på 1.
// Borttagna stationer får inget nummer, så att numren inte förskjuts när en
// station tas bort i en vy men inte i en annan.

export interface NumberableStation {
  id: string
  placed_at: string | null
  status?: string | null
}

export function numberStations(stations: NumberableStation[]): Map<string, number> {
  const active = stations.filter((s) => s.status !== 'removed')
  active.sort((a, b) => {
    const ta = a.placed_at ? new Date(a.placed_at).getTime() : 0
    const tb = b.placed_at ? new Date(b.placed_at).getTime() : 0
    return ta - tb || a.id.localeCompare(b.id)
  })
  return new Map(active.map((s, i) => [s.id, i + 1]))
}

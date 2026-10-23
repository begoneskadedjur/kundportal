// src/components/technician/ny/utrustning/useKontrollData.ts
// Kontrollerna för Stationer i nya arbetsvyn, hämtade en gång för hela sidan
// och delade mellan Att göra, kundtabellen (Nästa kontroll, Inget schema) och
// fliken Kontroller. Samma två anrop som gamla InspectionOverviewTab gör:
//   TechnicianEquipmentService.getInspectionOverview      bokade kontroller + utförda i månaden
//   TechnicianEquipmentService.getActiveScheduleCustomerIds vilka kunder som har aktivt schema
// Horisonten är längre än i gamla fliken (60 dagar) så att Nästa kontroll finns
// även för kunder med kvartals-, halvårs- och årsschema.
//
// Grupperingen räknas i svensk kalenderdag (svenskDag), aldrig på rå ISO-sträng.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays } from 'date-fns'
import toast from 'react-hot-toast'
import { TechnicianEquipmentService, type BookedInspection } from '../../../../services/technicianEquipmentService'
import { svenskDag, veckansSlut } from '../../../../services/teknikerDagService'

const HORISONT_DAGAR = 400

export interface KontrollPerKund {
  /** Nästa bokade kontroll som inte är försenad */
  nasta: BookedInspection | null
  /** Äldsta försenade kontrollen */
  forsenad: BookedInspection | null
}

export interface KontrollGrupper {
  forsenade: BookedInspection[]
  idag: BookedInspection[]
  veckan: BookedInspection[]
  manaden: BookedInspection[]
  /** Kvar i månaden, försenade inte medräknade (som gamla fliken) */
  kvarIManaden: number
}

export function useKontrollData(technicianId: string, kundIds: string[]) {
  const [oppna, setOppna] = useState<BookedInspection[]>([])
  const [utfordaManad, setUtfordaManad] = useState(0)
  const [medSchema, setMedSchema] = useState<Set<string> | null>(null)
  const [laddar, setLaddar] = useState(true)

  // Stabil nyckel så att en ny array med samma kunder inte hämtar om
  const idNyckel = useMemo(() => [...kundIds].sort().join(','), [kundIds])

  const laddaBokningar = useCallback(async () => {
    if (!technicianId) { setLaddar(false); return }
    try {
      const overview = await TechnicianEquipmentService.getInspectionOverview(technicianId, addDays(new Date(), HORISONT_DAGAR))
      setOppna(overview.open)
      setUtfordaManad(overview.completedThisMonth)
    } catch (e) {
      console.error('Fel vid hämtning av kontroller:', e)
      toast.error('Kunde inte hämta kontroller')
    } finally {
      setLaddar(false)
    }
  }, [technicianId])

  const laddaScheman = useCallback(async () => {
    const ids = idNyckel ? idNyckel.split(',') : []
    if (ids.length === 0) { setMedSchema(new Set()); return }
    setMedSchema(await TechnicianEquipmentService.getActiveScheduleCustomerIds(ids))
  }, [idNyckel])

  useEffect(() => { void laddaBokningar() }, [laddaBokningar])
  useEffect(() => { void laddaScheman() }, [laddaScheman])

  const ladda = useCallback(async () => {
    await Promise.all([laddaBokningar(), laddaScheman()])
  }, [laddaBokningar, laddaScheman])

  const grupper = useMemo<KontrollGrupper>(() => {
    const idag = svenskDag()
    const veckaSlut = veckansSlut(idag)
    const manad = idag.slice(0, 7)
    const forsenade: BookedInspection[] = []
    const idagLista: BookedInspection[] = []
    const veckan: BookedInspection[] = []
    const manaden: BookedInspection[] = []
    let kvarIManaden = 0
    for (const i of oppna) {
      if (i.isOverdue) { forsenade.push(i); continue }
      const dag = svenskDag(new Date(i.scheduled_at))
      if (dag.slice(0, 7) === manad) kvarIManaden++
      // Pågående från en tidigare dag räknas till idag, den ska göras klart
      if (dag <= idag) idagLista.push(i)
      else if (dag <= veckaSlut) veckan.push(i)
      else if (dag.slice(0, 7) === manad) manaden.push(i)
    }
    // Äldst först
    forsenade.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    return { forsenade, idag: idagLista, veckan, manaden, kvarIManaden }
  }, [oppna])

  const perKund = useMemo(() => {
    const m = new Map<string, KontrollPerKund>()
    // oppna är sorterad stigande på scheduled_at, så första träffen är tidigast
    for (const i of oppna) {
      const rad = m.get(i.customer_id) ?? { nasta: null, forsenad: null }
      if (i.isOverdue) { if (!rad.forsenad) rad.forsenad = i }
      else if (!rad.nasta) rad.nasta = i
      m.set(i.customer_id, rad)
    }
    return m
  }, [oppna])

  return { oppna, utfordaManad, medSchema, laddar, ladda, grupper, perKund }
}

export type KontrollData = ReturnType<typeof useKontrollData>

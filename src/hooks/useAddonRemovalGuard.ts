// src/hooks/useAddonRemovalGuard.ts
// Varning när någon tar bort en tilläggsstation som redan är betald framåt.
//
// Christians regel (2026-09-30): ingen blockering och inga krediteringar.
// Är stationen betald till och med ett datum visas det, och borttagsknappen
// kräver ett andra klick ("Klicka igen för att ta bort"). Andra klicket tar
// bort som vanligt. Gäller per år och per månad, tillägg utöver avtalet.
//
// Två lägen, båda med AddonRemovalNotice bredvid knappen:
// - Formulärläge: useAddonRemovalGuard(station, removing). `removing` är sant
//   när användaren har valt Borttagen/Radera. Andra klick krävs bara när
//   stationen är betald framåt.
// - Knappläge: useAddonRemovalGuard(station). För en ren Ta bort-knapp.
//   Första klicket hämtar underlaget och spänner knappen, andra tar bort.
//
// onClick: if (!guard.confirm()) return; ...ta bort som vanligt

import { useCallback, useEffect, useState } from 'react'
import { AddonStationBillingService } from '../services/addonStationBillingService'
import type { AddonPaidThrough } from '../types/addonStations'

export interface AddonGuardStation {
  id: string
  /** true = inomhusstation (indoor_stations), false = utomhus (equipment_placements) */
  indoor: boolean
  is_addon?: boolean | null
  addon_billing_model?: string | null
  addon_contract_mode?: string | null
}

export interface AddonRemovalGuard {
  info: AddonPaidThrough | null
  loading: boolean
  /** Första klicket är gjort, nästa klick tar bort */
  armed: boolean
  /**
   * Anropas från borttagsknappen. Returnerar true när borttaget får göras,
   * false när klicket bara spände knappen.
   */
  confirm: () => boolean
  /** Knapptext: byts till "Klicka igen för att ta bort" när knappen är spänd */
  label: (defaultLabel: string) => string
  reset: () => void
}

/** Tilläggsstation per år eller per månad som inte är inbakad i premien. */
export function isGuardedAddonStation(
  station: Omit<AddonGuardStation, 'id' | 'indoor'> | null | undefined
): boolean {
  return !!station
    && station.is_addon === true
    && (station.addon_billing_model === 'per_year' || station.addon_billing_model === 'per_month')
    && station.addon_contract_mode !== 'included'
}

export function useAddonRemovalGuard(
  station: AddonGuardStation | null | undefined,
  removing?: boolean
): AddonRemovalGuard {
  const buttonMode = removing === undefined
  const stationId = station && isGuardedAddonStation(station) ? station.id : null
  const indoor = station?.indoor ?? false
  const [intent, setIntent] = useState(false)
  const [armedForm, setArmedForm] = useState(false)
  const [info, setInfo] = useState<AddonPaidThrough | null>(null)
  const [loading, setLoading] = useState(false)
  const active = !!stationId && (buttonMode ? intent : !!removing)

  // Ny station: börja om från första klicket
  useEffect(() => {
    setIntent(false)
  }, [stationId])

  // Hämta underlaget när ett borttag är på gång
  useEffect(() => {
    setInfo(null)
    setArmedForm(false)
    if (!stationId || !active) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    AddonStationBillingService.getPaidThrough(stationId, indoor)
      .then((res) => {
        if (!cancelled) setInfo(res)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stationId, indoor, active])

  const needsSecondClick = active && (loading || !!info?.paid_through)
  const armed = buttonMode ? active : needsSecondClick && armedForm

  const confirm = useCallback(() => {
    if (!stationId) return true
    if (buttonMode) {
      if (intent) return true
      setIntent(true)
      return false
    }
    if (!needsSecondClick || armedForm) return true
    setArmedForm(true)
    return false
  }, [stationId, buttonMode, intent, needsSecondClick, armedForm])

  const label = useCallback(
    (defaultLabel: string) => (armed ? 'Klicka igen för att ta bort' : defaultLabel),
    [armed]
  )

  const reset = useCallback(() => {
    setIntent(false)
    setArmedForm(false)
  }, [])

  return {
    info: active ? info : null,
    loading: active && loading,
    armed,
    confirm,
    label,
    reset,
  }
}

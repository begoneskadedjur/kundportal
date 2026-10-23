import { useEffect, useState } from 'react'
import { ProvisionService } from '../../../../services/provisionService'

// Provisionsgränsen (min_commission_base) för stegets sammanfattning i Klart.
// Samma regel som CommissionSection: under gränsen skapas ingen provision.

export function useProvisionsgrans(aktiv: boolean): number | null {
  const [grans, setGrans] = useState<number | null>(null)
  useEffect(() => {
    if (!aktiv) return
    ProvisionService.getSettings().then(s => setGrans(s.min_commission_base)).catch(() => {})
  }, [aktiv])
  return grans
}

/** Text när underlaget är under gränsen, annars null */
export function underProvisionsgrans(underlag: number, grans: number | null): string | null {
  if (grans === null || underlag >= grans) return null
  return `Underlaget ${underlag.toLocaleString('sv-SE')} kr exkl. moms är under gränsen för provision (${grans.toLocaleString('sv-SE')} kr), ingen provision registreras.`
}

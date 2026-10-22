// src/components/technician/ny/VyVaxel.tsx
// Väljer mellan ny och gammal vy för en route. Bara profiles.ny_arbetsvy i
// teknikervyn får `ny`, alla andra får `gammal` exakt som förut.
//
//   <Route path="dashboard" element={<VyVaxel ny={<NyIdag />} gammal={<TechnicianDashboard />} />} />

import type { ReactNode } from 'react'
import { useNyArbetsvy } from '../../../hooks/useNyArbetsvy'

export function VyVaxel({ ny, gammal }: { ny: ReactNode; gammal: ReactNode }) {
  const { aktiv } = useNyArbetsvy()
  return <>{aktiv ? ny : gammal}</>
}

export default VyVaxel

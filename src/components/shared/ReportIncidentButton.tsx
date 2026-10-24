// src/components/shared/ReportIncidentButton.tsx
// Framträdande genväg till tillbuds-/olycks-/avvikelserapportering.
// Visas i sidomenyer och mobilmenyer i alla interna portaler så att
// rapporteringen alltid är ett klick bort.

import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icon'

const INCIDENT_PATHS: Record<'admin' | 'koordinator' | 'technician' | 'säljare', string> = {
  admin: '/admin/tillbud-avvikelser',
  koordinator: '/koordinator/tillbud-avvikelser',
  technician: '/technician/tillbud-avvikelser',
  säljare: '/saljare/tillbud-avvikelser',
}

interface ReportIncidentButtonProps {
  role: 'admin' | 'koordinator' | 'technician' | 'säljare'
  /** Sidomeny i kollapsat läge (endast ikon) */
  collapsed?: boolean
  /** Anropas vid klick (t.ex. stäng mobilmeny) */
  onNavigate?: () => void
}

export function ReportIncidentButton({ role, collapsed = false, onNavigate }: ReportIncidentButtonProps) {
  const path = INCIDENT_PATHS[role]

  if (collapsed) {
    return (
      <Link
        to={path}
        onClick={onNavigate}
        title="Rapportera tillbud, avvikelse eller olycka"
        className="w-full flex items-center justify-center p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors"
      >
        <Icon name="rapport.avvikelse" size={20} className="text-amber-400" />
      </Link>
    )
  }

  return (
    <Link
      to={path}
      onClick={onNavigate}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-medium rounded-xl transition-colors text-sm text-center leading-snug"
    >
      <Icon name="rapport.avvikelse" size={20} className="flex-shrink-0" />
      Rapportera tillbud, avvikelse eller olycka
    </Link>
  )
}

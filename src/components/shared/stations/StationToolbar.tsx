// src/components/shared/stations/StationToolbar.tsx
// Verktygsraden under stationens rubrik: ikonknappar med kort etikett under
// (Flytta, Byt typ, Historik, Hämta upp). Skissen "Efter: stationsmodalen".
// En knapp som utelämnas eller har visible=false visas inte, och raden delar
// bredden på de som syns. Historik och Hämta upp är växlar (aria-pressed).

import { Icon, type IconName } from '../../icons/Icon'

export interface StationToolbarButton {
  onClick: () => void
  /** false döljer knappen. Standard true. */
  visible?: boolean
  /** Växelns läge. Sätts den (true/false) får knappen aria-pressed. */
  active?: boolean
  disabled?: boolean
  /** Kort förklaring när knappen är avstängd (title och skärmläsartext) */
  disabledReason?: string
}

export interface StationToolbarProps {
  move?: StationToolbarButton
  changeType?: StationToolbarButton
  history?: StationToolbarButton
  pickUp?: StationToolbarButton
  /** Etiketter under ikonerna. Standard true. */
  showLabels?: boolean
  className?: string
}

type Tone = 'brand' | 'violet'

interface Spec {
  key: string
  icon: IconName
  label: string
  ariaLabel: string
  tone: Tone
  button?: StationToolbarButton
}

const ACTIVE_CLASSES: Record<Tone, string> = {
  brand: 'border-[#20c58f]/60 bg-[#20c58f]/10 text-[#20c58f]',
  violet: 'border-violet-500 bg-violet-500/15 text-violet-300',
}

export default function StationToolbar({
  move,
  changeType,
  history,
  pickUp,
  showLabels = true,
  className = '',
}: StationToolbarProps) {
  const specs: Spec[] = [
    { key: 'flytta', icon: 'station.flytta', label: 'Flytta', ariaLabel: 'Flytta stationen', tone: 'brand', button: move },
    { key: 'byttyp', icon: 'station.byttyp', label: 'Byt typ', ariaLabel: 'Byt stationstyp', tone: 'brand', button: changeType },
    { key: 'historik', icon: 'station.historik', label: 'Historik', ariaLabel: 'Historik', tone: 'brand', button: history },
    { key: 'hamtaupp', icon: 'station.hamtaupp', label: 'Hämta upp', ariaLabel: 'Hämta upp efter kontrollen', tone: 'violet', button: pickUp },
  ]
  const shown = specs.filter((s) => s.button && s.button.visible !== false)
  if (shown.length === 0) return null

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
    >
      {shown.map(({ key, icon, label, ariaLabel, tone, button }) => {
        const b = button!
        const isActive = b.active === true
        return (
          <button
            key={key}
            type="button"
            onClick={b.onClick}
            disabled={b.disabled}
            aria-label={b.disabled && b.disabledReason ? `${ariaLabel}. ${b.disabledReason}` : ariaLabel}
            aria-pressed={b.active === undefined ? undefined : isActive}
            title={b.disabled ? b.disabledReason : undefined}
            className={`${showLabels ? 'h-[68px]' : 'h-14'} min-h-[44px] rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? ACTIVE_CLASSES[tone]
                : 'border-slate-800 bg-slate-800/60 text-slate-200 hover:bg-slate-800 enabled:hover:border-slate-700'
            }`}
          >
            <Icon name={icon} size={20} />
            {showLabels && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}

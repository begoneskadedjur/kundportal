// src/components/shared/ThemeToggle.tsx
// Temaväljare: cyklar mörkt → ljust → system. Placeras i topheaders och mobilmenyer.
// På Mitt konto finns i stället TemaVal, där man väljer ett av de tre direkt.

import { Icon, type IconName } from '../icons/Icon'
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext'

const NEXT: Record<ThemePreference, ThemePreference> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

const LABELS: Record<ThemePreference, string> = {
  dark: 'Mörkt tema',
  light: 'Ljust tema',
  system: 'Följer systemet',
}

const TEMA_IKON: Record<ThemePreference, IconName> = {
  dark: 'allman.tema',
  light: 'konto.sol',
  system: 'konto.system',
}

interface ThemeToggleProps {
  /** 'icon' = kompakt ikonknapp (topheader), 'row' = full rad med etikett (mobilmeny) */
  variant?: 'icon' | 'row'
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { preference, setTheme } = useTheme()
  const next = NEXT[preference]

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
      >
        <Icon name={TEMA_IKON[preference]} size={20} className="flex-shrink-0" />
        <span className="text-sm font-medium">{LABELS[preference]}</span>
        <span className="ml-auto text-xs text-slate-500">Byt till {LABELS[next].toLowerCase()}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      title={`${LABELS[preference]}. Tryck för ${LABELS[next].toLowerCase()}`}
      aria-label="Byt tema"
    >
      <Icon name={TEMA_IKON[preference]} size={16} />
    </button>
  )
}

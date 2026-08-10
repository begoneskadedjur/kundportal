// src/components/shared/ThemeToggle.tsx
// Temaväljare: cyklar mörkt → ljust → system. Placeras i topheaders och mobilmenyer.

import { Moon, Sun, Monitor } from 'lucide-react'
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

const ICONS: Record<ThemePreference, React.ElementType> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
}

interface ThemeToggleProps {
  /** 'icon' = kompakt ikonknapp (topheader), 'row' = full rad med etikett (mobilmeny) */
  variant?: 'icon' | 'row'
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { preference, setTheme } = useTheme()
  const Icon = ICONS[preference]
  const next = NEXT[preference]

  if (variant === 'row') {
    return (
      <button
        onClick={() => setTheme(next)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">{LABELS[preference]}</span>
        <span className="ml-auto text-xs text-slate-500">Byt till {LABELS[next].toLowerCase()}</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(next)}
      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      title={`${LABELS[preference]} - klicka för ${LABELS[next].toLowerCase()}`}
      aria-label="Byt tema"
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

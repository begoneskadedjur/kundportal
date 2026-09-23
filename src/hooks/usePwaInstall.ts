// src/hooks/usePwaInstall.ts
// Läget för "Använd som app" under Mitt konto: plattform, om portalen redan
// körs från hemskärmen, och om webbläsaren har ett installationserbjudande
// som knappen kan öppna.

import { useCallback, useEffect, useState } from 'react'
import {
  clearDeferredPrompt,
  detectPwaPlatform,
  getPwaInstallState,
  isStandaloneDisplay,
  subscribePwaInstall,
  type PwaPlatform,
} from '../lib/pwaInstall'

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface UsePwaInstall {
  platform: PwaPlatform
  /** Körs redan som app på den här enheten */
  isStandalone: boolean
  /** Webbläsaren kan öppna installationsdialogen direkt (Android) */
  canPrompt: boolean
  /** Installationen bekräftades under den här sessionen */
  installed: boolean
  installing: boolean
  install: () => Promise<PwaInstallOutcome>
}

export function usePwaInstall(): UsePwaInstall {
  const [platform] = useState<PwaPlatform>(() => detectPwaPlatform())
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandaloneDisplay())
  const [canPrompt, setCanPrompt] = useState<boolean>(() => getPwaInstallState().prompt !== null)
  const [installed, setInstalled] = useState<boolean>(() => getPwaInstallState().installed)
  const [installing, setInstalling] = useState(false)

  useEffect(() => subscribePwaInstall(state => {
    setCanPrompt(state.prompt !== null)
    if (state.installed) setInstalled(true)
  }), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => setIsStandalone(isStandaloneDisplay())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const install = useCallback(async (): Promise<PwaInstallOutcome> => {
    const prompt = getPwaInstallState().prompt
    if (!prompt) return 'unavailable'
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      return outcome
    } finally {
      // Erbjudandet är förbrukat oavsett svar
      clearDeferredPrompt()
      setInstalling(false)
    }
  }, [])

  return { platform, isStandalone, canPrompt, installed, installing, install }
}

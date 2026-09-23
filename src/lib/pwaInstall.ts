// src/lib/pwaInstall.ts
// Fångar webbläsarens installationserbjudande (PWA) tidigt och håller det tills
// användaren själv trycker på knappen under Mitt konto. Vi stoppar webbläsarens
// egen ruta, så ingen får en prompt mitt i arbetet.
//
// Android (Chrome, Samsung Internet, Edge) skickar beforeinstallprompt.
// iOS skickar ingenting: där visar Mitt konto en guide till Dela-menyn.
//
// Importeras från main.tsx så lyssnaren finns innan händelsen hinner skickas.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export interface PwaInstallState {
  /** Sparat erbjudande från webbläsaren, null när det inte finns något */
  prompt: BeforeInstallPromptEvent | null
  /** true efter att webbläsaren bekräftat installationen (appinstalled) */
  installed: boolean
}

export type PwaPlatform = 'ios' | 'android' | 'desktop'

let state: PwaInstallState = { prompt: null, installed: false }
const listeners = new Set<(state: PwaInstallState) => void>()

const emit = () => listeners.forEach(listener => listener(state))

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    // Ingen automatisk ruta - erbjudandet sparas till knappen i Mitt konto
    event.preventDefault()
    state = { ...state, prompt: event as BeforeInstallPromptEvent }
    emit()
  })
  window.addEventListener('appinstalled', () => {
    state = { prompt: null, installed: true }
    emit()
  })
}

export function getPwaInstallState(): PwaInstallState {
  return state
}

/** Ett erbjudande kan bara användas en gång - rensa efter prompt() */
export function clearDeferredPrompt(): void {
  state = { ...state, prompt: null }
  emit()
}

export function subscribePwaInstall(listener: (state: PwaInstallState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** true när portalen körs från hemskärmen, utan adressfält */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

export function detectPwaPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  // iPadOS anmäler sig som Mac men har pekskärm
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

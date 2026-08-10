// src/contexts/ThemeContext.tsx
// Temaval per användare: dark (default), light eller system.
// Sätter data-theme på <html> som globals.css ljus-mappning nycklar på.
// Valet sparas i localStorage (snabb återläsning + flash-skyddet i index.html)
// och i profiles.theme_preference så att det följer med mellan enheter.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'begone_theme'

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return preference
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved)
}

type ThemeContextType = {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'system' ? stored : 'dark'
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(
    (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'dark'
  ))

  // Applicera + lyssna på OS-ändringar vid 'system'
  useEffect(() => {
    const resolved = resolveTheme(preference)
    setResolvedTheme(resolved)
    applyTheme(resolved)

    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const listener = () => {
      const next = resolveTheme('system')
      setResolvedTheme(next)
      applyTheme(next)
    }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [preference])

  // Profilens sparade val vinner över localStorage när profilen laddats
  // (så att valet följer med till nya enheter)
  useEffect(() => {
    const saved = (profile as { theme_preference?: string } | null)?.theme_preference
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      if (saved !== preference) {
        setPreference(saved)
        localStorage.setItem(STORAGE_KEY, saved)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const setTheme = (next: ThemePreference) => {
    setPreference(next)
    localStorage.setItem(STORAGE_KEY, next)
    if (user?.id) {
      supabase
        .from('profiles')
        .update({ theme_preference: next })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('Error saving theme preference:', error)
        })
    }
  }

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

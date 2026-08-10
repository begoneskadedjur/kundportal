// src/components/shared/ThemedToaster.tsx
// react-hot-toast med färger som följer aktivt tema.

import { Toaster } from 'react-hot-toast'
import { useTheme } from '../../contexts/ThemeContext'

export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  return (
    <Toaster
      position="top-right"
      containerStyle={{ zIndex: 2147483647 }}
      toastOptions={{
        duration: 4000,
        style: dark
          ? {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #475569',
            }
          : {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 24px rgb(15 23 42 / 0.12)',
            },
        success: {
          iconTheme: {
            primary: '#22c55e',
            secondary: dark ? '#f8fafc' : '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: dark ? '#f8fafc' : '#ffffff',
          },
        },
      }}
    />
  )
}

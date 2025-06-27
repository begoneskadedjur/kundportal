// src/utils/sessionUtils.ts - NYTT: Session hantering
export const clearStaleSession = async () => {
  try {
    // Kontrollera om vi har en session som är äldre än 24h
    const lastActivity = localStorage.getItem('last_activity')
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    
    if (lastActivity && (now - parseInt(lastActivity)) > oneDayMs) {
      console.log('🧹 Clearing stale session (older than 24h)')
      
      // Rensa localStorage
      localStorage.clear()
      
      // Rensa sessionStorage
      sessionStorage.clear()
      
      // Rensa Supabase session
      const { supabase } = await import('../lib/supabase')
      await supabase.auth.signOut()
      
      return true
    }
    
    // Uppdatera senaste aktivitet
    localStorage.setItem('last_activity', now.toString())
    return false
  } catch (error) {
    console.error('Error clearing stale session:', error)
    return false
  }
}

// Lägg till i src/main.tsx FÖRE ReactDOM.render:
/*
import { clearStaleSession } from './utils/sessionUtils'

// Rensa gamla sessioner innan app startar
clearStaleSession().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
*/
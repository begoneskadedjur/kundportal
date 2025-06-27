// src/pages/Home.tsx - FIXED VERSION med förbättrad loading logic
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/shared/LoadingSpinner'

export default function Home() {
  const { user, isAdmin, loading, profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // FIX: Vänta tills loading är false och vi har klar auth state
    if (!loading) {
      if (!user) {
        // Ingen användare inloggad
        console.log('🏠 No user found, redirecting to login')
        navigate('/login', { replace: true })
      } else if (profile) {
        // Användare inloggad och profil laddad
        console.log('🏠 User authenticated, redirecting based on role')
        const targetPath = isAdmin ? '/admin' : '/portal'
        console.log(`🧭 Redirecting to ${targetPath}`)
        navigate(targetPath, { replace: true })
      } else {
        // Användare finns men profil saknas - detta ska inte hända normalt
        // AuthContext ska hantera detta genom att logga ut användaren
        console.warn('🏠 User exists but no profile found')
      }
    }
    // FIX: Lägger till profile i dependency array för säkerhet
  }, [user, isAdmin, loading, profile, navigate])

  // Visa loading medan vi väntar på auth state
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-slate-400">
          {loading ? 'Kontrollerar inloggning...' : 'Omdirigerar...'}
        </p>
      </div>
    </div>
  )
}
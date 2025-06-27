// src/pages/Home.tsx - FIXAD VERSION
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/shared/LoadingSpinner'

export default function Home() {
  const { user, isAdmin, loading, profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Navigera endast när loading är false och vi har fullständig auth-info
    if (!loading) {
      if (!user) {
        console.log('🏠 No user found, redirecting to login')
        navigate('/login', { replace: true })
      } else if (profile) {
        // Vi har både user och profile, navigera baserat på roll
        console.log('🏠 User authenticated, redirecting to dashboard')
        if (isAdmin) {
          navigate('/admin', { replace: true })
        } else {
          navigate('/portal', { replace: true })
        }
      }
      // Om vi har user men inte profile än, vänta (loading kommer vara true)
    }
  }, [user, isAdmin, loading, navigate, profile])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-slate-400">Laddar din profil...</p>
      </div>
    </div>
  )
}
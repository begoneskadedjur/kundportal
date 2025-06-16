// Sökväg: src/components/auth/ActivateAccount.tsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface UserProfile {
  email: string
  company_name: string
  contact_person: string
  full_name: string
}

export default function ActivateAccount() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  
  const navigate = useNavigate()

  useEffect(() => {
    // Hämta användarens profil när sidan laddas
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      // Kolla om vi har en giltig session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        setError('Ogiltig eller utgången länk. Vänligen begär en ny.')
        setLoadingProfile(false)
        return
      }

      // Hämta användarens metadata
      const user = session.user
      const metadata = user.user_metadata || {}
      
      setUserProfile({
        email: user.email || '',
        company_name: metadata.company_name || '',
        contact_person: metadata.full_name || '',
        full_name: metadata.full_name || ''
      })
      
      setLoadingProfile(false)
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('Kunde inte ladda användaruppgifter')
      setLoadingProfile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validering
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken långt')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte')
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      // Uppdatera lösenordet
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      
      // Vänta lite och redirect till login
      setTimeout(() => {
        navigate('/login')
      }, 3000)
      
    } catch (err: any) {
      console.error('Error updating password:', err)
      setError(err.message || 'Ett fel uppstod vid uppdatering av lösenord')
    } finally {
      setLoading(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ogiltig länk</h2>
            <p className="text-gray-600 mb-6">{error || 'Länken är ogiltig eller har utgått.'}</p>
            <a 
              href="/login" 
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Gå till inloggning
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Konto aktiverat!</h2>
            <p className="text-gray-600">
              Ditt konto har aktiverats. Du omdirigeras till inloggningssidan...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Aktivera ditt konto</h2>
          <p className="mt-2 text-gray-600">
            Välkommen till Begone Kundportal! Sätt ett lösenord för att slutföra din registrering.
          </p>
        </div>

        {/* Användarinformation */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Dina uppgifter:</h3>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Företag:</span> {userProfile.company_name}</p>
            <p><span className="font-medium">Kontaktperson:</span> {userProfile.contact_person}</p>
            <p><span className="font-medium">E-post:</span> {userProfile.email}</p>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            Dessa uppgifter kan inte ändras här. Kontakta support vid behov.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Nytt lösenord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Minst 6 tecken"
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Bekräfta lösenord
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ange lösenordet igen"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Sparar...' : 'Aktivera konto'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a 
            href="/login" 
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Har redan lösenord? Logga in här
          </a>
        </div>
      </div>
    </div>
  )
}
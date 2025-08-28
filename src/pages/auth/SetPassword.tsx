import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { Key, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token')
    if (!tokenFromUrl) {
      toast.error('Ogiltig länk. Kontakta administratören.')
      navigate('/login')
    } else {
      setToken(tokenFromUrl)
    }
  }, [searchParams, navigate])

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Lösenordet måste vara minst 8 tecken långt'
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Lösenordet måste innehålla minst en liten bokstav'
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Lösenordet måste innehålla minst en stor bokstav'
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Lösenordet måste innehålla minst en siffra'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password || !confirmPassword) {
      toast.error('Vänligen fyll i alla fält')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    if (password !== confirmPassword) {
      toast.error('Lösenorden matchar inte')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          password 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Ett fel uppstod. Försök igen senare.')
        return
      }

      toast.success('Lösenord satt! Du kan nu logga in.')
      navigate('/login')

    } catch (error: any) {
      console.error('Error setting password:', error)
      toast.error('Ett fel uppstod. Kontrollera din internetanslutning och försök igen.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div 
        className="min-h-screen relative"
        style={{
          backgroundImage: `url('/images/om_oss_begone_skadedjur.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95" />
        <div className="relative z-10 flex items-center justify-center p-4 min-h-screen">
          <Card className="max-w-md w-full p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Ogiltig länk
              </h1>
              <p className="text-slate-400 mb-6">
                Denna länk är inte giltig eller har gått ut.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Tillbaka till inloggning
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url('/images/om_oss_begone_skadedjur.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95" />
      <div className="relative z-10 flex items-center justify-center p-4 min-h-screen">
        <Card className="max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
              <Key className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Sätt ditt lösenord
            </h1>
            <p className="text-slate-400">
              Skapa ett säkert lösenord för ditt konto
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Nytt lösenord
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-12 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Minst 8 tecken med stor/liten bokstav och siffra"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
                Bekräfta lösenord
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-12 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Skriv samma lösenord igen"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-4">
              <p className="text-sm text-slate-300 mb-2 font-medium">Lösenordskrav:</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li className={password.length >= 8 ? 'text-green-400' : ''}>
                  • Minst 8 tecken långt
                </li>
                <li className={/(?=.*[a-z])/.test(password) ? 'text-green-400' : ''}>
                  • Innehåller minst en liten bokstav (a-z)
                </li>
                <li className={/(?=.*[A-Z])/.test(password) ? 'text-green-400' : ''}>
                  • Innehåller minst en stor bokstav (A-Z)
                </li>
                <li className={/(?=.*\d)/.test(password) ? 'text-green-400' : ''}>
                  • Innehåller minst en siffra (0-9)
                </li>
                <li className={password === confirmPassword && password.length > 0 ? 'text-green-400' : ''}>
                  • Lösenorden matchar
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!password || !confirmPassword || loading}
            >
              {loading ? 'Sätter lösenord...' : 'Sätt lösenord'}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Tillbaka till inloggning
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
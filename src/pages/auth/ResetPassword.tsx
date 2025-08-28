import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [resetToken, setResetToken] = useState('')

  useEffect(() => {
    // Kontrollera token och email från URL params
    const checkResetToken = () => {
      try {
        const token = searchParams.get('token')
        const email = searchParams.get('email')

        console.log('URL params check:', { hasToken: !!token, hasEmail: !!email })

        if (token && email) {
          console.log('Valid reset link detected')
          setResetToken(token)
          setUserEmail(decodeURIComponent(email))
          setIsValidToken(true)
          setCheckingToken(false)
          return
        }

        console.log('No valid token or email found in URL')
        toast.error('Ogiltig eller saknad återställningslänk')
        setTimeout(() => navigate('/login'), 3000)
      } catch (error) {
        console.error('Error checking reset token:', error)
        toast.error('Något gick fel')
        navigate('/login')
      }
    }

    checkResetToken()
  }, [navigate, searchParams])

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Lösenordet måste vara minst 8 tecken'
    }
    if (!/[A-Z]/.test(password)) {
      return 'Lösenordet måste innehålla minst en stor bokstav'
    }
    if (!/[a-z]/.test(password)) {
      return 'Lösenordet måste innehålla minst en liten bokstav'
    }
    if (!/[0-9]/.test(password)) {
      return 'Lösenordet måste innehålla minst en siffra'
    }
    return null
  }

  // Kontrollera om lösenordet innehåller vanliga osäkra mönster
  const hasWeakPatterns = (password: string) => {
    const weakPatterns = [
      /123456/, /654321/, /qwerty/, /asdf/, /password/, 
      /admin/, /login/, /welcome/, /abc/, /111/, /000/,
      /^(.)\1{4,}/, // Upprepade tecken (aaaaa)
      /^(012|123|234|345|456|567|678|789)/, // Sekvenser
    ]
    return weakPatterns.some(pattern => pattern.test(password.toLowerCase()))
  }

  // Beräkna lösenordsstyrka
  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, text: 'Ange lösenord', color: 'text-slate-500' }
    
    let score = 0
    const checks = {
      length: password.length >= 8,
      longLength: password.length >= 12,
      upperCase: /[A-Z]/.test(password),
      lowerCase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      noWeakPatterns: !hasWeakPatterns(password)
    }
    
    score += checks.length ? 1 : 0
    score += checks.longLength ? 1 : 0
    score += checks.upperCase ? 1 : 0
    score += checks.lowerCase ? 1 : 0
    score += checks.numbers ? 1 : 0
    score += checks.special ? 1 : 0
    score += checks.noWeakPatterns ? 1 : 0
    
    if (score <= 3) return { score, text: 'Svagt', color: 'text-red-400' }
    if (score <= 5) return { score, text: 'Medel', color: 'text-yellow-400' }
    if (score <= 6) return { score, text: 'Starkt', color: 'text-green-400' }
    return { score, text: 'Mycket starkt', color: 'text-green-300' }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validera lösenord
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    // Kontrollera att lösenorden matchar
    if (newPassword !== confirmPassword) {
      toast.error('Lösenorden matchar inte')
      return
    }

    setLoading(true)
    try {
      console.log('Password reset attempt:', { 
        email: userEmail,
        hasToken: !!resetToken,
        timestamp: new Date().toISOString()
      })

      // Anropa vårt verify-reset-token API
      const response = await fetch('/api/verify-reset-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetToken,
          email: userEmail,
          newPassword: newPassword
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Password reset failed:', data)
        
        // Hantera olika typer av fel
        if (data.error?.includes('utgången') || data.error?.includes('gått ut')) {
          toast.error('Återställningslänken har gått ut. Begär en ny återställning.')
        } else if (data.error?.includes('Ogiltig återställningslänk')) {
          toast.error(
            'Återställningslänken är inte giltig. Detta kan bero på att:\n' +
            '• Du har använt en gammal länk\n' +
            '• Länken redan har använts\n' +
            '• Du behöver begära en ny återställning',
            { duration: 8000 }
          )
        } else if (data.type === 'weak_password_pwned') {
          toast.error(
            '🚨 Osäkert lösenord\n\n' +
            'Detta lösenord är känt för hackare och har läckt i databaser.\n\n' +
            '💡 Tips för ett säkert lösenord:\n' +
            '• Kombinera 3-4 slumpmässiga ord\n' +
            '• Lägg till siffror och specialtecken\n' +
            '• Undvik personlig information\n' +
            '• Använd inte samma lösenord på flera sidor',
            { duration: 12000 }
          )
        } else if (data.type === 'weak_password_generic') {
          toast.error(
            '⚠️ Svagt lösenord\n\n' +
            'Lösenordet är för enkelt att gissa.\n\n' +
            '💡 Förbättra lösenordet genom att:\n' +
            '• Göra det längre (minst 12 tecken)\n' +
            '• Blanda stora och små bokstäver\n' +
            '• Inkludera siffror och specialtecken (!@#$%)\n' +
            '• Undvika vanliga mönster (123, abc, qwerty)',
            { duration: 10000 }
          )
        } else {
          toast.error(data.message || data.error || 'Kunde inte uppdatera lösenordet')
        }
        return
      }

      console.log('Password updated successfully')
      toast.success('Lösenordet har uppdaterats!')
      
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error: any) {
      console.error('Error updating password:', error)
      toast.error(error.message || 'Kunde inte uppdatera lösenordet')
    } finally {
      setLoading(false)
    }
  }

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Ogiltig länk</h2>
          <p className="text-slate-400">
            Återställningslänken är ogiltig eller saknas. Du omdirigeras till inloggningssidan...
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Återställ lösenord
          </h1>
          <p className="text-slate-400">
            Ange ditt nya lösenord nedan
          </p>
          {userEmail && (
            <p className="text-sm text-purple-400 mt-2">
              För: {userEmail}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nytt lösenord */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nytt lösenord
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minst 8 tecken"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Bekräfta lösenord */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bekräfta lösenord
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Upprepa lösenordet"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Lösenordsstyrka-indikator */}
          {newPassword && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-slate-300">Lösenordsstyrka:</p>
                <span className={`text-sm font-medium ${getPasswordStrength(newPassword).color}`}>
                  {getPasswordStrength(newPassword).text}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getPasswordStrength(newPassword).score <= 3 ? 'bg-red-500' :
                    getPasswordStrength(newPassword).score <= 5 ? 'bg-yellow-500' :
                    getPasswordStrength(newPassword).score <= 6 ? 'bg-green-500' : 'bg-green-400'
                  }`}
                  style={{ width: `${(getPasswordStrength(newPassword).score / 7) * 100}%` }}
                />
              </div>
              
              {/* Proaktiv varning för svaga lösenord */}
              {getPasswordStrength(newPassword).score <= 3 && (
                <div className="mt-3 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
                  <p className="text-red-300 text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Svagt lösenord - risk för avvisning
                  </p>
                  <p className="text-red-200/80 text-xs mt-1">
                    Detta lösenord kan avvisas av säkerhetsskäl. Försök göra det starkare för att undvika problem.
                  </p>
                </div>
              )}
              
              {hasWeakPatterns(newPassword) && (
                <div className="mt-3 p-3 bg-orange-900/30 border border-orange-800/50 rounded-lg">
                  <p className="text-orange-300 text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Vanligt mönster upptäckt
                  </p>
                  <p className="text-orange-200/80 text-xs mt-1">
                    Undvik sekvenser som 123, qwerty eller upprepningar. De är lätta att gissa.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lösenordskrav */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-300 mb-3">Lösenordskrav:</p>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {/* Grundläggande krav */}
              <div className="space-y-1">
                <p className="text-xs text-slate-400 font-medium mb-2">GRUNDLÄGGANDE:</p>
                <li className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Minst 8 tecken
                </li>
                <li className={`flex items-center gap-2 ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Minst en stor bokstav (A-Z)
                </li>
                <li className={`flex items-center gap-2 ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Minst en liten bokstav (a-z)
                </li>
                <li className={`flex items-center gap-2 ${/[0-9]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Minst en siffra (0-9)
                </li>
              </div>

              {/* Säkerhetskrav */}
              <div className="space-y-1 mt-3">
                <p className="text-xs text-slate-400 font-medium mb-2">SÄKERHET:</p>
                <li className={`flex items-center gap-2 ${newPassword.length >= 12 ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Rekommenderat: Minst 12 tecken
                </li>
                <li className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Specialtecken (!@#$% osv.)
                </li>
                <li className={`flex items-center gap-2 ${!hasWeakPatterns(newPassword) ? 'text-green-400' : newPassword ? 'text-red-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-4 h-4" />
                  Inga vanliga mönster (123, qwerty, osv.)
                </li>
                <li className="flex items-center gap-2 text-blue-400">
                  <CheckCircle className="w-4 h-4" />
                  Inte känt för hackare (kontrolleras vid submit)
                </li>
              </div>
            </div>
          </div>

          {/* Submit-knapp */}
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full"
          >
            {loading ? 'Uppdaterar...' : 'Uppdatera lösenord'}
          </Button>

          {/* Tillbaka till login */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Tillbaka till inloggning
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
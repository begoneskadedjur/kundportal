import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error('Vänligen ange din e-postadress')
      return
    }

    if (!validateEmail(email)) {
      toast.error('Vänligen ange en giltig e-postadress')
      return
    }

    setLoading(true)
    try {
      console.log('Sending password reset request for:', email)

      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(data.error || 'För många försök. Försök igen senare.')
        } else {
          toast.error(data.error || 'Ett fel uppstod. Försök igen senare.')
        }
        return
      }

      setEmailSent(true)
      toast.success('Återställningsmail skickat!')

    } catch (error: any) {
      console.error('Error sending password reset:', error)
      toast.error('Ett fel uppstod. Kontrollera din internetanslutning och försök igen.')
    } finally {
      setLoading(false)
    }
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
          {!emailSent ? (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                  <Mail className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Glömt lösenord?
                </h1>
                <p className="text-slate-400">
                  Få en återställningslänk via e-post
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                    E-postadress
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="din@email.se"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Vi skickar en säker länk för att återställa ditt lösenord
                  </p>
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!email || loading}
                >
                  {loading ? 'Skickar...' : 'Skicka återställningslänk'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                E-post skickat!
              </h1>
              <p className="text-slate-400 mb-6">
                Vi har skickat en återställningslänk till <strong className="text-blue-400">{email}</strong>
              </p>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-300 mb-2">Nästa steg:</p>
                <ul className="text-sm text-slate-400 space-y-1 text-left">
                  <li>• Kolla din inkorg (och skräppost)</li>
                  <li>• Klicka på länken i mailet</li>
                  <li>• Skapa ditt nya lösenord</li>
                </ul>
              </div>
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full mb-4"
              >
                Skicka till annan e-post
              </Button>
            </div>
          )}

          <div className="text-center mt-6">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
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
// src/components/admin/technicians/management/TechnicianAuthModal.tsx - UPPDATERAD MED VÄLKOMSTMAIL
import { useState } from 'react'
import { Key, User, AlertCircle, Send, Eye, EyeOff } from 'lucide-react'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { useAuth } from '../../../../contexts/AuthContext'
import toast from 'react-hot-toast'

type TechnicianAuthModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician: {
    id: string
    name: string
    email: string
    has_login?: boolean
  }
}

export default function TechnicianAuthModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  technician 
}: TechnicianAuthModalProps) {
  const [formData, setFormData] = useState({ display_name: technician.name })
  const [customPassword, setCustomPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const generateSecurePassword = (): string => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%]/.test(password)
    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      return generateSecurePassword()
    }
    return password
  }

  const [generatedPassword] = useState(() => !technician.has_login ? generateSecurePassword() : '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setLoading(true)

    try {
      // Använd API route för att skapa konto och skicka inbjudan
      const response = await fetch('/api/enable-technician-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician_id: technician.id,
          email: technician.email,
          password: customPassword.trim() || generatedPassword,
          display_name: formData.display_name,
          sendWelcomeEmail: true,
          invitedBy: user?.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte skicka inbjudan')
      }

      toast.success(`Inbjudan skickad till ${technician.name} via mail!`)
      onSuccess()
      onClose()

    } catch (error: any) {
      console.error('Error sending invitation:', error)
      toast.error(error.message || 'Kunde inte skicka inbjudan')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableLogin = async () => {
    if (!window.confirm(`Är du säker på att du vill inaktivera inloggning för ${technician.name}?`)) {
      return
    }

    setLoading(true)

    try {
      // Använd API route för disable också
      const response = await fetch('/api/disable-technician-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician_id: technician.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte inaktivera inloggning')
      }

      toast.success('Inloggning inaktiverat!')
      onSuccess()
      onClose()

    } catch (error: any) {
      console.error('Error disabling technician login:', error)
      toast.error('Kunde inte inaktivera inloggning')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            {technician.has_login ? 'Hantera Inloggning' : 'Skicka Inbjudan'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Till: <span className="text-white font-medium">{technician.name}</span> ({technician.email})
          </p>

          {technician.has_login ? (
            // Tekniker har redan inloggning
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">Inloggning aktiv</span>
                </div>
                <p className="text-slate-300 text-sm mt-2">
                  {technician.name} kan logga in i systemet med sin e-postadress.
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Stäng
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDisableLogin}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? <LoadingSpinner /> : 'Inaktivera'}
                </Button>
              </div>
            </div>
          ) : (
            // Skapa ny inbjudan
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Visningsnamn"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                required
                icon={<User className="w-4 h-4" />}
                placeholder="Namn som visas i systemet"
              />

              {/* Valfritt lösenord */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Lösenord (valfritt)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Lämna tomt för auto-genererat"
                    className="w-full px-3 py-2 pr-10 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {customPassword.trim() ? 'Ditt angivna lösenord används.' : 'Ett säkert lösenord genereras automatiskt.'}
                </p>
              </div>

              {/* Inbjudningsinformation */}
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Send className="w-5 h-5 text-teal-400" />
                  <span className="text-white font-medium">Inbjudan via e-post</span>
                </div>
                <p className="text-sm text-slate-300 mb-2">
                  Ett välkomstmail skickas till <span className="font-medium text-teal-400">{technician.email}</span> med inloggningsuppgifter.
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-blue-400 text-sm">
                    <p className="font-medium mb-1">Teknikern får tillgång till:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Skapa avtal via OneFlow</li>
                      <li>Se sina tilldelade ärenden</li>
                      <li>Uppdatera ärendestatus</li>
                      <li>Begränsat kundsystem (ej admin)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Avbryt
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !formData.display_name}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner />
                      Skickar inbjudan...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Skicka Inbjudan
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
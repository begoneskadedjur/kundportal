// src/components/admin/technicians/management/TechnicianAuthModal.tsx - UPPDATERAD
import { useState } from 'react'
import { Key, Eye, EyeOff, User, AlertCircle } from 'lucide-react'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { supabase } from '../../../../lib/supabase'
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
  const [formData, setFormData] = useState({
    display_name: technician.name,
    password: '',
    confirm_password: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirm_password) {
      toast.error('Lösenorden matchar inte')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Lösenord måste vara minst 6 tecken')
      return
    }

    setLoading(true)

    try {
      // Använd API route istället för direkt supabase.auth.admin
      const response = await fetch('/api/enable-technician-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician_id: technician.id,
          email: technician.email,
          password: formData.password,
          display_name: formData.display_name
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte aktivera inloggning')
      }

      toast.success(`Inloggning aktiverat för ${technician.name}!`)
      onSuccess()
      onClose()

    } catch (error: any) {
      console.error('Error enabling technician login:', error)
      toast.error(error.message || 'Kunde inte aktivera inloggning')
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
            {technician.has_login ? 'Hantera Inloggning' : 'Aktivera Inloggning'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            För: <span className="text-white font-medium">{technician.name}</span>
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
                  variant="destructive"
                  onClick={handleDisableLogin}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? <LoadingSpinner className="w-4 h-4" /> : 'Inaktivera'}
                </Button>
              </div>
            </div>
          ) : (
            // Skapa ny inloggning
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Visningsnamn"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                required
                icon={<User className="w-4 h-4" />}
                placeholder="Namn som visas i systemet"
              />

              <div className="relative">
                <Input
                  label="Lösenord"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  icon={<Key className="w-4 h-4" />}
                  placeholder="Minst 6 tecken"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Bekräfta lösenord"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  required
                  icon={<Key className="w-4 h-4" />}
                  placeholder="Upprepa lösenordet"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-9 text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                  disabled={loading || !formData.password || formData.password !== formData.confirm_password}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Aktiverar...
                    </>
                  ) : (
                    'Aktivera Inloggning'
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
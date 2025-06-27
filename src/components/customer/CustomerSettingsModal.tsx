// src/components/customer/CustomerSettingsModal.tsx - FIXAD för uppdateringsproblem
import { useState } from 'react'
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Building, 
  Hash,
  Save,
  Eye,
  EyeOff
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

interface CustomerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  customer: {
    id: string
    company_name: string
    org_number: string | null
    contact_person: string
    email: string
    phone: string
  }
  onUpdate: (updatedCustomer: any) => void
}

interface FormData {
  contact_person: string
  email: string
  phone: string
  current_password: string
  new_password: string
  confirm_password: string
}

export default function CustomerSettingsModal({ 
  isOpen, 
  onClose, 
  customer,
  onUpdate 
}: CustomerSettingsModalProps) {
  const { user } = useAuth() // Hämta current user för auth updates
  const [loading, setLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [formData, setFormData] = useState<FormData>({
    contact_person: customer.contact_person,
    email: customer.email,
    phone: customer.phone,
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  if (!isOpen) return null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const validateForm = () => {
    // Validera e-post
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Ange en giltig e-postadress')
      return false
    }

    // Om lösenord ska ändras
    if (formData.new_password || formData.confirm_password) {
      if (!formData.current_password) {
        toast.error('Ange ditt nuvarande lösenord för att byta lösenord')
        return false
      }
      
      if (formData.new_password.length < 6) {
        toast.error('Nytt lösenord måste vara minst 6 tecken')
        return false
      }
      
      if (formData.new_password !== formData.confirm_password) {
        toast.error('De nya lösenorden matchar inte')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    
    try {
      console.log('Uppdaterar kund med ID:', customer.id)
      
      // Anropa vår nya update-customer API
      const response = await fetch('/api/update-customer', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customer.id,
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          new_password: formData.new_password || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte uppdatera kunduppgifter')
      }

      toast.success('Dina uppgifter har uppdaterats!')
      
      // Uppdatera parent component med den uppdaterade kunden
      onUpdate(data.customer)
      onClose()
      
      // Rensa lösenordsfälten
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }))

    } catch (error: any) {
      console.error('Error updating customer:', error)
      toast.error(error.message || 'Ett fel uppstod vid uppdatering')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Mina uppgifter</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Read-only företagsinfo */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">
              Företagsinformation (kan ej ändras)
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Building className="w-4 h-4 inline mr-2" />
                Företagsnamn
              </label>
              <input
                type="text"
                value={customer.company_name}
                disabled
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
              />
            </div>

            {customer.org_number && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  <Hash className="w-4 h-4 inline mr-2" />
                  Organisationsnummer
                </label>
                <input
                  type="text"
                  value={customer.org_number}
                  disabled
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Redigerbara kontaktuppgifter */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">
              Kontaktuppgifter
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Kontaktperson *
              </label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                E-postadress *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Telefonnummer *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* Lösenordsändring */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">
              Ändra lösenord (valfritt)
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Nuvarande lösenord
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  name="current_password"
                  value={formData.current_password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Nytt lösenord
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Bekräfta nytt lösenord
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Lämna lösenordsfälten tomma om du inte vill ändra lösenord
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Sparar...' : 'Spara ändringar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
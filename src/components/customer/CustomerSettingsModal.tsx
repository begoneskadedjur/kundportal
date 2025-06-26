// src/components/customer/CustomerSettingsModal.tsx
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
  EyeOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface CustomerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  customer: {
    id: string
    company_name: string
    org_number: string
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
      // Uppdatera kunduppgifter i databasen
      const { data: updatedCustomer, error: customerError } = await supabase
        .from('customers')
        .update({
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)
        .select()
        .single()

      if (customerError) throw customerError

      // Om lösenord ska ändras
      if (formData.new_password) {
        const { error: authError } = await supabase.auth.updateUser({
          password: formData.new_password
        })

        if (authError) {
          // Om lösenordsändring misslyckas, rulla tillbaka kunduppdateringen
          throw new Error('Kunde inte uppdatera lösenord: ' + authError.message)
        }
      }

      // Uppdatera även auth.users e-post om den ändrats
      if (formData.email !== customer.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email
        })

        if (emailError) {
          console.warn('Kunde inte uppdatera e-post i auth:', emailError.message)
          // Fortsätt ändå eftersom kunddata är uppdaterat
        }
      }

      toast.success('Dina uppgifter har uppdaterats!')
      onUpdate(updatedCustomer)
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
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                Organisationsnummer
              </label>
              <input
                type="text"
                value={customer.org_number}
                disabled
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Redigerbara fält */}
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
          </div>

          {/* Info text */}
          <div className="flex items-start space-x-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-300">
              <p>Lämna lösenordsfälten tomma om du inte vill ändra ditt lösenord.</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-6 border-t border-slate-700">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Spara ändringar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
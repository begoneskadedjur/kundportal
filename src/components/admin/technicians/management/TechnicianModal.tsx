// src/components/admin/technicians/management/TechnicianModal.tsx
// UTÖKAD VERSION FÖR FULLSTÄNDIG PERSONALHANTERING

import React, { useState, useEffect } from 'react'
import { User, AlertCircle, Key, Car } from 'lucide-react'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { technicianManagementService, type Technician, type TechnicianFormData } from '../../../../services/technicianManagementService'
import toast from 'react-hot-toast'

type TechnicianModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician?: Technician
}

// ✅ RENODLADE ROLLER
const STAFF_ROLES = [
  'Skadedjurstekniker',
  'Koordinator',
  'Admin',
] as const

export default function TechnicianModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  technician 
}: TechnicianModalProps) {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('') // ✅ Nytt state för lösenord
  const [formData, setFormData] = useState<Partial<TechnicianFormData>>({})

  // Uppdatera formuläret när en ny person väljs
  useEffect(() => {
    if (technician) {
      setFormData({
        name: technician.name || '',
        role: technician.role || 'Skadedjurstekniker',
        email: technician.email || '',
        direct_phone: technician.direct_phone || '',
        office_phone: technician.office_phone || '',
        address: technician.address || '',
        abax_vehicle_id: technician.abax_vehicle_id || '' // ✅ Ladda Abax ID
      })
    } else {
      // Återställ för "skapa ny"
      setFormData({
        name: '',
        role: 'Skadedjurstekniker',
        email: '',
        direct_phone: '',
        office_phone: '',
        address: '',
        abax_vehicle_id: ''
      })
    }
    setPassword(''); // Återställ alltid lösenordsfältet
  }, [technician])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email) {
        toast.error("Namn och e-post är obligatoriska fält.");
        return;
    }
    setLoading(true)

    try {
      if (technician) {
        // Uppdatera befintlig personal
        await technicianManagementService.updateTechnician(technician.id, formData as TechnicianFormData)
        // Om ett nytt lösenord har angetts, uppdatera det också
        if (password.trim()) {
            await technicianManagementService.updateUserPassword(technician.user_id!, password);
        }
      } else {
        // Skapa ny personal
        await technicianManagementService.createTechnician(formData as TechnicianFormData)
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      // Fel hanteras av service med toast
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="glass w-full max-w-2xl bg-slate-900/95 backdrop-blur-lg border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {technician ? 'Redigera Personal' : 'Lägg till Personal'}
              </h2>
              <p className="text-slate-400 text-sm">
                {technician ? 'Uppdatera personuppgifter' : 'Skapa ny person i systemet'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Grundläggande uppgifter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Namn *" name="name" value={formData.name || ''} onChange={handleChange} required placeholder="För- och efternamn" className="bg-slate-800/50 border-slate-600 focus:border-green-500"/>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Roll *</label>
              <select name="role" value={formData.role || 'Skadedjurstekniker'} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
                {STAFF_ROLES.map(role => (<option key={role} value={role}>{role}</option>))}
              </select>
            </div>
          </div>
          <Input label="E-post *" name="email" type="email" value={formData.email || ''} onChange={handleChange} required placeholder="namn@begone.se" className="bg-slate-800/50 border-slate-600 focus:border-green-500"/>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Direkt telefon" name="direct_phone" value={formData.direct_phone || ''} onChange={handleChange} placeholder="072-123 45 67" className="bg-slate-800/50 border-slate-600 focus:border-green-500"/>
            <Input label="Växelnummer" name="office_phone" value={formData.office_phone || ''} onChange={handleChange} placeholder="010-123 45 67" className="bg-slate-800/50 border-slate-600 focus:border-green-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Adress</label>
            <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Fullständig adress"/>
          </div>

          {/* ✅ NYA FÄLT: Abax ID och Lösenord */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <h3 className="text-md font-medium text-slate-300 flex items-center gap-2"><Key className="w-4 h-4 text-purple-400"/>System & Integrationer</h3>
            <Input 
                label="Abax Vehicle ID" 
                name="abax_vehicle_id" 
                value={formData.abax_vehicle_id || ''} 
                onChange={handleChange} 
                placeholder="ID från Abax för ruttplanering" 
                icon={<Car className="w-4 h-4 text-slate-400"/>}
                className="bg-slate-800/50 border-slate-600 focus:border-purple-500"
            />

            {/* Visa lösenordsfältet endast om användaren har en inloggning */}
            {technician?.has_login && (
                <Input 
                    label="Ändra lösenord" 
                    name="password" 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Lämna tomt för att inte ändra" 
                    icon={<Key className="w-4 h-4 text-slate-400"/>}
                    className="bg-slate-800/50 border-slate-600 focus:border-purple-500"
                />
            )}
          </div>
          
          {/* Knappar */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
              Avbryt
            </Button>
            <Button type="submit" loading={loading} disabled={loading || !formData.name?.trim() || !formData.email?.trim()} className="flex-1">
              {loading ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  {technician ? 'Uppdaterar...' : 'Skapar...'}
                </>
              ) : (
                technician ? 'Uppdatera Personal' : 'Skapa Personal'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
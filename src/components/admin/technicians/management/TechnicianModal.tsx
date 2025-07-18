// src/components/admin/technicians/management/TechnicianModal.tsx
import { useState } from 'react'
import { User, AlertCircle } from 'lucide-react'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { technicianManagementService, type Technician, type TechnicianFormData } from '../../../../services/technicianManagementService'

type TechnicianModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician?: Technician
}

// Tekniker-roller
const TECHNICIAN_ROLES = [
  'Skadedjurstekniker',
  'VD',
  'Marknad & Försäljningschef',
  'Regionchef Dalarna',
  'Koordinator/kundtjänst',
  'Annan'
] as const

export default function TechnicianModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  technician 
}: TechnicianModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<TechnicianFormData>({
    name: technician?.name || '',
    role: technician?.role || 'Skadedjurstekniker',
    email: technician?.email || '',
    direct_phone: technician?.direct_phone || '',
    office_phone: technician?.office_phone || '',
    address: technician?.address || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (technician) {
        await technicianManagementService.updateTechnician(technician.id, formData)
      } else {
        await technicianManagementService.createTechnician(formData)
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

  // Reset form when technician changes
  useState(() => {
    if (technician) {
      setFormData({
        name: technician.name || '',
        role: technician.role || 'Skadedjurstekniker',
        email: technician.email || '',
        direct_phone: technician.direct_phone || '',
        office_phone: technician.office_phone || '',
        address: technician.address || ''
      })
    } else {
      setFormData({
        name: '',
        role: 'Skadedjurstekniker',
        email: '',
        direct_phone: '',
        office_phone: '',
        address: ''
      })
    }
  })

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
                {technician ? 'Redigera tekniker' : 'Lägg till tekniker'}
              </h2>
              <p className="text-slate-400 text-sm">
                {technician ? 'Uppdatera tekniker-information' : 'Skapa ny tekniker i systemet'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Grundläggande uppgifter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Namn *"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="För- och efternamn"
              className="bg-slate-800/50 border-slate-600 focus:border-green-500"
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Roll *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {TECHNICIAN_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="E-post *"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="namn@begone.se"
            className="bg-slate-800/50 border-slate-600 focus:border-green-500"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Direkt telefon"
              name="direct_phone"
              value={formData.direct_phone}
              onChange={handleChange}
              placeholder="072-123 45 67"
              className="bg-slate-800/50 border-slate-600 focus:border-green-500"
            />

            <Input
              label="Växelnummer"
              name="office_phone"
              value={formData.office_phone}
              onChange={handleChange}
              placeholder="010-123 45 67"
              className="bg-slate-800/50 border-slate-600 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Adress
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Fullständig adress"
            />
          </div>

          {/* Info-sektion om namnkonsistens och analytics */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-blue-400 text-sm">
                {technician ? (
                  <div>
                    <p className="font-medium mb-1">💡 Om namnändring</p>
                    <p>
                      Om du ändrar namnet kommer systemet automatiskt att uppdatera alla 
                      befintliga ärenden för att bevara analytics-data och historik.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium mb-1">💡 Efter skapande</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Teknikern visas i alla analytics-dashboards</li>
                      <li>• Kan tilldelas ärenden i ClickUp</li>
                      <li>• Aktivera inloggning via "Aktivera Inloggning" knappen</li>
                      <li>• Namnet kopplas automatiskt till ärenden för prestanda-spårning</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Varning för namn-ändring */}
          {technician && formData.name !== technician.name && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-yellow-400 text-sm">
                  <p className="font-medium mb-1">⚠️ Namnändring upptäckt</p>
                  <p>
                    Namnet ändras från "{technician.name}" till "{formData.name}". 
                    Alla befintliga ärenden kommer att uppdateras automatiskt.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Knappar */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !formData.name.trim() || !formData.email.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  {technician ? 'Uppdaterar...' : 'Skapar...'}
                </>
              ) : (
                technician ? 'Uppdatera Tekniker' : 'Skapa Tekniker'
              )}
            </Button>
          </div>

          {/* Debug info i development */}
          {process.env.NODE_ENV === 'development' && technician && (
            <div className="mt-4 p-3 bg-slate-800/50 border border-slate-600 rounded text-xs text-slate-400">
              <p><strong>Debug Info:</strong></p>
              <p>ID: {technician.id}</p>
              <p>Auth Status: {technician.has_login ? 'Har inloggning' : 'Ingen inloggning'}</p>
              <p>Skapad: {new Date(technician.created_at).toLocaleString('sv-SE')}</p>
              {technician.updated_at !== technician.created_at && (
                <p>Uppdaterad: {new Date(technician.updated_at).toLocaleString('sv-SE')}</p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
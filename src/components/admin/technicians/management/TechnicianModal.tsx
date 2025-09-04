// src/components/admin/technicians/management/TechnicianModal.tsx
// FULLSTÄNDIG VERSION MED KOMPETENSKARTA INTEGRERAD

import React, { useState, useEffect } from 'react'
import { User, Key, Car, Wrench, AlertCircle } from 'lucide-react' // ✅ Lade till Wrench
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { technicianManagementService, type Technician, type TechnicianFormData } from '../../../../services/technicianManagementService'
import toast from 'react-hot-toast'
import { PEST_TYPES, PestType } from '../../../../utils/clickupFieldMapper' // ✅ Importerar från den korrekta källan

type TechnicianModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician?: Technician
}

const STAFF_ROLES = [
  'Skadedjurstekniker',
  'Koordinator',
  'Admin',
] as const

export default function TechnicianModal({ isOpen, onClose, onSuccess, technician }: TechnicianModalProps) {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [formData, setFormData] = useState<Partial<TechnicianFormData>>({})
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<PestType>>(new Set()) // ✅ State för kompetenser

  useEffect(() => {
    const loadData = async () => {
      if (technician) {
        setFormData({
          name: technician.name || '',
          role: technician.role || 'Skadedjurstekniker',
          email: technician.email || '',
          direct_phone: technician.direct_phone || '',
          office_phone: technician.office_phone || '',
          address: technician.address || '',
          abax_vehicle_id: technician.abax_vehicle_id || ''
        });
        // Hämta och sätt befintliga kompetenser
        const currentCompetencies = await technicianManagementService.getCompetencies(technician.id);
        setSelectedCompetencies(new Set(currentCompetencies));
      } else {
        // Återställ allt för en ny person
        setFormData({ name: '', role: 'Skadedjurstekniker', email: '', direct_phone: '', office_phone: '', address: '', abax_vehicle_id: '' });
        setSelectedCompetencies(new Set());
      }
      setPassword('');
    };

    if (isOpen) {
      loadData();
    }
  }, [technician, isOpen]);

  const handleCompetencyChange = (pest: PestType, isChecked: boolean) => {
    setSelectedCompetencies(prev => {
        const newSet = new Set(prev);
        if (isChecked) {
            newSet.add(pest);
        } else {
            newSet.delete(pest);
        }
        return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Namn och e-post är obligatoriska fält.");
      return;
    }
    setLoading(true);

    try {
      const competenciesArray = Array.from(selectedCompetencies);

      if (technician) {
        // Uppdatera befintlig personal
        await technicianManagementService.updateTechnician(technician.id, formData as TechnicianFormData);
        await technicianManagementService.updateCompetencies(technician.id, competenciesArray); // Spara kompetenser
        if (password.trim() && technician.user_id) {
          await technicianManagementService.updateUserPassword(technician.user_id, password);
        }
      } else {
        // Skapa ny personal - alla roller behandlas likadant och kräver inbjudan
        const newStaffMember = await technicianManagementService.createTechnician(formData as TechnicianFormData);
        await technicianManagementService.updateCompetencies(newStaffMember.id, competenciesArray);
      }
      
      toast.success(technician ? 'Personal uppdaterad!' : 'Personal skapad!');
      onSuccess();
      onClose();
    } catch (error) {
      // Fel hanteras av service
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="glass w-full max-w-2xl bg-slate-900/95 backdrop-blur-lg border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{technician ? 'Redigera Personal' : 'Lägg till Personal'}</h2>
              <p className="text-slate-400 text-sm">{technician ? 'Uppdatera personuppgifter och kompetenser' : 'Skapa ny person i systemet'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Grundläggande uppgifter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Namn *" name="name" value={formData.name || ''} onChange={handleChange} required placeholder="För- och efternamn" className="bg-slate-800/50 border-slate-600"/>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Roll *</label>
              <select name="role" value={formData.role || 'Skadedjurstekniker'} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white">
                {STAFF_ROLES.map(role => (<option key={role} value={role}>{role}</option>))}
              </select>
            </div>
          </div>
          <Input label="E-post *" name="email" type="email" value={formData.email || ''} onChange={handleChange} required placeholder="namn@begone.se" className="bg-slate-800/50 border-slate-600"/>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Direkt telefon" name="direct_phone" value={formData.direct_phone || ''} onChange={handleChange} placeholder="072-123 45 67" className="bg-slate-800/50 border-slate-600"/>
            <Input label="Växelnummer" name="office_phone" value={formData.office_phone || ''} onChange={handleChange} placeholder="010-123 45 67" className="bg-slate-800/50 border-slate-600"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Adress</label>
            <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white" placeholder="Fullständig adress"/>
          </div>

          {/* ✅ NY SEKTION: Kompetenser */}
          <div className="pt-4 border-t border-slate-700 space-y-3">
            <h3 className="text-md font-medium text-slate-300 flex items-center gap-2"><Wrench className="w-4 h-4 text-green-400"/>Kompetenser</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {PEST_TYPES.map(pest => (
                    <label key={pest} className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-green-500 focus:ring-green-500" checked={selectedCompetencies.has(pest)} onChange={(e) => handleCompetencyChange(pest, e.target.checked)} />
                        <span className="text-slate-300 text-sm">{pest}</span>
                    </label>
                ))}
            </div>
          </div>

          {/* System & Integrationer */}
          <div className="pt-4 border-t border-slate-700 space-y-4">
            <h3 className="text-md font-medium text-slate-300 flex items-center gap-2"><Key className="w-4 h-4 text-purple-400"/>System & Integrationer</h3>
            <Input label="Abax Vehicle ID" name="abax_vehicle_id" value={formData.abax_vehicle_id || ''} onChange={handleChange} icon={<Car className="w-4 h-4 text-slate-400"/>} placeholder="ID från Abax för ruttplanering" className="bg-slate-800/50 border-slate-600"/>
            {technician?.has_login && (<Input label="Ändra lösenord" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lämna tomt för att inte ändra" icon={<Key className="w-4 h-4 text-slate-400"/>} className="bg-slate-800/50 border-slate-600"/>)}
          </div>

          {/* BEVARAD Info-sektion om namnkonsistens */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-2"><AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" /><div className="text-blue-400 text-sm">{technician ? (<div><p className="font-medium mb-1">💡 Om namnändring</p><p>Om du ändrar namnet kommer systemet automatiskt att uppdatera alla befintliga ärenden för att bevara analytics-data och historik.</p></div>) : (<div><p className="font-medium mb-1">💡 Efter skapande</p><ul className="space-y-1 text-xs"><li>• Personen visas i alla analytics-dashboards</li><li>• Kan tilldelas ärenden i ClickUp</li><li>• Aktivera inloggning via "Aktivera Inloggning" knappen</li></ul></div>)}</div></div>
          </div>

          {/* BEVARAD Varning för namn-ändring */}
          {technician && formData.name !== technician.name && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4"><div className="flex items-start gap-2"><AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" /><div className="text-yellow-400 text-sm"><p className="font-medium mb-1">⚠️ Namnändring upptäckt</p><p>Namnet ändras från "{technician.name}" till "{formData.name}". Alla befintliga ärenden kommer att uppdateras automatiskt.</p></div></div></div>
          )}

          {/* Knappar */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">Avbryt</Button>
            <Button type="submit" loading={loading} disabled={loading} className="flex-1">{loading ? (<><LoadingSpinner className="w-4 h-4 mr-2" />{technician ? 'Uppdaterar...' : 'Skapar...'}</>) : (technician ? 'Uppdatera Personal' : 'Skapa Personal')}</Button>
          </div>

          {/* BEVARAD Debug info */}
          {process.env.NODE_ENV === 'development' && technician && (
            <div className="mt-4 p-3 bg-slate-800/50 border border-slate-600 rounded text-xs text-slate-400">
              <p><strong>Debug Info:</strong></p><p>ID: {technician.id}</p><p>Auth Status: {technician.has_login ? 'Har inloggning' : 'Ingen inloggning'}</p><p>Skapad: {new Date(technician.created_at).toLocaleString('sv-SE')}</p>{technician.updated_at !== technician.created_at && (<p>Uppdaterad: {new Date(technician.updated_at).toLocaleString('sv-SE')}</p>)}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
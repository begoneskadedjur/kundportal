// src/components/admin/technicians/management/TechnicianModal.tsx
// FULLSTÄNDIG VERSION MED KOMPETENSKARTA INTEGRERAD

import React, { useState, useEffect } from 'react'
import { User, Key, Car, Wrench, AlertCircle, Shield, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'

import { technicianManagementService, type Technician, type TechnicianFormData } from '../../../../services/technicianManagementService'
import toast from 'react-hot-toast'
import { ServiceCatalogService } from '../../../../services/servicesCatalogService'
import type { ServiceWithGroup } from '../../../../types/services'

type TechnicianModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician?: Technician
  allTechnicians?: Technician[]
}

const STAFF_ROLES = [
  'Skadedjurstekniker',
  'Koordinator',
  'Admin',
] as const

export default function TechnicianModal({ isOpen, onClose, onSuccess, technician, allTechnicians = [] }: TechnicianModalProps) {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [formData, setFormData] = useState<Partial<TechnicianFormData>>({})
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<string>>(new Set())
  const [bookingServices, setBookingServices] = useState<ServiceWithGroup[]>([])
  const [copyFromId, setCopyFromId] = useState<string>('')
  const [alsoAdmin, setAlsoAdmin] = useState(false)
  const [incidentRecipient, setIncidentRecipient] = useState(false)

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
          abax_vehicle_id: technician.abax_vehicle_id || '',
          display_name: technician.display_name || technician.name || ''
        });
        setAlsoAdmin(technician.is_admin || false);
        setIncidentRecipient(technician.incident_recipient || false);
        // Hämta och sätt befintliga kompetenser
        const currentCompetencies = await technicianManagementService.getCompetencies(technician.id);
        setSelectedCompetencies(new Set(currentCompetencies));
      } else {
        // Återställ allt för en ny person
        setFormData({ name: '', role: 'Skadedjurstekniker', email: '', direct_phone: '', office_phone: '', address: '', abax_vehicle_id: '' });
        setSelectedCompetencies(new Set());
        setAlsoAdmin(false);
        setIncidentRecipient(false);
      }
      setPassword('');
    };

    if (isOpen) {
      loadData();
      ServiceCatalogService.getAllBookingServices().then(setBookingServices).catch(() => {});
    }
  }, [technician, isOpen]);

  const handleCopyFrom = async (fromTechnicianId: string) => {
    if (!fromTechnicianId) return
    const competencies = await technicianManagementService.getCompetencies(fromTechnicianId)
    setSelectedCompetencies(prev => new Set([...prev, ...competencies]))
    setCopyFromId('')
  }

  const handleCompetencyChange = (pest: string, isChecked: boolean) => {
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
        await technicianManagementService.updateCompetencies(technician.id, competenciesArray);
        if (technician.has_login && formData.display_name && formData.display_name !== technician.display_name) {
          await technicianManagementService.updateDisplayName(technician.id, formData.display_name);
        }
        // Synka admin-behörighet om den ändrats
        if (technician.has_login) {
          const shouldBeAdmin = formData.role === 'Admin' || alsoAdmin;
          if (shouldBeAdmin !== (technician.is_admin || false)) {
            await technicianManagementService.toggleAdminAccess(technician.id, shouldBeAdmin);
          }
        }
        // Synka incident_recipient om ändrats
        if (technician.has_login && incidentRecipient !== (technician.incident_recipient || false)) {
          await supabase
            .from('profiles')
            .update({ incident_recipient: incidentRecipient })
            .eq('technician_id', technician.id)
        }
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
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
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
          {/* Admin-behörighet checkbox - visas om personen har inloggning och primär roll inte redan är Admin */}
          {technician?.has_login && formData.role !== 'Admin' && (
            <label className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
              <input
                type="checkbox"
                checked={alsoAdmin}
                onChange={(e) => setAlsoAdmin(e.target.checked)}
                className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="text-sm font-medium text-slate-300">Även admin-behörighet</span>
                  <p className="text-xs text-slate-500">Personen får tillgång till admin-panelen utöver sin primära roll</p>
                </div>
              </div>
            </label>
          )}
          {/* Incidentmottagare - visas om personen har inloggning */}
          {technician?.has_login && (
            <label className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
              <input
                type="checkbox"
                checked={incidentRecipient}
                onChange={(e) => setIncidentRecipient(e.target.checked)}
                className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-sm font-medium text-slate-300">Mottagare av tillbud & avvikelser</span>
                  <p className="text-xs text-slate-500">Får notiser och kan se detaljer vid inkomna tillbud och avvikelser</p>
                </div>
              </div>
            </label>
          )}
          <Input label="E-post *" name="email" type="email" value={formData.email || ''} onChange={handleChange} required placeholder="namn@begone.se" className="bg-slate-800/50 border-slate-600"/>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Direkt telefon" name="direct_phone" value={formData.direct_phone || ''} onChange={handleChange} placeholder="072-123 45 67" className="bg-slate-800/50 border-slate-600"/>
            <Input label="Växelnummer" name="office_phone" value={formData.office_phone || ''} onChange={handleChange} placeholder="010-123 45 67" className="bg-slate-800/50 border-slate-600"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Adress</label>
            <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white" placeholder="Fullständig adress"/>
          </div>

          {/* Kompetenser */}
          <div className="pt-4 border-t border-slate-700 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-md font-medium text-slate-300 flex items-center gap-2"><Wrench className="w-4 h-4 text-green-400"/>Kompetenser</h3>
              {allTechnicians.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={copyFromId}
                    onChange={(e) => { setCopyFromId(e.target.value); handleCopyFrom(e.target.value) }}
                    className="text-xs px-2 py-1 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  >
                    <option value="">Kopiera från...</option>
                    {allTechnicians
                      .filter(t => t.id !== technician?.id)
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                  </select>
                </div>
              )}
            </div>
            {bookingServices.length === 0 ? (
              <p className="text-slate-500 text-sm">Laddar tjänster...</p>
            ) : (
              (() => {
                // Gruppera per service_group
                const byGroup: Record<string, { groupName: string; services: ServiceWithGroup[] }> = {}
                bookingServices.forEach((svc) => {
                  const gid = svc.group_id || '__none__'
                  const gname = svc.group?.name || 'Övrigt'
                  if (!byGroup[gid]) byGroup[gid] = { groupName: gname, services: [] }
                  byGroup[gid].services.push(svc)
                })
                return (
                  <div className="space-y-3">
                    {Object.entries(byGroup).map(([gid, { groupName, services }]) => (
                      <div key={gid}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{groupName}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                          {services.map((svc) => (
                            <label key={svc.id} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
                                checked={selectedCompetencies.has(svc.name)}
                                onChange={(e) => handleCompetencyChange(svc.name, e.target.checked)}
                              />
                              <span className="text-slate-300 text-sm">{svc.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
          </div>

          {/* System & Integrationer */}
          <div className="pt-4 border-t border-slate-700 space-y-4">
            <h3 className="text-md font-medium text-slate-300 flex items-center gap-2"><Key className="w-4 h-4 text-purple-400"/>System & Integrationer</h3>
            {technician?.has_login && (
              <Input label="Visningsnamn" name="display_name" value={formData.display_name || ''} onChange={handleChange} icon={<User className="w-4 h-4 text-slate-400"/>} placeholder="Namn som visas i systemet" className="bg-slate-800/50 border-slate-600"/>
            )}
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
            <Button type="submit" loading={loading} disabled={loading} className="flex-1">{technician ? 'Uppdatera Personal' : 'Skapa Personal'}</Button>
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
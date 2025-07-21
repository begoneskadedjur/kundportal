// 📁 src/components/admin/technicians/EditCaseModal.tsx - KOMPLETT VERSION MED ALLA FUNKTIONER

import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { AlertCircle, CheckCircle, FileText, User, DollarSign, Clock, Play, Pause, RotateCcw, Save } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Modal from '../../ui/Modal'

interface TechnicianCase {
  id: string; case_type: 'private' | 'business' | 'contract'; title: string;
  description?: string; status: string; case_price?: number;
  kontaktperson?: string; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; personnummer?: string;
  material_cost?: number; time_spent_minutes?: number; work_started_at?: string | null;
}

interface EditCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedCase: Partial<TechnicianCase>) => void
  caseData: TechnicianCase | null
}

const statusOrder = [ 'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat' ];

const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || minutes < 1) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  let result = '';
  if (hours > 0) result += `${hours} tim `;
  result += `${remainingMinutes} min`;
  return result;
};

export default function EditCaseModal({ isOpen, onClose, onSuccess, caseData }: EditCaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentCase, setCurrentCase] = useState<TechnicianCase | null>(null)
  const [formData, setFormData] = useState<Partial<TechnicianCase>>({})

  useEffect(() => {
    if (caseData) {
      setCurrentCase(caseData);
      setFormData({
        title: caseData.title || '', status: caseData.status || '', description: caseData.description || '',
        kontaktperson: caseData.kontaktperson || '', telefon_kontaktperson: caseData.telefon_kontaktperson || '',
        e_post_kontaktperson: caseData.e_post_kontaktperson || '', case_price: caseData.case_price || 0,
        skadedjur: caseData.skadedjur || '', org_nr: caseData.org_nr || '', personnummer: caseData.personnummer || '',
        material_cost: caseData.material_cost || 0
      })
    }
  }, [caseData])

  const getTableName = () => {
    if (!currentCase) return null;
    return currentCase.case_type === 'private' ? 'private_cases' 
         : currentCase.case_type === 'business' ? 'business_cases' 
         : 'cases';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableName = getTableName();
    if (!tableName || !currentCase) return;
    setLoading(true);
    setError(null);

    try {
      const updateData: { [key: string]: any } = {
        title: formData.title,
        status: formData.status,
        description: formData.description,
      };

      if (tableName === 'private_cases' || tableName === 'business_cases') {
        updateData.kontaktperson = formData.kontaktperson;
        updateData.telefon_kontaktperson = formData.telefon_kontaktperson;
        updateData.e_post_kontaktperson = formData.e_post_kontaktperson;
        updateData.skadedjur = formData.skadedjur;
        updateData.pris = formData.case_price;
        updateData.material_cost = formData.material_cost;
      }

      if (tableName === 'private_cases') {
        updateData.personnummer = formData.personnummer;
      } else if (tableName === 'business_cases') {
        updateData.org_nr = formData.org_nr;
      } else if (tableName === 'cases') {
        updateData.price = formData.case_price;
      }

      const { error: updateError } = await supabase.from(tableName).update(updateData).eq('id', currentCase.id)
      if (updateError) throw updateError;
      
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onSuccess({ ...currentCase, ...formData });
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Update Error:', error);
      setError(`Fel vid uppdatering: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleTimeTracking = async (action: 'start' | 'pause' | 'reset') => {
    const tableName = getTableName();
    if (!tableName || !currentCase) return;
    setLoading(true);
    
    let updatePayload = {};

    if (action === 'start') {
        updatePayload = { work_started_at: new Date().toISOString() };
    } else if (action === 'pause' && currentCase.work_started_at) {
        const stopTime = new Date();
        const startTime = new Date(currentCase.work_started_at);
        const minutesWorked = (stopTime.getTime() - startTime.getTime()) / 1000 / 60;
        const newTotalMinutes = (currentCase.time_spent_minutes || 0) + minutesWorked;
        updatePayload = { work_started_at: null, time_spent_minutes: newTotalMinutes };
    } else if (action === 'reset') {
        updatePayload = { work_started_at: null, time_spent_minutes: 0 };
    }

    const { data, error } = await supabase.from(tableName).update(updatePayload).eq('id', currentCase.id).select().single();
        
    if (error) { setError(error.message); } 
    else { 
      setCurrentCase(data as TechnicianCase); 
      onSuccess(data as Partial<TechnicianCase>);
    }
    setLoading(false);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  }

  if (!currentCase) return null;

  if (submitted) {
    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Sparat!" size="md" preventClose={true}>
            <div className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Ärendet har uppdaterats</h3>
            </div>
        </Modal>
    );
  }

  const footer = ( 
    <div className="flex gap-3 p-6 bg-slate-800/50">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">Avbryt</Button>
      <Button type="submit" form="edit-case-form" loading={loading} disabled={loading} className="flex-1">Spara ändringar</Button>
    </div> 
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Redigera ärende: ${currentCase.title}`} size="xl" footer={footer} preventClose={loading}>
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <form id="edit-case-form" onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-500/20 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400" /><p className="text-red-400">{error}</p></div>}
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" />Ärendeinformation</h3>
            <Input label="Titel *" name="title" value={formData.title || ''} onChange={handleChange} required />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning</label>
              <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select name="status" value={formData.status || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white">
                  {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {currentCase.case_type !== 'contract' && <Input label="Skadedjur" name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} />}
            </div>
          </div>

          {currentCase.case_type !== 'contract' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2"><User className="w-5 h-5 text-green-400" />Kontaktinformation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Kontaktperson" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} />
                  {currentCase.case_type === 'business' && <Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />}
                  {currentCase.case_type === 'private' && <Input label="Personnummer" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Telefon" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} />
                  <Input label="E-post" name="e_post_kontaktperson" type="email" value={formData.e_post_kontaktperson || ''} onChange={handleChange} />
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-yellow-400" />Kostnader & Tid</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Ärendepris (exkl. material)" name="case_price" type="number" value={formData.case_price === null ? '' : formData.case_price} onChange={handleChange} />
              {currentCase.case_type !== 'contract' && <Input label="Materialkostnad" name="material_cost" type="number" value={formData.material_cost === null ? '' : formData.material_cost} onChange={handleChange} />}
            </div>
            {currentCase.case_type !== 'contract' && (
              <div className="p-4 bg-slate-800/50 rounded-lg">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Arbetstid</label>
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-2xl font-bold text-white">{formatMinutes(currentCase.time_spent_minutes)}</p>
                          {currentCase.work_started_at ? (
                             <p className="text-xs text-green-400 animate-pulse">
                                  Påbörjades kl. {new Date(currentCase.work_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </p>
                          ) : (
                             <p className="text-xs text-slate-400">{currentCase.time_spent_minutes > 0 ? "Pausad" : "Ej påbörjad"}</p>
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                          {currentCase.work_started_at ? (
                              <>
                                <Button type="button" variant="warning" onClick={() => handleTimeTracking('pause')} disabled={loading} className="flex items-center gap-2"><Pause className="w-4 h-4" /> Pausa</Button>
                                <Button type="button" variant="success" onClick={() => handleTimeTracking('pause')} disabled={loading} className="flex items-center gap-2"><Save className="w-4 h-4" /> Logga & Avsluta</Button>
                              </>
                          ) : (
                              <Button type="button" variant="secondary" onClick={() => handleTimeTracking('start')} disabled={loading} className="flex items-center gap-2"><Play className="w-4 h-4" /> {currentCase.time_spent_minutes > 0 ? 'Återuppta' : 'Påbörja arbete'}</Button>
                          )}
                          <Button type="button" variant="danger" onClick={() => handleTimeTracking('reset')} disabled={loading || (!currentCase.time_spent_minutes && !currentCase.work_started_at)} className="flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Nollställ</Button>
                      </div>
                  </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </Modal>
  )
}
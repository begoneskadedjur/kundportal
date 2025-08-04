// src/components/admin/coordinator/CreateAbsenceModal.tsx
// NY KOMPONENT FÖR ATT REGISTRERA FRÅNVARO

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Technician } from '../../../types/database';
import { CalendarOff, CheckCircle, AlertCircle } from 'lucide-react';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import toast from 'react-hot-toast';

import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import sv from 'date-fns/locale/sv';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('sv', sv);

// De vanligaste anledningarna till frånvaro
const ABSENCE_REASONS = [
  'Semester',
  'Sjukdom',
  'Vård av barn (VAB)',
  'Utbildning',
  'Tjänstledighet',
  'Föräldraledighet',
  'Admin', // ✅ NYTT - För hemarbete med offerter/admin-uppgifter
  'Övrigt'
];

interface CreateAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  technicians: Technician[];
}

export default function CreateAbsenceModal({ isOpen, onClose, onSuccess, technicians }: CreateAbsenceModalProps) {
  const [formData, setFormData] = useState({
    technician_id: '',
    start_date: null as Date | null,
    end_date: null as Date | null,
    reason: ABSENCE_REASONS[0],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        technician_id: '',
        start_date: null,
        end_date: null,
        reason: ABSENCE_REASONS[0],
        notes: ''
      });
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | null, field: 'start_date' | 'end_date') => {
    setFormData(prev => ({ ...prev, [field]: date }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { technician_id, start_date, end_date, reason } = formData;

    if (!technician_id || !start_date || !end_date || !reason) {
      toast.error('Tekniker, starttid, sluttid och anledning måste fyllas i.');
      return;
    }

    if (start_date >= end_date) {
        toast.error('Slutdatum måste vara efter startdatum.');
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('technician_absences')
        .insert([{ 
            technician_id, 
            start_date: start_date.toISOString(), 
            end_date: end_date.toISOString(), 
            reason,
            notes: formData.notes || null
        }]);

      if (insertError) throw insertError;

      toast.success(`Frånvaro för ${reason} har registrerats!`);
      onSuccess();
      onClose();

    } catch (err: any) {
      setError(`Fel vid registrering: ${err.message}`);
      toast.error('Kunde inte registrera frånvaro.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-end pt-4 border-t border-slate-800">
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Avbryt</Button>
        <Button type="submit" form="create-absence-form" loading={loading} disabled={loading} size="lg">
          <CheckCircle className="w-5 h-5 mr-2"/> Registrera Frånvaro
        </Button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrera frånvaro" size="xl" preventClose={loading} footer={footer}>
      <form id="create-absence-form" onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Tekniker *</label>
          <select 
            name="technician_id" 
            value={formData.technician_id} 
            onChange={handleChange} 
            required 
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
          >
            <option value="" disabled>Välj tekniker...</option>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Frånvaro startar *</label>
            <DatePicker
              selected={formData.start_date}
              onChange={(date) => handleDateChange(date, 'start_date')}
              locale="sv"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="yyyy-MM-dd HH:mm"
              timeCaption="Tid"
              timeInputLabel="Tid:"
              placeholderText="Välj startdatum och tid..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Frånvaro slutar *</label>
            <DatePicker
              selected={formData.end_date}
              onChange={(date) => handleDateChange(date, 'end_date')}
              locale="sv"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="yyyy-MM-dd HH:mm"
              timeCaption="Tid"
              timeInputLabel="Tid:"
              placeholderText="Välj slutdatum och tid..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Anledning *</label>
          <select 
            name="reason" 
            value={formData.reason} 
            onChange={handleChange} 
            required 
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
          >
            {ABSENCE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Anteckningar (frivilligt)</label>
          <textarea 
            name="notes" 
            value={formData.notes} 
            onChange={handleChange} 
            rows={3} 
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" 
            placeholder="T.ex. specifika tider för läkarbesök, resmål etc."
          />
        </div>
      </form>
    </Modal>
  );
}
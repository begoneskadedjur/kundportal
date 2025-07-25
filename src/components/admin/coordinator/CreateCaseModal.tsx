// src/components/admin/coordinator/CreateCaseModal.tsx
// VERSION 2.5 - ANVÄNDER ANPASSAD SVENSK DATUMVÄLJARE

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician } from '../../../types/database';
import { Building, User, Zap, MapPin, CheckCircle, PlusCircle, ChevronLeft, AlertCircle, FileText, Users } from 'lucide-react';
import { PEST_TYPES } from '../../../utils/clickupFieldMapper';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../shared/LoadingSpinner';

// ✅ NYA IMPORTER FÖR DATUMVÄLJAREN
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import "react-datepicker/dist/react-datepicker.css"

registerLocale('sv', sv) // Registrera svenskt språk

// Hjälpfunktion för färgkodning av restid
const getTravelTimeColor = (minutes: number): string => {
  if (minutes <= 20) return 'text-green-400';
  if (minutes <= 35) return 'text-blue-400';
  if (minutes <= 60) return 'text-orange-400';
  return 'text-red-400';
};

// Datatyper
interface Suggestion {
  technician_id: string; technician_name: string;
  start_time: string; end_time: string;
  travel_time_minutes: number; origin_description: string;
}
interface CreateCaseModalProps {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
  technicians: Technician[];
}

export default function CreateCaseModal({ isOpen, onClose, onSuccess, technicians }: CreateCaseModalProps) {
  const [step, setStep] = useState<'selectType' | 'form'>('selectType');
  const [caseType, setCaseType] = useState<'private' | 'business' | null>(null);
  const [formData, setFormData] = useState<Partial<PrivateCasesInsert & BusinessCasesInsert>>({});
  const [timeSlotDuration, setTimeSlotDuration] = useState(120);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  
  // ✅ ÄNDRAT STATE FÖR DATUMVÄLJAREN
  const [searchStartDate, setSearchStartDate] = useState<Date | null>(new Date());
  
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);

  const handleReset = useCallback(() => {
    setStep('selectType'); setCaseType(null); setFormData({}); setSuggestions([]);
    setError(null); setLoading(false); setSubmitted(false); setSuggestionLoading(false);
    setSearchStartDate(new Date()); // ✅ Återställ till dagens datum
    setSelectedTechnicianIds([]);
  }, []);

  useEffect(() => {
    if (isOpen) {
        handleReset();
        if (technicians.length > 0) {
            setSelectedTechnicianIds(technicians.map(t => t.id));
        }
    }
  }, [isOpen, handleReset, technicians]);

  const selectCaseType = (type: 'private' | 'business') => {
    setCaseType(type);
    setFormData({ status: 'Bokad' });
    setStep('form');
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'kontaktperson') {
        setFormData(prev => ({ ...prev, [name]: value, title: value }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTechnicianSelectionChange = (technicianId: string) => {
    setSelectedTechnicianIds(prev =>
      prev.includes(technicianId)
        ? prev.filter(id => id !== technicianId)
        : [...prev, technicianId]
    );
  };
  
  // ✅ NY HANTERARE FÖR DATUMVÄLJAREN
  const handleDateChange = (date: Date | null) => {
    setSearchStartDate(date);
  };

  const handleSuggestTime = async () => {
    if (!formData.adress || !formData.skadedjur) {
      toast.error('Adress och Skadedjur måste vara ifyllda.');
      return;
    }
    setSuggestionLoading(true);
    setSuggestions([]);
    setError(null);
    try {
      const response = await fetch('/api/ruttplanerare/booking-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newCaseAddress: formData.adress,
            pestType: formData.skadedjur,
            timeSlotDuration: timeSlotDuration,
            // ✅ FORMATERA DATUMET KORREKT FÖR API:ET
            searchStartDate: searchStartDate ? searchStartDate.toISOString().split('T')[0] : null,
            selectedTechnicianIds: selectedTechnicianIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Något gick fel.');
      setSuggestions(data);
      if (data.length === 0) toast.success('Inga optimala tider hittades för de valda teknikerna.');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSuggestionLoading(false);
    }
  };
  
  const applySuggestion = (suggestion: Suggestion) => {
    setFormData(prev => ({
      ...prev,
      start_date: suggestion.start_time,
      due_date: suggestion.end_time,
      primary_assignee_id: suggestion.technician_id,
    }));
    const startTimeFormatted = new Date(suggestion.start_time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    toast.success(`${suggestion.technician_name} vald för ${new Date(suggestion.start_time).toLocaleDateString('sv-SE')} kl. ${startTimeFormatted}`);
  };

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    if (!caseType || !formData.title || !formData.start_date || !formData.due_date || !formData.primary_assignee_id) {
        toast.error("Alla fält under 'Bokning & Detaljer' måste vara ifyllda.");
        return;
    }
    setLoading(true);
    setError(null);
    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';
      await supabase.from(tableName).insert([{ ...formData, title: formData.title.trim() }]);
      setSubmitted(true);
      toast.success('Ärendet har skapats!');
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      setError(`Fel vid skapande: ${err.message}`);
      toast.error('Kunde inte skapa ärendet.');
    } finally {
      setLoading(false);
    }
  };

  const formatForInput = (isoString?: string): string => { 
    if (!isoString) return '';
    const date = new Date(isoString);
    const ten = (n: number) => (n < 10 ? '0' : '') + n;
    return `${date.getFullYear()}-${ten(date.getMonth() + 1)}-${ten(date.getDate())}T${ten(date.getHours())}:${ten(date.getMinutes())}`;
  };

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Skapat!" size="md" preventClose={true}>
        <div className="p-8 text-center"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" /><h3 className="text-xl font-semibold text-white mb-2">Ärendet har skapats</h3><p className="text-slate-400">Det nya ärendet kommer nu synas i schemat.</p></div>
      </Modal>
    );
  }

  const footer = step === 'form' ? (
    <div className="flex justify-end pt-4 border-t border-slate-800">
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Avbryt</Button>
        <Button type="submit" form="create-case-form" loading={loading} disabled={loading} size="lg">
          <CheckCircle className="w-5 h-5 mr-2"/> Skapa & Boka Ärende
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 'selectType' ? 'Välj kundtyp' : `Nytt ärende: ${caseType === 'private' ? 'Privatperson' : 'Företag'}`} size={step === 'form' ? "3xl" : "md"} preventClose={loading} footer={footer}>
      <div className="p-6 max-h-[85vh] overflow-y-auto">
        {step === 'selectType' && (
            <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => selectCaseType('private')} className="flex-1 p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"><User className="w-12 h-12 mx-auto mb-4 text-blue-400" /><h3 className="text-xl font-bold">Privatperson</h3></button>
                <button onClick={() => selectCaseType('business')} className="flex-1 p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"><Building className="w-12 h-12 mx-auto mb-4 text-green-400" /><h3 className="text-xl font-bold">Företag</h3></button>
            </div>
        )}
        {step === 'form' && (
          <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white -ml-2"><ChevronLeft className="w-4 h-4" /> Byt kundtyp</Button>
            {error && (<div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400">{error}</p></div>)}
            
            <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg space-y-4">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2"><Zap className="text-blue-400"/>Intelligent Bokning</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="Adress *" name="adress" placeholder="Fullständig adress..." value={formData.adress || ''} onChange={handleChange} required />
                 {/* ✅ ERSATT MED DEN NYA DATUMVÄLJAREN */}
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Hitta tider från datum:</label>
                    <DatePicker
                        selected={searchStartDate}
                        onChange={handleDateChange}
                        locale="sv"
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Välj startdatum..."
                        isClearable
                    />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Skadedjur *</label>
                  <select name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                      <option value="" disabled>Välj typ...</option>
                      {PEST_TYPES.map(pest => <option key={pest} value={pest}>{pest}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tidsåtgång</label>
                  <select value={timeSlotDuration} onChange={e => setTimeSlotDuration(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                      <option value={120}>2 timmar (standard)</option><option value={60}>1 timme</option><option value={90}>1.5 timmar</option><option value={180}>3 timmar</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-600">
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Users size={16} /> Sök endast bland valda tekniker
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {technicians.map(tech => (
                    <label key={tech.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500"
                        checked={selectedTechnicianIds.includes(tech.id)}
                        onChange={() => handleTechnicianSelectionChange(tech.id)}
                      />
                      <span className="text-sm text-white">{tech.name}</span>
                    </label>
                  ))}
                </div>
              </div>

               <Button type="button" onClick={handleSuggestTime} loading={suggestionLoading} className="w-full" variant="primary" size="lg"><Zap className="w-4 h-4 mr-2"/> Hitta bästa tid & tekniker</Button>
               {suggestionLoading && <div className="text-center"><LoadingSpinner text="Analyserar rutter och kompetenser..." /></div>}
              
               {suggestions.length > 0 && (
                 <div className="pt-4 border-t border-slate-700 space-y-2">
                   <h4 className="text-md font-medium text-slate-300">Bokningsförslag:</h4>
                   {suggestions.map((sugg, index) => {
                     const travelColor = getTravelTimeColor(sugg.travel_time_minutes);
                     return (
                       <div key={`${sugg.technician_id}-${sugg.start_time}-${index}`} className="p-3 rounded-md bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => applySuggestion(sugg)}>
                         <div className="flex justify-between items-center">
                           <div className="font-semibold text-white">{sugg.technician_name}</div>
                           <div className={`text-sm font-bold flex items-center gap-1.5 ${travelColor}`}>
                             <MapPin size={12}/> {sugg.travel_time_minutes} min restid
                           </div>
                         </div>
                         <div className="text-sm text-slate-300 font-medium">{new Date(sugg.start_time).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                         <div className="text-lg font-bold text-white mt-1">{formatTime(sugg.start_time)} - {formatTime(sugg.end_time)}</div>
                         <div className="text-xs text-slate-400 mt-1">Från: {sugg.origin_description}</div>
                       </div>
                     );
                   })}
                 </div>
               )}
            </div>
            
            <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg space-y-4">
                <h3 className="font-semibold text-white text-lg flex items-center gap-2"><FileText className="text-green-400"/>Bokning & Detaljer</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Kontaktperson *" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} required />
                  <Input label="Telefonnummer *" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} required />
                </div>
                 {caseType === 'private' ? (<Input label="Personnummer" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} />) : (<Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input type="datetime-local" label="Starttid *" name="start_date" value={formatForInput(formData.start_date)} onChange={handleChange} required />
                  <Input type="datetime-local" label="Sluttid *" name="due_date" value={formatForInput(formData.due_date)} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tekniker *</label>
                  <select name="primary_assignee_id" value={formData.primary_assignee_id || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                      <option value="" disabled>Välj tekniker...</option>
                      {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <Input label="Ärendetitel (auto-ifylls från namn)" name="title" value={formData.title || ''} onChange={handleChange} required />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning till tekniker</label>
                  <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" placeholder="Kort om ärendet, portkod, etc."/>
                </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
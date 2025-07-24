// src/components/admin/coordinator/CreateCaseModal.tsx
// KORRIGERAD FÖR ATT HANTERA DEN NYA FÖRSLAGS-STRUKTUREN FRÅN API:ET

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician } from '../../../types/database';
import { Building, User, Zap, MapPin, CheckCircle, PlusCircle, ChevronLeft, AlertCircle } from 'lucide-react';
import { PEST_TYPES } from '../../../utils/clickupFieldMapper';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../shared/LoadingSpinner';

// ✅ NY DATATYP FÖR FÖRSLAG
interface Suggestion {
  technician_id: string;
  technician_name: string;
  start_time: string; // ISO format
  end_time: string;   // ISO format
  travel_time_minutes: number;
  origin_description: string; // "Hemadress" eller "Ärende: X"
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

  const handleReset = useCallback(() => {
    setStep('selectType'); setCaseType(null); setFormData({}); setSuggestions([]);
    setError(null); setLoading(false); setSubmitted(false); setSuggestionLoading(false);
  }, []);

  useEffect(() => { if (isOpen) handleReset(); }, [isOpen, handleReset]);

  const selectCaseType = (type: 'private' | 'business') => {
    setCaseType(type);
    const initialTitle = type === 'private' ? 'Privat sanering' : 'Företag sanering';
    setFormData({ title: initialTitle, status: 'Bokad' });
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

  const handleSuggestTime = async () => {
    if (!formData.adress || !formData.skadedjur) {
      toast.error('Adress och Skadedjur måste vara ifyllda för att få förslag.');
      return;
    }
    setSuggestionLoading(true);
    setSuggestions([]);
    setError(null);
    try {
      const response = await fetch('/api/ruttplanerare/booking-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCaseAddress: formData.adress, pestType: formData.skadedjur })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Något gick fel.');
      setSuggestions(data);
      if (data.length === 0) toast.success('Inga optimala rutter hittades för den valda kompetensen.');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSuggestionLoading(false);
    }
  };
  
  // ✅ UPPDATERAD FÖR ATT ANVÄNDA DEN NYA STRUKTUREN
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
    if (!caseType) return;
    setLoading(true);
    setError(null);
    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';
      if (!formData.title || !formData.start_date || !formData.due_date || !formData.primary_assignee_id) {
          throw new Error("Titel, start/sluttid och tekniker måste vara ifyllda.");
      }
      await supabase.from(tableName).insert([formData]);
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

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Skapat!" size="md" preventClose={true}>
        <div className="p-8 text-center"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" /><h3 className="text-xl font-semibold text-white mb-2">Ärendet har skapats</h3><p className="text-slate-400">Det nya ärendet kommer nu synas i schemat.</p></div>
      </Modal>
    );
  }

  const footer = step === 'form' ? (
    <div className="flex gap-3 p-6 bg-slate-800/50">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">Avbryt</Button>
      <Button type="submit" form="create-case-form" loading={loading} disabled={loading} className="flex-1"><PlusCircle className="w-4 h-4 mr-2" />Skapa Ärende</Button>
    </div>
  ) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 'selectType' ? 'Skapa nytt ärende' : `Nytt ärende: ${caseType === 'private' ? 'Privatperson' : 'Företag'}`} size="2xl" footer={footer} preventClose={loading}>
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {step === 'selectType' && (
            <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => selectCaseType('private')} className="flex-1 p-8 bg-slate-800 hover:bg-slate-700/80 rounded-lg text-center transition-all duration-200 border-2 border-slate-700 hover:border-blue-500"><User className="w-12 h-12 mx-auto mb-4 text-blue-400" /><h3 className="text-xl font-bold text-white">Privatperson</h3><p className="text-slate-400">Skapa ett nytt saneringsärende för en privatperson.</p></button>
                <button onClick={() => selectCaseType('business')} className="flex-1 p-8 bg-slate-800 hover:bg-slate-700/80 rounded-lg text-center transition-all duration-200 border-2 border-slate-700 hover:border-green-500"><Building className="w-12 h-12 mx-auto mb-4 text-green-400" /><h3 className="text-xl font-bold text-white">Företag</h3><p className="text-slate-400">Skapa ett nytt saneringsärende för ett företag.</p></button>
            </div>
        )}
        {step === 'form' && (
            <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /> Tillbaka till val av typ</Button>
                {error && (<div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400">{error}</p></div>)}
                <div className="space-y-4 p-4 border border-slate-700 rounded-lg">
                    <h3 className="text-lg font-medium text-white">Kund- & Adressinformation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Kontaktperson *" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} required />
                        <Input label="Telefonnummer *" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} required />
                    </div>
                    {caseType === 'private' ? (<Input label="Personnummer" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} />) : (<Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />)}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Adress *</label>
                        <textarea name="adress" value={formData.adress || ''} onChange={handleChange} required rows={3} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white" placeholder="Fullständig adress..." />
                        {/* ✅ UPPDATERAD: Nytt fält för skadedjur här */}
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Skadedjur *</label>
                            <select name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white">
                                <option value="" disabled>Välj typ...</option>
                                {PEST_TYPES.map(pest => <option key={pest} value={pest}>{pest}</option>)}
                            </select>
                        </div>
                        <div className="mt-2">
                            <Button type="button" variant="link" onClick={handleSuggestTime} loading={suggestionLoading} className="text-sm"><Zap className="w-4 h-4 mr-1"/> Föreslå tid för bokning</Button>
                        </div>
                    </div>
                </div>

                {suggestionLoading && <div className="text-center"><LoadingSpinner text="Analyserar rutter och kompetenser..." /></div>}
                {suggestions.length > 0 && (
                    <div className="space-y-3 p-4 border border-blue-500/50 bg-blue-500/10 rounded-lg">
                         <h3 className="text-md font-medium text-blue-300">Intelligenta bokningsförslag</h3>
                         {suggestions.map((sugg, index) => (
                            <div key={`${sugg.technician_id}-${sugg.start_time}-${index}`} className="p-3 rounded-md cursor-pointer transition-colors bg-slate-800 hover:bg-slate-700" onClick={() => applySuggestion(sugg)}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-white">{sugg.technician_name}</p>
                                        <p className="text-sm text-slate-300">{new Date(sugg.start_time).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour:'2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-blue-300 font-bold flex items-center gap-1"><MapPin size={12}/> {sugg.travel_time_minutes} min restid</p>
                                        <p className="text-xs text-slate-400">Från: {sugg.origin_description}</p>
                                    </div>
                                </div>
                            </div>
                         ))}
                    </div>
                )}

                 <div className="space-y-4 p-4 border border-slate-700 rounded-lg">
                    <h3 className="text-lg font-medium text-white">Schemaläggning & Detaljer</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Tidsåtgång</label>
                            <select value={timeSlotDuration} onChange={e => setTimeSlotDuration(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white">
                                <option value={120}>2 timmar (standard)</option><option value={60}>1 timme</option><option value={90}>1.5 timmar</option><option value={180}>3 timmar</option>
                            </select>
                       </div>
                       <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Tekniker *</label>
                            <select name="primary_assignee_id" value={formData.primary_assignee_id || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white">
                                <option value="" disabled>Välj en tekniker...</option>
                                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input type="datetime-local" label="Starttid *" name="start_date" value={formatForInput(formData.start_date)} onChange={handleChange} required />
                        <Input type="datetime-local" label="Sluttid *" name="due_date" value={formatForInput(formData.due_date)} onChange={handleChange} required />
                    </div>
                     <Input label="Ärendetitel (auto-ifylls från namn)" name="title" value={formData.title || ''} onChange={handleChange} required />
                     <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning till tekniker</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white" placeholder="Kort om ärendet, portkod, etc."/>
                     </div>
                </div>
            </form>
        )}
      </div>
    </Modal>
  );
}
// 📁 src/components/admin/coordinator/CreateCaseModal.tsx
// Helt ny komponent för att skapa ärenden direkt från schemavyn.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician } from '../../../types/database';
import { Building, User, Clock, Zap, MapPin, ArrowRight, Check, AlertCircle, CheckCircle, PlusCircle, ChevronLeft } from 'lucide-react';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import toast from 'react-hot-toast';

// --- Datatyper ---

// Förslag från bokningsassistenten
interface Suggestion {
  technician_id: string;
  technician_name: string;
  date: string; // YYYY-MM-DD
  suggested_time: string; // t.ex. "Efter kl. 14:00"
  travel_time_minutes: number;
  based_on_case: {
    id: string;
    title: string;
  };
}

// Props för komponenten
interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  technicians: Technician[];
  initialDate?: Date; // Om man klickar i kalendern kan man skicka med ett startdatum
}

// --- Komponent ---

export default function CreateCaseModal({ isOpen, onClose, onSuccess, technicians, initialDate }: CreateCaseModalProps) {
  // Steg i modalen: null -> 'selectType', 'form'
  const [step, setStep] = useState<'selectType' | 'form'>('selectType');
  const [caseType, setCaseType] = useState<'private' | 'business' | null>(null);

  // Formulärdata
  const [formData, setFormData] = useState<Partial<PrivateCasesInsert & BusinessCasesInsert>>({});
  const [timeSlotDuration, setTimeSlotDuration] = useState(120); // Standard 2 timmar

  // Status-states
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bokningsassistent-states
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Återställ allt när modalen stängs eller byter typ
  const handleReset = useCallback(() => {
    setStep('selectType');
    setCaseType(null);
    setFormData({});
    setSuggestions([]);
    setError(null);
    setLoading(false);
    setSubmitted(false);
    setSuggestionLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      handleReset();
    }
  }, [isOpen, handleReset]);

  // Välj ärendetyp och gå till formuläret
  const selectCaseType = (type: 'private' | 'business') => {
    setCaseType(type);
    const initialTitle = type === 'private' ? 'Privat sanering' : 'Företag sanering';
    setFormData({ title: initialTitle, status: 'Bokad' });
    setStep('form');
  };

  // Generell funktion för att hantera ändringar i formulärfält
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  // Anropa API för bokningsassistenten
  const handleSuggestTime = async () => {
    if (!formData.adress) {
      toast.error('Du måste ange en adress först.');
      return;
    }
    setSuggestionLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await fetch('/api/ruttplanerare/booking-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCaseAddress: formData.adress })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Något gick fel med förslagen.');
      
      setSuggestions(data);
      if (data.length === 0) {
        toast.success('Inga närliggande ärenden hittades att basera förslag på.');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSuggestionLoading(false);
    }
  };
  
  // Funktion för att applicera ett valt förslag till formuläret
  const applySuggestion = (suggestion: Suggestion) => {
    const startTimeString = suggestion.suggested_time.replace('Efter kl. ', '');
    const [hours, minutes] = startTimeString.split(':').map(Number);
    
    const startDate = new Date(suggestion.date);
    startDate.setUTCHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate.getTime() + timeSlotDuration * 60000);

    setFormData(prev => ({
      ...prev,
      start_date: startDate.toISOString(),
      due_date: endDate.toISOString(),
      primary_assignee_id: suggestion.technician_id,
    }));

    toast.success(`${suggestion.technician_name} vald för ${startDate.toLocaleDateString('sv-SE')} kl. ${startTimeString}`);
  };

  // Skicka in formuläret för att skapa ärendet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseType) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';
      
      // Validera att obligatoriska fält finns
      if (!formData.title || !formData.start_date || !formData.due_date || !formData.primary_assignee_id) {
          throw new Error("Titel, start/sluttid och tekniker måste vara ifyllda.");
      }

      const { error: insertError } = await supabase
        .from(tableName)
        .insert([formData]);
        
      if (insertError) throw insertError;
      
      setSubmitted(true);
      toast.success('Ärendet har skapats!');
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
      
    } catch (err: any) {
      setError(`Fel vid skapande: ${err.message}`);
      toast.error('Kunde inte skapa ärendet.');
    } finally {
      setLoading(false);
    }
  };

  // Formatera datum för datetime-local input
  const formatForInput = (isoString?: string): string => {
      if (!isoString) return '';
      const date = new Date(isoString);
      // Justera för tidszon, annars kan datumet bli fel
      const ten = (n: number) => (n < 10 ? '0' : '') + n;
      return `${date.getFullYear()}-${ten(date.getMonth() + 1)}-${ten(date.getDate())}T${ten(date.getHours())}:${ten(date.getMinutes())}`;
  };

  // --- Renderingslogik ---

  // Visa en bekräftelseskärm efter att ärendet har skapats
  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Skapat!" size="md" preventClose={true}>
        <div className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Ärendet har skapats</h3>
          <p className="text-slate-400">Det nya ärendet kommer nu synas i schemat.</p>
        </div>
      </Modal>
    );
  }

  const footer = step === 'form' ? (
    <div className="flex gap-3 p-6 bg-slate-800/50">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
        Avbryt
      </Button>
      <Button type="submit" form="create-case-form" loading={loading} disabled={loading} className="flex-1">
        <PlusCircle className="w-4 h-4 mr-2" />
        Skapa Ärende
      </Button>
    </div>
  ) : null;

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={step === 'selectType' ? 'Skapa nytt ärende' : `Nytt ärende: ${caseType === 'private' ? 'Privatperson' : 'Företag'}`} 
        size="2xl" 
        footer={footer}
        preventClose={loading}
    >
        <div className="p-6 max-h-[70vh] overflow-y-auto">
            {step === 'selectType' && (
                <div className="flex flex-col md:flex-row gap-4">
                    <button onClick={() => selectCaseType('private')} className="flex-1 p-8 bg-slate-800 hover:bg-slate-700/80 rounded-lg text-center transition-all duration-200 border-2 border-slate-700 hover:border-blue-500">
                        <User className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                        <h3 className="text-xl font-bold text-white">Privatperson</h3>
                        <p className="text-slate-400">Skapa ett nytt saneringsärende för en privatperson.</p>
                    </button>
                    <button onClick={() => selectCaseType('business')} className="flex-1 p-8 bg-slate-800 hover:bg-slate-700/80 rounded-lg text-center transition-all duration-200 border-2 border-slate-700 hover:border-green-500">
                        <Building className="w-12 h-12 mx-auto mb-4 text-green-400" />
                        <h3 className="text-xl font-bold text-white">Företag</h3>
                        <p className="text-slate-400">Skapa ett nytt saneringsärende för ett företag.</p>
                    </button>
                </div>
            )}

            {step === 'form' && (
                <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
                    <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white">
                        <ChevronLeft className="w-4 h-4" /> Tillbaka till val av typ
                    </Button>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}
                    
                    {/* --- Kärninformation --- */}
                    <div className="space-y-4 p-4 border border-slate-700 rounded-lg">
                        <h3 className="text-lg font-medium text-white">Kund- & Adressinformation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Kontaktperson *" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} required />
                            <Input label="Telefonnummer *" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} required />
                        </div>
                        {caseType === 'private' ? (
                            <Input label="Personnummer" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} />
                        ) : (
                            <Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Adress *</label>
                            <textarea name="adress" value={formData.adress || ''} onChange={handleChange} required rows={3} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500" placeholder="Fullständig adress..." />
                            <div className="mt-2">
                                <Button type="button" variant="link" onClick={handleSuggestTime} loading={suggestionLoading} className="text-sm">
                                    <Zap className="w-4 h-4 mr-1"/> Föreslå tid för bokning
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* --- Bokningsassistentens förslag --- */}
                    {suggestions.length > 0 && (
                        <div className="space-y-3 p-4 border border-blue-500/50 bg-blue-500/10 rounded-lg">
                             <h3 className="text-md font-medium text-blue-300">Intelligenta bokningsförslag</h3>
                             {suggestions.map((sugg, index) => (
                                <div key={sugg.based_on_case.id} className={`p-3 rounded-md cursor-pointer transition-colors ${index === 0 ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'bg-slate-800 hover:bg-slate-700'}`} onClick={() => applySuggestion(sugg)}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-white">{sugg.technician_name}</p>
                                            <p className="text-sm text-slate-300">{new Date(sugg.date).toLocaleDateString('sv-SE', { weekday: 'long' })} {sugg.suggested_time}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-blue-300 font-bold flex items-center gap-1"><MapPin size={12}/> {sugg.travel_time_minutes} min restid</p>
                                            <p className="text-xs text-slate-400">från "{sugg.based_on_case.title}"</p>
                                        </div>
                                    </div>
                                </div>
                             ))}
                        </div>
                    )}

                    {/* --- Schemaläggning & Ärendedetaljer --- */}
                     <div className="space-y-4 p-4 border border-slate-700 rounded-lg">
                        <h3 className="text-lg font-medium text-white">Schemaläggning & Detaljer</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Tidsåtgång</label>
                                <select value={timeSlotDuration} onChange={e => setTimeSlotDuration(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                                    <option value={60}>1 timme</option>
                                    <option value={90}>1.5 timmar</option>
                                    <option value={120}>2 timmar (standard)</option>
                                    <option value={180}>3 timmar</option>
                                </select>
                           </div>
                           <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Tekniker *</label>
                                <select name="primary_assignee_id" value={formData.primary_assignee_id || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                                    <option value="" disabled>Välj en tekniker...</option>
                                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Starttid *</label>
                                <input type="datetime-local" name="start_date" value={formatForInput(formData.start_date)} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Sluttid *</label>
                                <input type="datetime-local" name="due_date" value={formatForInput(formData.due_date)} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>
                         <Input label="Ärendetitel *" name="title" value={formData.title || ''} onChange={handleChange} required />
                         <Input label="Vilket skadedjur?" name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} placeholder="T.ex. Råttor, Kackerlackor..." />
                    </div>

                </form>
            )}
        </div>
    </Modal>
  );
}
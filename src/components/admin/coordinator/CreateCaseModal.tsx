import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician } from '../../../types/database';
import { Building, User, Zap, MapPin, CheckCircle, ChevronLeft, AlertCircle, FileText, Users, Star, ThumbsUp, Meh, ThumbsDown, Home } from 'lucide-react';
import { PEST_TYPES } from '../../../utils/clickupFieldMapper';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../shared/LoadingSpinner';

import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import sv from 'date-fns/locale/sv';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('sv', sv);

// --- Hjälpfunktioner för visning ---

const getTravelTimeColor = (minutes: number): string => {
  if (minutes <= 20) return 'text-green-400';
  if (minutes <= 35) return 'text-sky-400';
  if (minutes <= 60) return 'text-orange-400';
  return 'text-red-400';
};

const getEfficiencyScoreInfo = (score: number): { text: string; color: string; icon: React.ReactNode } => {
    if (score >= 100) return { text: 'Utmärkt', color: 'text-green-400', icon: <Star size={14} /> };
    if (score >= 85) return { text: 'Bra', color: 'text-sky-400', icon: <ThumbsUp size={14} /> };
    if (score >= 60) return { text: 'OK', color: 'text-orange-400', icon: <Meh size={14} /> };
    return { text: 'Låg', color: 'text-red-400', icon: <ThumbsDown size={14} /> };
};

interface Suggestion {
    technician_id: string;
    technician_name: string;
    start_time: string;
    end_time: string;
    travel_time_minutes: number;
    origin_description: string;
    efficiency_score: number;
    travel_time_home_minutes?: number;
}

const SuggestionDescription = ({ sugg }: { sugg: Suggestion }) => {
    return (
        <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">
            {sugg.origin_description}
        </p>
    );
};

interface CreateCaseModalProps { isOpen: boolean; onClose: () => void; onSuccess: () => void; technicians: Technician[]; }

export default function CreateCaseModal({ isOpen, onClose, onSuccess, technicians }: CreateCaseModalProps) {
  const [step, setStep] = useState<'selectType' | 'form'>('selectType');
  const [caseType, setCaseType] = useState<'private' | 'business' | null>(null);
  const [formData, setFormData] = useState<Partial<PrivateCasesInsert & BusinessCasesInsert>>({});
  const [timeSlotDuration, setTimeSlotDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [searchStartDate, setSearchStartDate] = useState<Date | null>(new Date());
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);

  const handleReset = useCallback(() => {
    setStep('selectType'); setCaseType(null); setFormData({}); setSuggestions([]);
    setError(null); setLoading(false); setSubmitted(false); setSuggestionLoading(false);
    setSearchStartDate(new Date()); setSelectedTechnicianIds([]);
  }, []);

  useEffect(() => {
    if (isOpen) {
        handleReset();
        if (technicians.length > 0) {
            const defaultSelectedTechnicians = technicians.filter(tech => tech.role === 'Skadedjurstekniker');
            setSelectedTechnicianIds(defaultSelectedTechnicians.map(t => t.id));
        }
    }
  }, [isOpen, handleReset, technicians]);

  const selectCaseType = (type: 'private' | 'business') => {
    setCaseType(type); setFormData({ status: 'Bokad' }); setStep('form');
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'kontaktperson' && { title: value }) }));
  };

  const handleTechnicianSelectionChange = (technicianId: string) => {
    setSelectedTechnicianIds(prev => prev.includes(technicianId) ? prev.filter(id => id !== technicianId) : [...prev, technicianId]);
  };

  const handleDateChange = (date: Date | null, fieldName: 'searchStartDate' | 'start_date' | 'due_date') => {
    if (fieldName === 'searchStartDate') { setSearchStartDate(date);
    } else { const isoString = date ? date.toISOString() : null; setFormData(prev => ({ ...prev, [fieldName]: isoString })); }
  };
  
  const handleSuggestTime = async () => {
    if (!formData.adress || !formData.skadedjur) { return toast.error('Adress och Skadedjur måste vara ifyllda.'); }
    setSuggestionLoading(true); setSuggestions([]); setError(null);
    try {
      const response = await fetch('/api/ruttplanerare/booking-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newCaseAddress: formData.adress, pestType: formData.skadedjur,
            timeSlotDuration: timeSlotDuration, searchStartDate: searchStartDate ? searchStartDate.toISOString().split('T')[0] : null,
            selectedTechnicianIds: selectedTechnicianIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Något gick fel.');
      setSuggestions(data);
      if (data.length === 0) toast.success('Inga optimala tider hittades för de valda teknikerna.');
    } catch (err: any) {
      setError(err.message); toast.error(err.message);
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
      secondary_assignee_id: null,
      tertiary_assignee_id: null,
    }));
    const startTimeFormatted = new Date(suggestion.start_time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    toast.success(`${suggestion.technician_name} vald som ansvarig tekniker för ${new Date(suggestion.start_time).toLocaleDateString('sv-SE')} kl. ${startTimeFormatted}`);
  };

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    if (!caseType || !formData.title || !formData.start_date || !formData.due_date || !formData.primary_assignee_id) { return toast.error("Alla fält under 'Bokning & Detaljer' måste vara ifyllda."); }
    setLoading(true); setError(null);
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

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Skapat!" size="md" preventClose={true}>
        <div className="p-8 text-center"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" /></div>
      </Modal>
    );
  }

  const footer = step === 'form' ? (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t border-slate-800">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="w-full sm:w-auto">Avbryt</Button>
      <Button type="submit" form="create-case-form" loading={loading} disabled={loading} size="lg" className="w-full sm:w-auto">
        <CheckCircle className="w-5 h-5 mr-2"/> Skapa & Boka Ärende
      </Button>
    </div>
  ) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 'selectType' ? 'Välj kundtyp' : `Nytt ärende: ${caseType === 'private' ? 'Privatperson' : 'Företag'}`} size="w-11/12 max-w-4xl" preventClose={loading} footer={footer}>
      <div className="p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
        {step === 'selectType' && (
            <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => selectCaseType('private')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"><User className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-blue-400" /><h3 className="text-xl font-bold">Privatperson</h3></button>
                <button onClick={() => selectCaseType('business')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"><Building className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-green-400" /><h3 className="text-xl font-bold">Företag</h3></button>
            </div>
        )}
        {step === 'form' && (
          <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white -ml-2"><ChevronLeft className="w-4 h-4" /> Byt kundtyp</Button>
            {error && (<div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400">{error}</p></div>)}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <div className="p-4 sm:p-6 bg-slate-800/50 border border-slate-700 rounded-lg space-y-4 flex flex-col">
                <h3 className="font-semibold text-white text-lg flex items-center gap-2"><Zap className="text-blue-400"/>Intelligent Bokning</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Adress *" name="adress" placeholder="Fullständig adress..." value={formData.adress || ''} onChange={handleChange} required />
                  <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Hitta tider från:</label>
                      <DatePicker selected={searchStartDate} onChange={(date) => handleDateChange(date, 'searchStartDate')} locale="sv" dateFormat="yyyy-MM-dd" placeholderText="Välj startdatum..." isClearable className="w-full" />
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
                        <option value={60}>1 timme</option><option value={90}>1.5 timmar</option><option value={120}>2 timmar</option><option value={180}>3 timmar</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Users size={16} /> Sök bland valda tekniker</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {technicians.map(tech => (
                      <label key={tech.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
                        <input type="checkbox" className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500" checked={selectedTechnicianIds.includes(tech.id)} onChange={() => handleTechnicianSelectionChange(tech.id)} />
                        <span className="text-sm text-white truncate">{tech.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="button" onClick={handleSuggestTime} loading={suggestionLoading} className="w-full mt-auto" variant="primary" size="lg"><Zap className="w-4 h-4 mr-2"/> Hitta bästa tid & tekniker</Button>
                {suggestionLoading && <div className="text-center pt-4"><LoadingSpinner text="Analyserar rutter..." /></div>}
                
                {suggestions.length > 0 && (
                  <div className="pt-4 border-t border-slate-700 space-y-2">
                    <h4 className="text-md font-medium text-slate-300">Bokningsförslag:</h4>
                    {suggestions.map((sugg, index) => {
                      const travelColor = getTravelTimeColor(sugg.travel_time_minutes);
                      const scoreInfo = getEfficiencyScoreInfo(sugg.efficiency_score);
                      return (
                        <div key={`${sugg.technician_id}-${sugg.start_time}-${index}`} className="p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => applySuggestion(sugg)}>
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <div className="font-semibold text-white truncate">{sugg.technician_name}</div>
                            <div className="flex items-center gap-3 text-xs sm:text-sm">
                                <div className={`font-bold flex items-center gap-1.5 ${scoreInfo.color}`}>{scoreInfo.icon} {scoreInfo.text}</div>
                                {sugg.travel_time_home_minutes != null && (<div className={`font-bold flex items-center gap-1.5 text-blue-400`}><Home size={12}/> {sugg.travel_time_home_minutes} min</div>)}
                                <div className={`font-bold flex items-center gap-1.5 ${travelColor}`}><MapPin size={12}/> {sugg.travel_time_minutes} min</div>
                            </div>
                          </div>
                          <div className="text-sm text-slate-300 font-medium mt-1">{new Date(sugg.start_time).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                          <div className="text-lg font-bold text-white">{formatTime(sugg.start_time)} - {formatTime(sugg.end_time)}</div>
                          <SuggestionDescription sugg={sugg} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 bg-slate-800/50 border border-slate-700 rounded-lg space-y-4">
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2"><FileText className="text-green-400"/>Bokning & Detaljer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Kontaktperson *" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} required />
                    <Input label="Telefonnummer *" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} required />
                  </div>
                  {caseType === 'private' ? (<Input label="Personnummer" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} />) : (<Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />)}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Starttid *</label>
                          <DatePicker selected={formData.start_date ? new Date(formData.start_date) : null} onChange={(date) => handleDateChange(date, 'start_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" placeholderText="Välj starttid..." isClearable required className="w-full" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Sluttid *</label>
                          <DatePicker selected={formData.due_date ? new Date(formData.due_date) : null} onChange={(date) => handleDateChange(date, 'due_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" placeholderText="Välj sluttid..." isClearable required className="w-full" />
                      </div>
                  </div>
                  
                  {/* ✅ FÖRBÄTTRING: Ersätter den gamla select-menyn med tre nya med tydligare texter. */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Ansvarig tekniker *</label>
                      <select name="primary_assignee_id" value={formData.primary_assignee_id || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value="" disabled>Välj tekniker...</option>
                          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Extra tekniker (valfri)</label>
                      <select name="secondary_assignee_id" value={formData.secondary_assignee_id || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value="">Ingen vald</option>
                          {technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.tertiary_assignee_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Extra tekniker 2 (valfri)</label>
                      <select name="tertiary_assignee_id" value={formData.tertiary_assignee_id || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value="">Ingen vald</option>
                          {technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.secondary_assignee_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <Input label="Ärendetitel (auto-ifylls från namn)" name="title" value={formData.title || ''} onChange={handleChange} required />
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning till tekniker</label>
                    <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" placeholder="Kort om ärendet, portkod, etc."/>
                  </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
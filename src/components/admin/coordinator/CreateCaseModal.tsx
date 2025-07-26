// 📁 src/components/admin/coordinator/CreateCaseModal.tsx
// ⭐ VERSION 3.4 - IMPLEMENTERAR ALLA FÄLT FRÅN CLICKUP-MAPPNING INKL. SMART ROT/RUT ⭐

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician, BeGoneCaseRow } from '../../../types/database';
import { Building, User, Zap, MapPin, CheckCircle, ChevronLeft, AlertCircle, FileText, Users, Star, ThumbsUp, Meh, ThumbsDown, Home, Briefcase, Euro, Percent } from 'lucide-react';
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

// --- Hjälpfunktioner och Datatyper (oförändrade) ---
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
const formatCaseAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'string') { try { const parsed = JSON.parse(address); return parsed.formatted_address || address; } catch (e) { return address; } }
  return address.formatted_address || '';
};

interface SingleSuggestion {
    technician_id: string; technician_name: string; start_time: string; end_time: string;
    travel_time_minutes: number; origin_description: string; efficiency_score: number;
    travel_time_home_minutes?: number;
}
interface TeamSuggestion {
    technicians: { id: string; name: string; travel_time_minutes: number; }[];
    start_time: string; end_time: string; efficiency_score: number;
}
const SuggestionDescription = ({ sugg }: { sugg: SingleSuggestion }) => {
    return (<p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{sugg.origin_description}</p>);
};

interface CreateCaseModalProps {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
  technicians: Technician[]; initialCaseData?: BeGoneCaseRow | null;
}

export default function CreateCaseModal({ isOpen, onClose, onSuccess, technicians, initialCaseData }: CreateCaseModalProps) {
  const [step, setStep] = useState<'selectType' | 'form'>('selectType');
  const [caseType, setCaseType] = useState<'private' | 'business' | null>(null);
  const [formData, setFormData] = useState<Partial<PrivateCasesInsert & BusinessCasesInsert>>({});
  const [timeSlotDuration, setTimeSlotDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SingleSuggestion[]>([]);
  const [teamSuggestions, setTeamSuggestions] = useState<TeamSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [searchStartDate, setSearchStartDate] = useState<Date | null>(new Date());
  const [numberOfTechnicians, setNumberOfTechnicians] = useState(1);

  const handleReset = useCallback(() => {
    setStep('selectType'); setCaseType(null); setFormData({}); 
    setSuggestions([]); setTeamSuggestions([]);
    setError(null); setLoading(false); setSubmitted(false); setSuggestionLoading(false);
    setSearchStartDate(new Date()); setNumberOfTechnicians(1);
  }, []);

  useEffect(() => {
    if (isOpen && initialCaseData) {
      const type = initialCaseData.case_type === 'private' ? 'private' : 'business';
      setCaseType(type);
      const formattedAddress = formatCaseAddress(initialCaseData.adress);
      setFormData({ ...initialCaseData, status: 'Bokad', adress: formattedAddress });
      setStep('form');
      const assignedCount = [initialCaseData.primary_assignee_id, initialCaseData.secondary_assignee_id, initialCaseData.tertiary_assignee_id].filter(Boolean).length;
      setNumberOfTechnicians(assignedCount > 0 ? assignedCount : 1);
    } else if (isOpen) {
      handleReset();
    }
  }, [isOpen, initialCaseData, handleReset]);

  const selectCaseType = (type: 'private' | 'business') => {
    setCaseType(type); setFormData({ status: 'Bokad' }); setStep('form');
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'kontaktperson' && !initialCaseData && { title: value }) }));
  };

  const handleDateChange = (date: Date | null, fieldName: 'searchStartDate' | 'start_date' | 'due_date') => {
    if (fieldName === 'searchStartDate') { setSearchStartDate(date);
    } else { const isoString = date ? date.toISOString() : null; setFormData(prev => ({ ...prev, [fieldName]: isoString })); }
  };
  
  const handleSuggestTime = async () => {
    if (!formData.adress || !formData.skadedjur) { return toast.error('Adress och Skadedjur måste vara ifyllda.'); }
    setSuggestionLoading(true); setSuggestions([]); setTeamSuggestions([]); setError(null);

    const isTeamBooking = numberOfTechnicians > 1;
    const endpoint = isTeamBooking ? '/api/ruttplanerare/find-team-assistant' : '/api/ruttplanerare/booking-assistant';

    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newCaseAddress: formData.adress, pestType: formData.skadedjur,
            timeSlotDuration: timeSlotDuration, searchStartDate: searchStartDate ? searchStartDate.toISOString().split('T')[0] : null,
            ...(isTeamBooking ? { numberOfTechnicians } : { selectedTechnicianIds: technicians.map(t => t.id) })
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Något gick fel.');
      
      if (isTeamBooking) { setTeamSuggestions(data); } 
      else { setSuggestions(data); }

      if (data.length === 0) toast.success('Inga optimala tider hittades.');
    } catch (err: any) {
      setError(err.message); toast.error(err.message);
    } finally {
      setSuggestionLoading(false);
    }
  };
  
  const applySuggestion = (suggestion: SingleSuggestion) => {
    setFormData(prev => ({ ...prev, start_date: suggestion.start_time, due_date: suggestion.end_time, primary_assignee_id: suggestion.technician_id, secondary_assignee_id: null, tertiary_assignee_id: null, }));
    const startTimeFormatted = new Date(suggestion.start_time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    toast.success(`${suggestion.technician_name} vald som ansvarig tekniker för ${new Date(suggestion.start_time).toLocaleDateString('sv-SE')} kl. ${startTimeFormatted}`);
  };

  const applyTeamSuggestion = (suggestion: TeamSuggestion) => {
    setFormData(prev => ({
      ...prev,
      start_date: suggestion.start_time, due_date: suggestion.end_time,
      primary_assignee_id: suggestion.technicians[0]?.id || null,
      secondary_assignee_id: suggestion.technicians[1]?.id || null,
      tertiary_assignee_id: suggestion.technicians[2]?.id || null,
    }));
    toast.success(`Team bokat för ${new Date(suggestion.start_time).toLocaleDateString('sv-SE')}`);
  };

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    if (!caseType || !formData.title || !formData.start_date || !formData.due_date || !formData.primary_assignee_id) { return toast.error("Alla fält med * under 'Bokning & Detaljer' måste vara ifyllda."); }
    setLoading(true); setError(null);
    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';
      if (initialCaseData) {
        const { error } = await supabase.from(tableName).update(formData).eq('id', initialCaseData.id);
        if (error) throw error;
        toast.success(`Ärendet "${formData.title}" har bokats in!`);
      } else {
        const { error } = await supabase.from(tableName).insert([{ ...formData, title: formData.title.trim() }]);
        if (error) throw error;
        toast.success('Ärendet har skapats!');
      }
      setSubmitted(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      setError(`Fel: ${err.message}`);
      toast.error('Kunde inte spara ärendet.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Klart!" size="md" preventClose={true}>
        <div className="p-8 text-center"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" /></div>
      </Modal>
    );
  }

  const footer = step === 'form' ? (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t border-slate-800">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="w-full sm:w-auto">Avbryt</Button>
      <Button type="submit" form="create-case-form" loading={loading} disabled={loading} size="lg" className="w-full sm:w-auto">
        <CheckCircle className="w-5 h-5 mr-2"/>
        {initialCaseData ? 'Boka In Ärende' : 'Skapa & Boka Ärende'}
      </Button>
    </div>
  ) : null;
  
  const showRotRutDetails = formData.r_rot_rut === 'ROT' || formData.r_rot_rut === 'RUT';

  return (
      <Modal isOpen={isOpen} onClose={onClose} title={initialCaseData ? `Boka in: ${initialCaseData.title}` : (step === 'selectType' ? 'Välj kundtyp' : `Nytt ärende: ${caseType === 'private' ? 'Privatperson' : 'Företag'}`)} size="w-11/12 max-w-4xl" preventClose={loading} footer={footer}>
        <div className="p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
          {step === 'selectType' && !initialCaseData && (
              <div className="flex flex-col md:flex-row gap-4">
                  <button onClick={() => selectCaseType('private')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"><User className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-blue-400" /><h3 className="text-xl font-bold">Privatperson</h3></button>
                  <button onClick={() => selectCaseType('business')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"><Building className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-green-400" /><h3 className="text-xl font-bold">Företag</h3></button>
              </div>
          )}
          {step === 'form' && (
            <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
              {!initialCaseData && (
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white -ml-2"><ChevronLeft className="w-4 h-4" /> Byt kundtyp</Button>
              )}
              {error && (<div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400">{error}</p></div>)}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 sm:p-6 bg-slate-800/50 border border-slate-700 rounded-lg space-y-4 flex flex-col">
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2"><Zap className="text-blue-400"/>Intelligent Bokning</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Adress *" name="adress" placeholder="Fullständig adress..." value={typeof formData.adress === 'string' ? formData.adress : ''} onChange={handleChange} required />
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">Antal tekniker som krävs</label>
                    <select value={numberOfTechnicians} onChange={e => setNumberOfTechnicians(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                        <option value={1}>1 tekniker (Hitta bästa individ)</option>
                        <option value={2}>2 tekniker (Hitta bästa team)</option>
                        <option value={3}>3 tekniker (Hitta bästa team)</option>
                    </select>
                  </div>
                  <Button type="button" onClick={handleSuggestTime} loading={suggestionLoading} className="w-full mt-auto" variant="primary" size="lg"><Zap className="w-4 h-4 mr-2"/> Hitta bästa tid & tekniker</Button>
                  {suggestionLoading && <div className="text-center pt-4"><LoadingSpinner text="Analyserar rutter..." /></div>}
                  {suggestions.length > 0 && (
                    <div className="pt-4 border-t border-slate-700 space-y-2">
                      <h4 className="text-md font-medium text-slate-300">Bokningsförslag (1 tekniker):</h4>
                      {suggestions.map((sugg, index) => (
                        <div key={index} className="p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => applySuggestion(sugg)}>
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <div className="font-semibold text-white truncate">{sugg.technician_name}</div>
                              <div className="flex items-center gap-3 text-xs sm:text-sm">
                                  <div className={`font-bold flex items-center gap-1.5 ${getEfficiencyScoreInfo(sugg.efficiency_score).color}`}>{getEfficiencyScoreInfo(sugg.efficiency_score).icon} {getEfficiencyScoreInfo(sugg.efficiency_score).text}</div>
                                  {sugg.travel_time_home_minutes != null && (<div className={`font-bold flex items-center gap-1.5 text-blue-400`}><Home size={12}/> {sugg.travel_time_home_minutes} min</div>)}
                                  <div className={`font-bold flex items-center gap-1.5 ${getTravelTimeColor(sugg.travel_time_minutes)}`}><MapPin size={12}/> {sugg.travel_time_minutes} min</div>
                              </div>
                            </div>
                            <div className="text-sm text-slate-300 font-medium mt-1">{new Date(sugg.start_time).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                            <div className="text-lg font-bold text-white">{formatTime(sugg.start_time)} - {formatTime(sugg.end_time)}</div>
                            <SuggestionDescription sugg={sugg} />
                        </div>
                      ))}
                    </div>
                  )}
                  {teamSuggestions.length > 0 && (
                    <div className="pt-4 border-t border-slate-700 space-y-2">
                      <h4 className="text-md font-medium text-slate-300">Team-förslag ({numberOfTechnicians} tekniker):</h4>
                      {teamSuggestions.map((sugg, index) => {
                        const scoreInfo = getEfficiencyScoreInfo(sugg.efficiency_score);
                        const totalTravel = sugg.technicians.reduce((sum, tech) => sum + tech.travel_time_minutes, 0);
                        return (
                          <div key={index} className="p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => applyTeamSuggestion(sugg)}>
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <div className="font-semibold text-white">Teamförslag</div>
                              <div className="flex items-center gap-3 text-xs sm:text-sm">
                                  <div className={`font-bold flex items-center gap-1.5 ${scoreInfo.color}`}>{scoreInfo.icon} {scoreInfo.text}</div>
                                  <div className={`font-bold flex items-center gap-1.5 text-sky-400`}><Users size={12}/> Total restid: {totalTravel} min</div>
                              </div>
                            </div>
                            <div className="text-sm text-slate-300 font-medium mt-1">{new Date(sugg.start_time).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                            <div className="text-lg font-bold text-white">{formatTime(sugg.start_time)} - {formatTime(sugg.end_time)}</div>
                            <div className="mt-2 pt-2 border-t border-slate-600/50 space-y-1 text-xs text-slate-400">
                              {sugg.technicians.map(tech => (
                                  <div key={tech.id} className="flex justify-between">
                                      <span>{tech.name}</span>
                                      <span className="font-mono">🚗 {tech.travel_time_minutes} min</span>
                                  </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-6 bg-slate-800/50 border border-slate-700 rounded-lg space-y-6">
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2"><FileText className="text-green-400"/>Bokning & Detaljer</h3>
                  <div className="space-y-4">
                      <h4 className="text-md font-medium text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2"><User size={16}/> Kund & Kontakt</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="Kontaktperson *" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} required />
                          <Input label="Telefonnummer *" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} required />
                      </div>
                      <Input type="email" label="E-post Kontaktperson" name="e_post_kontaktperson" value={formData.e_post_kontaktperson || ''} onChange={handleChange} />
                      {caseType === 'private' ? (
                          <Input label="Personnummer *" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} required />
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />
                            <Input label="Beställare" name="bestallare" value={formData.bestallare || ''} onChange={handleChange} />
                          </div>
                      )}
                  </div>
                  <div className="space-y-4">
                      <h4 className="text-md font-medium text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2"><Users size={16}/> Bokning & Team</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="block text-sm font-medium text-slate-300 mb-2">Starttid *</label><DatePicker selected={formData.start_date ? new Date(formData.start_date) : null} onChange={(date) => handleDateChange(date, 'start_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" placeholderText="Välj starttid..." isClearable required className="w-full" /></div>
                          <div><label className="block text-sm font-medium text-slate-300 mb-2">Sluttid *</label><DatePicker selected={formData.due_date ? new Date(formData.due_date) : null} onChange={(date) => handleDateChange(date, 'due_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" placeholderText="Välj sluttid..." isClearable required className="w-full" /></div>
                      </div>
                      <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-300 mb-2">Ansvarig tekniker *</label><select name="primary_assignee_id" value={formData.primary_assignee_id || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"><option value="" disabled>Välj tekniker...</option>{technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-slate-300 mb-2">Extra tekniker (valfri)</label><select name="secondary_assignee_id" value={formData.secondary_assignee_id || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"><option value="">Ingen vald</option>{technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.tertiary_assignee_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-slate-300 mb-2">Extra tekniker 2 (valfri)</label><select name="tertiary_assignee_id" value={formData.tertiary_assignee_id || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"><option value="">Ingen vald</option>{technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.secondary_assignee_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                      </div>
                  </div>
                  <div className="space-y-4">
                       <h4 className="text-md font-medium text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2"><Briefcase size={16}/> Ärendeinformation</h4>
                       <Input label="Ärendetitel (auto-ifylls från namn)" name="title" value={formData.title || ''} onChange={handleChange} required />
                       <div><label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning till tekniker</label><textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" placeholder="Kort om ärendet, portkod, etc."/></div>
                       {caseType === 'business' && (<Input label="Märkning faktura" name="markning_faktura" value={formData.markning_faktura || ''} onChange={handleChange} />)}
                  </div>
                  <div className="space-y-4">
                      <h4 className="text-md font-medium text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2"><Euro size={16}/> Ekonomi & Utskick</h4>
                      <Input type="number" label="Pris (exkl. moms)" name="pris" value={formData.pris ?? ''} onChange={handleChange} />
                      {caseType === 'private' && (
                          <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">ROT/RUT</label>
                              <select name="r_rot_rut" value={formData.r_rot_rut || 'Nej'} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                                  <option value="Nej">Ej avdragsgillt</option><option value="ROT">ROT</option><option value="RUT">RUT</option><option value="INKL moms">Pris inkl. moms</option>
                              </select>
                          </div>
                      )}
                      {showRotRutDetails && (
                          <div className="p-4 bg-slate-900/70 border border-slate-700 rounded-lg space-y-4">
                               <h5 className="text-sm font-semibold text-white flex items-center gap-2"><Percent size={14}/> Detaljer för ROT/RUT-avdrag</h5>
                               <Input label="Fastighetsbeteckning" name="r_fastighetsbeteckning" value={formData.r_fastighetsbeteckning || ''} onChange={handleChange} />
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <Input type="number" label="Arbetskostnad" name="r_arbetskostnad" value={formData.r_arbetskostnad ?? ''} onChange={handleChange} />
                                  <Input type="number" label="Material & Utrustning" name="r_material_utrustning" value={formData.r_material_utrustning ?? ''} onChange={handleChange} />
                                  <Input type="number" label="Servicebil" name="r_servicebil" value={formData.r_servicebil ?? ''} onChange={handleChange} />
                               </div>
                          </div>
                      )}
                      {caseType === 'business' && (<Input type="email" label="E-post Faktura" name="e_post_faktura" value={formData.e_post_faktura || ''} onChange={handleChange} />)}
                      <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Skicka bokningsbekräftelse?</label>
                          <select name="skicka_bokningsbekraftelse" value={formData.skicka_bokningsbekraftelse || 'Nej'} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                              <option value="Nej">Nej</option><option value="JA - Första Klockslaget">JA - Första Klockslaget</option><option value="JA - Tidsspann">JA - Tidsspann</option>
                          </select>
                      </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </Modal>
  );
}
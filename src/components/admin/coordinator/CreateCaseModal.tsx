// 📁 src/components/admin/coordinator/CreateCaseModal.tsx
// ⭐ VERSION 4.0 - STÖD FÖR AVTALSKUNDER OCH TRE KUNDTYPER ⭐

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician, BeGoneCaseRow } from '../../../types/database';
import { Case } from '../../../types/cases';
import { Building, User, Zap, MapPin, CheckCircle, ChevronLeft, AlertCircle, FileText, Users, Star, ThumbsUp, Meh, ThumbsDown, Home, Briefcase, Euro, Percent, FileCheck, Building2 } from 'lucide-react';
import { PEST_TYPES } from '../../../utils/clickupFieldMapper';
import { useClickUpSync } from '../../../hooks/useClickUpSync';
import SiteSelector from '../../shared/SiteSelector';

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
  const [caseType, setCaseType] = useState<'private' | 'business' | 'contract' | null>(null);
  const [formData, setFormData] = useState<Partial<PrivateCasesInsert & BusinessCasesInsert>>({});
  const [contractCustomers, setContractCustomers] = useState<any[]>([]);
  const [selectedContractCustomer, setSelectedContractCustomer] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [timeSlotDuration, setTimeSlotDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SingleSuggestion[]>([]);
  const [teamSuggestions, setTeamSuggestions] = useState<TeamSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [searchStartDate, setSearchStartDate] = useState<Date | null>(new Date());
  const [numberOfTechnicians, setNumberOfTechnicians] = useState(1);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);
  
  // ClickUp sync hook
  const { syncAfterCreate } = useClickUpSync();

  const handleReset = useCallback(() => {
    setStep('selectType'); setCaseType(null); setFormData({}); 
    setSuggestions([]); setTeamSuggestions([]);
    setError(null); setLoading(false); setSubmitted(false); setSuggestionLoading(false);
    setSearchStartDate(new Date()); setNumberOfTechnicians(1); setSelectedTechnicianIds([]);
    setSelectedContractCustomer(null);
    setSelectedSiteId(null);
  }, []);

  // Hämta avtalskunder när modal öppnas
  useEffect(() => {
    const fetchContractCustomers = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        // Hämta ALLA kunder, både huvudkunder och multisite-enheter
        .order('company_name');
      
      if (!error && data) {
        setContractCustomers(data);
      }
    };

    if (isOpen) {
      fetchContractCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialCaseData) {
      const type = initialCaseData.case_type === 'private' ? 'private' : 
                   initialCaseData.case_type === 'business' ? 'business' : 'contract';
      setCaseType(type);
      const formattedAddress = formatCaseAddress(initialCaseData.adress);
      
      // För contract cases, sätt bara grundläggande ärendedata
      // Låt nästa useEffect hantera kund-identifiering
      if (type === 'contract' && initialCaseData.customer_id) {
        setFormData({
          title: initialCaseData.title,
          status: 'Bokat',
          skadedjur: initialCaseData.pest_type || initialCaseData.skadedjur,
          priority: initialCaseData.priority,
          description: initialCaseData.description
        });
        // Vänta med att sätta customer tills vi vet om det är multisite
      } else {
        // För private/business cases, använd all data
        const mappedData = {
          ...initialCaseData,
          status: 'Bokat',
          adress: formattedAddress,
          skadedjur: initialCaseData.pest_type || initialCaseData.skadedjur
        };
        setFormData(mappedData);
      }
      
      setStep('form');
      const assignedCount = [initialCaseData.primary_assignee_id, initialCaseData.secondary_assignee_id, initialCaseData.tertiary_assignee_id].filter(Boolean).length;
      setNumberOfTechnicians(assignedCount > 0 ? assignedCount : 1);
    } else if (isOpen) {
      handleReset();
      if (technicians.length > 0) {
        const defaultSelectedTechnicians = technicians.filter(tech => tech.role === 'Skadedjurstekniker');
        setSelectedTechnicianIds(defaultSelectedTechnicians.map(t => t.id));
      }
    }
  }, [isOpen, initialCaseData, handleReset]);

  // Identifiera och hantera multisite vs vanliga kunder när data är laddad
  useEffect(() => {
    if (initialCaseData?.customer_id && contractCustomers.length > 0 && initialCaseData.case_type === 'contract') {
      const customer = contractCustomers.find(c => c.id === initialCaseData.customer_id);
      
      if (customer) {
        if (customer.is_multisite && (customer.parent_customer_id || customer.organization_id)) {
          // Det är en multisite-enhet - sätt huvudkund och enhet
          console.log('Multisite enhet detekterad:', customer.company_name);
          
          // För multi-site: använd parent_customer_id om det finns, annars hitta huvudkontoret via organization_id
          if (customer.parent_customer_id) {
            console.log('Använder parent_customer_id:', customer.parent_customer_id);
            setSelectedContractCustomer(customer.parent_customer_id);
          } else if (customer.organization_id) {
            // Hitta huvudkontoret (site_type === 'huvudkontor')
            const huvudkontor = contractCustomers.find(c => 
              c.organization_id === customer.organization_id && 
              c.site_type === 'huvudkontor'
            );
            console.log('Hittade huvudkontor via organization_id:', huvudkontor?.company_name);
            setSelectedContractCustomer(huvudkontor?.id || customer.id);
          }
          
          setSelectedSiteId(customer.id); // Enhets-ID
        } else if (!customer.parent_customer_id && !customer.organization_id) {
          // Vanlig kund (inte multi-site)
          console.log('Vanlig kund:', customer.company_name);
          setSelectedContractCustomer(customer.id);
          setSelectedSiteId(null);
        }
      }
    }
  }, [initialCaseData, contractCustomers]);

  // Separat useEffect för att fylla i kunddata när selectedContractCustomer eller selectedSiteId ändras
  useEffect(() => {
    if (selectedContractCustomer && contractCustomers.length > 0) {
      const customer = contractCustomers.find(c => c.id === selectedContractCustomer);
      
      // Om en site är vald för multisite-kund, använd sitens data där det finns
      let dataSource = customer;
      if (selectedSiteId) {
        const site = contractCustomers.find(c => c.id === selectedSiteId);
        if (site) {
          // Prioritera site-data, men fallback till huvudkunddata
          dataSource = {
            ...customer,
            contact_person: site.contact_person || customer?.contact_person,
            contact_phone: site.contact_phone || customer?.contact_phone,
            contact_email: site.contact_email || customer?.contact_email,
            contact_address: site.contact_address || customer?.contact_address,
            billing_email: site.billing_email || customer?.billing_email,
            billing_address: site.billing_address || customer?.billing_address,
            company_name: customer?.company_name, // Behåll huvudkundens namn
            organization_number: customer?.organization_number
          };
        }
      }
      
      if (dataSource) {
        setFormData(prev => ({
          ...prev,
          kontaktperson: dataSource.contact_person,
          telefon_kontaktperson: dataSource.contact_phone,
          e_post_kontaktperson: dataSource.contact_email,
          org_nr: dataSource.organization_number,
          bestallare: dataSource.company_name,
          adress: dataSource.contact_address || dataSource.service_address || prev.adress,
          // Lägg även till faktura-fält om de finns
          e_post_faktura: dataSource.billing_email || dataSource.contact_email,
          faktura_adress: dataSource.billing_address || dataSource.contact_address,
          // Lägg till fler fält för bättre integration
          telefon: dataSource.contact_phone, // För ärendet självt
          email: dataSource.contact_email,   // För ärendet självt
        }));
      }
    }
  }, [selectedContractCustomer, selectedSiteId, contractCustomers]);

  const selectCaseType = (type: 'private' | 'business' | 'contract') => {
    setCaseType(type); 
    if (type === 'contract' && contractCustomers.length === 0) {
      toast.error('Inga avtalskunder hittades');
      return;
    }
    setFormData({ status: 'Bokat' }); 
    setStep('form');
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'kontaktperson' && !initialCaseData && { title: value }) }));
  };

  const handleTechnicianSelectionChange = (technicianId: string) => {
    setSelectedTechnicianIds(prev => 
      prev.includes(technicianId) 
        ? prev.filter(id => id !== technicianId) 
        : [...prev, technicianId]
    );
  };

  const handleDateChange = (date: Date | null, fieldName: 'searchStartDate' | 'start_date' | 'due_date') => {
    if (fieldName === 'searchStartDate') { 
      setSearchStartDate(date);
    } else { 
      // Bevara lokal svensk tid genom att formatera manuellt istället för toISOString()
      if (date) {
        // Format: YYYY-MM-DDTHH:mm:ss+02:00 (svensk sommartid)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        // Svensk tidszon offset (UTC+1 vintertid, UTC+2 sommartid)
        const timezoneOffset = date.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
        const offsetMinutes = Math.abs(timezoneOffset) % 60;
        const offsetSign = timezoneOffset <= 0 ? '+' : '-';
        const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
        
        const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
        setFormData(prev => ({ ...prev, [fieldName]: isoString }));
      } else {
        setFormData(prev => ({ ...prev, [fieldName]: null }));
      }
    }
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
            ...(isTeamBooking ? { numberOfTechnicians } : { selectedTechnicianIds })
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
    const primaryTech = technicians.find(t => t.id === suggestion.technician_id);
    setFormData(prev => ({ 
      ...prev, 
      start_date: suggestion.start_time, 
      due_date: suggestion.end_time, 
      primary_assignee_id: suggestion.technician_id,
      primary_assignee_name: primaryTech?.name || null,
      primary_assignee_email: primaryTech?.email || null,
      secondary_assignee_id: null, 
      secondary_assignee_name: null,
      secondary_assignee_email: null,
      tertiary_assignee_id: null,
      tertiary_assignee_name: null,
      tertiary_assignee_email: null
    }));
    const startTimeFormatted = new Date(suggestion.start_time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    toast.success(`${suggestion.technician_name} vald som ansvarig tekniker för ${new Date(suggestion.start_time).toLocaleDateString('sv-SE')} kl. ${startTimeFormatted}`);
  };

  const applyTeamSuggestion = (suggestion: TeamSuggestion) => {
    const primaryTech = technicians.find(t => t.id === suggestion.technicians[0]?.id);
    const secondaryTech = technicians.find(t => t.id === suggestion.technicians[1]?.id);
    const tertiaryTech = technicians.find(t => t.id === suggestion.technicians[2]?.id);
    
    setFormData(prev => ({
      ...prev,
      start_date: suggestion.start_time, 
      due_date: suggestion.end_time,
      primary_assignee_id: suggestion.technicians[0]?.id || null,
      primary_assignee_name: primaryTech?.name || null,
      primary_assignee_email: primaryTech?.email || null,
      secondary_assignee_id: suggestion.technicians[1]?.id || null,
      secondary_assignee_name: secondaryTech?.name || null,
      secondary_assignee_email: secondaryTech?.email || null,
      tertiary_assignee_id: suggestion.technicians[2]?.id || null,
      tertiary_assignee_name: tertiaryTech?.name || null,
      tertiary_assignee_email: tertiaryTech?.email || null
    }));
    toast.success(`Team bokat för ${new Date(suggestion.start_time).toLocaleDateString('sv-SE')}`);
  };

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    if (!caseType || !formData.title || !formData.start_date || !formData.due_date || !formData.primary_assignee_id) { 
      return toast.error("Alla fält med * under 'Bokning & Detaljer' måste vara ifyllda."); 
    }
    if (caseType === 'contract' && !selectedContractCustomer) {
      return toast.error('Du måste välja en avtalskund');
    }
    
    // Validera site för multisite-kunder
    const customer = contractCustomers.find(c => c.id === selectedContractCustomer);
    if (caseType === 'contract' && customer?.is_multisite && !selectedSiteId) {
      return toast.error('Du måste välja en anläggning för denna multisite-kund');
    }
    
    setLoading(true); 
    setError(null);
    
    try {
      if (caseType === 'contract') {
        // Hantera avtalskundärenden
        // Om multisite, använd sitens customer_id istället för huvudkundens
        let actualCustomerId = selectedContractCustomer;
        if (customer?.is_multisite && selectedSiteId) {
          // selectedSiteId är faktiskt customer_id för siten från SiteSelector
          actualCustomerId = selectedSiteId;
        }
        
        const caseData = {
          customer_id: actualCustomerId, // Använd rätt customer_id (site eller huvudkund)
          site_id: customer?.is_multisite ? selectedSiteId : null,
          title: formData.title.trim(),
          description: formData.description || '',
          status: 'Bokad', // Korrekt svensk status som används i systemet
          priority: formData.priority || 'normal',
          service_type: 'routine' as const,
          pest_type: formData.skadedjur || null, // Använd skadedjur från formData
          scheduled_start: formData.start_date,
          scheduled_end: formData.due_date,
          primary_technician_id: formData.primary_assignee_id,
          primary_technician_name: formData.primary_assignee_name || null,
          contact_person: formData.kontaktperson || customer?.contact_person || null,
          contact_email: formData.e_post_kontaktperson || customer?.contact_email || null,
          contact_phone: formData.telefon_kontaktperson || customer?.contact_phone || null,
          address: formData.adress ? { formatted_address: formData.adress } : null,
          price: formData.pris || null,
          case_number: `AVT-${Date.now().toString().slice(-6)}`
        };
        
        if (initialCaseData && initialCaseData.case_type === 'contract') {
          // Uppdatera befintligt avtalskundärende
          const { error } = await supabase.from('cases').update(caseData).eq('id', initialCaseData.id);
          if (error) throw error;
        } else {
          // Skapa nytt avtalskundärende
          const { error } = await supabase.from('cases').insert([caseData]);
          if (error) throw error;
        }
        toast.success(`Avtalskundärendet "${formData.title}" har bokats in!`);
      } else {
        // Hantera ClickUp-ärenden (private/business)
        const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';
        if (initialCaseData && initialCaseData.case_type !== 'contract') {
          const { error } = await supabase.from(tableName).update(formData).eq('id', initialCaseData.id);
          if (error) throw error;
          toast.success(`Ärendet "${formData.title}" har bokats in!`);
        } else {
          const { data, error } = await supabase.from(tableName).insert([{ 
            ...formData, 
            title: formData.title.trim(), 
            clickup_task_id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` 
          }]).select('id');
          if (error) throw error;
          toast.success('Ärendet har skapats!');
          
          // Synka till ClickUp i bakgrunden om case skapades
          if (data && data[0]?.id && caseType !== 'contract') {
            syncAfterCreate(data[0].id, caseType);
          }
        }
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
      <Modal isOpen={isOpen} onClose={onClose} title={initialCaseData ? `Boka in: ${initialCaseData.title}` : (step === 'selectType' ? 'Välj kundtyp' : `Nytt ärende: ${caseType === 'private' ? 'Privatperson' : caseType === 'business' ? 'Företag' : 'Avtalskund'}`)} size="w-11/12 max-w-4xl" preventClose={loading} footer={footer}>
        <div className="p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
          {step === 'selectType' && !initialCaseData && (
              <div className="flex flex-col md:flex-row gap-4">
                  <button onClick={() => selectCaseType('private')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                    <User className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-blue-400" />
                    <h3 className="text-xl font-bold">Privatperson</h3>
                    <p className="text-sm text-slate-400 mt-2">Engångsjobb via ClickUp</p>
                  </button>
                  <button onClick={() => selectCaseType('business')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                    <Building className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-green-400" />
                    <h3 className="text-xl font-bold">Företag</h3>
                    <p className="text-sm text-slate-400 mt-2">Engångsjobb via ClickUp</p>
                  </button>
                  <button onClick={() => selectCaseType('contract')} className="flex-1 p-6 md:p-8 text-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border-2 border-emerald-500/30">
                    <FileCheck className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 text-emerald-400" />
                    <h3 className="text-xl font-bold">Avtalskund</h3>
                    <p className="text-sm text-slate-400 mt-2">Återkommande tjänster</p>
                    {contractCustomers.length > 0 && (
                      <p className="text-xs text-emerald-400 mt-1">{contractCustomers.length} kunder</p>
                    )}
                  </button>
              </div>
          )}
          {step === 'form' && (
            <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
              {!initialCaseData && (
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white -ml-2"><ChevronLeft className="w-4 h-4" /> Byt kundtyp</Button>
              )}
              {error && (<div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400">{error}</p></div>)}
              
              {/* Avtalskund-väljare */}
              {caseType === 'contract' && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Välj avtalskund *
                  </label>
                  <select
                    value={selectedContractCustomer || ''}
                    onChange={(e) => {
                      setSelectedContractCustomer(e.target.value);
                      setSelectedSiteId(null); // Reset site when customer changes
                      // Data fylls nu i via useEffect när selectedContractCustomer ändras
                    }}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">Välj kund...</option>
                    {contractCustomers
                      .filter(c => !c.parent_customer_id) // Visa bara huvudkunder, inte multisite-enheter
                      .map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.company_name} {customer.organization_number ? `(${customer.organization_number})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Site-väljare för multisite-kunder */}
              {caseType === 'contract' && selectedContractCustomer && (
                (() => {
                  const selectedCustomer = contractCustomers.find(c => c.id === selectedContractCustomer);
                  if (selectedCustomer?.is_multisite && selectedCustomer?.organization_id) {
                    return (
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-400" />
                          Välj anläggning/site *
                        </label>
                        <SiteSelector
                          organizationId={selectedCustomer.organization_id}
                          value={selectedSiteId}
                          onChange={setSelectedSiteId}
                          required={true}
                          placeholder="Välj anläggning..."
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          Välj vilken anläggning ärendet gäller för denna multisite-organisation
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()
              )}
              
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

                  {/* ✅ FÖRBÄTTRING: Knapp och dropdown är nu grupperade och flyttade högre upp. */}
                  <div className="pt-4 border-t border-slate-700 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Antal tekniker som krävs</label>
                      <select value={numberOfTechnicians} onChange={e => setNumberOfTechnicians(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value={1}>1 tekniker (Hitta bästa individ)</option>
                          <option value={2}>2 tekniker (Hitta bästa team)</option>
                          <option value={3}>3 tekniker (Hitta bästa team)</option>
                      </select>
                    </div>
                    
                    {/* Checkbox för att välja tekniker (endast för single booking) */}
                    {numberOfTechnicians === 1 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Users size={16} /> Sök bland valda tekniker</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {technicians.map(tech => (
                            <label key={tech.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500" 
                                checked={selectedTechnicianIds.includes(tech.id)} 
                                onChange={() => handleTechnicianSelectionChange(tech.id)} 
                              />
                              <span className="text-sm text-white truncate">{tech.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Button type="button" onClick={handleSuggestTime} loading={suggestionLoading} className="w-full" variant="primary" size="lg"><Zap className="w-4 h-4 mr-2"/> Hitta bästa tid & tekniker</Button>
                  </div>
                  
                  {/* Denna div tar upp resterande utrymme och visar förslagen */}
                  <div className="flex-grow">
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
                          <div><label className="block text-sm font-medium text-slate-300 mb-2">Starttid *</label><DatePicker selected={formData.start_date ? new Date(formData.start_date) : null} onChange={(date) => handleDateChange(date, 'start_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" timeCaption="Tid" timeInputLabel="Tid:" placeholderText="Välj starttid..." isClearable required className="w-full" /></div>
                          <div><label className="block text-sm font-medium text-slate-300 mb-2">Sluttid *</label><DatePicker selected={formData.due_date ? new Date(formData.due_date) : null} onChange={(date) => handleDateChange(date, 'due_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" timeCaption="Tid" timeInputLabel="Tid:" placeholderText="Välj sluttid..." isClearable required className="w-full" /></div>
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
                      {/* ✅ FÖRBÄTTRING: Etiketten för pris ändras nu baserat på kundtyp. */}
                      <Input type="number" label={caseType === 'private' ? 'Pris (inkl. moms)' : 'Pris (exkl. moms)'} name="pris" value={formData.pris ?? ''} onChange={handleChange} />
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
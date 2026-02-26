// 📁 src/components/admin/coordinator/CreateCaseModal.tsx
// ⭐ VERSION 4.0 - STÖD FÖR AVTALSKUNDER OCH TRE KUNDTYPER ⭐

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { PrivateCasesInsert, BusinessCasesInsert, Technician, BeGoneCaseRow, ACCOUNT_MANAGERS } from '../../../types/database';
import { Case } from '../../../types/cases';
import { Building, User, Zap, MapPin, CheckCircle, ChevronLeft, ChevronDown, AlertCircle, FileText, Users, Home, Briefcase, Euro, Percent, FileCheck, Building2, Image as ImageIcon, CalendarSearch, ClipboardCheck, Search, Star } from 'lucide-react';
import { PEST_TYPES } from '../../../utils/clickupFieldMapper';
import SiteSelector from '../../shared/SiteSelector';
import CaseImageSelector, { SelectedImage, uploadSelectedImages } from '../../shared/CaseImageSelector';
import { CaseImageService, CaseImageWithUrl } from '../../../services/caseImageService';
import { BookingSuggestionList, SingleSuggestion } from '../../shared/BookingSuggestionCard';
import { CaseNumberService } from '../../../services/caseNumberService';

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

// --- Hjälpfunktioner och Datatyper ---
const formatCaseAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'string') { try { const parsed = JSON.parse(address); return parsed.formatted_address || address; } catch (e) { return address; } }
  return address.formatted_address || '';
};

interface TeamSuggestion {
    technicians: { id: string; name: string; travel_time_minutes: number; }[];
    start_time: string; end_time: string; efficiency_score: number;
}

// Effektivitets-hjälpfunktion för team-förslag
const getTeamEfficiencyInfo = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: 'Optimal', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'Bra', color: 'text-blue-400' };
  if (score >= 50) return { label: 'OK', color: 'text-amber-400' };
  return { label: 'Låg', color: 'text-slate-400' };
};

interface CreateCaseModalProps {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
  technicians: Technician[]; initialCaseData?: BeGoneCaseRow | null;
  initialCaseType?: 'private' | 'business' | 'contract' | 'inspection' | null;
}

export default function CreateCaseModal({ isOpen, onClose, onSuccess, technicians, initialCaseData, initialCaseType }: CreateCaseModalProps) {
  const [step, setStep] = useState<'selectType' | 'form'>('selectType');
  const [caseType, setCaseType] = useState<'private' | 'business' | 'contract' | 'inspection' | null>(null);
  const [formData, setFormData] = useState<Partial<PrivateCasesInsert & BusinessCasesInsert>>({});
  const [contractCustomers, setContractCustomers] = useState<any[]>([]);
  const [customersWithStations, setCustomersWithStations] = useState<Set<string>>(new Set());
  const [selectedContractCustomer, setSelectedContractCustomer] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [multisiteRoles, setMultisiteRoles] = useState<any[]>([]);
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
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [existingImages, setExistingImages] = useState<CaseImageWithUrl[]>([]);
  const [offerDetails, setOfferDetails] = useState<{
    agreement_text: string | null;
    selected_products: any[] | null;
    total_value: number | null;
  } | null>(null);
  const [offerExpanded, setOfferExpanded] = useState(true);
  const [generatedCaseNumber, setGeneratedCaseNumber] = useState<string | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const handleReset = useCallback(() => {
    setStep('selectType'); setCaseType(null); setFormData({});
    setSuggestions([]); setTeamSuggestions([]);
    setError(null); setLoading(false); setSubmitted(false); setSuggestionLoading(false);
    setSearchStartDate(new Date()); setNumberOfTechnicians(1); setSelectedTechnicianIds([]);
    setSelectedContractCustomer(null);
    setSelectedSiteId(null);
    setExistingImages([]);
    setOfferDetails(null);
    setOfferExpanded(true);
    setGeneratedCaseNumber(null);
    setCustomerSearchTerm('');
    setCustomerDropdownOpen(false);
    // Städa upp bildförhandsvisningar
    setSelectedImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.preview));
      return [];
    });
  }, []);

  // Hämta avtalskunder och multisite-roller när modal öppnas
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

    // Hämta vilka kunder som har stationer (för stationskontroll-filtrering)
    const fetchCustomersWithStations = async () => {
      try {
        // Hämta kunder med utomhusstationer
        const { data: outdoorData } = await supabase
          .from('equipment_placements')
          .select('customer_id')
          .eq('status', 'active');

        // Hämta kunder med planritningar (som kan ha inomhusstationer)
        const { data: floorPlanData } = await supabase
          .from('floor_plans')
          .select('customer_id');

        const customerIds = new Set<string>();

        outdoorData?.forEach(item => {
          if (item.customer_id) customerIds.add(item.customer_id);
        });

        floorPlanData?.forEach(item => {
          if (item.customer_id) customerIds.add(item.customer_id);
        });

        setCustomersWithStations(customerIds);
      } catch (err) {
        console.error('Kunde inte hämta kunder med stationer:', err);
      }
    };

    const fetchMultisiteRoles = async () => {
      // Hämta multisite-roller först
      const { data: rolesData, error: rolesError } = await supabase
        .from('multisite_user_roles')
        .select('*')
        .eq('role_type', 'platsansvarig')
        .eq('is_active', true);

      if (!rolesError && rolesData) {
        // Hämta användardata via RPC (eliminerar onödiga profiles-anrop)
        const enrichedRoles = await Promise.all(rolesData.map(async (role) => {
          try {
            // Hämta metadata från auth.users
            const { data: userData, error: rpcError } = await supabase
              .rpc('get_user_metadata', { user_id: role.user_id });
            
            if (rpcError) {
              console.error('RPC error for user:', role.user_id, rpcError);
              return {
                ...role,
                user_name: `Användare ${role.user_id.slice(0, 8)}`,
                user_phone: null,
                user_email: null
              };
            }
            
            return {
              ...role,
              user_name: userData?.raw_user_meta_data?.name || userData?.raw_user_meta_data?.display_name,
              user_phone: userData?.raw_user_meta_data?.phone || userData?.phone,
              user_email: userData?.email
            };
          } catch (err) {
            console.error('Failed to fetch user metadata for:', role.user_id, err);
            return {
              ...role,
              user_name: `Användare ${role.user_id.slice(0, 8)}`,
              user_phone: null,
              user_email: null
            };
          }
        }));
        console.log('Enriched multisite roles:', enrichedRoles);
        setMultisiteRoles(enrichedRoles);
      }
    };

    if (isOpen) {
      fetchContractCustomers();
      fetchMultisiteRoles();
      fetchCustomersWithStations();
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
          status: 'Bokat',
          skadedjur: initialCaseData.pest_type || initialCaseData.skadedjur,
          priority: initialCaseData.priority,
          description: initialCaseData.description,
          adress: formattedAddress || '',
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
    } else if (isOpen && initialCaseType) {
      // Dropdown-val: hoppa direkt till formuläret med vald typ
      handleReset();
      setCaseType(initialCaseType);
      setStep('form');
    } else if (isOpen) {
      handleReset();
    }
  }, [isOpen, initialCaseData, initialCaseType, handleReset]);

  // Separat useEffect för tekniker-förval - hanterar timing-problem med asynkron laddning
  useEffect(() => {
    // Endast förvälja om modalen är öppen, tekniker finns, och inga redan är valda
    if (!isOpen || technicians.length === 0 || selectedTechnicianIds.length > 0) {
      return;
    }

    // Kontrollera om det finns tilldelade tekniker i initialCaseData
    const hasTechniciansInData = initialCaseData?.primary_assignee_id ||
                                  (initialCaseData as any)?.primary_technician_id;

    // Om inga tekniker är tilldelade, förvälja Skadedjurstekniker
    if (!hasTechniciansInData) {
      const defaultSelectedTechnicians = technicians.filter(tech => tech.role === 'Skadedjurstekniker');
      setSelectedTechnicianIds(defaultSelectedTechnicians.map(t => t.id));
    }
  }, [isOpen, technicians, selectedTechnicianIds.length, initialCaseData]);

  // Hämta befintliga bilder från kund om vi öppnar ett befintligt ärende
  useEffect(() => {
    const fetchExistingImages = async () => {
      if (!isOpen || !initialCaseData?.id) {
        setExistingImages([]);
        return;
      }

      try {
        // cases-tabellen är för avtalskunder (contract)
        const images = await CaseImageService.getCaseImages(initialCaseData.id, 'contract');
        setExistingImages(images);
      } catch (err) {
        console.error('Kunde inte hämta befintliga bilder:', err);
      }
    };

    fetchExistingImages();
  }, [isOpen, initialCaseData?.id]);

  // Hämta offertinnehåll om ärendet har en Oneflow-koppling
  useEffect(() => {
    const fetchOfferDetails = async () => {
      const oneflowId = (initialCaseData as any)?.oneflow_contract_id;
      if (!isOpen || !oneflowId) {
        setOfferDetails(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('contracts')
          .select('agreement_text, selected_products, total_value')
          .eq('oneflow_contract_id', oneflowId)
          .single();

        if (!error && data) {
          setOfferDetails(data);
        }
      } catch (err) {
        console.error('Kunde inte hämta offertinnehåll:', err);
      }
    };

    fetchOfferDetails();
  }, [isOpen, initialCaseData]);

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
        if (!site) {
          console.error('Selected site not found:', selectedSiteId);
          return;
        }
        
        // Hitta platsansvarig för denna enhet
        const siteManager = multisiteRoles.find(role => 
          role.site_ids?.includes(selectedSiteId)
        );
        
        // VIKTIGT: Använd SITE som bas, inte customer
        // Detta säkerställer att vi får rätt kontaktinfo från enheten
        dataSource = {
          ...site, // Använd SITE som bas istället för customer
          // Överskrid bara med platsansvarigs data om den finns
          contact_person: siteManager?.user_name || site.contact_person,
          contact_phone: siteManager?.user_phone || site.contact_phone,
          contact_email: siteManager?.user_email || site.contact_email,
          // Behåll vissa fält från huvudkund om de saknas på site
          billing_email: site.billing_email || customer?.billing_email,
          billing_address: site.billing_address || customer?.billing_address,
          // Säkerställ att vi använder sitens egna uppgifter
          company_name: site.company_name,
          organization_number: site.organization_number,
          contact_address: site.contact_address
        };
        
        console.log('Site data being used:', {
          site_name: site.site_name,
          site_manager: siteManager?.user_name,
          contact_person: dataSource.contact_person,
          contact_phone: dataSource.contact_phone,
          contact_email: dataSource.contact_email,
          org_nr: dataSource.organization_number
        });
      }
      
      if (dataSource) {
        setFormData(prev => ({
          ...prev,
          kontaktperson: dataSource.contact_person || '',
          telefon_kontaktperson: dataSource.contact_phone || '',
          e_post_kontaktperson: dataSource.contact_email || '',
          org_nr: dataSource.organization_number || '',
          bestallare: dataSource.company_name || '',
          adress: prev.adress || dataSource.contact_address || dataSource.service_address || '',
          // Lägg även till faktura-fält om de finns
          e_post_faktura: dataSource.billing_email || dataSource.contact_email || '',
          faktura_adress: dataSource.billing_address || dataSource.contact_address || '',
          // Lägg till fler fält för bättre integration
          telefon: dataSource.contact_phone || '', // För ärendet självt
          email: dataSource.contact_email || '',   // För ärendet självt
        }));
      }
    }
  }, [selectedContractCustomer, selectedSiteId, contractCustomers, multisiteRoles]);

  // Click-outside och Escape för kundselektor-dropdown
  useEffect(() => {
    if (!customerDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCustomerDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [customerDropdownOpen]);

  // Filtrerad kundlista för sökbar dropdown
  const filteredContractCustomers = useMemo(() => {
    const search = customerSearchTerm.toLowerCase().trim();
    return contractCustomers
      .filter(c => {
        if (caseType === 'inspection') return customersWithStations.has(c.id);
        if (c.parent_customer_id) return false;
        return true;
      })
      .filter(c => {
        if (!search) return true;
        return (
          c.company_name?.toLowerCase().includes(search) ||
          c.customer_number?.toLowerCase().includes(search) ||
          c.organization_number?.toLowerCase().includes(search)
        );
      });
  }, [contractCustomers, customerSearchTerm, caseType, customersWithStations]);

  // Account Manager: hitta vilken tekniker som är kundens AM
  const accountManagerTechId = useMemo(() => {
    if (caseType !== 'contract' && caseType !== 'inspection') return null;
    const siteCustomer = selectedSiteId ? contractCustomers.find(c => c.id === selectedSiteId) : null;
    const parentCustomer = selectedContractCustomer ? contractCustomers.find(c => c.id === selectedContractCustomer) : null;
    const amEmail = siteCustomer?.assigned_account_manager || parentCustomer?.assigned_account_manager;
    if (!amEmail) return null;
    const amTech = technicians.find(t => t.email === amEmail);
    return amTech?.id || null;
  }, [caseType, selectedContractCustomer, selectedSiteId, contractCustomers, technicians]);

  const accountManagerName = useMemo(() => {
    if (!accountManagerTechId) return null;
    return technicians.find(t => t.id === accountManagerTechId)?.name || null;
  }, [accountManagerTechId, technicians]);

  const selectCaseType = (type: 'private' | 'business' | 'contract' | 'inspection') => {
    setCaseType(type);
    if ((type === 'contract' || type === 'inspection') && contractCustomers.length === 0) {
      toast.error('Inga avtalskunder hittades');
      return;
    }
    setFormData({ status: 'Bokad' });
    setStep('form');
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    // För stationskontroll, hämta adressen från vald kund
    let searchAddress = formData.adress;
    let searchPestType = formData.skadedjur;

    if (caseType === 'inspection') {
      // Hämta kundens adress för stationskontroll
      const customer = selectedSiteId
        ? contractCustomers.find(c => c.id === selectedSiteId)
        : contractCustomers.find(c => c.id === selectedContractCustomer);

      if (!customer) {
        return toast.error('Välj en kund först.');
      }
      searchAddress = customer.contact_address || customer.service_address || '';
      searchPestType = 'Skadedjursavtal'; // Använd existerande kompetens för avtalskunder

      if (!searchAddress) {
        return toast.error('Kunden saknar adress. Ange adress manuellt.');
      }
    } else {
      if (!formData.adress || !formData.skadedjur) {
        return toast.error('Adress och Skadedjur måste vara ifyllda.');
      }
    }

    setSuggestionLoading(true); setSuggestions([]); setTeamSuggestions([]); setError(null);

    const isTeamBooking = numberOfTechnicians > 1;
    const endpoint = isTeamBooking ? '/api/ruttplanerare/find-team-assistant' : '/api/ruttplanerare/booking-assistant';

    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newCaseAddress: searchAddress, pestType: searchPestType,
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

    // För inspection-ärenden krävs inte title från användaren
    if (!caseType) {
      return toast.error("Du måste välja en ärendetyp.");
    }

    // Företagsnamn krävs för business-ärenden
    if (caseType === 'business' && !formData.company_name?.trim()) {
      return toast.error("Företagsnamn måste vara ifyllt.");
    }

    if (!formData.start_date || !formData.due_date || !formData.primary_assignee_id) {
      return toast.error("Alla fält med * under 'Bokning & Detaljer' måste vara ifyllda.");
    }

    if ((caseType === 'contract' || caseType === 'inspection') && !selectedContractCustomer) {
      return toast.error('Du måste välja en avtalskund');
    }

    // Validera site för multisite-kunder
    const customer = contractCustomers.find(c => c.id === selectedContractCustomer);
    if ((caseType === 'contract' || caseType === 'inspection') && customer?.is_multisite && !selectedSiteId) {
      return toast.error('Du måste välja en anläggning för denna multisite-kund');
    }
    
    setLoading(true);
    setError(null);

    try {
      // Generera ärendenummer vid submit (inte vid modal-öppning) med kollisionsskydd
      const caseNumber = generatedCaseNumber || await CaseNumberService.generateUniqueCaseNumber();
      if (!generatedCaseNumber) setGeneratedCaseNumber(caseNumber);

      if (caseType === 'inspection') {
        // Hantera stationskontroll-ärenden
        // Om multisite, använd sitens customer_id istället för huvudkundens
        let actualCustomerId = selectedContractCustomer;
        if (customer?.is_multisite && selectedSiteId) {
          actualCustomerId = selectedSiteId;
        }

        // Hämta kundnamn för titeln
        const customerForTitle = selectedSiteId
          ? contractCustomers.find(c => c.id === selectedSiteId)
          : customer;
        const customerName = customerForTitle?.company_name || 'Okänd kund';

        // Skapa case-ärende först
        const caseData = {
          customer_id: actualCustomerId!,
          site_id: customer?.is_multisite ? selectedSiteId : null,
          title: caseNumber,
          description: formData.description || 'Schemalagd stationskontroll',
          status: 'Bokad',
          priority: formData.priority || 'normal',
          service_type: 'inspection' as const,
          pest_type: null,
          scheduled_start: formData.start_date,
          scheduled_end: formData.due_date,
          primary_technician_id: formData.primary_assignee_id,
          primary_technician_name: formData.primary_assignee_name || null,
          secondary_technician_id: formData.secondary_assignee_id || null,
          tertiary_technician_id: formData.tertiary_assignee_id || null,
          contact_person: formData.kontaktperson || customer?.contact_person || null,
          contact_email: formData.e_post_kontaktperson || customer?.contact_email || null,
          contact_phone: formData.telefon_kontaktperson || customer?.contact_phone || null,
          address: formData.adress ? { formatted_address: formData.adress } : null,
          price: null,
          case_number: caseNumber,
          send_booking_confirmation: formData.skicka_bokningsbekraftelse === 'Ja'
        };

        // Skapa case
        const { data: createdCase, error: caseError } = await supabase
          .from('cases')
          .insert([caseData])
          .select('id')
          .single();

        if (caseError) throw caseError;

        // Räkna stationer för denna kund
        const [outdoorResult, indoorResult] = await Promise.all([
          supabase
            .from('equipment_placements')
            .select('id', { count: 'exact' })
            .eq('customer_id', actualCustomerId!)
            .eq('status', 'active'),
          supabase
            .from('indoor_stations')
            .select('id, floor_plan_id', { count: 'exact' })
            .eq('status', 'active')
            .in('floor_plan_id',
              (await supabase
                .from('floor_plans')
                .select('id')
                .eq('customer_id', actualCustomerId!)
              ).data?.map(fp => fp.id) || []
            )
        ]);

        const outdoorCount = outdoorResult.count || 0;
        const indoorCount = indoorResult.count || 0;

        // Skapa inspektionssession kopplad till ärendet
        const sessionData = {
          case_id: createdCase?.id,
          customer_id: actualCustomerId!,
          technician_id: formData.primary_assignee_id,
          scheduled_at: formData.start_date,
          status: 'scheduled' as const,
          total_outdoor_stations: outdoorCount,
          total_indoor_stations: indoorCount,
          notes: formData.description || null
        };

        const { error: sessionError } = await supabase
          .from('station_inspection_sessions')
          .insert([sessionData]);

        if (sessionError) {
          console.error('Varning: Kunde inte skapa inspektionssession:', sessionError);
          // Fortsätt ändå - ärendet är skapat
        }

        toast.success(`Stationskontroll inbokad för ${customerName}!`);

      } else if (caseType === 'contract') {
        // Hantera avtalskundärenden
        // Om multisite, använd sitens customer_id istället för huvudkundens
        let actualCustomerId = selectedContractCustomer;
        if (customer?.is_multisite && selectedSiteId) {
          // selectedSiteId är faktiskt customer_id för siten från SiteSelector
          actualCustomerId = selectedSiteId;
        }

        // Hämta kundnamn för titeln (site eller huvudkund)
        const customerForTitle = selectedSiteId
          ? contractCustomers.find(c => c.id === selectedSiteId)
          : customer;
        const customerName = customerForTitle?.company_name || 'Okänd kund';

        const caseData = {
          customer_id: actualCustomerId, // Använd rätt customer_id (site eller huvudkund)
          site_id: customer?.is_multisite ? selectedSiteId : null,
          title: caseNumber,
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
          case_number: caseNumber
        };

        let createdCaseId: string | null = null;
        if (initialCaseData && initialCaseData.case_type === 'contract') {
          // Uppdatera befintligt avtalskundärende
          const { error } = await supabase.from('cases').update(caseData).eq('id', initialCaseData.id);
          if (error) throw error;
          createdCaseId = initialCaseData.id;
        } else {
          // Skapa nytt avtalskundärende
          const { data, error } = await supabase.from('cases').insert([caseData]).select('id').single();
          if (error) throw error;
          createdCaseId = data?.id || null;
        }

        // Ladda upp valda bilder om det finns några
        if (createdCaseId && selectedImages.length > 0) {
          const { success, failed } = await uploadSelectedImages(selectedImages, createdCaseId, 'contract');
          if (success > 0) {
            toast.success(`${success} bild${success > 1 ? 'er' : ''} uppladdade`);
          }
          if (failed > 0) {
            toast.error(`${failed} bild${failed > 1 ? 'er' : ''} kunde inte laddas upp`);
          }
        }

        toast.success(`Ärende ${caseNumber} har bokats in!`);
      } else {
        // Hantera ClickUp-ärenden (private/business)
        const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';
        let createdClickUpCaseId: string | null = null;

        if (initialCaseData && initialCaseData.case_type !== 'contract') {
          const { error } = await supabase.from(tableName).update({ ...formData, title: caseNumber }).eq('id', initialCaseData.id);
          if (error) throw error;
          createdClickUpCaseId = initialCaseData.id;
          toast.success(`Ärende ${caseNumber} har bokats in!`);
        } else {
          const { data, error } = await supabase.from(tableName).insert([{
            ...formData,
            title: caseNumber,
            case_number: caseNumber,
            status: 'Bokad'
          }]).select('id');
          if (error) throw error;
          createdClickUpCaseId = data?.[0]?.id || null;
          toast.success('Ärendet har skapats!');
        }

        // Ladda upp valda bilder om det finns några
        if (createdClickUpCaseId && selectedImages.length > 0) {
          const { success, failed } = await uploadSelectedImages(selectedImages, createdClickUpCaseId, caseType);
          if (success > 0) {
            toast.success(`${success} bild${success > 1 ? 'er' : ''} uppladdade`);
          }
          if (failed > 0) {
            toast.error(`${failed} bild${failed > 1 ? 'er' : ''} kunde inte laddas upp`);
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
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 py-2.5 border-t border-slate-700/50">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="w-full sm:w-auto">Avbryt</Button>
      <Button type="submit" form="create-case-form" loading={loading} disabled={loading} className="w-full sm:w-auto">
        <CheckCircle className="w-4 h-4 mr-1.5"/>
        {initialCaseData ? 'Boka In Ärende' : 'Skapa & Boka Ärende'}
      </Button>
    </div>
  ) : null;
  
  const showRotRutDetails = formData.r_rot_rut === 'ROT' || formData.r_rot_rut === 'RUT';

  // Dynamisk titel för modalen
  const getModalTitle = () => {
    if (initialCaseData) return `Boka in: ${initialCaseData.title}`;
    if (step === 'selectType') return 'Välj ärendetyp';
    switch (caseType) {
      case 'private': return 'Nytt ärende: Privatperson';
      case 'business': return 'Nytt ärende: Företag';
      case 'contract': return 'Nytt ärende: Avtalskund';
      case 'inspection': return 'Ny stationskontroll';
      default: return 'Nytt ärende';
    }
  };

  // Dynamisk storlek för modalen
  const getModalSize = () => {
    if (step === 'selectType') return 'max-w-2xl'; // Smalare för typval
    // Alla ärendetyper med tvåkolumnslayout behöver full bredd
    return 'max-w-5xl';
  };

  return (
      <Modal isOpen={isOpen} onClose={onClose} title={getModalTitle()} size={`w-full sm:w-11/12 ${getModalSize()}`} preventClose={loading} footer={footer} usePortal={true}>
        <div className="p-4 max-h-[85vh] overflow-y-auto">
          {step === 'selectType' && !initialCaseData && (
              <div className="space-y-3">
                {/* Rad 1: Engångsärenden */}
                <div className="flex flex-col md:flex-row gap-3">
                  <button type="button" onClick={() => selectCaseType('private')} className="flex-1 p-4 text-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer">
                    <User className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                    <h3 className="text-base font-semibold">Privatperson</h3>
                    <p className="text-xs text-slate-400 mt-1">Engångsjobb via ClickUp</p>
                  </button>
                  <button type="button" onClick={() => selectCaseType('business')} className="flex-1 p-4 text-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer">
                    <Building className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    <h3 className="text-base font-semibold">Företag</h3>
                    <p className="text-xs text-slate-400 mt-1">Engångsjobb via ClickUp</p>
                  </button>
                </div>

                {/* Rad 2: Avtalskundrelaterade ärenden */}
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Avtalskunder</p>
                  <div className="flex flex-col md:flex-row gap-3">
                    <button type="button" onClick={() => selectCaseType('contract')} className="flex-1 p-4 text-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border-2 border-emerald-500/30 cursor-pointer">
                      <FileCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                      <h3 className="text-base font-semibold">Servicebesök</h3>
                      <p className="text-xs text-slate-400 mt-1">Återkommande tjänster</p>
                      {contractCustomers.length > 0 && (
                        <p className="text-xs text-emerald-400 mt-1">{contractCustomers.length} kunder</p>
                      )}
                    </button>
                    <button type="button" onClick={() => selectCaseType('inspection')} className="flex-1 p-4 text-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border-2 border-cyan-500/30 cursor-pointer">
                      <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                      <h3 className="text-base font-semibold">Stationskontroll</h3>
                      <p className="text-xs text-slate-400 mt-1">Kontroll av fällor & stationer</p>
                      {contractCustomers.length > 0 && (
                        <p className="text-xs text-cyan-400 mt-1">{contractCustomers.length} kunder</p>
                      )}
                    </button>
                  </div>
                </div>
              </div>
          )}
          {step === 'form' && (
            <form id="create-case-form" onSubmit={handleSubmit} className="space-y-3">
              {!initialCaseData && !initialCaseType && (
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="flex items-center gap-2 text-slate-400 hover:text-white -ml-2"><ChevronLeft className="w-4 h-4" /> Byt kundtyp</Button>
              )}
              {error && (<div className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl flex items-center gap-3"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-sm text-red-400">{error}</p></div>)}
              
              {/* Avtalskund-väljare (för contract och inspection) — sökbar dropdown */}
              {(caseType === 'contract' || caseType === 'inspection') && (
                <div className={`p-3 ${caseType === 'inspection' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-emerald-500/10 border-emerald-500/30'} border rounded-xl`}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {caseType === 'inspection' ? 'Välj kund med stationer *' : 'Välj avtalskund *'}
                  </label>
                  <div ref={customerDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-left flex items-center justify-between transition-colors hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                    >
                      {selectedContractCustomer ? (
                        <span className="text-white text-sm truncate">
                          {(() => {
                            const c = contractCustomers.find(c => c.id === selectedContractCustomer);
                            if (!c) return 'Laddar...';
                            return `${c.company_name}${c.customer_number ? ` (${c.customer_number})` : c.organization_number ? ` (${c.organization_number})` : ''}`;
                          })()}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">
                          {caseType === 'inspection' ? 'Sök och välj kund med stationer...' : 'Sök och välj kund...'}
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${customerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {customerDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-2 border-b border-slate-700">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                              placeholder="Sök företagsnamn, kundnummer, org.nr..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredContractCustomers.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-500">
                              Inga kunder matchar sökningen
                            </div>
                          ) : (
                            filteredContractCustomers.map(customer => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  setSelectedContractCustomer(customer.id);
                                  setSelectedSiteId(null);
                                  setCustomerDropdownOpen(false);
                                  setCustomerSearchTerm('');
                                }}
                                className={`w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between ${
                                  selectedContractCustomer === customer.id ? 'bg-[#20c58f]/10' : ''
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className={`text-sm font-medium truncate ${selectedContractCustomer === customer.id ? 'text-[#20c58f]' : 'text-white'}`}>{customer.company_name}</div>
                                  <div className="text-xs text-slate-400 truncate">
                                    {customer.customer_number && <span className="mr-2">#{customer.customer_number}</span>}
                                    {customer.organization_number && <span>Org: {customer.organization_number}</span>}
                                  </div>
                                </div>
                                {selectedContractCustomer === customer.id && (
                                  <CheckCircle className="w-4 h-4 text-[#20c58f] flex-shrink-0 ml-2" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {caseType === 'inspection' && customersWithStations.size === 0 && (
                    <p className="text-xs text-amber-400 mt-1">
                      Inga kunder med etablerade stationer hittades.
                    </p>
                  )}
                </div>
              )}

              {/* Site-väljare för multisite-kunder (contract och inspection) */}
              {(caseType === 'contract' || caseType === 'inspection') && selectedContractCustomer && (
                (() => {
                  const selectedCustomer = contractCustomers.find(c => c.id === selectedContractCustomer);
                  if (selectedCustomer?.is_multisite && selectedCustomer?.organization_id) {
                    return (
                      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
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
                        <p className="text-xs text-slate-500 mt-1">
                          Välj vilken anläggning {caseType === 'inspection' ? 'stationskontrollen' : 'ärendet'} gäller
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()
              )}
              
              {/* Offertinnehåll (visas om ärendet har Oneflow-koppling) */}
              {offerDetails && (
                <div className="p-3 bg-[#20c58f]/5 border border-[#20c58f]/20 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOfferExpanded(v => !v)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <FileCheck className="w-4 h-4 text-[#20c58f]" />
                    <span className="text-sm font-semibold text-white flex-1">Offertinnehåll</span>
                    {offerDetails.total_value && (
                      <span className="text-xs font-medium text-[#20c58f] mr-2">
                        {offerDetails.total_value.toLocaleString('sv-SE')} kr
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${offerExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {offerExpanded && (
                    <div className="mt-3 space-y-3">
                      {/* Produkter/tjänster */}
                      {offerDetails.selected_products && offerDetails.selected_products.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1.5">Produkter / Tjänster</p>
                          <div className="space-y-1">
                            {offerDetails.selected_products.map((group: any, gi: number) =>
                              (group.products || [group]).map((product: any, pi: number) => (
                                <div key={`${gi}-${pi}`} className="flex items-center justify-between px-3 py-1.5 bg-slate-800/40 rounded text-xs">
                                  <span className="text-slate-200">
                                    {product.quantity?.amount > 1 ? `${product.quantity.amount}× ` : ''}
                                    {product.name || 'Produkt'}
                                  </span>
                                  {product.price_1?.amount?.amount && (
                                    <span className="text-slate-400">
                                      {parseFloat(product.price_1.amount.amount).toLocaleString('sv-SE')} kr
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                      {/* Avtalstext */}
                      {offerDetails.agreement_text && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Avtalstext</p>
                          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-800/30 rounded p-2">
                            {offerDetails.agreement_text}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STATIONSKONTROLL: Tvåkolumnslayout med bokningsassistent */}
              {caseType === 'inspection' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Vänster kolumn: Intelligent bokning */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                      <Zap className="w-4 h-4 text-cyan-400"/>Intelligent Bokning
                    </h3>

                    {/* Adress (hämtas från kund) */}
                    <Input
                      label="Adress"
                      name="adress"
                      placeholder="Fullständig adress..."
                      value={typeof formData.adress === 'string' ? formData.adress : ''}
                      onChange={handleChange}
                    />

                    {/* Account Manager-info */}
                    {accountManagerName && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs text-slate-400">Account Manager:</span>
                        <span className="text-xs text-amber-300 font-medium">{accountManagerName}</span>
                      </div>
                    )}

                    {/* Sökparametrar för bokningsassistent */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Hitta tider från:</label>
                        <DatePicker
                          selected={searchStartDate}
                          onChange={(date) => handleDateChange(date, 'searchStartDate')}
                          locale="sv"
                          dateFormat="yyyy-MM-dd"
                          placeholderText="Välj startdatum..."
                          isClearable
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Tidsåtgång</label>
                        <select
                          value={timeSlotDuration}
                          onChange={e => setTimeSlotDuration(Number(e.target.value))}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                          <option value={60}>1 timme</option>
                          <option value={90}>1.5 timmar</option>
                          <option value={120}>2 timmar</option>
                          <option value={180}>3 timmar</option>
                          <option value={240}>4 timmar</option>
                        </select>
                      </div>
                    </div>

                    {/* Teknikerval för sökning */}
                    <div>
                      <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                        <Users size={14} /> Sök bland valda tekniker
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {technicians.map(tech => (
                          <label key={tech.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                              checked={selectedTechnicianIds.includes(tech.id)}
                              onChange={() => handleTechnicianSelectionChange(tech.id)}
                            />
                            <span className="text-sm text-white truncate">{tech.name}</span>
                              {tech.id === accountManagerTechId && (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Star size={10} className="fill-amber-400" />AM
                                </span>
                              )}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Hitta tider-knapp */}
                    <Button
                      type="button"
                      onClick={handleSuggestTime}
                      loading={suggestionLoading}
                      className="w-full"
                      variant="primary"
                      disabled={!selectedContractCustomer}
                    >
                      <Zap className="w-4 h-4 mr-1.5"/> Hitta bästa tid & tekniker
                    </Button>

                    {!selectedContractCustomer && (
                      <p className="text-xs text-amber-400 text-center">Välj en kund först för att använda bokningsassistenten</p>
                    )}

                    {/* Laddningsindikator */}
                    {suggestionLoading && (
                      <div className="text-center py-4">
                        <LoadingSpinner text="Analyserar rutter och hittar optimala tider..." />
                      </div>
                    )}

                    {/* Bokningsförslag */}
                    {suggestions.length > 0 && (
                      <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <CalendarSearch className="w-4 h-4 text-cyan-400" />
                          Bokningsförslag ({suggestions.length} st)
                        </h4>
                        <div className="max-h-[40vh] overflow-y-auto pr-1 -mr-1">
                          <BookingSuggestionList
                            suggestions={suggestions}
                            onSelect={applySuggestion}
                            accountManagerTechId={accountManagerTechId}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Höger kolumn: Bokning & Detaljer */}
                  <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Bokning & Detaljer</h3>
                        <p className="text-xs text-slate-400">Verifiera kundinfo och välj tid för stationskontroll</p>
                      </div>
                    </div>

                    {/* Kund & Kontakt */}
                    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                        <User size={14}/> Kund & Kontakt
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Kontaktperson"
                          name="kontaktperson"
                          value={formData.kontaktperson || ''}
                          onChange={handleChange}
                        />
                        <Input
                          label="Telefonnummer"
                          name="telefon_kontaktperson"
                          value={formData.telefon_kontaktperson || ''}
                          onChange={handleChange}
                        />
                      </div>
                      <Input
                        type="email"
                        label="E-post Kontaktperson"
                        name="e_post_kontaktperson"
                        value={formData.e_post_kontaktperson || ''}
                        onChange={handleChange}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Organisationsnummer"
                          name="org_nr"
                          value={formData.org_nr || ''}
                          onChange={handleChange}
                        />
                        <Input
                          label="Beställare"
                          name="bestallare"
                          value={formData.bestallare || ''}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    {/* Bokning & Team */}
                    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                        <Users size={14}/> Bokning & Team
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Starttid *</label>
                          <DatePicker
                            selected={formData.start_date ? new Date(formData.start_date) : null}
                            onChange={(date) => handleDateChange(date, 'start_date')}
                            locale="sv"
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="yyyy-MM-dd HH:mm"
                            timeCaption="Tid"
                            placeholderText="Välj starttid..."
                            isClearable
                            required
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Sluttid *</label>
                          <DatePicker
                            selected={formData.due_date ? new Date(formData.due_date) : null}
                            onChange={(date) => handleDateChange(date, 'due_date')}
                            locale="sv"
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="yyyy-MM-dd HH:mm"
                            timeCaption="Tid"
                            placeholderText="Välj sluttid..."
                            minDate={formData.start_date ? new Date(formData.start_date) : undefined}
                            isClearable
                            required
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Ansvarig tekniker *</label>
                        <select
                          name="primary_assignee_id"
                          value={formData.primary_assignee_id || ''}
                          onChange={handleChange}
                          required
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="" disabled>Välj tekniker...</option>
                          {technicians.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Extra tekniker (valfri)</label>
                        <select
                          name="secondary_assignee_id"
                          value={formData.secondary_assignee_id || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="">Ingen vald</option>
                          {technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.tertiary_assignee_id).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Extra tekniker 2 (valfri)</label>
                        <select
                          name="tertiary_assignee_id"
                          value={formData.tertiary_assignee_id || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="">Ingen vald</option>
                          {technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.secondary_assignee_id).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Ärendeinformation */}
                    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                        <Briefcase size={14}/> Ärendeinformation
                      </h4>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          <FileText size={12} className="inline mr-1" />
                          Anteckningar till tekniker (valfritt)
                        </label>
                        <textarea
                          name="description"
                          value={formData.description || ''}
                          onChange={handleChange}
                          rows={2}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                          placeholder="T.ex. portkod, speciella instruktioner..."
                        />
                      </div>
                    </div>

                    {/* Utskick */}
                    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                        <MapPin size={14}/> Utskick
                      </h4>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Skicka bokningsbekräftelse?</label>
                        <select
                          name="skicka_bokningsbekraftelse"
                          value={formData.skicka_bokningsbekraftelse || 'Nej'}
                          onChange={handleChange}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="Nej">Nej</option>
                          <option value="JA - Första Klockslaget">JA - Första Klockslaget</option>
                          <option value="JA - Tidsspann">JA - Tidsspann</option>
                        </select>
                      </div>
                    </div>

                    {/* Info-ruta */}
                    <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-700">
                      <p className="text-xs text-slate-400">
                        <span className="font-medium text-cyan-400">Tips:</span> Stationskontrollen kommer automatiskt visa alla stationer (utomhus och inomhus) för den valda kunden.
                        Teknikern kan sedan gå igenom och kontrollera varje station i valfri ordning.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ÖVRIGA ÄRENDETYPER: Fullt formulär */}
              {caseType !== 'inspection' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3 flex flex-col">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2"><Zap className="w-4 h-4 text-blue-400"/>Intelligent Bokning</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label="Adress *" name="adress" placeholder="Fullständig adress..." value={typeof formData.adress === 'string' ? formData.adress : ''} onChange={handleChange} required />
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Hitta tider från:</label>
                        <DatePicker selected={searchStartDate} onChange={(date) => handleDateChange(date, 'searchStartDate')} locale="sv" dateFormat="yyyy-MM-dd" placeholderText="Välj startdatum..." isClearable className="w-full" />
                    </div>
                  </div>
                  {/* Account Manager-info */}
                  {accountManagerName && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-slate-400">Account Manager:</span>
                      <span className="text-xs text-amber-300 font-medium">{accountManagerName}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Skadedjur *</label>
                      <select name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} required className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white">
                          <option value="" disabled>Välj typ...</option>
                          {PEST_TYPES.map(pest => <option key={pest} value={pest}>{pest}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Tidsåtgång</label>
                      <select value={timeSlotDuration} onChange={e => setTimeSlotDuration(Number(e.target.value))} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white">
                          <option value={60}>1 timme</option><option value={90}>1.5 timmar</option><option value={120}>2 timmar</option><option value={180}>3 timmar</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Antal tekniker som krävs</label>
                      <select value={numberOfTechnicians} onChange={e => setNumberOfTechnicians(Number(e.target.value))} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white">
                          <option value={1}>1 tekniker (Hitta bästa individ)</option>
                          <option value={2}>2 tekniker (Hitta bästa team)</option>
                          <option value={3}>3 tekniker (Hitta bästa team)</option>
                      </select>
                    </div>

                    {/* Checkbox för att välja tekniker (endast för single booking) */}
                    {numberOfTechnicians === 1 && (
                      <div>
                        <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5"><Users size={14} /> Sök bland valda tekniker</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {technicians.map(tech => (
                            <label key={tech.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                                checked={selectedTechnicianIds.includes(tech.id)}
                                onChange={() => handleTechnicianSelectionChange(tech.id)}
                              />
                              <span className="text-sm text-white truncate">{tech.name}</span>
                              {tech.id === accountManagerTechId && (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Star size={10} className="fill-amber-400" />AM
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button type="button" onClick={handleSuggestTime} loading={suggestionLoading} className="w-full" variant="primary"><Zap className="w-4 h-4 mr-1.5"/> Hitta bästa tid & tekniker</Button>
                  </div>

                  {/* Resultat-sektion - under Intelligent Bokning i vänstra kolumnen */}
                  {suggestionLoading && (
                    <div className="text-center py-4">
                      <LoadingSpinner text="Analyserar rutter och hittar optimala tider..." />
                    </div>
                  )}

                  {/* Single technician suggestions */}
                  {suggestions.length > 0 && (
                    <div className="pt-3 border-t border-slate-700">
                      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <CalendarSearch className="w-4 h-4 text-purple-400" />
                        Bokningsförslag ({suggestions.length} st)
                      </h4>
                      <div className="max-h-[50vh] overflow-y-auto pr-1 -mr-1">
                        <BookingSuggestionList
                          suggestions={suggestions}
                          onSelect={applySuggestion}
                          accountManagerTechId={accountManagerTechId}
                        />
                      </div>
                    </div>
                  )}

                  {/* Team suggestions */}
                  {teamSuggestions.length > 0 && (
                    <div className="pt-4 border-t border-slate-700 space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        Team-förslag ({numberOfTechnicians} tekniker)
                      </h4>
                      <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1 -mr-1">
                        {teamSuggestions.map((sugg, index) => {
                          const scoreInfo = getTeamEfficiencyInfo(sugg.efficiency_score);
                          const totalTravel = sugg.technicians.reduce((sum, tech) => sum + tech.travel_time_minutes, 0);
                          const isTopPick = index === 0;
                          return (
                            <div
                              key={index}
                              className={`
                                relative p-3 rounded-lg cursor-pointer transition-all duration-200
                                ${isTopPick ? 'bg-emerald-500/10 border border-emerald-500/40' : 'bg-slate-700/50 border border-slate-600 hover:border-slate-500'}
                                hover:shadow-lg hover:shadow-slate-900/30
                              `}
                              onClick={() => applyTeamSuggestion(sugg)}
                            >
                              {isTopPick && (
                                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg">
                                  Bäst
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-lg font-bold text-white">
                                    {formatTime(sugg.start_time)} – {formatTime(sugg.end_time)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {new Date(sugg.start_time).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                  </p>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-semibold ${scoreInfo.color} bg-slate-800`}>
                                  {scoreInfo.label}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-blue-400 mb-2">
                                <Users className="w-3.5 h-3.5" />
                                <span>Total: {totalTravel} min restid</span>
                              </div>
                              <div className="pt-2 border-t border-slate-600/50 space-y-1">
                                {sugg.technicians.map(tech => (
                                  <div key={tech.id} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300 flex items-center gap-1">
                                      {tech.name}
                                      {tech.id === accountManagerTechId && (
                                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-1 py-0.5 rounded-full">AM</span>
                                      )}
                                    </span>
                                    <span className="text-slate-500">{tech.travel_time_minutes} min</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Höger kolumn: Bokning & Detaljer */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2"><FileText className="w-4 h-4 text-green-400"/>Bokning & Detaljer</h3>
                  <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2"><User size={14}/> Kund & Kontakt</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input label="Kontaktperson *" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} required />
                          <Input label="Telefonnummer *" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} required />
                      </div>
                      <Input type="email" label="E-post Kontaktperson" name="e_post_kontaktperson" value={formData.e_post_kontaktperson || ''} onChange={handleChange} />
                      {caseType === 'private' ? (
                          <Input label="Personnummer *" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} required />
                      ) : (
                          <>
                            <Input label="Företagsnamn *" name="company_name" value={(formData as any).company_name || ''} onChange={handleChange} required />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />
                              <Input label="Beställare" name="bestallare" value={formData.bestallare || ''} onChange={handleChange} />
                            </div>
                          </>
                      )}
                  </div>
                  <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2"><Users size={14}/> Bokning & Team</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="block text-xs font-medium text-slate-400 mb-1">Starttid *</label><DatePicker selected={formData.start_date ? new Date(formData.start_date) : null} onChange={(date) => handleDateChange(date, 'start_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" timeCaption="Tid" timeInputLabel="Tid:" placeholderText="Välj starttid..." isClearable required className="w-full" /></div>
                          <div><label className="block text-xs font-medium text-slate-400 mb-1">Sluttid *</label><DatePicker selected={formData.due_date ? new Date(formData.due_date) : null} onChange={(date) => handleDateChange(date, 'due_date')} locale="sv" showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="yyyy-MM-dd HH:mm" timeCaption="Tid" timeInputLabel="Tid:" placeholderText="Välj sluttid..." isClearable required className="w-full" /></div>
                      </div>
                      <div className="space-y-3">
                        <div><label className="block text-xs font-medium text-slate-400 mb-1">Ansvarig tekniker *</label><select name="primary_assignee_id" value={formData.primary_assignee_id || ''} onChange={handleChange} required className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"><option value="" disabled>Välj tekniker...</option>{technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                        <div><label className="block text-xs font-medium text-slate-400 mb-1">Extra tekniker (valfri)</label><select name="secondary_assignee_id" value={formData.secondary_assignee_id || ''} onChange={handleChange} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"><option value="">Ingen vald</option>{technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.tertiary_assignee_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                        <div><label className="block text-xs font-medium text-slate-400 mb-1">Extra tekniker 2 (valfri)</label><select name="tertiary_assignee_id" value={formData.tertiary_assignee_id || ''} onChange={handleChange} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"><option value="">Ingen vald</option>{technicians.filter(t => t.id !== formData.primary_assignee_id && t.id !== formData.secondary_assignee_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                      </div>
                  </div>
                  <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                       <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2"><Briefcase size={14}/> Ärendeinformation</h4>
                       <div><label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning till tekniker</label><textarea name="description" value={formData.description || ''} onChange={handleChange} rows={2} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" placeholder="Kort om ärendet, portkod, etc."/></div>
                       {caseType === 'business' && (<Input label="Märkning faktura" name="markning_faktura" value={formData.markning_faktura || ''} onChange={handleChange} />)}
                  </div>
                  <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2"><Euro size={14}/> Ekonomi & Utskick</h4>
                      <Input type="number" label={caseType === 'private' ? 'Pris (inkl. moms)' : 'Pris (exkl. moms)'} name="pris" value={formData.pris ?? ''} onChange={handleChange} />
                      {caseType === 'private' && (
                          <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">ROT/RUT</label>
                              <select name="r_rot_rut" value={formData.r_rot_rut || 'Nej'} onChange={handleChange} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white">
                                  <option value="Nej">Ej avdragsgillt</option><option value="ROT">ROT</option><option value="RUT">RUT</option><option value="INKL moms">Pris inkl. moms</option>
                              </select>
                          </div>
                      )}
                      {showRotRutDetails && (
                          <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                               <h5 className="text-sm font-semibold text-white flex items-center gap-1.5"><Percent size={14}/> Detaljer för ROT/RUT-avdrag</h5>
                               <Input label="Fastighetsbeteckning" name="r_fastighetsbeteckning" value={formData.r_fastighetsbeteckning || ''} onChange={handleChange} />
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <Input type="number" label="Arbetskostnad" name="r_arbetskostnad" value={formData.r_arbetskostnad ?? ''} onChange={handleChange} />
                                  <Input type="number" label="Material & Utrustning" name="r_material_utrustning" value={formData.r_material_utrustning ?? ''} onChange={handleChange} />
                                  <Input type="number" label="Servicebil" name="r_servicebil" value={formData.r_servicebil ?? ''} onChange={handleChange} />
                               </div>
                          </div>
                      )}
                      {caseType === 'business' && (<Input type="email" label="E-post Faktura" name="e_post_faktura" value={formData.e_post_faktura || ''} onChange={handleChange} />)}
                      <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Skicka bokningsbekräftelse?</label>
                          <select name="skicka_bokningsbekraftelse" value={formData.skicka_bokningsbekraftelse || 'Nej'} onChange={handleChange} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white">
                              <option value="Nej">Nej</option><option value="JA - Första Klockslaget">JA - Första Klockslaget</option><option value="JA - Tidsspann">JA - Tidsspann</option>
                          </select>
                      </div>
                  </div>
                  {/* Bilder sektion */}
                  <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                        <ImageIcon size={14} className="text-cyan-400" /> Bilder (valfritt)
                      </h4>

                      {/* Visa befintliga bilder från kund */}
                      {existingImages.length > 0 && (
                        <div className="mb-2 p-3 bg-slate-800/30 rounded-xl border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <ImageIcon size={12} className="text-emerald-400" />
                            <span className="text-xs text-emerald-400 font-medium">
                              {existingImages.length} bild{existingImages.length > 1 ? 'er' : ''} från kund
                            </span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {existingImages.map((img) => (
                              <img
                                key={img.id}
                                src={img.url}
                                alt="Kundens bild"
                                className="w-20 h-20 object-cover rounded-lg border border-slate-600 hover:border-emerald-500 cursor-pointer transition-colors"
                                onClick={() => window.open(img.url, '_blank')}
                                title="Klicka för att öppna i ny flik"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-sm text-slate-400">
                        Lägg till bilder som dokumenterar ärendet. Kategorisera som "Före", "Efter" eller "Övrigt".
                      </p>
                      <CaseImageSelector
                        selectedImages={selectedImages}
                        onImagesChange={setSelectedImages}
                        defaultCategory="before"
                        maxFiles={10}
                      />
                  </div>
                </div>
              </div>
              )}
            </form>
          )}
        </div>
      </Modal>
  );
}
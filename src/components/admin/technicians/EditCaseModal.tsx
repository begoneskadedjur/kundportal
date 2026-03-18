// 📁 src/components/admin/technicians/EditCaseModal.tsx
// ⭐ VERSION 2.3 - LÄGGER TILL AKTIVITET & KOMMUNIKATION ⭐

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { AlertCircle, CheckCircle, FileText, User, DollarSign, Clock, Play, Pause, RotateCcw, Save, AlertTriangle, Calendar as CalendarIcon, BookOpen, MapPin, FileCheck, FileSignature, ChevronRight, Image as ImageIcon, Plus, X, MessageSquare, Trash2, Pencil } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Modal from '../../ui/Modal'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import toast from 'react-hot-toast'

// ✅ NYA IMPORTER FÖR DATUMVÄLJAREN
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import "../../../styles/DatePickerDarkTheme.css"

// Rapport funktionalitet
import WorkReportDropdown from '../../shared/WorkReportDropdown'
import { useWorkReportGeneration } from '../../../hooks/useWorkReportGeneration'

// Tekniker-dropdown
// TechnicianDropdown ersatt av inline initialer-cirklar

// Bildhantering - med draft-läge
import CaseImageGallery, { CaseImageGalleryRef } from '../../shared/CaseImageGallery'

// Preparatanvändning
import CasePreparationsSection from '../../shared/CasePreparationsSection'

// Artikelväljare för fakturering
import CaseArticleSelector from '../../shared/CaseArticleSelector'

// Fakturering - auto-generera vid ärendeavslut
import { InvoiceService } from '../../../services/invoiceService'
import { CaseBillingService } from '../../../services/caseBillingService'
import { PriceListService } from '../../../services/priceListService'

// Kommunikation
import { CommunicationSlidePanel } from '../../communication'
import { CaseType } from '../../../types/communication'

// Datum-hjälpfunktioner för svensk tidszon
import { toSwedishISOString } from '../../../utils/dateHelpers'

// Skadedjurstyper för följeärenden
import { PEST_TYPE_OPTIONS } from '../../../utils/clickupFieldMapper'

// Radering av ärenden
import DeleteCaseConfirmDialog from '../../shared/DeleteCaseConfirmDialog'
import type { DeleteableCaseType } from '../../../services/caseDeleteService'

// Återbesök modal
import RevisitModal from './RevisitModal'

// Provision
import CommissionSection from '../../shared/CommissionSection'
import type { CaseBillingSummary } from '../../../types/caseBilling'
import { ProvisionService } from '../../../services/provisionService'
import type { TechnicianShare } from '../../../types/provision'


registerLocale('sv', sv) // Registrera svenskt språk för komponenten

interface TechnicianCase {
  id: string;
  case_type: 'private' | 'business' | 'contract';
  title: string;
  case_number?: string;
  description?: string;
  status: string;
  case_price?: number;
  kontaktperson?: string;
  telefon_kontaktperson?: string;
  e_post_kontaktperson?: string;
  skadedjur?: string;
  org_nr?: string;
  personnummer?: string;
  material_cost?: number;
  time_spent_minutes?: number;
  work_started_at?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  // Adress (JSONB eller string)
  adress?: any;
  // Tekniker-tilldelningar (upp till 3 tekniker per ärende)
  primary_assignee_id?: string | null;
  primary_assignee_name?: string | null;
  secondary_assignee_id?: string | null;
  secondary_assignee_name?: string | null;
  tertiary_assignee_id?: string | null;
  tertiary_assignee_name?: string | null;
  // ROT/RUT fält
  r_rot_rut?: string;
  r_fastighetsbeteckning?: string;
  r_arbetskostnad?: number;
  r_material_utrustning?: number;
  r_servicebil?: number;
  // Rapport
  rapport?: string;
  // Kund-koppling
  customer_id?: string | null;
  // Följeärende-fält
  parent_case_id?: string | null;
  created_by_technician_id?: string | null;
  created_by_technician_name?: string | null;
  // Provision
  is_commission_eligible?: boolean;
}

interface EditCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedCase: TechnicianCase) => void
  caseData: TechnicianCase | null
  openCommunicationOnLoad?: boolean
}

interface BackupData {
  caseId: string;
  totalMinutes: number;
  sessionMinutes: number;
  startedAt: string;
  timestamp: string;
}

const statusOrder = [ 'Öppen', 'Bokad', 'Bokat', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat' ];

// Utility-funktion för att formatera adress (samma logik som TechnicianCases.tsx)
const formatAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') { 
    try { 
      const p = JSON.parse(address); 
      return p.formatted_address || address; 
    } catch (e) { 
      return address; 
    } 
  }
  return '';
};

// Utility-funktion för att öppna Maps med smart mobil/desktop-hantering
const openInMaps = (addressData: any) => {
  if (!addressData) return;
  
  // Detect if mobile device
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // För mobil: använd koordinater om tillgängliga, annars adress
    if (addressData && addressData.location && addressData.location.lat && addressData.location.lng) {
      // Öppna Google Maps-appen med koordinater för exakt position
      const lat = addressData.location.lat;
      const lng = addressData.location.lng;
      window.location.href = `https://maps.google.com/maps?q=${lat},${lng}`;
    } else {
      // Fallback till adress om inga koordinater
      const address = formatAddress(addressData);
      if (address) {
        const encodedAddress = encodeURIComponent(address);
        window.location.href = `https://maps.google.com/maps?q=${encodedAddress}`;
      }
    }
  } else {
    // Desktop - öppna Google Maps i ny flik
    if (addressData && addressData.location && addressData.location.lat && addressData.location.lng) {
      const lat = addressData.location.lat;
      const lng = addressData.location.lng;
      window.open(`https://maps.google.com/maps?q=${lat},${lng}`, '_blank');
    } else {
      const address = formatAddress(addressData);
      if (address) {
        const encodedAddress = encodeURIComponent(address);
        window.open(`https://maps.google.com/maps?q=${encodedAddress}`, '_blank');
      }
    }
  }
};

const safeRoundMinutes = (minutes: number): number => {
  return Math.round(Math.max(0, minutes));
};

const formatMinutesDetailed = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || minutes < 0.1) return '0:00';
  const totalMinutes = Math.max(0, minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes * 60) % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${mins}:${seconds.toString().padStart(2, '0')}`;
};

const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || minutes < 1) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  let result = '';
  if (hours > 0) result += `${hours} tim `;
  result += `${remainingMinutes} min`;
  return result;
};

const useRealTimeTimer = (case_: TechnicianCase | null) => {
  const [displayTime, setDisplayTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!case_) {
      setDisplayTime(0);
      setIsRunning(false);
      return;
    }
    const baseTime = case_.time_spent_minutes || 0;
    const isActive = Boolean(case_.work_started_at);
    setIsRunning(isActive);
    if (isActive) {
      const startTime = new Date(case_.work_started_at!).getTime();
      const updateTimer = () => {
        const now = Date.now();
        const sessionMinutes = (now - startTime) / (1000 * 60);
        setDisplayTime(baseTime + sessionMinutes);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setDisplayTime(baseTime);
    }
  }, [case_?.work_started_at, case_?.time_spent_minutes, case_?.id]);

  return { displayTime, isRunning };
};

const useTimeBackupSystem = (currentCase: TechnicianCase | null) => {
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);

  useEffect(() => {
    if (!currentCase) return;
    const backupKey = `time_backup_${currentCase.id}`;
    const backup = localStorage.getItem(backupKey);
    if (backup) {
      try {
        const data: BackupData = JSON.parse(backup);
        const backupTime = new Date(data.timestamp);
        const now = new Date();
        const backupMinutes = safeRoundMinutes(data.totalMinutes);
        const currentMinutes = currentCase.time_spent_minutes || 0;
        const hoursSinceBackup = (now.getTime() - backupTime.getTime()) / (1000 * 60 * 60);
        if (backupMinutes > currentMinutes && hoursSinceBackup < 8) {
          setPendingRestore({ ...data, totalMinutes: backupMinutes });
        } else {
          localStorage.removeItem(backupKey);
        }
      } catch (e) {
        console.error('Backup parse error:', e);
        localStorage.removeItem(backupKey);
      }
    }
  }, [currentCase?.id]);

  useEffect(() => {
    if (!currentCase?.work_started_at) return;
    const backupInterval = setInterval(() => {
      const now = new Date();
      const startTime = new Date(currentCase.work_started_at!);
      const sessionMinutes = (now.getTime() - startTime.getTime()) / 1000 / 60;
      const totalMinutes = (currentCase.time_spent_minutes || 0) + sessionMinutes;
      const backup: BackupData = {
        caseId: currentCase.id,
        totalMinutes: safeRoundMinutes(totalMinutes),
        sessionMinutes: safeRoundMinutes(sessionMinutes),
        startedAt: currentCase.work_started_at,
        timestamp: now.toISOString()
      };
      localStorage.setItem(`time_backup_${currentCase.id}`, JSON.stringify(backup));
      setLastBackup(now);
    }, 30000);
    return () => clearInterval(backupInterval);
  }, [currentCase?.work_started_at, currentCase?.time_spent_minutes, currentCase?.id]);

  const restoreFromBackup = useCallback(async (): Promise<Partial<TechnicianCase> | false> => {
    if (!pendingRestore || !currentCase) return false;
    try {
      const tableName = currentCase.case_type === 'private' ? 'private_cases' : currentCase.case_type === 'business' ? 'business_cases' : 'cases';
      const safeMinutes = safeRoundMinutes(pendingRestore.totalMinutes);
      const { data, error } = await supabase
        .from(tableName)
        .update({ time_spent_minutes: safeMinutes, work_started_at: null })
        .eq('id', currentCase.id)
        .select()
        .single();
      if (error) throw error;
      localStorage.removeItem(`time_backup_${currentCase.id}`);
      setPendingRestore(null);
      toast.success(`Återställde ${formatMinutes(safeMinutes)} arbetstid!`);
      return data;
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error('Kunde inte återställa arbetstid');
      return false;
    }
  }, [pendingRestore, currentCase]);

  const clearBackup = useCallback(() => {
    if (currentCase) {
      localStorage.removeItem(`time_backup_${currentCase.id}`);
    }
    setPendingRestore(null);
  }, [currentCase]);

  return { lastBackup, pendingRestore, restoreFromBackup, clearBackup };
};

const BackupRestorePrompt: React.FC<{
  pendingRestore: BackupData | null;
  onRestore: () => Promise<any>;
  onDismiss: () => void;
}> = ({ pendingRestore, onRestore, onDismiss }) => {
  const [restoring, setRestoring] = useState(false);
  if (!pendingRestore) return null;

  const handleRestore = async () => {
    setRestoring(true);
    await onRestore();
    setRestoring(false);
  };

  const timeDiff = Math.round((new Date().getTime() - new Date(pendingRestore.timestamp).getTime()) / 1000 / 60);

  return (
    <div className="mb-4 p-4 bg-amber-500/20 border border-amber-500/40 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-400 mb-2">Återställ förlorad arbetstid?</h4>
          <p className="text-xs text-amber-300 mb-3">
            Hittade osparad arbetstid från för {timeDiff} minuter sedan:
            <span className="font-bold ml-1">{formatMinutes(pendingRestore.totalMinutes)}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="warning" onClick={handleRestore} loading={restoring} disabled={restoring}>
              Återställ arbetstid
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss} disabled={restoring}>
              Ignorera
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EditCaseModal({ isOpen, onClose, onSuccess, caseData, openCommunicationOnLoad }: EditCaseModalProps) {
  const navigate = useNavigate()
  const { profile, activeView } = useAuth()
  const [loading, setLoading] = useState(false)
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentCase, setCurrentCase] = useState<TechnicianCase | null>(null)
  const [formData, setFormData] = useState<Partial<TechnicianCase>>({})
  const [imageRefreshTrigger, setImageRefreshTrigger] = useState(0)
  const [hasPendingImageChanges, setHasPendingImageChanges] = useState(false)

  // Följeärende-states
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpPestType, setFollowUpPestType] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)

  // Återbesök / Nytt ärende val-dialog
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [showRevisitModal, setShowRevisitModal] = useState(false)

  // Tekniker-lista för initialer-cirklar
  const [technicianList, setTechnicianList] = useState<{ id: string; name: string; role: string }[]>([])

  // Inline title edit state
  const [editingTitle, setEditingTitle] = useState(false)

  // Kommunikations-panel state
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [oneflowContractId, setOneflowContractId] = useState<string | null>(null)

  // Radering state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Provision state
  const [commissionEligible, setCommissionEligible] = useState(false)
  const [billingSummary, setBillingSummary] = useState<CaseBillingSummary | null>(null)
  const handleBillingSummaryChange = useCallback((_items: any, summary: CaseBillingSummary) => setBillingSummary(summary), [])
  const [commissionShares, setCommissionShares] = useState<TechnicianShare[]>([])
  const [commissionDeductions, setCommissionDeductions] = useState(0)
  const [commissionNotes, setCommissionNotes] = useState('')
  const [existingCommissionPosts, setExistingCommissionPosts] = useState(0)

  // Öppna kommunikationspanelen automatiskt om openCommunicationOnLoad är true
  useEffect(() => {
    if (isOpen && openCommunicationOnLoad && caseData) {
      setShowCommunicationPanel(true)
    }
  }, [isOpen, openCommunicationOnLoad, caseData])

  // Hämta tekniker-lista för initialer-cirklar
  useEffect(() => {
    const fetchTechs = async () => {
      const { data } = await supabase
        .from('technicians')
        .select('id, name, role')
        .eq('is_active', true)
        .order('name')
      if (data) setTechnicianList(data)
    }
    if (isOpen) fetchTechs()
  }, [isOpen])

  // Ref för bildgalleriet så vi kan anropa commitChanges
  const imageGalleryRef = useRef<CaseImageGalleryRef>(null)

  const { displayTime, isRunning } = useRealTimeTimer(currentCase);
  const { lastBackup, pendingRestore, restoreFromBackup, clearBackup } = useTimeBackupSystem(currentCase);
  
  // Rapport generation hook - använd alltid, men med fallback-data
  const reportGeneration = useWorkReportGeneration(currentCase ? {
    ...currentCase,
    clickup_task_id: currentCase.id,
    assignee_email: currentCase.primary_assignee_id ? undefined : undefined, // Kommer att hämtas från tekniker-ID
    assignee_name: currentCase.primary_assignee_name,
    foretag: currentCase.case_type === 'business' ? 'Företag' : undefined
  } : {
    id: '',
    case_type: 'private' as const,
    title: '',
    status: '',
    created_date: new Date().toISOString()
  });

  // Funktion för att få rätt route baserat på användarens roll
  const getOneflowRoute = useCallback(() => {
    const role = profile?.role || 'admin';
    switch (role) {
      case 'koordinator':
        return '/koordinator/oneflow-contract-creator';
      case 'technician':
        return '/technician/oneflow-contract-creator';
      default:
        return '/admin/skapa-avtal';
    }
  }, [profile?.role]);

  // Funktioner för att hantera avtal- och offertskapning
  const prepareCustomerData = useCallback(() => {
    if (!currentCase) return null;
    
    return {
      case_id: currentCase.id,
      partyType: currentCase.case_type === 'business' ? 'company' : 'individual',
      Kontaktperson: formData.kontaktperson || currentCase.kontaktperson || '',
      'e-post-kontaktperson': formData.e_post_kontaktperson || currentCase.e_post_kontaktperson || '',
      'telefonnummer-kontaktperson': formData.telefon_kontaktperson || currentCase.telefon_kontaktperson || '',
      'utforande-adress': formatAddress(formData.adress || currentCase.adress),
      foretag: currentCase.case_type === 'business' ? (currentCase.title || '') : '',
      'org-nr': currentCase.case_type === 'business' 
        ? (formData.org_nr || currentCase.org_nr || '')
        : (formData.personnummer || currentCase.personnummer || ''),
      // Lägg till referens till ursprungsärendet
      sourceCase: {
        id: currentCase.id,
        title: currentCase.title,
        type: currentCase.case_type
      }
    };
  }, [currentCase, formData]);


  const handleCreateContract = useCallback(() => {
    const customerData = prepareCustomerData();
    if (!customerData) return;
    
    // Spara data för förifyllning
    sessionStorage.setItem('prefill_customer_data', JSON.stringify({
      ...customerData,
      documentType: 'contract',
      targetStep: 2 // Gå direkt till mallval
    }));
    
    // Navigera till avtalskaparen med rollbaserad route
    const oneflowRoute = getOneflowRoute();
    navigate(`${oneflowRoute}?prefill=contract`);
    
    toast.success('Navigerar till avtalskapning med kundinformation...');
  }, [prepareCustomerData, navigate, getOneflowRoute]);

  const handleCreateOffer = useCallback(async () => {
    const customerData = prepareCustomerData();
    if (!customerData || !currentCase) return;

    // Hämta prislista-ID (kundens eller standard)
    let selectedPriceListId: string | null = null
    try {
      if (currentCase.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('price_list_id')
          .eq('id', currentCase.customer_id)
          .single()
        if (customer?.price_list_id) {
          selectedPriceListId = customer.price_list_id
        }
      }
      if (!selectedPriceListId) {
        const defaultList = await PriceListService.getDefaultPriceList()
        if (defaultList) selectedPriceListId = defaultList.id
      }
    } catch (err) {
      console.warn('Kunde inte hämta prislista:', err)
    }

    // Hämta ärendets artiklar för förifyllning
    let prefillArticles: any[] = []
    let billingItems: any[] = []
    try {
      const caseType = currentCase.case_type === 'private' ? 'private' : 'business'
      billingItems = await CaseBillingService.getCaseBillingItems(currentCase.id, caseType as any)
      prefillArticles = billingItems
        .filter(item => item.article) // Bara items med kopplad artikel
        .map(item => ({
          article: item.article,
          priceListItem: null,
          effectivePrice: item.unit_price,
          quantity: item.quantity,
          notes: item.notes || undefined,
          caseBillingItemId: item.id
        }))
    } catch (err) {
      console.warn('Kunde inte hämta ärendets artiklar:', err)
    }

    // Härleda deductionType från artiklarnas faktiska rot_rut_type
    let deductionType: 'rot' | 'rut' | 'none' = 'none'
    const hasRot = billingItems.some(item => item.rot_rut_type === 'ROT')
    const hasRut = billingItems.some(item => item.rot_rut_type === 'RUT')
    if (hasRot) deductionType = 'rot'
    else if (hasRut) deductionType = 'rut'

    // Bestäm rätt offertmall baserat på ärendetyp och artiklarnas avdragsval
    let selectedTemplate = '8919037' // Default: Privatperson inkl moms
    if (currentCase.case_type === 'business') {
      selectedTemplate = '8598798' // Företag exkl moms
    } else if (deductionType === 'rot') {
      selectedTemplate = '8919012' // ROT
    } else if (deductionType === 'rut') {
      selectedTemplate = '8919059' // RUT
    }

    // Hämta eventuellt anpassat pris (exkl moms)
    let customTotalPrice: number | null = null
    try {
      const caseType = currentCase.case_type === 'private' ? 'private' : 'business'
      customTotalPrice = await CaseBillingService.getCustomPrice(currentCase.id, caseType as any)
    } catch (err) {
      console.warn('Kunde inte hämta anpassat pris:', err)
    }

    // Spara data för förifyllning
    sessionStorage.setItem('prefill_customer_data', JSON.stringify({
      ...customerData,
      documentType: 'offer',
      autoSelectTemplate: true,
      selectedTemplate,
      selectedPriceListId,
      prefillArticles,
      deductionType,
      customTotalPrice
    }));

    // Navigera till avtalskaparen med rollbaserad route
    const oneflowRoute = getOneflowRoute();
    navigate(`${oneflowRoute}?prefill=offer`);

    toast.success('Navigerar till offertskapning med kundinformation...');
  }, [prepareCustomerData, navigate, getOneflowRoute, currentCase, formData]);

  // Hantera skapning av följeärende
  const handleCreateFollowUpCase = useCallback(async () => {
    if (!currentCase || !followUpPestType || !profile) return;

    setFollowUpLoading(true);

    try {
      // Hämta teknikernamn — bara om inloggad användare är tekniker
      let technicianName = profile.display_name || profile.full_name || 'Okänd';
      if (activeView === 'technician' && profile.technician_id) {
        const { data: techData } = await supabase
          .from('technicians')
          .select('name')
          .eq('id', profile.technician_id)
          .single();
        if (techData?.name) {
          technicianName = techData.name;
        }
      }

      // Bestäm rätt tabell baserat på ärendetyp
      const tableName = currentCase.case_type === 'private' ? 'private_cases' : 'business_cases';

      // Skapa det nya följeärendet med ärvd information
      const newCaseData: any = {
        // Ärvd kundinformation
        title: currentCase.title, // Behåll samma titel (kundnamn/företagsnamn)
        kontaktperson: currentCase.kontaktperson,
        telefon_kontaktperson: currentCase.telefon_kontaktperson,
        e_post_kontaktperson: currentCase.e_post_kontaktperson,
        adress: currentCase.adress,

        // Ny information för följeärendet
        skadedjur: followUpPestType,
        status: 'Bokad',
        description: `Följeärende från ursprungsärende. Nytt skadedjursproblem: ${followUpPestType}`,

        // Tekniker-tilldelning (samma som ursprungsärendet)
        primary_assignee_id: currentCase.primary_assignee_id,
        primary_assignee_name: currentCase.primary_assignee_name,
        secondary_assignee_id: currentCase.secondary_assignee_id,
        secondary_assignee_name: currentCase.secondary_assignee_name,
        tertiary_assignee_id: currentCase.tertiary_assignee_id,
        tertiary_assignee_name: currentCase.tertiary_assignee_name,

        // Schemaläggning (samma som ursprungsärendet)
        start_date: currentCase.start_date,
        due_date: currentCase.due_date,

        // Följeärende-referens
        parent_case_id: currentCase.id,
        created_by_technician_id: activeView === 'technician' ? profile.technician_id : null,
        created_by_technician_name: technicianName,

        // Nollställda fält för det nya ärendet
        time_spent_minutes: 0,
        work_started_at: null,
        pris: null, // Kolumnnamnet i databasen är 'pris', inte 'case_price'
        material_cost: null,
        rapport: null,
      };

      // Lägg till specifika fält beroende på ärendetyp
      if (currentCase.case_type === 'private') {
        newCaseData.personnummer = currentCase.personnummer;
      } else if (currentCase.case_type === 'business') {
        newCaseData.org_nr = currentCase.org_nr;
      }

      const { data: newCase, error: insertError } = await supabase
        .from(tableName)
        .insert(newCaseData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Stäng dialogen och återställ state
      setShowFollowUpDialog(false);
      setFollowUpPestType('');

      toast.success(`Följeärende skapat för ${followUpPestType}!`);

      // Öppna det nya ärendet genom att anropa onSuccess med det nya ärendet
      // Detta kommer att uppdatera parent-komponenten och öppna det nya ärendet
      const newCaseForModal: TechnicianCase = {
        ...newCase,
        case_type: currentCase.case_type,
        case_price: newCase.pris || null,
      };

      onSuccess(newCaseForModal);

    } catch (error: any) {
      console.error('Error creating follow-up case:', error);
      toast.error(`Kunde inte skapa följeärende: ${error.message}`);
    } finally {
      setFollowUpLoading(false);
    }
  }, [currentCase, followUpPestType, profile, onSuccess]);

  // Kontrollera om följeärende kan skapas (inte från ett följeärende)
  const canCreateFollowUp = currentCase &&
    (currentCase.case_type === 'private' || currentCase.case_type === 'business') &&
    !currentCase.parent_case_id;

  // Initialisera modal när ett NYTT ärende öppnas (baserat på id)
  // Uppdatera endast currentCase när caseData ändras för att behålla tidloggningsdata
  useEffect(() => {
    if (caseData) {
      // Uppdatera alltid currentCase med senaste data (inkl. tidloggningsfält)
      setCurrentCase(caseData);

      // Endast resetta formData om det är ett NYTT ärende
      // Detta förhindrar att formuläret resettas när tidloggning uppdaterar caseData
      if (!currentCase || currentCase.id !== caseData.id) {
        setFormData({
          title: caseData.title || '',
          status: caseData.status || '',
          description: caseData.description || '',
          kontaktperson: caseData.kontaktperson || '',
          telefon_kontaktperson: caseData.telefon_kontaktperson || '',
          e_post_kontaktperson: caseData.e_post_kontaktperson || '',
          case_price: caseData.case_price || 0,
          skadedjur: caseData.skadedjur || '',
          org_nr: caseData.org_nr || '',
          personnummer: caseData.personnummer || '',
          // Tekniker-tilldelningar
          primary_assignee_id: caseData.primary_assignee_id || '',
          primary_assignee_name: caseData.primary_assignee_name || '',
          secondary_assignee_id: caseData.secondary_assignee_id || '',
          secondary_assignee_name: caseData.secondary_assignee_name || '',
          tertiary_assignee_id: caseData.tertiary_assignee_id || '',
          tertiary_assignee_name: caseData.tertiary_assignee_name || '',
          material_cost: caseData.material_cost || 0,
          start_date: caseData.start_date,
          due_date: caseData.due_date,
          // Adress (JSONB eller string)
          adress: caseData.adress || null,
          // ClickUp-synkade fält
          rapport: caseData.rapport || '',
          // ROT/RUT-fält för privatpersoner
          r_rot_rut: caseData.r_rot_rut || '',
          r_fastighetsbeteckning: caseData.r_fastighetsbeteckning || '',
          r_arbetskostnad: caseData.r_arbetskostnad || 0,
          r_material_utrustning: caseData.r_material_utrustning || 0,
          r_servicebil: caseData.r_servicebil || 0,
          // Företagsfält (business cases)
          bestallare: caseData.bestallare || '',
          company_name: caseData.company_name || '',
          markning_faktura: caseData.markning_faktura || '',
          e_post_faktura: caseData.e_post_faktura || '',
        });
        setError(null);
        setTimeTrackingLoading(false);
        setLoading(false);

        // Initiera provision-state
        setCommissionEligible(caseData.is_commission_eligible || false);
        setCommissionShares([]);
        setCommissionDeductions(0);
        setCommissionNotes('');
        // Kolla om provisionsposter redan finns
        ProvisionService.getPostsByCase(caseData.id)
          .then(posts => setExistingCommissionPosts(posts.length))
          .catch(() => setExistingCommissionPosts(0));
      }
    }
  }, [caseData]);

  // Slå upp kopplat Oneflow-kontrakt för kommunikationspanelen
  useEffect(() => {
    if (!caseData?.id || !caseData?.case_type) {
      setOneflowContractId(null)
      return
    }
    const sourceType = caseData.case_type === 'private' ? 'private_case' : caseData.case_type === 'business' ? 'business_case' : null
    if (!sourceType) { setOneflowContractId(null); return }

    supabase
      .from('contracts')
      .select('oneflow_contract_id')
      .eq('source_id', caseData.id)
      .eq('source_type', sourceType)
      .neq('status', 'trashed')
      .not('oneflow_contract_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setOneflowContractId(data?.oneflow_contract_id || null))
  }, [caseData?.id, caseData?.case_type])

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
      
      // Provision-flagga (alla tabeller)
      updateData.is_commission_eligible = commissionEligible;

      // Tekniker-tilldelningar (alla tabeller)
      updateData.primary_assignee_id = formData.primary_assignee_id || null;
      updateData.primary_assignee_name = formData.primary_assignee_name || null;
      updateData.secondary_assignee_id = formData.secondary_assignee_id || null;
      updateData.secondary_assignee_name = formData.secondary_assignee_name || null;
      updateData.tertiary_assignee_id = formData.tertiary_assignee_id || null;
      updateData.tertiary_assignee_name = formData.tertiary_assignee_name || null;

      if (tableName === 'private_cases' || tableName === 'business_cases') {
        // ClickUp-synkade fält - ALLA användare (inklusive tekniker) får uppdatera dessa
        updateData.kontaktperson = formData.kontaktperson;
        updateData.telefon_kontaktperson = formData.telefon_kontaktperson;
        updateData.e_post_kontaktperson = formData.e_post_kontaktperson;
        updateData.skadedjur = formData.skadedjur;
        updateData.pris = formData.case_price === "" ? null : formData.case_price;
        updateData.start_date = formData.start_date;
        updateData.due_date = formData.due_date;
        updateData.rapport = formData.rapport; // Synkas till ClickUp
        updateData.adress = formData.adress || null; // Adress (JSONB eller string)
        
        // Lokala fält (synkas INTE till ClickUp)
        updateData.material_cost = formData.material_cost || null;
      }
      
      if (tableName === 'private_cases') { 
        updateData.personnummer = formData.personnummer;
        // ROT/RUT-fält för privatpersoner (synkas till ClickUp)
        updateData.r_rot_rut = formData.r_rot_rut;
        updateData.r_fastighetsbeteckning = formData.r_fastighetsbeteckning;
        // Konvertera tomma strängar till null för numeriska fält
        updateData.r_arbetskostnad = formData.r_arbetskostnad || null;
        updateData.r_material_utrustning = formData.r_material_utrustning || null;
        updateData.r_servicebil = formData.r_servicebil || null;
      } 
      else if (tableName === 'business_cases') {
        updateData.org_nr = formData.org_nr;
        updateData.bestallare = formData.bestallare || null;
        updateData.company_name = formData.company_name || null;
        updateData.markning_faktura = formData.markning_faktura || null;
        updateData.e_post_faktura = formData.e_post_faktura || null;
      }
      else if (tableName === 'cases') { 
        updateData.price = formData.case_price;
        // Automatically set completed_date when status changes to "Avslutat"
        if (formData.status === 'Avslutat' && currentCase.status !== 'Avslutat') {
          updateData.completed_date = toSwedishISOString(new Date());
        } else if (formData.status !== 'Avslutat') {
          updateData.completed_date = null;
        }
      }

      // Debug logging för att identifiera problemet
      console.log('[EditCaseModal] Updating case with data:', {
        tableName,
        caseId: currentCase.id,
        updateData,
        formDataRapport: formData.rapport
      });

      const { data, error: updateError } = await supabase
        .from(tableName).update(updateData).eq('id', currentCase.id).select().single();
        
      if (updateError) throw updateError;
      
      const updatedCaseFromDb = data as TechnicianCase;

      // Spara bildändringar om det finns några
      if (imageGalleryRef.current?.hasPendingChanges()) {
        const imageResult = await imageGalleryRef.current.commitChanges()
        if (!imageResult.success && imageResult.errors.length > 0) {
          console.warn('Några bildändringar kunde inte sparas:', imageResult.errors)
          // Fortsätt ändå - ärendet är sparat
        }
      }

      onSuccess(updatedCaseFromDb);

      // ═══════════════════════════════════════════════════════════════════════════
      // AUTO-FAKTURERING: Generera faktura om ärendet avslutas med billing items
      // ═══════════════════════════════════════════════════════════════════════════
      let invoiceGenerated = false;
      if (formData.status === 'Avslutat' && currentCase.status !== 'Avslutat') {
        // Endast för private och business cases (inte contract)
        if (tableName === 'private_cases' || tableName === 'business_cases') {
          const billingCaseType = tableName === 'private_cases' ? 'private' : 'business';

          try {
            // Kontrollera om det finns billing items
            const hasBillingItems = await CaseBillingService.caseHasBillingItems(
              currentCase.id,
              billingCaseType
            );

            if (hasBillingItems) {
              // Generera faktura automatiskt
              await InvoiceService.createInvoiceFromCase(
                currentCase.id,
                billingCaseType,
                {
                  name: billingCaseType === 'business'
                    ? (formData.company_name || currentCase.company_name || formData.bestallare || currentCase.bestallare || formData.kontaktperson || currentCase.kontaktperson || 'Okänd kund')
                    : (formData.kontaktperson || currentCase.kontaktperson || 'Okänd kund'),
                  email: billingCaseType === 'business'
                    ? (formData.e_post_faktura || currentCase.e_post_faktura || formData.e_post_kontaktperson || currentCase.e_post_kontaktperson)
                    : (formData.e_post_kontaktperson || currentCase.e_post_kontaktperson),
                  phone: formData.telefon_kontaktperson || currentCase.telefon_kontaktperson,
                  address: formatAddress(formData.adress || currentCase.adress),
                  organization_number: billingCaseType === 'business'
                    ? (formData.org_nr || currentCase.org_nr)
                    : (formData.personnummer || currentCase.personnummer),
                  invoice_marking: billingCaseType === 'business'
                    ? (formData.markning_faktura || currentCase.markning_faktura)
                    : undefined
                }
              );
              invoiceGenerated = true;
              console.log('[EditCaseModal] Faktura genererad för ärendet');
            }
          } catch (invoiceError: any) {
            // Ärendet är redan sparat, så detta är bara en varning
            console.warn('[EditCaseModal] Kunde inte generera faktura:', invoiceError);
            toast.error(`Faktura kunde inte genereras: ${invoiceError.message}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PROVISION: Skapa provisionsposter om ärendet avslutas och är provisionsgrundande
      // ═══════════════════════════════════════════════════════════════════════════
      let commissionCreated = false;
      if (formData.status === 'Avslutat' && currentCase.status !== 'Avslutat') {
        if (commissionEligible && commissionShares.length > 0 && existingCommissionPosts === 0) {
          try {
            const casePrice = Number(formData.case_price) || 0;
            const isRotRut = !!(formData.r_rot_rut && formData.r_rot_rut !== 'Nej');
            // Vid ROT/RUT: provision på belopp innan avdrag (= case_price)
            await ProvisionService.createPostsForCase(
              {
                case_id: currentCase.id,
                case_type: currentCase.case_type as 'private' | 'business' | 'contract',
                case_title: formData.title || currentCase.title,
                case_number: currentCase.case_number,
                base_amount: casePrice,
                is_rot_rut: isRotRut,
                rot_rut_original_amount: isRotRut ? casePrice : undefined,
              },
              commissionShares,
              commissionDeductions,
              commissionNotes || undefined
            );
            commissionCreated = true;
          } catch (commErr: any) {
            console.warn('[EditCaseModal] Provision kunde inte skapas:', commErr);
            toast.error(`Provision: ${commErr.message}`);
          }
        }
      }

      setSubmitted(true);

      // Visa lämpligt meddelande
      if (invoiceGenerated && commissionCreated) {
        toast.success('Ärendet avslutat, faktura genererad och provision skapad!');
      } else if (invoiceGenerated) {
        toast.success('Ärendet avslutat och faktura genererad!');
      } else if (commissionCreated) {
        toast.success('Ärendet avslutat och provision skapad!');
      } else {
        toast.success('Ärendet har uppdaterats!');
      }

      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1500);
      
    } catch (error: any) {
      setError(`Fel vid uppdatering: ${error.message}`);
      toast.error('Kunde inte uppdatera ärendet');
    } finally {
      setLoading(false);
    }
  }

  const handleTimeTracking = async (action: 'start' | 'pause' | 'complete' | 'reset') => {
    const tableName = getTableName();
    if (!tableName || !currentCase || tableName === 'cases') return;
    
    setTimeTrackingLoading(true);
    setError(null);

    try {
      let updatePayload: any = {};
      let successMessage = '';

      switch (action) {
        case 'start':
          updatePayload = { work_started_at: new Date().toISOString() };
          successMessage = '⏱️ Arbetstid startad!';
          break;
        case 'pause':
        case 'complete':
          if (currentCase.work_started_at) {
            const minutesWorked = (Date.now() - new Date(currentCase.work_started_at).getTime()) / 1000 / 60;
            const safeMinutesWorked = safeRoundMinutes(minutesWorked);
            const safeTotalMinutes = safeRoundMinutes((currentCase.time_spent_minutes || 0) + minutesWorked);
            updatePayload = { work_started_at: null, time_spent_minutes: safeTotalMinutes };
            if (action === 'pause') successMessage = `⏸️ Arbete pausat! Loggade ${formatMinutes(safeMinutesWorked)}`;
            else successMessage = `✅ Arbete slutfört! Total tid: ${formatMinutes(safeTotalMinutes)}`;
          } else { return; }
          break;
        case 'reset':
          updatePayload = { work_started_at: null, time_spent_minutes: 0 };
          successMessage = '🔄 Arbetstid återställd!';
          break;
      }

      const { data, error } = await supabase
        .from(tableName).update(updatePayload).eq('id', currentCase.id).select().single();

      if (error) throw error;

      const updatedCase = { ...currentCase, ...data };
      
      onSuccess(updatedCase as TechnicianCase);
      setCurrentCase(updatedCase as TechnicianCase);
      
      if (action !== 'start') {
        localStorage.removeItem(`time_backup_${currentCase.id}`);
      }
      
      toast.success(successMessage, { duration: 3000 });

    } catch (error: any) {
      setError(`⚠️ Tidsspårning misslyckades: ${error.message || 'Okänt fel'}`);
      toast.error('Tidsspårning misslyckades');
    } finally {
      setTimeTrackingLoading(false);
    }
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 256) + 'px'
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    if (e.target instanceof HTMLTextAreaElement) autoResize(e.target);
  }

  // Specialhanterare för adressfältet som bevarar JSON-struktur men uppdaterar formatted_address
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    
    // Om nuvarande adress är ett JSON-objekt, behåll strukturen men uppdatera formatted_address
    if (formData.adress && typeof formData.adress === 'object' && formData.adress.location) {
      setFormData(prev => ({ 
        ...prev, 
        adress: {
          ...formData.adress,
          formatted_address: value || null
        }
      }));
    } else {
      // Om det är en string eller null, sätt som string
      setFormData(prev => ({ ...prev, adress: value || null }));
    }
  }
  
  // ✅ NY HANTERARE FÖR DEN ANPASSADE DATUMVÄLJAREN
  const handleDateChange = (date: Date | null, fieldName: 'start_date' | 'due_date') => {
    const isoString = date ? date.toISOString() : null;
    setFormData(prev => ({ ...prev, [fieldName]: isoString }));
  };

  const handleSuccessfulRestore = async () => {
    const result = await restoreFromBackup();
    if (result && typeof result === 'object' && currentCase) {
      const updatedCase = { ...currentCase, ...result };
      onSuccess(updatedCase as TechnicianCase);
      setCurrentCase(updatedCase as TechnicianCase);
    }
  };

  // z-index for datepicker now handled in DatePickerDarkTheme.css

  if (!currentCase) return null;
  
  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Sparat!" size="md" preventClose={true} usePortal={true}>
        <div className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Ärendet har uppdaterats</h3>
          <p className="text-slate-400">Ändringarna har sparats framgångsrikt</p>
        </div>
      </Modal>
    );
  }

  const footer = (
    <div className="flex items-center px-4 py-2 bg-slate-800/50">
      <button
        type="button"
        onClick={() => setShowDeleteDialog(true)}
        className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Radera
      </button>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading || timeTrackingLoading}>
          Avbryt
        </Button>
        <Button type="submit" form="edit-case-form" size="sm" loading={loading} disabled={loading || timeTrackingLoading}>
          Spara ändringar
        </Button>
      </div>
    </div>
  );

  const showTimeTracking = (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  // Kontrollera om kommunikation kan visas
  const showCommunication = currentCase && (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  const modalTitle = (
    <div className="flex items-center gap-2">
      <span>Ärende: {currentCase.case_number || currentCase.title}</span>
      {!editingTitle && (
        <button onClick={() => setEditingTitle(true)} className="p-1 text-slate-400 hover:text-white rounded transition-colors" title="Redigera ärendenamn">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="xl" footer={footer} preventClose={loading || timeTrackingLoading} usePortal={true} className="scroll-smooth"
      headerActions={showCommunication ? (
        <button
          type="button"
          onClick={() => setShowCommunicationPanel(true)}
          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-all duration-200"
          title="Öppna kommunikation"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      ) : undefined}
    >
      <div className="p-4 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {/* Enhanced header with report, contract, and offer functionality */}
        {currentCase && (
          <div className="mb-4 -mt-4 -mx-4 px-4 py-3 bg-slate-800/30 border-b border-slate-700">
            {/* Snabbåtgärder - Mobil-responsiv layout */}
            <div className="flex flex-col gap-3">
              {/* Rad 1: Produktiva åtgärder - grid på mobil, flex på desktop */}
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-3">
                {/* Avtal Button */}
                <button
                  type="button"
                  onClick={handleCreateContract}
                  className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-h-[44px] px-3 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg text-purple-300 hover:text-purple-200 text-sm font-medium transition-all duration-200 active:scale-95"
                  title="Skapa serviceavtal för denna kund"
                >
                  <FileSignature className="w-4 h-4" />
                  <span className="sm:inline text-xs sm:text-sm">Avtal</span>
                  <ChevronRight className="w-3 h-3 opacity-60 hidden sm:block" />
                </button>

                {/* Offert Button */}
                <button
                  type="button"
                  onClick={handleCreateOffer}
                  className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-h-[44px] px-3 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 hover:text-green-200 text-sm font-medium transition-all duration-200 active:scale-95"
                  title="Skapa offertförslag för denna kund"
                >
                  <DollarSign className="w-4 h-4" />
                  <span className="sm:inline text-xs sm:text-sm">Offert</span>
                  <ChevronRight className="w-3 h-3 opacity-60 hidden sm:block" />
                </button>

                {/* Återbesök / Nytt ärende Button - endast för private/business och inte redan ett följeärende */}
                {canCreateFollowUp ? (
                  <button
                    type="button"
                    onClick={() => setShowActionDialog(true)}
                    className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-h-[44px] px-3 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 rounded-lg text-teal-300 hover:text-teal-200 text-sm font-medium transition-all duration-200 active:scale-95"
                    title="Boka återbesök eller skapa nytt ärende"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span className="sm:inline text-xs sm:text-sm">Återbesök</span>
                  </button>
                ) : (
                  // Placeholder för att behålla grid-layouten
                  <div className="sm:hidden" />
                )}
              </div>

              {/* Rad 2: Rapport dropdown - full bredd på mobil */}
              <div className="flex items-center justify-between sm:justify-start gap-3">
                {reportGeneration.canGenerateReport ? (
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <span className="text-xs text-slate-400">Rapport:</span>
                    <WorkReportDropdown
                      onDownload={reportGeneration.downloadReport}
                      onSendToTechnician={reportGeneration.sendToTechnician}
                      onSendToContact={reportGeneration.sendToContact}
                      disabled={!reportGeneration.canGenerateReport || reportGeneration.isGenerating}
                      technicianName={reportGeneration.technicianName}
                      contactName={reportGeneration.contactName}
                      totalReports={reportGeneration.totalReports}
                      hasRecentReport={reportGeneration.hasRecentReport}
                      currentReport={reportGeneration.currentReport}
                      getTimeSinceReport={reportGeneration.getTimeSinceReport}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500">
                    <FileCheck className="w-4 h-4" />
                    <span className="text-xs">Rapport ej tillgänglig</span>
                  </div>
                )}
              </div>
            </div>

            {/* Warnings and status messages */}
            {(reportGeneration.canGenerateReport && (!reportGeneration.hasTechnicianEmail || !reportGeneration.hasContactEmail)) && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                {!reportGeneration.hasTechnicianEmail && '⚠️ Ingen tekniker-email tillgänglig. '}
                {!reportGeneration.hasContactEmail && '⚠️ Ingen kontaktperson-email tillgänglig.'}
              </div>
            )}
            
            {/* Missing customer info warning */}
            {(!currentCase.kontaktperson || !currentCase.e_post_kontaktperson) && (
              <div className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-3 py-2">
                ⚠️ Komplettera kontaktuppgifter för bästa avtal/offert-skapning
              </div>
            )}

            {/* Info om detta är ett följeärende */}
            {currentCase.parent_case_id && (
              <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2 mt-2">
                ℹ️ Detta är ett följeärende
              </div>
            )}
          </div>
        )}

        {/* Val-dialog: Återbesök eller Nytt ärende */}
        {showActionDialog && (
          <div className="mb-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-teal-300 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Återbesök / Nytt ärende
                </h4>
                <p className="text-sm text-slate-400 mt-1">
                  Vad vill du göra?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowActionDialog(false)}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Alternativ 1: Boka återbesök */}
              <button
                type="button"
                onClick={() => {
                  setShowActionDialog(false)
                  setShowRevisitModal(true)
                }}
                className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-teal-500/50 rounded-lg text-left transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/30 transition-colors">
                    <CalendarIcon className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h5 className="text-white font-medium group-hover:text-teal-300 transition-colors">
                      Boka återbesök
                    </h5>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Flytta ärendet till ett framtida datum för uppföljning av skadedjursstatus
                    </p>
                  </div>
                </div>
              </button>

              {/* Alternativ 2: Skapa nytt ärende */}
              <button
                type="button"
                onClick={() => {
                  setShowActionDialog(false)
                  setShowFollowUpDialog(true)
                }}
                className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-lg text-left transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/30 transition-colors">
                    <Plus className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h5 className="text-white font-medium group-hover:text-amber-300 transition-colors">
                      Skapa nytt ärende
                    </h5>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Nytt problem hos samma kund (annat skadedjur)
                    </p>
                  </div>
                </div>
              </button>

              {/* Avbryt */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowActionDialog(false)}
                className="w-full mt-2"
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}

        {/* Följeärende-dialog (Nytt ärende) */}
        {showFollowUpDialog && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-amber-300 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Skapa nytt ärende
                </h4>
                <p className="text-sm text-slate-400 mt-1">
                  Välj skadedjurstyp för det nya ärendet. Kundinformation, adress och schemaläggning kopieras automatiskt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFollowUpDialog(false);
                  setFollowUpPestType('');
                }}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Skadedjurstyp för det nya ärendet *
                </label>
                <select
                  value={followUpPestType}
                  onChange={(e) => setFollowUpPestType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all duration-200"
                >
                  <option value="">Välj skadedjurstyp...</option>
                  {PEST_TYPE_OPTIONS.map((pest) => (
                    <option key={pest.id} value={pest.name}>
                      {pest.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowFollowUpDialog(false);
                    setFollowUpPestType('');
                  }}
                  disabled={followUpLoading}
                  className="flex-1"
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  variant="warning"
                  onClick={handleCreateFollowUpCase}
                  loading={followUpLoading}
                  disabled={!followUpPestType || followUpLoading}
                  className="flex-1"
                >
                  {followUpLoading ? 'Skapar...' : 'Skapa nytt ärende'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <BackupRestorePrompt pendingRestore={pendingRestore} onRestore={handleSuccessfulRestore} onDismiss={clearBackup} />

        <form id="edit-case-form" onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5"><FileText className="w-4 h-4 text-teal-400" />Ärendeinformation</h3>
            {editingTitle && (
              <div className="flex items-center gap-2">
                <input name="title" value={formData.title || ''} onChange={handleChange}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  placeholder="Ärendenamn..."
                  autoFocus
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                ref={(el) => { if (el) autoResize(el) }}
                rows={2}
                style={{ maxHeight: '16rem' }}
                className="w-full px-3 py-1.5 bg-slate-900/60 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all duration-200 leading-relaxed overflow-y-auto resize-none"
                placeholder="Beskriv ärendet i detalj..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select 
                  name="status" 
                  value={formData.status || ''} 
                  onChange={handleChange} 
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all duration-200 appearance-none cursor-pointer"
                  style={{ 
                    maxHeight: '200px',
                    overflowY: 'auto' as const
                  }}
                >
                  {statusOrder.map(s => (
                    <option key={s} value={s} className="py-2 px-3 bg-slate-800 text-white hover:bg-slate-700">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {showTimeTracking && (
                <Input label="Skadedjur" name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} placeholder="T.ex. Råttor, Kackerlackor..." />
              )}
            </div>

            {/* Tekniker-tilldelningar */}
            <div className="space-y-2 pt-3 border-t border-slate-700/50">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <User className="w-4 h-4 text-orange-400" />
                Tekniker
              </h3>
              <div className="flex items-center gap-2">
                {([
                  { key: 'primary_assignee_id', label: 'Primär' },
                  { key: 'secondary_assignee_id', label: 'Sekundär' },
                  { key: 'tertiary_assignee_id', label: 'Tertiär' }
                ] as const).map((slot) => {
                  const techId = formData[slot.key] || ''
                  const tech = technicianList.find(t => t.id === techId)
                  const initials = tech ? tech.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : ''
                  return (
                    <div key={slot.key} className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                          tech
                            ? 'bg-[#20c58f]/20 border-2 border-[#20c58f]'
                            : 'border-2 border-dashed border-slate-600 hover:border-slate-500'
                        }`}
                        title={tech ? `${tech.name} (${slot.label})` : `${slot.label} tekniker`}
                      >
                        {tech ? (
                          <span className="text-xs font-bold text-[#20c58f]">{initials}</span>
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                      <select
                        value={techId}
                        onChange={(e) => {
                          const selectedTech = technicianList.find(t => t.id === e.target.value)
                          setFormData(prev => ({
                            ...prev,
                            [slot.key]: e.target.value,
                            [slot.key.replace('_id', '_name')]: selectedTech?.name || ''
                          }))
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title={slot.label}
                      >
                        <option value="">Ingen</option>
                        {technicianList.map(t => (
                          <option key={t.id} value={t.id}>{t.name} - {t.role}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-700/50">
            {/* ✅ UPPDATERAD SEKTION FÖR SCHEMALÄGGNING */}
            {showTimeTracking && (
              <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5"><CalendarIcon className="w-4 h-4 text-purple-400" />Schemaläggning</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Starttid</label>
                          <DatePicker
                              selected={formData.start_date ? new Date(formData.start_date) : null}
                              onChange={(date) => handleDateChange(date, 'start_date')}
                              locale="sv"
                              showTimeSelect
                              timeCaption="Tid"
                              timeFormat="HH:mm"
                              timeIntervals={15}
                              dateFormat="yyyy-MM-dd HH:mm"
                              placeholderText="Välj starttid..."
                              isClearable
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Sluttid</label>
                          <DatePicker
                              selected={formData.due_date ? new Date(formData.due_date) : null}
                              onChange={(date) => handleDateChange(date, 'due_date')}
                              locale="sv"
                              showTimeSelect
                              timeCaption="Tid"
                              timeFormat="HH:mm"
                              timeIntervals={15}
                              dateFormat="yyyy-MM-dd HH:mm"
                              placeholderText="Välj sluttid..."
                              isClearable
                          />
                      </div>
                  </div>
              </div>
            )}

            {showTimeTracking && (
              <div className="space-y-2 pt-3 border-t border-slate-700/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5"><User className="w-4 h-4 text-green-400" />Kontaktinformation</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="kontaktperson" placeholder="Kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} />
                  {currentCase.case_type === 'business' ? (
                    <Input name="org_nr" placeholder="Org.nummer" value={formData.org_nr || ''} onChange={handleChange} />
                  ) : (
                    <Input name="personnummer" placeholder="Personnummer" value={formData.personnummer || ''} onChange={handleChange} />
                  )}
                  <Input name="telefon_kontaktperson" placeholder="Telefon" value={formData.telefon_kontaktperson || ''} onChange={handleChange} />
                  <Input name="e_post_kontaktperson" placeholder="E-post" type="email" value={formData.e_post_kontaktperson || ''} onChange={handleChange} />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    name="adress"
                    value={formatAddress(formData.adress)}
                    onChange={handleAddressChange}
                    placeholder="Adress..."
                    className="w-full px-3 py-1.5 pr-10 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                  />
                  {formatAddress(formData.adress) && (
                    <button
                      type="button"
                      onClick={() => openInMaps(formData.adress)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-teal-400 hover:text-teal-300 transition-colors rounded-md hover:bg-slate-700/50"
                      title="Öppna i Maps"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Företagsinfo & Fakturering (bara business cases) */}
            {currentCase.case_type === 'business' && (
              <div className="space-y-2 pt-3 border-t border-slate-700/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5"><FileText className="w-4 h-4 text-blue-400" />Företag & Fakturering</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="company_name" placeholder="Företagsnamn" value={formData.company_name || ''} onChange={handleChange} />
                  <Input name="bestallare" placeholder="Beställare" value={formData.bestallare || ''} onChange={handleChange} />
                  <Input name="markning_faktura" placeholder="Märkning faktura" value={formData.markning_faktura || ''} onChange={handleChange} />
                  <Input name="e_post_faktura" placeholder="E-post faktura" type="email" value={formData.e_post_faktura || ''} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* Saneringsrapport sektion */}
            {showTimeTracking && (
              <div className="space-y-1.5 pt-3 border-t border-slate-700/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-400" />Saneringsrapport
                </h3>
                <textarea
                  name="rapport"
                  value={formData.rapport || ''}
                  onChange={handleChange}
                  ref={(el) => { if (el) autoResize(el) }}
                  rows={2}
                  style={{ maxHeight: '16rem' }}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] transition-colors overflow-y-auto resize-none"
                  placeholder="Metoder, resultat, rekommendationer..."
                />
              </div>
            )}

            {/* Tidtagning */}
            {showTimeTracking && (
              <div className="pt-3 border-t border-slate-700/50">
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 flex-shrink-0 ${isRunning ? 'text-green-400' : 'text-slate-400'}`} />
                  <span className={`text-lg font-bold font-mono ${isRunning ? 'text-green-400' : 'text-white'}`}>
                    {formatMinutesDetailed(displayTime)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isRunning ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        Aktiv
                      </span>
                    ) : displayTime > 0 ? 'Pausad' : 'Ej påbörjad'}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {isRunning ? (
                      <>
                        <Button type="button" variant="warning" size="sm" onClick={() => handleTimeTracking('pause')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="flex items-center gap-1 text-xs px-2.5 py-1">
                          <Pause className="w-3 h-3" />Pausa
                        </Button>
                        <Button type="button" variant="success" size="sm" onClick={() => handleTimeTracking('complete')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="flex items-center gap-1 text-xs px-2.5 py-1">
                          <Save className="w-3 h-3" />Slutför
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="primary" size="sm" onClick={() => handleTimeTracking('start')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="flex items-center gap-1 text-xs px-2.5 py-1">
                          <Play className="w-3 h-3" />{displayTime > 0 ? 'Återuppta' : 'Starta'}
                        </Button>
                        {displayTime > 0 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleTimeTracking('reset')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="flex items-center gap-1 text-xs px-2 py-1 text-slate-400 hover:text-red-400">
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Använda preparat - Visas INTE för Inspektion */}
            {currentCase && formData.skadedjur !== 'Inspektion' && (
              <div className="pt-3 border-t border-slate-700/50">
                <CasePreparationsSection
                  caseId={currentCase.id}
                  caseType={currentCase.case_type === 'private' ? 'private' : 'business'}
                  pestType={formData.skadedjur || null}
                  technicianId={currentCase.primary_assignee_id || null}
                  technicianName={currentCase.primary_assignee_name || null}
                  isReadOnly={false}
                />
              </div>
            )}

            {/* Utförda tjänster/artiklar för fakturering */}
            {currentCase && (
              <div className="pt-3 border-t border-slate-700/50">
                <CaseArticleSelector
                  caseId={currentCase.id}
                  caseType={currentCase.case_type === 'private' ? 'private' : 'business'}
                  customerId={currentCase.customer_id}
                  technicianId={currentCase.primary_assignee_id || undefined}
                  technicianName={currentCase.primary_assignee_name || undefined}
                  onChange={handleBillingSummaryChange}
                />
              </div>
            )}

            {/* Provision sektion */}
            {currentCase && (
              <div className="pt-3 border-t border-slate-700/50">
                <CommissionSection
                  isEligible={commissionEligible}
                  onEligibleChange={setCommissionEligible}
                  assignedTechnicians={
                    [
                      formData.primary_assignee_id && formData.primary_assignee_name
                        ? { id: formData.primary_assignee_id, name: formData.primary_assignee_name }
                        : null,
                      formData.secondary_assignee_id && formData.secondary_assignee_name
                        ? { id: formData.secondary_assignee_id, name: formData.secondary_assignee_name }
                        : null,
                      formData.tertiary_assignee_id && formData.tertiary_assignee_name
                        ? { id: formData.tertiary_assignee_id, name: formData.tertiary_assignee_name }
                        : null,
                    ].filter(Boolean) as { id: string; name: string }[]
                  }
                  technicianShares={commissionShares}
                  onSharesChange={setCommissionShares}
                  deductions={commissionDeductions}
                  onDeductionsChange={setCommissionDeductions}
                  notes={commissionNotes}
                  onNotesChange={setCommissionNotes}
                  baseAmount={billingSummary?.subtotal || Number(formData.case_price) || 0}
                  isRotRut={!!(formData.r_rot_rut && formData.r_rot_rut !== 'Nej')}
                  rotRutOriginalAmount={formData.r_rot_rut && formData.r_rot_rut !== 'Nej' ? (billingSummary?.subtotal || Number(formData.case_price) || 0) : undefined}
                  existingPostCount={existingCommissionPosts}
                />
              </div>
            )}

            {/* Bilder sektion - visas för alla ärendetyper */}
            {currentCase && (
              <div className="space-y-2 pt-3 border-t border-slate-700/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-cyan-400" />Bilder
                </h3>

                {/* Bildgalleri med draft-läge - ändringar sparas först när man klickar "Spara ändringar" */}
                <CaseImageGallery
                  ref={imageGalleryRef}
                  caseId={currentCase.id}
                  caseType={currentCase.case_type}
                  canDelete={true}
                  canEdit={true}
                  refreshTrigger={imageRefreshTrigger}
                  showCategories={true}
                  draftMode={true}
                  userId={profile?.id}
                  onPendingChangesUpdate={setHasPendingImageChanges}
                />
              </div>
            )}


          </div>
        </form>
      </div>

      {/* Kommunikations-panel (slide-in från höger) */}
      {showCommunication && (
        <CommunicationSlidePanel
          isOpen={showCommunicationPanel}
          onClose={() => setShowCommunicationPanel(false)}
          caseId={currentCase.id}
          caseType={currentCase.case_type as CaseType}
          caseTitle={currentCase.title}
          oneflowContractId={oneflowContractId || undefined}
          senderEmail={profile?.technicians?.email || undefined}
        />
      )}

      {/* Bekräftelsedialog för radering */}
      <DeleteCaseConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={() => {
          // Stäng modalen efter radering
          onClose();
        }}
        caseId={currentCase.id}
        caseType={currentCase.case_type as DeleteableCaseType}
        caseTitle={currentCase.title}
      />

      {/* Återbesöks-modal */}
      {showRevisitModal && currentCase && (
        <RevisitModal
          caseData={currentCase}
          onSuccess={(updatedCase) => {
            setShowRevisitModal(false)
            // Uppdatera currentCase med nya datum
            setCurrentCase(updatedCase)
            // Uppdatera formData med nya datum
            setFormData(prev => ({
              ...prev,
              start_date: updatedCase.start_date,
              due_date: updatedCase.due_date,
              status: updatedCase.status
            }))
            // Informera parent-komponenten
            onSuccess(updatedCase)
          }}
          onClose={() => setShowRevisitModal(false)}
        />
      )}
    </Modal>
  )
}
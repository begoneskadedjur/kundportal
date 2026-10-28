// 📁 src/components/admin/technicians/EditCaseModal.tsx
// ⭐ VERSION 2.3 - LÄGGER TILL AKTIVITET & KOMMUNIKATION ⭐

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { AlertCircle, CheckCircle, FileText, User, Clock, Play, Pause, RotateCcw, Save, AlertTriangle, Calendar as CalendarIcon, BookOpen, MapPin, FileCheck, FileSignature, Image as ImageIcon, Plus, X, MessageSquare, Trash2, Pencil, Receipt, Copy, History, Wrench, Wallet, Info } from 'lucide-react'
import { Icon as SvgIcon } from '../../icons/Icon'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Modal from '../../ui/Modal'
import Select from '../../ui/Select'
import AddressAutocomplete from '../../ui/AddressAutocomplete'
import type { GeocodeResult } from '../../../services/geocoding'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { sluttidForeStart, SLUTTID_FORE_START_FEL } from '../../../utils/besokstid'

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
import CustomerContractButton from '../customers/CustomerContractButton'

// Tjänsteutbud-väljare
import ServiceArticleSelector from '../../shared/ServiceArticleSelector'
import type { Service } from '../../../types/services'

// Tjänste- och artikelväljare för fakturering
import CaseServiceSelector from '../../shared/CaseServiceSelector'

// Duplicera-ärende-dialog
import DuplicateCaseDialog from '../../shared/DuplicateCaseDialog'

// Fakturering - auto-generera vid ärendeavslut
import { InvoiceService } from '../../../services/invoiceService'
import { CaseBillingService } from '../../../services/caseBillingService'
import { mapBillingItemsToPrefillServices, mapBillingItemsToSelectedArticles } from '../../../utils/billingPrefill'
import { PriceListService } from '../../../services/priceListService'
import { CaseCustomerService } from '../../../services/caseCustomerService'
import { CustomerGroupService } from '../../../services/customerGroupService'
import type { CustomerGroup } from '../../../types/customerGroups'

// Kommunikation
import { CommunicationSlidePanel } from '../../communication'
import { CaseType } from '../../../types/communication'

// Datum-hjälpfunktioner för svensk tidszon
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'

// Skadedjurstyper för följeärenden
import { PEST_TYPE_OPTIONS } from '../../../utils/clickupFieldMapper'

// Radering av ärenden
import DeleteCaseConfirmDialog from '../../shared/DeleteCaseConfirmDialog'
import type { DeleteableCaseType } from '../../../services/caseDeleteService'

// Återbesök modal
import RevisitModal from './RevisitModal'

// Ärendehistorik
import CaseHistoryPanel from '../../shared/CaseHistoryPanel'

// Delade modal-byggstenar (visuell omgörning)
import CaseModalSection from '../../shared/CaseModalSection'
import CaseSpecialReportsSection from '../../shared/specialReports/CaseSpecialReportsSection'
import { useOsparatArende } from '../../shared/specialReports/specialReportUtils'
import CaseStatusStepper from '../../shared/CaseStatusStepper'
import SkapaLeadKnapp from '../leads/SkapaLeadKnapp'

// Provision
import CommissionSection from '../../shared/CommissionSection'
import type { CaseBillingSummary } from '../../../types/caseBilling'
import { VisitService, type Visit, type VisitCaseType } from '../../../services/visitService'
import { ProvisionService } from '../../../services/provisionService'
import { useProvisionsgrans, underProvisionsgrans } from '../../technician/ny/steg/provisionsgrans'
import type { TechnicianShare } from '../../../types/provision'

// Nya arbetsvyn (bara tekniker med profiles.ny_arbetsvy i teknikervyn): stegflödet.
// Allt nedan används bara när useNyArbetsvy().aktiv är true.
import type { ReactNode } from 'react'
import { useNyArbetsvy } from '../../../hooks/useNyArbetsvy'
import { StegRad, StegKnappar } from '../../technician/ny/steg/StegFlode'
import { ArendeVerktygArk, type ArendeVerktygGrupp } from '../../technician/ny/steg/ArendeVerktygArk'
import { KlartSteg } from '../../technician/ny/steg/KlartSteg'
import { useStegForArende, grannSteg, type StegId } from '../../technician/ny/steg/stegKonfig'
import { HjalpText } from '../../technician/ny/hjalp/HjalpText'
import { kontrolleraAvslut, RAPPORT_SAKNAS_FEL, type AvslutsHinder } from '../../../services/arendeAvslutService'

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
  // Kundgrupp vald vid skapande (business_cases): styr Fortnox-nummerserien
  customer_group_id?: string | null;
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
  // Tjänsteutbud
  service_id?: string | null;
  service_group_id?: string | null; // transient, sparas ej i DB
}

/** Fält som användaren redigerar och som räknas som osparade ändringar (3.56.0) */
const OSPARAT_FALT = [
  'title', 'status', 'description', 'kontaktperson', 'telefon_kontaktperson', 'e_post_kontaktperson',
  'case_price', 'skadedjur', 'service_id', 'org_nr', 'personnummer',
  'primary_assignee_id', 'secondary_assignee_id', 'tertiary_assignee_id',
  'material_cost', 'start_date', 'due_date', 'adress', 'rapport',
  'r_rot_rut', 'r_fastighetsbeteckning', 'r_arbetskostnad', 'r_material_utrustning', 'r_servicebil',
  'bestallare', 'company_name', 'markning_faktura', 'e_post_faktura',
] as const

interface EditCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedCase: TechnicianCase) => void
  caseData: TechnicianCase | null
  openCommunicationOnLoad?: boolean
  /** Anropas efter Radera så att listan/schemat kan ta bort ärendet direkt */
  onDeleted?: (caseId: string) => void
}

interface BackupData {
  caseId: string;
  totalMinutes: number;
  sessionMinutes: number;
  startedAt: string;
  timestamp: string;
}

const MANUAL_STATUSES = ['Öppen', 'Bokad', 'Avslutat']
const AUTO_STATUSES = ['Återbesök', 'Offert skickad', 'Offert signerad - boka in', 'Avtal skickat', 'Avtal signerat - Etablera']

function buildStatusOptions(currentStatus: string) {
  const list = [...MANUAL_STATUSES]
  if (AUTO_STATUSES.includes(currentStatus) && !list.includes(currentStatus)) {
    list.push(currentStatus)
  }
  return list.map(s => ({ value: s, label: s }))
}

// Statuschip i headern - samma färgspråk som CaseStatusStepper/schemat
const getStatusChipStyle = (status: string): string => {
  const ls = (status || '').toLowerCase()
  if (ls.includes('avslutat')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (ls.startsWith('återbesök')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  if (ls.includes('signerad') || ls.startsWith('avtal signerat')) return 'bg-[#20c58f]/20 text-[#20c58f] border-[#20c58f]/30'
  if (ls.includes('offert') || ls.startsWith('avtal s')) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
  if (ls.includes('bokad') || ls.includes('bokat')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  if (ls.includes('öppen')) return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
  return 'bg-slate-500/15 text-slate-300 border-slate-600/50'
}

// Ärendetyps-badge i headern
const TYPE_BADGES: Record<TechnicianCase['case_type'], { label: string; cls: string }> = {
  private: { label: 'Privatperson', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  business: { label: 'Företag', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  contract: { label: 'Avtalskund', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
}

// Flikar (ren UI-state - avmonterar aldrig panelerna, göms med "hidden")
type CaseModalTab = 'arende' | 'utforande' | 'ekonomi'
const getDefaultTab = (status: string | undefined, view: string | null | undefined): CaseModalTab => {
  const ls = (status || '').toLowerCase()
  return view === 'technician' && (ls.includes('bokad') || ls.includes('bokat') || ls.includes('pågående'))
    ? 'utforande'
    : 'arende'
}

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
    // Ingen kopia kvar (tiden har sparats): frågan om återställning gäller inte längre
    if (!backup) setPendingRestore(null);
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
  }, [currentCase?.id, currentCase?.time_spent_minutes, currentCase?.work_started_at]);

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

export default function EditCaseModal({ isOpen, onClose, onSuccess, caseData, openCommunicationOnLoad, onDeleted }: EditCaseModalProps) {
  const navigate = useNavigate()
  const { profile, activeView } = useAuth()
  const [loading, setLoading] = useState(false)
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // True när spara/fakturering blockerats pga saknad fastighetsbeteckning vid ROT/RUT
  const [rotRutFastighetError, setRotRutFastighetError] = useState(false)
  const [currentCase, setCurrentCase] = useState<TechnicianCase | null>(null)
  const [formData, setFormData] = useState<Partial<TechnicianCase>>({})
  const [imageRefreshTrigger, setImageRefreshTrigger] = useState(0)
  const [hasPendingImageChanges, setHasPendingImageChanges] = useState(false)
  // 3.56.0: osparade ändringar innan en specialrapport öppnas (fälten användaren redigerar)
  const { markeraSparat, harOsparat } = useOsparatArende(formData, OSPARAT_FALT)
  const sparatOkRef = useRef(false)

  // Följeärende-states
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpPestType, setFollowUpPestType] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)

  // Återbesök / Nytt ärende val-dialog
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [showRevisitModal, setShowRevisitModal] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  // Tekniker-lista för initialer-cirklar
  const [technicianList, setTechnicianList] = useState<{ id: string; name: string; role: string }[]>([])

  // Inline title edit state
  const [editingTitle, setEditingTitle] = useState(false)

  // Aktiv flik (ren UI-state). Tekniker med bokat/pågående ärende landar på
  // "Utförande", övriga på "Ärende". Panelerna avmonteras aldrig - de göms
  // med className "hidden" så att barnkomponenternas state/effekter behålls.
  const [activeTab, setActiveTab] = useState<CaseModalTab>(() => getDefaultTab(caseData?.status, activeView))
  useEffect(() => {
    if (isOpen && caseData) setActiveTab(getDefaultTab(caseData.status, activeView))
  }, [isOpen, caseData?.id])

  // Kommunikations-panel state
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [oneflowContractId, setOneflowContractId] = useState<string | null>(null)

  // Historikpanel state
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [historyCount, setHistoryCount] = useState(0)

  // Re-mount CaseServiceSelector efter delfaktura (tvingar re-fetch av pending items)
  const [servicesSelectorKey, setServicesSelectorKey] = useState(0)

  // Radering state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Nollställ alla overlay/dialog-states när modalen stängs. Modalen förblir
  // monterad i föräldern (styrs via isOpen-prop) så kvarglömda flaggor skulle
  // annars auto-öppna overlays när nästa ärende öppnas.
  useEffect(() => {
    if (!isOpen) {
      setShowFollowUpDialog(false)
      setShowActionDialog(false)
      setShowRevisitModal(false)
      setShowDuplicateDialog(false)
      setShowCommunicationPanel(false)
      setShowHistoryPanel(false)
      setShowDeleteDialog(false)
    }
  }, [isOpen])

  // Provision state
  const [commissionEligible, setCommissionEligible] = useState(false)
  const [billingSummary, setBillingSummary] = useState<CaseBillingSummary | null>(null)
  const handleBillingSummaryChange = useCallback((_items: any, summary: CaseBillingSummary) => setBillingSummary(summary), [])
  const [commissionShares, setCommissionShares] = useState<TechnicianShare[]>([])
  const [commissionDeductions, setCommissionDeductions] = useState(0)
  const [commissionNotes, setCommissionNotes] = useState('')
  const [existingCommissionPosts, setExistingCommissionPosts] = useState(0)
  const [commissionPostsLocked, setCommissionPostsLocked] = useState(false)

  // Kundnummer & kundgrupp (för auto-tilldelning vid Avslutat + faktura)
  const [existingCustomerNumber, setExistingCustomerNumber] = useState<number | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [selectedCustomerGroupId, setSelectedCustomerGroupId] = useState<string | null>(null)
  // Befintlig kundrad för person-/org.nr (kan sakna nummer: Fortnox-numret
  // tilldelas först när fakturan skickas, docs/kundnummer-fortnox-plan.md)
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null)
  const [hasBillableAmount, setHasBillableAmount] = useState(false)

  // Besöksräknare + återbesökshistorik
  const [visitNumber, setVisitNumber] = useState(1)
  const [revisitLoggedCount, setRevisitLoggedCount] = useState(0)
  const [revisitHistory, setRevisitHistory] = useState<{ id: string; created_at: string; new_value: string; updated_by_name: string }[]>([])
  useEffect(() => {
    if (!caseData?.id) return
    ;(async () => {
      const { data, count } = await supabase
        .from('case_updates_log')
        .select('id, created_at, new_value, updated_by_name', { count: 'exact' })
        .eq('case_id', caseData.id)
        .eq('update_type', 'revisit_scheduled')
        .order('created_at', { ascending: false })
      setVisitNumber((count ?? 0) + 1)
      setRevisitHistory(data || [])
    })()
  }, [caseData?.id, revisitLoggedCount])

  // Vald tjänsteartikel (för CasePreparationsSection)
  const [serviceArticle, setServiceArticle] = useState<Service | null>(null)

  // Artikelgrupp-ID för filtrering av interna kostnader
  const [articleGroupId, setArticleGroupId] = useState<string | null>(null)

  // Härled service_group_id + artikelgrupp-ID från vald tjänst (utan att
  // rensa service_id). Triggas på formData i stället för caseData: init-
  // effekten nollställer service_group_id varje gång caseData får ny
  // referens, och då måste gruppen härledas om även när service_id-värdet
  // är oförändrat - annars ser tjänstevalet tomt ut fast tjänsten är sparad.
  useEffect(() => {
    const sid = formData.service_id
    if (!sid) { setArticleGroupId(null); return }
    if (formData.service_group_id) return
    ;(async () => {
      const { data: svc } = await supabase.from('services').select('group_id').eq('id', sid).single()
      if (!svc?.group_id) { setArticleGroupId(null); return }
      // Sätt service_group_id i formData utan att rensa service_id
      setFormData(prev => ({ ...prev, service_group_id: svc.group_id }))
      const { data: sg } = await supabase.from('service_groups').select('name').eq('id', svc.group_id).single()
      if (!sg?.name) { setArticleGroupId(null); return }
      const { data: ag } = await supabase.from('article_groups').select('id').eq('name', sg.name).maybeSingle()
      setArticleGroupId(ag?.id ?? null)
    })()
  }, [formData.service_id, formData.service_group_id])

  // Auto-sätt avdrag från underleverantörsartiklar
  useEffect(() => {
    if (billingSummary && existingCommissionPosts === 0) {
      setCommissionDeductions(billingSummary.subcontractor_total)
    }
  }, [billingSummary?.subcontractor_total, existingCommissionPosts])

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
      caseType: currentCase.case_type === 'business' ? 'business' : 'private',
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
      // Ärendets kund kopplas direkt i guiden (fälten från ärendet står kvar)
      customer_id: currentCase?.customer_id ?? null,
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
    let prefillServices: any[] = []
    let billingItems: any[] = []
    try {
      const caseType = currentCase.case_type === 'private' ? 'private' : 'business'
      billingItems = await CaseBillingService.getCaseBillingItems(currentCase.id, caseType as any)
      prefillArticles = mapBillingItemsToSelectedArticles(billingItems)
      prefillServices = mapBillingItemsToPrefillServices(billingItems)
    } catch (err) {
      console.warn('Kunde inte hämta ärendets artiklar:', err)
    }

    // Härleda deductionType från artiklarnas faktiska rot_rut_type
    let deductionType: 'rot' | 'rut' | 'none' = 'none'
    const hasRot = billingItems.some(item => item.rot_rut_type === 'ROT')
    const hasRut = billingItems.some(item => item.rot_rut_type === 'RUT')
    if (hasRot) deductionType = 'rot'
    else if (hasRut) deductionType = 'rut'

    // Guardrails: ROT/RUT måste vara korrekt uppsatt innan offerten skapas
    if (hasRot && hasRut) {
      toast.error('Ärendet har både ROT och RUT – dela upp i separata ärenden innan offert skapas.');
      return;
    }
    // Avdrag får bara ligga på arbetstidstjänster (avdraget beräknas på arbetskostnaden)
    const misplacedDeduction = billingItems.filter(item =>
      item.item_type === 'service' &&
      item.rot_rut_type &&
      item.service &&
      !item.service.rot_eligible &&
      !item.service.rut_eligible
    );
    if (misplacedDeduction.length > 0) {
      const names = misplacedDeduction.map(i => i.service_name || i.article_name).join(', ');
      toast.error(
        `ROT/RUT ligger på "${names}" som inte är en arbetstidstjänst. Använd "Dela upp för ROT/RUT" i Ekonomi-fliken så att avdraget beräknas på arbetskostnaden.`,
        { duration: 8000 }
      );
      return;
    }

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
      customer_id: currentCase.customer_id ?? null,
      autoSelectTemplate: true,
      selectedTemplate,
      selectedPriceListId,
      prefillArticles,
      prefillServices,
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
        // Följeärendet bär samma ärendenummer som ursprunget (beslut 2026-10-17).
        // case_number är unikt per tabell, så numret ligger i titeln och
        // case_number lämnas tomt; global_search läser numret ur titeln.
        title: currentCase.title,
        // Ärvd kundinformation
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
        newCaseData.customer_group_id = currentCase.customer_group_id ?? null;
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
  // Återbesök går att boka i alla privat- och företagsärenden, även följeärenden
  // (flera återbesök i samma ärende). Bara nytt ärende och duplicering kräver huvudärendet.
  const kanBokaAterbesok = !!currentCase &&
    (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  // Initialisera modal när ett NYTT ärende öppnas (baserat på id)
  // Uppdatera endast currentCase när caseData ändras för att behålla tidloggningsdata
  useEffect(() => {
    if (caseData) {
      // Uppdatera alltid currentCase med senaste data (inkl. tidloggningsfält)
      setCurrentCase(caseData);

      // Endast resetta formData om det är ett NYTT ärende
      // Detta förhindrar att formuläret resettas när tidloggning uppdaterar caseData
      if (!currentCase || currentCase.id !== caseData.id) {
        const init: Partial<TechnicianCase> = {
          title: caseData.title || '',
          status: caseData.status || '',
          description: caseData.description || '',
          kontaktperson: caseData.kontaktperson || '',
          telefon_kontaktperson: caseData.telefon_kontaktperson || '',
          e_post_kontaktperson: caseData.e_post_kontaktperson || '',
          case_price: caseData.case_price || 0,
          skadedjur: caseData.skadedjur || '',
          service_id: caseData.service_id || null,
          service_group_id: null,
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
        };
        setFormData(init);
        markeraSparat(init);
        setError(null);
        setTimeTrackingLoading(false);
        setLoading(false);

        // Initiera provision-state
        setCommissionEligible(caseData.is_commission_eligible || false);
        setCommissionShares([]);
        setCommissionDeductions(0);
        setCommissionNotes('');
        // Kolla om provisionsposter redan finns — och om någon är "låst" (inte längre
        // pending_invoice, dvs. på väg till eller redan utbetald).
        ProvisionService.getPostsByCase(caseData.id)
          .then(posts => {
            setExistingCommissionPosts(posts.length);
            setCommissionPostsLocked(posts.some(p => p.status !== 'pending_invoice'));
            // Förfyll shares/deductions från befintliga poster så användaren ser vad som är satt
            if (posts.length > 0) {
              setCommissionShares(posts.map(p => ({
                technician_id: p.technician_id,
                technician_name: p.technician_name,
                technician_email: p.technician_email || undefined,
                share_percentage: p.share_percentage,
              })));
              setCommissionDeductions(posts[0].deductions || 0);
              setCommissionNotes(posts[0].notes || '');
            }
          })
          .catch(() => {
            setExistingCommissionPosts(0);
            setCommissionPostsLocked(false);
          });

        // Kundgruppen väljs normalt redan när ärendet skapas (CreateCaseModal);
        // väljaren vid avslut är fallback för äldre ärenden utan grupp
        setSelectedCustomerGroupId(caseData.customer_group_id ?? null)

        // Slå upp befintlig customer för att visa kundnummer + avgöra om
        // kundgruppsval behöver visas för nya business-kunder. Raden kan
        // finnas UTAN nummer (numret sätts vid Till Fortnox).
        const lookupKey = caseData.case_type === 'private'
          ? caseData.personnummer
          : caseData.case_type === 'business'
            ? caseData.org_nr
            : null
        if (lookupKey) {
          supabase
            .from('customers')
            .select('id, customer_number')
            .eq('organization_number', lookupKey)
            .is('parent_customer_id', null)
            .order('customer_number', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
              setExistingCustomerId((data as any)?.id ?? null)
              setExistingCustomerNumber((data as any)?.customer_number ?? null)
            })
        } else {
          setExistingCustomerId(null)
          setExistingCustomerNumber(null)
        }
      }
    }
  }, [caseData]);

  // Ladda aktiva kundgrupper när modalen öppnas (för business-val)
  useEffect(() => {
    if (!isOpen) return
    CustomerGroupService.getActiveGroups()
      .then(setCustomerGroups)
      .catch(() => setCustomerGroups([]))
  }, [isOpen])

  // Håll koll på om ärendet faktiskt har fakturerbart belopp (för gating)
  useEffect(() => {
    if (!billingSummary) { setHasBillableAmount(false); return }
    setHasBillableAmount((billingSummary.subtotal ?? 0) > 0)
  }, [billingSummary?.subtotal]);

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

  // val.stannaKvar används bara av nya arbetsvyn: samma sparkedja, men modalen
  // stängs inte efteråt (ärendet fortsätter i stegen). Utan val: som tidigare.
  const handleSubmit = async (e?: React.FormEvent, val?: { stannaKvar?: boolean }) => {
    e?.preventDefault();
    sparatOkRef.current = false;
    const tableName = getTableName();
    if (!tableName || !currentCase) return;

    if (sluttidForeStart(formData.start_date, formData.due_date)) {
      toast.error(SLUTTID_FORE_START_FEL);
      return;
    }

    // ROT/RUT kräver fastighetsbeteckning (Skatteverket). Blockera spara om någon
    // ROT/RUT-tjänsterad saknar beteckning. Gäller bara privatärenden (ROT/RUT är
    // inte valbart för företag/avtal).
    if (currentCase.case_type === 'private') {
      try {
        const missing = await CaseBillingService.getRotRutItemsMissingFastighet(
          currentCase.id,
          'private'
        );
        if (missing.length > 0) {
          setRotRutFastighetError(true);
          toast.error(
            `Fastighetsbeteckning krävs för ROT/RUT på: ${missing.join(', ')}. Fyll i den innan du sparar.`,
            { duration: 6000 }
          );
          return;
        }
        setRotRutFastighetError(false);
      } catch (validationErr: any) {
        toast.error(`Kunde inte validera ROT/RUT: ${validationErr.message}`);
        return;
      }
    }

    // SPÄRR: rabattrader utan motivering blockerar avslut. Körs FÖRE alla
    // skrivningar (statusändring, fakturering via upsertInvoiceFromCase, provision).
    // Avtalstilläggsrader räknas inte som rabatt (exkluderas i servicen).
    if (formData.status === 'Avslutat' && currentCase.status !== 'Avslutat') {
      // SPÄRR: saneringsrapporten ska vara skriven innan ärendet avslutas
      if (!formData.rapport?.trim()) {
        toast.error(RAPPORT_SAKNAS_FEL, { duration: 8000 });
        return;
      }
      try {
        const unmotivated = await CaseBillingService.getUnmotivatedDiscountItems(currentCase.id);
        if (unmotivated.length > 0) {
          const names = unmotivated.map(i => `${i.name} (-${i.discount_percent}%)`).join(', ');
          toast.error(
            `Motivera rabatten på ${names} under Tjänster & fakturarader innan ärendet avslutas`,
            { duration: 8000 }
          );
          return;
        }
        // Avtalat material (artiklar med kundpris) måste vara mappat mot en tjänst,
        // annars faktureras det aldrig utan försvinner som intern kostnad.
        const unmappedPriced = await CaseBillingService.getUnmappedCustomerPricedArticles(currentCase.id);
        if (unmappedPriced.length > 0) {
          toast.error(
            `${unmappedPriced.map(u => `${u.quantity} st ${u.name}`).join(', ')} har kundpris men ingen tjänst att faktureras på. Mappa dem mot en tjänst i prisguiden först.`,
            { duration: 8000 }
          );
          return;
        }
      } catch (guardError: any) {
        toast.error(`Kunde inte kontrollera rabattmotiveringar: ${guardError.message}`);
        return;
      }
    }

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
        updateData.service_id = formData.service_id ?? null;
        updateData.pris = formData.case_price === "" ? null : formData.case_price;
        updateData.start_date = formData.start_date;
        updateData.due_date = formData.due_date;
        // Spara null istället för tom sträng — annars ser besökshistoriken ut
        // att ha en rapport som bara innehåller blanksteg
        updateData.rapport = formData.rapport?.trim() || null; // Synkas till ClickUp
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
          updateData.completed_date = toLocalISOStringWithOffset(new Date());
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
      sparatOkRef.current = true;
      markeraSparat(formData);

      // ═══════════════════════════════════════════════════════════════════════════
      // BESÖKSSNAPSHOT: slutbesöket måste finnas INNAN fakturering och provision,
      // annars saknar fakturarader och provisionsposter besökskoppling. RPC:n är
      // idempotent (ett slutbesök per ärende), så upprepade sparningar av ett
      // redan avslutat ärende återanvänder samma besök.
      // ═══════════════════════════════════════════════════════════════════════════
      let finalVisit: Visit | null = null;
      if (formData.status === 'Avslutat') {
        const snapshotCaseType: VisitCaseType =
          tableName === 'private_cases' ? 'private'
            : tableName === 'business_cases' ? 'business'
              : 'contract';
        finalVisit = await VisitService.createVisitSnapshot({
          caseId: currentCase.id,
          caseType: snapshotCaseType,
          source: 'completion',
          isFinal: true,
          customerId: currentCase.customer_id ?? null,
          visitDate: (updateData.completed_date as string | undefined)
            ?? (currentCase as { completed_date?: string | null }).completed_date
            ?? new Date().toISOString(),
          technicianId: formData.primary_assignee_id || null,
          technicianName: formData.primary_assignee_name || null,
          // Hela besökets bemanning, inte bara primärteknikern
          technicians: [
            { id: formData.primary_assignee_id || null, name: formData.primary_assignee_name || '', role: 'primary' as const },
            { id: formData.secondary_assignee_id || null, name: formData.secondary_assignee_name || '', role: 'secondary' as const },
            { id: formData.tertiary_assignee_id || null, name: formData.tertiary_assignee_name || '', role: 'tertiary' as const },
          ].filter(t => t.name.trim().length > 0),
          workPerformed: formData.rapport,
          timeSpentMinutes: await VisitService.besoketsMinuter(currentCase.id, currentCase.time_spent_minutes),
        });
        if (!finalVisit) {
          toast.error('Besöket kunde inte sparas i historiken. Ärendet är avslutat, men kontakta admin.', { duration: 10000 });
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // AUTO-FAKTURERING: Generera/uppdatera faktura när ärendet sparas som "Avslutat"
      //
      // Kör både vid övergång till Avslutat och vid efterföljande sparningar så att
      // pris-/prov-uppdateringar slår igenom. upsertInvoiceFromCase raderar och
      // återskapar en oskickad faktura — låsta fakturor (sent/booked/paid/med
      // Fortnox-nummer) rörs inte och ett felmeddelande visas istället.
      // ═══════════════════════════════════════════════════════════════════════════
      let invoiceGenerated = false;
      let invoiceUpdated = false;
      let invoiceSkippedZero = false;
      if (formData.status === 'Avslutat') {
        // Endast för private och business cases (inte contract)
        if (tableName === 'private_cases' || tableName === 'business_cases') {
          const billingCaseType = tableName === 'private_cases' ? 'private' : 'business';
          const wasAlreadyClosed = currentCase.status === 'Avslutat';

          try {
            // Kontrollera om det finns billing items
            const hasBillingItems = await CaseBillingService.caseHasBillingItems(
              currentCase.id,
              billingCaseType
            );

            if (hasBillingItems) {
              // Kontrollera att det finns ett faktiskt fakturerbart belopp (> 0).
              // Ärenden utan tjänsterader med belopp (t.ex. 0-kr-inspektion) ska
              // inte tilldela kundnummer eller skapa faktura.
              const hasBillableAmt = await CaseBillingService.caseHasBillableAmount(
                currentCase.id,
                billingCaseType
              );

              // Kundraden fakturan ska kopplas till (customers.id). Kundnumret
              // tilldelas från Fortnox när fakturan skickas.
              let caseCustomerId: string | null = null;

              if (hasBillableAmt) {
                // Se till att en customers-rad finns innan fakturan skapas.
                const customerName = billingCaseType === 'business'
                  ? (formData.company_name || currentCase.company_name || formData.bestallare || currentCase.bestallare || formData.kontaktperson || currentCase.kontaktperson || 'Okänd kund')
                  : (formData.kontaktperson || currentCase.kontaktperson || 'Okänd kund');
                const customerEmail = billingCaseType === 'business'
                  ? (formData.e_post_faktura || currentCase.e_post_faktura || formData.e_post_kontaktperson || currentCase.e_post_kontaktperson)
                  : (formData.e_post_kontaktperson || currentCase.e_post_kontaktperson);
                const customerPhone = formData.telefon_kontaktperson || currentCase.telefon_kontaktperson;
                const customerAddress = formatAddress(formData.adress || currentCase.adress);

                try {
                  const result = await CaseCustomerService.getOrCreateCaseCustomer({
                    caseType: billingCaseType,
                    name: customerName,
                    personnummer: billingCaseType === 'private' ? (formData.personnummer || currentCase.personnummer) : null,
                    organization_number: billingCaseType === 'business' ? (formData.org_nr || currentCase.org_nr) : null,
                    email: customerEmail,
                    phone: customerPhone,
                    address: customerAddress,
                    customerGroupId: billingCaseType === 'business'
                      ? (selectedCustomerGroupId || currentCase.customer_group_id || undefined)
                      : undefined,
                  });
                  caseCustomerId = result.customerId;
                  setExistingCustomerId(result.customerId);
                  if (result.customerNumber) {
                    setExistingCustomerNumber(result.customerNumber);
                  }
                } catch (customerError: any) {
                  console.error('[EditCaseModal] Kunde inte skapa/hämta kund:', customerError);
                  toast.error(`Kund: ${customerError.message}`);
                  throw customerError;
                }
              }

              // upsert: skapa ny eller ersätt oskickad. null = underlaget är
              // 0 kr och ingen faktura skapas (0 kr-regeln i invoiceService).
              const upserted = await InvoiceService.upsertInvoiceFromCase(
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
                    : undefined,
                  customer_id: caseCustomerId,
                }
              );
              if (!upserted) {
                invoiceSkippedZero = true;
              } else if (wasAlreadyClosed) {
                invoiceUpdated = true;
                console.log('[EditCaseModal] Faktura uppdaterad för ärendet');
              } else {
                invoiceGenerated = true;
                console.log('[EditCaseModal] Faktura genererad för ärendet');
              }
            }
          } catch (invoiceError: any) {
            // Ärendet är redan sparat, så detta är bara en varning
            console.warn('[EditCaseModal] Kunde inte generera/uppdatera faktura:', invoiceError);
            toast.error(`Faktura: ${invoiceError.message}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PROVISION: Skapa/uppdatera provisionsposter när ärendet sparas som "Avslutat"
      //
      // Kör både vid övergång och vid efterföljande sparningar. upsertPostsForCase
      // raderar och återskapar poster med status 'pending_invoice' — poster som
      // redan är på väg till utbetalning (ready_for_payout/approved/paid_out) rörs
      // inte och användaren får ett felmeddelande.
      // ═══════════════════════════════════════════════════════════════════════════
      let commissionCreated = false;
      let commissionUpdated = false;
      if (formData.status === 'Avslutat') {
        if (commissionEligible && commissionShares.length > 0) {
          const wasAlreadyClosed = currentCase.status === 'Avslutat';
          try {
            const casePrice = billingSummary?.subtotal || Number(formData.case_price) || 0;
            const isRotRut = !!(formData.r_rot_rut && formData.r_rot_rut !== 'Nej');
            // Vid ROT/RUT: provision på belopp innan avdrag (= case_price)
            // Provision per besök: ärendets bas fördelas proportionellt mot
            // besökens nettointäkt. Saknas besök (snapshotet misslyckades)
            // faller servicen tillbaka på en post per ärende.
            const caseVisits = finalVisit
              ? await VisitService.getVisitsForCase(currentCase.id)
              : [];
            await ProvisionService.upsertPostsForVisits(
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
              caseVisits.map(v => ({ id: v.id, visit_number: v.visit_number, revenue: v.revenue })),
              { deductions: commissionDeductions, notes: commissionNotes || undefined }
            );
            if (wasAlreadyClosed && existingCommissionPosts > 0) {
              commissionUpdated = true;
            } else {
              commissionCreated = true;
            }
          } catch (commErr: any) {
            console.warn('[EditCaseModal] Provision kunde inte skapas/uppdateras:', commErr);
            toast.error(`Provision: ${commErr.message}`);
          }
        }
      }

      if (val?.stannaKvar) {
        // Nya arbetsvyn: modalen är kvar, så det sparade läget läses in här
        // (status, avslutsdatum) i stället för att modalen stängs
        setCurrentCase(prev => (prev ? { ...prev, ...updatedCaseFromDb, case_type: prev.case_type } : prev));
      } else {
        setSubmitted(true);
      }

      // Visa lämpligt meddelande
      if (invoiceGenerated && commissionCreated) {
        toast.success('Ärendet avslutat, faktura genererad och provision skapad!');
      } else if (invoiceGenerated) {
        toast.success('Ärendet avslutat och faktura genererad!');
      } else if (commissionCreated) {
        toast.success('Ärendet avslutat och provision skapad!');
      } else if (invoiceUpdated && commissionUpdated) {
        toast.success('Ärendet sparat — faktura och provision uppdaterade med nya siffror.');
      } else if (invoiceUpdated) {
        toast.success('Ärendet sparat — fakturan uppdaterad med nya siffror.');
      } else if (commissionUpdated) {
        toast.success('Ärendet sparat — provisionen uppdaterad med nya siffror.');
      } else if (invoiceSkippedZero) {
        toast.success('Ärendet sparat. Underlaget är 0 kr, ingen faktura skapas.');
      } else {
        toast.success('Ärendet har uppdaterats!');
      }

      if (!val?.stannaKvar) {
        setTimeout(() => {
          setSubmitted(false);
          onClose();
        }, 1500);
      }

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
    setFormData(prev => {
      // Flyttas starten följer slutet med och behåller besökets längd,
      // annars blir slutet kvar på det gamla datumet och besöket försvinner
      // ur schemat (negativ längd)
      if (fieldName === 'start_date' && date && prev.due_date) {
        const gammalLangd = prev.start_date
          ? new Date(prev.due_date).getTime() - new Date(prev.start_date).getTime()
          : 0;
        const langd = gammalLangd > 0 && gammalLangd <= 24 * 60 * 60 * 1000
          ? gammalLangd
          : 60 * 60 * 1000;
        return { ...prev, start_date: isoString, due_date: new Date(date.getTime() + langd).toISOString() };
      }
      return { ...prev, [fieldName]: isoString };
    });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // NYA ARBETSVYN: stegflödet. Gäller bara när useNyArbetsvy().aktiv är true
  // (profiles.ny_arbetsvy och teknikervyn). Annars används inget av detta och
  // modalen ser ut och beter sig som tidigare. Stegen visar samma sektioner som
  // flikarna (samma JSX, samma handlers, samma handleSubmit); inget sparas på
  // något annat sätt. Mönstret är detsamma som i EditContractCaseModal.
  // ═══════════════════════════════════════════════════════════════════════════
  const { aktiv: nyArbetsvy } = useNyArbetsvy()
  // 'steg' = stegflödet, 'flikar' = den vanliga flikvyn (Alla uppgifter)
  const [visning, setVisning] = useState<'steg' | 'flikar'>('steg')
  const stegLage = nyArbetsvy && visning === 'steg'
  const [aktivtSteg, setAktivtSteg] = useState<StegId>('framme')
  const [hinderSteg, setHinderSteg] = useState<StegId[]>([])
  const [visaVerktyg, setVisaVerktyg] = useState(false)
  const [stegUpptaget, setStegUpptaget] = useState(false)
  const provisionsgrans = useProvisionsgrans(nyArbetsvy)
  const innehallRef = useRef<HTMLDivElement>(null)
  const stegLista = useStegForArende('privat')

  // Startsteg härlett ur ärendet: avslutat → Klart, arbetstid startad eller
  // registrerad → Arbetet, annars Framme
  useEffect(() => {
    if (!isOpen || !nyArbetsvy || !caseData?.id) return
    setVisning('steg')
    setVisaVerktyg(false)
    setHinderSteg([])
    if ((caseData.status || '').toLowerCase().includes('avslutat')) {
      setAktivtSteg('klart')
    } else if (caseData.work_started_at || (caseData.time_spent_minutes ?? 0) > 0) {
      setAktivtSteg('arbete')
    } else {
      setAktivtSteg('framme')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nyArbetsvy, caseData?.id])

  // Hela ärendet i steget Klart: status Avslutat och sedan den vanliga
  // handleSubmit (som själv kör spärrarna, besöksposten, faktureringen och
  // provisionen). handleSubmit läser formData, därför körs den i en effekt
  // efter att statusen har slagit igenom i formuläret.
  const [stangBegard, setStangBegard] = useState(false)
  const stangSvarRef = useRef<((ok: boolean) => void) | null>(null)
  const statusForeStangRef = useRef('')
  useEffect(() => {
    if (!stangBegard || formData.status !== 'Avslutat') return
    setStangBegard(false)
    ;(async () => {
      await handleSubmit(undefined, { stannaKvar: true })
      const ok = sparatOkRef.current
      // Stoppades sparandet: formuläret får tillbaka statusen det hade
      if (!ok) setFormData(prev => ({ ...prev, status: statusForeStangRef.current }))
      stangSvarRef.current?.(ok)
      stangSvarRef.current = null
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stangBegard, formData.status])

  // Rapportknapparna i stegen och verktygen: osparade ändringar sparas först,
  // sedan körs rapporthookens handler i renderingen efter sparandet, så att
  // rapporten byggs på det som nu är sparat (hooken läser currentCase)
  const [rapportBegaran, setRapportBegaran] = useState<'ladda' | 'tekniker' | 'kontakt' | null>(null)
  useEffect(() => {
    if (!rapportBegaran) return
    const vilken = rapportBegaran
    setRapportBegaran(null)
    const atgard = vilken === 'ladda'
      ? reportGeneration.downloadReport
      : vilken === 'tekniker'
        ? reportGeneration.sendToTechnician
        : reportGeneration.sendToContact
    // Hooken visar själv felet som toast
    atgard().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapportBegaran])

  if (!currentCase) return null;
  
  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Sparat!" size="md" preventClose={true} usePortal={true}>
        <div className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-[#20c58f] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Ärendet har uppdaterats</h3>
          <p className="text-slate-400">Ändringarna har sparats framgångsrikt</p>
        </div>
      </Modal>
    );
  }

  // Blockera Spara när nytt business-ärende avslutas fakturerbart utan vald kundgrupp
  const needsCustomerGroup =
    !!currentCase &&
    currentCase.case_type === 'business' &&
    formData.status === 'Avslutat' &&
    hasBillableAmount &&
    existingCustomerId === null &&
    !selectedCustomerGroupId

  const saveDisabled = loading || timeTrackingLoading || needsCustomerGroup
  const saveTooltip = needsCustomerGroup
    ? 'Välj kundgrupp innan ärendet kan avslutas'
    : undefined

  const footer = (
    <div className="flex items-center justify-between px-4 py-2.5">
      <button
        type="button"
        onClick={() => setShowDeleteDialog(true)}
        className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Radera
      </button>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading || timeTrackingLoading}>
          Avbryt
        </Button>
        <span title={saveTooltip}>
          <Button type="submit" form="edit-case-form" size="sm" loading={loading} disabled={saveDisabled}>
            Spara ändringar
          </Button>
        </span>
      </div>
    </div>
  );

  const showTimeTracking = (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  // Kontrollera om kommunikation kan visas
  const showCommunication = currentCase && (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  const typeBadge = TYPE_BADGES[currentCase.case_type] || TYPE_BADGES.private

  const headerStatus = formData.status || currentCase.status || ''

  const modalTitle = (
    <div className="flex items-center gap-2 min-w-0">
      {editingTitle ? (
        <input
          name="title"
          value={formData.title || ''}
          onChange={handleChange}
          className="flex-1 min-w-0 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          placeholder="Ärendenamn..."
          autoFocus
          onBlur={() => setEditingTitle(false)}
          onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
        />
      ) : (
        <>
          <span className="font-mono font-semibold text-white truncate">
            {currentCase.case_number || currentCase.title}
          </span>
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors flex-shrink-0"
            title="Redigera ärendenamn"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusChipStyle(headerStatus)}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {headerStatus}
      </span>
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${typeBadge.cls}`}>
        {typeBadge.label}
      </span>
      {visitNumber > 1 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex-shrink-0">
          Besök {visitNumber}
        </span>
      )}
    </div>
  )

  const customerLabel = currentCase.case_type === 'business'
    ? ((currentCase as any).company_name || currentCase.kontaktperson || currentCase.title)
    : (currentCase.kontaktperson || currentCase.title)
  const modalSubtitle = [customerLabel, formatAddress(currentCase.adress)].filter(Boolean).join(' · ')

  // ═══ Nya arbetsvyn: delarna som bara renderas när nyArbetsvy är true ═══

  // Sektionernas synlighet. Gamla läget: noden returneras orörd (ingen wrapper).
  // Nya läget: samma nod i en wrapper som visas i sina steg och alltid i flikvyn.
  const iSteg = (steg: StegId[], node: ReactNode) => {
    if (!nyArbetsvy) return node
    const klass = stegLage ? (steg.includes(aktivtSteg) ? 'empty:hidden' : 'hidden') : 'empty:hidden'
    return <div className={klass}>{node}</div>
  }
  // Stegens egna block (rubrik, hjälptext, knappar): bara i stegflödet
  const stegBlock = (steg: StegId) => (stegLage && aktivtSteg === steg ? 'flex flex-col gap-3' : 'hidden')

  const rullaUpp = () => {
    setTimeout(() => innehallRef.current?.parentElement?.scrollTo({ top: 0 }), 0)
  }

  const gaTillSteg = (steg: StegId) => {
    setVisning('steg')
    setAktivtSteg(steg)
    rullaUpp()
  }

  const visaFlikar = (flik?: CaseModalTab) => {
    setVisning('flikar')
    if (flik) setActiveTab(flik)
    rullaUpp()
  }

  const { foregaende: foregaendeSteg, nasta: nastaSteg } = grannSteg(stegLista, aktivtSteg)
  // En kollega som öppnat ärendet via en tråd (inte tilldelad) ska inte starta tiden
  const arKollega = nyArbetsvy && !!profile?.technician_id && !profile?.is_admin && !profile?.is_koordinator
    && ![currentCase.primary_assignee_id, currentCase.secondary_assignee_id, currentCase.tertiary_assignee_id].includes(profile.technician_id)
  // Tiden räknas i bakgrunden: den startar varje gång teknikern är framme, även vid återbesök
  const startaTidVidFramme = aktivtSteg === 'framme' && showTimeTracking && !isRunning && !arKollega
  const finnsOsparat = () => harOsparat() || hasPendingImageChanges

  // Samma sparkedja som Spara ändringar, men modalen är kvar
  const sparaUtanAttStanga = async () => {
    await handleSubmit(undefined, { stannaKvar: true })
    return sparatOkRef.current
  }

  // Vidare: sparar med den vanliga handleSubmit om något är ändrat, startar
  // tiden i steget Framme (befintliga handleTimeTracking('start')) och går till nästa steg
  const gaVidare = async () => {
    if (!nastaSteg || stegUpptaget) return
    setStegUpptaget(true)
    try {
      if (finnsOsparat()) {
        const ok = await sparaUtanAttStanga()
        if (!ok) return
      }
      if (startaTidVidFramme) await handleTimeTracking('start')
      gaTillSteg(nastaSteg.id)
    } finally {
      setStegUpptaget(false)
    }
  }

  // Rapportens tre val (samma handlers som WorkReportDropdown i huvudet)
  const rapportAtgard = async (vilken: 'ladda' | 'tekniker' | 'kontakt') => {
    if (finnsOsparat()) {
      const ok = await sparaUtanAttStanga()
      if (!ok) return
    }
    setRapportBegaran(vilken)
  }
  const rapportAvstangd = !reportGeneration.canGenerateReport || reportGeneration.isGenerating

  // Kundgruppen väljs i modalen och följer med till kundraden vid avslut, men
  // sparas inte på ärendet. Samma villkor som needsCustomerGroup ovan, utan statuskravet.
  const saknarKundgrupp =
    currentCase.case_type === 'business' &&
    hasBillableAmount &&
    existingCustomerId === null &&
    !selectedCustomerGroupId

  const kontrollAvslut = async (): Promise<AvslutsHinder[]> => {
    const hinder = await kontrolleraAvslut({
      caseId: currentCase.id,
      kalla: currentCase.case_type === 'business' ? 'business_cases' : 'private_cases',
    })
    // Kundgruppen sparas inte på ärendet och kontrolleras därför inte i
    // servicen; modalens val (needsCustomerGroup utan statuskravet) gäller här
    if (saknarKundgrupp) {
      hinder.push({
        id: 'kundgrupp-saknas',
        text: 'Välj kundgrupp under Pris och fakturering innan ärendet kan avslutas.',
        steg: 'pris',
      })
    }
    return hinder
  }

  // Hinder från avslutskontrollen: steget om det finns, annars flikvyn
  const gaTillHinder = (steg: StegId, hinder?: AvslutsHinder) => {
    if (hinder?.id === 'sluttid-fore-start') {
      visaFlikar('arende')
      return
    }
    if (hinder?.id === 'rotrut-fastighet') setRotRutFastighetError(true)
    if (!stegLista.some(s => s.id === steg)) {
      visaFlikar(steg === 'pris' ? 'ekonomi' : 'utforande')
      return
    }
    gaTillSteg(steg)
  }

  // Arbetstiden startar av sig själv vid Framme. Går klockan när besöket
  // stängs stoppas den först, annars sparas besöket med 0 minuter och
  // klockan fortsätter på ett avslutat ärende.
  const stoppaKlockan = async () => {
    if (currentCase?.work_started_at) await handleTimeTracking('complete')
  }

  const stangHelaArendet = () => new Promise<boolean>(resolve => {
    if (saknarKundgrupp) {
      toast.error('Välj kundgrupp innan ärendet kan avslutas')
      gaTillSteg('pris')
      resolve(false)
      return
    }
    stangSvarRef.current = resolve
    void stangEfterKlockan()
  })

  const stangEfterKlockan = async () => {
    await stoppaKlockan()
    statusForeStangRef.current = formData.status || ''
    setFormData(prev => ({ ...prev, status: 'Avslutat' }))
    setStangBegard(true)
  }

  // Bara besöket: befintliga RevisitModal. Den läser det sparade ärendet, så
  // osparade ändringar (till exempel rapporten) sparas först.
  const oppnaAterbesok = async () => {
    await stoppaKlockan()
    if (finnsOsparat()) {
      const ok = await sparaUtanAttStanga()
      if (!ok) return
    }
    setShowRevisitModal(true)
  }

  const provisionText = (() => {
    if (!commissionEligible) return 'Ärendet är inte markerat som provisionsgrundande, ingen provision registreras.'
    if (commissionShares.length === 0) return 'Provision är vald men ingen tekniker har en andel. Fördela den under Pris och fakturering, annars registreras ingen provision.'
    const underGrans = underProvisionsgrans(billingSummary?.subtotal || Number(formData.case_price) || 0, provisionsgrans)
    if (underGrans) return underGrans
    if (commissionPostsLocked) return 'Provisionen är redan på väg till utbetalning och ändras inte.'
    return `Provisionen registreras på ${commissionShares.map(s => `${s.technician_name} ${s.share_percentage} %`).join(', ')}.`
  })()

  const vadHanderVidStang = [
    'Ärendet får status Avslutat och dagens datum som avslutsdatum.',
    'Besöket sparas i besökshistoriken med teknikerna, rapporten och tiden.',
    'Raderna under Pris och fakturering blir en faktura på kunden, som går vidare till godkännande och Fortnox som i dag. Är underlaget 0 kr skapas ingen faktura.',
    provisionText,
    'Rapporten skickas inte av sig själv. Skicka den i steget Rapport.',
  ]

  const vadHanderVidBesok = [
    'Du väljer ny tid i återbesöksdialogen. Ärendet får status Återbesök och stängs inte.',
    'Besöket sparas i besökshistoriken med teknikerna och rapporten.',
    'Delfakturering är en kryssruta i samma dialog. Den visas när ärendet har tjänster som inte är fakturerade.',
  ]

  const adressText = formatAddress(formData.adress)
  const oneflowAvtalId = (currentCase as { oneflow_contract_id?: string | null }).oneflow_contract_id || null

  const ikonKnapp = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
  const stegKnappKlass = 'min-h-[48px] px-4 rounded-xl border border-slate-600 bg-slate-800/60 text-white text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

  const nyttHuvud = (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => (stegLage ? visaFlikar() : gaTillSteg(aktivtSteg))}
        aria-label={stegLage ? 'Alla uppgifter i ärendet, den vanliga flikvyn' : 'Tillbaka till stegen'}
        title={stegLage ? 'Alla uppgifter' : 'Tillbaka till stegen'}
        className={ikonKnapp}
      >
        <SvgIcon name={stegLage ? 'falt.uppgifter' : 'guide.steg'} size={24} />
      </button>
      <button
        type="button"
        onClick={() => setVisaVerktyg(true)}
        aria-label="Ärendets verktyg"
        aria-haspopup="dialog"
        aria-expanded={visaVerktyg}
        title="Ärendets verktyg"
        className={ikonKnapp}
      >
        <SvgIcon name="falt.verktyg" size={24} />
      </button>
      {stegLage && (
        <button type="button" onClick={onClose} aria-label="Stäng ärendet" title="Stäng" className={ikonKnapp}>
          <SvgIcon name="allman.stang" size={24} />
        </button>
      )}
    </div>
  )

  const stegFooter = (
    <StegKnappar
      steg={stegLista}
      aktivt={aktivtSteg}
      onTillbaka={foregaendeSteg ? () => gaTillSteg(foregaendeSteg.id) : undefined}
      onNasta={nastaSteg ? gaVidare : undefined}
      nastaText={startaTidVidFramme ? 'Jag är framme' : undefined}
      upptagen={stegUpptaget || loading || timeTrackingLoading}
    />
  )

  // Ärendets verktyg: samma val, villkor och handlers som huvudet, menyerna och sidfoten
  const verktygGrupper: ArendeVerktygGrupp[] = !nyArbetsvy ? [] : [
    {
      id: 'rapporter',
      rubrik: 'Rapporter',
      val: [
        {
          id: 'ladda-ned',
          ikon: 'rapport.ladda' as const,
          text: 'Ladda ned rapporten',
          beskrivning: 'Saneringsrapporten som PDF. Finns en rapport redan frågar appen om en ny version.',
          villkorText: reportGeneration.canGenerateReport ? undefined : 'Ärendet behöver ett namn',
          disabled: rapportAvstangd,
          onClick: () => { void rapportAtgard('ladda') },
        },
        {
          id: 'skicka-tekniker',
          ikon: 'rapport.skicka' as const,
          text: 'Skicka till ansvarig tekniker',
          beskrivning: reportGeneration.technicianName ? `Skicka till ${reportGeneration.technicianName}` : 'Skicka till ansvarig tekniker',
          villkorText: reportGeneration.hasTechnicianEmail ? undefined : 'Ingen tekniker-e-post tillgänglig',
          disabled: rapportAvstangd,
          onClick: () => { void rapportAtgard('tekniker') },
        },
        {
          id: 'skicka-kontakt',
          ikon: 'kontakt.mejl' as const,
          text: 'Skicka till kontaktperson',
          beskrivning: reportGeneration.contactName ? `Skicka till ${reportGeneration.contactName}` : 'Skicka till kontaktperson',
          villkorText: reportGeneration.hasContactEmail ? undefined : 'Kontaktpersonen saknar e-post',
          disabled: rapportAvstangd,
          onClick: () => { void rapportAtgard('kontakt') },
        },
        {
          id: 'specialrapport',
          ikon: 'falt.specialrapport' as const,
          text: 'Specialrapporter',
          beskrivning: 'Skapa, öppna och ladda ned specialrapporter. De finns i steget Rapport.',
          onClick: () => gaTillSteg('rapport'),
        },
      ],
      not: reportGeneration.hasRecentReport && reportGeneration.currentReport && reportGeneration.getTimeSinceReport
        ? `Rapport framtagen ${reportGeneration.getTimeSinceReport(reportGeneration.currentReport)}, version ${reportGeneration.currentReport.version} av ${reportGeneration.totalReports}${reportGeneration.currentReport.sent_to_customer ? ', skickad till kund' : ''}${reportGeneration.currentReport.sent_to_technician ? ', skickad till tekniker' : ''}.`
        : undefined,
    },
    {
      id: 'avtal-offert',
      rubrik: 'Avtal och offert',
      val: [
        {
          id: 'avtal',
          ikon: 'dok.avtal' as const,
          text: 'Skapa avtal',
          beskrivning: 'Öppnar avtalskaparen i Oneflow med kunduppgifterna ifyllda.',
          onClick: handleCreateContract,
        },
        {
          id: 'offert',
          ikon: 'dok.offert' as const,
          text: 'Skapa offert',
          beskrivning: 'Öppnar offertskaparen i Oneflow med ärendets tjänster och artiklar ifyllda.',
          onClick: () => { void handleCreateOffer() },
        },
      ],
      not: oneflowAvtalId ? (
        <div className="flex items-center gap-2">
          <span>Signerat avtal finns:</span>
          <CustomerContractButton
            oneflowContractId={oneflowAvtalId}
            customerName={currentCase.kontaktperson || currentCase.title || 'Ärende'}
          />
        </div>
      ) : undefined,
    },
    {
      id: 'aterbesok',
      rubrik: 'Återbesök och nytt ärende',
      // Återbesök i alla privat- och företagsärenden; nytt ärende och kopia bara från huvudärendet
      val: kanBokaAterbesok ? [
        {
          id: 'boka-aterbesok',
          ikon: 'arende.aterbesok' as const,
          text: 'Boka återbesök',
          beskrivning: 'Flytta ärendet till ett framtida datum. Delfakturering är en kryssruta i dialogen.',
          onClick: () => { void oppnaAterbesok() },
        },
        ...(canCreateFollowUp ? [{
          id: 'nytt-arende',
          ikon: 'allman.plus' as const,
          text: 'Skapa nytt ärende',
          beskrivning: 'Nytt problem hos samma kund (annat skadedjur).',
          onClick: () => setShowFollowUpDialog(true),
        },
        {
          id: 'duplicera',
          ikon: 'rapport.kopia' as const,
          text: 'Duplicera ärende',
          beskrivning: 'Skapa en kopia och välj vad som följer med.',
          onClick: () => setShowDuplicateDialog(true),
        }] : []),
      ] : [],
    },
    {
      id: 'kontakt',
      rubrik: 'Kontakt och plats',
      val: [
        ...(showCommunication ? [{
          id: 'kommunikation',
          ikon: 'kontakt.mote' as const,
          text: 'Kommunikation',
          beskrivning: 'Intern chatt om ärendet med kontoret och andra tekniker.',
          onClick: () => setShowCommunicationPanel(true),
        }] : []),
        ...(adressText ? [{
          id: 'kartor',
          ikon: 'falt.navigera' as const,
          text: 'Öppna adressen i kartor',
          beskrivning: adressText,
          onClick: () => openInMaps(formData.adress),
        }] : []),
        ...(formData.telefon_kontaktperson ? [{
          id: 'ring',
          ikon: 'kontakt.telefon' as const,
          text: `Ring ${formData.kontaktperson || 'kontaktpersonen'}`,
          beskrivning: formData.telefon_kontaktperson,
          onClick: () => { window.location.href = `tel:${(formData.telefon_kontaktperson || '').replace(/\s/g, '')}` },
        }] : []),
      ],
    },
    {
      id: 'arendet',
      rubrik: 'Ärendet',
      val: [
        {
          id: 'byt-namn',
          ikon: 'rapport.penna' as const,
          text: 'Byt ärendenamn',
          beskrivning: `Nu ${formData.title || currentCase.title || 'utan namn'}. Namnet ändras överst i ärendet och sparas med ärendet.`,
          onClick: () => setEditingTitle(true),
        },
        {
          id: 'historik',
          ikon: 'allman.historik' as const,
          text: 'Historik',
          beskrivning: 'Ändringar och händelser i ärendet.',
          onClick: () => setShowHistoryPanel(true),
        },
        ...((currentCase.case_type === 'private' || currentCase.case_type === 'business') ? [{
          id: 'lead',
          ikon: 'lead.tips' as const,
          text: 'Skapa lead',
          beskrivning: 'Tipsa om ett löpande avtal eller merförsäljning. Knappen finns i steget Klart.',
          onClick: () => gaTillSteg('klart'),
        }] : []),
        {
          id: 'alla-uppgifter',
          ikon: 'falt.uppgifter' as const,
          text: 'Alla uppgifter',
          beskrivning: 'Den vanliga flikvyn med Ärende, Utförande och Ekonomi. Allt som sparas där syns i stegen.',
          onClick: () => visaFlikar(),
        },
        {
          id: 'status',
          ikon: 'arende.status' as const,
          text: 'Ändra status',
          beskrivning: `Nu ${formData.status || currentCase.status}. Statusstegen visas överst i Alla uppgifter. Spara efter bytet.`,
          onClick: () => visaFlikar(),
        },
      ],
    },
    {
      id: 'ta-bort',
      rubrik: 'Ta bort',
      val: [{
        id: 'radera',
        ikon: 'allman.radera' as const,
        text: 'Radera ärende',
        beskrivning: 'Frågar en gång till innan ärendet tas bort.',
        fara: true,
        onClick: () => setShowDeleteDialog(true),
      }],
    },
  ]

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} subtitle={modalSubtitle || undefined} size="full" footer={stegLage ? stegFooter : footer} preventClose={true} allowBackdropClose={!loading && !timeTrackingLoading} usePortal={true} className="scroll-smooth"
      mobilHelskarm={nyArbetsvy}
      headerActions={nyArbetsvy ? nyttHuvud : (
        <div className="flex items-center gap-1.5">
          {/* Avtal */}
          <button
            type="button"
            onClick={handleCreateContract}
            className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-800/50 border border-slate-700 hover:border-[#20c58f]/50 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors"
            title="Skapa serviceavtal för denna kund"
          >
            <FileSignature className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Avtal</span>
          </button>

          {/* Offert */}
          <button
            type="button"
            onClick={handleCreateOffer}
            className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-800/50 border border-slate-700 hover:border-[#20c58f]/50 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors"
            title="Skapa offertförslag för denna kund"
          >
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Offert</span>
          </button>

          {/* Rapport */}
          {reportGeneration.canGenerateReport ? (
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
          ) : (
            <div className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-800/30 border border-slate-700/50 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed">
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Rapport</span>
            </div>
          )}

          {/* Fas 13b: visa signerad offert (Oneflow) — öppna i ny flik eller ladda ned */}
          {currentCase.oneflow_contract_id && (
            <CustomerContractButton
              oneflowContractId={currentCase.oneflow_contract_id}
              customerName={currentCase.kontaktperson || currentCase.title || 'Ärende'}
            />
          )}
          {kanBokaAterbesok && (
            <button
              type="button"
              onClick={() => setShowActionDialog(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Boka återbesök eller skapa nytt ärende"
            >
              <SvgIcon name="arende.aterbesok" size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHistoryPanel(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
            title="Ärendehistorik"
          >
            <History className="w-5 h-5" />
            {historyCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
          {showCommunication && (
            <button
              type="button"
              onClick={() => setShowCommunicationPanel(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Öppna kommunikation"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    >
      {/* Statusstepper - kopplad till samma statesetter som gamla status-selecten.
          Nya arbetsvyn: visas i flikvyn (Alla uppgifter), inte i stegflödet */}
      {!stegLage && (
      <CaseStatusStepper
        status={formData.status || ''}
        statuses={buildStatusOptions(formData.status || '').map(o => o.value)}
        onChange={(s) => setFormData(prev => ({ ...prev, status: s }))}
        stepDates={[
          (currentCase as any).created_at || (currentCase as any).created_date || null,
          formData.start_date || currentCase.start_date || null,
          (currentCase as any).completed_date || null,
        ]}
      />
      )}

      {/* Leads etapp 5: Skapa lead (eller Lead skapad · Företag →), bara engångsärenden.
          Nya arbetsvyn: samma knapp ligger i formuläret (steget Klart och flikvyn) */}
      {!nyArbetsvy && (currentCase.case_type === 'private' || currentCase.case_type === 'business') && currentCase.id && (
        <div className="flex items-center px-4 pt-2 min-w-0">
          <SkapaLeadKnapp caseType={currentCase.case_type} caseId={currentCase.id} />
        </div>
      )}

      {/* Nya arbetsvyn: stegraden i stället för flikraden */}
      {stegLage && (
        <StegRad steg={stegLista} aktivt={aktivtSteg} onValj={gaTillSteg} hinder={hinderSteg} />
      )}

      {/* Sticky flikrad */}
      {!stegLage && (
      <div className="sticky top-0 z-10 flex gap-1 px-4 py-2 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50">
        {([
          { id: 'arende', label: 'Ärende', icon: FileText },
          { id: 'utforande', label: 'Utförande', icon: Wrench },
          { id: 'ekonomi', label: 'Ekonomi', icon: Wallet },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      )}

      <div ref={nyArbetsvy ? innehallRef : undefined} className="p-4">

        {/* Val-dialog: Återbesök eller Nytt ärende — fixed overlay */}
        {showActionDialog && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowActionDialog(false)}
          >
            <div
              className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-400" />
                Vad vill du göra?
              </h3>
              <button
                type="button"
                onClick={() => { setShowRevisitModal(true); setShowActionDialog(false) }}
                className="w-full p-4 mb-3 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RotateCcw className="w-5 h-5 text-teal-400 shrink-0" />
                  <div>
                    <p className="text-white font-medium">Boka återbesök</p>
                    <p className="text-sm text-slate-400">Flytta ärendet till ett framtida datum för uppföljning av skadedjursstatus</p>
                  </div>
                </div>
              </button>
              {canCreateFollowUp && (<>
              <button
                type="button"
                onClick={() => { setShowFollowUpDialog(true); setShowActionDialog(false) }}
                className="w-full p-4 mb-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-white font-medium">Skapa nytt ärende</p>
                    <p className="text-sm text-slate-400">Nytt problem hos samma kund (annat skadedjur)</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setShowDuplicateDialog(true); setShowActionDialog(false) }}
                className="w-full p-4 bg-[#20c58f]/10 hover:bg-[#20c58f]/20 border border-[#20c58f]/30 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Copy className="w-5 h-5 text-[#20c58f] shrink-0" />
                  <div>
                    <p className="text-white font-medium">Duplicera ärende</p>
                    <p className="text-sm text-slate-400">Skapa en kopia och välj vad som följer med</p>
                  </div>
                </div>
              </button>
              </>)}
              <button
                type="button"
                onClick={() => setShowActionDialog(false)}
                className="w-full mt-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        {/* Följeärende-dialog — fixed overlay */}
        {showFollowUpDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Skapa nytt ärende
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Välj skadedjurstyp. Kundinformation, adress och schemaläggning kopieras automatiskt.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1">Skadedjurstyp *</label>
                <Select
                  value={followUpPestType}
                  onChange={setFollowUpPestType}
                  placeholder="Välj skadedjurstyp..."
                  options={PEST_TYPE_OPTIONS.map(pest => ({ value: pest.name, label: pest.name }))}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowFollowUpDialog(false); setFollowUpPestType('') }}
                  disabled={followUpLoading}
                  className="flex-1"
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  variant="primary"
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

        <form
          id="edit-case-form"
          onSubmit={nyArbetsvy ? (e) => { void handleSubmit(e, { stannaKvar: true }) } : handleSubmit}
          className={stegLage ? 'flex flex-col gap-3' : 'space-y-3'}
        >
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* ═══ Nya arbetsvyn: stegens rubriker, hjälptexter och knappar (bara stegflödet) ═══ */}
          {nyArbetsvy && (
            <>
              <div className={stegBlock('framme')}>
                <HjalpText id="steg-framme-privat" rubrik="Är du framme hos kunden?">
                  {arKollega
                    ? 'Du är inte tilldelad ärendet. Du kan läsa det och svara i kommunikationen, men ärendet sköts av den som har det.'
                    : 'Tryck på den gröna knappen när du står på plats. Kontrollera kontakten och adressen.'}
                </HjalpText>
                {(adressText || formData.telefon_kontaktperson) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {adressText && (
                      <button type="button" onClick={() => openInMaps(formData.adress)} className={stegKnappKlass}>
                        <SvgIcon name="falt.navigera" size={20} />
                        <span className="truncate">Öppna i kartor</span>
                      </button>
                    )}
                    {formData.telefon_kontaktperson && (
                      <a href={`tel:${formData.telefon_kontaktperson.replace(/\s/g, '')}`} className={stegKnappKlass}>
                        <SvgIcon name="kontakt.telefon" size={20} />
                        <span className="truncate">Ring {formData.kontaktperson || formData.telefon_kontaktperson}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className={stegBlock('arbete')}>
                <HjalpText id="steg-arbete-privat" rubrik="Vad ska göras?">
                  Uppdraget står i beskrivningen. Välj tjänsten som utförs, den styr preparaten och prisguiden.
                </HjalpText>
              </div>

              <div className={stegBlock('foton')}>
                <HjalpText id="steg-foton-privat" rubrik="Foton och preparat">
                  Fotografera det kunden behöver åtgärda och lägg in preparat du har använt. Bilderna sparas när du går vidare eller sparar ärendet.
                </HjalpText>
              </div>

              <div className={stegBlock('rapport')}>
                <HjalpText id="steg-rapport-privat" rubrik="Rapport">
                  Skriv vad du gjorde i saneringsrapporten. Rapporten skickas inte av sig själv, ladda ned den eller skicka den med knapparna längst ner i steget.
                </HjalpText>
              </div>

              <div className={stegBlock('pris')}>
                <HjalpText id="steg-pris-privat" rubrik="Pris och fakturering">
                  Lägg in tjänster och artiklar som gick åt. Prisguiden visar inköpspris och marginal. Raderna faktureras när ärendet stängs. Provisionen fördelar du längst ner.
                </HjalpText>
                {currentCase.case_type === 'business' ? (
                  <Input
                    name="org_nr"
                    label="Organisationsnummer"
                    placeholder="Org.nummer"
                    value={formData.org_nr || ''}
                    onChange={handleChange}
                    helperText="Fakturan och kundraden kopplas till organisationsnumret."
                  />
                ) : (
                  <Input
                    name="personnummer"
                    label="Personnummer"
                    placeholder="Personnummer"
                    value={formData.personnummer || ''}
                    onChange={handleChange}
                    helperText="Krävs för ROT och RUT. Fastighetsbeteckningen fyller du i på ROT- eller RUT-raden nedanför."
                  />
                )}
              </div>
            </>
          )}

          {/* Varningar (flyttade från gamla actionbandet) */}
          {iSteg(['rapport'], (reportGeneration.canGenerateReport && (!reportGeneration.hasTechnicianEmail || !reportGeneration.hasContactEmail)) && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                {!reportGeneration.hasTechnicianEmail && 'Ingen tekniker-email tillgänglig. '}
                {!reportGeneration.hasContactEmail && 'Ingen kontaktperson-email tillgänglig.'}
              </span>
            </div>
          ))}
          {iSteg(['framme'], (!currentCase.kontaktperson || !currentCase.e_post_kontaktperson) && (
            <div className="flex items-start gap-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Komplettera kontaktuppgifter för bästa avtal/offert-skapning</span>
            </div>
          ))}
          {iSteg([], currentCase.parent_case_id && (
            <div className="flex items-start gap-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Detta är ett följeärende</span>
            </div>
          ))}

          {/* ════════ Flik: Ärende ════════ */}
          <div className={stegLage ? 'contents' : activeTab === 'arende' ? 'space-y-3' : 'hidden'}>
            {iSteg(['arbete'], (
            <CaseModalSection icon={FileText} iconClassName="text-teal-400" title="Ärendeinformation">
              <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  ref={(el) => { if (el) autoResize(el) }}
                  rows={2}
                  style={{ maxHeight: '16rem' }}
                  className="w-full px-3 py-1.5 bg-slate-900/60 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/20 transition-all duration-200 leading-relaxed overflow-y-auto resize-none"
                  placeholder="Beskriv ärendet i detalj..."
                />
              </div>
              {showTimeTracking && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tjänst</label>
                  <ServiceArticleSelector
                    groupId={formData.service_group_id ?? null}
                    serviceId={formData.service_id ?? null}
                    onGroupChange={async (gid) => {
                      // Sätt bara service_group_id – rensa ALDRIG service_id här.
                      // service_id rensas av ServiceArticleSelector internt via onServiceChange
                      // när användaren aktivt byter grupp i dropdownen.
                      setFormData(prev => ({ ...prev, service_group_id: gid }))
                      if (gid) {
                        const { data: sg } = await supabase.from('service_groups').select('name').eq('id', gid).single()
                        if (sg?.name) {
                          const { data: ag } = await supabase.from('article_groups').select('id').eq('name', sg.name).maybeSingle()
                          setArticleGroupId(ag?.id ?? null)
                        }
                      } else {
                        setArticleGroupId(null)
                      }
                    }}
                    onServiceChange={(sid, svc) => {
                      setFormData(prev => ({ ...prev, service_id: sid }))
                      setServiceArticle(svc)
                    }}
                    bookingOnly
                  />
                  {!formData.service_id && formData.skadedjur && (
                    <p className="mt-1 text-xs text-slate-500">Befintlig: {formData.skadedjur}</p>
                  )}
                </div>
              )}
              </div>
            </CaseModalSection>
            ))}

            {/* Tekniker-tilldelningar */}
            {iSteg([], (
            <CaseModalSection icon={User} iconClassName="text-orange-400" title="Tekniker">
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
            </CaseModalSection>
            ))}

            {/* Schemaläggning */}
            {iSteg([], showTimeTracking && (
              <CaseModalSection icon={CalendarIcon} iconClassName="text-purple-400" title="Schemaläggning">
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
              </CaseModalSection>
            ))}

            {/* Kontaktinformation */}
            {iSteg(['framme'], showTimeTracking && (
              <CaseModalSection icon={User} iconClassName="text-emerald-400" title="Kontaktinformation">
                <div className="space-y-2">
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
                <div className="space-y-1">
                  <AddressAutocomplete
                    value={formatAddress(formData.adress)}
                    onChange={(val) => {
                      if (typeof val === 'string') {
                        handleAddressChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>)
                      } else {
                        setFormData(prev => ({ ...prev, adress: val as GeocodeResult }))
                      }
                    }}
                    placeholder="Adress..."
                  />
                  {formatAddress(formData.adress) && (
                    <button
                      type="button"
                      onClick={() => openInMaps(formData.adress)}
                      className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Öppna i Maps
                    </button>
                  )}
                </div>
                </div>
              </CaseModalSection>
            ))}

            {/* Företagsinfo & Fakturering (bara business cases) */}
            {iSteg(['pris'], currentCase.case_type === 'business' && (
              <CaseModalSection icon={Receipt} iconClassName="text-indigo-400" title="Företag & Fakturering">
                <div className="grid grid-cols-2 gap-2">
                  <Input name="company_name" placeholder="Företagsnamn" value={formData.company_name || ''} onChange={handleChange} />
                  <Input name="bestallare" placeholder="Beställare" value={formData.bestallare || ''} onChange={handleChange} />
                  <Input name="markning_faktura" placeholder="Märkning faktura" value={formData.markning_faktura || ''} onChange={handleChange} />
                  <Input name="e_post_faktura" placeholder="E-post faktura" type="email" value={formData.e_post_faktura || ''} onChange={handleChange} />
                </div>
              </CaseModalSection>
            ))}
          </div>

          {/* ════════ Flik: Utförande ════════ */}
          <div className={stegLage ? 'contents' : activeTab === 'utforande' ? 'space-y-3' : 'hidden'}>
            {/* Tidtagning - kompakt "Arbetstid"-sektion */}
            {/* Nya arbetsvyn: tiden räknas i bakgrunden och visas inte, varken i stegen eller i flikvyn */}
            {iSteg([], !nyArbetsvy && showTimeTracking && (
              <CaseModalSection icon={Clock} iconClassName={isRunning ? 'text-[#20c58f]' : 'text-slate-400'} title="Arbetstid">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold font-mono ${isRunning ? 'text-[#20c58f]' : 'text-white'}`}>
                    {formatMinutesDetailed(displayTime)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isRunning ? (
                      <span className="text-[#20c58f] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-[#20c58f] rounded-full animate-pulse" />
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
              </CaseModalSection>
            ))}

            {/* Saneringsrapport sektion */}
            {iSteg(['rapport'], showTimeTracking && (
              <CaseModalSection icon={BookOpen} iconClassName="text-purple-400" title="Saneringsrapport">
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
              </CaseModalSection>
            ))}

            {/* Specialrapport: fri rapport kopplad till ärendet (3.50.0).
                Nya arbetsvyn: samma spara, men modalen är kvar */}
            {iSteg(['rapport'], currentCase?.id && (
              <CaseSpecialReportsSection
                caseId={currentCase.id}
                caseType={currentCase.case_type}
                caseNumber={currentCase.case_number}
                osparat={{
                  finns: () => harOsparat() || hasPendingImageChanges,
                  spara: async () => {
                    await handleSubmit({ preventDefault: () => {} } as React.FormEvent, nyArbetsvy ? { stannaKvar: true } : undefined)
                    return sparatOkRef.current
                  },
                }}
              />
            ))}

            {/* Använda preparat - Visas INTE för Inspektion */}
            {iSteg(['foton'], currentCase && serviceArticle?.name !== 'Inspektion' && formData.skadedjur !== 'Inspektion' && (
              <CaseModalSection>
                <CasePreparationsSection
                  caseId={currentCase.id}
                  caseType={currentCase.case_type === 'private' ? 'private' : 'business'}
                  pestType={serviceArticle?.name || formData.skadedjur || null}
                  technicianId={currentCase.primary_assignee_id || null}
                  technicianName={currentCase.primary_assignee_name || null}
                  isReadOnly={false}
                />
              </CaseModalSection>
            ))}

            {/* Bilder sektion - visas för alla ärendetyper */}
            {iSteg(['foton'], currentCase && (
              <CaseModalSection icon={ImageIcon} iconClassName="text-cyan-400" title="Bilder">
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
              </CaseModalSection>
            ))}
          </div>

          {/* ════════ Flik: Ekonomi ════════ */}
          <div className={stegLage ? 'contents' : activeTab === 'ekonomi' ? 'space-y-3' : 'hidden'}>
            {/* Utförda tjänster/artiklar för fakturering */}
            {iSteg(['pris'], currentCase && (
              <CaseModalSection>
                <CaseServiceSelector
                  key={servicesSelectorKey}
                  caseId={currentCase.id}
                  caseType={currentCase.case_type === 'private' ? 'private' : 'business'}
                  customerId={currentCase.customer_id}
                  technicianId={currentCase.primary_assignee_id || undefined}
                  technicianName={currentCase.primary_assignee_name || undefined}
                  primaryServiceId={formData.service_id}
                  articleGroupId={articleGroupId}
                  onChange={handleBillingSummaryChange}
                  highlightMissingFastighet={rotRutFastighetError}
                />
              </CaseModalSection>
            ))}

            {/* Kundnummer (befintlig kund hittad via person-/org-nr) */}
            {iSteg(['pris'], currentCase && existingCustomerNumber !== null && (
              <CaseModalSection subtle>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle className="w-4 h-4 text-[#20c58f]" />
                  <span>Kundnummer: </span>
                  <span className="font-semibold text-white">{existingCustomerNumber}</span>
                  <span className="text-slate-500">(återanvänds från befintlig kund)</span>
                </div>
              </CaseModalSection>
            ))}
            {iSteg(['pris'], currentCase && existingCustomerId !== null && existingCustomerNumber === null && (
              <CaseModalSection subtle>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle className="w-4 h-4 text-[#20c58f]" />
                  <span>Kundrad finns. Kundnumret tilldelas från Fortnox när fakturan skickas.</span>
                </div>
              </CaseModalSection>
            ))}

            {/* Kundgruppsval för företagskunder utan kundrad och utan grupp på ärendet
                (fallback för äldre ärenden: nya ärenden får gruppen i CreateCaseModal) */}
            {iSteg(['pris'], currentCase &&
              currentCase.case_type === 'business' &&
              (formData.status === 'Avslutat' || nyArbetsvy) &&
              hasBillableAmount &&
              existingCustomerId === null && (
              <CaseModalSection icon={Receipt} iconClassName="text-[#20c58f]" title="Kundgrupp (för fakturering)">
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Kundgruppen avgör vilken nummerserie kunden får i Fortnox. Numret tilldelas när fakturan skickas till Fortnox.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {customerGroups
                      .filter(g => !g.is_private_default)
                      .map(group => {
                        const isSelected = selectedCustomerGroupId === group.id
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => setSelectedCustomerGroupId(group.id)}
                            className={`text-left p-2.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-[#20c58f]/10 border-[#20c58f]'
                                : 'bg-slate-800/20 border-slate-700/50 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">{group.name}</div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {group.series_start}–{group.series_end}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </div>
              </CaseModalSection>
            ))}

            {/* Provision sektion */}
            {iSteg(['pris'], currentCase && (
              <CaseModalSection>
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
                  postsLocked={commissionPostsLocked}
                  subcontractorDeduction={billingSummary?.subcontractor_total || 0}
                />
              </CaseModalSection>
            ))}
          </div>

          {/* ═══ Nya arbetsvyn: stegens egna delar längst ner i steget ═══ */}
          {nyArbetsvy && (
            <>
              {/* Rapport: samma handlers som rapportmenyn i huvudet (WorkReportDropdown) */}
              <div className={stegBlock('rapport')}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button type="button" onClick={() => { void rapportAtgard('ladda') }} disabled={rapportAvstangd} className={stegKnappKlass}>
                    <SvgIcon name="rapport.ladda" size={20} />
                    Ladda ned
                  </button>
                  <button type="button" onClick={() => { void rapportAtgard('kontakt') }} disabled={rapportAvstangd} className={stegKnappKlass}>
                    <SvgIcon name="kontakt.mejl" size={20} />
                    <span className="truncate">Skicka till {reportGeneration.contactName || 'kontaktperson'}</span>
                  </button>
                  <button type="button" onClick={() => { void rapportAtgard('tekniker') }} disabled={rapportAvstangd} className={stegKnappKlass}>
                    <SvgIcon name="rapport.skicka" size={20} />
                    <span className="truncate">Skicka till {reportGeneration.technicianName || 'ansvarig tekniker'}</span>
                  </button>
                </div>
                {!reportGeneration.canGenerateReport && (
                  <p className="text-sm text-slate-400">Rapporten kan tas fram när ärendet har ett namn. Byt namn under Ärendets verktyg.</p>
                )}
                {reportGeneration.canGenerateReport && !reportGeneration.hasContactEmail && (
                  <p className="text-sm text-amber-300">Kontaktpersonen saknar e-post. Lägg till den i steget Framme innan du skickar rapporten.</p>
                )}
                {reportGeneration.hasRecentReport && reportGeneration.currentReport && (
                  <p className="text-sm text-slate-400">
                    Rapport framtagen {reportGeneration.getTimeSinceReport(reportGeneration.currentReport)}, version {reportGeneration.currentReport.version} av {reportGeneration.totalReports}
                    {reportGeneration.currentReport.sent_to_customer ? ', skickad till kund' : ''}
                    {reportGeneration.currentReport.sent_to_technician ? ', skickad till tekniker' : ''}.
                  </p>
                )}
              </div>

              {/* Klart */}
              <div className={stegBlock('klart')}>
                <KlartSteg
                  aktiv={stegLage && aktivtSteg === 'klart'}
                  steg={stegLista}
                  kontroll={kontrollAvslut}
                  onGaTillSteg={gaTillHinder}
                  gaTillText={h => (h.id === 'sluttid-fore-start' ? 'Ändra tiden i Alla uppgifter' : undefined)}
                  onStangHelaArendet={stangHelaArendet}
                  onBaraBesoket={kanBokaAterbesok ? () => { void oppnaAterbesok() } : undefined}
                  onSparaUtanAttStanga={sparaUtanAttStanga}
                  harOsparat={finnsOsparat}
                  status={currentCase.status || formData.status || ''}
                  arAvslutat={(currentCase.status || '').toLowerCase().includes('avslutat')}
                  avslutsdatum={(currentCase as { completed_date?: string | null }).completed_date ?? null}
                  vadHander={vadHanderVidStang}
                  vadHanderBesok={vadHanderVidBesok}
                  onHinderChange={setHinderSteg}
                />
              </div>

              {/* Skapa lead (samma knapp som överst i gamla läget): i steget Klart och i flikvyn */}
              {iSteg(['klart'], (currentCase.case_type === 'private' || currentCase.case_type === 'business') && currentCase.id && (
                <div className="flex items-center min-w-0">
                  <SkapaLeadKnapp caseType={currentCase.case_type} caseId={currentCase.id} />
                </div>
              ))}
            </>
          )}
        </form>
      </div>

      {/* Historikpanel (slide-in från höger) */}
      <CaseHistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        caseId={currentCase.id}
        caseTitle={currentCase.title}
        onCountChange={setHistoryCount}
      />

      {/* Nya arbetsvyn: Ärendets verktyg */}
      {nyArbetsvy && (
        <ArendeVerktygArk
          oppen={visaVerktyg}
          onStang={() => setVisaVerktyg(false)}
          underrubrik={[currentCase.case_number || currentCase.title, customerLabel].filter(Boolean).join(', ')}
          grupper={verktygGrupper}
        />
      )}

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
          // Låt listan/schemat ta bort ärendet direkt, stäng sedan modalen
          onDeleted?.(currentCase.id);
          onClose();
        }}
        caseId={currentCase.id}
        caseType={currentCase.case_type as DeleteableCaseType}
        caseTitle={currentCase.title}
      />

      {/* Duplicera-ärende-dialog */}
      {currentCase && (
        <DuplicateCaseDialog
          isOpen={showDuplicateDialog}
          onClose={() => setShowDuplicateDialog(false)}
          caseData={{
            id: currentCase.id,
            case_type: (currentCase.case_type === 'business' ? 'business' : 'private') as 'private' | 'business',
            title: currentCase.title,
            case_number: (currentCase as any).case_number ?? null,
            startAt: currentCase.start_date ?? null,
            endAt: currentCase.due_date ?? null,
          }}
          createdByTechnicianId={activeView === 'technician' ? profile?.technician_id ?? null : null}
          createdByTechnicianName={profile?.display_name ?? profile?.full_name ?? null}
          onDuplicated={(result) => {
            setShowDuplicateDialog(false)
            // Hämta nya ärendet och öppna det
            const newCaseForModal: any = {
              id: result.id,
              case_type: result.case_type,
              case_number: result.case_number,
            }
            onSuccess(newCaseForModal)
          }}
        />
      )}
    </Modal>

    {showRevisitModal && currentCase && (
      <RevisitModal
        caseData={currentCase}
        onSuccess={(updatedCase) => {
          setShowRevisitModal(false)
          setCurrentCase(updatedCase)
          setRevisitLoggedCount(c => c + 1)
          setHistoryCount(c => c + 1)
          setServicesSelectorKey(k => k + 1)
          setFormData(prev => ({
            ...prev,
            start_date: updatedCase.start_date,
            due_date: updatedCase.due_date,
            status: updatedCase.status
          }))
          markeraSparat({ start_date: updatedCase.start_date, due_date: updatedCase.due_date, status: updatedCase.status })
          onSuccess(updatedCase)
        }}
        onClose={() => setShowRevisitModal(false)}
      />
    )}
    </>
  )
}
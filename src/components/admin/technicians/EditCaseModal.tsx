// 📁 src/components/admin/technicians/EditCaseModal.tsx - KOMPLETT SLUTGILTIG VERSION

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { AlertCircle, CheckCircle, FileText, User, DollarSign, Clock, Play, Pause, RotateCcw, Save, AlertTriangle } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Modal from '../../ui/Modal'
import toast from 'react-hot-toast'

interface TechnicianCase {
  id: string; case_type: 'private' | 'business' | 'contract'; title: string;
  description?: string; status: string; case_price?: number;
  kontaktperson?: string; telefon_kontaktperson?: string; e_post_kontaktperson?: string;
  skadedjur?: string; org_nr?: string; personnummer?: string;
  material_cost?: number; time_spent_minutes?: number; work_started_at?: string | null;
}

interface EditCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedCase: Partial<TechnicianCase>) => void
  caseData: TechnicianCase | null
}

interface BackupData {
  caseId: string;
  totalMinutes: number;
  sessionMinutes: number;
  startedAt: string;
  timestamp: string;
}

const statusOrder = [ 'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat' ];

// ✅ SÄKER AVRUNDNING AV MINUTER TILL INTEGER
const safeRoundMinutes = (minutes: number): number => {
  return Math.round(Math.max(0, minutes));
};

// ✅ FÖRBÄTTRAD FORMATERING MED REAL-TIME SUPPORT
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

// Fallback för enkel formatering
const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || minutes < 1) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  let result = '';
  if (hours > 0) result += `${hours} tim `;
  result += `${remainingMinutes} min`;
  return result;
};

// ✅ CUSTOM HOOK FÖR REAL-TIME TIMER
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

      // Uppdatera omedelbart
      updateTimer();
      
      // Sedan varje sekund
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setDisplayTime(baseTime);
    }
  }, [case_?.work_started_at, case_?.time_spent_minutes, case_?.id]);

  return { displayTime, isRunning };
};

// ✅ CUSTOM HOOK FÖR AUTO-BACKUP SYSTEM
const useTimeBackupSystem = (currentCase: TechnicianCase | null) => {
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);

  // Check for pending restore on mount
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
        
        // Om backup är nyare än database-data och mindre än 8 timmar gammal
        const hoursSinceBackup = (now.getTime() - backupTime.getTime()) / (1000 * 60 * 60);
        
        if (backupMinutes > currentMinutes && hoursSinceBackup < 8) {
          setPendingRestore({
            ...data,
            totalMinutes: backupMinutes
          });
        } else {
          localStorage.removeItem(backupKey);
        }
      } catch (e) {
        console.error('Backup parse error:', e);
        localStorage.removeItem(backupKey);
      }
    }
  }, [currentCase?.id]);

  // Auto-backup running work every 30 seconds
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
      
      console.log('🔄 Auto-backup:', safeRoundMinutes(totalMinutes), 'minutes');
    }, 30000); // 30 sekunder

    return () => clearInterval(backupInterval);
  }, [currentCase?.work_started_at, currentCase?.time_spent_minutes, currentCase?.id]);

  const restoreFromBackup = useCallback(async (): Promise<TechnicianCase | false> => {
    if (!pendingRestore || !currentCase) return false;

    try {
      const tableName = currentCase.case_type === 'private' ? 'private_cases' 
                     : currentCase.case_type === 'business' ? 'business_cases' 
                     : 'cases';
      
      const safeMinutes = safeRoundMinutes(pendingRestore.totalMinutes);
      
      const { data, error } = await supabase
        .from(tableName)
        .update({
          time_spent_minutes: safeMinutes,
          work_started_at: null
        })
        .eq('id', currentCase.id)
        .select()
        .single();

      if (error) {
        console.error('Restore error:', error);
        throw error;
      }

      localStorage.removeItem(`time_backup_${currentCase.id}`);
      setPendingRestore(null);
      
      toast.success(`Återställde ${formatMinutes(safeMinutes)} arbetstid!`);
      return data as TechnicianCase;
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

// ✅ BACKUP RESTORE PROMPT COMPONENT
const BackupRestorePrompt: React.FC<{
  pendingRestore: BackupData | null;
  onRestore: () => Promise<TechnicianCase | false>;
  onDismiss: () => void;
}> = ({ pendingRestore, onRestore, onDismiss }) => {
  const [restoring, setRestoring] = useState(false);

  if (!pendingRestore) return null;

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await onRestore();
    } catch (error) {
      console.error('Restore failed:', error);
    } finally {
      setRestoring(false);
    }
  };

  const timeDiff = Math.round((new Date().getTime() - new Date(pendingRestore.timestamp).getTime()) / 1000 / 60);

  return (
    <div className="mb-4 p-4 bg-amber-500/20 border border-amber-500/40 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-400 mb-2">
            Återställ förlorad arbetstid?
          </h4>
          <p className="text-xs text-amber-300 mb-3">
            Hittade osparad arbetstid från för {timeDiff} minuter sedan:
            <span className="font-bold ml-1">{formatMinutes(pendingRestore.totalMinutes)}</span>
          </p>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="warning" 
              onClick={handleRestore}
              loading={restoring}
              disabled={restoring}
            >
              Återställ arbetstid
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onDismiss}
              disabled={restoring}
            >
              Ignorera
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EditCaseModal({ isOpen, onClose, onSuccess, caseData }: EditCaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentCase, setCurrentCase] = useState<TechnicianCase | null>(null)
  const [formData, setFormData] = useState<Partial<TechnicianCase>>({})

  // ✅ HOOKS FÖR FÖRBÄTTRAD FUNKTIONALITET
  const { displayTime, isRunning } = useRealTimeTimer(currentCase);
  const { lastBackup, pendingRestore, restoreFromBackup, clearBackup } = useTimeBackupSystem(currentCase);

  // ✅ FIX 1: BÄTTRE STATE INITIALIZATION
  useEffect(() => {
    if (caseData) {
      console.log('Setting currentCase:', caseData);
      setCurrentCase(caseData);
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
        material_cost: caseData.material_cost || 0
      });
      // Reset alla states vid ny data
      setError(null);
      setTimeTrackingLoading(false);
      setLoading(false);
    }
  }, [caseData?.id]); // ✅ FIX: Använd case ID som dependency

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
      
      if (tableName === 'private_cases' || tableName === 'business_cases') {
        updateData.kontaktperson = formData.kontaktperson;
        updateData.telefon_kontaktperson = formData.telefon_kontaktperson;
        updateData.e_post_kontaktperson = formData.e_post_kontaktperson;
        updateData.skadedjur = formData.skadedjur;
        updateData.pris = formData.case_price;
        updateData.material_cost = formData.material_cost;
      }
      
      if (tableName === 'private_cases') { 
        updateData.personnummer = formData.personnummer; 
      } else if (tableName === 'business_cases') { 
        updateData.org_nr = formData.org_nr; 
      } else if (tableName === 'cases') { 
        updateData.price = formData.case_price; 
      }

      const { data, error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', currentCase.id)
        .select()
        .single();
        
      if (updateError) throw updateError;
      
      setSubmitted(true);
      toast.success('Ärendet har uppdaterats!');
      
      setTimeout(() => {
        setSubmitted(false);
        onSuccess({ ...currentCase, ...formData });
        onClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('Form submission error:', error);
      setError(`Fel vid uppdatering: ${error.message}`);
      toast.error('Kunde inte uppdatera ärendet');
    } finally {
      setLoading(false);
    }
  }

  // ✅ FIX 2: FÖRBÄTTRAD TIDSSPÅRNING MED KORREKT STATE UPDATES
  const handleTimeTracking = async (action: 'start' | 'pause' | 'complete' | 'reset') => {
    const tableName = getTableName();
    
    if (!tableName || !currentCase || tableName === 'cases') {
      setError("Tidrapportering är inte tillgängligt för avtalsärenden.");
      return;
    }
    
    console.log(`⏱️ Time tracking action: ${action}`, {
      currentCase: currentCase.id,
      work_started_at: currentCase.work_started_at,
      time_spent_minutes: currentCase.time_spent_minutes
    });
    
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
            const stopTime = new Date();
            const startTime = new Date(currentCase.work_started_at);
            const minutesWorked = (stopTime.getTime() - startTime.getTime()) / 1000 / 60;
            
            const safeMinutesWorked = safeRoundMinutes(minutesWorked);
            const safeTotalMinutes = safeRoundMinutes((currentCase.time_spent_minutes || 0) + minutesWorked);
            
            updatePayload = { 
              work_started_at: null, 
              time_spent_minutes: safeTotalMinutes
            };
            
            if (action === 'pause') {
              successMessage = `⏸️ Arbete pausat! Loggade ${formatMinutes(safeMinutesWorked)}`;
            } else {
              successMessage = `✅ Arbete slutfört! Total tid: ${formatMinutes(safeTotalMinutes)}`;
            }
          } else {
            console.warn('No work_started_at found for pause/complete');
            setError('Ingen pågående arbetstid att pausa/slutföra');
            return;
          }
          break;
          
        case 'reset':
          updatePayload = { 
            work_started_at: null, 
            time_spent_minutes: 0 
          };
          successMessage = '🔄 Arbetstid återställd!';
          break;
      }

      console.log('📤 Sending update payload:', updatePayload);

      // Database update FÖRST - ingen optimistic update
      const { data, error } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', currentCase.id)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('✅ Database update successful:', data);

      // ✅ FIX 3: UPPDATERA STATE EFTER FRAMGÅNGSRIK DATABAS-UPDATE
      const updatedCase = data as TechnicianCase;
      setCurrentCase(updatedCase);
      onSuccess(updatedCase); // Informera parent component
      
      // Clear backup on successful save (except for start)
      if (action !== 'start') {
        localStorage.removeItem(`time_backup_${currentCase.id}`);
      }
      
      toast.success(successMessage, { duration: 3000 });

    } catch (error: any) {
      console.error('⚠️ Time tracking error:', error);
      
      // Specific error messages
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        setError('🌐 Nätverksfel - kontrollera internetanslutningen');
      } else if (error.message?.includes('permission') || error.code === '42501') {
        setError('🔒 Behörighet saknas - kontakta administratör');  
      } else if (error.code === '22P02') {
        setError('🔢 Datafel - tidsvärdet kunde inte sparas korrekt');
      } else {
        setError(`⚠️ Tidsspårning misslyckades: ${error.message || 'Okänt fel'}`);
      }
      
      toast.error('Tidsspårning misslyckades');
    } finally {
      setTimeTrackingLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  }

  // ✅ FIX 4: FÖRBÄTTRAT BACKUP RESTORE
  const handleSuccessfulRestore = async () => {
    const result = await restoreFromBackup();
    if (result && typeof result === 'object') {
      console.log('✅ Restore successful, updating state:', result);
      setCurrentCase(result);
      onSuccess(result);
    }
    return result;
  };

  // ✅ FIX 5: BÄTTRE LOADING STATES OCH UI FEEDBACK
  if (!currentCase) return null;
  
  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Sparat!" size="md" preventClose={true}>
        <div className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Ärendet har uppdaterats</h3>
          <p className="text-slate-400">Ändringarna har sparats framgångsrikt</p>
        </div>
      </Modal>
    );
  }

  const footer = (
    <div className="flex gap-3 p-6 bg-slate-800/50">
      <Button 
        type="button" 
        variant="secondary" 
        onClick={onClose} 
        disabled={loading || timeTrackingLoading}
        className="flex-1"
      >
        Avbryt
      </Button>
      <Button 
        type="submit" 
        form="edit-case-form" 
        loading={loading} 
        disabled={loading}  // ✅ FIX: Bara disable vid form loading
        className="flex-1"
      >
        Spara ändringar
      </Button>
    </div>
  );

  // ✅ FIX 6: ENDAST VISA TIDSSPÅRNING FÖR RÄTT CASE TYPES
  const showTimeTracking = (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Redigera ärende: ${currentCase.title}`} 
      size="xl" 
      footer={footer} 
      preventClose={loading || timeTrackingLoading}
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <BackupRestorePrompt 
          pendingRestore={pendingRestore}
          onRestore={handleSuccessfulRestore}
          onDismiss={clearBackup}
        />

        <form id="edit-case-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          {/* Ärendeinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Ärendeinformation
            </h3>
            <Input label="Titel *" name="title" value={formData.title || ''} onChange={handleChange} required />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning</label>
              <textarea 
                name="description" 
                value={formData.description || ''} 
                onChange={handleChange} 
                rows={4} 
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors" 
                placeholder="Beskrivning av ärendet..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select 
                  name="status" 
                  value={formData.status || ''} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {showTimeTracking && (
                <Input 
                  label="Skadedjur" 
                  name="skadedjur" 
                  value={formData.skadedjur || ''} 
                  onChange={handleChange} 
                  placeholder="T.ex. Råttor, Kackerlackor..."
                />
              )}
            </div>
          </div>

          {/* Kontaktinformation */}
          {showTimeTracking && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                Kontaktinformation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Kontaktperson" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} />
                {currentCase.case_type === 'business' && (
                  <Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />
                )}
                {currentCase.case_type === 'private' && (
                  <Input label="Personnummer" name="personnummer" value={formData.personnummer || ''} onChange={handleChange} />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Telefon" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} />
                <Input label="E-post" name="e_post_kontaktperson" type="email" value={formData.e_post_kontaktperson || ''} onChange={handleChange} />
              </div>
            </div>
          )}
          
          {/* Kostnader & Tid */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              Kostnader & Tid
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Ärendepris (exkl. material)" 
                name="case_price" 
                type="number" 
                value={formData.case_price === null ? '' : formData.case_price} 
                onChange={handleChange} 
              />
              {showTimeTracking && (
                <Input 
                  label="Materialkostnad" 
                  name="material_cost" 
                  type="number" 
                  value={formData.material_cost === null ? '' : formData.material_cost} 
                  onChange={handleChange} 
                />
              )}
            </div>
            
            {/* ✅ FÖRBÄTTRAT TIDRAPPORTERINGSGRÄNSSNITT - KOMPLETT VERSION */}
            {showTimeTracking && (
              <div className="p-4 bg-slate-800/50 rounded-lg border-2 border-slate-700">
                {/* Header med status info */}
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Arbetstid
                    <span className="text-xs text-slate-500">
                      ({currentCase.case_type} - {currentCase.id.slice(0, 8)})
                    </span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {isRunning && (
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                        AKTIV
                      </div>
                    )}
                    {lastBackup && (
                      <span className="text-slate-500">
                        Backup: {lastBackup.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Real-time Time Display */}
                <div className="text-center mb-6">
                  <div className={`text-4xl font-bold font-mono mb-2 transition-colors duration-300 ${
                    isRunning ? 'text-green-400' : 'text-white'
                  }`}>
                    {formatMinutesDetailed(displayTime)}
                  </div>
                  
                  <div className="text-sm text-slate-400">
                    {isRunning ? (
                      <span className="text-green-400 flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Startad kl. {new Date(currentCase.work_started_at!).toLocaleTimeString([], { 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </span>
                    ) : displayTime > 0 ? (
                      'Pausad'
                    ) : (
                      'Ej påbörjad'
                    )}
                  </div>

                  {/* Session info for active work */}
                  {isRunning && displayTime > (currentCase.time_spent_minutes || 0) && (
                    <div className="mt-2 text-xs text-slate-500">
                      Denna session: {formatMinutesDetailed(displayTime - (currentCase.time_spent_minutes || 0))}
                      {(currentCase.time_spent_minutes || 0) > 0 && (
                        <span className="ml-2">
                          (Tidigare: {formatMinutesDetailed(currentCase.time_spent_minutes)})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {isRunning ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        type="button" 
                        variant="warning" 
                        onClick={() => handleTimeTracking('pause')}
                        loading={timeTrackingLoading}
                        disabled={timeTrackingLoading}
                        className="flex items-center justify-center gap-2"
                      >
                        <Pause className="w-4 h-4" />
                        {timeTrackingLoading ? 'Pausar...' : 'Pausa'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="success" 
                        onClick={() => handleTimeTracking('complete')}
                        loading={timeTrackingLoading}
                        disabled={timeTrackingLoading}
                        className="flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {timeTrackingLoading ? 'Slutför...' : 'Slutför'}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      type="button" 
                      variant="primary" 
                      onClick={() => handleTimeTracking('start')}
                      loading={timeTrackingLoading}
                      disabled={timeTrackingLoading}
                      className="w-full flex items-center justify-center gap-2 py-3"
                    >
                      <Play className="w-5 h-5" />
                      {timeTrackingLoading ? 'Startar...' : (displayTime > 0 ? 'Återuppta Arbete' : 'Starta Arbetstid')}
                    </Button>
                  )}

                  {/* Reset button */}
                  {displayTime > 0 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleTimeTracking('reset')}
                      loading={timeTrackingLoading}
                      disabled={timeTrackingLoading}
                      className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {timeTrackingLoading ? 'Återställer...' : 'Nollställ arbetstid'}
                    </Button>
                  )}
                </div>

                {/* Debug info (remove in production) */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 p-2 bg-slate-900/50 rounded text-xs text-slate-500">
                    <strong>Debug:</strong> work_started_at: {currentCase.work_started_at || 'null'}, 
                    time_spent: {currentCase.time_spent_minutes || 0}min, 
                    display: {Math.round(displayTime)}min, 
                    running: {isRunning ? 'yes' : 'no'}
                  </div>
                )}

                {/* Progress indicator för långa arbeten */}
                {displayTime > 120 && (
                  <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Långt ärende - överväg att ta en paus
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-amber-300">
                      Rekommenderad paus efter 2 timmar arbetstid
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </Modal>
  )
}

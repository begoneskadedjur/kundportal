// 📁 src/components/admin/technicians/EditCaseModal.tsx - SLUTGILTIG VERSION MED ALLA FIXAR

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
  onSuccess: (updatedCase: TechnicianCase) => void
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
      const tableName = currentCase.case_type === 'private' ? 'private_cases' 
                     : currentCase.case_type === 'business' ? 'business_cases' 
                     : 'cases';
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

export default function EditCaseModal({ isOpen, onClose, onSuccess, caseData }: EditCaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentCase, setCurrentCase] = useState<TechnicianCase | null>(null)
  const [formData, setFormData] = useState<Partial<TechnicianCase>>({})

  const { displayTime, isRunning } = useRealTimeTimer(currentCase);
  const { lastBackup, pendingRestore, restoreFromBackup, clearBackup } = useTimeBackupSystem(currentCase);

  useEffect(() => {
    if (caseData) {
      setCurrentCase(caseData);
      setFormData({
        title: caseData.title || '', status: caseData.status || '', description: caseData.description || '',
        kontaktperson: caseData.kontaktperson || '', telefon_kontaktperson: caseData.telefon_kontaktperson || '',
        e_post_kontaktperson: caseData.e_post_kontaktperson || '', case_price: caseData.case_price || 0,
        skadedjur: caseData.skadedjur || '', org_nr: caseData.org_nr || '', personnummer: caseData.personnummer || '',
        material_cost: caseData.material_cost || 0
      });
      setError(null);
      setTimeTrackingLoading(false);
      setLoading(false);
    }
  }, [caseData?.id]);

  const getTableName = () => {
    if (!currentCase) return null;
    return currentCase.case_type === 'private' ? 'private_cases' 
         : currentCase.case_type === 'business' ? 'business_cases' 
         : 'cases';
  }

  // ✅ FIX: Denna funktion använder nu datan som returneras från databasen som sanning.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableName = getTableName();
    if (!tableName || !currentCase) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const updateData: { [key: string]: any } = {
        title: formData.title, status: formData.status, description: formData.description,
      };
      
      if (tableName === 'private_cases' || tableName === 'business_cases') {
        updateData.kontaktperson = formData.kontaktperson;
        updateData.telefon_kontaktperson = formData.telefon_kontaktperson;
        updateData.e_post_kontaktperson = formData.e_post_kontaktperson;
        updateData.skadedjur = formData.skadedjur;
        updateData.pris = formData.case_price;
        updateData.material_cost = formData.material_cost;
      }
      
      if (tableName === 'private_cases') { updateData.personnummer = formData.personnummer; } 
      else if (tableName === 'business_cases') { updateData.org_nr = formData.org_nr; } 
      else if (tableName === 'cases') { updateData.price = formData.case_price; }

      const { data, error: updateError } = await supabase
        .from(tableName).update(updateData).eq('id', currentCase.id).select().single();
        
      if (updateError) throw updateError;
      
      const updatedCaseFromDb = data as TechnicianCase;
      
      // Använd alltid det kompletta, returnerade objektet för att uppdatera allt.
      onSuccess(updatedCaseFromDb);
      setCurrentCase(updatedCaseFromDb);

      setSubmitted(true);
      toast.success('Ärendet har uppdaterats!');
      
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

      const mergedCase = { ...currentCase, ...data };
      setCurrentCase(mergedCase as TechnicianCase);
      onSuccess(mergedCase as TechnicianCase);
      
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  }

  const handleSuccessfulRestore = async () => {
    const result = await restoreFromBackup();
    if (result && typeof result === 'object' && currentCase) {
      const mergedCase = { ...currentCase, ...result };
      setCurrentCase(mergedCase as TechnicianCase);
      onSuccess(mergedCase as TechnicianCase);
    }
  };

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
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading || timeTrackingLoading} className="flex-1">
        Avbryt
      </Button>
      <Button type="submit" form="edit-case-form" loading={loading} disabled={loading || timeTrackingLoading} className="flex-1">
        Spara ändringar
      </Button>
    </div>
  );

  const showTimeTracking = (currentCase.case_type === 'private' || currentCase.case_type === 'business');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Redigera ärende: ${currentCase.title}`} size="xl" footer={footer} preventClose={loading || timeTrackingLoading}>
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <BackupRestorePrompt pendingRestore={pendingRestore} onRestore={handleSuccessfulRestore} onDismiss={clearBackup} />

        <form id="edit-case-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" />Ärendeinformation</h3>
            <Input label="Titel *" name="title" value={formData.title || ''} onChange={handleChange} required />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning</label>
              <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Beskrivning av ärendet..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select name="status" value={formData.status || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                  {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {showTimeTracking && (
                <Input label="Skadedjur" name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} placeholder="T.ex. Råttor, Kackerlackor..." />
              )}
            </div>
          </div>

          {showTimeTracking && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2"><User className="w-5 h-5 text-green-400" />Kontaktinformation</h3>
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
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-yellow-400" />Kostnader & Tid</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Ärendepris (exkl. material)" name="case_price" type="number" value={formData.case_price === null ? '' : formData.case_price} onChange={handleChange} />
              {showTimeTracking && (
                <Input label="Materialkostnad" name="material_cost" type="number" value={formData.material_cost === null ? '' : formData.material_cost} onChange={handleChange} />
              )}
            </div>
            
            {showTimeTracking && (
              <div className="p-4 bg-slate-800/50 rounded-lg border-2 border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4" />Arbetstid
                    <span className="text-xs text-slate-500">({currentCase.id.slice(0, 8)})</span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {isRunning && <div className="flex items-center gap-2 text-green-400"><div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>AKTIV</div>}
                    {lastBackup && <span className="text-slate-500">Backup: {lastBackup.toLocaleTimeString()}</span>}
                  </div>
                </div>

                <div className="text-center mb-6">
                  <div className={`text-4xl font-bold font-mono mb-2 transition-colors duration-300 ${isRunning ? 'text-green-400' : 'text-white'}`}>
                    {formatMinutesDetailed(displayTime)}
                  </div>
                  <div className="text-sm text-slate-400">
                    {isRunning ? (
                      <span className="text-green-400 flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Startad kl. {new Date(currentCase.work_started_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : displayTime > 0 ? 'Pausad' : 'Ej påbörjad'}
                  </div>
                  {isRunning && displayTime > (currentCase.time_spent_minutes || 0) && (
                    <div className="mt-2 text-xs text-slate-500">
                      Denna session: {formatMinutesDetailed(displayTime - (currentCase.time_spent_minutes || 0))}
                      {(currentCase.time_spent_minutes || 0) > 0 && (
                        <span className="ml-2">(Tidigare: {formatMinutesDetailed(currentCase.time_spent_minutes)})</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {isRunning ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Button type="button" variant="warning" onClick={() => handleTimeTracking('pause')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="flex items-center justify-center gap-2">
                        <Pause className="w-4 h-4" />{timeTrackingLoading ? 'Pausar...' : 'Pausa'}
                      </Button>
                      <Button type="button" variant="success" onClick={() => handleTimeTracking('complete')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" />{timeTrackingLoading ? 'Slutför...' : 'Slutför'}
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="primary" onClick={() => handleTimeTracking('start')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="w-full flex items-center justify-center gap-2 py-3">
                      <Play className="w-5 h-5" />{timeTrackingLoading ? 'Startar...' : (displayTime > 0 ? 'Återuppta Arbete' : 'Starta Arbetstid')}
                    </Button>
                  )}
                  {displayTime > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleTimeTracking('reset')} loading={timeTrackingLoading} disabled={timeTrackingLoading} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 transition-colors">
                      <RotateCcw className="w-4 h-4" />{timeTrackingLoading ? 'Återställer...' : 'Nollställ arbetstid'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </Modal>
  )
}
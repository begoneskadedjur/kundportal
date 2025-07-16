// 📁 src/components/admin/billing/BillingModal.tsx - SLUTGILITIG KORREKT VERSION
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../utils/formatters';
import {
  X, User, Building2, MapPin, Phone, Mail, FileText,
  ChevronDown, History, Clock, UserIcon, ChevronRight,
  Edit, Save, RotateCcw
} from 'lucide-react';

import Button from '../../ui/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';
import type { BillingCase, EditableFields } from '../../../types/billing'; // Importera EditableFields
import Input from '../../ui/Input'; // Se till att Input-komponenten är tillgänglig

interface BillingModalProps {
  case_: BillingCase | null;
  isOpen: boolean;
  onClose: () => void;
  onCaseUpdate: (updatedCase: BillingCase) => void;
}

interface BillingAuditEntry {
  id: string;
  case_id: string;
  case_type: 'private' | 'business';
  action: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
  metadata?: any;
}

// --- Underkomponenter (kvar i samma fil) ---

const STATUS_TRANSLATIONS = {
  'pending': 'Väntar på fakturering', 'sent': 'Skickad',
  'paid': 'Betald', 'skip': 'Ej faktureras'
};
const STATUS_COLORS = {
  'pending': 'text-yellow-400', 'sent': 'text-blue-400',
  'paid': 'text-green-400', 'skip': 'text-gray-400'
};

const CaseBillingHistory: React.FC<{ caseId: string; caseNumber: string }> = ({ caseId, caseNumber }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState<BillingAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isExpanded && caseId) fetchHistory() }, [isExpanded, caseId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('billing_audit_log').select('*').eq('case_id', caseId).order('changed_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching case history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTransition = (oldValue: string, newValue: string) => {
    const oldLabel = STATUS_TRANSLATIONS[oldValue as keyof typeof STATUS_TRANSLATIONS] || oldValue;
    const newLabel = STATUS_TRANSLATIONS[newValue as keyof typeof STATUS_TRANSLATIONS] || newValue;
    const oldColor = STATUS_COLORS[oldValue as keyof typeof STATUS_COLORS] || 'text-slate-400';
    const newColor = STATUS_COLORS[newValue as keyof typeof STATUS_COLORS] || 'text-slate-400';
    return (<span><span className={oldColor}>{oldLabel}</span><ChevronRight className="inline w-4 h-4 mx-1" /><span className={newColor}>{newLabel}</span></span>);
  };
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="border-t border-slate-700/50 pt-4">
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg">
        <div className="flex items-center gap-3"><History className="w-4 h-4 text-slate-400" /><span>Faktureringhistorik</span></div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && <div className="mt-2 p-2 space-y-2">{loading ? <LoadingSpinner /> : history.length === 0 ? <p className="text-sm text-center text-slate-400 py-4">Ingen historik.</p> : history.map(entry => <div key={entry.id} className="text-sm p-2 bg-slate-800 rounded-md"><div>{getStatusTransition(entry.old_value, entry.new_value)}</div><div className="text-xs text-slate-400 mt-1">{entry.changed_by.split('@')[0]} - {formatDateTime(entry.changed_at)}</div></div>)}</div>}
    </div>
  );
};


// --- Huvudkomponent: BillingModal ---

export const BillingModal: React.FC<BillingModalProps> = ({ case_, isOpen, onClose, onCaseUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  
  // State för alla redigerbara fält
  const [editableData, setEditableData] = useState<EditableFields>({
    kontaktperson: '', telefon_kontaktperson: '', e_post_kontaktperson: '',
    bestallare: '', org_nr: '', personnummer: '', r_fastighetsbeteckning: '',
    e_post_faktura: '', markning_faktura: ''
  });

  useEffect(() => {
    if (case_) {
      // Fyll på state när ett nytt ärende öppnas
      setEditableData({
        kontaktperson: case_.kontaktperson || '',
        telefon_kontaktperson: case_.telefon_kontaktperson || '',
        e_post_kontaktperson: case_.e_post_kontaktperson || '',
        bestallare: case_.bestallare || '',
        org_nr: case_.org_nr || '',
        personnummer: case_.personnummer || '',
        r_fastighetsbeteckning: case_.r_fastighetsbeteckning || '',
        e_post_faktura: case_.e_post_faktura || '',
        markning_faktura: case_.markning_faktura || ''
      });
      setIsEditing(false); // Återställ alltid redigeringsläget
      setReportExpanded(false);
    }
  }, [case_]);

  if (!isOpen || !case_) return null;

  const handleFieldChange = (field: keyof EditableFields, value: string) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const table = case_.type === 'private' ? 'private_cases' : 'business_cases';
      const { data, error } = await supabase.from(table).update(editableData).eq('id', case_.id).select().single();
      if (error) throw error;
      onCaseUpdate(data);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving case:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Återställer fälten till originalvärden
    if (case_) {
      setEditableData({
        kontaktperson: case_.kontaktperson || '', telefon_kontaktperson: case_.telefon_kontaktperson || '',
        e_post_kontaktperson: case_.e_post_kontaktperson || '', bestallare: case_.bestallare || '',
        org_nr: case_.org_nr || '', personnummer: case_.personnummer || '',
        r_fastighetsbeteckning: case_.r_fastighetsbeteckning || '', e_post_faktura: case_.e_post_faktura || '',
        markning_faktura: case_.markning_faktura || ''
      });
    }
    setIsEditing(false);
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Adress saknas';
    try {
      const parsed = typeof address === 'string' ? JSON.parse(address) : address;
      return parsed.formatted_address || 'Okänt adressformat';
    } catch { return address; }
  };
  
  const getStatusBadge = (status: string) => {
    const config = STATUS_TRANSLATIONS[status as keyof typeof statusMap] || { label: status, color: 'bg-slate-500/20 text-slate-400' };
    return (<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
              {case_.type === 'private' ? <User className="w-5 h-5 text-purple-400" /> : <Building2 className="w-5 h-5 text-blue-400" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{case_.case_number}</h2>
              <p className="text-sm text-slate-400">{case_.type === 'private' ? 'Privat' : 'Företag'} • {case_.skadedjur}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {getStatusBadge(case_.billing_status)}
             {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="secondary" size="sm">Avbryt</Button>
                <Button onClick={handleSave} disabled={saving} size="sm">{saving ? <LoadingSpinner /> : <Save className="w-4 h-4" />} Spara</Button>
              </>
             ) : (
                <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm"><Edit className="w-4 h-4" /> Redigera</Button>
             )}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Kontakt och Adress - Återställd design */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-base font-medium text-slate-300 mb-3 flex items-center gap-2"><User className="w-4 h-4" />Kontaktinformation</h3>
              <div className="space-y-4">
                <div><label className="text-xs text-slate-400">Kontaktperson</label>{isEditing ? <Input value={editableData.kontaktperson} onChange={e => handleFieldChange('kontaktperson', e.target.value)} /> : <p className="text-sm text-white">{editableData.kontaktperson || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>
                {case_.type === 'business' && <div><label className="text-xs text-slate-400">Beställare</label>{isEditing ? <Input value={editableData.bestallare} onChange={e => handleFieldChange('bestallare', e.target.value)} /> : <p className="text-sm text-white">{editableData.bestallare || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>}
                <div><label className="text-xs text-slate-400">Telefon</label>{isEditing ? <Input type="tel" value={editableData.telefon_kontaktperson} onChange={e => handleFieldChange('telefon_kontaktperson', e.target.value)} /> : <p className="text-sm text-white flex items-center gap-2"><Phone className="w-3 h-3 text-slate-400" />{editableData.telefon_kontaktperson || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>
                <div><label className="text-xs text-slate-400">Email</label>{isEditing ? <Input type="email" value={editableData.e_post_kontaktperson} onChange={e => handleFieldChange('e_post_kontaktperson', e.target.value)} /> : <p className="text-sm text-white flex items-center gap-2"><Mail className="w-3 h-3 text-slate-400" />{editableData.e_post_kontaktperson || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>
              </div>
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-300 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" />Adress & Identifiering</h3>
              <div className="space-y-4">
                <div><label className="text-xs text-slate-400">Adress</label><p className="text-sm text-white">{formatAddress(case_.adress)}</p></div>
                {case_.type === 'business' ? <div><label className="text-xs text-slate-400">Org.nummer</label>{isEditing ? <Input value={editableData.org_nr} onChange={e => handleFieldChange('org_nr', e.target.value)} /> : <p className="text-sm text-white">{editableData.org_nr || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>
                : <div><label className="text-xs text-slate-400">Personnummer</label>{isEditing ? <Input value={editableData.personnummer} onChange={e => handleFieldChange('personnummer', e.target.value)} /> : <p className="text-sm text-white">{editableData.personnummer || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>}
              </div>
            </div>
          </div>
          
          {/* Faktureringsinformation - Återställd design */}
          <div className="bg-green-900/40 border border-green-500/20 rounded-lg p-6">
            <h3 className="text-base font-medium text-green-400 mb-4 flex items-center gap-2"><FileText className="w-4 h-4" />Faktureringsinformation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {case_.type === 'business' && 
                <>
                  <div><label className="text-xs text-slate-400">Faktura email</label>{isEditing ? <Input type="email" value={editableData.e_post_faktura} onChange={e => handleFieldChange('e_post_faktura', e.target.value)} /> : <p className="text-sm text-white">{editableData.e_post_faktura || editableData.e_post_kontaktperson || <span className="text-slate-500 italic">Ej angivet</span>}</p>}</div>
                  <div><label className="text-xs text-slate-400">Fakturamärkning</label>{isEditing ? <Input value={editableData.markning_faktura} onChange={e => handleFieldChange('markning_faktura', e.target.value)} /> : <p className="text-sm text-white">{editableData.markning_faktura || <span className="text-slate-500 italic">Ingen märkning</span>}</p>}</div>
                </>
              }
              <div><label className="text-xs text-slate-400">Att fakturera</label><p className="text-xl font-bold text-white">{formatCurrency(case_.pris)}</p></div>
              <div><label className="text-xs text-slate-400">{case_.type === 'business' ? 'Inkl. moms (25%)' : 'Totalt'}</label><p className="text-xl font-bold text-green-400">{formatCurrency(case_.type === 'business' ? case_.pris * 1.25 : case_.pris)}</p></div>
            </div>
          </div>

          {/* Beskrivning & Rapport - Återställda */}
          {case_.description && <div className="border-t border-slate-700/50 pt-4"><h3 className="text-base font-medium text-slate-300 mb-2">Beskrivning</h3><p className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg">{case_.description}</p></div>}
          
          {case_.rapport && <div className="border-t border-slate-700/50 pt-4"><button onClick={() => setReportExpanded(!reportExpanded)} className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg"><h3 className="text-base font-medium text-slate-300">Tekniker-rapport</h3><ChevronDown className={`w-4 h-4 transition-transform ${reportExpanded ? 'rotate-180' : ''}`} /></button>{reportExpanded && <div className="mt-2 p-4 bg-slate-800 rounded-lg"><p className="text-sm text-slate-200 whitespace-pre-wrap">{case_.rapport}</p></div>}</div>}

          <CaseBillingHistory caseId={case_.id} caseNumber={case_.case_number || 'Okänt ärende'} />
        </div>
      </div>
    </div>
  );
};
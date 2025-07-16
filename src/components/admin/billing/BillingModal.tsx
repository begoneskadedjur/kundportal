// 📁 src/components/admin/billing/BillingModal.tsx - KORREKT OCH ICKE-DUPLICERAD
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
import type { BillingCase } from '../../../types/billing';

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

// Svenska statusar
const STATUS_TRANSLATIONS = {
  'pending': 'Väntar på fakturering',
  'sent': 'Skickad',
  'paid': 'Betald',
  'skip': 'Ej faktureras'
};

const STATUS_COLORS = {
  'pending': 'text-yellow-400',
  'sent': 'text-blue-400',
  'paid': 'text-green-400',
  'skip': 'text-gray-400'
};

// Historik-sektion komponent
const CaseBillingHistory: React.FC<{ caseId: string; caseNumber: string }> = ({ caseId, caseNumber }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState<BillingAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && caseId) {
      fetchHistory();
    }
  }, [isExpanded, caseId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billing_audit_log')
        .select('*')
        .eq('case_id', caseId)
        .order('changed_at', { ascending: false });

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
    
    return (
      <span className="text-white">
        <span className={oldColor}>{oldLabel}</span>
        <ChevronRight className="inline w-4 h-4 mx-1 text-slate-400" />
        <span className={newColor}>{newLabel}</span>
      </span>
    );
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="border-t border-slate-700 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <History className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-white">Faktureringhistorik</h4>
            <p className="text-xs text-slate-400">
              {history.length > 0 ? `${history.length} ändringar` : 'Klicka för att visa historik'}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ingen faktureringhistorik tillgänglig</p>
              <p className="text-xs mt-1">Detta ärende har inte haft några statusändringar än</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {history.map((entry, index) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white mb-1">
                          Status ändrad
                        </div>
                        <div className="text-sm mb-2">
                          {getStatusTransition(entry.old_value, entry.new_value)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            <span>{entry.changed_by.split('@')[0]}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDateTime(entry.changed_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-500 flex-shrink-0">
                        #{history.length - index}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Huvudkomponent
export const BillingModal: React.FC<BillingModalProps> = ({ 
  case_, 
  isOpen, 
  onClose, 
  onCaseUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCase, setEditedCase] = useState<BillingCase | null>(null);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (case_) {
      setEditedCase({ ...case_ });
      setIsEditing(false); // Återställ redigeringsläge när ett nytt case väljs
    }
  }, [case_]);

  if (!isOpen || !case_) return null;

  const formatAddress = (address: any) => {
    if (!address) return 'Ingen adress angiven';
    
    if (typeof address === 'string') {
      try {
        const parsed = JSON.parse(address);
        return parsed.formatted_address || address;
      } catch (e) { return address; }
    }
    
    if (typeof address === 'object' && address.formatted_address) {
      return address.formatted_address;
    }
    
    return 'Okänt adressformat';
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_TRANSLATIONS[status as keyof typeof STATUS_TRANSLATIONS] 
      ? { label: STATUS_TRANSLATIONS[status as keyof typeof STATUS_TRANSLATIONS], color: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }
      : { label: status, color: 'bg-slate-500/20 text-slate-400' };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const calculateTotal = () => {
    if (!case_.pris) return 0;
    return case_.type === 'private' ? case_.pris : case_.pris * 1.25;
  };

  const handleSave = async () => {
    if (!editedCase) return;

    setSaving(true);
    try {
      const table = case_.type === 'private' ? 'private_cases' : 'business_cases';
      const { data, error } = await supabase
        .from(table)
        .update({
          kontaktperson: editedCase.kontaktperson,
          telefon_kontaktperson: editedCase.telefon_kontaktperson,
          e_post_kontaktperson: editedCase.e_post_kontaktperson,
          // Se till att du har en 'updated_at' kolumn med defaultvärde i din tabell
        })
        .eq('id', case_.id)
        .select()
        .single();

      if (error) throw error;

      onCaseUpdate(data);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving case:', err);
      // Här kan du lägga till ett felmeddelande till användaren
    } finally {
      setSaving(false);
    }
  };

  const renderContactInfo = () => {
    const isBusinessCase = case_.type === 'business';
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kontaktinformation */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              Kontaktinformation
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs"
            >
              {isEditing ? (
                <><X className="w-3 h-3 mr-1" /> Avbryt</>
              ) : (
                <><Edit className="w-3 h-3 mr-1" /> Redigera</>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {/* Fält för kontaktperson, telefon, email etc. */}
            <div>
              <label className="text-xs text-slate-400">Kontaktperson</label>
              {isEditing ? (
                <input type="text" value={editedCase?.kontaktperson || ''} onChange={(e) => setEditedCase(prev => prev ? { ...prev, kontaktperson: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
              ) : ( <p className="text-sm text-white">{case_.kontaktperson || 'Ej angiven'}</p> )}
            </div>
            
            {isBusinessCase && <div><label className="text-xs text-slate-400">Beställare</label><p className="text-sm text-white">{(case_ as any).bestallare || 'Samma som kontakt'}</p></div>}
            
            <div>
              <label className="text-xs text-slate-400">Telefon</label>
              {isEditing ? (
                <input type="text" value={editedCase?.telefon_kontaktperson || ''} onChange={(e) => setEditedCase(prev => prev ? { ...prev, telefon_kontaktperson: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
              ) : ( <p className="text-sm text-white flex items-center gap-2"><Phone className="w-3 h-3" />{case_.telefon_kontaktperson || 'Ej angiven'}</p> )}
            </div>
            
            <div>
              <label className="text-xs text-slate-400">Email</label>
              {isEditing ? (
                <input type="email" value={editedCase?.e_post_kontaktperson || ''} onChange={(e) => setEditedCase(prev => prev ? { ...prev, e_post_kontaktperson: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
              ) : ( <p className="text-sm text-white flex items-center gap-2"><Mail className="w-3 h-3" />{case_.e_post_kontaktperson || 'Ej angiven'}</p> )}
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm" className="flex items-center gap-2">
                  {saving ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {saving ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Adress & Identifiering */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Adress & Identifiering
          </h3>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-400">Adress</label><p className="text-sm text-white">{formatAddress(case_.adress)}</p></div>
            <div><label className="text-xs text-slate-400">{isBusinessCase ? 'Org.nummer' : 'Personnummer'}</label><p className="text-sm text-white">{isBusinessCase ? ((case_ as any).org_nr || 'Ej angivet') : ((case_ as any).personnummer || 'Ej angivet')}</p></div>
          </div>
        </div>
      </div>
    );
  };

  const renderBillingInfo = () => {
    const isBusinessCase = case_.type === 'business';
    
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
        <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Faktureringsinformation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs text-slate-400">Faktura email</label><p className="text-sm text-white">{isBusinessCase ? ((case_ as any).e_post_faktura || case_.e_post_kontaktperson || 'Ej angiven') : (case_.e_post_kontaktperson || 'Ej angiven')}</p></div>
          {isBusinessCase && <div><label className="text-xs text-slate-400">Fakturamärkning</label><p className="text-sm text-white">{(case_ as any).markning_faktura || 'Ingen märkning'}</p></div>}
          <div><label className="text-xs text-slate-400">Att fakturera</label><p className="text-xl font-bold text-white">{formatCurrency(case_.pris || 0)}</p></div>
          <div><label className="text-xs text-slate-400">{isBusinessCase ? 'Inkl. moms (25%)' : 'Totalt (ROT-avdrag ej applicerat)'}</label><p className="text-xl font-bold text-green-400">{formatCurrency(calculateTotal())}</p></div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                {case_.type === 'private' ? <User className="w-5 h-5 text-purple-400" /> : <Building2 className="w-5 h-5 text-blue-400" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{case_.case_number || 'Okänt ärendenummer'}</h2>
                <p className="text-sm text-slate-400">{case_.type === 'private' ? 'Privatperson' : 'Företag'} • {case_.skadedjur}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(case_.billing_status)}
              <Button variant="secondary" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderContactInfo()}
          {renderBillingInfo()}
          
          {case_.description && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Beskrivning</h3>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-300">{case_.description}</p>
              </div>
            </div>
          )}

          {case_.rapport && (
            <div>
              <button onClick={() => setReportExpanded(!reportExpanded)} className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors mb-3">
                <h3 className="text-sm font-medium text-slate-300">Tekniker-rapport</h3>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${reportExpanded ? 'rotate-180' : ''}`} />
              </button>
              {reportExpanded && <div className="p-4 bg-slate-800/30 rounded-lg"><p className="text-sm text-slate-300 whitespace-pre-wrap">{case_.rapport}</p></div>}
            </div>
          )}

          <CaseBillingHistory 
            caseId={case_.id} 
            caseNumber={case_.case_number || case_.title || 'Okänt ärende'} 
          />
        </div>
      </div>
    </div>
  );
};
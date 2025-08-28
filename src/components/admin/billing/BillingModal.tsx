// 📁 src/components/admin/billing/BillingModal.tsx - REN VERSION UTAN DUPLICERING
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../utils/formatters';
import {
  X, User, Building2, ChevronDown, History, Clock, UserIcon, ChevronRight,
  Edit, Save, RotateCcw, Calculator, FileText
} from 'lucide-react';

import Button from '../../ui/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { EditableBillingFields } from './EditableBillingFields';
import type { BillingCase, EditableFields } from '../../../types/billing';

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

// --- Underkomponenter ---

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

  useEffect(() => { 
    if (isExpanded && caseId) fetchHistory() 
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
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="border-t border-slate-700/50 pt-6">
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <History className="w-4 h-4 text-blue-400" />
          <div className="text-left">
            <span className="text-sm font-medium text-white">Faktureringhistorik</span>
            <p className="text-xs text-slate-400">
              {history.length > 0 ? `${history.length} ändringar` : 'Klicka för att visa'}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ingen historik tillgänglig</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {history.map((entry, index) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm mb-1">
                      {getStatusTransition(entry.old_value, entry.new_value)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{entry.changed_by.split('@')[0]}</span>
                      <span>{formatDateTime(entry.changed_at)}</span>
                      <span className="text-slate-500">#{index + 1}</span>
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
      setIsEditing(false);
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
      
      // Filtrera bort fält som inte finns i tabellen
      const updateData: any = {};
      
      // Gemensamma fält för båda tabellerna
      const commonFields = [
        'kontaktperson', 
        'telefon_kontaktperson', 
        'e_post_kontaktperson'
      ];
      
      // Lägg till gemensamma fält
      commonFields.forEach(field => {
        if (editableData[field as keyof EditableFields] !== undefined) {
          updateData[field] = editableData[field as keyof EditableFields];
        }
      });
      
      // Lägg till tabellspecifika fält
      if (case_.type === 'private') {
        // Fält som bara finns i private_cases
        if (editableData.personnummer !== undefined) {
          updateData.personnummer = editableData.personnummer;
        }
        if (editableData.r_fastighetsbeteckning !== undefined) {
          updateData.r_fastighetsbeteckning = editableData.r_fastighetsbeteckning;
        }
      } else {
        // Fält som bara finns i business_cases
        if (editableData.bestallare !== undefined) {
          updateData.bestallare = editableData.bestallare;
        }
        if (editableData.org_nr !== undefined) {
          updateData.org_nr = editableData.org_nr;
        }
        if (editableData.e_post_faktura !== undefined) {
          updateData.e_post_faktura = editableData.e_post_faktura;
        }
        if (editableData.markning_faktura !== undefined) {
          updateData.markning_faktura = editableData.markning_faktura;
        }
      }
      
      // Lägg till updated_at timestamp
      updateData.updated_at = new Date().toISOString();
      
      console.log('Updating table:', table);
      console.log('Update data:', updateData);
      
      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', case_.id)
        .select()
        .single();
      
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
    if (case_) {
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
    }
    setIsEditing(false);
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Adress saknas';
    try {
      const parsed = typeof address === 'string' ? JSON.parse(address) : address;
      return parsed.formatted_address || 'Okänt adressformat';
    } catch { 
      return address; 
    }
  };
  
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pending': { label: 'Väntar på fakturering', color: 'bg-yellow-500/20 text-yellow-400' },
      'sent': { label: 'Skickad', color: 'bg-blue-500/20 text-blue-400' },
      'paid': { label: 'Betald', color: 'bg-green-500/20 text-green-400' },
      'skip': { label: 'Ej faktureras', color: 'bg-gray-500/20 text-gray-400' }
    };
    
    const config = statusMap[status as keyof typeof statusMap] || { 
      label: status, 
      color: 'bg-slate-500/20 text-slate-400' 
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Förbättrad prisberäkning
  const renderPricingInfo = () => {
    const inputPrice = case_.pris || 0;
    const isBusinessCase = case_.type === 'business';
    
    // För business cases: inputPrice är exkl. moms, moms (25%) tillkommer utöver
    // För private cases: inputPrice visas som inkl. moms (oförändrat)
    const basePrice = inputPrice; // För business: exkl. moms, För private: inkl. moms
    const vatAmount = isBusinessCase ? basePrice * 0.25 : 0;
    const totalPrice = basePrice + vatAmount;

    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Summa att fakturera
        </h3>
        
        <div className="bg-slate-800/50 rounded-lg p-4">
          {isBusinessCase ? (
            // Business case: Visa exkl. moms + moms + totalt
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Summa exkl. moms</span>
                <span className="text-xl font-semibold text-white font-mono">
                  {formatCurrency(basePrice)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Moms (25%)</span>
                <span className="text-lg font-medium text-slate-300 font-mono">
                  {formatCurrency(vatAmount)}
                </span>
              </div>
              
              <div className="border-t border-slate-600/50"></div>
              
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold text-lg">Totalt inkl. moms</span>
                <span className="text-2xl font-bold text-green-400 font-mono">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          ) : (
            // Private case: Visa bara totalt inkl. moms
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold text-lg">Totalt inkl. moms</span>
              <span className="text-2xl font-bold text-green-400 font-mono">
                {formatCurrency(basePrice)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'
            }`}>
              {case_.type === 'private' ? 
                <User className="w-5 h-5 text-purple-400" /> : 
                <Building2 className="w-5 h-5 text-blue-400" />
              }
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{case_.case_number}</h2>
              <p className="text-sm text-slate-400">
                {case_.type === 'private' ? 'Privatperson' : 'Företag'} • {case_.skadedjur}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getStatusBadge(case_.billing_status)}
            
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button onClick={handleCancel} variant="secondary" size="sm">
                  <X className="w-4 h-4 mr-1" />
                  Avbryt
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="bg-green-600 hover:bg-green-700">
                  {saving ? (
                    <RotateCcw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  {saving ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm">
                <Edit className="w-4 h-4 mr-1" />
                Redigera
              </Button>
            )}
            
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Ärendeinformation */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Ärendeinformation
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/30 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Ärendenummer</p>
                <p className="text-white font-medium">{case_.case_number || 'Ej angivet'}</p>
              </div>
              
              {case_.avslutad_datum && (
                <div className="bg-slate-800/30 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Avslutad datum</p>
                  <p className="text-white font-medium">
                    {new Date(case_.avslutad_datum).toLocaleDateString('sv-SE')}
                  </p>
                </div>
              )}
              
              {case_.tekniker && (
                <div className="bg-slate-800/30 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Tekniker</p>
                  <p className="text-white font-medium">{case_.tekniker}</p>
                </div>
              )}
              
              {case_.skadedjur && (
                <div className="bg-slate-800/30 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Skadedjur</p>
                  <p className="text-white font-medium">{case_.skadedjur}</p>
                </div>
              )}
            </div>
          </div>

          {/* Använd din befintliga EditableBillingFields komponent */}
          <EditableBillingFields
            case_={case_}
            isEditing={isEditing}
            onFieldChange={handleFieldChange}
            editableFields={editableData}
            formattedAddress={formatAddress(case_.adress)}
          />
          
          {/* Förbättrad prisvisning */}
          {renderPricingInfo()}

          {/* Beskrivning */}
          {case_.description && (
            <div className="border-t border-slate-700/50 pt-6">
              <h3 className="text-lg font-semibold text-slate-300 mb-3">Beskrivning</h3>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-300 leading-relaxed">{case_.description}</p>
              </div>
            </div>
          )}
          
          {/* Arbetsrapport */}
          {case_.rapport && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Arbetsrapport
              </h3>
              
              <div className="bg-slate-800/30 rounded-lg p-4">
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{case_.rapport}</p>
              </div>
            </div>
          )}

          {/* Faktureringhistorik */}
          <CaseBillingHistory caseId={case_.id} caseNumber={case_.case_number || 'Okänt ärende'} />
        </div>
      </div>
    </div>
  );
};
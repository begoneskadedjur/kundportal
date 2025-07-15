// 📁 src/components/admin/billing/BillingModal.tsx - KOMPAKT DESIGN
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, User, Building2, FileText, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { EditableBillingFields } from './EditableBillingFields';
import { BillingActions } from './BillingActions';
import type { BillingCase, EditableFields } from '../../../types/billing';

interface Props {
  case_: BillingCase | null;
  isOpen: boolean;
  onClose: () => void;
  onCaseUpdate: (updatedCase: BillingCase) => void;
}

const formatAddressLocal = (address: any): string => {
    if (!address) return 'Adress saknas';
    if (typeof address === 'string') {
        try {
            if (!address.startsWith('{') || !address.includes('formatted_address')) return address;
            const parsed = JSON.parse(address);
            return parsed.formatted_address || address;
        } catch { return address; }
    }
    if (typeof address === 'object' && address !== null) {
        if (address.formatted_address) return address.formatted_address;
        const parts = [address.street, address.postalCode, address.city].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
    }
    return 'Okänt adressformat';
};

export const BillingModal: React.FC<Props> = ({ case_, isOpen, onClose, onCaseUpdate }) => {
  const [showDescription, setShowDescription] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const [editableFields, setEditableFields] = useState<EditableFields>({
    kontaktperson: '', telefon_kontaktperson: '', e_post_kontaktperson: '', markning_faktura: '',
    e_post_faktura: '', bestallare: '', org_nr: '', personnummer: '', r_fastighetsbeteckning: ''
  });

  useEffect(() => {
    if (case_) {
      setEditableFields({
        kontaktperson: case_.kontaktperson || '', telefon_kontaktperson: case_.telefon_kontaktperson || '', e_post_kontaktperson: case_.e_post_kontaktperson || '',
        markning_faktura: case_.markning_faktura || '', e_post_faktura: case_.e_post_faktura || '', bestallare: case_.bestallare || '', org_nr: case_.org_nr || '',
        personnummer: case_.personnummer || '', r_fastighetsbeteckning: case_.r_fastighetsbeteckning || ''
      });
      setIsEditing(false);
      setSaveError(null);
    }
  }, [case_]);

  if (!isOpen || !case_) return null;

  const getBillingStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'Väntar på fakturering', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
      case 'sent': return { label: 'Faktura skickad', color: 'text-blue-400', bg: 'bg-blue-500/10' };
      case 'paid': return { label: 'Faktura betald', color: 'text-green-400', bg: 'bg-green-500/10' };
      case 'skip': return { label: 'Ska ej faktureras', color: 'text-gray-400', bg: 'bg-gray-500/10' };
      default: return { label: 'Okänd status', color: 'text-slate-400', bg: 'bg-slate-500/10' };
    }
  };

  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!case_) return [];
    if (case_.type === 'business') {
      if (!editableFields.kontaktperson) missing.push('Kontaktperson'); if (!editableFields.telefon_kontaktperson) missing.push('Telefon');
      if (!editableFields.e_post_kontaktperson) missing.push('Email'); if (!editableFields.e_post_faktura) missing.push('Faktura email');
      if (!editableFields.org_nr) missing.push('Org.nr'); if (!editableFields.bestallare) missing.push('Beställare');
    } else {
      if (!editableFields.kontaktperson) missing.push('Kontaktperson'); if (!editableFields.telefon_kontaktperson) missing.push('Telefon');
      if (!editableFields.e_post_kontaktperson) missing.push('Email');
    }
    return missing;
  };

  const handleSave = async () => {
    if (!case_) return;
    setIsSaving(true); setSaveError(null);
    
    try {
      const table = case_.type === 'private' ? 'private_cases' : 'business_cases';
      const updateData: Partial<EditableFields> = {
        kontaktperson: editableFields.kontaktperson.trim() || null,
        telefon_kontaktperson: editableFields.telefon_kontaktperson.trim() || null,
        e_post_kontaktperson: editableFields.e_post_kontaktperson.trim() || null,
      };

      if (case_.type === 'business') {
        updateData.markning_faktura = editableFields.markning_faktura.trim() || null;
        updateData.e_post_faktura = editableFields.e_post_faktura.trim() || null;
        updateData.bestallare = editableFields.bestallare.trim() || null;
        updateData.org_nr = editableFields.org_nr.trim() || null;
      } else {
        updateData.personnummer = editableFields.personnummer.trim() || null;
        updateData.r_fastighetsbeteckning = editableFields.r_fastighetsbeteckning.trim() || null;
      }
      
      const commonFields = 'id, case_number, title, pris, completed_date, primary_assignee_name, skadedjur, adress, description, rapport, kontaktperson, e_post_kontaktperson, telefon_kontaktperson, billing_status, billing_updated_at';
      const selectString = case_.type === 'private'
        ? `${commonFields}, personnummer, r_fastighetsbeteckning`
        : `${commonFields}, markning_faktura, e_post_faktura, bestallare, org_nr`;

      const { data, error } = await supabase.from(table).update(updateData).eq('id', case_.id).select(selectString).single();

      if (error) throw error;
      
      const updatedCaseWithType = { ...data, type: case_.type };
      onCaseUpdate(updatedCaseWithType as BillingCase);
      setIsEditing(false);

    } catch (err) {
      console.error('❌ handleSave error:', err);
      setSaveError(err instanceof Error ? err.message : 'Ett okänt fel uppstod.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: keyof EditableFields, value: string) => {
    setEditableFields(prev => ({ ...prev, [field]: value }));
  };
  
  const isBusiness = case_.type === 'business';
  const vatAmount = isBusiness ? case_.pris * 0.25 : 0;
  const totalAmount = case_.pris + vatAmount;
  const statusInfo = getBillingStatusInfo(case_.billing_status);
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 🎯 KOMPAKT HEADER med integrerad statusinfo */}
        <header className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isBusiness ? 'bg-blue-500/20' : 'bg-purple-500/20'}`}>
                        {isBusiness ? <Building2 className="w-5 h-5 text-blue-400" /> : <User className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">{case_.case_number || case_.title}</h2>
                        <p className="text-sm text-slate-400">
                          {isBusiness ? 'Företag' : 'Privatperson'} • {case_.skadedjur}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <BillingActions isEditing={isEditing} isSaving={isSaving} missingFieldsCount={getMissingFields().length} onStartEdit={() => setIsEditing(true)} onSave={handleSave} onCancel={() => setIsEditing(false)} />
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
            </div>
            
            {/* 💰 INLINE STATUS & PRICING CARD */}
            <div className={`flex items-center justify-between p-4 rounded-lg border ${statusInfo.bg} border-slate-700`}>
                <div className="flex items-center gap-4">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Status</p>
                        <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Tekniker</p>
                        <p className="text-sm text-white">{case_.primary_assignee_name}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">Att fakturera</p>
                    {isBusiness && (
                      <div className="text-xs text-slate-400">
                        {formatCurrency(case_.pris)} + {formatCurrency(vatAmount)} moms
                      </div>
                    )}
                    <p className="text-xl font-bold text-green-400">{formatCurrency(totalAmount)}</p>
                </div>
            </div>
        </header>

        <div className="p-6 space-y-6 overflow-y-auto">
            {saveError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400" /><span className="text-sm text-red-400">{saveError}</span></div>}
            
            {/* 📋 REDIGERBARA FÄLT med adress integrerad */}
            <EditableBillingFields 
              case_={case_} 
              isEditing={isEditing} 
              onFieldChange={handleFieldChange} 
              editableFields={editableFields}
              formattedAddress={formatAddressLocal(case_.adress)}
            />
            
            {/* 📝 BESKRIVNING & RAPPORT - Collapsible */}
            {case_.description && (
                <div className="space-y-2">
                    <button onClick={() => setShowDescription(!showDescription)} className="flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors"><FileText className="w-5 h-5" /> Beskrivning {showDescription ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                    {showDescription && <div className="bg-slate-800/50 rounded-lg p-4"><p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{case_.description}</p></div>}
                </div>
            )}
            
            {case_.rapport && (
                <div className="space-y-2">
                    <button onClick={() => setShowReport(!showReport)} className="flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors"><FileText className="w-5 h-5" /> Tekniker-rapport {showReport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                    {showReport && <div className="bg-slate-800/50 rounded-lg p-4"><p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{case_.rapport}</p></div>}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
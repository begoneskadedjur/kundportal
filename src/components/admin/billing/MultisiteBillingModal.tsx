// MultisiteBillingModal.tsx - Dedikerat kort för multi-site fakturering
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../utils/formatters';
import {
  X, Building2, MapPin, User, Mail, Phone, FileText, 
  CreditCard, Home, Hash, Calendar, ChevronDown, ChevronRight,
  History, Clock, UserIcon, Edit, Save, RotateCcw
} from 'lucide-react';

import Button from '../../ui/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { CompactFieldDisplay } from './CompactFieldDisplay';
import type { BillingCase } from '../../../types/billing';

interface MultisiteBillingModalProps {
  case_: any;
  isOpen: boolean;
  onClose: () => void;
  onCaseUpdate: (updatedCase: any) => void;
}

interface BillingAuditEntry {
  id: string;
  case_id: string;
  case_type: string;
  action: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
  metadata?: any;
}

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

// Historik-komponent
const CaseBillingHistory: React.FC<{ caseId: string; caseNumber: string }> = ({ caseId, caseNumber }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState<BillingAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && caseId) fetchHistory();
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
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          <span className="text-white font-medium">Faktureringshistorik</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <LoadingSpinner />
          ) : history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.id} className="bg-slate-900/50 p-3 rounded-lg">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {formatDateTime(entry.changed_at)}
                    </span>
                  </div>
                </div>
                <div className="ml-6">
                  {entry.action === 'status_change' && (
                    <div className="text-sm">
                      {getStatusTransition(entry.old_value, entry.new_value)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <UserIcon className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">{entry.changed_by}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Ingen historik tillgänglig</p>
          )}
        </div>
      )}
    </div>
  );
};

export const MultisiteBillingModal: React.FC<MultisiteBillingModalProps> = ({
  case_,
  isOpen,
  onClose,
  onCaseUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<'consolidated' | 'per_site'>('consolidated');
  const [organizationData, setOrganizationData] = useState<any>(null);

  useEffect(() => {
    if (case_?.customer?.organization_id) {
      fetchOrganizationData();
    }
  }, [case_]);

  const fetchOrganizationData = async () => {
    if (!case_?.customer?.organization_id) return;

    setLoading(true);
    try {
      // Hämta huvudkontor för att få billing_type
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', case_.customer.organization_id)
        .eq('site_type', 'huvudkontor')
        .single();

      if (error) throw error;
      
      setOrganizationData(data);
      setBillingType(data?.billing_type || 'consolidated');
    } catch (err) {
      console.error('Error fetching organization data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !case_) return null;

  const isConsolidated = billingType === 'consolidated';
  const isMainOffice = case_.customer?.site_type === 'huvudkontor';
  const isUnit = case_.customer?.site_type === 'enhet';

  // Bestäm vilken faktureringsinformation som ska visas
  const billingInfo = isConsolidated ? organizationData : case_.customer;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                {case_.case_number || case_.title}
                <span className="text-sm px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                  Multi-site
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {case_.customer?.company_name || 'Okänd organisation'}
                {isUnit && case_.customer?.site_name && (
                  <span className="ml-2">• {case_.customer.site_name}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* Faktureringstyp info */}
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-medium text-white">Faktureringstyp</h3>
                </div>
                <p className="text-sm text-slate-300">
                  {isConsolidated ? (
                    <span className="text-blue-400">Konsoliderad fakturering - Faktureras till huvudkontor</span>
                  ) : (
                    <span className="text-green-400">Fakturering per anläggning - Faktureras direkt till enheten</span>
                  )}
                </p>
              </div>

              {/* Organisationsuppgifter */}
              {isConsolidated && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Home className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-medium text-white">Huvudkontor - Faktureringsuppgifter</h3>
                  </div>
                  
                  <CompactFieldDisplay 
                    columns={1}
                    fields={[
                      { label: 'Organisationsnamn', value: organizationData?.company_name },
                      { label: 'Organisationsnummer', value: organizationData?.organization_number },
                      { label: 'Faktura-email', value: organizationData?.billing_email || organizationData?.contact_email },
                      { label: 'Telefon', value: organizationData?.contact_phone },
                      { label: 'Faktureringsadress', value: organizationData?.billing_address || organizationData?.contact_address }
                    ]}
                  />
                </div>
              )}

              {/* Enhetsuppgifter */}
              {(!isConsolidated || isUnit) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-medium text-white">
                      {!isConsolidated ? 'Enhet - Faktureringsuppgifter' : 'Enhetsuppgifter'}
                    </h3>
                  </div>
                  
                  <CompactFieldDisplay 
                    columns={1}
                    fields={[
                      { label: 'Enhetsnamn', value: case_.customer?.site_name || case_.customer?.company_name },
                      { label: 'Enhetskod', value: case_.customer?.site_code || 'Ej angiven' },
                      ...(case_.customer?.region ? [{ label: 'Region', value: case_.customer.region }] : []),
                      ...(!isConsolidated ? [
                        { label: 'Kontaktperson', value: case_.contact_person || case_.customer?.contact_person },
                        { label: 'Kontakt-email', value: case_.contact_email || case_.customer?.contact_email },
                        { label: 'Telefon', value: case_.contact_phone || case_.customer?.contact_phone },
                        { label: 'Faktura-email', value: case_.customer?.billing_email || case_.customer?.contact_email || case_.contact_email },
                        { label: 'Faktureringsadress', value: case_.customer?.billing_address || case_.customer?.contact_address || 'Ingen adress angiven' }
                      ] : [])
                    ]}
                  />
                </div>
              )}

              {/* Ärendeinformation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-medium text-white">Ärendeinformation</h3>
                </div>
                
                <CompactFieldDisplay 
                  columns={1}
                  fields={[
                    { label: 'Ärendenummer', value: case_.case_number },
                    { 
                      label: 'Avslutad datum', 
                      value: case_.completed_date ? new Date(case_.completed_date).toLocaleDateString('sv-SE') : 'Ej avslutat'
                    },
                    { label: 'Tekniker', value: case_.primary_technician_name || case_.primary_assignee_name },
                    { label: 'Skadedjur', value: case_.pest_type || case_.skadedjur }
                  ]}
                />
                
                {case_.description && (
                  <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400 mb-2">Beskrivning</p>
                    <p className="text-white">{case_.description}</p>
                  </div>
                )}
                
                {(case_.work_report || case_.rapport) && (
                  <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400 mb-2">Arbetsrapport</p>
                    <p className="text-white whitespace-pre-wrap">{case_.work_report || case_.rapport}</p>
                  </div>
                )}
              </div>

              {/* Summa att fakturera */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 p-6 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">Summa att fakturera</h3>
                    <p className="text-sm text-slate-400">
                      {isConsolidated ? 'Faktureras till huvudkontor' : 'Faktureras till enhet'}
                    </p>
                  </div>
                </div>
                
                {/* Kompakt momsuppdelning för multisite avtalsärenden */}
                <div className="space-y-3">
                  {/* Summa exkl. moms */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Summa exkl. moms</span>
                    <span className="text-xl font-semibold text-white font-mono">
                      {formatCurrency((case_.pris || case_.price || 0) / 1.25)}
                    </span>
                  </div>
                  
                  {/* Moms rad */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Moms (25%)</span>
                    <span className="text-lg font-medium text-slate-300 font-mono">
                      {formatCurrency((case_.pris || case_.price || 0) - (case_.pris || case_.price || 0) / 1.25)}
                    </span>
                  </div>
                  
                  {/* Separator linje */}
                  <div className="border-t border-slate-600/50"></div>
                  
                  {/* Totalt inkl. moms */}
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold text-lg">Totalt inkl. moms</span>
                    <span className="text-2xl font-bold text-green-400 font-mono">
                      {formatCurrency(case_.pris || case_.price || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Historik */}
              <CaseBillingHistory 
                caseId={case_.id} 
                caseNumber={case_.case_number || case_.title || 'Okänt'} 
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLORS[case_.billing_status as keyof typeof STATUS_COLORS]
            } bg-slate-800`}>
              {STATUS_TRANSLATIONS[case_.billing_status as keyof typeof STATUS_TRANSLATIONS]}
            </span>
          </div>
          <Button onClick={onClose} variant="secondary">
            Stäng
          </Button>
        </div>
      </div>
    </div>
  );
};
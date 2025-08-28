// ContractCustomerBillingModal.tsx - Dedicated modal for contract customer billing
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../utils/formatters';
import {
  X, Building2, User, Mail, Phone, FileText, 
  Calendar, Hash, ChevronDown, ChevronRight,
  History, Clock, UserIcon, MapPin, Home
} from 'lucide-react';

import Button from '../../ui/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { CompactFieldDisplay } from './CompactFieldDisplay';

interface ContractCustomerBillingModalProps {
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

// CONTRACT TYPE MAPPING - samma som i BillingManagement.tsx
const CONTRACT_TYPE_MAPPING: Record<string, string> = {
  '242dff01-ecf7-4de1-ab5f-7fad11cb8812': 'Skadedjursavtal',
  '21ed7bc7-e767-48e3-b981-4305b1ae7141': 'Betongstationer',
  '37eeca21-f8b3-45f7-810a-7f616f84e71e': 'Mekaniska råttfällor',
  '3d749768-63be-433f-936d-be070edf4876': 'Avrop - 2.490kr',
  'e3a610c9-15b9-42fe-8085-d0a7e17d4465': 'Betesstationer',
  'bc612355-b6ce-4ca8-82cd-4f82a8538b71': 'Avloppsfällor',
  '73c7c42b-a302-4da2-abf2-8d6080045bc8': 'Fågelavtal'
};

// Helper för att visa rätt contract type
const getContractTypeDisplay = (contractType: string | null | undefined): string => {
  if (!contractType) return 'Avtalskund';
  
  // Om det redan är läsbart (inte UUID)
  if (!contractType.includes('-')) {
    return contractType;
  }
  
  // Mappa UUID till läsbart namn
  return CONTRACT_TYPE_MAPPING[contractType] || 'Serviceavtal';
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

export const ContractCustomerBillingModal: React.FC<ContractCustomerBillingModalProps> = ({
  case_,
  isOpen,
  onClose,
  onCaseUpdate
}) => {
  if (!isOpen || !case_) return null;

  const customer = case_.customer;
  const contractType = getContractTypeDisplay(customer?.contract_type);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                {case_.case_number || case_.title}
                <span className="text-sm px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                  {contractType}
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {customer?.company_name || 'Okänd kund'}
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
          {/* Kunduppgifter */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium text-white">Kunduppgifter</h3>
            </div>
            
            <CompactFieldDisplay 
              columns={1}
              fields={[
                { label: 'Företag', value: customer?.company_name },
                { label: 'Organisationsnummer', value: customer?.organization_number },
                { label: 'Kontaktperson', value: case_.contact_person || customer?.contact_person },
                { label: 'Telefon', value: case_.contact_phone || customer?.contact_phone },
                { label: 'Email', value: case_.contact_email || customer?.contact_email },
                { label: 'Faktura-email', value: customer?.billing_email || customer?.contact_email }
              ]}
            />
          </div>

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
                { label: 'Tekniker', value: case_.primary_technician_name || case_.assigned_technician_name },
                { label: 'Skadedjur', value: case_.pest_type }
              ]}
            />
            
            {case_.description && (
              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Beskrivning</p>
                <p className="text-white">{case_.description}</p>
              </div>
            )}
            
            {case_.work_report && (
              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Arbetsrapport</p>
                <p className="text-white whitespace-pre-wrap">{case_.work_report}</p>
              </div>
            )}
          </div>

          {/* Summa att fakturera */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">Summa att fakturera</h3>
                <p className="text-sm text-slate-400">
                  Faktureras till {customer?.company_name || 'kund'}
                </p>
              </div>
            </div>
            
            {/* Kompakt momsuppdelning */}
            <div className="space-y-3">
              {/* Summa exkl. moms */}
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Summa exkl. moms</span>
                <span className="text-xl font-semibold text-white font-mono">
                  {formatCurrency((case_.price || 0) / 1.25)}
                </span>
              </div>
              
              {/* Moms rad */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Moms (25%)</span>
                <span className="text-lg font-medium text-slate-300 font-mono">
                  {formatCurrency((case_.price || 0) - (case_.price || 0) / 1.25)}
                </span>
              </div>
              
              {/* Separator linje */}
              <div className="border-t border-slate-600/50"></div>
              
              {/* Totalt inkl. moms */}
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-lg">Totalt inkl. moms</span>
                <span className="text-2xl font-bold text-green-400 font-mono">
                  {formatCurrency(case_.price || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Historik */}
          <CaseBillingHistory 
            caseId={case_.id} 
            caseNumber={case_.case_number || case_.title || 'Okänt'} 
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLORS[case_.billing_status as keyof typeof STATUS_COLORS] || 'text-slate-400'
            } bg-slate-800`}>
              {STATUS_TRANSLATIONS[case_.billing_status as keyof typeof STATUS_TRANSLATIONS] || 'Okänd status'}
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
import React from 'react';
import Modal from '../ui/Modal';
import { Users, DollarSign, FileText, Wrench, Building2, User, TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import Button from '../ui/Button';

interface Customer {
  id: string;
  name: string;
  annual_premium: number;
  is_active: boolean;
  customer_type: string;
}

interface TechnicianInfo {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

interface CaseInfo {
  id: string;
  title?: string;
  price?: number;
  pris?: number;
  case_type?: string;
  customer_name?: string;
  primary_assignee_name?: string;
  created_at?: string;
  completed_date?: string;
}

interface AdminKpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  kpiType: 'customers' | 'revenue' | 'cases' | 'technicians';
  data?: {
    customers?: Customer[];
    technicians?: TechnicianInfo[];
    cases?: CaseInfo[];
    revenue?: {
      total: number;
      breakdown: {
        contracts: number;
        privateCases: number;
        businessCases: number;
        legacyCases: number;
      };
    };
  };
}

export default function AdminKpiModal({ isOpen, onClose, title, kpiType, data }: AdminKpiModalProps) {
  const renderContent = () => {
    switch (kpiType) {
      case 'customers':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Aktiva Avtalskunder</h3>
              <span className="text-sm text-slate-400">{data?.customers?.length || 0} kunder</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data?.customers?.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg mb-2">
                  <div>
                    <p className="font-medium text-white">{customer.name}</p>
                    <p className="text-sm text-slate-400">
                      {customer.customer_type === 'company' ? <Building2 className="inline w-3 h-3 mr-1" /> : <User className="inline w-3 h-3 mr-1" />}
                      {customer.customer_type}
                    </p>
                  </div>
                  <p className="text-green-400 font-medium">{formatCurrency(customer.annual_premium || 0)}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'revenue':
        return (
          <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold text-white mb-4">Total Intäkt</h3>
              <p className="text-4xl font-bold text-green-400">{formatCurrency(data?.revenue?.total || 0)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/30 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <p className="text-sm text-slate-400">Avtal</p>
                </div>
                <p className="text-xl font-semibold text-white">{formatCurrency(data?.revenue?.breakdown?.contracts || 0)}</p>
              </div>
              
              <div className="bg-slate-800/30 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <p className="text-sm text-slate-400">Privatärenden</p>
                </div>
                <p className="text-xl font-semibold text-white">{formatCurrency(data?.revenue?.breakdown?.privateCases || 0)}</p>
              </div>
              
              <div className="bg-slate-800/30 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-orange-400" />
                  <p className="text-sm text-slate-400">Företagsärenden</p>
                </div>
                <p className="text-xl font-semibold text-white">{formatCurrency(data?.revenue?.breakdown?.businessCases || 0)}</p>
              </div>
              
              <div className="bg-slate-800/30 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-yellow-400" />
                  <p className="text-sm text-slate-400">Legacy-ärenden</p>
                </div>
                <p className="text-xl font-semibold text-white">{formatCurrency(data?.revenue?.breakdown?.legacyCases || 0)}</p>
              </div>
            </div>
          </div>
        );

      case 'cases':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">BeGone Ärenden</h3>
              <span className="text-sm text-slate-400">{data?.cases?.length || 0} ärenden</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data?.cases?.map((caseItem) => (
                <div key={caseItem.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-white">{caseItem.title || 'Inget namn'}</p>
                    <p className="text-sm text-slate-400">
                      {caseItem.primary_assignee_name || 'Ej tilldelad'} • {caseItem.customer_name || 'Okänd kund'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">{formatCurrency((caseItem.price || caseItem.pris || 0))}</p>
                    <p className="text-xs text-slate-500">
                      {caseItem.completed_date ? new Date(caseItem.completed_date).toLocaleDateString('sv-SE') : 'Pågående'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'technicians':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Aktiva Tekniker</h3>
              <span className="text-sm text-slate-400">{data?.technicians?.length || 0} tekniker</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {data?.technicians?.map((tech) => (
                <div key={tech.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{tech.name}</p>
                    <p className="text-sm text-slate-400">{tech.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="p-6">
        {renderContent()}
      </div>
      <div className="flex justify-end gap-3 p-6 border-t border-slate-800">
        <Button variant="secondary" onClick={onClose}>Stäng</Button>
      </div>
    </Modal>
  );
}
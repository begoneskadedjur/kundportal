// 📁 src/components/admin/coordinator/KpiCaseListModal.tsx
// ⭐ Modal för att visa ärendelistor från KPI-kort ⭐

import React, { useState } from 'react';
import { X, User, MapPin, AlertCircle, Calendar, DollarSign, Users, Building2, Clock, Wrench, CalendarDays, PieChart } from 'lucide-react';
import Modal from '../../ui/Modal';
import { BeGoneCaseRow, Technician } from '../../../types/database';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import EditCaseModal from '../technicians/EditCaseModal';

interface KpiCaseListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  cases: BeGoneCaseRow[];
  technicians?: Technician[];
  absences?: any[];
  kpiType: 'unplanned' | 'scheduled' | 'completed' | 'technicians';
}

const formatAddress = (address: any): string => {
  if (!address) return 'Adress saknas';
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      return parsed.formatted_address || address;
    } catch (e) { 
      return address; 
    }
  }
  return address.formatted_address || 'Adress saknas';
};

const getStatusColor = (status: string): string => {
  const ls = status?.toLowerCase() || '';
  if (ls.includes('avslutat')) return 'bg-green-500/20 text-green-400 border-green-500/40';
  if (ls.startsWith('återbesök')) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
  if (ls.includes('bokad') || ls.includes('bokat') || ls.includes('signerad')) return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
  if (ls.includes('öppen') || ls.includes('offert')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  if (ls.includes('review')) return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
  if (ls.includes('stängt')) return 'bg-slate-600/50 text-slate-400 border-slate-600/50';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
};

const getCaseTypeIcon = (caseType: string) => {
  if (caseType === 'private') return <User className="w-4 h-4 text-blue-400" />;
  if (caseType === 'business') return <Building2 className="w-4 h-4 text-green-400" />;
  return <Clock className="w-4 h-4 text-purple-400" />;
};

const getKpiIcon = (kpiType: string) => {
  switch (kpiType) {
    case 'unplanned': return <Wrench className="w-6 h-6 text-orange-400" />;
    case 'scheduled': return <CalendarDays className="w-6 h-6 text-blue-400" />;
    case 'completed': return <PieChart className="w-6 h-6 text-green-400" />;
    case 'technicians': return <Users className="w-6 h-6 text-purple-400" />;
    default: return <AlertCircle className="w-6 h-6 text-slate-400" />;
  }
};

const CaseListItem: React.FC<{ 
  caseData: BeGoneCaseRow; 
  onClick: () => void;
}> = ({ caseData, onClick }) => {
  const { 
    title, 
    kontaktperson, 
    adress, 
    skadedjur, 
    status, 
    case_type,
    start_date,
    due_date,
    pris,
    primary_assignee_name,
    secondary_assignee_name,
    tertiary_assignee_name
  } = caseData;

  const fullAddress = formatAddress(adress);
  const statusColorClass = getStatusColor(status);
  const price = pris || (caseData as any).case_price || 0;
  
  // Samla alla tekniker
  const assignees = [primary_assignee_name, secondary_assignee_name, tertiary_assignee_name]
    .filter(Boolean)
    .join(', ');

  const displayDate = due_date ? formatDate(due_date) : (start_date ? formatDate(start_date) : 'Inget datum');

  return (
    <div 
      onClick={onClick} 
      className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 hover:border-slate-600 transition-all cursor-pointer"
    >
      {/* Header med titel och status */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getCaseTypeIcon(case_type)}
          <h4 className="font-semibold text-white text-sm truncate">{title}</h4>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColorClass} ml-2 whitespace-nowrap`}>
          {status}
        </span>
      </div>

      {/* Detaljer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
        {/* Vänster kolumn */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{kontaktperson || 'Kontaktperson saknas'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{fullAddress}</span>
          </div>
          
          {skadedjur && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{skadedjur}</span>
            </div>
          )}
        </div>

        {/* Höger kolumn */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{displayDate}</span>
          </div>
          
          {price > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="font-medium text-green-400">{formatCurrency(price)}</span>
            </div>
          )}
          
          {assignees && (
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate text-blue-300">{assignees}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TechnicianListItem: React.FC<{ 
  technician: Technician; 
  absence?: any;
}> = ({ technician, absence }) => {
  const { name, role, phone, email, is_active } = technician;
  
  const isAbsent = !!absence;
  const statusText = isAbsent ? 'Frånvarande' : (is_active ? 'Tillgänglig' : 'Inaktiv');
  const statusColor = isAbsent ? 'bg-orange-500/20 text-orange-400' : 
                      (is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400');

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-purple-400" />
          <div>
            <h4 className="font-semibold text-white text-sm">{name}</h4>
            <p className="text-xs text-slate-400">{role}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {statusText}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
        {phone && (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{phone}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        )}
      </div>

      {/* Visa frånvaroinformation om tekniker är frånvarande */}
      {absence && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2 text-orange-400 text-xs mb-2">
            <Calendar className="w-3 h-3" />
            <span className="font-medium">Frånvarande: {absence.reason}</span>
          </div>
          <div className="text-xs text-slate-400">
            <div>Från: {new Date(absence.start_date).toLocaleDateString('sv-SE')} {new Date(absence.start_date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</div>
            <div>Till: {new Date(absence.end_date).toLocaleDateString('sv-SE')} {new Date(absence.end_date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</div>
            {absence.notes && (
              <div className="mt-1 text-slate-500">Anteckning: {absence.notes}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function KpiCaseListModal({ 
  isOpen, 
  onClose, 
  title, 
  cases, 
  technicians, 
  absences,
  kpiType 
}: KpiCaseListModalProps) {
  const [selectedCase, setSelectedCase] = useState<BeGoneCaseRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleCaseClick = (caseData: BeGoneCaseRow) => {
    setSelectedCase(caseData);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedCase(null);
  };

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedCase(null);
    // Här skulle vi kunna uppdatera lokala data, men eftersom vi kommer från dashboard
    // så lämnar vi det till parent att hantera refresh
  };

  const showTechnicians = kpiType === 'technicians' && technicians;
  const showCases = !showTechnicians && cases;

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={title}
        size="xl"
      >
        <div className="p-6">
          {/* Header med ikon och statistik */}
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-700">
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg">
              {getKpiIcon(kpiType)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{title}</h3>
              <p className="text-slate-400">
                {showTechnicians 
                  ? (() => {
                      const total = technicians?.length || 0;
                      const absent = absences?.length || 0;
                      const available = total - absent;
                      return `${available} tillgängliga av ${total} tekniker` + (absent > 0 ? ` (${absent} frånvarande)` : '');
                    })()
                  : `${cases.length} ärenden`
                }
              </p>
            </div>
          </div>

          {/* Lista med ärenden eller tekniker */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {showCases && cases.length > 0 && (
              cases.map(caseData => (
                <CaseListItem 
                  key={caseData.id} 
                  caseData={caseData} 
                  onClick={() => handleCaseClick(caseData)} 
                />
              ))
            )}

            {showTechnicians && technicians && technicians.length > 0 && (
              technicians.map(technician => {
                // Hitta frånvaro för denna tekniker
                const technicianAbsence = absences?.find(absence => absence.technician_id === technician.id);
                
                return (
                  <TechnicianListItem 
                    key={technician.id} 
                    technician={technician} 
                    absence={technicianAbsence}
                  />
                );
              })
            )}

            {/* Empty state */}
            {((showCases && cases.length === 0) || (showTechnicians && (!technicians || technicians.length === 0))) && (
              <div className="text-center py-16 px-4 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                {getKpiIcon(kpiType)}
                <h3 className="text-lg font-semibold text-slate-300 mt-4">
                  {showTechnicians ? 'Inga tekniker' : 'Inga ärenden'}
                </h3>
                <p className="text-slate-500">
                  {showTechnicians 
                    ? 'Det finns inga aktiva tekniker att visa.' 
                    : 'Det finns inga ärenden i denna kategori.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Case Modal */}
      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={handleEditModalClose} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase as any} 
      />
    </>
  );
}
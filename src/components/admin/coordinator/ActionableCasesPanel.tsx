// 📁 src/components/admin/coordinator/ActionableCasesPanel.tsx
// ⭐ VERSION 2.0 - VISAR ÄRENDEN SOM KRÄVER EN BOKNING ⭐

import React from 'react';
import { BeGoneCaseRow } from '../../../types/database';
import { User, MapPin, AlertCircle, CalendarPlus } from 'lucide-react';

interface ActionableCasesPanelProps {
  actionableCases: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

const ActionableCaseItem: React.FC<{ caseData: BeGoneCaseRow; onClick: () => void }> = ({ caseData, onClick }) => {
  const { title, kontaktperson, adress, skadedjur } = caseData;
  const fullAddress = typeof adress === 'object' && adress?.formatted_address ? adress.formatted_address : (typeof adress === 'string' ? adress : 'Adress saknas');

  return (
    <div onClick={onClick} className="p-3 bg-blue-900/30 border border-blue-500/40 rounded-lg mb-2 hover:bg-blue-900/50 hover:border-blue-500/60 transition-all cursor-pointer">
      <h4 className="font-bold text-white text-sm truncate">{title}</h4>
      <div className="mt-2 space-y-1.5 text-xs text-slate-300">
        <div className="flex items-center gap-2"><User className="w-3 h-3 shrink-0" /><span className="truncate">{kontaktperson || 'Kontaktperson saknas'}</span></div>
        <div className="flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{fullAddress}</span></div>
        {skadedjur && (<div className="flex items-center gap-2"><AlertCircle className="w-3 h-3 shrink-0" /><span className="truncate">{skadedjur}</span></div>)}
      </div>
    </div>
  );
};

export default function ActionableCasesPanel({ actionableCases, onCaseClick }: ActionableCasesPanelProps) {
  return (
    <div className="space-y-2">
      {actionableCases.length > 0 ? (
        actionableCases.map(caseData => (
          <ActionableCaseItem key={caseData.id} caseData={caseData} onClick={() => onCaseClick(caseData)} />
        ))
      ) : (
        <div className="text-center py-8 px-4 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
          <CheckCircle className="mx-auto w-8 h-8 text-slate-600 mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">Inga ärenden att boka</h3>
          <p className="text-xs text-slate-500">Alla signerade offerter är inbokade.</p>
        </div>
      )}
    </div>
  );
}
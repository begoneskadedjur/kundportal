// 📁 src/components/admin/coordinator/ActionableCasesPanel.tsx
// ⭐ VERSION 2.2 - LÄGGER TILL SYNLIG STATUS-ETIKETT ⭐

import React from 'react';
import { BeGoneCaseRow } from '../../../types/database';
import { User, MapPin, AlertCircle, CalendarPlus, Zap, Tag } from 'lucide-react'; // Tag-ikon tillagd

interface ActionableCasesPanelProps {
  actionableCases: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

const formatCaseAddress = (address: any): string => {
  if (!address) return 'Adress saknas';
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      return parsed.formatted_address || address;
    } catch (e) { return address; }
  }
  return address.formatted_address || 'Adress saknas';
};

const ActionableCaseItem: React.FC<{ caseData: BeGoneCaseRow; onClick: () => void }> = ({ caseData, onClick }) => {
  const { title, kontaktperson, adress, skadedjur, status } = caseData;
  const fullAddress = formatCaseAddress(adress);

  return (
    <div onClick={onClick} className="p-3 bg-yellow-900/30 border border-yellow-500/40 rounded-lg mb-2 hover:bg-yellow-900/50 hover:border-yellow-500/60 transition-all cursor-pointer">
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-white text-sm truncate pr-2">{title}</h4>
        <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold shrink-0">
          <Zap size={14} />
          <span>Boka nu!</span>
        </div>
      </div>
      <div className="mt-2 space-y-1.5 text-xs text-slate-300">
        <div className="flex items-center gap-2"><User className="w-3 h-3 shrink-0" /><span className="truncate">{kontaktperson || 'Kontaktperson saknas'}</span></div>
        <div className="flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{fullAddress}</span></div>
        {skadedjur && (<div className="flex items-center gap-2"><AlertCircle className="w-3 h-3 shrink-0" /><span className="truncate">{skadedjur}</span></div>)}
      </div>
      {/* ✅ NYTT: Visar en tydlig etikett med ärendets status. */}
      <div className="mt-2 pt-2 border-t border-yellow-500/20">
          <div className="flex items-center gap-2 text-xs text-yellow-300/80">
              <Tag size={12} />
              <span>{status}</span>
          </div>
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
          <CalendarPlus className="mx-auto w-8 h-8 text-slate-600 mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">Inga ärenden att boka in</h3>
          <p className="text-xs text-slate-500">Alla signerade offerter är schemalagda.</p>
        </div>
      )}
    </div>
  );
}
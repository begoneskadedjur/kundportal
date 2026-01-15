// 📁 src/components/admin/coordinator/ActionableCasesPanel.tsx
// ⭐ VERSION 2.3 - LÄGGER TILL DISMISS-FUNKTION ⭐

import React, { useState } from 'react';
import { BeGoneCaseRow } from '../../../types/database';
import { User, MapPin, AlertCircle, CalendarPlus, Zap, Tag, X } from 'lucide-react';

interface ActionableCasesPanelProps {
  actionableCases: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
  onDismissCase?: (caseData: BeGoneCaseRow) => Promise<void>;
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

interface ActionableCaseItemProps {
  caseData: BeGoneCaseRow;
  onClick: () => void;
  onDismiss?: () => void;
}

const ActionableCaseItem: React.FC<ActionableCaseItemProps> = ({ caseData, onClick, onDismiss }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const { title, kontaktperson, adress, skadedjur, status } = caseData;
  const fullAddress = formatCaseAddress(adress);

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDismiss) {
      setIsDismissing(true);
      await onDismiss();
      setIsDismissing(false);
    }
    setShowConfirm(false);
  };

  const handleCancelDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
  };

  return (
    <div className="relative">
      {/* Bekräftelsedialog */}
      {showConfirm && (
        <div className="absolute inset-0 z-10 bg-slate-900/95 rounded-lg flex flex-col items-center justify-center p-4 border border-red-500/50">
          <p className="text-sm text-white text-center mb-4">Vill du verkligen ta bort denna avisering?</p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelDismiss}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleConfirmDismiss}
              disabled={isDismissing}
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {isDismissing ? 'Tar bort...' : 'Bekräfta'}
            </button>
          </div>
        </div>
      )}

      <div onClick={onClick} className="p-3 bg-yellow-900/30 border border-yellow-500/40 rounded-lg mb-2 hover:bg-yellow-900/50 hover:border-yellow-500/60 transition-all cursor-pointer">
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-white text-sm truncate pr-2">{title}</h4>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
              <Zap size={14} />
              <span>Boka nu!</span>
            </div>
            {onDismiss && (
              <button
                onClick={handleDismissClick}
                className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                title="Ta bort från listan"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2"><User className="w-3 h-3 shrink-0" /><span className="truncate">{kontaktperson || 'Kontaktperson saknas'}</span></div>
          <div className="flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{fullAddress}</span></div>
          {skadedjur && (<div className="flex items-center gap-2"><AlertCircle className="w-3 h-3 shrink-0" /><span className="truncate">{skadedjur}</span></div>)}
        </div>
        {/* Visar en tydlig etikett med ärendets status. */}
        <div className="mt-2 pt-2 border-t border-yellow-500/20">
            <div className="flex items-center gap-2 text-xs text-yellow-300/80">
                <Tag size={12} />
                <span>{status}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default function ActionableCasesPanel({ actionableCases, onCaseClick, onDismissCase }: ActionableCasesPanelProps) {
  return (
    <div className="space-y-2">
      {actionableCases.length > 0 ? (
        actionableCases.map(caseData => (
          <ActionableCaseItem
            key={caseData.id}
            caseData={caseData}
            onClick={() => onCaseClick(caseData)}
            onDismiss={onDismissCase ? () => onDismissCase(caseData) : undefined}
          />
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
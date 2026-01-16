// src/components/communication/CommunicationSlidePanel.tsx
// Slide-in panel för kommunikation i ärenden

import React, { useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';
import CommentSection from './CommentSection';
import { CaseType } from '../../types/communication';

interface CommunicationSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseType: CaseType;
  caseTitle: string;
}

export default function CommunicationSlidePanel({
  isOpen,
  onClose,
  caseId,
  caseType,
  caseTitle,
}: CommunicationSlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Stäng panel vid klick utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Lägg till liten fördröjning för att undvika att stänga direkt vid öppning
      const timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timeout);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Stäng panel vid Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop - REDESIGN: Subtle blur */}
      <div
        className={`
          fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[100] transition-all duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden="true"
      />

      {/* Panel - REDESIGN: Bottom sheet på mobil, slide-over på desktop */}
      <div
        ref={panelRef}
        className={`
          fixed z-[101] bg-slate-900 shadow-2xl flex flex-col

          /* Desktop: Slide-over från höger */
          sm:top-0 sm:right-0 sm:h-full sm:w-[400px] lg:sm:w-[440px]
          sm:border-l sm:border-slate-800
          sm:transform sm:transition-transform sm:duration-300 sm:ease-out
          ${isOpen ? 'sm:translate-x-0' : 'sm:translate-x-full'}

          /* Mobil: Bottom sheet */
          max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[85vh]
          max-sm:rounded-t-2xl max-sm:border-t max-sm:border-slate-700
          max-sm:transform max-sm:transition-transform max-sm:duration-300 max-sm:ease-out
          ${isOpen ? 'max-sm:translate-y-0' : 'max-sm:translate-y-full'}
        `}
      >
        {/* Drag handle för mobil (indikerar att man kan svepa ned) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header - REDESIGN: Kompaktare */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-3 py-2.5 max-sm:pt-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-purple-500/15 rounded-md">
              <MessageSquare className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-medium text-slate-100">Kommunikation</h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors"
            aria-label="Stäng panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - REDESIGN: Tightare padding */}
        <div className="flex-1 min-h-0 flex flex-col px-3 pt-3 pb-3">
          <CommentSection
            caseId={caseId}
            caseType={caseType}
            caseTitle={caseTitle}
            compact={true}
          />
        </div>
      </div>
    </>
  );
}

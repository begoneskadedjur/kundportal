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

      {/* Panel - REDESIGN: Tightare, mer sofistikerad */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[400px] lg:w-[440px]
          bg-slate-900 border-l border-slate-800 shadow-2xl z-[101]
          transform transition-transform duration-300 ease-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header - REDESIGN: Kompaktare */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-3 py-2.5 flex items-center justify-between">
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

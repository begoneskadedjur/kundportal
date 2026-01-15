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
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[450px] lg:w-[500px]
          bg-slate-900 border-l border-slate-700 shadow-2xl z-[101]
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Kommunikation</h2>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Stäng panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - extra padding-top för att ge ordentlig luft under header */}
        <div className="h-[calc(100%-65px)] overflow-y-auto px-4 pt-8 pb-4">
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

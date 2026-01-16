// src/components/communication/CaseContextCommunicationModal.tsx
// Kontextuell kommunikationsmodal som visar arendekontext tillsammans med kommunikation
// Desktop: Split-view med arendekontext till vanster och kommunikation till hoger
// Mobil: Fullscreen med collapsible context

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  MessageSquare,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Clock,
  Bug,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  AlertCircle,
  Users
} from 'lucide-react';
import CommentSection from './CommentSection';
import { CaseType } from '../../types/communication';
import { useCaseContext, CaseContext } from '../../hooks/useCaseContext';
import { formatSwedishDateTime } from '../../types/database';

interface CaseContextCommunicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseType: CaseType;
  caseTitle: string;
  onOpenFullCase?: (caseId: string, caseType: CaseType) => void;
}

// Helper to format phone for tel: link
const formatPhoneForLink = (phone: string | null): string | null => {
  if (!phone) return null;
  return phone.replace(/[^+\d]/g, '');
};

// Helper to generate Google Maps URL
const generateMapsUrl = (context: CaseContext): string | null => {
  if (context.addressLat && context.addressLng) {
    return `https://maps.google.com/maps?q=${context.addressLat},${context.addressLng}`;
  }
  if (context.address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(context.address)}`;
  }
  return null;
};

// Context Section Component (Desktop)
const ContextSectionDesktop: React.FC<{
  context: CaseContext;
  onOpenFullCase?: () => void;
}> = ({ context, onOpenFullCase }) => {
  const mapsUrl = generateMapsUrl(context);
  const phoneLink = formatPhoneForLink(context.contactPhone);

  return (
    <div className="flex flex-col h-full bg-slate-800/50 border-r border-slate-700">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-100 truncate">
              {context.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${context.statusColor}20`,
                  color: context.statusColor
                }}
              >
                {context.status}
              </span>
              {context.pestType && (
                <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                  <Bug className="w-3 h-3" />
                  {context.pestType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Address with Maps link */}
        {context.address && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              Adress
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-sm text-slate-200">{context.address}</p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Öppna i Maps
                </a>
              )}
            </div>
          </div>
        )}

        {/* Contact person */}
        {(context.contactPerson || context.contactPhone || context.contactEmail) && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <User className="w-3.5 h-3.5 text-green-400" />
              Kontakt
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 space-y-2">
              {context.contactPerson && (
                <p className="text-sm text-slate-200">{context.contactPerson}</p>
              )}
              {context.contactPhone && (
                <a
                  href={`tel:${phoneLink}`}
                  className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {context.contactPhone}
                </a>
              )}
              {context.contactEmail && (
                <a
                  href={`mailto:${context.contactEmail}`}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors truncate"
                >
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{context.contactEmail}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Scheduling */}
        {(context.startDate || context.dueDate) && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Schemalagt
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 space-y-1.5">
              {context.startDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Start:</span>
                  <span className="text-slate-200">{formatSwedishDateTime(context.startDate)}</span>
                </div>
              )}
              {context.dueDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Slut:</span>
                  <span className="text-slate-200">{formatSwedishDateTime(context.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignees */}
        {(context.primaryAssigneeName || context.secondaryAssigneeName) && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              Tilldelade tekniker
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 space-y-1">
              {context.primaryAssigneeName && (
                <p className="text-sm text-slate-200">{context.primaryAssigneeName}</p>
              )}
              {context.secondaryAssigneeName && (
                <p className="text-sm text-slate-400">{context.secondaryAssigneeName}</p>
              )}
              {context.tertiaryAssigneeName && (
                <p className="text-sm text-slate-400">{context.tertiaryAssigneeName}</p>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {context.description && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              Beskrivning
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-6">
                {context.description}
              </p>
            </div>
          </div>
        )}

        {/* Report */}
        {context.rapport && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Rapport
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-6">
                {context.rapport}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with "Open full case" button */}
      {onOpenFullCase && (
        <div className="flex-shrink-0 p-3 border-t border-slate-700">
          <button
            onClick={onOpenFullCase}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600
                       text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Öppna ärende
          </button>
        </div>
      )}
    </div>
  );
};

// Mobile Quick Info (Always visible)
const MobileQuickInfo: React.FC<{
  context: CaseContext;
}> = ({ context }) => {
  const mapsUrl = generateMapsUrl(context);
  const phoneLink = formatPhoneForLink(context.contactPhone);

  return (
    <div className="bg-slate-800/70 p-3 space-y-2">
      {/* Title + Status + Pest */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100 truncate">{context.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${context.statusColor}20`,
              color: context.statusColor
            }}
          >
            {context.status}
          </span>
          {context.pestType && (
            <span className="inline-flex items-center gap-1 text-[10px] text-orange-400">
              <Bug className="w-2.5 h-2.5" />
              {context.pestType}
            </span>
          )}
        </div>
      </div>

      {/* Quick actions: Address + Phone */}
      <div className="flex gap-2">
        {mapsUrl && context.address && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5
                       bg-teal-500/20 hover:bg-teal-500/30 text-teal-400
                       text-xs font-medium rounded-lg transition-colors
                       min-h-[44px]"
          >
            <MapPin className="w-4 h-4" />
            Maps
          </a>
        )}
        {phoneLink && (
          <a
            href={`tel:${phoneLink}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5
                       bg-green-500/20 hover:bg-green-500/30 text-green-400
                       text-xs font-medium rounded-lg transition-colors
                       min-h-[44px]"
          >
            <Phone className="w-4 h-4" />
            Ring
          </a>
        )}
      </div>
    </div>
  );
};

// Mobile Expandable Context
const MobileExpandableContext: React.FC<{
  context: CaseContext;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ context, isExpanded, onToggle }) => {
  return (
    <div className="border-t border-slate-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5
                   text-slate-400 hover:text-slate-200 transition-colors
                   min-h-[44px]"
      >
        <span className="text-xs font-medium">
          {isExpanded ? 'Dölj ärendeinfo' : 'Visa mer ärendeinfo'}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Contact */}
          {(context.contactPerson || context.contactEmail) && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Kontakt</p>
              {context.contactPerson && (
                <p className="text-sm text-slate-200">{context.contactPerson}</p>
              )}
              {context.contactEmail && (
                <a
                  href={`mailto:${context.contactEmail}`}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors block truncate"
                >
                  {context.contactEmail}
                </a>
              )}
            </div>
          )}

          {/* Scheduling */}
          {(context.startDate || context.dueDate) && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Schemalagt</p>
              {context.startDate && (
                <p className="text-sm text-slate-200">
                  Start: {formatSwedishDateTime(context.startDate)}
                </p>
              )}
              {context.dueDate && (
                <p className="text-sm text-slate-200">
                  Slut: {formatSwedishDateTime(context.dueDate)}
                </p>
              )}
            </div>
          )}

          {/* Assignees */}
          {context.primaryAssigneeName && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Tekniker</p>
              <p className="text-sm text-slate-200">{context.primaryAssigneeName}</p>
            </div>
          )}

          {/* Description */}
          {context.description && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Beskrivning</p>
              <p className="text-sm text-slate-300 line-clamp-3">{context.description}</p>
            </div>
          )}

          {/* Report */}
          {context.rapport && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Rapport</p>
              <p className="text-sm text-slate-300 line-clamp-3">{context.rapport}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function CaseContextCommunicationModal({
  isOpen,
  onClose,
  caseId,
  caseType,
  caseTitle,
  onOpenFullCase
}: CaseContextCommunicationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mobileContextExpanded, setMobileContextExpanded] = useState(false);

  // Fetch case context
  const { caseContext, isLoading, error } = useCaseContext(
    isOpen ? caseId : null,
    isOpen ? caseType : null
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      const timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timeout);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Close on Escape
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

  // Reset mobile expanded state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMobileContextExpanded(false);
    }
  }, [isOpen]);

  // Handle open full case
  const handleOpenFullCase = () => {
    if (onOpenFullCase) {
      onOpenFullCase(caseId, caseType);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[100] transition-all duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        className={`
          fixed z-[101] bg-slate-900 shadow-2xl flex flex-col

          /* Desktop: Centered modal with split view */
          lg:inset-4 lg:m-auto lg:max-w-5xl lg:max-h-[90vh] lg:rounded-xl lg:border lg:border-slate-700
          lg:transition-all lg:duration-300
          ${isOpen ? 'lg:opacity-100 lg:scale-100' : 'lg:opacity-0 lg:scale-95 lg:pointer-events-none'}

          /* Tablet: Slide-over from right */
          max-lg:sm:top-0 max-lg:sm:right-0 max-lg:sm:h-full max-lg:sm:w-[500px]
          max-lg:sm:border-l max-lg:sm:border-slate-700
          max-lg:sm:transform max-lg:sm:transition-transform max-lg:sm:duration-300
          ${isOpen ? 'max-lg:sm:translate-x-0' : 'max-lg:sm:translate-x-full'}

          /* Mobile: Bottom sheet fullscreen */
          max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[95vh]
          max-sm:rounded-t-2xl max-sm:border-t max-sm:border-slate-700
          max-sm:transform max-sm:transition-transform max-sm:duration-300
          ${isOpen ? 'max-sm:translate-y-0' : 'max-sm:translate-y-full'}
        `}
      >
        {/* Mobile drag handle */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 px-4 py-3 max-sm:pt-1 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-purple-500/15 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-100">Kommunikation</h2>
              <p className="text-xs text-slate-500 truncate max-w-[300px]">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors
                       min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Stäng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Desktop: Left panel - Context */}
          <div className="hidden lg:flex lg:w-[350px] lg:flex-shrink-0">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : caseContext ? (
              <ContextSectionDesktop
                context={caseContext}
                onOpenFullCase={onOpenFullCase ? handleOpenFullCase : undefined}
              />
            ) : null}
          </div>

          {/* Mobile/Tablet: Top area - Quick info + Expandable context */}
          <div className="lg:hidden flex-shrink-0">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : caseContext ? (
              <>
                <MobileQuickInfo context={caseContext} />
                <MobileExpandableContext
                  context={caseContext}
                  isExpanded={mobileContextExpanded}
                  onToggle={() => setMobileContextExpanded(!mobileContextExpanded)}
                />
              </>
            ) : null}
          </div>

          {/* Right panel / Bottom area - Communication */}
          <div className="flex-1 min-h-0 flex flex-col border-t lg:border-t-0 border-slate-700">
            <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 pb-4">
              <CommentSection
                caseId={caseId}
                caseType={caseType}
                caseTitle={caseTitle}
                compact={true}
              />
            </div>
          </div>
        </div>

        {/* Mobile footer with "Open full case" button */}
        {onOpenFullCase && (
          <div className="lg:hidden flex-shrink-0 p-3 border-t border-slate-700 bg-slate-900/95">
            <button
              onClick={handleOpenFullCase}
              className="w-full flex items-center justify-center gap-2 px-4 py-3
                         bg-slate-700 hover:bg-slate-600 text-slate-200
                         text-sm font-medium rounded-lg transition-colors
                         min-h-[48px]"
            >
              <ExternalLink className="w-4 h-4" />
              Öppna fullständigt ärende
            </button>
          </div>
        )}
      </div>
    </>
  );
}

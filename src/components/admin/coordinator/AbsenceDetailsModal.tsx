// src/components/admin/coordinator/AbsenceDetailsModal.tsx
// Modal för att visa frånvarodetaljer

import React from 'react';
import { CalendarOff, Clock, User, FileText, Calendar, Home, Briefcase } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { Absence } from '../../../pages/coordinator/CoordinatorSchedule';

interface AbsenceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  absence: Absence | null;
  technicianName?: string;
}

export default function AbsenceDetailsModal({ isOpen, onClose, absence, technicianName }: AbsenceDetailsModalProps) {
  if (!absence) return null;

  const startDate = new Date(absence.start_date);
  const endDate = new Date(absence.end_date);
  
  // Beräkna duration
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationDays = Math.floor(durationHours / 24);
  const remainingHours = durationHours % 24;
  
  const durationText = durationDays > 0 
    ? `${durationDays} dag${durationDays !== 1 ? 'ar' : ''} ${remainingHours > 0 ? `och ${remainingHours} timmar` : ''}`
    : `${durationHours} timmar`;

  // Bestäm ikon baserat på frånvarotyp
  const getReasonIcon = (reason: string) => {
    switch(reason) {
      case 'Admin':
        return <Home className="w-5 h-5 text-indigo-400" />;
      case 'Semester':
        return <Calendar className="w-5 h-5 text-green-400" />;
      case 'Sjukdom':
        return <CalendarOff className="w-5 h-5 text-red-400" />;
      case 'Utbildning':
        return <Briefcase className="w-5 h-5 text-blue-400" />;
      default:
        return <CalendarOff className="w-5 h-5 text-slate-400" />;
    }
  };

  // Bestäm bakgrundsfärg baserat på frånvarotyp
  const getReasonColor = (reason: string) => {
    switch(reason) {
      case 'Admin':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50';
      case 'Semester':
        return 'bg-green-500/20 text-green-300 border-green-500/50';
      case 'Sjukdom':
        return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'Utbildning':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  const footer = (
    <div className="flex justify-end pt-4 border-t border-slate-800">
      <Button onClick={onClose} variant="secondary">
        Stäng
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Frånvarodetaljer"
      size="md"
      footer={footer}
    >
      <div className="p-6 space-y-4">
        {/* Header med frånvarotyp */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          {getReasonIcon(absence.reason)}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">{absence.reason}</h3>
            {absence.reason === 'Admin' && (
              <p className="text-sm text-slate-400">Hemarbete med offerter/administrativa uppgifter</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getReasonColor(absence.reason)}`}>
            {absence.reason}
          </span>
        </div>

        {/* Tekniker info */}
        {technicianName && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30">
            <User className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm text-slate-400">Tekniker</p>
              <p className="font-medium text-white">{technicianName}</p>
            </div>
          </div>
        )}

        {/* Tidsdetaljer */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-slate-400">Startar</p>
              <p className="font-medium text-white">
                {startDate.toLocaleDateString('sv-SE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-slate-300">
                Kl. {startDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-slate-400">Slutar</p>
              <p className="font-medium text-white">
                {endDate.toLocaleDateString('sv-SE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-slate-300">
                Kl. {endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <Clock className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-slate-400">Total längd</p>
              <p className="font-medium text-white">{durationText}</p>
            </div>
          </div>
        </div>

        {/* Anteckningar om de finns */}
        {absence.notes && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <FileText className="w-4 h-4" />
              <p className="text-sm font-medium">Anteckningar</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{absence.notes}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
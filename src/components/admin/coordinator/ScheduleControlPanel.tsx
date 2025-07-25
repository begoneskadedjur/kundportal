// 📁 src/components/admin/coordinator/ScheduleControlPanel.tsx
// ⭐ VERSION 1.4 - FOKUSERAR PÅ "ÄRENDEN ATT BOKA IN" ⭐

import React, { useState } from 'react';
import { BeGoneCaseRow, Technician } from '../../../types/database';
import { Search, ChevronDown, ChevronUp, Users, Filter, CalendarPlus } from 'lucide-react'; // ✅ Ikon uppdaterad

import TechnicianFilter from './TechnicianFilter';
import ActionableCasesPanel from './ActionableCasesPanel'; // ✅ Komponenten har bytt namn

interface ScheduleControlPanelProps {
  technicians: Technician[];
  actionableCases: BeGoneCaseRow[]; // ✅ Prop har bytt namn
  activeStatuses: Set<string>;
  setActiveStatuses: (statuses: Set<string>) => void;
  selectedTechnicianIds: Set<string>;
  setSelectedTechnicianIds: (ids: Set<string>) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

const ALL_STATUSES = ['Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];

const AccordionSection: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 focus:outline-none transition-colors">
        <div className="flex items-center gap-3"><Icon className="w-5 h-5 text-slate-400" /><span className="font-bold text-white">{title}</span></div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
      </button>
      {isOpen && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
};

export default function ScheduleControlPanel({
  technicians,
  actionableCases, // ✅ Prop har bytt namn
  activeStatuses,
  setActiveStatuses,
  selectedTechnicianIds,
  setSelectedTechnicianIds,
  searchQuery,
  setSearchQuery,
  onCaseClick,
}: ScheduleControlPanelProps) {
  
  const toggleStatus = (status: string) => {
    const newStatuses = new Set(activeStatuses);
    newStatuses.has(status) ? newStatuses.delete(status) : newStatuses.add(status);
    setActiveStatuses(newStatuses);
  };
  
  return (
    <div className="h-full bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Sök på ärende, kund, adress..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
      </div>
      
      <div className="flex-shrink-0">
         <AccordionSection title="Filtrera Tekniker" icon={Users} defaultOpen={true}>
          <TechnicianFilter technicians={technicians} selectedTechnicianIds={selectedTechnicianIds} setSelectedTechnicianIds={setSelectedTechnicianIds}/>
        </AccordionSection>
        <AccordionSection title="Filtrera Status" icon={Filter}>
          <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto pr-1">
            {ALL_STATUSES.map(status => (
              <label key={status} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-800/50">
                <input type="checkbox" checked={activeStatuses.has(status)} onChange={() => toggleStatus(status)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 shrink-0" />
                <span className={`text-sm ${activeStatuses.has(status) ? 'text-white' : 'text-slate-400'}`}>{status}</span>
              </label>
            ))}
          </div>
        </AccordionSection>
      </div>

      {/* ✅ FÖRBÄTTRING: Sektionen har nu ett mer passande namn och ikon. */}
      <div className="p-4 flex flex-col flex-grow min-h-0">
        <div className="flex items-center gap-3 mb-3 flex-shrink-0">
           <CalendarPlus className="w-5 h-5 text-slate-400" />
           <h3 className="font-bold text-white">Ärenden att Boka In ({actionableCases.length})</h3>
        </div>
        <div className="flex-grow overflow-y-auto">
            <ActionableCasesPanel 
              actionableCases={actionableCases} // ✅ Prop har bytt namn
              onCaseClick={onCaseClick} 
            />
        </div>
      </div>
    </div>
  );
}
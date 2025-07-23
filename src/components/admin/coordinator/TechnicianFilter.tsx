// 📁 src/components/admin/coordinator/TechnicianFilter.tsx
// ⭐ VERSION 1.0 - DYNAMISKT TEKNIKERFILTER MED SÖK OCH SNABBVAL ⭐

import React, { useState, useMemo } from 'react';
import { Technician } from '../../../types/database';
import { Search } from 'lucide-react';
import Button from '../../../components/ui/Button'; // Återanvänder er befintliga Button-komponent

interface TechnicianFilterProps {
  technicians: Technician[];
  selectedTechnicianIds: Set<string>;
  setSelectedTechnicianIds: (ids: Set<string>) => void;
}

export default function TechnicianFilter({
  technicians,
  selectedTechnicianIds,
  setSelectedTechnicianIds,
}: TechnicianFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTechnicians = useMemo(() => {
    if (!searchTerm) {
      return technicians;
    }
    return technicians.filter(tech =>
      tech.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [technicians, searchTerm]);

  const handleToggleTechnician = (id: string) => {
    const newIds = new Set(selectedTechnicianIds);
    if (newIds.has(id)) {
      newIds.delete(id);
    } else {
      newIds.add(id);
    }
    setSelectedTechnicianIds(newIds);
  };

  const selectAll = () => {
    const allIds = new Set(technicians.map(t => t.id));
    setSelectedTechnicianIds(allIds);
  };

  const clearAll = () => {
    setSelectedTechnicianIds(new Set());
  };

  return (
    <div className="space-y-3">
      {/* --- Sökfält för tekniker --- */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Sök tekniker..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 bg-slate-800/70 border border-slate-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm"
        />
      </div>

      {/* --- Lista med tekniker --- */}
      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {filteredTechnicians.map(tech => (
          <label
            key={tech.id}
            className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-800/50"
          >
            <input
              type="checkbox"
              checked={selectedTechnicianIds.has(tech.id)}
              onChange={() => handleToggleTechnician(tech.id)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 shrink-0"
            />
            <span className={`text-sm ${selectedTechnicianIds.has(tech.id) ? 'text-white' : 'text-slate-300'}`}>
              {tech.name}
            </span>
          </label>
        ))}
         {filteredTechnicians.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-4">Inga tekniker matchade sökningen.</p>
        )}
      </div>

      {/* --- Knappar för snabbval --- */}
      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" variant="secondary" onClick={selectAll} className="w-full">
          Välj alla
        </Button>
        <Button size="sm" variant="ghost" onClick={clearAll} className="w-full">
          Rensa
        </Button>
      </div>
    </div>
  );
}
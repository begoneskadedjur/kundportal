import React, { useState } from 'react';
// ✅ TYPERNA IMPORTERAS NU FRÅN RÄTT STÄLLE ENLIGT DIN STRUKTUR
import type { WorkSchedule, DaySchedule } from '../../../../types/database'; 
import Input from '../../../ui/Input';
import Button from '../../../ui/Button';
// ✅ BORTTAGEN: Importen av den saknade Switch-komponenten är borta.
// import { Switch } from '../../../ui/Switch'; 

interface WorkScheduleEditorProps {
  initialSchedule: WorkSchedule;
  onSave: (newSchedule: WorkSchedule) => Promise<void>;
  onCancel: () => void;
}

const weekDays: (keyof WorkSchedule)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

const dayTranslations: Record<keyof WorkSchedule, string> = {
  monday: 'Måndag',
  tuesday: 'Tisdag',
  wednesday: 'Onsdag',
  thursday: 'Torsdag',
  friday: 'Fredag',
  saturday: 'Lördag',
  sunday: 'Söndag'
};

export default function WorkScheduleEditor({ initialSchedule, onSave, onCancel }: WorkScheduleEditorProps) {
  const [schedule, setSchedule] = useState<WorkSchedule>(initialSchedule);
  const [isSaving, setIsSaving] = useState(false);

  const handleDayChange = (day: keyof WorkSchedule, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };
  
  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(schedule);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-1">
      <h3 className="text-lg font-medium text-white mb-4">Anpassa Arbetstider</h3>
      <div className="space-y-4">
        {weekDays.map(day => (
          <div key={day} className={`grid grid-cols-4 items-center gap-4 p-3 rounded-lg ${schedule[day].active ? 'bg-slate-800/70' : 'bg-slate-800/30'}`}>
            <label className={`font-medium col-span-1 ${schedule[day].active ? 'text-white' : 'text-slate-400'}`}>
              {dayTranslations[day]}
            </label>
            <div className="col-span-2 flex items-center gap-2">
              <Input
                type="time"
                value={schedule[day].start}
                onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                disabled={!schedule[day].active}
                className="bg-slate-700 border-slate-600 disabled:opacity-50"
              />
              <span className={schedule[day].active ? 'text-slate-400' : 'text-slate-600'}>-</span>
              <Input
                type="time"
                value={schedule[day].end}
                onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                disabled={!schedule[day].active}
                className="bg-slate-700 border-slate-600 disabled:opacity-50"
              />
            </div>
            <div className="col-span-1 flex justify-end">
               {/* ✅ ERSATT: Den saknade Switch-komponenten är nu ersatt med en standard kryssruta. */}
               <input
                  type="checkbox"
                  className="h-5 w-5 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500 cursor-pointer"
                  checked={schedule[day].active}
                  onChange={(e) => handleDayChange(day, 'active', e.target.checked)}
                />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
        <Button variant="secondary" onClick={onCancel}>Avbryt</Button>
        <Button onClick={handleSaveClick} isLoading={isSaving}>
          {isSaving ? 'Sparar...' : 'Spara Schema'}
        </Button>
      </div>
    </div>
  );
}
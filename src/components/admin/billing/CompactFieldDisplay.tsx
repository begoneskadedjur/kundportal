// CompactFieldDisplay.tsx - Delad kompakt fältkomponent för enhetlig design
import React from 'react';

interface CompactField {
  label: string;
  value: string | null | undefined;
  isHighlight?: boolean;
}

interface CompactFieldDisplayProps {
  fields: CompactField[];
  columns?: 1 | 2 | 3;
}

export const CompactFieldDisplay: React.FC<CompactFieldDisplayProps> = ({ 
  fields, 
  columns = 1 
}) => {
  if (columns === 1) {
    // Enkel kolumn - för mest kompakt vy
    return (
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div 
            key={index} 
            className="flex justify-between items-center py-2 border-b border-slate-800 last:border-b-0"
          >
            <label className="text-sm text-slate-400 flex-shrink-0 min-w-0 pr-4">
              {field.label}
            </label>
            <div className="text-right">
              <span className={`${field.isHighlight ? 'text-green-400 font-semibold' : 'text-white'}`}>
                {field.value || '-'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Multi-kolumn layout för när mer space behövs
  const gridCols = columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  
  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-3`}>
      {fields.map((field, index) => (
        <div 
          key={index}
          className="bg-slate-800/30 p-3 rounded-lg border border-slate-700"
        >
          <p className="text-sm text-slate-400 mb-1">{field.label}</p>
          <p className={`${field.isHighlight ? 'text-green-400 font-semibold' : 'text-white font-medium'}`}>
            {field.value || '-'}
          </p>
        </div>
      ))}
    </div>
  );
};
// src/components/larosate/GuideSearch.tsx
// Sökfält för BeGone Lärosäte

import { Search, X } from 'lucide-react';
import { useRef } from 'react';

interface GuideSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function GuideSearch({
  value,
  onChange,
  placeholder = 'Sök bland guider...'
}: GuideSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Sökikon */}
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-10 py-3 bg-slate-800/50 border border-slate-700/50
                   rounded-xl text-white placeholder-slate-500
                   focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                   transition-all"
      />

      {/* Rensa-knapp */}
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                     text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Rensa sökning"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

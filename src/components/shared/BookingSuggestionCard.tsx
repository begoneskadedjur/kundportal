// 📁 src/components/shared/BookingSuggestionCard.tsx
// ⭐ VERSION 1.1 - Kompaktare kort med responsivt grid-layout för desktop

import React, { useState } from 'react';
import { Clock, MapPin, Home, Star, TrendingUp, ChevronDown, ChevronUp, Route, User } from 'lucide-react';

// --- Typer ---
export interface SingleSuggestion {
  technician_id: string;
  technician_name: string;
  start_time: string;
  end_time: string;
  travel_time_minutes: number;
  origin_description: string;
  efficiency_score: number;
  is_first_job?: boolean;
  travel_time_home_minutes?: number;
}

// --- Hjälpfunktioner ---
const getEfficiencyInfo = (score: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
} => {
  if (score >= 90) return {
    label: 'Optimal',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/40',
    description: 'Utmärkt tidslucka med kort restid'
  };
  if (score >= 70) return {
    label: 'Bra',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/40',
    description: 'Bra val med rimlig restid'
  };
  if (score >= 50) return {
    label: 'OK',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/40',
    description: 'Acceptabel tid men inte optimal'
  };
  return {
    label: 'Låg',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800',
    borderColor: 'border-slate-700',
    description: 'Längre restid eller suboptimal tidslucka'
  };
};

const getTravelTimeInfo = (minutes: number): { color: string; label: string } => {
  if (minutes <= 20) return { color: 'text-emerald-400', label: 'Kort' };
  if (minutes <= 35) return { color: 'text-blue-400', label: 'Medel' };
  if (minutes <= 50) return { color: 'text-amber-400', label: 'Längre' };
  return { color: 'text-red-400', label: 'Lång' };
};

const formatTime = (isoString: string) =>
  new Date(isoString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

const formatDate = (isoString: string) =>
  new Date(isoString).toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

// --- Huvudkomponent ---
interface BookingSuggestionCardProps {
  suggestion: SingleSuggestion;
  onClick: () => void;
  isTopPick?: boolean;
  rank?: number;
}

export default function BookingSuggestionCard({
  suggestion,
  onClick,
  isTopPick = false,
  rank
}: BookingSuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const efficiencyInfo = getEfficiencyInfo(suggestion.efficiency_score);
  const travelInfo = getTravelTimeInfo(suggestion.travel_time_minutes);
  const homeInfo = suggestion.travel_time_home_minutes
    ? getTravelTimeInfo(suggestion.travel_time_home_minutes)
    : null;

  // Förenkla origin-beskrivningen
  const getSimplifiedOrigin = () => {
    if (suggestion.is_first_job) {
      return 'Första jobbet för dagen';
    }
    // Extrahera ärendenamn från origin_description
    const match = suggestion.origin_description.match(/Efter "([^"]+)"/);
    if (match) {
      return `Efter "${match[1].substring(0, 25)}${match[1].length > 25 ? '...' : ''}"`;
    }
    return suggestion.origin_description.split('.')[0];
  };

  return (
    <div
      className={`
        relative p-3 rounded-lg cursor-pointer transition-all duration-200
        ${efficiencyInfo.bgColor} ${efficiencyInfo.borderColor} border
        hover:shadow-lg hover:shadow-slate-900/30 hover:scale-[1.01]
        ${isTopPick ? 'ring-2 ring-emerald-500/50' : ''}
      `}
      onClick={onClick}
    >
      {/* Top Pick Badge */}
      {isTopPick && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg">
          <Star className="w-3 h-3" />
          Bäst
        </div>
      )}

      {/* Header: Tekniker + Effektivitet */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Rang-indikator */}
          {rank && rank <= 3 && (
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${rank === 1 ? 'bg-emerald-500/20 text-emerald-400' :
                rank === 2 ? 'bg-blue-500/20 text-blue-400' :
                'bg-amber-500/20 text-amber-400'}
            `}>
              {rank}
            </div>
          )}

          {/* Tekniker-info */}
          <div className="min-w-0">
            <h4 className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {suggestion.technician_name}
            </h4>
          </div>
        </div>

        {/* Effektivitets-badge - kompakt */}
        <div className={`
          px-2 py-1 rounded text-xs font-semibold shrink-0
          ${efficiencyInfo.bgColor} ${efficiencyInfo.color} border ${efficiencyInfo.borderColor}
        `}>
          {efficiencyInfo.label}
        </div>
      </div>

      {/* Tid - Prominent men kompakt */}
      <div className="mb-2">
        <div className="text-lg font-bold text-white tracking-tight">
          {formatTime(suggestion.start_time)} – {formatTime(suggestion.end_time)}
        </div>
        <p className="text-xs text-slate-400 capitalize">
          {formatDate(suggestion.start_time)}
        </p>
      </div>

      {/* Kompakt info-rad */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Restid till jobb */}
        <div className={`flex items-center gap-1 ${travelInfo.color}`}>
          <Route className="w-3.5 h-3.5" />
          <span className="font-medium">{suggestion.travel_time_minutes} min</span>
        </div>

        {/* Hemresa (om sent jobb) */}
        {homeInfo && (
          <div className={`flex items-center gap-1 ${homeInfo.color}`}>
            <Home className="w-3.5 h-3.5" />
            <span className="font-medium">{suggestion.travel_time_home_minutes} min hem</span>
          </div>
        )}

        {/* Första jobb badge */}
        {suggestion.is_first_job && (
          <div className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
            <Home className="w-3 h-3" />
            <span className="font-medium">Hemstart</span>
          </div>
        )}
      </div>

      {/* Expanderbar detalj-sektion - endast på hover eller klick */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="mt-2 pt-2 border-t border-slate-700/50 w-full flex items-center justify-between text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span className="text-xs">{isExpanded ? 'Dölj' : 'Detaljer'}</span>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 text-xs">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-slate-300">{getSimplifiedOrigin()}</p>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-900/50">
            <TrendingUp className={`w-3.5 h-3.5 ${efficiencyInfo.color}`} />
            <p className="text-slate-400">{efficiencyInfo.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Grupperad lista-komponent ---
interface GroupedSuggestion {
  date: string;
  suggestions: SingleSuggestion[];
}

interface BookingSuggestionListProps {
  suggestions: SingleSuggestion[];
  onSelect: (suggestion: SingleSuggestion) => void;
}

export function BookingSuggestionList({ suggestions, onSelect }: BookingSuggestionListProps) {
  // Gruppera förslag per dag
  const groupedSuggestions: GroupedSuggestion[] = React.useMemo(() => {
    const groups: Record<string, SingleSuggestion[]> = {};

    suggestions.forEach(sugg => {
      const dateKey = new Date(sugg.start_time).toLocaleDateString('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(sugg);
    });

    return Object.entries(groups).map(([date, suggs]) => ({
      date,
      suggestions: suggs.sort((a, b) => b.efficiency_score - a.efficiency_score)
    }));
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  // Hitta bästa förslaget totalt
  const topSuggestion = suggestions.reduce((best, current) =>
    current.efficiency_score > best.efficiency_score ? current : best
  , suggestions[0]);

  let globalRank = 0;

  return (
    <div className="space-y-6">
      {/* Sammanfattning */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {suggestions.length} förslag hittade
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Optimal
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            Bra
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            OK
          </span>
        </div>
      </div>

      {/* Grupperade förslag per dag */}
      {groupedSuggestions.map((group) => (
        <div key={group.date} className="space-y-3">
          {/* Dag-header */}
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-white capitalize">
              {group.date}
            </h4>
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">
              {group.suggestions.length} {group.suggestions.length === 1 ? 'förslag' : 'förslag'}
            </span>
          </div>

          {/* Kort för denna dag - grid med 2 kolumner på desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {group.suggestions.map((sugg) => {
              globalRank++;
              const isTop = sugg === topSuggestion;
              return (
                <BookingSuggestionCard
                  key={`${sugg.technician_id}-${sugg.start_time}`}
                  suggestion={sugg}
                  onClick={() => onSelect(sugg)}
                  isTopPick={isTop}
                  rank={globalRank <= 3 ? globalRank : undefined}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

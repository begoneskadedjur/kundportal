// 📁 src/components/shared/BookingSuggestionCard.tsx
// ⭐ VERSION 2.0 - Top Picks-sortering och strukturerad origin-data ⭐

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
  // Strukturerad origin-data
  origin_address?: string;        // Varifrån teknikern kommer
  origin_case_title?: string;     // Namn på föregående ärende
  origin_end_time?: string;       // ISO-tid när föregående ärende slutar
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

const formatDateStr = (isoString: string) =>
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
          {formatDateStr(suggestion.start_time)}
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

      {/* Expanderbar detalj-sektion */}
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
        <div className="mt-3 space-y-2 text-xs">
          {/* Föregående ärende - strukturerad info */}
          {!suggestion.is_first_job && (
            <div className="p-2.5 rounded-md bg-slate-900/60 border border-slate-700/50 space-y-1.5">
              <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                Kommer från
              </p>

              {/* Ärendenamn */}
              {suggestion.origin_case_title && (
                <p className="text-slate-200 font-medium">
                  {suggestion.origin_case_title}
                </p>
              )}

              {/* Tidsspann - när föregående ärende slutar */}
              {suggestion.origin_end_time && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Slutar kl. {formatTime(suggestion.origin_end_time)}
                  </span>
                </div>
              )}

              {/* Adress */}
              {suggestion.origin_address && (
                <div className="flex items-start gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="break-words">
                    {suggestion.origin_address}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Första jobbet - startar hemifrån */}
          {suggestion.is_first_job && (
            <div className="p-2.5 rounded-md bg-purple-500/10 border border-purple-500/30 space-y-1">
              <p className="text-purple-300 font-medium flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" />
                Startar från hemadress
              </p>
              {suggestion.origin_address && (
                <p className="text-slate-400 text-[11px] ml-5">
                  {suggestion.origin_address}
                </p>
              )}
            </div>
          )}

          {/* Effektivitetsbeskrivning */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-800/50">
            <TrendingUp className={`w-3.5 h-3.5 ${efficiencyInfo.color}`} />
            <p className="text-slate-400">{efficiencyInfo.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Grupperad lista-komponent med Top Picks-sortering ---
interface GroupedSuggestion {
  date: string;
  suggestions: SingleSuggestion[];
  bestScore: number;
}

interface BookingSuggestionListProps {
  suggestions: SingleSuggestion[];
  onSelect: (suggestion: SingleSuggestion) => void;
}

export function BookingSuggestionList({ suggestions, onSelect }: BookingSuggestionListProps) {
  // Sortera alla förslag efter effektivitet (bäst först)
  const sortedByEfficiency = React.useMemo(() =>
    [...suggestions].sort((a, b) => b.efficiency_score - a.efficiency_score),
    [suggestions]
  );

  // Top 3 picks (de absolut bästa oavsett dag)
  const topPicks = sortedByEfficiency.slice(0, 3);
  const topPickIds = new Set(topPicks.map(s => `${s.technician_id}-${s.start_time}`));

  // Övriga förslag grupperade per dag (exkluderar top picks)
  const remainingSuggestions = sortedByEfficiency.filter(
    s => !topPickIds.has(`${s.technician_id}-${s.start_time}`)
  );

  const groupedRemaining: GroupedSuggestion[] = React.useMemo(() => {
    const groups: Record<string, SingleSuggestion[]> = {};

    remainingSuggestions.forEach(sugg => {
      const dateKey = new Date(sugg.start_time).toLocaleDateString('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(sugg);
    });

    // Sortera dagarna efter bästa förslag i varje dag
    return Object.entries(groups)
      .map(([date, suggs]) => ({
        date,
        suggestions: suggs.sort((a, b) => b.efficiency_score - a.efficiency_score),
        bestScore: Math.max(...suggs.map(s => s.efficiency_score))
      }))
      .sort((a, b) => b.bestScore - a.bestScore);
  }, [remainingSuggestions]);

  if (suggestions.length === 0) return null;

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

      {/* TOP PICKS - Alltid överst */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">
              Rekommenderade tider
            </h4>
          </div>
          <div className="flex-1 h-px bg-emerald-500/30" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {topPicks.map((sugg, index) => (
            <BookingSuggestionCard
              key={`${sugg.technician_id}-${sugg.start_time}`}
              suggestion={sugg}
              onClick={() => onSelect(sugg)}
              isTopPick={index === 0}
              rank={index + 1}
            />
          ))}
        </div>
      </div>

      {/* ÖVRIGA FÖRSLAG - Grupperade per dag, sorterade efter bästa dag först */}
      {groupedRemaining.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pt-2">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Övriga alternativ
            </h4>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {groupedRemaining.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Dag-header */}
              <div className="flex items-center gap-3">
                <h5 className="text-sm font-medium text-slate-300 capitalize">
                  {group.date}
                </h5>
                <span className="text-xs text-slate-500">
                  {group.suggestions.length} förslag
                </span>
              </div>

              {/* Kort för denna dag */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {group.suggestions.map((sugg) => (
                  <BookingSuggestionCard
                    key={`${sugg.technician_id}-${sugg.start_time}`}
                    suggestion={sugg}
                    onClick={() => onSelect(sugg)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

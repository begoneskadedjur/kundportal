// src/components/communication/MentionSuggestions.tsx
// Autocomplete-dropdown för @mentions med grupperade sektioner

import React, { useMemo } from 'react';
import { MentionSuggestion, ROLE_COLORS, AuthorRole } from '../../types/communication';
import { Users, User, AtSign } from 'lucide-react';

interface MentionSuggestionsProps {
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
  position?: { top: number; left: number };
}

export default function MentionSuggestions({
  suggestions,
  selectedIndex,
  onSelect,
  position,
}: MentionSuggestionsProps) {
  if (suggestions.length === 0) return null;

  // Dela upp suggestions i grupper och personer
  const { groups, people } = useMemo(() => {
    const groups: MentionSuggestion[] = [];
    const people: MentionSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (suggestion.type === 'all' || suggestion.type === 'role') {
        groups.push(suggestion);
      } else if (suggestion.type === 'user') {
        people.push(suggestion);
      }
    }

    return { groups, people };
  }, [suggestions]);

  // Beräkna global index för varje suggestion
  const getGlobalIndex = (sectionIndex: number, isGroup: boolean): number => {
    if (isGroup) {
      return sectionIndex;
    }
    return groups.length + sectionIndex;
  };

  // REDESIGN: Mindre ikoner
  const getRoleIcon = (suggestion: MentionSuggestion) => {
    if (suggestion.type === 'all') {
      return <Users className="w-3 h-3 text-[#20c58f]" />;
    }
    if (suggestion.type === 'role') {
      return <Users className="w-3 h-3 text-purple-400" />;
    }
    return <User className="w-3 h-3 text-slate-400" />;
  };

  const getRoleBadgeColors = (role?: string): string => {
    if (!role) return 'bg-slate-500/20 text-slate-300';
    const colors = ROLE_COLORS[role as AuthorRole];
    if (colors) return `${colors.bg} ${colors.text}`;
    return 'bg-slate-500/20 text-slate-300';
  };

  // REDESIGN: Kompaktare suggestion items
  const renderSuggestionItem = (suggestion: MentionSuggestion, globalIndex: number) => (
    <li key={`${suggestion.type}-${suggestion.id || suggestion.role || 'all'}`}>
      <button
        type="button"
        onClick={() => onSelect(suggestion)}
        className={`
          w-full px-2.5 py-2 flex items-center gap-2.5 text-left transition-colors
          ${globalIndex === selectedIndex
            ? 'bg-slate-700/70'
            : 'hover:bg-slate-700/40'
          }
        `}
      >
        {/* Ikon/Avatar - REDESIGN: Mindre */}
        <div className="flex-shrink-0">
          {suggestion.avatarUrl ? (
            <img
              src={suggestion.avatarUrl}
              alt={suggestion.displayName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center
              ${suggestion.type === 'all'
                ? 'bg-[#20c58f]/20'
                : suggestion.type === 'role'
                ? 'bg-purple-500/20'
                : 'bg-slate-700'
              }
            `}>
              {getRoleIcon(suggestion)}
            </div>
          )}
        </div>

        {/* Text - REDESIGN: Kompaktare */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-200 text-[12px] truncate">
            {suggestion.displayName}
          </p>
          {suggestion.subtitle && suggestion.type !== 'user' && (
            <p className="text-[10px] text-slate-500 truncate">
              {suggestion.subtitle}
            </p>
          )}
        </div>

        {/* Roll-badge för användare - REDESIGN: Subtilare */}
        {suggestion.type === 'user' && suggestion.subtitle && (
          <span className={`
            flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium opacity-80
            ${getRoleBadgeColors(suggestion.role)}
          `}>
            {suggestion.subtitle}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <div
      className="absolute z-50 w-64 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-md shadow-xl overflow-hidden"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      {/* Header - REDESIGN: Kompaktare */}
      <div className="px-2.5 py-1.5 border-b border-slate-700/60">
        <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider font-medium">
          <AtSign className="w-2.5 h-2.5" />
          Nämn
        </p>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {/* GRUPPER sektion */}
        {groups.length > 0 && (
          <div>
            <div className="px-2.5 py-1 bg-slate-900/30">
              <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-2.5 h-2.5" />
                Grupper
              </p>
            </div>
            <ul>
              {groups.map((suggestion, index) =>
                renderSuggestionItem(suggestion, getGlobalIndex(index, true))
              )}
            </ul>
          </div>
        )}

        {/* PERSONER sektion */}
        {people.length > 0 && (
          <div>
            <div className="px-2.5 py-1 bg-slate-900/30">
              <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <User className="w-2.5 h-2.5" />
                Personer
              </p>
            </div>
            <ul>
              {people.map((suggestion, index) =>
                renderSuggestionItem(suggestion, getGlobalIndex(index, false))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Footer - REDESIGN: Mer diskret */}
      <div className="px-2 py-1.5 border-t border-slate-700/60 bg-slate-800/50">
        <p className="text-[10px] text-slate-600">
          <kbd className="px-1 py-0.5 bg-slate-700/70 rounded text-[9px] text-slate-400">↑↓</kbd>
          {' '}
          <kbd className="px-1 py-0.5 bg-slate-700/70 rounded text-[9px] text-slate-400">↵</kbd>
          {' '}
          <kbd className="px-1 py-0.5 bg-slate-700/70 rounded text-[9px] text-slate-400">Esc</kbd>
        </p>
      </div>
    </div>
  );
}

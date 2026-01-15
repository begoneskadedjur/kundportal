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

  const getRoleIcon = (suggestion: MentionSuggestion) => {
    if (suggestion.type === 'all') {
      return <Users className="w-4 h-4 text-[#20c58f]" />;
    }
    if (suggestion.type === 'role') {
      return <Users className="w-4 h-4 text-purple-400" />;
    }
    return <User className="w-4 h-4 text-slate-400" />;
  };

  const getRoleBadgeColors = (role?: string): string => {
    if (!role) return 'bg-slate-500/20 text-slate-300';
    const colors = ROLE_COLORS[role as AuthorRole];
    if (colors) return `${colors.bg} ${colors.text}`;
    return 'bg-slate-500/20 text-slate-300';
  };

  const renderSuggestionItem = (suggestion: MentionSuggestion, globalIndex: number) => (
    <li key={`${suggestion.type}-${suggestion.id || suggestion.role || 'all'}`}>
      <button
        type="button"
        onClick={() => onSelect(suggestion)}
        className={`
          w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors
          ${globalIndex === selectedIndex
            ? 'bg-slate-700'
            : 'hover:bg-slate-700/50'
          }
        `}
      >
        {/* Ikon/Avatar */}
        <div className="flex-shrink-0">
          {suggestion.avatarUrl ? (
            <img
              src={suggestion.avatarUrl}
              alt={suggestion.displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center
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

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm truncate">
            {suggestion.displayName}
          </p>
          {suggestion.subtitle && (
            <p className="text-xs text-slate-400 truncate">
              {suggestion.subtitle}
            </p>
          )}
        </div>

        {/* Roll-badge för användare */}
        {suggestion.type === 'user' && suggestion.subtitle && (
          <span className={`
            flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium
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
      className="absolute z-50 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <div className="px-3 py-2 border-b border-slate-700">
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <AtSign className="w-3 h-3" />
          Nämn någon
        </p>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {/* GRUPPER sektion */}
        {groups.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-slate-900/50 border-b border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3" />
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
            <div className="px-3 py-1.5 bg-slate-900/50 border-y border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3 h-3" />
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

      <div className="px-3 py-2 border-t border-slate-700 bg-slate-800/50">
        <p className="text-xs text-slate-500">
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">↑↓</kbd>
          {' '}navigera{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">↵</kbd>
          {' '}välj{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">Esc</kbd>
          {' '}stäng
        </p>
      </div>
    </div>
  );
}
